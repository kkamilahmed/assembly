import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glow, matte, metal, PALETTE, plastic } from '../style';
import { Kit, useDispose } from './kit';
import type { Piece, V3 } from './kit';
import { Pieces } from './Pieces';

/** Shoulder pivot, in the turret's frame. */
const SH_X = 0.14;
const SH_Y = 0.66;
const UPPER = 0.86;
const FORE = 0.84;
/** Wrist pivot to the tip of the tool, straight down. */
const TOOL = 0.3;

function upperArm(): Piece[] {
  const k = new Kit();
  const orange = plastic(PALETTE.orange, 0.3);
  const dark = plastic(PALETTE.graphite);
  const bright = metal(PALETTE.offWhite, 0.2);
  k.box(orange, [0.2, UPPER + 0.06, 0.2], [0, UPPER / 2, -0.04], 0.07);
  // Side plate with a recess, and the joint covers at both ends.
  k.box(orange, [0.16, UPPER - 0.24, 0.03], [0, UPPER / 2, 0.075], 0.012);
  k.cyl(dark, 0.15, 0.1, [0, 0, 0.1], 'z', 0.03);
  k.cyl(bright, 0.09, 0.02, [0, 0, 0.16], 'z', 0.008);
  k.cyl(dark, 0.12, 0.08, [0, UPPER, 0.08], 'z', 0.025);
  k.cyl(bright, 0.07, 0.02, [0, UPPER, 0.13], 'z', 0.006);
  // Cable dress down the back.
  k.tube(dark, [[-0.12, 0.08, -0.04], [-0.14, UPPER * 0.5, -0.04], [-0.12, UPPER - 0.08, -0.04]], 0.022, 0.2);
  return k.build();
}

function foreArm(): Piece[] {
  const k = new Kit();
  const orange = plastic(PALETTE.orange, 0.3);
  const dark = plastic(PALETTE.graphite);
  const white = plastic(PALETTE.white);
  // Elbow housing with the wrist motors behind it as a counterweight.
  k.box(orange, [0.34, 0.24, 0.22], [0.02, 0, -0.06], 0.08);
  k.cyl(dark, 0.09, 0.2, [-0.22, 0, -0.06], 'x', 0.03);
  k.box(orange, [FORE - 0.1, 0.13, 0.15], [FORE / 2 + 0.06, 0, -0.06], 0.055);
  k.box(white, [0.26, 0.06, 0.004], [FORE / 2 + 0.02, 0.01, 0.017], 0.002);
  k.cyl(dark, 0.075, 0.18, [FORE, 0, -0.06], 'z', 0.025);
  return k.build();
}

function wrist(): Piece[] {
  const k = new Kit();
  const dark = plastic(PALETTE.graphite);
  const steel = metal(PALETTE.steel);
  const bright = metal(PALETTE.offWhite, 0.2);
  const blue = plastic(PALETTE.blue);
  k.cyl(steel, 0.06, 0.1, [0, -0.06, -0.06], 'y', 0.02);
  k.cyl(bright, 0.065, 0.02, [0, -0.12, -0.06], 'y', 0.006);
  // End effector: a vacuum gripper plate with four cups.
  k.box(dark, [0.08, 0.08, 0.08], [0, -0.17, -0.06], 0.02);
  k.box(blue, [0.34, 0.03, 0.24], [0, -0.225, -0.06], 0.012);
  for (const sx of [1, -1]) for (const sz of [1, -1]) k.cyl(matte(PALETTE.rubber), 0.028, 0.05, [sx * 0.12, -0.26, -0.06 + sz * 0.08], 'y', 0.01, 0.022, 12);
  return k.build();
}

function turret(): Piece[] {
  const k = new Kit();
  const orange = plastic(PALETTE.orange, 0.3);
  const dark = plastic(PALETTE.graphite);
  k.cyl(orange, 0.25, 0.24, [0, 0.27, 0], 'y', 0.05, 0.22, 28);
  k.box(orange, [0.42, 0.26, 0.34], [0.06, 0.5, -0.02], 0.09);
  k.cyl(dark, 0.08, 0.14, [-0.18, 0.52, -0.02], 'x', 0.025);
  k.box(dark, [0.12, 0.05, 0.2], [-0.04, 0.66, -0.02], 0.02);
  return k.build();
}

function base(): Piece[] {
  const k = new Kit();
  const dark = plastic(PALETTE.graphite);
  const bright = metal(PALETTE.offWhite, 0.2);
  const steel = metal(PALETTE.steel);
  k.box(steel, [0.7, 0.04, 0.7], [0, 0.02, 0], 0.015);
  for (const a of [1, -1]) for (const b of [1, -1]) k.bolt(bright, [a * 0.29, 0.045, b * 0.29], 'y', 0.018);
  k.cyl(dark, 0.3, 0.12, [0, 0.1, 0], 'y', 0.03, 0.28, 30);
  k.cyl(bright, 0.26, 0.02, [0, 0.165, 0], 'y', 0.006, 0.26, 30);
  // Status ring on the turret base.
  k.add(glow(PALETTE.blue, 1.6), new THREE.TorusGeometry(0.262, 0.009, 6, 36), [0, 0.165, 0], [Math.PI / 2, 0, 0]);
  return k.build();
}

export interface ArmMove {
  /** Where the tool tip picks, in the arm's frame. */
  pick: V3;
  /** Where it places. */
  place: V3;
  /** Height the tool travels at between them. */
  clear?: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Tool-tip target for phase u in [0, 1): hover, descend and grip at the
 *  pick point, swing over to the place point, descend and release, swing
 *  back. Swings interpolate around the base (yaw and reach), so the arm
 *  never passes through its own column. */
function targetAt(u: number, move: ArmMove, out: { yaw: number; r: number; y: number; held: boolean }) {
  const [px, py, pz] = move.pick;
  const [qx, qy, qz] = move.place;
  const clear = move.clear ?? Math.max(py, qy) + 0.3;
  const a = { yaw: Math.atan2(-pz, px), r: Math.hypot(px, pz) };
  const b = { yaw: Math.atan2(-qz, qx), r: Math.hypot(qx, qz) };
  // Shortest way round between the two yaws.
  let dyaw = b.yaw - a.yaw;
  if (dyaw > Math.PI) dyaw -= Math.PI * 2;
  if (dyaw < -Math.PI) dyaw += Math.PI * 2;
  const phases: Array<[number, (k: number) => void]> = [
    [0.12, (k) => Object.assign(out, { yaw: a.yaw, r: a.r, y: clear + (py - clear) * smooth(k), held: false })],
    [0.06, () => Object.assign(out, { yaw: a.yaw, r: a.r, y: py, held: true })],
    [0.1, (k) => Object.assign(out, { yaw: a.yaw, r: a.r, y: py + (clear - py) * smooth(k), held: true })],
    [0.2, (k) => Object.assign(out, { yaw: a.yaw + dyaw * smooth(k), r: a.r + (b.r - a.r) * smooth(k), y: clear, held: true })],
    [0.12, (k) => Object.assign(out, { yaw: b.yaw, r: b.r, y: clear + (qy - clear) * smooth(k), held: true })],
    [0.06, () => Object.assign(out, { yaw: b.yaw, r: b.r, y: qy, held: false })],
    [0.1, (k) => Object.assign(out, { yaw: b.yaw, r: b.r, y: qy + (clear - qy) * smooth(k), held: false })],
    [0.24, (k) => Object.assign(out, { yaw: b.yaw - dyaw * smooth(k), r: b.r + (a.r - b.r) * smooth(k), y: clear, held: false })],
  ];
  let t = u;
  for (const [len, fn] of phases) {
    if (t <= len) return fn(t / len);
    t -= len;
  }
  phases[phases.length - 1][1](1);
}

/**
 * Six-axis industrial robot in the plant's orange, standing on a bolted
 * plate. Origin on the floor at the centre of its base. It loops a pick and
 * place: picks at `move.pick`, places at `move.place` (both tool-tip points
 * in its own frame), with `held` drawn hanging under the gripper while it
 * carries. A two-link solver keeps the gripper level over the work. Stops
 * mid-move when `running` goes false.
 */
export function RobotArm({
  move,
  period = 3.2,
  phase = 0,
  running = true,
  held,
  ...props
}: { move: ArmMove; period?: number; phase?: number; running?: boolean; held?: ReactNode } & ThreeElements['group']) {
  const parts = useMemo(() => ({ base: base(), turret: turret(), upper: upperArm(), fore: foreArm(), wrist: wrist() }), []);
  useDispose(parts.base);
  useDispose(parts.turret);
  useDispose(parts.upper);
  useDispose(parts.fore);
  useDispose(parts.wrist);

  const j1 = useRef<THREE.Group>(null);
  const j2 = useRef<THREE.Group>(null);
  const j3 = useRef<THREE.Group>(null);
  const j5 = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const clock = useRef(phase * period);
  const target = useMemo(() => ({ yaw: 0, r: 1, y: 1, held: false }), []);

  useFrame((_, dt) => {
    if (!j1.current || !j2.current || !j3.current || !j5.current) return;
    if (running) clock.current += Math.min(dt, 0.1);
    targetAt((clock.current / period) % 1, move, target);
    // Wrist point, in the shoulder's vertical plane.
    const dx = target.r - SH_X;
    const dy = target.y + TOOL - SH_Y;
    const d = Math.min(Math.hypot(dx, dy), (UPPER + FORE) * 0.999);
    const phi = Math.atan2(dy, dx);
    const alpha = Math.acos(THREE.MathUtils.clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1));
    const a2 = phi + alpha - Math.PI / 2;
    const ex = -Math.sin(a2) * UPPER;
    const ey = Math.cos(a2) * UPPER;
    const wx = Math.cos(phi) * d;
    const wy = Math.sin(phi) * d;
    const a23 = Math.atan2(wy - ey, wx - ex);
    j1.current.rotation.y = target.yaw;
    j2.current.rotation.z = a2;
    j3.current.rotation.z = a23 - a2;
    j5.current.rotation.z = -a23;
    if (load.current) load.current.visible = target.held;
  });

  return (
    <group {...props}>
      <Pieces pieces={parts.base} />
      <group ref={j1}>
        <Pieces pieces={parts.turret} />
        <group ref={j2} position={[SH_X, SH_Y, 0]}>
          <Pieces pieces={parts.upper} />
          <group ref={j3} position={[0, UPPER, 0]}>
            <Pieces pieces={parts.fore} />
            <group ref={j5} position={[FORE, 0, 0]}>
              <Pieces pieces={parts.wrist} />
              {held && (
                <group ref={load} position={[0, -TOOL, -0.06]}>
                  {held}
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
