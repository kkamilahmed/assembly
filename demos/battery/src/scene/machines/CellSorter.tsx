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

const LEG_X = 0.62;
const LEG_Z = 0.74;
/** Underside and top of the sorting cabinet the belt runs beneath. */
const CAB_Y = 1.3;
const CAB_TOP = 2.02;
const CELL_BLUE = '#3a8fd9';
const CAROUSEL_R = 0.42;

/**
 * Cell sorter, station 1: cells come in from the magazines on its roof, are
 * read (voltage and internal resistance) on a turning carousel and dropped
 * matched into a carrier on the start of the belt. Local frame: origin on
 * the floor under the cabinet, belt leaving along +x at BELT_Y from under
 * the stand. The operator panel is on the -x, +z corner and faces -x. Place
 * it at MACHINE_POS.sorter with rotation y = PI / 2.
 *
 * `running` turns the carousel. `severity` drives the stack light.
 */
export function CellSorter({
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
    const orange = plastic(PALETTE.orange, 0.3);
    const blue = plastic(PALETTE.blue);
    const cells = plastic(CELL_BLUE, 0.35);

    // Stand: four legs on levelling feet, braced front and back.
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        k.box(steel, [0.12, CAB_Y, 0.12], [sx * LEG_X, CAB_Y / 2, sz * LEG_Z], 0.03);
        k.cyl(dark, 0.1, 0.04, [sx * LEG_X, 0.02, sz * LEG_Z], 'y', 0.014);
      }
    }
    for (const sz of [1, -1]) k.box(steel, [LEG_X * 2, 0.07, 0.07], [0, 0.4, sz * LEG_Z], 0.02);

    // Cabinet with a glazed front onto the carousel.
    const cabH = CAB_TOP - CAB_Y;
    k.box(white, [LEG_X * 2 + 0.2, cabH, LEG_Z * 2 + 0.2], [0, CAB_Y + cabH / 2, 0], 0.08);
    k.box(orange, [LEG_X * 2 + 0.208, 0.07, LEG_Z * 2 + 0.208], [0, CAB_TOP - 0.1, 0], 0.025);
    k.box(dark, [LEG_X * 2 - 0.1, cabH - 0.3, 0.02], [0, CAB_Y + cabH / 2 - 0.04, LEG_Z + 0.105], 0.015);
    k.add(glass(), new THREE.PlaneGeometry(LEG_X * 2 - 0.16, cabH - 0.36), [0, CAB_Y + cabH / 2 - 0.04, LEG_Z + 0.118]);
    for (let j = 0; j < 4; j++) k.box(dark, [0.012, 0.02, 0.5], [-LEG_X - 0.1, CAB_Y + 0.18 + j * 0.06, 0], 0.005);

    // Three cell magazines on the roof: open-topped bins of upright cells
    // with a clear front, each over its own feed throat.
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.44;
      const x = -0.3;
      const h = 0.3;
      k.box(dark, [0.42, 0.04, 0.38], [x, CAB_TOP + 0.02, z], 0.012);
      for (const sz of [1, -1]) k.box(steel, [0.42, h, 0.02], [x, CAB_TOP + h / 2 + 0.04, z + sz * 0.18], 0.006);
      k.box(steel, [0.02, h, 0.38], [x - 0.2, CAB_TOP + h / 2 + 0.04, z], 0.006);
      k.add(glass(), new THREE.PlaneGeometry(0.36, h - 0.02), [x + 0.2, CAB_TOP + h / 2 + 0.04, z], [0, Math.PI / 2, 0]);
      k.box(orange, [0.43, 0.03, 0.39], [x, CAB_TOP + h + 0.05, z], 0.01);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          k.cyl(cells, 0.04, 0.24, [x - 0.135 + r * 0.09, CAB_TOP + 0.17, z - 0.135 + c * 0.09], 'y', 0.008, 0.04, 10);
        }
      }
    }
    // Reader head beside the carousel.
    k.box(blue, [0.24, 0.16, 0.2], [0.42, CAB_TOP - 0.36, LEG_Z - 0.2], 0.04);

    // Drop chute down to the carrier on the belt.
    k.box(dark, [0.5, 0.24, 0.52], [0.25, CAB_Y - 0.12, 0], 0.04);
    k.box(blue, [0.506, 0.04, 0.526], [0.25, CAB_Y - 0.03, 0], 0.012);
    for (const sz of [1, -1]) k.box(bright, [0.42, 0.02, 0.02], [0.25, CAB_Y - 0.27, sz * 0.22], 0.006);

    // Bracket for the operator panel.
    k.box(steel, [0.1, 0.06, 0.06], [-LEG_X - 0.07, 1.25, LEG_Z - 0.2], 0.014);
    return k.build();
  }, []);
  useDispose(pieces);

  // The carousel seen through the glass: a turntable ringed with cells.
  const carousel = useMemo(() => {
    const k = new Kit();
    k.cyl(metal(PALETTE.steelDark, 0.35), CAROUSEL_R, 0.04, [0, 0, 0], 'y', 0.012, CAROUSEL_R, 36);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      k.cyl(plastic(CELL_BLUE, 0.35), 0.042, 0.12, [Math.cos(a) * (CAROUSEL_R - 0.07), 0.08, Math.sin(a) * (CAROUSEL_R - 0.07)], 'y', 0.01, 0.042, 12);
    }
    k.cyl(plastic(PALETTE.orange, 0.3), 0.08, 0.1, [0, 0.06, 0], 'y', 0.02);
    return k.build();
  }, []);
  useDispose(carousel);

  const carouselRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (running && carouselRef.current) carouselRef.current.rotation.y -= Math.min(dt, 0.1) * 1.2;
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={carouselRef} position={[0.05, CAB_Y + 0.12, 0.15]}>
        <Pieces pieces={carousel} />
      </group>
      <ControlBox kind="hmi" position={[-LEG_X - 0.2, 1.25, LEG_Z - 0.2]} rotation={[0, -Math.PI / 2, 0]} />
      <Andon severity={severity} position={[LEG_X - 0.02, CAB_TOP, LEG_Z + 0.02]} />
    </group>
  );
}
