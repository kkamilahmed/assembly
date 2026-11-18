import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { MACHINE_POS } from '../layout';
import { glass, glow, matte, metal, PALETTE, plastic, tabletColor } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { archShape, extrudeAlongX, Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

const DEFAULT_LENGTH = MACHINE_POS.coaterStart.distanceTo(MACHINE_POS.coaterEnd);

/** Outer half-depth of the cabinet. */
const HW = 0.85;
/** Top of the lower section that the belt tunnels through. */
const LOWER_TOP = 1.22;
const TOP = 2.3;
/** Tunnel cavity: half-width and ceiling. */
const IHW = 0.6;
const IH = 1.12;
/** The drum: its axis runs along x at this height, set back from the glass. */
const DRUM_Y = 1.72;
const DRUM_Z = 0.08;
const DRUM_R = 0.4;
/** Window opening on the +z face. */
const WIN_Y0 = 1.32;
const WIN_Y1 = 2.12;

/**
 * Continuous film coater. Local frame: origin on the floor at the centre of
 * the cabinet, belt running through a tunnel in the lower section along +x
 * at BELT_Y. Above it, behind a long window on the +z (operator) side, the
 * perforated drum turns over a bed of tablets under the spray guns. Air
 * ducts rise from the roof and run back to the -z wall over `ductRun`.
 *
 * `running` turns the drum. `severity` drives the stack light.
 */
export function CoatingDrum({
  length = DEFAULT_LENGTH,
  ductRun = 2.55,
  running = true,
  severity = 'healthy',
  ...props
}: { length?: number; ductRun?: number; running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const L = length;
  const winHalf = L / 2 - 0.32;

  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const brand = plastic(PALETTE.brand);
    const inner = metal(PALETTE.steelDark, 0.4);

    // Plinth and the lower section with the belt tunnel through it.
    k.box(dark, [L - 0.1, 0.08, HW * 2 - 0.1], [0, 0.04, 0], 0.02);
    k.add(white, extrudeAlongX(archShape(HW, 0.08, LOWER_TOP, 0.05, IHW, IH, 0.08), L, 0.016));
    k.box(brand, [L + 0.008, 0.05, HW * 2 + 0.008], [0, LOWER_TOP - 0.07, 0], 0.02);
    // Service doors along the lower front, with vents.
    const doors = Math.max(2, Math.round(L / 1.2));
    for (let i = 0; i < doors; i++) {
      const x = -L / 2 + (L / doors) * (i + 0.5);
      k.box(white, [L / doors - 0.14, 0.62, 0.014], [x, 0.52, HW + 0.003], 0.012);
      k.box(dark, [0.03, 0.15, 0.034], [x + L / doors / 2 - 0.15, 0.52, HW + 0.02], 0.012);
      for (let j = 0; j < 3; j++) k.box(dark, [0.3, 0.018, 0.012], [x - 0.12, 0.34 + j * 0.045, HW + 0.01], 0.005);
    }
    // Polished collars round both tunnel mouths, dark throats inside.
    for (const sx of [1, -1]) {
      k.add(bright, extrudeAlongX(archShape(IHW + 0.08, 0.08, IH + 0.08, 0.1, IHW - 0.02, IH - 0.02, 0.07), 0.1, 0.02), [sx * (L / 2 + 0.02), 0, 0]);
      k.add(dark, extrudeAlongX(archShape(IHW - 0.01, 0.08, IH - 0.01, 0.07, IHW - 0.04, IH - 0.04, 0.06), 0.4, 0.004), [sx * (L / 2 - 0.22), 0, 0]);
    }

    // Upper housing round the drum: back, ends and roof, and a frame round
    // the window so the drum is seen through glass.
    const upH = TOP - LOWER_TOP;
    const upY = (LOWER_TOP + TOP) / 2;
    k.box(white, [L, upH, 0.16], [0, upY, -HW + 0.08], 0.05);
    for (const sx of [1, -1]) k.box(white, [0.22, upH, HW * 2], [sx * (L / 2 - 0.11), upY, 0], 0.05);
    k.box(white, [L, 0.2, HW * 2], [0, TOP - 0.1, 0], 0.08);
    k.box(white, [L - 0.3, WIN_Y0 - LOWER_TOP + 0.02, 0.14], [0, (LOWER_TOP + WIN_Y0) / 2, HW - 0.07], 0.03);
    k.box(brand, [L + 0.008, 0.05, HW * 2 + 0.008], [0, TOP - 0.25, 0], 0.02);
    // Window frame and its glass.
    k.box(dark, [winHalf * 2 + 0.08, 0.05, 0.05], [0, WIN_Y0, HW], 0.015);
    k.box(dark, [winHalf * 2 + 0.08, 0.05, 0.05], [0, WIN_Y1, HW], 0.015);
    for (const sx of [1, -1]) k.box(dark, [0.05, WIN_Y1 - WIN_Y0, 0.05], [sx * winHalf, (WIN_Y0 + WIN_Y1) / 2, HW], 0.015);
    k.box(dark, [0.04, WIN_Y1 - WIN_Y0, 0.04], [0, (WIN_Y0 + WIN_Y1) / 2, HW], 0.012);
    k.add(glass(), new THREE.PlaneGeometry(winHalf * 2, WIN_Y1 - WIN_Y0), [0, (WIN_Y0 + WIN_Y1) / 2, HW - 0.01]);
    for (const sx of [1, -1]) k.box(bright, [0.03, 0.3, 0.03], [sx * (winHalf - 0.25), (WIN_Y0 + WIN_Y1) / 2, HW + 0.05], 0.01);
    // Inside: a pale liner so the drum reads against it, and the tablet bed.
    k.box(inner, [L - 0.44, upH - 0.22, 0.02], [0, upY - 0.04, -HW + 0.17], 0.01);
    k.box(inner, [L - 0.44, 0.02, HW * 2 - 0.35], [0, LOWER_TOP + 0.01, 0.02], 0.01);
    // Tumbling bed of tablets in the bottom of the drum, heaped up the side
    // the drum is lifting them.
    k.box(matte(`#${tabletColor(0.6).getHexString()}`, 0.5), [winHalf * 2 - 0.16, 0.16, DRUM_R * 1.3], [0, DRUM_Y - DRUM_R + 0.13, DRUM_Z], 0.07, [0.35, 0, 0]);
    // Spray gun manifold along the drum.
    k.cyl(bright, 0.025, winHalf * 2 - 0.2, [0, DRUM_Y + 0.14, DRUM_Z + 0.1], 'x', 0.008, 0.025, 10);
    for (let i = 0; i < 4; i++) {
      const x = -winHalf + 0.35 + ((winHalf * 2 - 0.7) * i) / 3;
      k.box(steel, [0.06, 0.1, 0.06], [x, DRUM_Y + 0.08, DRUM_Z + 0.1], 0.015);
      k.cyl(dark, 0.02, 0.05, [x, DRUM_Y + 0.02, DRUM_Z + 0.06], 'y', 0.006, 0.012, 8);
    }
    // A strip light along the top of the drum chamber.
    k.box(glow('#eaf3ff', 1.1), [winHalf * 2 - 0.2, 0.03, 0.05], [0, WIN_Y1 - 0.06, HW - 0.2], 0.01);

    // Roof: inlet and exhaust air ducts, up and back into the wall.
    for (const sx of [1, -1]) {
      const x = sx * (L / 2 - 0.7);
      k.cyl(bright, 0.24, 0.06, [x, TOP + 0.03, -0.3], 'y', 0.015, 0.24, 24);
      k.tube(steel, [[x, TOP, -0.3], [x, TOP + 0.95, -0.3], [x, TOP + 0.95, -ductRun]], 0.18, 0.32);
      k.cyl(bright, 0.2, 0.05, [x, TOP + 0.5, -0.3], 'y', 0.012, 0.2, 24);
      k.cyl(bright, 0.2, 0.05, [x, TOP + 0.95, -ductRun + 0.15], 'z', 0.012, 0.2, 24);
    }
    // Spray solution line to the manifold, and a cable tray on the roof.
    k.tube(dark, [[-L / 2 + 0.4, TOP, 0.4], [-L / 2 + 0.4, TOP + 0.35, 0.4], [L / 2 - 1.2, TOP + 0.35, 0.4]], 0.025, 0.1);
    k.box(dark, [L - 1.2, 0.035, 0.17], [0, TOP + 0.02, 0.2], 0.012);

    // Pedestal for the operator panel, in front of the +x end.
    k.box(steel, [0.08, 1.15, 0.08], [L / 2 - 0.35, 0.6, HW + 0.42], 0.02);
    k.box(steel, [0.28, 0.03, 0.28], [L / 2 - 0.35, 0.015, HW + 0.42], 0.01);
    return k.build();
  }, [L, ductRun, winHalf]);
  useDispose(pieces);

  // The drum: a perforated shell drawn as rings and slats, so it reads as
  // turning through the glass.
  const drum = useMemo(() => {
    const k = new Kit();
    const bright = metal(PALETTE.offWhite, 0.2);
    const steel = metal(PALETTE.steelDark, 0.35);
    const len = winHalf * 2 - 0.12;
    for (let i = 0; i <= 6; i++) {
      const x = -len / 2 + (len * i) / 6;
      k.add(bright, new THREE.TorusGeometry(DRUM_R, 0.022, 6, 32), [x, 0, 0], [0, Math.PI / 2, 0]);
    }
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      k.cyl(steel, 0.016, len, [0, Math.cos(a) * DRUM_R, Math.sin(a) * DRUM_R], 'x', 0.004, 0.016, 6);
    }
    // Mixing baffles inside.
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + 0.4;
      k.box(bright, [len * 0.9, 0.12, 0.02], [0, Math.cos(a) * (DRUM_R - 0.07), Math.sin(a) * (DRUM_R - 0.07)], 0.008, [a, 0, 0]);
    }
    return k.build();
  }, [winHalf]);
  useDispose(drum);

  const drumRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (running && drumRef.current) drumRef.current.rotation.x -= Math.min(dt, 0.1) * 1.1;
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={drumRef} position={[0, DRUM_Y, DRUM_Z]}>
        <Pieces pieces={drum} />
      </group>
      <ControlBox kind="hmi" accent={PALETTE.brand} position={[L / 2 - 0.35, 1.42, HW + 0.42]} />
      <Andon severity={severity} position={[L / 2 - 0.2, TOP, HW - 0.2]} />
    </group>
  );
}
