// Event schema shared by the simulated Kafka topics. A real backend would
// serialize these same shapes over a WebSocket/SSE bridge - see README.
import type { SourceId } from './networkConfig';

/** One payment as it reaches the processing hub: the stream's risk score
 *  for it, and what the production rules decided. */
export interface AuthorizationEvent {
  topic: 'authorizations';
  source_id: SourceId;
  item_id: string;
  timestamp: number;
  /** Risk score minus the everyday baseline. Positive is riskier. */
  offset: number;
  /** The rules let it through. */
  approved: boolean;
}

/** The stream's verdict on one payment. Every payment is scored as it
 *  streams past. */
export interface ScoreEvent {
  topic: 'fraud-scores';
  source_id: SourceId;
  item_id: string;
  timestamp: number;
  /** Scored as fraud. */
  suspect: boolean;
  approved: boolean;
  offset: number;
}

export type DriftAction = 'drift_warning' | 'drift_critical' | 'drift_cleared';

export interface DriftActionEvent {
  topic: 'source-metrics';
  kind: 'action';
  source_id: SourceId;
  timestamp: number;
  action: DriftAction;
  reason: string;
}

/** Windowed rollup per source, emitted twice a second. Drives the trend. */
export interface WindowStatsEvent {
  topic: 'source-metrics';
  kind: 'window-stats';
  source_id: SourceId;
  timestamp: number;
  /** Windowed mean risk over baseline of the source's approved charges. */
  trend: number;
  sampleCount: number;
  /** Least-squares slope of the risk across the window, per second. */
  trendSlopePerSec: number;
  /** Projected ms until the trend reaches the warning limit at the current
   *  slope, or null when it isn't heading there. */
  projectedBreachMs: number | null;
}
