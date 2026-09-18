// Shared, plain (no React/Three) timing + topology constants. The 3D scene
// derives its geometry from these so a weld's spark lines up with the car
// mesh actually being at that station — see scene/constants.ts.

import { scaleMs } from '@/presenter/presenterConfig';

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

// Presenter speed scales SCHEDULES, never GEOMETRY. ROBOT_TRANSIT_MS below
// is deliberately left unscaled: scene/constants.ts derives STATION_SPACING
// from it, so scaling it would physically move the stations apart when you
// changed the demo's pace.
/** Time between one robot's weld and the next robot's weld, for one car —
 * still used to size STATION_SPACING (scene/constants.ts) even though the
 * walking-beam conveyor no longer schedules off it directly. */
export const ROBOT_TRANSIT_MS = 5200;
export const ROBOT_TRANSIT_JITTER_MS = 250;

/** The walking-beam conveyor's shared cadence: every occupied station
 * advances one slot every STATION_CYCLE_MS, in lockstep. */
export const STATION_CYCLE_MS = scaleMs(4800);

/** How long a car takes to glide to a newly-docked station's position once
 *  CarProducer's walking-beam conveyor tells it to — comfortably inside one
 *  STATION_CYCLE_MS, so the car is sitting still well before that station's
 *  own choreography needs to start. Re-exported from scene/constants.ts so
 *  both CarShell (position glide) and RobotArm (reach begins only after the
 *  car has arrived) read one source of truth. */
export const SNAP_TRANSITION_MS = scaleMs(800);

/** How long each station's own choreography takes — all comfortably under
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

/** One index past the last real station — a one-cycle "exit lane" holding
 * cell so a car has time to visually glide off toward DESPAWN_X before
 * it's actually removed from the line. */
export const EXIT_STATION_INDEX = ROBOT_IDS.length;

/** Sentinel `stationIndex` for a car diverted to the rework siding — no
 * longer part of the walking-beam cadence, just parked. */
export const SIDING_STATION_INDEX = -1;

/**
 * Finished cars do not vanish at the end of the line. They park in a
 * "shipped today" bay, most recent first, and only leave once pushed out by
 * newer ones.
 *
 * This exists because of a timing problem that broke the demo's punchline.
 * A car takes about four conveyor cycles to travel from the weld station to
 * the end of the line, but the blind window between two manual spot checks
 * is seven welds long — so by the time the presenter switches inspection
 * back on, every car that shipped bad has already been deleted, and the
 * retroactive reveal has nothing left to turn red. Parking them keeps the
 * evidence on screen. It also fills the stretch of empty floor between the
 * camera and the line, which was otherwise dead frame.
 *
 * Bay slots use their own sentinel `stationIndex` range so nothing in the
 * walking-beam cadence has to know about them.
 */
// Five. Each slot is one conveyor cycle of memory, and four held under ten
// seconds of history at 2x — the bad cars were evicted before the presenter
// reached the reveal. The real fix for that was making the fault hold until
// somebody is actually watching (see state/storyDirector.ts), so this only
// needs to be deep enough to read as a row of finished cars; five is what
// fits across the settle framing without running off the left edge.
export const SHIPPED_BAY_SLOTS = 5;
export const SHIPPED_BAY_BASE_INDEX = -10;
export const shippedBaySlot = (stationIndex: number): number | null => {
  const slot = SHIPPED_BAY_BASE_INDEX - stationIndex;
  return slot >= 0 && slot < SHIPPED_BAY_SLOTS ? slot : null;
};

// ---- Drift-analysis thresholds, shared by DriftAnalyzer and the store's
// pure `deriveStatus`, so the two can never drift out of sync with each
// other. ----

/** Hard per-weld spec limit. A single weld beyond this is scrap/rework.
 * Nothing alerts on this directly — by the time a weld crosses it, the
 * defect already exists. It's the line the *trend* thresholds below exist
 * to stay ahead of. */
export const WELD_TOLERANCE_MM = 1.2;

/** Process sigma for a single weld, mm — normal run-to-run variation with
 * the tool-center-point correctly calibrated. Deliberately tight relative
 * to WELD_TOLERANCE_MM (a capable process; Cpk ~2.6 when centred), which is
 * what makes a drifting mean, rather than one noisy weld, the thing that
 * actually produces defects. */
export const WELD_PROCESS_SIGMA_MM = 0.12;

// The two trend thresholds are SPC-style control limits on the windowed
// mean absolute deviation — NOT spec limits. They sit far below
// WELD_TOLERANCE_MM on purpose: a window whose mean |deviation| has reached
// 0.42mm describes a process whose centre has moved, long before any
// individual weld is out of spec. Tuned (see the sweep in git history) so
// that `drift_critical` fires a median ~24s — worst case ~19s — before the
// first weld can actually breach tolerance. That lead time is the entire
// claim this demo makes; if you change the ramp shape in
// state/storyDirector.ts, re-check it.
export const WARN_TREND_MM = 0.25;
export const CRITICAL_TREND_MM = 0.42;

/** Trailing window for the trend calc, ms. Every ms of window is also ms of
 * lag between the physical drift and the trend reflecting it, so this is a
 * direct trade against the early-warning lead time above. */
// Scaled alongside the line cadence so the window still holds the same
// NUMBER of welds at any speed — the thresholds are tuned against sample
// count and ramp-versus-window lag, both of which are preserved when
// cadence and window scale together. Scaling only one would silently
// destroy the early-warning lead time.
export const TREND_WINDOW_MS = scaleMs(24_000);

export const SAMPLE_EVERY_N = 7;
/** Below this many samples, a windowed average is too noisy to act on —
 * shared by DriftAnalyzer's own action gating and the store's derived
 * status, so a fresh robot can't flash "critical" off one unlucky weld. */
export const MIN_TREND_SAMPLES = 5;
