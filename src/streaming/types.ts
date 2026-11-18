// Event schema shared by the simulated Kafka topics. A real backend would
// serialize these same shapes over a WebSocket/SSE bridge - see README.
import type { MachineId } from './lineConfig';

/** The weld check's reading for one module: how far its weakest busbar weld
 *  is from nominal pull strength, in newtons. */
export interface MeasurementEvent {
  topic: 'measurements';
  machine_id: MachineId;
  item_id: string;
  timestamp: number;
  /** Weld strength minus nominal, N. Negative is weaker. */
  offset: number;
}

/** The QC verdict for one module. Every module is checked as it streams past. */
export interface QCCheckEvent {
  topic: 'qc-checks';
  machine_id: MachineId;
  item_id: string;
  timestamp: number;
  /** Under the weld minimum: the module is flagged and scrapped at the
   *  reject station. */
  suspect: boolean;
  offset: number;
}

export type DriftAction = 'drift_warning' | 'drift_critical' | 'drift_cleared';

export interface DriftActionEvent {
  topic: 'machine-metrics';
  kind: 'action';
  machine_id: MachineId;
  timestamp: number;
  action: DriftAction;
  reason: string;
}

/** Windowed rollup, emitted every half second. Drives the trend chart. */
export interface WindowStatsEvent {
  topic: 'machine-metrics';
  kind: 'window-stats';
  machine_id: MachineId;
  timestamp: number;
  /** Windowed mean weld-strength offset, N. */
  trend: number;
  sampleCount: number;
  /** Least-squares slope of the offset across the window, N per second. */
  trendSlopePerSec: number;
  /** Projected ms until the trend reaches the weld minimum at the current
   *  slope, or null when it isn't heading there. */
  projectedBreachMs: number | null;
}
