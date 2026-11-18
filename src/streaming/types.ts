// Event schema shared by the simulated Kafka topics. A real backend would
// serialize these same shapes over a WebSocket/SSE bridge - see README.
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

/** The QC verdict for one weld. Every weld is inspected as it streams past,
 * so every weld gets one. */
export interface QCCheckEvent {
  topic: 'qc-checks';
  robot_id: RobotId;
  car_id: string;
  timestamp: number;
  /** Did this weld exceed tolerance? A failed car is pulled for rework. */
  suspect: boolean;
  /** The raw signed deviation this verdict was based on, mm. */
  deviation_mm: number;
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
  /** Windowed mean |deviation|, mm. */
  trendMm: number;
  sampleCount: number;
  /** Least-squares slope of |deviation| across the window,
   * mm per second. Positive means the process centre is still moving. */
  trendSlopeMmPerSec: number;
  /** Projected ms until the trend reaches the hard spec limit at the
   * current slope, or null when it isn't heading there (flat/falling
   * slope, or an ETA too far out to be meaningful). This is the number a
   * per-event threshold rule structurally cannot produce: it only exists
   * because the job keeps windowed state. */
  projectedBreachMs: number | null;
}

export type RobotMetricsEvent = RobotActionEvent | RobotWindowStatsEvent;

export type StreamEvent = WeldEvent | QCCheckEvent | RobotMetricsEvent;

export interface TopicEventMap {
  welds: WeldEvent;
  'qc-checks': QCCheckEvent;
  'robot-metrics': RobotMetricsEvent;
}

export type EventHandler<T extends Topic> = (event: TopicEventMap[T]) => void;
