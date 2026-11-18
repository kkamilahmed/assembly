import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

/** The bin turns about a horizontal axis along z at this height. */
const AXIS_Y = 1.5;
/** Pillars stand this far either side of the bin. */
export const BLENDER_PILLAR_Z = 0.98;
const PILLAR_Z = BLENDER_PILLAR_Z;
export const BLENDER_PILLAR_TOP = 2.42;
/** Top of the receiver on the +z pillar, where the press's transfer line
 *  lands. */
export const BLENDER_RECEIVER_TOP = BLENDER_PILLAR_TOP + 0.37;
/** Square bin body, and the depth of its tapered outlet. */
const BIN = 0.82;
const BIN_H = 0.7;
const CONE_H = 0.45;

/**
 * IBC bin blender. Local frame: origin on the floor under the turning axis,
 * which runs along z between two pillars at z = +/-0.98. The bin hangs
 * between them and tumbles end over end while blending; the receiver for
 * the press's transfer line sits on top of the +z pillar. The control panel
 * stands on +x. A rail on the floor marks the swing zone.
 *
 * `running` tumbles the bin. `severity` drives the stack light.
 */
export function PowderBlender({
  running = true,
  severity = 'healthy',
  ...props
}: { running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const brandDeep = plastic(PALETTE.brandDeep);
    const amber = plastic(PALETTE.amber);

    for (const sz of [1, -1]) {
      const z = sz * PILLAR_Z;
      k.box(dark, [0.62, 0.06, 0.4], [0, 0.03, z], 0.02);
      // Pillar: drive housing on a plinth, in the brand blue so the two
      // uprights frame the tumbling steel bin and read at the plant's zoom.
      k.box(brandDeep, [0.56, BLENDER_PILLAR_TOP - 0.06, 0.32], [0, BLENDER_PILLAR_TOP / 2 + 0.03, z], 0.06);
      k.box(white, [0.566, 0.05, 0.326], [0, BLENDER_PILLAR_TOP - 0.2, z], 0.018);
      for (let j = 0; j < 4; j++) k.box(dark, [0.012, 0.02, 0.2], [0.285, 0.5 + j * 0.05, z], 0.005);
      // Bearing and the drive shaft stub into the bin cradle.
      k.cyl(bright, 0.13, 0.08, [0, AXIS_Y, z - sz * 0.19], 'z', 0.02, 0.13, 20);
      k.cyl(steel, 0.06, 0.14, [0, AXIS_Y, z - sz * 0.26], 'z', 0.01, 0.06, 14);
    }
    // Receiver on the +z pillar: a small cyclone with its filter housing.
    const rz = PILLAR_Z;
    k.cyl(steel, 0.06, 0.12, [0, BLENDER_PILLAR_TOP + 0.06, rz], 'y', 0.01, 0.12, 16);
    k.cyl(bright, 0.14, 0.22, [0, BLENDER_PILLAR_TOP + 0.23, rz], 'y', 0.02, 0.14, 20);
    k.cyl(bright, 0.15, 0.03, [0, BLENDER_PILLAR_TOP + 0.355, rz], 'y', 0.01, 0.15, 20);

    // Swing-zone rail on short posts, open on the -x side for loading.
    const rx = 0.95;
    const rz2 = PILLAR_Z - 0.25;
    for (const sz of [1, -1]) {
      k.tube(amber, [[-rx + 0.35, 0.62, sz * rz2], [rx, 0.62, sz * rz2], [rx, 0.62, 0]], 0.02, 0.1);
      for (const x of [-rx + 0.35, 0.3, rx]) k.cyl(amber, 0.022, 0.62, [x, 0.31, sz * rz2], 'y', 0.006, 0.022, 10);
      k.cyl(dark, 0.05, 0.02, [rx, 0.01, sz * rz2], 'y', 0.006, 0.05, 12);
    }
    for (const z of [0.3, -0.3]) k.cyl(amber, 0.022, 0.62, [rx, 0.31, z], 'y', 0.006, 0.022, 10);

    // Panel stand.
    k.box(steel, [0.08, 1.15, 0.08], [rx + 0.38, 0.6, -0.45], 0.02);
    k.box(steel, [0.28, 0.03, 0.28], [rx + 0.38, 0.015, -0.45], 0.01);
    return k.build();
  }, []);
  useDispose(pieces);

  // The tumbling part: the cradle arms and the bin with its lid and valve.
  const bin = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.16);
    const dark = plastic(PALETTE.graphite);
    const brand = plastic(PALETTE.brand);
    // Cradle: a yoke from each shaft to the bin's sides.
    for (const sz of [1, -1]) {
      k.box(steel, [0.14, 0.14, 0.2], [0, 0, sz * (BIN / 2 + 0.12)], 0.03);
      k.box(steel, [BIN + 0.1, 0.08, 0.06], [0, 0, sz * (BIN / 2 + 0.05)], 0.02);
    }
    // Bin: square body, a tapered outlet below and the lid above, offset so
    // the bin's centre of mass is off the axis and it visibly tumbles.
    const yb = 0.12;
    k.box(bright, [BIN, BIN_H, BIN], [0, yb, 0], 0.07);
    const cone = new THREE.CylinderGeometry(BIN * 0.7, 0.13, CONE_H, 4, 1);
    cone.rotateY(Math.PI / 4);
    k.add(bright, cone, [0, yb - BIN_H / 2 - CONE_H / 2 + 0.01, 0]);
    k.cyl(steel, 0.13, 0.1, [0, yb - BIN_H / 2 - CONE_H - 0.03, 0], 'y', 0.02, 0.13, 18);
    k.cyl(dark, 0.03, 0.22, [0.14, yb - BIN_H / 2 - CONE_H - 0.03, 0], 'x', 0.008, 0.03, 10);
    k.box(steel, [BIN + 0.03, 0.05, BIN + 0.03], [0, yb + BIN_H / 2 + 0.02, 0], 0.02);
    k.cyl(steel, 0.2, 0.06, [0, yb + BIN_H / 2 + 0.07, 0], 'y', 0.015, 0.2, 24);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      k.box(dark, [0.05, 0.05, 0.07], [Math.cos(a) * 0.2, yb + BIN_H / 2 + 0.07, Math.sin(a) * 0.2], 0.015);
    }
    // Stiffening ribs and a brand label on the two faces the camera sees.
    for (const y of [yb - 0.18, yb + 0.18]) k.box(steel, [BIN + 0.025, 0.03, BIN + 0.025], [0, y, 0], 0.01);
    k.box(brand, [0.36, 0.14, 0.012], [0, yb, BIN / 2 + 0.014], 0.01);
    k.box(brand, [0.012, 0.14, 0.36], [BIN / 2 + 0.014, yb, 0], 0.01);
    return k.build();
  }, []);
  useDispose(bin);

  const binRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (running && binRef.current) binRef.current.rotation.z -= Math.min(dt, 0.1) * 0.9;
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={binRef} position-y={AXIS_Y}>
        <Pieces pieces={bin} />
      </group>
      <ControlBox kind="hmi" accent={PALETTE.brand} position={[1.33, 1.42, -0.45]} rotation={[0, Math.PI / 2, 0]} />
      <Andon severity={severity} position={[0.12, BLENDER_PILLAR_TOP, -PILLAR_Z]} />
    </group>
  );
}
