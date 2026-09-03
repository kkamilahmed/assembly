// Shared, plain (no React/Three) timing + topology constants. The 3D scene
// derives its geometry from these so a weld's spark lines up with the car
// mesh actually being at that station — see scene/constants.ts.

export const ROBOT_IDS = ['PANEL-01', 'WELD-01', 'PAINT-01', 'WHEEL-01'] as const;
export type RobotId = (typeof ROBOT_IDS)[number];

export const ROBOT_LABELS: Record<RobotId, string> = {
  'PANEL-01': 'Panel Fitting',
  'WELD-01': 'Body Weld',
  'PAINT-01': 'Paint Booth',
  'WHEEL-01': 'Wheel Mount',
};

/** The station whose mechanical alignment the story director drifts.
 * Deliberately the first station: it's the one with the shortest transit
 * delay to its own weld measurements, so the windowed trend has enough
 * real samples to be trustworthy well before the ramp finishes — see the
 * timing note in state/storyDirector.ts. */
export const PROBLEM_ROBOT_ID: RobotId = 'WELD-01';

/** Time between one robot's weld and the next robot's weld, for one car —
 * still used to size STATION_SPACING (scene/constants.ts) even though the
 * walking-beam conveyor no longer schedules off it directly. */
export const ROBOT_TRANSIT_MS = 5200;
export const ROBOT_TRANSIT_JITTER_MS = 250;

/** The walking-beam conveyor's shared cadence: every occupied station
 * advances one slot every STATION_CYCLE_MS, in lockstep. */
export const STATION_CYCLE_MS = 4800;

/** How long a car takes to glide to a newly-docked station's position once
 *  CarProducer's walking-beam conveyor tells it to — comfortably inside one
 *  STATION_CYCLE_MS, so the car is sitting still well before that station's
 *  own choreography needs to start. Re-exported from scene/constants.ts so
 *  both CarShell (position glide) and RobotArm (reach begins only after the
 *  car has arrived) read one source of truth. */
export const SNAP_TRANSITION_MS = 800;

/** How long each station's own choreography takes — all comfortably under
 * STATION_CYCLE_MS so a station is done well before the next index step. */
export const WORK_MS: Record<RobotId, number> = {
  'PANEL-01': 3200,
  'WELD-01': 3600,
  'PAINT-01': 3000,
  // Four wheel machines now mount 1 tire each in parallel (see
  // scene/stationTargets.ts's WHEEL_CORNER_MIRRORED) instead of one machine
  // mounting 4 in sequence, so the whole station's choreography finishes
  // sooner.
  'WHEEL-01': 2800,
};

/** One index past the last real station — a one-cycle "exit lane" holding
 * cell so a car has time to visually glide off toward DESPAWN_X before
 * it's actually removed from the line. */
export const EXIT_STATION_INDEX = ROBOT_IDS.length;

/** Sentinel `stationIndex` for a car diverted to the rework siding — no
 * longer part of the walking-beam cadence, just parked. */
export const SIDING_STATION_INDEX = -1;

// ---- Drift-analysis thresholds, shared by DriftAnalyzer and the store's
// pure `deriveStatus`, so the two can never drift out of sync with each
// other. ----
export const WELD_TOLERANCE_MM = 1.2;
export const WARN_TREND_MM = 0.55;
export const CRITICAL_TREND_MM = 0.85;
export const TREND_WINDOW_MS = 30_000;
export const SAMPLE_EVERY_N = 7;
/** Below this many samples, a windowed average is too noisy to act on —
 * shared by DriftAnalyzer's own action gating and the store's derived
 * status, so a fresh robot can't flash "critical" off one unlucky weld. */
export const MIN_TREND_SAMPLES = 5;
