import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { BELT_Y } from '../layout';
import { MODULE, moduleCaseGeometry, moduleMaterial } from '../props/module';
import { matte, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

/** The belt ends at x = -0.5; the roller table runs on to X1. */
const X0 = -0.6;
const X1 = 0.6;
const ROLL_Y = BELT_Y;
/** Gantry: posts at +-POST_X, beams along z from Z0 to Z1, at BEAM_Y. */
const POST_X = 0.62;
const Z0 = -0.7;
const Z1 = 2.35;
const BEAM_Y = 2.15;
/** The dock stand across the aisle on +z, where the gantry sets each module
 *  down for an AGV to collect. */
export const AGV_DOCK_Z = 1.55;
/** Top of the dock stand's rollers: an AGV's deck height. */
const DECK_Y = 0.42;
const CYCLE = 4.8;

const smooth = (k: number) => k * k * (3 - 2 * k);

/**
 * AGV transfer, the end of the line: modules that passed run off the belt
 * onto a short roller table, and an overhead gantry lifts each one across
 * the aisle and down onto the dock stand an AGV collects from. Local frame: origin on the floor at
 * the end of the roller table's centre, belt arriving along +x at BELT_Y and
 * ending at x = -0.5; the dock stand is at z = AGV_DOCK_Z, and an AGV
 * collecting from it stops on its -x side. Place it at
 * MACHINE_POS.transfer, unrotated.
 *
 * `running` moves the gantry. `severity` drives the stack light.
 */
export function TransferStation({
  running = true,
  severity = 'healthy',
  ...props
}: { running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const orange = plastic(PALETTE.orange, 0.3);
    const rubber = matte(PALETTE.rubber);

    // Roller table on legs.
    for (const sz of [1, -1]) {
      k.box(steel, [X1 - X0, 0.1, 0.06], [(X0 + X1) / 2, ROLL_Y - 0.06, sz * 0.5], 0.02);
      for (const x of [X0 + 0.1, X1 - 0.1]) k.box(steel, [0.07, ROLL_Y - 0.1, 0.07], [x, (ROLL_Y - 0.1) / 2, sz * 0.48], 0.018);
    }
    for (let i = 0; i < 9; i++) k.cyl(bright, 0.035, 0.96, [X0 + 0.08 + i * 0.13, ROLL_Y - 0.035, 0], 'z', 0.008, 0.035, 14);
    k.box(dark, [0.06, 0.16, 1.0], [X1 + 0.02, ROLL_Y + 0.04, 0], 0.02);

    // Gantry: four posts, two beams along z, a cross tie at each end.
    for (const sx of [1, -1]) {
      for (const z of [Z0, Z1]) {
        k.box(orange, [0.12, BEAM_Y, 0.12], [sx * POST_X, BEAM_Y / 2, z], 0.03);
        k.box(steel, [0.26, 0.02, 0.26], [sx * POST_X, 0.01, z], 0.006);
      }
      k.box(orange, [0.14, 0.16, Z1 - Z0 + 0.12], [sx * POST_X, BEAM_Y, (Z0 + Z1) / 2], 0.03);
      k.box(dark, [0.06, 0.04, Z1 - Z0 - 0.1], [sx * (POST_X - 0.08), BEAM_Y + 0.02, (Z0 + Z1) / 2], 0.01);
    }
    for (const z of [Z0, Z1]) k.box(orange, [POST_X * 2 + 0.12, 0.12, 0.12], [0, BEAM_Y, z], 0.03);
    // Dock stand: a low roller table the AGV backs up to.
    for (const sx of [1, -1]) {
      k.box(steel, [0.8, 0.06, 0.05], [0, DECK_Y - 0.05, AGV_DOCK_Z + sx * 0.3], 0.015);
      for (const x of [-0.34, 0.34]) k.box(steel, [0.05, DECK_Y - 0.08, 0.05], [x, (DECK_Y - 0.08) / 2, AGV_DOCK_Z + sx * 0.3], 0.012);
    }
    for (let i = 0; i < 6; i++) k.cyl(bright, 0.03, 0.62, [-0.32 + i * 0.128, DECK_Y - 0.03, AGV_DOCK_Z], 'z', 0.008, 0.03, 12);
    k.box(plastic(PALETTE.amber), [0.06, 0.14, 0.62], [-0.43, DECK_Y - 0.02, AGV_DOCK_Z], 0.02);
    k.box(dark, [0.08, 0.6, 0.08], [POST_X + 0.25, 0.3, Z1 - 0.2], 0.02);
    k.box(plastic(PALETTE.blue), [0.12, 0.1, 0.1], [POST_X + 0.25, 0.62, Z1 - 0.2], 0.02);
    k.box(rubber, [0.2, 0.02, 0.2], [POST_X + 0.25, 0.01, Z1 - 0.2], 0.006);
    return k.build();
  }, []);
  useDispose(pieces);

  const carriage = useMemo(() => {
    const k = new Kit();
    const white = plastic(PALETTE.white);
    const dark = plastic(PALETTE.graphite);
    k.box(white, [POST_X * 2 + 0.06, 0.16, 0.26], [0, BEAM_Y - 0.12, 0], 0.04);
    k.box(plastic(PALETTE.orange, 0.3), [POST_X * 2 + 0.068, 0.04, 0.268], [0, BEAM_Y - 0.12, 0], 0.012);
    k.box(dark, [0.16, 0.2, 0.16], [0, BEAM_Y - 0.3, 0], 0.03);
    // Telescoping sleeve the gripper rod slides in.
    k.cyl(metal(PALETTE.steel), 0.045, 0.5, [0, BEAM_Y - 0.65, 0], 'y', 0.01, 0.045, 14);
    return k.build();
  }, []);
  useDispose(carriage);
  const gripper = useMemo(() => {
    const k = new Kit();
    const dark = plastic(PALETTE.graphite);
    k.cyl(metal(PALETTE.offWhite, 0.18), 0.03, 0.6, [0, 0.3, 0], 'y', 0.008, 0.03, 10);
    k.box(plastic(PALETTE.blue), [0.7, 0.05, 0.5], [0, 0.025, 0], 0.015);
    for (const sx of [1, -1]) k.box(dark, [0.04, 0.2, 0.42], [sx * (MODULE.l / 2 + 0.04), -0.08, 0], 0.012);
    return k.build();
  }, []);
  useDispose(gripper);

  const carriageRef = useRef<THREE.Group>(null);
  const gripRef = useRef<THREE.Group>(null);
  const loadRef = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (running) clock.current += Math.min(dt, 0.1);
    const u = (clock.current / CYCLE) % 1;
    // Over the table: down, grip, up; across; down onto the dock stand,
    // release, up; back. Each step: [end of step, z from, z to, y from,
    // y to, holding].
    const pickY = ROLL_Y + MODULE.casedTop;
    const dropY = DECK_Y + MODULE.casedTop;
    const topY = 1.45;
    const D = AGV_DOCK_Z;
    const steps: Array<[number, number, number, number, number, boolean]> = [
      [0.12, 0, 0, topY, pickY, false],
      [0.18, 0, 0, pickY, pickY, true],
      [0.3, 0, 0, pickY, topY, true],
      [0.5, 0, D, topY, topY, true],
      [0.64, D, D, topY, dropY, true],
      [0.7, D, D, dropY, dropY, false],
      [0.82, D, D, dropY, topY, false],
      [1, D, 0, topY, topY, false],
    ];
    let start = 0;
    let z = 0;
    let y = topY;
    let held = false;
    for (const [end, z0, z1, y0, y1, hold] of steps) {
      if (u <= end) {
        const k = smooth((u - start) / (end - start));
        z = z0 + (z1 - z0) * k;
        y = y0 + (y1 - y0) * k;
        held = hold;
        break;
      }
      start = end;
    }
    if (carriageRef.current) carriageRef.current.position.z = z;
    if (gripRef.current) gripRef.current.position.y = y;
    if (loadRef.current) loadRef.current.visible = held;
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      {/* The module waiting on the dock stand for the next AGV. */}
      <mesh geometry={moduleCaseGeometry()} material={moduleMaterial()} position={[0, DECK_Y, AGV_DOCK_Z]} castShadow receiveShadow />
      <group ref={carriageRef}>
        <Pieces pieces={carriage} />
        <group ref={gripRef}>
          <Pieces pieces={gripper} />
          <mesh ref={loadRef} geometry={moduleCaseGeometry()} material={moduleMaterial()} position-y={-MODULE.casedTop} castShadow receiveShadow />
        </group>
      </group>
      <ControlBox kind="hmi" width={0.44} height={0.48} position={[POST_X + 0.1, 1.35, Z0]} rotation={[0, Math.PI / 2, 0]} />
      <Andon severity={severity} position={[POST_X, BEAM_Y + 0.08, Z0]} />
    </group>
  );
}
