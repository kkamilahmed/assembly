import type { AuthorizationEvent, DriftAction, DriftActionEvent, ScoreEvent, WindowStatsEvent } from './types';
import { scaleMs } from '@/presenter/presenterConfig';
import {
  CRITICAL_TREND,
  MIN_TREND_SAMPLES,
  PROBLEM_SOURCE_ID,
  RISK_FLAG,
  SOURCE_IDS,
  TREND_WINDOW_MS,
  WARN_TREND,
  type SourceId,
} from './networkConfig';

/** Below this the fit is indistinguishable from a flat process wobbling. */
const MIN_PROJECTABLE_SLOPE = 0.05; // per second
/** An ETA further out than this is true but useless. */
const MAX_PROJECTION_MS = 5 * 60_000;
/** Rollup cadence, scaled so a sped-up run keeps the same trend shape. */
const EVALUATE_EVERY_MS = scaleMs(500);

interface WindowEntry {
  timestamp: number;
  offset: number;
}

export type ScoreListener = (event: ScoreEvent) => void;
export type WindowStatsListener = (event: WindowStatsEvent) => void;
export type ActionListener = (event: DriftActionEvent) => void;
type Severity = 'healthy' | 'warning' | 'critical';

function emptyWindows(): Record<SourceId, WindowEntry[]> {
  return Object.fromEntries(SOURCE_IDS.map((id) => [id, []])) as unknown as Record<SourceId, WindowEntry[]>;
}

function healthyAll(): Record<SourceId, Severity> {
  return Object.fromEntries(SOURCE_IDS.map((id) => [id, 'healthy'])) as Record<SourceId, Severity>;
}

/**
 * Stands in for a Flink job on the authorizations topic: scores every
 * payment as it arrives (per-event verdict) and keeps a trailing window per
 * source of the risk of the charges that were approved, raising an alert
 * when fraud starts getting through (windowed analytics). Blocked charges
 * do not count toward it: a source whose fraud is being stopped is not
 * losing money. A real deployment replaces this with a bridge relaying
 * decisions from an actual Flink job.
 */
export class FraudAnalyzer {
  private windows = emptyWindows();
  private severity = healthyAll();
  private frozen = false;
  private intervalId: number | null = null;

  private scoreListeners = new Set<ScoreListener>();
  private statsListeners = new Set<WindowStatsListener>();
  private actionListeners = new Set<ActionListener>();

  start() {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.evaluate(), EVALUATE_EVERY_MS);
  }

  /** Forget every window. Called on reset. */
  reset() {
    this.windows = emptyWindows();
    this.severity = healthyAll();
    const now = Date.now();
    for (const id of SOURCE_IDS) this.emitStats(id, now);
  }

  /** Forget one source's window. Called on recalibration: once the rules
   *  are fitted to the attack, averaging the charges that slipped through
   *  before the fix would hold the alarm up after it landed. */
  resetSource(id: SourceId) {
    this.windows[id] = [];
    this.severity[id] = 'healthy';
    this.emitStats(id, Date.now());
  }

  /** A frozen merchant's window is held instead of ageing out, so the
   *  evidence is still there while the analyst looks at it. */
  configure({ frozen }: { frozen: boolean }) {
    this.frozen = frozen;
  }

  onScore(l: ScoreListener) {
    this.scoreListeners.add(l);
  }
  onWindowStats(l: WindowStatsListener) {
    this.statsListeners.add(l);
  }
  onAction(l: ActionListener) {
    this.actionListeners.add(l);
  }

  ingest(a: AuthorizationEvent) {
    if (a.approved) this.windows[a.source_id].push({ timestamp: a.timestamp, offset: a.offset });
    const event: ScoreEvent = {
      topic: 'fraud-scores',
      source_id: a.source_id,
      item_id: a.item_id,
      timestamp: a.timestamp,
      suspect: a.offset > RISK_FLAG,
      approved: a.approved,
      offset: a.offset,
    };
    this.scoreListeners.forEach((l) => l(event));
  }

  private trend(id: SourceId): number {
    const w = this.windows[id];
    return w.length ? w.reduce((sum, e) => sum + e.offset, 0) / w.length : 0;
  }

  private slopePerSec(id: SourceId): number {
    const w = this.windows[id];
    const n = w.length;
    if (n < MIN_TREND_SAMPLES) return 0;
    const t0 = w[0].timestamp;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const e of w) {
      const x = (e.timestamp - t0) / 1000;
      sx += x;
      sy += e.offset;
      sxx += x * x;
      sxy += x * e.offset;
    }
    const denom = n * sxx - sx * sx;
    return Math.abs(denom) < 1e-6 ? 0 : (n * sxy - sx * sy) / denom;
  }

  private emitStats(id: SourceId, now: number): { trend: number; count: number } {
    const trend = this.trend(id);
    const count = this.windows[id].length;
    const slope = this.slopePerSec(id);
    const headroom = WARN_TREND - trend;
    const projectedBreachMs =
      count >= MIN_TREND_SAMPLES && slope > MIN_PROJECTABLE_SLOPE && headroom > 0
        ? Math.min((headroom / slope) * 1000, MAX_PROJECTION_MS)
        : null;
    const event: WindowStatsEvent = {
      topic: 'source-metrics',
      kind: 'window-stats',
      source_id: id,
      timestamp: now,
      trend,
      sampleCount: count,
      trendSlopePerSec: slope,
      projectedBreachMs,
    };
    this.statsListeners.forEach((l) => l(event));
    return { trend, count };
  }

  private evaluate() {
    const now = Date.now();
    for (const id of SOURCE_IDS) {
      // A frozen merchant sends nothing; its window holds still.
      if (this.frozen && id === PROBLEM_SOURCE_ID) continue;
      this.windows[id] = this.windows[id].filter((e) => now - e.timestamp <= TREND_WINDOW_MS);
      const { trend, count } = this.emitStats(id, now);
      // Too few approved charges to judge, which on a quiet source is just
      // as much a sign that nothing risky is getting through.
      const next: Severity =
        count < MIN_TREND_SAMPLES ? 'healthy' : trend > CRITICAL_TREND ? 'critical' : trend > WARN_TREND ? 'warning' : 'healthy';
      if (next === this.severity[id]) continue;
      this.severity[id] = next;
      const action: DriftAction = next === 'critical' ? 'drift_critical' : next === 'warning' ? 'drift_warning' : 'drift_cleared';
      const reason = next === 'healthy' ? 'approved charges back to everyday risk' : `approved charges scoring +${trend.toFixed(0)} risk`;
      this.actionListeners.forEach((l) =>
        l({ topic: 'source-metrics', kind: 'action', source_id: id, timestamp: now, action, reason }),
      );
    }
  }
}
