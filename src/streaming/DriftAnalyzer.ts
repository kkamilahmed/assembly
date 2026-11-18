import type { QCCheckEvent, RobotActionEvent, RobotDriftAction, RobotWindowStatsEvent, WeldEvent } from './types';
import { scaleMs } from '@/presenter/presenterConfig';
import {
  CRITICAL_TREND_MM,
  MIN_TREND_SAMPLES,
  TREND_WINDOW_MS,
  WARN_TREND_MM,
  WELD_TOLERANCE_MM,
  type RobotId,
} from './lineConfig';

export interface DriftAnalyzerConfig {
  /** |deviation| beyond this fails QC. */
  toleranceMm: number;
  /** Windowed trend threshold that raises 'drift_warning'. */
  warnTrendMm: number;
  /** Windowed trend threshold that raises 'drift_critical'. */
  criticalTrendMm: number;
  /** Trailing window for the trend calc, ms. */
  windowMs: number;
  /** Line stopped. A trailing window is defined by wall-clock age, so a
   * stopped line would otherwise keep ageing its own samples out and decay
   * the trend to zero while nothing is actually happening - the operator
   * stops the line to look at a fault and watches the evidence evaporate.
   * While stopped the window is frozen intact and no rollup is emitted. */
  paused: boolean;
}

const DEFAULT_CONFIG: DriftAnalyzerConfig = {
  toleranceMm: WELD_TOLERANCE_MM,
  warnTrendMm: WARN_TREND_MM,
  criticalTrendMm: CRITICAL_TREND_MM,
  windowMs: TREND_WINDOW_MS,
  paused: false,
};

/** Below this the fit is indistinguishable from a flat process wobbling,
 * and dividing by it produces a nonsense ETA measured in hours. */
const MIN_PROJECTABLE_SLOPE = 0.004; // mm/sec
/** An ETA further out than this is true but useless. */
const MAX_PROJECTION_MS = 5 * 60_000;

/** Rollup cadence. Scaled with presenter speed so a sped-up run still gets
 *  the same number of trend samples per incident. */
const EVALUATE_EVERY_MS = scaleMs(1000);

interface WindowEntry {
  timestamp: number;
  deviationMm: number;
}

export type QCCheckListener = (event: QCCheckEvent) => void;
export type WindowStatsListener = (event: RobotWindowStatsEvent) => void;
export type ActionListener = (event: RobotActionEvent) => void;
export type Severity = 'healthy' | 'warning' | 'critical';

/**
 * Stands in for a per-robot Flink job: consumes weld measurements, keeps a
 * trailing-window trend, and emits both a per-weld QC verdict and a
 * windowed drift alert. A real deployment replaces this class with a bridge
 * relaying decisions from an actual Flink job; nothing downstream needs to
 * know the difference.
 */
export class DriftAnalyzer {
  readonly robotId: RobotId;
  private config: DriftAnalyzerConfig = { ...DEFAULT_CONFIG };
  private window: WindowEntry[] = [];
  private severity: Severity = 'healthy';
  private windowIntervalId: number | null = null;

  private qcListeners = new Set<QCCheckListener>();
  private windowStatsListeners = new Set<WindowStatsListener>();
  private actionListeners = new Set<ActionListener>();

  constructor(robotId: RobotId) {
    this.robotId = robotId;
  }

  start() {
    if (this.windowIntervalId !== null) return;
    this.windowIntervalId = window.setInterval(() => this.evaluateWindow(), EVALUATE_EVERY_MS);
  }

  stop() {
    if (this.windowIntervalId !== null) clearInterval(this.windowIntervalId);
    this.windowIntervalId = null;
  }

  /** Forget the window. Called on line reset, and on recalibration: a
   *  freshly calibrated torch is a new process, and averaging its first
   *  welds against the misaligned ones before it would hold the alarm up
   *  for a full window after the fix had already landed. */
  reset() {
    this.window = [];
    this.severity = 'healthy';
    this.emitStats(Date.now());
  }

  configure(partial: Partial<DriftAnalyzerConfig>) {
    this.config = { ...this.config, ...partial };
  }

  onQCCheck(listener: QCCheckListener) {
    this.qcListeners.add(listener);
    return () => this.qcListeners.delete(listener);
  }
  onWindowStats(listener: WindowStatsListener) {
    this.windowStatsListeners.add(listener);
    return () => this.windowStatsListeners.delete(listener);
  }
  onAction(listener: ActionListener) {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  /** Ingest one weld measurement: inspect it, and fold it into the trend. */
  ingestWeld(weld: WeldEvent) {
    this.window.push({ timestamp: weld.timestamp, deviationMm: weld.deviation_mm });
    const event: QCCheckEvent = {
      topic: 'qc-checks',
      robot_id: this.robotId,
      car_id: weld.car_id,
      timestamp: weld.timestamp,
      suspect: Math.abs(weld.deviation_mm) > this.config.toleranceMm,
      deviation_mm: weld.deviation_mm,
    };
    this.qcListeners.forEach((l) => l(event));
  }

  /** Least-squares slope of |deviation| against time across the window,
   * in mm/sec. Needs a spread of samples to mean anything, so it reports 0
   * rather than a wild number off a degenerate fit. */
  private windowSlopeMmPerSec(): number {
    const n = this.window.length;
    if (n < MIN_TREND_SAMPLES) return 0;
    const t0 = this.window[0].timestamp;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const e of this.window) {
      const x = (e.timestamp - t0) / 1000;
      const y = Math.abs(e.deviationMm);
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-6) return 0;
    return (n * sxy - sx * sy) / denom;
  }

  private trendMm(): number {
    const count = this.window.length;
    return count ? this.window.reduce((sum, e) => sum + Math.abs(e.deviationMm), 0) / count : 0;
  }

  private emitStats(now: number) {
    const trendMm = this.trendMm();
    const count = this.window.length;
    const trendSlopeMmPerSec = this.windowSlopeMmPerSec();
    const headroomMm = this.config.toleranceMm - trendMm;
    const projectedBreachMs =
      count >= MIN_TREND_SAMPLES && trendSlopeMmPerSec > MIN_PROJECTABLE_SLOPE && headroomMm > 0
        ? Math.min((headroomMm / trendSlopeMmPerSec) * 1000, MAX_PROJECTION_MS)
        : null;
    const statsEvent: RobotWindowStatsEvent = {
      topic: 'robot-metrics',
      kind: 'window-stats',
      robot_id: this.robotId,
      timestamp: now,
      trendMm,
      sampleCount: count,
      trendSlopeMmPerSec,
      projectedBreachMs,
    };
    this.windowStatsListeners.forEach((l) => l(statsEvent));
    return { trendMm, count };
  }

  private evaluateWindow() {
    // Frozen, not aged out - see DriftAnalyzerConfig.paused.
    if (this.config.paused) return;
    const now = Date.now();
    this.window = this.window.filter((e) => now - e.timestamp <= this.config.windowMs);
    const { trendMm, count } = this.emitStats(now);
    if (count < MIN_TREND_SAMPLES) return;

    const nextSeverity: Severity =
      trendMm > this.config.criticalTrendMm ? 'critical' : trendMm > this.config.warnTrendMm ? 'warning' : 'healthy';
    if (nextSeverity === this.severity) return;
    this.severity = nextSeverity;

    const action: RobotDriftAction =
      nextSeverity === 'critical' ? 'drift_critical' : nextSeverity === 'warning' ? 'drift_warning' : 'drift_cleared';
    const reason =
      nextSeverity === 'healthy'
        ? `windowed weld offset recovered to ${trendMm.toFixed(2)}mm`
        : `windowed weld offset ${trendMm.toFixed(2)}mm exceeded ${
            nextSeverity === 'critical' ? this.config.criticalTrendMm : this.config.warnTrendMm
          }mm`;
    this.actionListeners.forEach((l) =>
      l({ topic: 'robot-metrics', kind: 'action', robot_id: this.robotId, timestamp: now, action, reason }),
    );
  }
}
