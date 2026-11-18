import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { crustColor, glass, matte, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

const LEG_X = 0.62;
const LEG_Z = 0.74;
/** Height of the ring frame the vessel hangs in. */
const RING_Y = 1.72;
const RIM_Y = 2.26;
/** Top of the deck plate on the ring frame. */
const DECK_Y = RING_Y + 0.115;

/**
 * Dough mixer on a stand, feeding a divider that drops dough pieces onto
 * the start of the belt. Local frame: origin on the floor under the vessel,
 * belt leaving along +x at BELT_Y (the stand straddles it; the divider
 * nozzle is at x = 0.77). The operator panel is on the -x, +z corner and
 * faces -x. Place it at MACHINE_POS.mixer with rotation y = PI / 2.
 *
 * `running` turns the spiral. `severity` drives the stack light.
 */
export function DoughMixer({
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
    const orange = plastic(PALETTE.orange);
    const blue = plastic(PALETTE.blue);

    // Stand: four legs, a ring frame, low braces and the divider's cradle.
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        k.box(steel, [0.13, RING_Y, 0.13], [sx * LEG_X, RING_Y / 2 + 0.02, sz * LEG_Z], 0.03);
        k.cyl(dark, 0.11, 0.04, [sx * LEG_X, 0.02, sz * LEG_Z], 'y', 0.014);
        k.box(steel, [0.2, 0.025, 0.2], [sx * LEG_X, 0.05, sz * LEG_Z], 0.01);
      }
      k.box(steel, [0.13, 0.13, LEG_Z * 2 + 0.13], [sx * LEG_X, RING_Y, 0], 0.03);
      k.box(steel, [0.07, 0.08, LEG_Z * 2], [sx * LEG_X, 0.4, 0], 0.02);
      // Lugs the vessel sits on.
      k.box(bright, [0.09, 0.05, 0.22], [sx * (LEG_X - 0.06), RING_Y + 0.07, 0], 0.015);
    }
    for (const sz of [1, -1]) {
      k.box(steel, [LEG_X * 2 + 0.13, 0.13, 0.13], [0, RING_Y, sz * LEG_Z], 0.03);
      k.box(steel, [LEG_X * 2, 0.08, 0.07], [0, 0.4, sz * LEG_Z], 0.02);
      k.box(steel, [LEG_X * 2, 0.08, 0.07], [0, 0.99, sz * LEG_Z], 0.02);
      k.box(bright, [0.22, 0.05, 0.12], [0, RING_Y + 0.07, sz * (LEG_Z - 0.1)], 0.015);
    }
    // Deck plate around the vessel.
    k.box(metal(PALETTE.steelDark, 0.4), [LEG_X * 2 + 0.3, 0.05, LEG_Z * 2 + 0.3], [0, DECK_Y - 0.025, 0], 0.02);
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.bolt(bright, [sx * (LEG_X + 0.05), DECK_Y + 0.006, sz * (LEG_Z + 0.05)], 'y', 0.022);
    for (const x of [-0.3, 0.45]) k.box(steel, [0.07, 0.07, LEG_Z * 2], [x, 0.985, 0], 0.02);

    // Vessel: cone, shell, rolled rim, and the inside wall down to the dough.
    const profile = [
      [0.2, 1.3],
      [0.205, 1.34],
      [0.55, 1.74],
      [0.55, RIM_Y - 0.04],
      [0.585, RIM_Y - 0.03],
      [0.6, RIM_Y - 0.005],
      [0.585, RIM_Y + 0.02],
      [0.55, RIM_Y + 0.025],
      [0.525, RIM_Y + 0.01],
      [0.52, RIM_Y - 0.2],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    k.add(steel, new THREE.LatheGeometry(profile, 40));
    for (const y of [DECK_Y + 0.13, RIM_Y - 0.12]) k.add(bright, new THREE.TorusGeometry(0.553, 0.012, 6, 40), [0, y, 0], [Math.PI / 2, 0, 0]);
    k.cyl(bright, 0.6, 0.03, [0, DECK_Y + 0.015, 0], 'y', 0.01, 0.6, 40);
    k.cyl(bright, 0.235, 0.05, [0, 1.325, 0], 'y', 0.012);
    // Dough, slightly domed.
    const dough = matte(`#${crustColor(0).getHexString()}`, 0.7);
    k.add(
      dough,
      new THREE.LatheGeometry(
        [
          [0.52, RIM_Y - 0.17],
          [0.4, RIM_Y - 0.135],
          [0.2, RIM_Y - 0.115],
          [0, RIM_Y - 0.11],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32,
      ),
    );

    // Bridge over the vessel with the drive: gearbox and motor.
    k.box(steel, [0.16, 0.07, 1.22], [0, RIM_Y + 0.06, 0], 0.02);
    k.box(white, [0.3, 0.2, 0.3], [0, RIM_Y + 0.19, 0], 0.05);
    k.box(blue, [0.306, 0.04, 0.306], [0, RIM_Y + 0.23, 0], 0.015);
    k.cyl(blue, 0.11, 0.32, [0, RIM_Y + 0.2, -0.31], 'z', 0.03);
    k.cyl(dark, 0.118, 0.06, [0, RIM_Y + 0.2, -0.49], 'z', 0.02);
    k.box(blue, [0.12, 0.06, 0.12], [0, RIM_Y + 0.33, -0.3], 0.015);
    // Hinged guard over the outfeed half, glass in a steel frame.
    k.add(glass(), new THREE.CylinderGeometry(0.57, 0.57, 0.012, 32, 1, false, 0, Math.PI), [0, RIM_Y + 0.04, 0]);
    k.add(bright, new THREE.TorusGeometry(0.57, 0.014, 6, 32, Math.PI), [0, RIM_Y + 0.04, 0], [-Math.PI / 2, 0, -Math.PI / 2]);
    k.box(dark, [0.03, 0.04, 0.2], [0.42, RIM_Y + 0.07, 0], 0.012);

    // Divider under the cone: white housing, blue band, orange cutter head.
    k.box(white, [1.0, 0.3, 0.76], [0.1, 1.17, 0], 0.06);
    k.box(blue, [1.006, 0.04, 0.766], [0.1, 1.275, 0], 0.015);
    k.box(white, [0.56, 0.16, 0.012], [0.02, 1.14, 0.383], 0.01);
    for (let j = 0; j < 3; j++) k.box(dark, [0.2, 0.018, 0.012], [-0.1, 1.1 + j * 0.04, 0.388], 0.005);
    k.box(orange, [0.34, 0.36, 0.64], [0.77, 1.17, 0], 0.06);
    k.box(bright, [0.02, 0.24, 0.44], [0.945, 1.17, 0], 0.008);
    for (const sy of [1, -1]) for (const sz of [1, -1]) k.bolt(bright, [0.957, 1.17 + sy * 0.09, sz * 0.18], 'x');
    k.cyl(bright, 0.09, 0.1, [0.77, 0.96, 0], 'y', 0.015, 0.125);
    k.box(dark, [0.14, 0.24, 0.24], [-0.47, 1.17, 0], 0.03);
    k.cyl(blue, 0.1, 0.3, [-0.69, 1.17, 0], 'x', 0.03);
    k.cyl(dark, 0.108, 0.05, [-0.86, 1.17, 0], 'x', 0.018);

    // Flour line: up from the floor behind the stand and over into the vessel.
    const px = -0.3;
    const pz = -1.12;
    k.tube(steel, [[px, 0, pz], [px, RIM_Y + 0.42, pz], [px, RIM_Y + 0.42, -0.3], [px, RIM_Y + 0.08, -0.3]], 0.065, 0.2);
    k.cyl(bright, 0.11, 0.03, [px, 0.015, pz], 'y', 0.01);
    for (const y of [0.55, 1.5]) k.cyl(bright, 0.087, 0.04, [px, y, pz], 'y', 0.012);
    k.cyl(bright, 0.087, 0.04, [px, RIM_Y + 0.42, -0.72], 'z', 0.012);
    k.cyl(bright, 0.087, 0.04, [px, RIM_Y + 0.1, -0.3], 'y', 0.012);
    k.box(blue, [0.17, 0.13, 0.17], [px, 1.05, pz], 0.035);
    k.cyl(dark, 0.02, 0.16, [px + 0.14, 1.05, pz], 'x', 0.006, 0.02, 8);
    k.box(steel, [0.05, 0.05, pz + LEG_Z < 0 ? -(pz + LEG_Z) : 0.1], [px, 1.5, (pz - LEG_Z) / 2], 0.012);

    // Bracket for the operator panel.
    k.box(steel, [0.1, 0.06, 0.06], [-LEG_X - 0.07, 1.3, LEG_Z - 0.2], 0.014);
    return k.build();
  }, []);
  useDispose(pieces);

  // Spiral hook: a shaft with a helix that dips into the dough.
  const hook = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 1.6;
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const a = f * turns * Math.PI * 2;
      const r = f < 0.75 ? 0.21 : THREE.MathUtils.lerp(0.21, 0.02, (f - 0.75) / 0.25);
      pts.push(new THREE.Vector3(Math.cos(a) * r, RIM_Y - 0.2 + f * 0.2, Math.sin(a) * r));
    }
    const k = new Kit();
    const bright = metal(PALETTE.offWhite, 0.18);
    k.add(bright, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.03, 8, false));
    k.cyl(bright, 0.032, 0.22, [0, RIM_Y + 0.02, 0], 'y', 0.008, 0.032, 12);
    return k.build();
  }, []);
  useDispose(hook);

  const hookRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (running && hookRef.current) hookRef.current.rotation.y -= Math.min(dt, 0.1) * 2.4;
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={hookRef}>
        <Pieces pieces={hook} />
      </group>
      <ControlBox kind="hmi" position={[-LEG_X - 0.2, 1.3, LEG_Z - 0.2]} rotation={[0, -Math.PI / 2, 0]} />
      <Andon severity={severity} position={[-LEG_X - 0.02, DECK_Y, LEG_Z + 0.02]} />
    </group>
  );
}
