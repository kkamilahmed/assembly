import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glass, matte, metal, PALETTE, plastic, tabletColor } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

/** Half-size of the press body (square in plan). */
const HS = 0.62;
const PLINTH = 0.08;
/** Lower cabinet top, where the glazed compression chamber starts. */
const CAB_TOP = 0.92;
const CHAMBER_TOP = 1.76;
const HEAD_TOP = 2.12;
/** Turret table height inside the chamber. */
const TABLE_Y = 1.18;
const PUNCHES = 18;
const PUNCH_R = 0.37;
/** Where the discharge chute drops tablets onto the belt (local +x). */
export const PRESS_CHUTE_X = 1.12;

/**
 * Rotary tablet press, press P-2. Local frame: origin on the floor at the
 * centre of the press; the discharge chute leaves along +x and ends over
 * the start of the belt at x = PRESS_CHUTE_X. The HMI is on +z. Place it
 * at MACHINE_POS.press with rotation y = PI / 2, which points the chute
 * down the line and the HMI at the camera, toward the blender.
 *
 * Inside the glazed chamber the turret turns with its ring of punches,
 * riding the cam track up and down. `running` turns it; `jamming` makes it
 * stall and lurch the way a press does when tablets stick in the dies.
 * `severity` drives the stack light. `blenderAt` (local x, z) routes the
 * powder transfer line over to the blender's receiver; without it the
 * hopper just has its inlet stub.
 */
export function TabletPress({
  running = true,
  jamming = false,
  severity = 'healthy',
  blenderAt,
  ...props
}: {
  running?: boolean;
  jamming?: boolean;
  severity?: Severity;
  blenderAt?: [number, number];
} & ThreeElements['group']) {
  const bx = blenderAt?.[0];
  const bz = blenderAt?.[1];
  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const brand = plastic(PALETTE.brand);
    const pane = glass();

    // Plinth and lower cabinet with service doors on the two camera sides.
    k.box(dark, [HS * 2 - 0.06, PLINTH, HS * 2 - 0.06], [0, PLINTH / 2, 0], 0.025);
    k.box(white, [HS * 2, CAB_TOP - PLINTH, HS * 2], [0, (CAB_TOP + PLINTH) / 2, 0], 0.06);
    k.box(brand, [HS * 2 + 0.008, 0.05, HS * 2 + 0.008], [0, CAB_TOP - 0.06, 0], 0.02);
    for (const sz of [1, -1]) {
      k.box(white, [0.5, 0.56, 0.014], [-0.26, 0.47, sz * (HS + 0.003)], 0.012);
      k.box(dark, [0.03, 0.16, 0.034], [-0.07, 0.47, sz * (HS + 0.02)], 0.012);
      for (let j = 0; j < 4; j++) k.box(dark, [0.36, 0.018, 0.012], [0.3, 0.3 + j * 0.05, sz * (HS + 0.008)], 0.005);
    }
    k.box(white, [0.014, 0.56, 0.9], [-HS - 0.003, 0.47, 0], 0.012);
    k.box(dark, [0.034, 0.16, 0.03], [-HS - 0.02, 0.47, 0.36], 0.012);

    // Compression chamber: steel corner posts, rails and glazing all round.
    const post = HS - 0.04;
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(steel, [0.08, CHAMBER_TOP - CAB_TOP, 0.08], [sx * post, (CAB_TOP + CHAMBER_TOP) / 2, sz * post], 0.02);
    for (const s of [1, -1]) {
      k.box(steel, [HS * 2 - 0.08, 0.05, 0.06], [0, CAB_TOP + 0.03, s * post], 0.015);
      k.box(steel, [0.06, 0.05, HS * 2 - 0.08], [s * post, CAB_TOP + 0.03, 0], 0.015);
      k.add(pane, new THREE.PlaneGeometry(HS * 2 - 0.16, CHAMBER_TOP - CAB_TOP - 0.08), [0, (CAB_TOP + CHAMBER_TOP) / 2 + 0.02, s * post]);
      k.add(pane, new THREE.PlaneGeometry(HS * 2 - 0.16, CHAMBER_TOP - CAB_TOP - 0.08), [s * post, (CAB_TOP + CHAMBER_TOP) / 2 + 0.02, 0], [0, Math.PI / 2, 0]);
    }
    // Door handles on the glazing.
    for (const sz of [1, -1]) k.box(dark, [0.18, 0.03, 0.03], [-0.15, 1.42, sz * (post + 0.03)], 0.012);
    k.box(dark, [0.03, 0.03, 0.18], [-post - 0.03, 1.42, 0.15], 0.012);

    // The fixed parts inside: the column, the lower cam housing and the
    // feed frame that fills the dies.
    k.cyl(bright, 0.09, CHAMBER_TOP - CAB_TOP, [0, (CAB_TOP + CHAMBER_TOP) / 2, 0], 'y', 0.01, 0.09, 16);
    k.cyl(steel, 0.46, 0.1, [0, CAB_TOP + 0.05, 0], 'y', 0.02, 0.46, 36);
    k.box(steel, [0.34, 0.06, 0.24], [-0.22, TABLE_Y + 0.1, 0.12], 0.02);
    k.box(brand, [0.18, 0.05, 0.12], [-0.22, TABLE_Y + 0.155, 0.12], 0.015);
    k.cyl(steel, 0.42, 0.06, [0, 1.62, 0], 'y', 0.02, 0.42, 36);
    // Take-off scraper guiding finished tablets to the chute.
    k.box(bright, [0.34, 0.03, 0.04], [0.32, TABLE_Y + 0.07, -0.12], 0.01, [0, -0.5, 0]);

    // Head: white housing with the brand band, an access panel and vents.
    k.box(white, [HS * 2, HEAD_TOP - CHAMBER_TOP, HS * 2], [0, (CHAMBER_TOP + HEAD_TOP) / 2, 0], 0.06);
    k.box(brand, [HS * 2 + 0.008, 0.05, HS * 2 + 0.008], [0, CHAMBER_TOP + 0.05, 0], 0.02);
    for (let j = 0; j < 5; j++) k.box(dark, [0.012, 0.018, 0.4], [-HS - 0.004, 1.92 + j * 0.035, -0.2], 0.005);
    k.box(steel, [0.3, 0.06, 0.3], [0.25, HEAD_TOP + 0.03, -0.25], 0.02);

    // Feed hopper on the head, with its level sensor and sight glass.
    const hx = -0.15;
    const hz = 0.12;
    k.cyl(steel, 0.09, 0.08, [hx, HEAD_TOP + 0.04, hz], 'y', 0.01, 0.09, 16);
    k.cyl(steel, 0.1, 0.5, [hx, HEAD_TOP + 0.33, hz], 'y', 0.015, 0.3, 28);
    k.cyl(bright, 0.32, 0.12, [hx, HEAD_TOP + 0.64, hz], 'y', 0.02, 0.32, 28);
    k.cyl(bright, 0.34, 0.03, [hx, HEAD_TOP + 0.715, hz], 'y', 0.01, 0.34, 28);
    k.cyl(dark, 0.025, 0.12, [hx + 0.24, HEAD_TOP + 0.62, hz], 'x', 0.006, 0.025, 10);

    // Powder transfer line from the blender's receiver into the hopper.
    if (bx !== undefined && bz !== undefined) {
      const top = 3.05;
      k.tube(bright, [[hx, HEAD_TOP + 0.73, hz], [hx, top, hz], [bx, top, bz], [bx, top - 0.25, bz]], 0.055, 0.22);
      for (const [x, z] of [[hx, hz], [bx, bz]]) k.cyl(steel, 0.075, 0.05, [x, top - 0.05, z], 'y', 0.012, 0.075, 14);
    } else {
      k.cyl(bright, 0.06, 0.12, [hx, HEAD_TOP + 0.79, hz], 'y', 0.01, 0.06, 14);
    }

    // Discharge chute: out through the chamber wall, down to the belt.
    const cy = TABLE_Y + 0.02;
    k.box(steel, [0.14, 0.1, 0.24], [HS + 0.02, cy, -0.06], 0.02);
    k.box(bright, [PRESS_CHUTE_X - HS + 0.04, 0.03, 0.26], [(HS + PRESS_CHUTE_X) / 2, cy - 0.12, -0.06], 0.01, [0, 0, -0.28]);
    for (const sz of [1, -1]) k.box(bright, [PRESS_CHUTE_X - HS + 0.04, 0.08, 0.02], [(HS + PRESS_CHUTE_X) / 2, cy - 0.09, -0.06 + sz * 0.13], 0.008, [0, 0, -0.28]);
    // Deduster tube along the chute.
    k.cyl(steel, 0.05, 0.36, [HS + 0.22, cy + 0.12, 0.17], 'x', 0.012, 0.05, 14);
    k.tube(dark, [[HS + 0.4, cy + 0.12, 0.17], [HS + 0.4, 0.3, 0.17], [HS + 0.1, 0.3, 0.17]], 0.025, 0.08);

    // Arm for the HMI.
    k.box(steel, [0.06, 0.06, 0.18], [0.2, 1.38, HS + 0.09], 0.014);
    return k.build();
  }, [bx, bz]);
  useDispose(pieces);

  // The turret: die table, the punches above and below it, and a few
  // tablets riding the table toward the take-off.
  const turret = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.16);
    const dark = metal(PALETTE.steelDark, 0.3);
    k.cyl(bright, 0.44, 0.1, [0, TABLE_Y, 0], 'y', 0.02, 0.44, 40);
    k.cyl(steel, 0.3, 0.12, [0, TABLE_Y + 0.25, 0], 'y', 0.02, 0.3, 32);
    k.cyl(steel, 0.3, 0.12, [0, TABLE_Y - 0.13, 0], 'y', 0.02, 0.3, 32);
    const tablet = matte(`#${tabletColor(0).getHexString()}`, 0.6);
    for (let i = 0; i < PUNCHES; i++) {
      const a = (i / PUNCHES) * Math.PI * 2;
      const x = Math.cos(a) * PUNCH_R;
      const z = Math.sin(a) * PUNCH_R;
      // Upper punches ride a cam: highest opposite the compression roller.
      const lift = 0.06 * (1 + Math.cos(a)) * 0.5;
      k.cyl(bright, 0.018, 0.2, [x, TABLE_Y + 0.17 + lift, z], 'y', 0.004, 0.018, 8);
      k.cyl(dark, 0.026, 0.035, [x, TABLE_Y + 0.28 + lift, z], 'y', 0.008, 0.026, 8);
      k.cyl(bright, 0.018, 0.16, [x, TABLE_Y - 0.15, z], 'y', 0.004, 0.018, 8);
      k.cyl(dark, 0.03, 0.012, [x, TABLE_Y + 0.051, z], 'y', 0.004, 0.03, 10);
      if (i % 3 === 1) k.cyl(tablet, 0.026, 0.016, [x, TABLE_Y + 0.062, z], 'y', 0.006, 0.026, 10);
    }
    return k.build();
  }, []);
  useDispose(turret);

  const turretRef = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const g = turretRef.current;
    if (!g || !running) return;
    let speed = 1.6;
    if (jamming) {
      // Stalls and lurches: a stuck die holding the turret, then a kick.
      const u = (clock.elapsedTime * 1.3) % 1;
      speed = u < 0.55 ? 0.05 : 3.2 * Math.sin(((u - 0.55) / 0.45) * Math.PI);
    }
    g.rotation.y -= Math.min(dt, 0.1) * speed;
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={turretRef}>
        <Pieces pieces={turret} />
      </group>
      <ControlBox kind="trend" accent={PALETTE.brand} position={[0.2, 1.38, HS + 0.26]} />
      <Andon severity={severity} position={[HS - 0.12, HEAD_TOP, HS - 0.12]} />
    </group>
  );
}
