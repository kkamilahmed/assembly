import { useMemo } from 'react';
import * as THREE from 'three';
import { WORK_MS } from '@/streaming/lineConfig';
import { CAR_HEIGHT, CAR_LENGTH, CAR_WIDTH, ROBOT_Z, SNAP_TRANSITION_MS } from './constants';
import { fitObject3D, useFerrariModel } from './models';
import { smoothstep } from './ik';

// This file is the single source of truth for *where* each station reaches
// and *when* each beat of its choreography fires. Both RobotArm (the reach)
// and CarShell (the reaction — body reveal, paint colour, wheel visibility)
// read the same phase functions here, so the two can never disagree about
// timing: a wheel flips visible the instant the arm's mount pulse peaks, the
// body reveals the instant the arm reaches the placement point, the paint
// colour fills in lockstep with the sweep.
//
// Two coordinate frames are used:
//   carFrame  — axis-aligned with the world, origin at the docked car's group
//               (x along the line/length, y up from the group, z across the
//               width; −z is the near side, toward the robot at ROBOT_Z).
//   robotLocal — origin at a robot's ground pivot ([ROBOT_X, 0, ROBOT_Z]); the
//               frame solveTwoBoneIK takes its target in.
// A car docked at station i sits at world x = ROBOT_X[i], z = 0, so a carFrame
// point (x,y,z) maps to robotLocal (x, carGroupY + y, z − ROBOT_Z) for the
// matching robot — the carFrame.x term cancels because the car is at this
// robot's own station x. (During the 800ms glide-in the car is still moving,
// but the reach only ramps up after SNAP_TRANSITION_MS, by which point it's
// settled; the minor inaccuracy during the ramp is invisible.) `carGroupY` is
// always CONVEYOR_Y — every car rides at the same height for its whole time
// on the line, wheels or not.

// ---- car-frame target geometry (metres) ----
// Near-side (toward the robot) weld seam points one side-mounted arm can
// plausibly reach — a deliberate reduction from "4 arms split the car".
export const WELD_SEAM_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(-0.6, 0.55, -CAR_WIDTH / 2), // near-side door seam, low
  new THREE.Vector3(0.1, 1.05, -CAR_WIDTH / 2), // near-side B-pillar / roofline
  new THREE.Vector3(0.8, 0.6, -CAR_WIDTH / 2), // near-side rear quarter
];

// Paint sweeps front-to-back along the roof line, centred across the car.
export const PAINT_SWEEP_FRONT = new THREE.Vector3(-CAR_LENGTH / 2 + 0.3, CAR_HEIGHT * 0.85, 0);
export const PAINT_SWEEP_REAR = new THREE.Vector3(CAR_LENGTH / 2 - 0.3, CAR_HEIGHT * 0.85, 0);

// Where the panel arm lowers the shell onto the chassis — body-centre, just
// above the eventual ride height.
export const PANEL_PLACEMENT = new THREE.Vector3(0, CAR_HEIGHT * 0.8, 0);

// ---- robot-local prop positions (rack / wheel stack) ----
// Placed clear of both the car path (z=0) and the robot pedestal, behind the
// arm (negative robotLocal z = further from the car than the pedestal).
export const PANEL_RACK_PICK = new THREE.Vector3(0.4, 1.2, -1.5);
export const WHEEL_STACK_PICK = new THREE.Vector3(0.4, 0.7, -1.5);

// ---- timing: per-station phase schedules (all in ms since dockedAt) ----
// Each fits comfortably inside WORK_MS[station] with margin under
// STATION_CYCLE_MS, and starts after SNAP_TRANSITION_MS so the car has
// glided to its slot before any station reaches for it.

const PAINT_WORK = WORK_MS['PAINT-01'];

/** Paint sweep front→rear, 0..1, with short ramps at each end. */
export function paintSweepProgress(elapsed: number): number {
  const start = SNAP_TRANSITION_MS + 200;
  const end = PAINT_WORK - 300;
  if (elapsed < start) return 0;
  if (elapsed > end) return 1;
  return smoothstep((elapsed - start) / (end - start));
}

export interface WeldDartPhase {
  /** Which seam point this dart targets (−1 while retracting / pre-reach). */
  pointIndex: number;
  /** 0..1 blend from the previous seam point toward this one (1 = arrived). */
  arrive: number;
  /** Triangle pulse at the seam (1 at peak while sparking), 0 while moving. */
  pulse: number;
}

const WELD_DART_START = SNAP_TRANSITION_MS + 200;
const WELD_DART_SPACING = 850;
const WELD_DART_REACH = 250;
const WELD_DART_HOLD = 350;

/** Weld = 3 darts to fixed seam points. Each dart: reach (smoothstep) then
 *  hold with a triangle spark pulse, then move to the next. */
export function weldDartPhase(elapsed: number): WeldDartPhase {
  if (elapsed < WELD_DART_START) return { pointIndex: 0, arrive: 0, pulse: 0 };
  const into = elapsed - WELD_DART_START;
  const dartIndex = Math.floor(into / WELD_DART_SPACING);
  const intoDart = into - dartIndex * WELD_DART_SPACING;
  if (dartIndex >= WELD_SEAM_POINTS.length) {
    // Retract to rest.
    return { pointIndex: -1, arrive: 0, pulse: 0 };
  }
  if (intoDart < WELD_DART_REACH) {
    // Glide from the previous point (or rest) to this seam point.
    const t = smoothstep(intoDart / WELD_DART_REACH);
    return { pointIndex: dartIndex, arrive: dartIndex === 0 ? t : 1, pulse: 0 };
  }
  if (intoDart < WELD_DART_REACH + WELD_DART_HOLD) {
    // Hold on the seam and fire the spark pulse.
    const holdT = (intoDart - WELD_DART_REACH) / WELD_DART_HOLD;
    const pulse = Math.sin(holdT * Math.PI);
    return { pointIndex: dartIndex, arrive: 1, pulse };
  }
  // Tail of this dart before the next begins — hold position, spark fading.
  const pulse = Math.max(0, 1 - (intoDart - WELD_DART_REACH - WELD_DART_HOLD) / 100);
  return { pointIndex: dartIndex, arrive: 1, pulse };
}

export interface WheelMountPhase {
  /** True for the single reach→grip→carry→mount pass each dwell. All four
   *  wheel machines (one per corner — see WHEEL_CORNER_MIRRORED below) run
   *  this exact same elapsed-driven schedule, so all 4 wheels land at the
   *  same instant. */
  active: boolean;
  /** 0..1 through that pass (0 = start of reach to stack). */
  cycleT: number;
  /** Mount pulse at the hub (1 = wheels just mounted). */
  mountPulse: number;
}

const WHEEL_CYCLE_START = SNAP_TRANSITION_MS + 100;
export const WHEEL_CYCLE_MS = 700;
export const WHEEL_REACH = 300;
export const WHEEL_GRIP = 100;
export const WHEEL_CARRY = 200;
const WHEEL_MOUNT = 100;

/** Each machine's wheel-mount choreography: one reach-to-stack → grip →
 *  carry-to-hub → mount-pulse pass for its own single wheel. All four
 *  machines call this with the same `elapsed`, so their passes stay in
 *  lockstep — all 4 wheels mounting simultaneously. */
export function wheelMountPhase(elapsed: number): WheelMountPhase {
  if (elapsed < WHEEL_CYCLE_START) return { active: false, cycleT: 0, mountPulse: 0 };
  const into = elapsed - WHEEL_CYCLE_START;
  if (into >= WHEEL_CYCLE_MS) return { active: false, cycleT: 1, mountPulse: 0 };
  const cycleT = into / WHEEL_CYCLE_MS;
  let mountPulse = 0;
  if (into > WHEEL_REACH + WHEEL_GRIP + WHEEL_CARRY) {
    const mountT = (into - WHEEL_REACH - WHEEL_GRIP - WHEEL_CARRY) / WHEEL_MOUNT;
    mountPulse = Math.sin(THREE.MathUtils.clamp(mountT, 0, 1) * Math.PI);
  }
  return { active: true, cycleT, mountPulse };
}

export type PanelPhaseName = 'idle' | 'reach' | 'grip' | 'carry' | 'reveal' | 'retract';
export interface PanelPhaseState {
  phase: PanelPhaseName;
  /** 0..1 body-shell reveal (scale), ramps during the reveal beat. */
  reveal: number;
  /** True while a shell is gripped and riding the tool (carry + reveal). */
  holding: boolean;
}

const PANEL_REACH_START = SNAP_TRANSITION_MS + 100;
const PANEL_REACH = 500;
const PANEL_GRIP = 150;
const PANEL_CARRY = 650;
const PANEL_REVEAL = 600;

/** Panel = reach to rack → grip → carry+lower to placement → reveal (body
 *  pops to full scale) → retract. */
export function panelPhase(elapsed: number): PanelPhaseState {
  if (elapsed < PANEL_REACH_START) return { phase: 'idle', reveal: 0, holding: false };
  const into = elapsed - PANEL_REACH_START;
  if (into < PANEL_REACH) return { phase: 'reach', reveal: 0, holding: false };
  if (into < PANEL_REACH + PANEL_GRIP) return { phase: 'grip', reveal: 0, holding: true };
  if (into < PANEL_REACH + PANEL_GRIP + PANEL_CARRY) {
    return { phase: 'carry', reveal: 0, holding: true };
  }
  if (into < PANEL_REACH + PANEL_GRIP + PANEL_CARRY + PANEL_REVEAL) {
    const reveal = smoothstep((into - PANEL_REACH - PANEL_GRIP - PANEL_CARRY) / PANEL_REVEAL);
    return { phase: 'reveal', reveal, holding: reveal < 0.9 };
  }
  return { phase: 'retract', reveal: 1, holding: false };
}

// ---- frame conversion + wheel hub offsets ----

/** Convert a carFrame point to robotLocal for the robot whose station this
 *  car is docked at, given the car group's current world Y. `mirrored` is
 *  for a far-side machine: it sits at world z = −ROBOT_Z, rotated 180° about
 *  Y to face the car, so a carFrame point maps into its local frame with
 *  both x and z negated (the inverse of that rotation) instead of a near
 *  machine's plain z − ROBOT_Z.
 *
 *  `xOffset` is for a machine whose own ground pivot isn't at the station's
 *  nominal x — the Wheel station's four machines each stand shifted toward
 *  their own corner's hub (RobotArm.tsx), not centred on the car. Once the
 *  pivot itself moves by `xOffset`, "the carFrame.x term cancels" (see the
 *  module doc above) no longer holds on its own; subtracting it first
 *  restores the same cancellation relative to the shifted pivot. Every
 *  other caller leaves it at 0 (pivot == station x, as before). */
export function carFrameToRobotLocal(
  p: THREE.Vector3,
  carGroupY: number,
  mirrored = false,
  xOffset = 0,
): THREE.Vector3 {
  const localX = p.x - xOffset;
  if (mirrored) return new THREE.Vector3(-localX, carGroupY + p.y, -p.z - ROBOT_Z);
  return new THREE.Vector3(localX, carGroupY + p.y, p.z - ROBOT_Z);
}

const WHEEL_NAMES = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] as const;
export type WheelName = (typeof WHEEL_NAMES)[number];

/** Which side of the car each wheel corner's own machine stands on — left
 *  wheels (fl/rl) get a near, non-mirrored machine at world z = ROBOT_Z;
 *  right wheels (fr/rr) get a far, mirrored one at z = −ROBOT_Z. Four
 *  machines now, one per corner (RobotArm.tsx's `wheelCorner` prop), each
 *  shifted toward its own hub along x (see carFrameToRobotLocal's xOffset)
 *  in addition to the near/far split in z. */
export const WHEEL_CORNER_MIRRORED: Record<WheelName, boolean> = {
  wheel_fl: false,
  wheel_rl: false,
  wheel_fr: true,
  wheel_rr: true,
};

let hubCache: { value: Partial<Record<WheelName, THREE.Vector3>> | null } = { value: null };

/** Each wheel's carFrame offset (x along length, y up, z across), read once
 *  from the model and cached at module scope — every car instance shares
 *  identical offsets (the GLB's node transforms are identical). */
export function useWheelHubOffsets(): Partial<Record<WheelName, THREE.Vector3>> {
  const gltf = useFerrariModel();
  if (hubCache.value) return hubCache.value;
  const root = gltf.scene.clone(true);
  root.rotation.y = -Math.PI / 2;
  // Must match CarShell.tsx's centered fit exactly, or wheel hub offsets
  // (read from this same model) won't line up with where the body actually
  // renders.
  const fit = fitObject3D(root, { axis: 'x', size: CAR_LENGTH });
  root.scale.setScalar(fit.scale);
  root.position.set(fit.position[0], fit.position[1], fit.position[2]);
  root.updateMatrixWorld(true);
  const origin = new THREE.Vector3(fit.position[0], fit.position[1], fit.position[2]);
  const v = new THREE.Vector3();
  const off: Partial<Record<WheelName, THREE.Vector3>> = {};
  for (const name of WHEEL_NAMES) {
    const o = root.getObjectByName(name);
    if (!o) continue;
    o.getWorldPosition(v);
    off[name] = new THREE.Vector3().subVectors(v, origin);
  }
  hubCache.value = off;
  return off;
}

let wheelPropTemplate: { value: THREE.Object3D | null | undefined } = { value: undefined };

/** A detached template of one real wheel — its rim/tire/brake-disc/lug-nut
 *  meshes and materials, straight off the same GLB the car itself mounts —
 *  at the real-world scale the car body is fitted to, built once and cached
 *  at module scope. Never added to the scene graph itself (an Object3D can
 *  only live in one place at a time); every caller clones it. Uses the
 *  node's own authored rotation (which already stands it upright on its
 *  tread) rather than the whole-car −90°-Y line-alignment rotation, which
 *  only matters for aligning the car's length and is irrelevant to a
 *  freestanding prop. */
function getWheelPropTemplate(gltf: ReturnType<typeof useFerrariModel>): THREE.Object3D | null {
  if (wheelPropTemplate.value !== undefined) return wheelPropTemplate.value;
  const wheelSource = gltf.scene.getObjectByName('wheel_fl');
  if (!wheelSource) {
    wheelPropTemplate.value = null;
    return null;
  }
  // Same fit the whole car body is scaled to (see useWheelHubOffsets above)
  // so a standalone prop reads at the exact size it'll be once mounted.
  const probe = gltf.scene.clone(true);
  probe.rotation.y = -Math.PI / 2;
  const fit = fitObject3D(probe, { axis: 'x', size: CAR_LENGTH });
  const clone = wheelSource.clone(true);
  clone.position.set(0, 0, 0);
  clone.scale.setScalar(fit.scale);
  clone.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  wheelPropTemplate.value = clone;
  return clone;
}

/** A fresh clone of a real wheel — the same rim/tire/brake-disc/lug-nut
 *  meshes and materials the car itself gets mounted with — for standalone
 *  props (the Wheel station's rack, the wheel riding the gripper during
 *  carry). Every call returns its own clone; an Object3D can't be shared
 *  across multiple places in the scene graph at once. */
export function useWheelPropModel(): THREE.Object3D | null {
  const gltf = useFerrariModel();
  return useMemo(() => {
    const template = getWheelPropTemplate(gltf);
    return template ? template.clone(true) : null;
  }, [gltf]);
}

const WHEEL_ORDER: WheelName[] = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
export { WHEEL_ORDER };

/** True once the mount pulse has crossed its hand-off threshold. All 4
 *  wheels share this one phase (see wheelMountPhase), so they all cross it
 *  on the same frame — CarShell only ever acts on `true` (it never re-hides
 *  a wheel), so a live, non-latched comparison here is fine. */
export function isWheelMounted(phase: WheelMountPhase): boolean {
  return phase.mountPulse > 0.5;
}