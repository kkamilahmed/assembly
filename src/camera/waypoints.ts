import * as THREE from 'three';
import { LINE_END_X, LINE_START_X, ROBOT_X } from '@/scene/constants';
import { PROBLEM_ROBOT_ID } from '@/streaming/lineConfig';

export interface ShotDef {
  id: number;
  duration: number; // seconds
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startLookAt: THREE.Vector3;
  endLookAt: THREE.Vector3;
}

// ---- Where the line actually is ----
// Everything worth looking at spans the spawn point through the rework
// siding. The old framing centred on (LINE_START_X + LINE_END_X)/2 and sat
// ~19m away, which is closer than this span needs: the line ran diagonally
// out of the top-left corner with most of the frame given over to empty
// floor, and you could never see all four stations at once. Both numbers
// below are derived from the geometry so they can't go stale if the station
// spacing or the siding position changes.
const SUBJECT_MIN_X = LINE_START_X;
// Framing to the rework siding (a few metres further on) meant a stretch of
// empty outbound conveyor took up the right-hand third of every shot. The
// span cars actually occupy is what wants to fill the frame; the siding is
// still comfortably inside the horizontal field of view at this distance.
const SUBJECT_MAX_X = LINE_END_X;
export const LINE_CENTER_X = (SUBJECT_MIN_X + SUBJECT_MAX_X) / 2;
const SUBJECT_SPAN = SUBJECT_MAX_X - SUBJECT_MIN_X;

/** Distance needed to fit SUBJECT_SPAN across the frame at the Canvas's
 *  42-degree vertical FOV and the ~1.35 aspect the line view actually
 *  renders at, plus a little breathing room at the ends. */
// Slightly under 1.0 on purpose: the outermost metre or two at each end is
// conveyor with no car on it, so cropping it buys real size on the part of
// the line that matters. At a 1.36 aspect, fitting a 30m line edge-to-edge
// leaves 22m of vertical frame for a subject about 4m tall - every metre of
// horizontal slack is paid for in empty floor and empty wall.
const SETTLE_DISTANCE = (SUBJECT_SPAN * 0.97) / 2 / Math.tan(THREE.MathUtils.degToRad(27.5));
// Shallow on purpose. At 27 degrees the camera looked down onto the aisle
// and the nearest few metres of bare floor took the bottom third of the
// frame. Lower means less ground plane in front of the line and more of the
// back wall behind it, which is the better trade: the wall is set dressing
// the line reads against, the empty foreground floor is nothing.
const SETTLE_ELEVATION = THREE.MathUtils.degToRad(16);
/** Swung slightly toward the exit end rather than dead-on square, so the
 *  line reads with some depth instead of as a flat elevation drawing. */
const SETTLE_AZIMUTH = THREE.MathUtils.degToRad(12);

// Aimed at roughly car-roof height rather than the floor, which lifts the
// whole line up out of the lower half of the frame.
export const SETTLE_LOOK_AT = new THREE.Vector3(LINE_CENTER_X, 1.5, 0);
export const SETTLE_POS = new THREE.Vector3(
  LINE_CENTER_X + SETTLE_DISTANCE * Math.cos(SETTLE_ELEVATION) * Math.sin(SETTLE_AZIMUTH),
  SETTLE_DISTANCE * Math.sin(SETTLE_ELEVATION),
  SETTLE_DISTANCE * Math.cos(SETTLE_ELEVATION) * Math.cos(SETTLE_AZIMUTH),
);
/** OrbitControls has to be able to reach the shot it was handed, with room
 *  to pull back further. Previously a hardcoded 40 that the new settle
 *  distance would have sat right up against. */
export const MAX_ORBIT_DISTANCE = SETTLE_DISTANCE * 1.6;

const problemX = ROBOT_X[PROBLEM_ROBOT_ID];

// A short scripted intro: a wide establishing pass down the line from the
// entry end, a push into the problem robot's station, then a pull back to
// the exact overview OrbitControls takes over at - so the hand-off is a
// continuation rather than a cut. Coords are metres (real-world scale).
export const SHOTS: ShotDef[] = [
  {
    id: 0,
    duration: 4,
    startPos: new THREE.Vector3(LINE_START_X - 6, 8, 17),
    endPos: new THREE.Vector3(LINE_CENTER_X - 7, 6, 14),
    startLookAt: new THREE.Vector3(LINE_START_X + 2, 1.2, 0),
    endLookAt: new THREE.Vector3(LINE_CENTER_X, 1.2, 0),
  },
  {
    id: 1,
    duration: 3.5,
    startPos: new THREE.Vector3(LINE_CENTER_X - 7, 6, 14),
    endPos: new THREE.Vector3(problemX + 3.5, 3.4, 8.5),
    startLookAt: new THREE.Vector3(LINE_CENTER_X, 1.2, 0),
    endLookAt: new THREE.Vector3(problemX, 1.5, -0.4),
  },
  {
    id: 2,
    duration: 3.5,
    startPos: new THREE.Vector3(problemX + 3.5, 3.4, 8.5),
    endPos: SETTLE_POS.clone(),
    startLookAt: new THREE.Vector3(problemX, 1.5, -0.4),
    endLookAt: SETTLE_LOOK_AT.clone(),
  },
];

export const TOTAL_CINEMATIC_DURATION = SHOTS.reduce((a, s) => a + s.duration, 0);
