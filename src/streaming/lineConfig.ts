// Shared, plain (no React/Three) timing + topology constants. The 3D scene
// derives its geometry from these so a weld's spark lines up with the car
// mesh actually being at that station - see scene/constants.ts.

import { scaleMs } from '@/presenter/presenterConfig';

export const ROBOT_IDS = ['PANEL-01', 'WELD-01', 'PAINT-01', 'WHEEL-01'] as const;
export type RobotId = (typeof ROBOT_IDS)[number];

export const ROBOT_LABELS: Record<RobotId, string> = {
  'PANEL-01': 'Panel Fitting',
  'WELD-01': 'Body Weld',
  'PAINT-01': 'Paint Booth',
  'WHEEL-01': 'Wheel Mount',
};

/** The station whose torch alignment the presenter's D / E keys drift (see
 * state/storyDirector.ts). It is the one station that measures every car it
 * works on, so it is the one whose fault turns into rejected cars. */
export const PROBLEM_ROBOT_ID: RobotId = 'WELD-01';

// Presenter speed scales SCHEDULES, never GEOMETRY. ROBOT_TRANSIT_MS below
// is deliberately left unscaled: scene/constants.ts derives STATION_SPACING
// from it, so scaling it would physically move the stations apart when you
// changed the demo's pace.
/** Time between one robot's weld and the next robot's weld, for one car -
 * still used to size STATION_SPACING (scene/constants.ts) even though the
 * walking-beam conveyor no longer schedules off it directly. */
export const ROBOT_TRANSIT_MS = 5200;
export const ROBOT_TRANSIT_JITTER_MS = 250;

/** The walking-beam conveyor's shared cadence: every occupied station
 * advances one slot every STATION_CYCLE_MS, in lockstep. */
export const STATION_CYCLE_MS = scaleMs(4800);

/** How long a car takes to glide to a newly-docked station's position once
 *  CarProducer's walking-beam conveyor tells it to - comfortably inside one
 *  STATION_CYCLE_MS, so the car is sitting still well before that station's
 *  own choreography needs to start. Re-exported from scene/constants.ts so
 *  both CarShell (position glide) and RobotArm (reach begins only after the
 *  car has arrived) read one source of truth. */
export const SNAP_TRANSITION_MS = scaleMs(800);

/** How long each station's own choreography takes - all comfortably under
 * STATION_CYCLE_MS so a station is done well before the next index step. */
export const WORK_MS: Record<RobotId, number> = {
  'PANEL-01': scaleMs(3200),
  'WELD-01': scaleMs(3600),
  'PAINT-01': scaleMs(3000),
  // Four wheel machines now mount 1 tire each in parallel (see
  // scene/stationTargets.ts's WHEEL_CORNER_MIRRORED) instead of one machine
  // mounting 4 in sequence, so the whole station's choreography finishes
  // sooner.
  'WHEEL-01': scaleMs(2800),
};

/** One index past the last real station - a one-cycle "exit lane" holding
 * cell so a car has time to visually glide off toward DESPAWN_X before
 * it's actually removed from the line. */
export const EXIT_STATION_INDEX = ROBOT_IDS.length;

/**
 * Cars that fail weld QC are pulled off the line into a rework bay in the
 * foreground, right in front of the weld station, and stay there until
 * newer rejects push them out.
 *
 * This is the part of the story the audience has to be able to see from the
 * back of the room: a slight deviation puts an occasional car in the bay, an
 * emergency fills it. A single shared parking spot (the old siding) stacked
 * every reject on top of the last, so ten scrapped cars looked like one.
 *
 * Bay slots use their own sentinel `stationIndex` range so nothing in the
 * walking-beam cadence has to know about them. Slot 0 is the newest.
 */
export const REWORK_BAY_SLOTS = 3;
export const REWORK_BAY_BASE_INDEX = -10;
export const reworkBaySlot = (stationIndex: number): number | null => {
  const slot = REWORK_BAY_BASE_INDEX - stationIndex;
  return slot >= 0 && slot < REWORK_BAY_SLOTS ? slot : null;
};

// ---- Weld quality, shared by DriftAnalyzer and the store's pure
// `deriveStatus`, so the two can never drift out of sync with each other. ----

/** Hard per-weld spec limit. A single weld beyond this fails QC and the car
 * is pulled for rework. */
export const WELD_TOLERANCE_MM = 1.2;

/** Process sigma for a single weld, mm - normal run-to-run variation with
 * the torch correctly calibrated. Tight relative to WELD_TOLERANCE_MM, so a
 * healthy line essentially never fails a car and every reject on screen is
 * caused by the deviation the presenter injected. */
export const WELD_PROCESS_SIGMA_MM = 0.12;

/**
 * Mechanical torch offset each injected fault level drifts the weld robot
 * to. Tuned against the tolerance and sigma above so the two keys tell two
 * different stories:
 *
 *  slight    (D) - offset sits just past the spec limit, so normal process
 *                  variation lets roughly one car in three through and fails
 *                  the rest. The line looks like it is running fine - most
 *                  of the arm's motion is unchanged - while it quietly fills
 *                  the rework bay.
 *  emergency (E) - offset is well past the limit. Every car fails.
 */
export const DEVIATION_OFFSET_MM = { slight: 1.25, emergency: 2.3 } as const;
export type DeviationLevel = keyof typeof DEVIATION_OFFSET_MM;

/** How long the torch takes to drift to that offset. Slight creeps in, an
 *  emergency is a sudden mechanical event. */
export const DEVIATION_RAMP_MS = { slight: scaleMs(6000), emergency: scaleMs(1500) } as const;

/** Control limits on the windowed mean |deviation|. Slight lands in warning,
 *  emergency in critical. */
export const WARN_TREND_MM = 0.45;
export const CRITICAL_TREND_MM = 1.5;

/** Trailing window for the trend calc, ms - about three welds at the line's
 *  cadence. Short on purpose: this demo is driven live from the keyboard,
 *  and the machine card has to react within a sentence or two of the key
 *  press, not half a minute later. Scaled with the cadence so the window
 *  holds the same number of welds at any presenter speed. */
export const TREND_WINDOW_MS = scaleMs(15_000);

/** Below this many samples, a windowed average is too noisy to act on -
 * shared by DriftAnalyzer's own action gating and the store's derived
 * status, so a fresh robot can't flash "critical" off one unlucky weld. */
export const MIN_TREND_SAMPLES = 2;
