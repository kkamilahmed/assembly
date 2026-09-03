import type {
  QCCheckEvent,
  RobotActionEvent,
  RobotDriftAction,
  RobotWindowStatsEvent,
  WeldEvent,
} from './types';
import {
  CRITICAL_TREND_MM,
  MIN_TREND_SAMPLES,
  SAMPLE_EVERY_N,
  TREND_WINDOW_MS,
  WARN_TREND_MM,
  WELD_TOLERANCE_MM,
  type RobotId,
} from './lineConfig';

export interface DriftAnalyzerConfig {
  /** Live vision QC toggle, fanned in from the line-wide switch. When
   * false, every weld still updates ground truth internally, but only a
   * periodic sample gets an actual inspection verdict — the pre-streaming
   * fallback (see README). */
  enabled: boolean;
  /** |deviation| beyond this is a ground-truth-suspect weld. */
  toleranceMm: number;
  /** Windowed trend threshold that raises a proactive 'drift_warning' —
   * deliberately well below toleranceMm, so it fires before any single
   * weld would fail a hard spec check. */
  warnTrendMm: number;
  /** Windowed trend threshold that raises 'drift_critical'. */
  criticalTrendMm: number;
  /** Trailing window for the trend calc, ms. */
  windowMs: number;
  /** When disabled, inspect only 1 weld out of every N (periodic manual
   * sampling instead of continuous vision tracking). */
  sampleEveryN: number;
}

const DEFAULT_CONFIG: DriftAnalyzerConfig = {
  enabled: true,
  toleranceMm: WELD_TOLERANCE_MM,
  warnTrendMm: WARN_TREND_MM,
  criticalTrendMm: CRITICAL_TREND_MM,
  windowMs: TREND_WINDOW_MS,
  sampleEveryN: SAMPLE_EVERY_N,
};

interface WindowEntry {
  timestamp: number;
  deviationMm: number;
}

export type GroundTruthListener = (weld: WeldEvent, suspect: boolean) => void;
export type QCCheckListener = (event: QCCheckEvent) => void;
export type WindowStatsListener = (event: RobotWindowStatsEvent) => void;
export type ActionListener = (event: RobotActionEvent) => void;
export type Severity = 'healthy' | 'warning' | 'critical';

/**
 * Stands in for a per-robot Flink job: consumes weld measurements, keeps a
 * trailing-window trend, and decides both a proactive drift alert (windowed,
 * derived) and a per-weld QC verdict (per-event rule). Ground truth is
 * always computed, whether or not the operator is actually watching it —
 * see `ingestWeld`. A real deployment replaces this class with a bridge
 * relaying decisions from an actual Flink job; nothing downstream needs to
 * know the difference.
 */
export class DriftAnalyzer {
  readonly robotId: RobotId;
  private config: DriftAnalyzerConfig = { ...DEFAULT_CONFIG };
  private window: WindowEntry[] = [];
  private weldsSinceModeStart = 0;
  private displayedTrendMm = 0;
  private severity: Severity = 'healthy';
  private windowIntervalId: number | null = null;

  private groundTruthListeners = new Set<GroundTruthListener>();
  private qcListeners = new Set<QCCheckListener>();
  private windowStatsListeners = new Set<WindowStatsListener>();
  private actionListeners = new Set<ActionListener>();

  constructor(robotId: RobotId) {
    this.robotId = robotId;
  }

  start() {
    if (this.windowIntervalId !== null) return;
    this.windowIntervalId = window.setInterval(() => this.evaluateWindow(), 2000);
  }

  stop() {
    if (this.windowIntervalId !== null) clearInterval(this.windowIntervalId);
    this.windowIntervalId = null;
  }

  reset() {
    this.window = [];
    this.weldsSinceModeStart = 0;
    this.displayedTrendMm = 0;
    this.severity = 'healthy';
  }

  configure(partial: Partial<DriftAnalyzerConfig>) {
    if ('enabled' in partial && partial.enabled !== this.config.enabled) {
      this.weldsSinceModeStart = 0;
    }
    this.config = { ...this.config, ...partial };
  }

  getConfig(): DriftAnalyzerConfig {
    return this.config;
  }

  getSeverity(): Severity {
    return this.severity;
  }

  onGroundTruth(listener: GroundTruthListener) {
    this.groundTruthListeners.add(listener);
    return () => this.groundTruthListeners.delete(listener);
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

  /** Ingest one weld measurement. Ground truth is always updated; whether
   * it gets an actual inspection verdict depends on the current mode. */
  ingestWeld(weld: WeldEvent) {
    this.window.push({ timestamp: weld.timestamp, deviationMm: weld.deviation_mm });

    const suspect = Math.abs(weld.deviation_mm) > this.config.toleranceMm;
    this.groundTruthListeners.forEach((l) => l(weld, suspect));

    this.weldsSinceModeStart++;
    const inspected = this.config.enabled || this.weldsSinceModeStart % this.config.sampleEveryN === 0;
    if (!inspected) return;

    if (!this.config.enabled) {
      // A manual spot check only ever tells you about the one weld you
      // happened to pull — not a trend — so the displayed reading snaps to
      // that single sample rather than the (unwatched) windowed average.
      this.displayedTrendMm = Math.abs(weld.deviation_mm);
    }

    const event: QCCheckEvent = {
      topic: 'qc-checks',
      robot_id: this.robotId,
      car_id: weld.car_id,
      timestamp: weld.timestamp,
      suspect,
      deviation_mm: weld.deviation_mm,
      inspectionMode: this.config.enabled ? 'live' : 'sampled',
    };
    this.qcListeners.forEach((l) => l(event));
  }

  private evaluateWindow() {
    const now = Date.now();
    this.window = this.window.filter((e) => now - e.timestamp <= this.config.windowMs);
    const count = this.window.length;
    const groundTruthTrendMm = count
      ? this.window.reduce((sum, e) => sum + Math.abs(e.deviationMm), 0) / count
      : 0;

    // The displayed trend only tracks ground truth live when someone's
    // actually watching; otherwise it holds at its last sampled value
    // (updated in ingestWeld) until the next spot check.
    if (this.config.enabled) this.displayedTrendMm = groundTruthTrendMm;

    const statsEvent: RobotWindowStatsEvent = {
      topic: 'robot-metrics',
      kind: 'window-stats',
      robot_id: this.robotId,
      timestamp: now,
      groundTruthTrendMm,
      displayedTrendMm: this.displayedTrendMm,
      sampleCount: count,
    };
    this.windowStatsListeners.forEach((l) => l(statsEvent));

    if (count < MIN_TREND_SAMPLES) return;

    const nextSeverity: Severity =
      groundTruthTrendMm > this.config.criticalTrendMm
        ? 'critical'
        : groundTruthTrendMm > this.config.warnTrendMm
          ? 'warning'
          : 'healthy';

    if (nextSeverity === this.severity) return;
    const prev = this.severity;
    this.severity = nextSeverity;

    let action: RobotDriftAction | null = null;
    let reason = '';
    if (nextSeverity === 'critical') {
      action = 'drift_critical';
      reason = `windowed deviation trend ${groundTruthTrendMm.toFixed(2)}mm exceeded ${this.config.criticalTrendMm}mm`;
    } else if (nextSeverity === 'warning' && prev === 'healthy') {
      action = 'drift_warning';
      reason = `windowed deviation trend ${groundTruthTrendMm.toFixed(2)}mm trending toward the ${this.config.toleranceMm}mm tolerance`;
    } else if (nextSeverity === 'healthy') {
      action = 'drift_cleared';
      reason = `windowed deviation trend recovered to ${groundTruthTrendMm.toFixed(2)}mm`;
    }

    if (action) {
      this.actionListeners.forEach((l) =>
        l({ topic: 'robot-metrics', kind: 'action', robot_id: this.robotId, timestamp: now, action: action!, reason }),
      );
    }
  }
}
