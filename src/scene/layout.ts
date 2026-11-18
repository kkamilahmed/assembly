// Where everything in the plant is. World units are metres-ish, scaled for
// an illustration rather than a survey: loaves are a little large so they
// read from the back of a room.
//
// Orientation. The camera looks from the (+x, +y, +z) octant, so:
//   - the walls are on the -x side (screen upper-left) and the -z side
//     (screen upper-right),
//   - +x +z is toward the viewer (screen bottom),
//   - +x -z is screen right.
// The dark slab is the factory floor. The white floor around it is the
// outside yard: pallets, forklift and trucks sit there.
import * as THREE from 'three';

export const SLAB = { minX: -12, maxX: 8, minZ: -8, maxZ: 8, thickness: 0.6 } as const;
export const WALL = { height: 6.2, thickness: 0.35 } as const;

/** Height of the conveyor belt surface. */
export const BELT_Y = 0.85;
export const BELT_WIDTH = 0.9;

/** The line's centreline, in order. Straight runs with rounded corners. */
const LINE_POINTS: Array<[number, number]> = [
  [-9, 6.2], // dough divider, under the mixer
  [-9, -5], // turn toward the oven
  [3, -5], // oven exit, turn toward inspection
  [3, 5], // turn toward the packer
  [6.4, 5], // into the packer
];
const CORNER_RADIUS = 1.6;

function buildPath(): THREE.CurvePath<THREE.Vector3> {
  const pts = LINE_POINTS.map(([x, z]) => new THREE.Vector3(x, BELT_Y, z));
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const corner = pts[i];
    const next = pts[i + 1];
    if (!next) {
      path.add(new THREE.LineCurve3(cursor, corner.clone()));
      break;
    }
    const inDir = corner.clone().sub(pts[i - 1]).normalize();
    const outDir = next.clone().sub(corner).normalize();
    const enter = corner.clone().addScaledVector(inDir, -CORNER_RADIUS);
    const exit = corner.clone().addScaledVector(outDir, CORNER_RADIUS);
    path.add(new THREE.LineCurve3(cursor, enter));
    path.add(new THREE.QuadraticBezierCurve3(enter, corner.clone(), exit));
    cursor = exit;
  }
  return path;
}

export const LINE_PATH = buildPath();
export const LINE_LENGTH = LINE_PATH.getLength();

/** Arc length along the line of the point nearest to (x, z). */
function sAt(x: number, z: number): number {
  const target = new THREE.Vector3(x, BELT_Y, z);
  let best = 0;
  let bestD = Infinity;
  const steps = 2000;
  const p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    LINE_PATH.getPointAt(i / steps, p);
    const d = p.distanceToSquared(target);
    if (d < bestD) {
      bestD = d;
      best = (i / steps) * LINE_LENGTH;
    }
  }
  return best;
}

/** Machine positions. Each machine sits over the line at its own point. */
export const MACHINE_POS = {
  mixer: new THREE.Vector3(-9, 0, 6.6),
  ovenStart: new THREE.Vector3(-6.2, 0, -5),
  ovenEnd: new THREE.Vector3(0.6, 0, -5),
  vision: new THREE.Vector3(3, 0, -1.4),
  rejectGate: new THREE.Vector3(3, 0, 0.9),
  rejectBin: new THREE.Vector3(4.7, 0, 0.9),
  packer: new THREE.Vector3(6.9, 0, 5),
} as const;

/** Where along the line (arc length, m) each thing happens. */
export const STATION_S = {
  ovenIn: sAt(MACHINE_POS.ovenStart.x, MACHINE_POS.ovenStart.z),
  ovenOut: sAt(MACHINE_POS.ovenEnd.x, MACHINE_POS.ovenEnd.z),
  inspect: sAt(MACHINE_POS.vision.x, MACHINE_POS.vision.z),
  reject: sAt(MACHINE_POS.rejectGate.x, MACHINE_POS.rejectGate.z),
  pack: LINE_LENGTH - 0.6,
} as const;

/** The outside yard, on the white floor past the slab's +x edge. */
export const YARD = {
  /** Pallet the packer's boxes are stacked onto, just off the slab. */
  outfeedPallet: new THREE.Vector3(9.6, 0, 5),
  trucks: [new THREE.Vector3(14.5, 0, 6.5), new THREE.Vector3(15.5, 0, 1.2)],
  forklift: new THREE.Vector3(11.5, 0, -1.5),
  racks: new THREE.Vector3(12, 0, -6),
} as const;

/** Framings, matched to the cook shot list (cook/SHOTS.md). S01 is the
 *  presenter's default view: the whole plant. */
export const SHOTS = {
  // Hero: the whole plant, the yard allowed to bleed off the right and
  // bottom edges the way the references let trucks and pallets run out of
  // frame.
  S01: { target: [1.6, 0.9, 1.4] as [number, number, number], zoom: 38 },
  // The room on its own, complete, like R02's cutaway store.
  S02: { target: [-2.2, 1.2, -0.4] as [number, number, number], zoom: 44 },
} as const;
export type ShotId = keyof typeof SHOTS;

/** The isometric view direction: from the (+x, +y, +z) octant, true iso. */
export const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
