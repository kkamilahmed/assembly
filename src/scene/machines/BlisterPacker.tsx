import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { MACHINE_POS } from '../layout';
import { glass, matte, metal, PALETTE, plastic, tabletColor } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

const DEFAULT_LENGTH = MACHINE_POS.blisterStart.distanceTo(MACHINE_POS.blisterEnd);

/** Side cabinets stand either side of the belt, from CAB_IN to CAB_OUT. */
const CAB_IN = 0.6;
const CAB_OUT = 0.86;
/** Guard posts and glazing, just inside the cabinets' outer faces. */
const GUARD_Z = CAB_OUT - 0.04;
const DECK = 1.02;
const HOOD = 2.0;
/** The forming web runs along the deck at this height. */
const WEB_Y = DECK + 0.14;
const WEB_W = 0.38;
/** Stations along the web, as a fraction of the half length. */
const FORM = -0.5;
const FEED = -0.12;
const SEAL = 0.28;
const CUT = 0.7;

/**
 * Thermoform blister packer. Local frame: origin on the floor at the centre
 * of the machine, belt running through along +x at BELT_Y between two side
 * cabinets. On the deck above, white PVC comes off its reel, is formed into
 * pockets, filled from the tablet hopper, sealed under foil and cut into
 * cards. Trays go in at -x; cards come out at +x. The operator side (HMI,
 * glazing) is -z. Place it between MACHINE_POS.blisterStart and blisterEnd
 * with rotation y = -PI / 2.
 *
 * `running` works the sealing and cutting tools. `severity` drives the
 * stack light.
 */
export function BlisterPacker({
  length = DEFAULT_LENGTH,
  running = true,
  severity = 'healthy',
  ...props
}: { length?: number; running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const L = length;
  const H = L / 2;

  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const brand = plastic(PALETTE.brand);
    const pvc = plastic('#eef1f5', 0.2);
    const foil = metal(PALETTE.foil, 0.3);
    const pane = glass();
    const cabW = CAB_OUT - CAB_IN;
    const cabZ = (CAB_IN + CAB_OUT) / 2;

    // Side cabinets with doors and vents, the deck bridging them over the belt.
    for (const sz of [1, -1]) {
      k.box(dark, [L - 0.06, 0.06, cabW - 0.04], [0, 0.03, sz * cabZ], 0.015);
      k.box(white, [L, DECK - 0.06, cabW], [0, DECK / 2 + 0.03, sz * cabZ], 0.05);
      k.box(brand, [L + 0.008, 0.05, cabW + 0.008], [0, DECK - 0.08, sz * cabZ], 0.018);
      for (const sx of [1, -1]) {
        k.box(white, [H - 0.14, 0.6, 0.014], [sx * H / 2, 0.47, sz * (CAB_OUT + 0.003)], 0.012);
        k.box(dark, [0.03, 0.15, 0.034], [sx * H / 2 + (H / 2 - 0.15) * sx, 0.47, sz * (CAB_OUT + 0.02)], 0.012);
      }
      for (let j = 0; j < 4; j++) k.box(dark, [0.32, 0.018, 0.012], [-H + 0.35, 0.28 + j * 0.045, sz * (CAB_OUT + 0.008)], 0.005);
    }
    k.box(steel, [L, 0.07, CAB_OUT * 2], [0, DECK + 0.035, 0], 0.02);
    // Infeed lip over the belt where trays tip into the hopper chute.
    k.box(bright, [0.1, 0.24, CAB_IN * 2 - 0.02], [-H + 0.05, DECK - 0.12, 0], 0.02);

    // PVC reel on its stand at the infeed end.
    const rx = -H + 0.22;
    for (const sz of [1, -1]) k.box(steel, [0.06, 0.62, 0.05], [rx, DECK + 0.38, sz * 0.24], 0.015);
    k.cyl(pvc, 0.27, 0.42, [rx, DECK + 0.62, 0], 'z', 0.03, 0.27, 32);
    k.cyl(dark, 0.07, 0.48, [rx, DECK + 0.62, 0], 'z', 0.015, 0.07, 14);
    // The web: flat off the reel, formed into pockets from the forming
    // station on, then sealed under foil.
    const formX = FORM * H;
    const sealX = SEAL * H;
    k.box(pvc, [formX - rx, 0.006, WEB_W], [(rx + formX) / 2, WEB_Y, 0], 0.002);
    k.box(pvc, [sealX - formX, 0.006, WEB_W], [(formX + sealX) / 2, WEB_Y, 0], 0.002);
    k.box(foil, [H - sealX - 0.02, 0.01, WEB_W], [(sealX + H) / 2 - 0.01, WEB_Y, 0], 0.003);
    const pocket = new THREE.SphereGeometry(0.03, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const tablet = matte(`#${tabletColor(1).getHexString()}`, 0.45);
    for (let x = formX + 0.08; x < H - 0.05; x += 0.075) {
      for (const z of [-0.11, 0, 0.11]) {
        // Pockets point down under the web; the filled ones show a tablet.
        k.add(pvc, pocket.clone(), [x, WEB_Y - 0.003, z], [Math.PI, 0, 0]);
        if (x > FEED * H && x < sealX) k.cyl(tablet, 0.024, 0.012, [x, WEB_Y + 0.008, z], 'y', 0.005, 0.024, 10);
      }
    }
    pocket.dispose();
    // Web guide rails.
    for (const sz of [1, -1]) k.box(steel, [H * 2 - 0.5, 0.03, 0.03], [0.1, WEB_Y + 0.01, sz * (WEB_W / 2 + 0.03)], 0.01);

    // Forming station.
    k.box(steel, [0.26, 0.34, 0.62], [formX, WEB_Y + 0.2, 0], 0.04);
    k.box(brand, [0.266, 0.05, 0.626], [formX, WEB_Y + 0.33, 0], 0.015);
    // Tablet hopper and feeder over the web.
    const fx = FEED * H;
    k.cyl(steel, 0.06, 0.12, [fx, WEB_Y + 0.1, 0], 'y', 0.01, 0.06, 14);
    k.cyl(steel, 0.1, 0.36, [fx, WEB_Y + 0.34, 0], 'y', 0.015, 0.24, 24);
    k.cyl(bright, 0.25, 0.04, [fx, WEB_Y + 0.53, 0], 'y', 0.01, 0.25, 24);
    k.cyl(tablet, 0.22, 0.04, [fx, WEB_Y + 0.5, 0], 'y', 0.02, 0.2, 24);
    k.box(steel, [0.32, 0.05, 0.5], [fx, WEB_Y + 0.05, 0], 0.015);
    // Sealing station frame and the foil reel above it.
    for (const sz of [1, -1]) k.box(steel, [0.08, 0.66, 0.06], [sealX, WEB_Y + 0.33, sz * 0.32], 0.015);
    k.box(steel, [0.3, 0.12, 0.7], [sealX, WEB_Y + 0.62, 0], 0.03);
    k.cyl(foil, 0.2, 0.4, [sealX - 0.05, WEB_Y + 0.88, 0], 'z', 0.02, 0.2, 32);
    k.cyl(dark, 0.06, 0.46, [sealX - 0.05, WEB_Y + 0.88, 0], 'z', 0.012, 0.06, 14);
    k.box(foil, [0.012, 0.36, WEB_W], [sealX - 0.21, WEB_Y + 0.55, 0], 0.003, [0, 0, 0.35]);
    // Cutting station frame.
    const cutX = CUT * H;
    for (const sz of [1, -1]) k.box(steel, [0.07, 0.42, 0.06], [cutX, WEB_Y + 0.21, sz * 0.3], 0.015);
    k.box(steel, [0.2, 0.1, 0.66], [cutX, WEB_Y + 0.44, 0], 0.025);

    // Guard: posts, rails and glass on the operator side, the outfeed end
    // and the roof.
    const pz = GUARD_Z;
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(steel, [0.07, HOOD - DECK, 0.07], [sx * (H - 0.04), (DECK + HOOD) / 2, sz * pz], 0.018);
    for (const sz of [1, -1]) k.box(steel, [L - 0.08, 0.06, 0.06], [0, HOOD - 0.03, sz * pz], 0.015);
    for (const sx of [1, -1]) k.box(steel, [0.06, 0.06, pz * 2], [sx * (H - 0.04), HOOD - 0.03, 0], 0.015);
    k.box(steel, [0.06, HOOD - DECK, 0.06], [0, (DECK + HOOD) / 2, -pz], 0.015);
    for (const sx of [1, -1]) k.add(pane, new THREE.PlaneGeometry(H - 0.1, HOOD - DECK - 0.12), [sx * H / 2, (DECK + HOOD) / 2, -pz]);
    k.add(pane, new THREE.PlaneGeometry(pz * 2 - 0.08, HOOD - DECK - 0.5), [H - 0.04, HOOD - 0.3, 0], [0, Math.PI / 2, 0]);
    k.add(pane, new THREE.PlaneGeometry(L - 0.12, pz * 2 - 0.08), [0, HOOD - 0.01, 0], [-Math.PI / 2, 0, 0]);
    for (const sx of [1, -1]) k.box(dark, [0.03, 0.3, 0.035], [sx * 0.12, 1.5, -pz - 0.035], 0.012);

    // Arm for the HMI on the operator side.
    k.box(steel, [0.06, 0.06, 0.18], [-H + 0.5, 1.42, -CAB_OUT - 0.08], 0.014);
    return k.build();
  }, [L, H]);
  useDispose(pieces);

  // Moving tools: the sealing platen and the cutter, on their own groups.
  const tools = useMemo(() => {
    const seal = new Kit();
    seal.box(metal(PALETTE.steelDark, 0.3), [0.24, 0.16, 0.52], [SEAL * H, WEB_Y + 0.42, 0], 0.03);
    seal.box(plastic(PALETTE.brand), [0.246, 0.04, 0.526], [SEAL * H, WEB_Y + 0.48, 0], 0.012);
    const cut = new Kit();
    cut.box(metal(PALETTE.steelDark, 0.3), [0.14, 0.12, 0.5], [CUT * H, WEB_Y + 0.3, 0], 0.025);
    return { seal: seal.build(), cut: cut.build() };
  }, [H]);
  useDispose(tools.seal);
  useDispose(tools.cut);

  const sealRef = useRef<THREE.Group>(null);
  const cutRef = useRef<THREE.Group>(null);
  const phase = useRef(0);
  useFrame((_, dt) => {
    if (running) phase.current += Math.min(dt, 0.1) * 4.2;
    const p = phase.current;
    if (sealRef.current) sealRef.current.position.y = -0.14 * Math.pow(Math.max(0, Math.sin(p)), 3);
    if (cutRef.current) cutRef.current.position.y = -0.12 * Math.pow(Math.max(0, Math.sin(p + 1.6)), 4);
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={sealRef}>
        <Pieces pieces={tools.seal} />
      </group>
      <group ref={cutRef}>
        <Pieces pieces={tools.cut} />
      </group>
      <ControlBox kind="pack" accent={PALETTE.brand} position={[-H + 0.5, 1.42, -CAB_OUT - 0.24]} rotation={[0, Math.PI, 0]} />
      <Andon severity={severity} position={[H - 0.04, HOOD, -GUARD_Z]} />
    </group>
  );
}

