// Event schema shared by the simulated Kafka topics. A real backend would
// serialize these same shapes over a WebSocket/SSE bridge - see README.
import type { MachineId } from './lineConfig';

/** The inspection station's reading for one tray: how far the mean weight
 *  of the tablets it sampled is from the label claim. */
export interface MeasurementEvent {
  topic: 'measurements';
  machine_id: MachineId;
  item_id: string;
  timestamp: number;
  /** Mean tablet weight minus target, mg. Negative is underweight. */
  offset: number;
}

/** The QC verdict for one tray. Every tray is inspected as it streams past. */
export interface QCCheckEvent {
  topic: 'qc-checks';
  machine_id: MachineId;
  item_id: string;
  timestamp: number;
  /** Out of tolerance: the tray is diverted into the reject bin. */
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

/** Windowed rollup, emitted every second. Drives the trend sparkline. */
export interface WindowStatsEvent {
  topic: 'machine-metrics';
  kind: 'window-stats';
  machine_id: MachineId;
  timestamp: number;
  /** Windowed mean tablet weight offset, mg. */
  trend: number;
  sampleCount: number;
  /** Least-squares slope of the offset across the window, per second. */
  trendSlopePerSec: number;
  /** Projected ms until the trend reaches the tolerance at the current
   *  slope, or null when it isn't heading there. */
  projectedBreachMs: number | null;
}
