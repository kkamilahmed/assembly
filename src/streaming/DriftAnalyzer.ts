import type { DriftAction, DriftActionEvent, MeasurementEvent, QCCheckEvent, WindowStatsEvent } from './types';
import { scaleMs } from '@/presenter/presenterConfig';
import {
  BROWNING_TOLERANCE,
  CRITICAL_TREND,
  MIN_TREND_SAMPLES,
  TREND_WINDOW_MS,
  WARN_TREND,
  type MachineId,
} from './lineConfig';

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

export type QCCheckListener = (event: QCCheckEvent) => void;
export type WindowStatsListener = (event: WindowStatsEvent) => void;
export type ActionListener = (event: DriftActionEvent) => void;
type Severity = 'healthy' | 'warning' | 'critical';

/**
 * Stands in for a Flink job on the inspection topic: judges every loaf as it
 * arrives (per-event QC) and keeps a trailing-window trend of the browning
 * offset that raises a drift alert when the process centre moves (windowed
 * analytics). A real deployment replaces this with a bridge relaying
 * decisions from an actual Flink job.
 */
export class DriftAnalyzer {
  readonly machineId: MachineId;
  private window: WindowEntry[] = [];
  private severity: Severity = 'healthy';
  private paused = false;
  private intervalId: number | null = null;

  private qcListeners = new Set<QCCheckListener>();
  private statsListeners = new Set<WindowStatsListener>();
  private actionListeners = new Set<ActionListener>();

  constructor(machineId: MachineId) {
    this.machineId = machineId;
  }

  start() {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.evaluate(), EVALUATE_EVERY_MS);
  }

  /** Forget the window. Called on reset and on recalibration: a freshly
   *  calibrated oven is a new process, and averaging its loaves against the
   *  burnt ones before it would hold the alarm up after the fix landed. */
  reset() {
    this.window = [];
    this.severity = 'healthy';
    this.emitStats(Date.now());
  }

  /** A stopped line freezes the window instead of ageing it out, so the
   *  evidence is still there while the operator looks at it. */
  configure({ paused }: { paused: boolean }) {
    this.paused = paused;
  }

  onQCCheck(l: QCCheckListener) {
    this.qcListeners.add(l);
  }
  onWindowStats(l: WindowStatsListener) {
    this.statsListeners.add(l);
  }
  onAction(l: ActionListener) {
    this.actionListeners.add(l);
  }

  ingest(m: MeasurementEvent) {
    this.window.push({ timestamp: m.timestamp, offset: m.offset });
    const event: QCCheckEvent = {
      topic: 'qc-checks',
      machine_id: this.machineId,
      item_id: m.item_id,
      timestamp: m.timestamp,
      suspect: Math.abs(m.offset) > BROWNING_TOLERANCE,
      offset: m.offset,
    };
    this.qcListeners.forEach((l) => l(event));
  }

  private trend(): number {
    const n = this.window.length;
    return n ? this.window.reduce((sum, e) => sum + e.offset, 0) / n : 0;
  }

  private slopePerSec(): number {
    const n = this.window.length;
    if (n < MIN_TREND_SAMPLES) return 0;
    const t0 = this.window[0].timestamp;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const e of this.window) {
      const x = (e.timestamp - t0) / 1000;
      sx += x;
      sy += e.offset;
      sxx += x * x;
      sxy += x * e.offset;
    }
    const denom = n * sxx - sx * sx;
    return Math.abs(denom) < 1e-6 ? 0 : (n * sxy - sx * sy) / denom;
  }

  private emitStats(now: number): { trend: number; count: number } {
    const trend = this.trend();
    const count = this.window.length;
    const slope = this.slopePerSec();
    const headroom = BROWNING_TOLERANCE - Math.abs(trend);
    const projectedBreachMs =
      count >= MIN_TREND_SAMPLES && trend >= 0 && slope > MIN_PROJECTABLE_SLOPE && headroom > 0
        ? Math.min((headroom / slope) * 1000, MAX_PROJECTION_MS)
        : null;
    const event: WindowStatsEvent = {
      topic: 'machine-metrics',
      kind: 'window-stats',
      machine_id: this.machineId,
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
    if (this.paused) return;
    const now = Date.now();
    this.window = this.window.filter((e) => now - e.timestamp <= TREND_WINDOW_MS);
    const { trend, count } = this.emitStats(now);
    if (count < MIN_TREND_SAMPLES) return;

    const magnitude = Math.abs(trend);
    const next: Severity = magnitude > CRITICAL_TREND ? 'critical' : magnitude > WARN_TREND ? 'warning' : 'healthy';
    if (next === this.severity) return;
    this.severity = next;
    const action: DriftAction = next === 'critical' ? 'drift_critical' : next === 'warning' ? 'drift_warning' : 'drift_cleared';
    const reason =
      next === 'healthy'
        ? `browning back to ${trend.toFixed(1)} from target`
        : `browning ${trend > 0 ? '+' : ''}${trend.toFixed(1)} from target`;
    this.actionListeners.forEach((l) =>
      l({ topic: 'machine-metrics', kind: 'action', machine_id: this.machineId, timestamp: now, action, reason }),
    );
  }
}
