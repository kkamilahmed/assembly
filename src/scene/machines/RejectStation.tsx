import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, metal, PALETTE, plastic } from '../style';
import { tabletMaterial, trayGeometry, trayTabletsGeometry } from '../props/tablet';
import { Kit, rejectLabelMaterial, useDispose } from './kit';
import { Pieces } from './Pieces';

const STROKE = 0.9;
const KICK_MS = 400;
const MAX_TRAYS = 12;
const BIN_W = 0.95;
const BIN_D = 0.9;
const BIN_TOP = 0.66;
/** Raised floor of the bin, so even one tray is visible from above. */
const BIN_FLOOR = 0.36;

/** Out fast, short dwell, back slower. 0 at rest, 1 at full stroke. */
function kickProfile(t: number): number {
  if (t < 0.3) return 1 - Math.pow(1 - t / 0.3, 3);
  if (t < 0.4) return 1;
  const r = (t - 0.4) / 0.6;
  return 1 - r * r * (3 - 2 * r);
}

/** Where each diverted tray lands: [x, y, z offset from the bin centre, yaw, tilt].
 *  Four to a layer, slewed a little, as trays slid in from the gate. */
const PILE: Array<[number, number, number, number, number]> = [
  [-0.19, 0.0, 0.17, 0.08, 0.02],
  [0.19, 0.0, 0.18, -0.06, -0.02],
  [-0.2, 0.0, -0.17, -0.1, 0.03],
  [0.18, 0.0, -0.18, 0.12, -0.02],
  [0.0, 0.06, 0.02, 0.5, 0.06],
  [-0.17, 0.11, 0.16, -0.3, -0.05],
  [0.2, 0.11, -0.12, 0.25, 0.07],
  [-0.15, 0.16, -0.18, 1.3, 0.04],
  [0.17, 0.17, 0.18, 1.5, -0.06],
  [0.02, 0.22, -0.02, -0.7, 0.08],
  [-0.16, 0.27, 0.12, 0.9, -0.05],
  [0.15, 0.28, -0.16, -1.2, 0.06],
];

/**
 * Reject station: a pneumatic pusher that diverts a flagged tray off the
 * belt, down a chute and into the red reject bin. Local frame: origin on the floor under the belt
 * centreline at the kick point, belt along +x at BELT_Y. The pusher stands
 * on +z and pushes toward -z; the bin is centred `binOffset` away on -z.
 * At the layout position use rotation y = -PI / 2, which puts the bin at
 * MACHINE_POS.rejectBin.
 *
 * `kickAt` is any value that changes per reject (a timestamp); each change
 * plays one 400 ms push. `binCount` trays are shown in the bin, up to 12.
 */
export function RejectStation({
  kickAt = null,
  binCount = 0,
  binOffset = 1.7,
  ...props
}: { kickAt?: number | null; binCount?: number; binOffset?: number } & ThreeElements['group']) {
  const binZ = -binOffset;

  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const blue = plastic(PALETTE.blue);
    const red = plastic(PALETTE.critical);
    const rubber = matte(PALETTE.rubber);

    // Pusher stand and the air cylinder.
    k.box(steel, [0.4, 0.035, 0.5], [0, 0.0175, 1.15], 0.012);
    for (const a of [1, -1]) for (const b of [1, -1]) k.bolt(bright, [a * 0.15, 0.04, 1.15 + b * 0.2], 'y');
    k.box(steel, [0.16, 0.82, 0.16], [0, 0.44, 1.15], 0.035);
    k.box(steel, [0.26, 0.11, 0.26], [0, 0.09, 1.15], 0.03);
    k.box(steel, [0.3, 0.05, 1.06], [0, 0.875, 1.14], 0.016);
    k.cyl(steel, 0.085, 0.9, [0, 1.0, 1.14], 'z', 0.014, 0.085, 24);
    for (const z of [0.68, 1.6]) {
      k.box(blue, [0.22, 0.22, 0.08], [0, 1.0, z], 0.03);
      k.cyl(bright, 0.02, 0.03, [0.06, 1.115, z], 'y', 0.005, 0.02, 8);
    }
    // Tie rods along the barrel.
    for (const a of [1, -1]) for (const b of [1, -1]) k.cyl(bright, 0.01, 0.94, [a * 0.085, 1.0 + b * 0.085, 1.14], 'z', 0.003, 0.01, 6);
    // Valve block on the column, with its two air lines.
    k.box(dark, [0.07, 0.14, 0.15], [0.115, 0.66, 1.15], 0.018);
    k.box(blue, [0.075, 0.035, 0.155], [0.115, 0.735, 1.15], 0.012);
    k.tube(blue, [[0.11, 0.74, 1.1], [0.11, 1.22, 1.1], [0.06, 1.22, 0.68], [0.06, 1.12, 0.68]], 0.013, 0.05);
    k.tube(blue, [[0.11, 0.74, 1.2], [0.11, 1.27, 1.2], [0.06, 1.27, 1.6], [0.06, 1.12, 1.6]], 0.013, 0.05);
    // Photo-eye that confirms the tray left the belt.
    k.box(steel, [0.03, 0.26, 0.03], [0.36, 0.93, 0.62], 0.01);
    k.box(blue, [0.07, 0.08, 0.07], [0.36, 1.06, 0.6], 0.018);

    // Chute off the far edge of the belt down to the bin.
    const tilt = -0.18;
    k.box(steel, [0.64, 0.022, 0.82], [0, 0.775, -0.95], 0.008, [tilt, 0, 0]);
    for (const sx of [1, -1]) {
      k.box(steel, [0.022, 0.1, 0.82], [sx * 0.32, 0.815, -0.95], 0.008, [tilt, 0, 0]);
      k.box(steel, [0.045, 0.72, 0.045], [sx * 0.25, 0.37, -0.98], 0.012);
      k.cyl(dark, 0.05, 0.03, [sx * 0.25, 0.015, -0.98], 'y', 0.01, 0.05, 12);
    }
    k.box(steel, [0.5, 0.04, 0.04], [0, 0.3, -0.98], 0.012);

    // Bin: tub on casters, thick rim, raised floor.
    const wallH = BIN_TOP - 0.12;
    const wallY = 0.12 + wallH / 2;
    for (const sx of [1, -1]) k.box(red, [0.05, wallH, BIN_D], [sx * (BIN_W / 2 - 0.025), wallY, binZ], 0.022);
    for (const sz of [1, -1]) k.box(red, [BIN_W, wallH, 0.05], [0, wallY, binZ + sz * (BIN_D / 2 - 0.025)], 0.022);
    k.box(red, [BIN_W - 0.06, 0.05, BIN_D - 0.06], [0, BIN_FLOOR - 0.025, binZ], 0.01);
    k.box(red, [BIN_W - 0.02, 0.06, BIN_D - 0.02], [0, 0.15, binZ], 0.02);
    for (const sx of [1, -1]) k.box(red, [0.085, 0.06, BIN_D + 0.05], [sx * (BIN_W / 2 - 0.02), BIN_TOP - 0.02, binZ], 0.026);
    for (const sz of [1, -1]) k.box(red, [BIN_W + 0.05, 0.06, 0.085], [0, BIN_TOP - 0.02, binZ + sz * (BIN_D / 2 - 0.02)], 0.026);
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        k.box(steel, [0.07, 0.035, 0.09], [sx * 0.36, 0.105, binZ + sz * 0.33], 0.01);
        k.cyl(rubber, 0.052, 0.04, [sx * 0.36, 0.052, binZ + sz * 0.33], 'x', 0.012, 0.052, 14);
      }
    }
    // Push handle on the end away from the chute.
    k.tube(steel, [[-0.3, BIN_TOP - 0.06, binZ - BIN_D / 2], [-0.3, BIN_TOP - 0.06, binZ - BIN_D / 2 - 0.1], [0.3, BIN_TOP - 0.06, binZ - BIN_D / 2 - 0.1], [0.3, BIN_TOP - 0.06, binZ - BIN_D / 2]], 0.016, 0.05);
    return k.build();
  }, [binZ]);
  useDispose(pieces);

  // The moving part: rod and paddle, at rest against the belt edge.
  const pusher = useMemo(() => {
    const k = new Kit();
    const bright = metal(PALETTE.offWhite, 0.18);
    k.cyl(bright, 0.026, 0.98, [0, 1.0, 1.06], 'z', 0.005, 0.026, 10);
    k.cyl(bright, 0.055, 0.05, [0, 1.0, 0.6], 'z', 0.012, 0.055, 12);
    k.box(plastic(PALETTE.brand), [0.62, 0.2, 0.06], [0, 0.995, 0.55], 0.022);
    k.box(plastic(PALETTE.white), [0.57, 0.15, 0.016], [0, 0.995, 0.515], 0.006);
    return k.build();
  }, []);
  useDispose(pusher);

  const trayGeo = useMemo(() => trayGeometry(), []);
  const tabletsGeo = useMemo(() => trayTabletsGeometry(), []);

  const traysRef = useRef<THREE.InstancedMesh>(null);
  const tabletsRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (const mesh of [traysRef.current, tabletsRef.current]) {
      if (!mesh) continue;
      PILE.forEach(([x, y, z, yaw, tilt], i) => {
        // Diverted tablets are underweight: drawn thin, as on the belt.
        s.set(1, mesh === tabletsRef.current ? 0.6 : 1, 1);
        m.compose(p.set(x, BIN_FLOOR + y, binZ + z), q.setFromEuler(e.set(tilt, yaw, tilt * 0.5)), s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [binZ]);
  useLayoutEffect(() => {
    const n = THREE.MathUtils.clamp(Math.round(binCount), 0, MAX_TRAYS);
    if (traysRef.current) traysRef.current.count = n;
    if (tabletsRef.current) tabletsRef.current.count = n;
  }, [binCount]);

  const pusherRef = useRef<THREE.Group>(null);
  const kickStart = useRef<number | null>(null);
  const lastKick = useRef(kickAt);
  useEffect(() => {
    if (kickAt != null && kickAt !== lastKick.current) kickStart.current = performance.now();
    lastKick.current = kickAt;
  }, [kickAt]);
  useFrame(() => {
    const group = pusherRef.current;
    if (!group || kickStart.current == null) return;
    const t = (performance.now() - kickStart.current) / KICK_MS;
    if (t >= 1) {
      kickStart.current = null;
      group.position.z = 0;
    } else {
      group.position.z = -STROKE * kickProfile(t);
    }
  });

  const label = rejectLabelMaterial();
  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={pusherRef}>
        <Pieces pieces={pusher} />
      </group>
      <instancedMesh ref={traysRef} args={[trayGeo, plastic(PALETTE.critical, 0.4), MAX_TRAYS]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={tabletsRef} args={[tabletsGeo, tabletMaterial(), MAX_TRAYS]} receiveShadow frustumCulled={false} />
      {/* Hazard labels on the two faces the camera sees at the layout position. */}
      <mesh material={label} position={[0, 0.38, binZ - BIN_D / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.66, 0.25]} />
      </mesh>
      <mesh material={label} position={[BIN_W / 2 + 0.002, 0.38, binZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.66, 0.25]} />
      </mesh>
    </group>
  );
}
