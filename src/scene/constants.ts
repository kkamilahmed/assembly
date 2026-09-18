import { ROBOT_IDS, ROBOT_TRANSIT_MS, SNAP_TRANSITION_MS, type RobotId } from '@/streaming/lineConfig';

// ---- Line geometry (world units = METERS, X axis = line direction) ----
// The scene is laid out at real-world scale so the imported car body
// (~4.5 m) and industrial robot arm (~2 m) sit at believable proportions
// next to the conveyor. Station spacing is still derived from the same
// ROBOT_TRANSIT_MS the streaming layer schedules welds with, so a spark
// at a station lines up with the car mesh actually being there — see
// streaming/lineConfig.ts.
export const LINE_SPEED = 1.15; // m/s

export const STATION_SPACING = LINE_SPEED * (ROBOT_TRANSIT_MS / 1000);

export const LINE_START_X = -STATION_SPACING; // car spawn point, one spacing before WELD-01

export const ROBOT_X: Record<RobotId, number> = Object.fromEntries(
  ROBOT_IDS.map((id, i) => [id, i * STATION_SPACING]),
) as unknown as Record<RobotId, number>;

export const LINE_END_X = ROBOT_IDS.length * STATION_SPACING; // one spacing past the last robot
export const REWORK_STOP_X = LINE_END_X + STATION_SPACING * 0.7;
export const REWORK_SIDING_Z = 3.6;
export const DESPAWN_X = LINE_END_X + STATION_SPACING * 3;

/** The "shipped today" bay: finished cars parked in a row on the aisle side
 *  of the line, nearest the camera. See SHIPPED_BAY_SLOTS in
 *  streaming/lineConfig.ts for why they park rather than despawn. */
export const SHIPPED_BAY_Z = 7.4;
export const SHIPPED_BAY_SPACING = 5.0;
/** Right-to-left, newest nearest the end of the line. Anchored so all
 *  SHIPPED_BAY_SLOTS land inside the settle camera's horizontal framing —
 *  a bay car that parks off the edge of frame is evidence nobody can see. */
export const shippedBayX = (slot: number) => LINE_END_X - 0.5 - slot * SHIPPED_BAY_SPACING;

// Robot placement: stands behind the belt (−Z) and reaches forward over it.
export const ROBOT_Z = -2.8;

/** Height of the shoulder joint above the floor, i.e. the top of the
 *  pedestal. Single source of truth: the IK solver works in a
 *  shoulder-relative frame and RobotArm positions the shoulder group, and
 *  the two MUST agree or every arm silently aims at a point offset
 *  vertically from the one it was given. This was a bare 0.7 written twice,
 *  once as a default parameter in scene/ik.ts and once as a literal in
 *  RobotArm.tsx, with nothing tying them together. */
export const SHOULDER_Y = 0.95;

export const CONVEYOR_Y = 0.5; // belt surface height
export const CONVEYOR_WIDTH = 2.6;

// Wheel radius (m) — used to convert distance travelled into wheel spin.
export const WHEEL_RADIUS = 0.34;

// Normalized target sizes for the imported meshes (meters). Used for
// car-local target math (weld seam points, paint sweep endpoints, wheel
// hub offsets, panel placement point) in scene/stationTargets.ts.
export const CAR_LENGTH = 4.6;
export const CAR_WIDTH = 1.9;
export const CAR_HEIGHT = 1.4;

// How long a car takes to glide to a newly-docked station once the walking-
// beam conveyor tells it to. Shared between CarShell (position glide) and
// RobotArm (reach starts only after the car has arrived), so the two never
// disagree about when a docked car is actually at its station.
export { SNAP_TRANSITION_MS };

export const COLORS = {
  // Sealed concrete/epoxy floor — real body-shop floors are a mid-dark grey
  // with a bit of sheen (see envMapIntensity in Floor.tsx), not pale like a
  // studio cyc. Darkening this is what actually separates "floor" from
  // "wall" instead of both reading as the same flat pale mass.
  floor: '#75797f',
  // Subtle darker control-joint lines scored into the floor (Floor.tsx) —
  // the thing that reads a flat plane as poured/finished concrete instead
  // of a seamless studio cyc.
  floorJoint: '#54585d',
  // Bright upper wall — real plant walls above the wainscot are painted
  // light/white to bounce fixture light around the floor, so this wants to
  // be noticeably brighter than the floor for the two surfaces to read as
  // distinct planes (also the scene background color in Scene.tsx, so a
  // wall's edge blends into open background instead of showing a seam).
  backdrop: '#d7dbe0',
  // Lower wainscot band + baseboard/pilasters (Backdrop.tsx) — darker,
  // closer to the floor tone, the way a real protective wainscot/kickplate
  // band reads against a bright upper wall.
  backdropWainscot: '#585c62',
  // Bare-shell primer grey — every car starts here and the paint station
  // lerps it to the final palette colour as the sweep passes over (step 5).
  primer: '#9a9a9a',
  belt: '#3a3f46',
  frame: '#8b9197',
  orange: '#e8622c',
  spark: '#ffcf82',
  sparkCore: '#fff6e6',
  carGlass: '#1a1d22',
  carWheel: '#15171a',
  robotBase: '#33363b',
  robotArm: '#4a4e55',
  robotArmLight: '#6c7178',
  // Industrial set-dressing: overhead gantry, safety fencing, floor
  // markings, control cabinets (scene/FactoryStructure.tsx).
  safetyYellow: '#f5c400',
  steel: '#8b9197',
  steelDark: '#565a60',
  healthy: '#2fb574',
  warning: '#e8a82c',
  critical: '#d4453c',
};

export const STATUS_COLOR: Record<'healthy' | 'warning' | 'critical', string> = {
  healthy: COLORS.healthy,
  warning: COLORS.warning,
  critical: COLORS.critical,
};


