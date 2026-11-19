// The two robot stations on the line. Each is the orange arm, the table it
// picks from, its operator panel and stack light; the arm reaches over the
// belt and drops its part onto every module that passes.
//
// Local frame for both: origin on the floor at the robot's base, belt
// running past at local x = `reach` along the z axis, belt top at BELT_Y.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { MODULE_INTERVAL_MS } from '@/streaming/lineConfig';
import { BELT_Y } from '../layout';
import { MODULE, moduleCaseGeometry, moduleMaterial } from '../props/module';
import { matte, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { Kit, useDispose } from './kit';
import type { Severity, V3 } from './kit';
import { Pieces } from './Pieces';
import { RobotArm } from './RobotArm';

/** One pick and place for every second module. */
const PERIOD = (MODULE_INTERVAL_MS / 1000) * 4;
const TABLE_Y = 0.74;

/** Steel pick table on four legs, top at TABLE_Y, with a guide fence. */
function table(k: Kit, at: V3, size: [number, number]) {
  const steel = metal(PALETTE.steel);
  const dark = plastic(PALETTE.graphite);
  const [x, , z] = at;
  const [w, d] = size;
  k.box(steel, [w, 0.04, d], [x, TABLE_Y - 0.02, z], 0.012);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      k.box(steel, [0.05, TABLE_Y - 0.04, 0.05], [x + sx * (w / 2 - 0.05), (TABLE_Y - 0.04) / 2, z + sz * (d / 2 - 0.05)], 0.012);
      k.cyl(dark, 0.045, 0.03, [x + sx * (w / 2 - 0.05), 0.015, z + sz * (d / 2 - 0.05)], 'y', 0.008);
    }
  }
  k.box(steel, [w - 0.1, 0.04, 0.04], [x, 0.18, z], 0.01);
  k.box(plastic(PALETTE.blue), [0.03, 0.12, d - 0.1], [x - w / 2 + 0.04, TABLE_Y + 0.06, z], 0.008);
}

/** Panel on a post, beside the robot's base, facing +z. */
function panelPost(k: Kit, x: number, z: number) {
  k.box(metal(PALETTE.steel), [0.08, 1.2, 0.08], [x, 0.6, z], 0.02);
  k.box(plastic(PALETTE.graphite), [0.24, 0.04, 0.24], [x, 0.02, z], 0.01);
}

// ---------------------------------------------------------- cell stacker

const HOLDER: [number, number, number] = [0.42, 0.016, 0.6];
/** The holder magazine, beside and behind the robot. */
const STACK_PICK: V3 = [0.2, 0, -1.15];

/**
 * Station 2, the cell stacker: picks a cell holder off the magazine and
 * presses it down over the cells in each carrier, locking them into a
 * stack. Place at MACHINE_POS.stackRobot, unrotated, with the belt at +x.
 */
export function CellStacker({
  reach = 1.35,
  running = true,
  severity = 'healthy',
  ...props
}: { reach?: number; running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pickAt = STACK_PICK;
  const stackTop = TABLE_Y + 0.22;
  const pieces = useMemo(() => {
    const k = new Kit();
    table(k, pickAt, [0.62, 0.84]);
    // Magazine of holders: a neat stack between four guide posts.
    const holder = plastic('#eef0f3', 0.4);
    for (let i = 0; i < 12; i++) k.box(holder, HOLDER, [pickAt[0], TABLE_Y + 0.012 + i * 0.018, pickAt[2]], 0.005);
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(metal(PALETTE.offWhite, 0.2), [0.025, 0.36, 0.025], [pickAt[0] + sx * 0.24, TABLE_Y + 0.18, pickAt[2] + sz * 0.33], 0.008);
    panelPost(k, -0.55, 0.62);
    return k.build();
  }, [pickAt]);
  useDispose(pieces);

  const held = useMemo(() => {
    const k = new Kit();
    k.box(plastic('#eef0f3', 0.4), HOLDER, [0, -0.008, 0], 0.005);
    return k.build();
  }, []);
  useDispose(held);

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <RobotArm
        move={{ pick: [pickAt[0], stackTop, pickAt[2]], place: [reach, BELT_Y + MODULE.openTop - 0.02, 0], clear: BELT_Y + 0.75 }}
        period={PERIOD}
        running={running}
        held={<Pieces pieces={held} />}
      />
      <ControlBox kind="hmi" width={0.42} height={0.46} position={[-0.55, 1.36, 0.71]} />
      <Andon severity={severity} position={[-0.55, 1.62, 0.62]} />
    </group>
  );
}

// -------------------------------------------------------- module casing

/** The stack of empty cases, beside the robot. */
const CASE_PICK: V3 = [-0.2, 0, 1.15];
const CASE_LAYERS = 3;

/**
 * Station 4, module casing: lifts an aluminium case off the stack and lowers
 * it over each welded module. Place at MACHINE_POS.casingRobot, turned
 * with rotation y = PI so the belt is at its +x.
 */
export function CasingStation({
  reach = 1.4,
  running = true,
  severity = 'healthy',
  ...props
}: { reach?: number; running?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pickAt = CASE_PICK;
  const layers = CASE_LAYERS;
  const pieces = useMemo(() => {
    const k = new Kit();
    table(k, pickAt, [0.66, 0.86]);
    panelPost(k, -0.65, -0.6);
    // Adhesive dispenser beside the table, feeding the casing robot.
    const white = plastic(PALETTE.white);
    k.box(white, [0.34, 0.9, 0.34], [0.5, 0.45, 1.25], 0.05);
    k.box(plastic(PALETTE.orange, 0.3), [0.344, 0.06, 0.344], [0.5, 0.86, 1.25], 0.015);
    k.cyl(matte(PALETTE.rubber), 0.1, 0.24, [0.5, 1.03, 1.25], 'y', 0.02);
    return k.build();
  }, [pickAt]);
  useDispose(pieces);

  const stack = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    for (let i = 0; i < layers; i++) out.push(new THREE.Matrix4().compose(new THREE.Vector3(pickAt[0], TABLE_Y + i * (MODULE.casedTop + 0.004), pickAt[2]), q, new THREE.Vector3(1, 1, 1)));
    return out;
  }, [pickAt, layers]);

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      {stack.map((m, i) => (
        <mesh key={i} geometry={moduleCaseGeometry()} material={moduleMaterial()} matrix={m} matrixAutoUpdate={false} castShadow receiveShadow />
      ))}
      <RobotArm
        move={{
          pick: [pickAt[0], TABLE_Y + layers * (MODULE.casedTop + 0.004), pickAt[2]],
          place: [reach, BELT_Y + MODULE.casedTop + 0.01, 0],
          clear: BELT_Y + 0.95,
        }}
        period={PERIOD}
        phase={0.5}
        running={running}
        held={<mesh geometry={moduleCaseGeometry()} material={moduleMaterial()} position-y={-MODULE.casedTop} rotation-y={Math.PI / 2} castShadow />}
      />
      <ControlBox kind="hmi" width={0.42} height={0.46} position={[-0.65, 1.36, -0.69]} rotation={[0, Math.PI, 0]} />
      <Andon severity={severity} position={[-0.65, 1.62, -0.6]} />
    </group>
  );
}
