// Where everything in the city block is. World units are metres-ish, scaled
// for an illustration rather than a survey: packets are a little large so
// they read from the back of a room.
//
// Orientation. The camera looks from the (+x, +y, +z) octant, so:
//   - the backdrop walls are on the -x side (screen upper-left) and the -z
//     side (screen upper-right),
//   - +x +z is toward the viewer (screen bottom),
//   - +x -z is screen right.
// The dark slab is the city block. The white floor around it is the street
// beyond: parked vans and passers-by stand there.
//
// The block, back to front: the processing hub and the bank vault against
// the back wall, the avenue the payment lanes run along, and the row of
// sources (cafe, cash machine, mall, TechDealz's warehouse) facing the
// viewer. Every building is a cutaway: tall walls only on its back sides,
// so nothing hides what goes on inside.
import * as THREE from 'three';
import type { SourceId } from '@/streaming/networkConfig';

export const SLAB = { minX: -12, maxX: 8, minZ: -8, maxZ: 8, thickness: 0.6 } as const;
export const WALL = { height: 6.2, thickness: 0.35 } as const;

/** Top of a lane's rail, and the height packets glide at. */
export const RAIL_TOP = 0.13;
export const RAIL_WIDTH = 0.44;
export const PACKET_Y = RAIL_TOP + 0.17;

/** The avenue the lanes run along, and the pavements either side. */
export const AVENUE = { z0: -0.6, z1: 1.3 } as const;
export const PAVEMENT_NORTH = { z0: -1.4, z1: -0.6 } as const;

/** Where the lanes cross the hub's scanner arch. */
export const SCAN_Z = -2.1;
/** A blocked packet leaves its lane here, just past the scanner. */
const KICK_Z = -2.45;
/** Lanes end inside the vault's east wall. */
const VAULT_INTAKE_X = -8.6;

/**
 * Every source's lane, as a polyline with rounded corners: out of the back
 * of its building, along the avenue, north through the scanner, then west
 * along the hub to the vault. The four never cross: the two from the west
 * and the two from the east run along the avenue on different sides of the
 * centre line, and they nest as they turn.
 */
const LANE_POINTS: Record<SourceId, Array<[number, number]>> = {
  'CAFE-01': [[-9.4, 4.1], [-9.4, 0], [-4.6, 0], [-4.6, -2.9], [VAULT_INTAKE_X, -2.9]],
  'ATM-07': [[-5.9, 4.35], [-5.9, 0.65], [-3.95, 0.65], [-3.95, -3.55], [VAULT_INTAKE_X, -3.55]],
  'MALL-03': [[-0.8, 4.1], [-0.8, 0.65], [-3.3, 0.65], [-3.3, -4.2], [VAULT_INTAKE_X, -4.2]],
  'TDZ-WEB': [[4.6, 4.1], [4.6, 0], [-2.65, 0], [-2.65, -4.85], [VAULT_INTAKE_X, -4.85]],
};
const CORNER_RADIUS = 0.45;

/** x of each lane where it runs north through the scanner. */
export const LANE_X: Record<SourceId, number> = {
  'CAFE-01': -4.6,
  'ATM-07': -3.95,
  'MALL-03': -3.3,
  'TDZ-WEB': -2.65,
};

function buildPath(points: Array<[number, number]>): THREE.CurvePath<THREE.Vector3> {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, PACKET_Y, z));
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

export interface Lane {
  path: THREE.CurvePath<THREE.Vector3>;
  length: number;
}

export const LANES = Object.fromEntries(
  Object.entries(LANE_POINTS).map(([id, pts]) => {
    const path = buildPath(pts);
    return [id, { path, length: path.getLength() }];
  }),
) as Record<SourceId, Lane>;

/** Arc length along a lane of the point nearest to (x, z). */
function sAt(lane: Lane, x: number, z: number): number {
  const target = new THREE.Vector3(x, PACKET_Y, z);
  let best = 0;
  let bestD = Infinity;
  const steps = 3000;
  const p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    lane.path.getPointAt(i / steps, p);
    const d = p.distanceToSquared(target);
    if (d < bestD) {
      bestD = d;
      best = (i / steps) * lane.length;
    }
  }
  return best;
}

/** Where along each lane (arc length) the stream acts on its payments. */
export const LANE_STATIONS = Object.fromEntries(
  (Object.keys(LANES) as SourceId[]).map((id) => {
    const lane = LANES[id];
    return [id, { scan: sAt(lane, LANE_X[id], SCAN_Z), kick: sAt(lane, LANE_X[id], KICK_Z), settle: lane.length - 0.3 }];
  }),
) as Record<SourceId, { scan: number; kick: number; settle: number }>;

/** Building footprints on the slab: x0..x1, z0..z1. */
export const HUB = { x0: -7.0, x1: 0.5, z0: -7.5, z1: -1.4 } as const;
export const VAULT = { x0: -11.45, x1: -8.2, z0: -7.45, z1: -1.8 } as const;
export const PLAZA = { x0: 1.1, x1: 7.6, z0: -7.4, z1: -1.4 } as const;
/** The row of sources. Their back walls are kept low enough (SOURCE_WALL)
 *  and far enough from the avenue that they never hide a lane. */
export const SOURCE_ROW = { z0: 3.6, z1: 7.3 } as const;
export const SOURCE_WALL = 2.2;
export const CAFE = { x0: -11.45, x1: -7.0, ...SOURCE_ROW } as const;
export const ATM = { x: -5.9, z: 4.75 } as const;
export const MALL = { x0: -4.7, x1: 1.4, ...SOURCE_ROW } as const;
export const WAREHOUSE = { x0: 2.0, x1: 7.6, ...SOURCE_ROW } as const;

/** The hub's scanner arch: posts either side of the four lanes, a beam
 *  over them. */
export const SCANNER = {
  x0: LANE_X['CAFE-01'] - 0.45,
  x1: LANE_X['TDZ-WEB'] + 0.45,
  z: SCAN_Z,
  beamY: 1.25,
} as const;

/** TechDealz's billboard over its back wall; Live hangs its warning light
 *  under the lower edge. */
export const TDZ_BILLBOARD = { x: 4.85, y: 3.0, z: WAREHOUSE.z0 + 0.12, w: 3.6, h: 1.0 } as const;

/** The hub's quarantine tray, where blocked packets land. */
export const QUARANTINE = new THREE.Vector3(-6.05, 0, -2.25);

/** Framings, matched to the cook shot list. S01 is the presenter's default
 *  view: the whole block. */
export const SHOTS = {
  // Hero: the whole block, the street allowed to bleed off the right and
  // bottom edges the way the references let trucks run out of frame.
  S01: { target: [-1.2, 1.4, 1.2] as [number, number, number], zoom: 45 },
  // The hub on its own: analysts, scanner and quarantine.
  S02: { target: [-3.6, 0.8, -3.6] as [number, number, number], zoom: 82 },
} as const;
export type ShotId = keyof typeof SHOTS;

/** The isometric view direction: from the (+x, +y, +z) octant, true iso. */
export const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
