import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { BELT_WIDTH, BELT_Y, LINE_LENGTH, LINE_PATH, STATION_S } from '../layout';
import { matte, metal, PALETTE, plastic } from '../style';
import { beltMaterial, beltTexture, Kit } from './kit';
import type { Piece } from './kit';
import { Pieces } from './Pieces';

/** Length of one belt slat along the line. */
const SLAT = 0.13;
const HALF = BELT_WIDTH / 2;
/** Centre of the side frames, measured from the centreline. */
const FRAME_OFF = HALF + 0.05;
const FRAME_BOTTOM = 0.56;
const FRAME_TOP = BELT_Y + 0.03;
const RAIL_Y = BELT_Y + 0.17;

interface Frame {
  s: number;
  p: THREE.Vector3;
  /** Direction of travel. */
  t: THREE.Vector3;
  /** Horizontal, to the right of travel seen from above with +z down the
   *  screen: for a belt running along +x this is +z. */
  side: THREE.Vector3;
}

function frameAt(s: number): Frame {
  const u = THREE.MathUtils.clamp(s / LINE_LENGTH, 0, 1);
  const e = 0.0005;
  const p = LINE_PATH.getPointAt(u);
  const a = LINE_PATH.getPointAt(Math.max(0, u - e));
  const b = LINE_PATH.getPointAt(Math.min(1, u + e));
  const t = b.sub(a).setY(0).normalize();
  return { s, p, t, side: new THREE.Vector3(-t.z, 0, t.x) };
}

function framesBetween(s0: number, s1: number, step = 0.08): Frame[] {
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const out: Frame[] = [];
  for (let i = 0; i <= n; i++) out.push(frameAt(s0 + ((s1 - s0) * i) / n));
  return out;
}

/** Sweeps a cross-section along the line. `profile` is [side offset, y]
 *  pairs, anticlockwise seen looking back along the direction of travel so
 *  the faces point outward. Closed profiles wrap around; open ones get a v
 *  coordinate across the profile, and u counts slats along the line. */
function sweep(frames: Frame[], profile: Array<[number, number]>, closed: boolean): THREE.BufferGeometry {
  const m = profile.length;
  const pos = new Float32Array(frames.length * m * 3);
  const uv = new Float32Array(frames.length * m * 2);
  let k = 0;
  let q = 0;
  for (const f of frames) {
    for (let j = 0; j < m; j++) {
      const [o, y] = profile[j];
      pos[k++] = f.p.x + f.side.x * o;
      pos[k++] = y;
      pos[k++] = f.p.z + f.side.z * o;
      uv[q++] = f.s / SLAT;
      uv[q++] = j / (m - 1);
    }
  }
  const idx: number[] = [];
  const cols = closed ? m : m - 1;
  for (let i = 0; i < frames.length - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * m + j;
      const b = (i + 1) * m + j;
      const c = (i + 1) * m + ((j + 1) % m);
      const d = i * m + ((j + 1) % m);
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Anticlockwise rounded rectangle centred on (cx, cy). */
function roundRect(cx: number, cy: number, w: number, h: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2],
    [cx - w / 2 + r, cy - h / 2 + r, Math.PI],
    [cx + w / 2 - r, cy - h / 2 + r, Math.PI * 1.5],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  }
  return out;
}

function circle(cx: number, cy: number, r: number, n = 8): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

type Range = [number, number];

/** Sub-ranges of [s0, s1] left after cutting `gaps` out. */
function cut(s0: number, s1: number, gaps: Range[]): Range[] {
  let out: Range[] = [[s0, s1]];
  for (const [g0, g1] of gaps) {
    out = out.flatMap(([a, b]): Range[] => {
      if (g1 <= a || g0 >= b) return [[a, b]];
      const parts: Range[] = [];
      if (g0 > a) parts.push([a, g0]);
      if (g1 < b) parts.push([g1, b]);
      return parts;
    });
  }
  return out.filter(([a, b]) => b - a > 0.3);
}

const inRanges = (s: number, ranges: Range[]) => ranges.some(([a, b]) => s > a && s < b);

/** Where the machines sit on the line. The guide rails and the legs leave
 *  these stretches free. */
const OVEN: Range = [STATION_S.ovenIn - 0.25, STATION_S.ovenOut + 0.25];
const DEFAULT_RAIL_GAPS: Range[] = [
  [0, 1.5],
  OVEN,
  [STATION_S.inspect - 0.45, STATION_S.inspect + 0.45],
  [STATION_S.reject - 0.6, STATION_S.reject + 0.6],
  [LINE_LENGTH - 1.3, LINE_LENGTH],
];
const DEFAULT_LEG_GAPS: Range[] = [OVEN, [LINE_LENGTH - 1.2, LINE_LENGTH]];
/** Gearmotors hung on the frame: [arc length, side]. Side +1 is the right
 *  of travel. Both sit on the camera-facing side of their run. */
const DEFAULT_DRIVES: Array<[number, 1 | -1]> = [
  [5.2, 1],
  [STATION_S.reject + 2.3, -1],
];

function placeAlong(mesh: THREE.InstancedMesh | null, frames: Frame[], flip?: Array<1 | -1>) {
  if (!mesh) return;
  const m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const t = new THREE.Vector3();
  frames.forEach((f, i) => {
    const sign = flip ? flip[i] : 1;
    // Local x is travel, local z is the side; flipping both keeps it a rotation.
    t.copy(f.t).multiplyScalar(sign);
    side.copy(f.side).multiplyScalar(sign);
    m.makeBasis(t, up, side).setPosition(f.p.x, 0, f.p.z);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = frames.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function buildPieces(make: (k: Kit) => void): Piece[] {
  const k = new Kit();
  make(k);
  return k.build();
}

/**
 * The whole line's conveyor, in world space: it follows LINE_PATH from end
 * to end, corners included. Belt top is at BELT_Y.
 *
 * `running` scrolls the slats at `speed` (world units per second).
 * `railGaps` and `legGaps` are arc-length ranges kept free of guide rails
 * and legs; the defaults clear the machines at their layout positions.
 */
export function Conveyor({
  running = true,
  speed = 0.6,
  railGaps = DEFAULT_RAIL_GAPS,
  legGaps = DEFAULT_LEG_GAPS,
  drives = DEFAULT_DRIVES,
  ...props
}: {
  running?: boolean;
  speed?: number;
  railGaps?: Range[];
  legGaps?: Range[];
  drives?: Array<[number, 1 | -1]>;
} & ThreeElements['group']) {
  const built = useMemo(() => {
    const steel = metal(PALETTE.steel);
    const dark = plastic(PALETTE.graphite);
    const all = framesBetween(0, LINE_LENGTH);
    const k = new Kit();

    // Belt: flat top with rolled-over edges.
    const y = BELT_Y;
    const belt = sweep(
      all,
      [
        [HALF, y - 0.05],
        [HALF, y - 0.008],
        [HALF - 0.008, y],
        [-HALF + 0.008, y],
        [-HALF, y - 0.008],
        [-HALF, y - 0.05],
      ],
      false,
    );

    // Side frames with a dark slot down the outer face, and low stretchers.
    for (const sgn of [1, -1]) {
      k.add(steel, sweep(all, roundRect(sgn * (FRAME_OFF + 0.01), (FRAME_BOTTOM + FRAME_TOP) / 2, 0.12, FRAME_TOP - FRAME_BOTTOM, 0.03), true));
      k.add(dark, sweep(all, roundRect(sgn * (FRAME_OFF + 0.068), 0.72, 0.012, 0.07, 0.005), true));
      k.add(steel, sweep(all, roundRect(sgn * 0.47, 0.26, 0.045, 0.06, 0.012), true));
    }
    // Under-belt pan, so nothing shows through from below.
    k.add(dark, sweep(all, roundRect(0, 0.66, BELT_WIDTH, 0.06, 0.01), true));

    // Guide rails on short posts, broken where machines need the belt edge.
    const posts: Frame[] = [];
    for (const [a, b] of cut(0, LINE_LENGTH, railGaps)) {
      const run = framesBetween(a, b);
      for (const sgn of [1, -1]) k.add(steel, sweep(run, circle(sgn * FRAME_OFF, RAIL_Y, 0.017), true));
      const n = Math.max(1, Math.round((b - a) / 0.9));
      for (let i = 0; i <= n; i++) posts.push(frameAt(a + ((b - a) * i) / n));
    }

    // End rollers and bearing plates.
    for (const s of [0, LINE_LENGTH]) {
      const f = frameAt(s);
      const yaw = Math.atan2(-f.t.z, f.t.x);
      k.add(dark, new THREE.CapsuleGeometry(0.048, BELT_WIDTH - 0.1, 4, 12), [f.p.x, BELT_Y - 0.05, f.p.z], [Math.PI / 2, 0, 0]);
      const end = new Kit();
      for (const sgn of [1, -1]) {
        end.box(steel, [0.2, 0.3, 0.035], [0, 0.74, sgn * (FRAME_OFF + 0.06)], 0.015);
        end.cyl(dark, 0.045, 0.03, [0, BELT_Y - 0.05, sgn * (FRAME_OFF + 0.085)], 'z', 0.01);
      }
      for (const piece of end.build()) k.add(piece.material, piece.geometry, [f.p.x, 0, f.p.z], [0, yaw, 0]);
    }

    // One pair of legs, instanced along the line. Local x is travel.
    const leg = buildPieces((b) => {
      for (const sgn of [1, -1]) {
        b.box(steel, [0.09, 0.56, 0.09], [0, 0.31, sgn * 0.48], 0.022);
        b.box(steel, [0.16, 0.05, 0.12], [0, 0.565, sgn * 0.49], 0.015);
        b.cyl(dark, 0.08, 0.035, [0, 0.0175, sgn * 0.48], 'y', 0.012);
      }
      b.box(steel, [0.045, 0.055, 0.9], [0, 0.4, 0], 0.014);
    });
    const post = buildPieces((b) => {
      for (const sgn of [1, -1]) {
        b.cyl(steel, 0.013, RAIL_Y - FRAME_TOP, [0, (RAIL_Y + FRAME_TOP) / 2, sgn * FRAME_OFF], 'y', 0.003, 0.013, 8);
        b.box(dark, [0.05, 0.045, 0.05], [0, RAIL_Y, sgn * FRAME_OFF], 0.012);
      }
    });
    const drive = buildPieces((b) => {
      const blue = plastic(PALETTE.blue);
      b.box(dark, [0.26, 0.24, 0.16], [0, 0.5, FRAME_OFF + 0.13], 0.035);
      b.cyl(blue, 0.105, 0.34, [0, 0.5, FRAME_OFF + 0.37], 'z', 0.025);
      b.cyl(dark, 0.115, 0.07, [0, 0.5, FRAME_OFF + 0.555], 'z', 0.02);
      b.box(blue, [0.12, 0.06, 0.12], [0, 0.63, FRAME_OFF + 0.36], 0.015);
      b.box(matte(PALETTE.rubber), [0.3, 0.02, 0.5], [0, 0.36, FRAME_OFF + 0.28], 0.008);
    });

    const legFrames: Frame[] = [];
    const count = Math.round(LINE_LENGTH / 1.35);
    for (let i = 0; i <= count; i++) {
      const s = 0.22 + ((LINE_LENGTH - 0.44) * i) / count;
      if (!inRanges(s, legGaps)) legFrames.push(frameAt(s));
    }
    return { belt, pieces: k.build(), leg, post, drive, legFrames, posts };
  }, [railGaps, legGaps]);

  useEffect(
    () => () => {
      built.belt.dispose();
      for (const p of [...built.pieces, ...built.leg, ...built.post, ...built.drive]) p.geometry.dispose();
    },
    [built],
  );

  const legRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const postRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const driveRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  useLayoutEffect(() => {
    for (const m of legRefs.current) placeAlong(m, built.legFrames);
    for (const m of postRefs.current) placeAlong(m, built.posts);
    const frames = drives.map(([s]) => frameAt(s));
    const flips = drives.map(([, side]) => side);
    for (const m of driveRefs.current) placeAlong(m, frames, flips);
  }, [built, drives]);

  useFrame((_, dt) => {
    if (!running) return;
    const offset = beltTexture().offset;
    offset.x = (offset.x - (speed * Math.min(dt, 0.1)) / SLAT + 1) % 1;
  });

  return (
    <group {...props}>
      <mesh geometry={built.belt} material={beltMaterial()} receiveShadow />
      <Pieces pieces={built.pieces} />
      {built.leg.map((p, i) => (
        <instancedMesh
          key={`leg${i}`}
          ref={(m) => {
            legRefs.current[i] = m;
          }}
          args={[p.geometry, p.material, built.legFrames.length]}
          castShadow
          receiveShadow
        />
      ))}
      {built.post.map((p, i) => (
        <instancedMesh
          key={`post${i}`}
          ref={(m) => {
            postRefs.current[i] = m;
          }}
          args={[p.geometry, p.material, built.posts.length]}
          castShadow
          receiveShadow
        />
      ))}
      {built.drive.map((p, i) => (
        <instancedMesh
          key={`drive${i}`}
          ref={(m) => {
            driveRefs.current[i] = m;
          }}
          args={[p.geometry, p.material, Math.max(1, drives.length)]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
