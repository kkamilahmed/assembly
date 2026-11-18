import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glass, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

/** Body extents along the belt. The line ends inside, at x = -0.5. */
const X0 = -1.3;
const X1 = 0.5;
const CX = (X0 + X1) / 2;
const LEN = X1 - X0;
const HZ = 0.95;
const DECK = 0.6;
const ROOF = 1.95;
/** Top of the outfeed rollers, where finished cartons ride. */
const ROLL_Y = 0.68;
/** A pack of the tablets: two blister cards in a printed carton. */
const CARTON: [number, number, number] = [0.3, 0.12, 0.2];

function closedCarton(k: Kit, x: number, z = 0) {
  const white = plastic(PALETTE.white, 0.35);
  const brand = plastic(PALETTE.brand, 0.35);
  const y = ROLL_Y + CARTON[1] / 2;
  k.box(white, CARTON, [x, y, z], 0.01);
  k.box(brand, [CARTON[0] + 0.004, CARTON[1] * 0.42, CARTON[2] * 0.3], [x, y - 0.01, z - CARTON[2] * 0.28], 0.004);
  k.box(brand, [CARTON[0] * 0.5, 0.004, CARTON[2] * 0.3], [x - 0.04, ROLL_Y + CARTON[1] + 0.001, z - CARTON[2] * 0.28], 0.001);
}

function openCarton(k: Kit, x: number) {
  const white = plastic(PALETTE.white, 0.35);
  const [w, h, d] = CARTON;
  const y = ROLL_Y + h / 2;
  for (const sx of [1, -1]) k.box(white, [0.008, h, d], [x + sx * (w / 2 - 0.004), y, 0], 0.003);
  for (const sz of [1, -1]) k.box(white, [w, h, 0.008], [x, y, sz * (d / 2 - 0.004)], 0.003);
  k.box(metal(PALETTE.foil, 0.3), [w - 0.03, 0.012, d - 0.03], [x, ROLL_Y + 0.07, 0], 0.003);
  // Tuck flap open toward the loading side.
  k.box(white, [w, 0.006, 0.1], [x, ROLL_Y + h + 0.03, d / 2 + 0.04], 0.002, [-0.6, 0, 0]);
}

/**
 * Cartoner at the end of the line, behind glass guards: blister cards are
 * picked off the belt, two to a carton, with the leaflet, and the cartons
 * closed. Local frame: origin on the floor, belt arriving along +x at
 * BELT_Y and ending inside at x = -0.5; the body spans x -1.3..0.5 and
 * finished cartons leave on rollers along +x out to x = 1.1. The glazed
 * operator side and the HMI are on +z. Place it at MACHINE_POS.cartoner
 * with no rotation.
 *
 * `running` moves the pick-and-place head. `severity` drives the stack light.
 */
export function Cartoner({
  running = true,
  severity = 'healthy',
  ...props
}: { running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.offWhite);
    const brandDeep = plastic(PALETTE.brandDeep);
    const brand = plastic(PALETTE.brand);
    const pane = glass();

    // Base cabinet with the brand band, doors and vents.
    k.box(dark, [LEN - 0.1, 0.08, HZ * 2 - 0.1], [CX, 0.04, 0], 0.02);
    k.box(white, [LEN, DECK - 0.08, HZ * 2], [CX, 0.08 + (DECK - 0.08) / 2, 0], 0.05);
    k.box(brand, [LEN + 0.008, 0.05, HZ * 2 + 0.008], [CX, DECK - 0.07, 0], 0.02);
    for (const sx of [1, -1]) {
      const x = CX + sx * 0.44;
      k.box(white, [0.8, 0.34, 0.014], [x, 0.3, HZ + 0.003], 0.01);
      k.box(dark, [0.03, 0.15, 0.035], [x - sx * 0.32, 0.3, HZ + 0.022], 0.012);
    }
    for (let j = 0; j < 4; j++) k.box(dark, [0.3, 0.02, 0.012], [CX + 0.52, 0.23 + j * 0.045, HZ + 0.01], 0.005);
    k.box(white, [0.014, 0.34, 1.5], [X1 + 0.003, 0.3, 0], 0.01);
    for (let j = 0; j < 4; j++) k.box(dark, [0.012, 0.02, 0.36], [X1 + 0.01, 0.23 + j * 0.045, 0.45], 0.005);
    k.box(steel, [LEN - 0.03, 0.03, HZ * 2 - 0.03], [CX, DECK + 0.005, 0], 0.01);

    // Guard frame: posts, top and bottom rails.
    const px = [X0 + 0.045, CX, X1 - 0.045];
    const pz = HZ - 0.045;
    for (const x of px) for (const sz of [1, -1]) k.box(steel, [0.085, ROOF - DECK, 0.085], [x, (ROOF + DECK) / 2, sz * pz], 0.02);
    for (const sz of [1, -1]) {
      k.box(steel, [LEN - 0.09, 0.06, 0.06], [CX, DECK + 0.05, sz * pz], 0.015);
      k.box(steel, [LEN - 0.09, 0.06, 0.06], [CX, ROOF - 0.03, sz * pz], 0.015);
    }
    // Glazing on all four sides. The ends stay open low down for the belt
    // coming in and the cases going out.
    for (const sz of [1, -1]) for (const sx of [1, -1]) k.add(pane, new THREE.PlaneGeometry(0.78, 1.24), [CX + sx * 0.43, 1.3, sz * pz]);
    k.add(pane, new THREE.PlaneGeometry(HZ * 2 - 0.18, 0.76), [X1 - 0.045, 1.54, 0], [0, Math.PI / 2, 0]);
    k.add(pane, new THREE.PlaneGeometry(HZ * 2 - 0.18, 0.56), [X0 + 0.045, 1.64, 0], [0, Math.PI / 2, 0]);
    k.box(steel, [0.05, 0.06, HZ * 2 - 0.17], [X0 + 0.045, 1.34, 0], 0.015);
    // Outfeed end: fascia either side of the exit, and a lintel over it.
    for (const sz of [1, -1]) k.box(steel, [0.035, 0.5, 0.46], [X1 - 0.045, DECK + 0.27, sz * 0.67], 0.014);
    k.box(steel, [0.05, 0.08, HZ * 2 - 0.17], [X1 - 0.045, 1.13, 0], 0.018);
    k.box(brand, [0.02, 0.05, 0.86], [X1 - 0.012, 1.13, 0], 0.008);
    // Door furniture on the glazed side.
    for (const sx of [1, -1]) {
      k.box(dark, [0.03, 0.32, 0.035], [CX + sx * 0.11, 1.25, pz + 0.035], 0.012);
      k.box(brandDeep, [0.09, 0.055, 0.045], [CX + sx * 0.12, ROOF - 0.11, pz + 0.04], 0.014);
    }

    // Roof: a service housing over the back half, glazing over the front
    // half so the mechanism shows from above.
    const houseZ = -HZ + 0.36;
    k.box(white, [LEN + 0.05, 0.2, 0.77], [CX, ROOF + 0.1, houseZ], 0.06);
    k.box(brand, [LEN + 0.058, 0.045, 0.778], [CX, ROOF + 0.07, houseZ], 0.018);
    k.box(steel, [0.56, 0.14, 0.42], [CX - 0.4, ROOF + 0.26, houseZ], 0.035);
    for (let j = 0; j < 5; j++) k.box(dark, [0.4, 0.012, 0.03], [CX - 0.4, ROOF + 0.332, houseZ - 0.14 + j * 0.07], 0.004);
    for (let j = 0; j < 6; j++) k.box(dark, [0.035, 0.012, 0.44], [CX + 0.1 + j * 0.08, ROOF + 0.2, houseZ], 0.004);
    k.cyl(bright, 0.05, 0.05, [X1 - 0.2, ROOF + 0.215, houseZ], 'y', 0.012, 0.05, 12);
    const roofZ0 = houseZ + 0.36;
    for (const x of px) k.box(steel, [0.06, 0.06, pz - roofZ0], [x, ROOF - 0.03, (pz + roofZ0) / 2], 0.015);
    for (const sx of [1, -1]) k.add(pane, new THREE.PlaneGeometry(0.78, pz - roofZ0 - 0.04), [CX + sx * 0.43, ROOF - 0.02, (pz + roofZ0) / 2], [-Math.PI / 2, 0, 0]);

    // Inside: the carton magazine over the infeed, a stack of flat printed
    // blanks in a steel cage, and the leaflet feeder beside it.
    for (const sz of [1, -1]) k.box(steel, [0.36, 0.78, 0.1], [-0.92, DECK + 0.4, sz * 0.66], 0.025);
    k.box(steel, [0.36, 0.07, 1.42], [-0.92, DECK + 0.82, 0], 0.02);
    k.box(brand, [0.26, 0.13, 1.1], [-0.92, 1.27, 0], 0.04);
    for (let j = 0; j < 7; j++) {
      k.box(plastic(PALETTE.white, 0.4), [0.32, 0.028, 0.5], [-0.92, 1.4 + j * 0.032, -0.2], 0.006);
      k.box(brand, [0.322, 0.03, 0.12], [-0.92, 1.4 + j * 0.032, -0.32], 0.004);
    }
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(steel, [0.02, 0.3, 0.02], [-0.92 + sx * 0.18, 1.52, -0.2 + sz * 0.27], 0.006);
    k.box(plastic(PALETTE.white, 0.5), [0.22, 0.16, 0.24], [-0.92, 1.42, 0.3], 0.006);
    k.box(steel, [0.26, 0.04, 0.3], [-0.92, 1.33, 0.3], 0.01);
    // Dead plate between the belt and the carton.
    k.box(bright, [0.22, 0.02, 0.86], [-0.35, 0.845, 0], 0.008);
    for (const sz of [1, -1]) k.box(steel, [0.04, 0.23, 0.04], [-0.35, 0.725, sz * 0.38], 0.012);

    // Carton rollers, running from the loading spot out through the exit.
    const rollX0 = -0.42;
    const rollX1 = 1.08;
    for (const sz of [1, -1]) {
      k.box(steel, [rollX1 - rollX0 + 0.06, 0.075, 0.035], [(rollX0 + rollX1) / 2, ROLL_Y - 0.035, sz * 0.4], 0.012);
      k.box(steel, [0.05, ROLL_Y - 0.08, 0.05], [rollX1 - 0.05, (ROLL_Y - 0.08) / 2 + 0.01, sz * 0.4], 0.014);
      k.cyl(dark, 0.05, 0.03, [rollX1 - 0.05, 0.015, sz * 0.4], 'y', 0.01, 0.05, 12);
    }
    k.box(steel, [0.04, 0.04, 0.8], [rollX1 - 0.05, 0.28, 0], 0.012);
    const rollers = Math.round((rollX1 - rollX0) / 0.1);
    for (let i = 0; i <= rollers; i++) k.cyl(bright, 0.03, 0.74, [rollX0 + ((rollX1 - rollX0) * i) / rollers, ROLL_Y - 0.03, 0], 'z', 0.008, 0.03, 10);

    openCarton(k, -0.15);
    for (const x of [0.24, 0.6, 0.96]) closedCarton(k, x);

    // Rail for the pick-and-place head.
    k.box(steel, [LEN - 0.12, 0.07, 0.09], [CX, 1.82, 0], 0.02);
    for (const x of px) k.box(steel, [0.05, 0.08, 0.05], [x, 1.88, 0], 0.012);
    // Arm for the HMI.
    k.box(steel, [0.06, 0.06, 0.16], [X0 + 0.045, 1.42, HZ + 0.06], 0.014);
    return k.build();
  }, []);
  useDispose(pieces);

  const head = useMemo(() => {
    const k = new Kit();
    const blue = plastic(PALETTE.brand);
    k.box(blue, [0.2, 0.13, 0.22], [0, 1.74, 0], 0.035);
    k.cyl(metal(PALETTE.offWhite, 0.18), 0.022, 0.44, [0, 1.47, 0], 'y', 0.005, 0.022, 10);
    k.box(plastic(PALETTE.graphite), [0.3, 0.035, 0.26], [0, 1.25, 0], 0.012);
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.cyl(blue, 0.03, 0.05, [sx * 0.09, 1.21, sz * 0.075], 'y', 0.01, 0.022, 12);
    return k.build();
  }, []);
  useDispose(head);

  const headRef = useRef<THREE.Group>(null);
  const phase = useRef(0);
  useFrame((_, dt) => {
    const group = headRef.current;
    if (!group) return;
    if (running) phase.current += Math.min(dt, 0.1) * 1.8;
    // Shuttle between the dead plate and the carton, dipping at each end.
    const p = phase.current;
    group.position.x = -0.25 + 0.1 * Math.cos(p);
    group.position.y = -0.1 * Math.pow(Math.abs(Math.cos(p)), 6);
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={headRef}>
        <Pieces pieces={head} />
      </group>
      <ControlBox kind="pack" position={[X0 + 0.045, 1.42, HZ + 0.22]} />
      <Andon severity={severity} position={[X1 - 0.045, ROOF, HZ - 0.045]} />
    </group>
  );
}
