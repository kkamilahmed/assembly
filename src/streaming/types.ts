// Event schema shared by the simulated Kafka topics. A real backend would
// serialize these same shapes over a WebSocket/SSE bridge — see README.
import type { RobotId } from './lineConfig';

export type Topic = 'welds' | 'qc-checks' | 'robot-metrics';

/** One robot's weld measurement for one car as it passed through. */
export interface WeldEvent {
  topic: 'welds';
  robot_id: RobotId;
  car_id: string;
  timestamp: number;
  /** Signed deviation of the weld point from its nominal position, mm. */
  deviation_mm: number;
}

/**
 * The QC verdict for one weld — but only ever produced for welds that were
 * actually *inspected*. When live vision QC is on, every weld is inspected
 * in real time. When it's off, only a periodic manual sample is inspected;
 * everything else ships with no verdict at all — see DriftAnalyzer.
 */
export interface QCCheckEvent {
  topic: 'qc-checks';
  robot_id: RobotId;
  car_id: string;
  timestamp: number;
  /** True ground-truth verdict: did this weld exceed tolerance? Computed
   * for every weld internally regardless of whether it was inspected. */
  suspect: boolean;
  /** The raw signed deviation this verdict was based on, mm. */
  deviation_mm: number;
  /** Why this particular weld got checked: continuously (live) or by
   * periodic sample (the pre-streaming fallback). */
  inspectionMode: 'live' | 'sampled';
}

export type RobotDriftAction = 'drift_warning' | 'drift_critical' | 'drift_cleared';

export interface RobotActionEvent {
  topic: 'robot-metrics';
  kind: 'action';
  robot_id: RobotId;
  timestamp: number;
  action: RobotDriftAction;
  reason: string;
}

/** Windowed rollup, emitted ~every 2s. Drives the per-robot sparkline. */
export interface RobotWindowStatsEvent {
  topic: 'robot-metrics';
  kind: 'window-stats';
  robot_id: RobotId;
  timestamp: number;
  /** True windowed avg |deviation| — kept up to date always, even while
   * live QC is off (this is the silent ground truth). */
  groundTruthTrendMm: number;
  /** What the operator dashboard actually shows: tracks ground truth in
   * real time when live QC is on; only snapshots at sample points when
   * it's off, so it lags behind reality in between samples. */
  displayedTrendMm: number;
  sampleCount: number;
}

export type RobotMetricsEvent = RobotActionEvent | RobotWindowStatsEvent;

export type StreamEvent = WeldEvent | QCCheckEvent | RobotMetricsEvent;

export interface TopicEventMap {
  welds: WeldEvent;
  'qc-checks': QCCheckEvent;
  'robot-metrics': RobotMetricsEvent;
}

export type EventHandler<T extends Topic> = (event: TopicEventMap[T]) => void;
