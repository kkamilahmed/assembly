// The payment lanes: one low rail per source, out of the back of its
// building, along the avenue, through the hub and into the vault. Each is a
// rounded profile swept along the lane's centreline, with a lit groove down
// the middle that the packets glide over.
import { useMemo } from 'react';
import * as THREE from 'three';
import { SOURCE_IDS } from '@/streaming/networkConfig';
import { LANES, RAIL_TOP, RAIL_WIDTH, type Lane } from '../layout';
import { glow, matte, PALETTE, plastic } from '../style';

interface Frame {
  p: THREE.Vector3;
  side: THREE.Vector3;
  s: number;
}

function frames(lane: Lane, step = 0.08): Frame[] {
  const n = Math.max(2, Math.ceil(lane.length / step));
  const out: Frame[] = [];
  const t = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = lane.path.getPointAt(u);
    lane.path.getTangentAt(u, t);
    t.setY(0).normalize();
    out.push({ p, side: new THREE.Vector3(-t.z, 0, t.x), s: u * lane.length });
  }
  return out;
}

/** Sweeps an open cross-section ([side offset, y] pairs, left to right seen
 *  along the direction of travel) along a lane, with flat end caps. */
function sweep(fs: Frame[], profile: Array<[number, number]>): THREE.BufferGeometry {
  const m = profile.length;
  const pos: number[] = [];
  for (const f of fs) {
    for (const [o, y] of profile) pos.push(f.p.x + f.side.x * o, y, f.p.z + f.side.z * o);
  }
  const idx: number[] = [];
  for (let i = 0; i < fs.length - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = (i + 1) * m + j;
      // Wound so the faces point out of the profile's top.
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  // End caps: a fan across the profile at each end.
  const cap = (i: number, flip: boolean) => {
    const base = i * m;
    for (let j = 1; j < m - 1; j++) {
      if (flip) idx.push(base, base + j + 1, base + j);
      else idx.push(base, base + j, base + j + 1);
    }
  };
  cap(0, false);
  cap(fs.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** Rounded-shoulder rail cross-section, RAIL_WIDTH across, RAIL_TOP high,
 *  with a shallow channel down the middle. */
function railProfile(): Array<[number, number]> {
  const hw = RAIL_WIDTH / 2;
  const r = 0.05;
  const out: Array<[number, number]> = [[-hw, 0]];
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI - (i / 4) * (Math.PI / 2);
    out.push([-hw + r + Math.cos(a) * r, RAIL_TOP - r + Math.sin(a) * r]);
  }
  out.push([-0.08, RAIL_TOP], [-0.065, RAIL_TOP - 0.025], [0.065, RAIL_TOP - 0.025], [0.08, RAIL_TOP]);
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI / 2 - (i / 4) * (Math.PI / 2);
    out.push([hw - r + Math.cos(a) * r, RAIL_TOP - r + Math.sin(a) * r]);
  }
  out.push([hw, 0]);
  return out;
}

/** Every lane's rail. Static: the scene's batcher folds all four into a
 *  couple of draws. */
export function Rails() {
  const { body, groove } = useMemo(() => {
    const profile = railProfile();
    const bodies: THREE.BufferGeometry[] = [];
    const grooves: THREE.BufferGeometry[] = [];
    for (const id of SOURCE_IDS) {
      const fs = frames(LANES[id]);
      bodies.push(sweep(fs, profile));
      grooves.push(sweep(fs, [[-0.05, RAIL_TOP - 0.022], [0.05, RAIL_TOP - 0.022]]));
    }
    return { body: bodies, groove: grooves };
  }, []);
  return (
    <group>
      {body.map((g, i) => (
        <mesh key={`b${i}`} geometry={g} material={plastic(PALETTE.graphite, 0.38)} castShadow receiveShadow />
      ))}
      {groove.map((g, i) => (
        <mesh key={`g${i}`} geometry={g} material={glow('#5aa8ff', 1.1)} />
      ))}
      {/* A light kerb either side of the groove, so the rail reads as a
          track and not a pipe. */}
      {body.map((_, i) => (
        <mesh key={`k${i}`} geometry={kerbGeometry(i)} material={matte(PALETTE.paving, 0.5)} receiveShadow />
      ))}
    </group>
  );
}

const kerbCache = new Map<number, THREE.BufferGeometry>();
function kerbGeometry(i: number): THREE.BufferGeometry {
  let g = kerbCache.get(i);
  if (!g) {
    const fs = frames(LANES[SOURCE_IDS[i]]);
    const hw = RAIL_WIDTH / 2;
    const parts = [-1, 1].map((s) =>
      sweep(fs, [
        [s * (hw - 0.07) - 0.02, RAIL_TOP + 0.002],
        [s * (hw - 0.07) + 0.02, RAIL_TOP + 0.002],
      ]),
    );
    const pos = [...parts[0].attributes.position.array, ...parts[1].attributes.position.array];
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    kerbCache.set(i, g);
  }
  return g;
}
