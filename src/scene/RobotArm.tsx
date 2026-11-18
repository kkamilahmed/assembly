import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { machineSeverity, useStore } from '@/state/store';
import { ROBOT_IDS, WORK_MS, type RobotId } from '@/streaming/lineConfig';
import { COLORS, CONVEYOR_Y, ROBOT_X, ROBOT_Z, SHOULDER_Y, SNAP_TRANSITION_MS, STATUS_COLOR } from './constants';
import { solveTwoBoneIK, smoothstep } from './ik';
import {
  carFrameToRobotLocal,
  PANEL_PLACEMENT,
  PANEL_RACK_PICK,
  paintSweepProgress,
  PAINT_SWEEP_FRONT,
  PAINT_SWEEP_REAR,
  panelPhase,
  useWheelHubOffsets,
  useWheelPropModel,
  WELD_SEAM_POINTS,
  WHEEL_CARRY,
  WHEEL_CORNER_MIRRORED,
  WHEEL_CYCLE_MS,
  WHEEL_GRIP,
  WHEEL_REACH,
  WHEEL_STACK_PICK,
  wheelMountPhase,
  weldDartPhase,
  type WheelName,
} from './stationTargets';
import { PropStack, RackFrame, ShellSlab, type PropStackHandle } from './PropStack';

/** Per-station machine spec, modelled on real robot brands so the four
 *  stations read as different machines. `job` is what makes that difference
 *  *do* something: each station performs a distinct process (panel / weld /
 *  paint / wheel) with its own choreography, not four flavours of one weld. */
export type StationJob = 'panel' | 'weld' | 'paint' | 'wheel';

export interface MachineSpec {
  brand: string;
  linkColor: string;
  baseColor: string;
  accent: string;
  linkShape: 'box' | 'cyl';
  upperArmLen: number;
  forearmLen: number;
  linkWidth: number;
  endEffector: 'torch' | 'spot' | 'spray' | 'gripper';
  /** Static parked pose offsets (rad) - the arm eases back to this between
   *  cars and blends away from it toward the IK solution while reaching. */
  baseYaw: number;
  upperTilt: number;
  foreTilt: number;
  job: StationJob;
}

// Unified industrial safety-yellow fleet (matching a real body-shop floor)
// instead of four differently-branded colors - brand/job identity now comes
// through in shape (box vs cylinder links), end-effector, and the accent
// trim color alone, not the whole arm.
const ARM_YELLOW = '#f5c400';
const PEDESTAL_DARK = '#2a2d33';

// ---- Machine sizing ----
// These were about a third too small for the line they stand on. Two
// separate problems, one of which was functional rather than cosmetic:
//
// 1. Reach. PANEL-01 had upper 1.5 + fore 1.25 = 2.75m, i.e. a 2.70m
//    effective max reach, against a placement target ~2.86m away across the
//    belt (the robots stand 2.8m back at ROBOT_Z). Every frame of that
//    station's choreography was hitting solveTwoBoneIK's reach clamp, so
//    the arm aimed at a point short of where it had been told to go and
//    spent the dwell straining at full extension instead of working.
// 2. Proportion. A real body-shop weld robot (KUKA KR 210 class) is a
//    ~0.75m-diameter base under a ~3m machine with chunky 0.5m-section
//    castings. Slender 0.34m links on a 0.42m pedestal next to a 4.6m car
//    read as a desk toy standing next to a vehicle.
//
// Lengths now clear their targets with real headroom, and the sections are
// proportioned like load-bearing castings rather than tubes.
const MACHINES: Record<RobotId, MachineSpec> = {
  // ABB-style: box links, gripper, installs the body shell.
  'PANEL-01': {
    brand: 'ABB', linkColor: ARM_YELLOW, baseColor: PEDESTAL_DARK, accent: '#3a6ea5',
    linkShape: 'box', upperArmLen: 1.95, forearmLen: 1.6, linkWidth: 0.5,
    endEffector: 'gripper', baseYaw: 0.12, upperTilt: 0.42, foreTilt: -1.25,
    job: 'panel',
  },
  // KUKA-style: box links, C-frame spot-weld gun. 3 seam darts per car.
  'WELD-01': {
    brand: 'KUKA', linkColor: ARM_YELLOW, baseColor: PEDESTAL_DARK, accent: '#2fb574',
    linkShape: 'box', upperArmLen: 2.05, forearmLen: 1.5, linkWidth: 0.56,
    endEffector: 'spot', baseYaw: 0.36, upperTilt: 0.3, foreTilt: -1.1,
    job: 'weld',
  },
  // FANUC-style: cylindrical links, spray gun, sweeps front-to-back.
  'PAINT-01': {
    brand: 'FANUC', linkColor: ARM_YELLOW, baseColor: PEDESTAL_DARK, accent: '#2fb574',
    linkShape: 'cyl', upperArmLen: 1.8, forearmLen: 1.62, linkWidth: 0.42,
    endEffector: 'spray', baseYaw: -0.36, upperTilt: 0.5, foreTilt: -1.35,
    job: 'paint',
  },
  // Yaskawa/Motoman-style: box links, gripper, mounts wheels (one machine per
  // wheel - see RobotArm's `wheelCorner` prop).
  'WHEEL-01': {
    brand: 'YASKAWA', linkColor: ARM_YELLOW, baseColor: PEDESTAL_DARK, accent: '#e8a82c',
    linkShape: 'box', upperArmLen: 2.0, forearmLen: 1.55, linkWidth: 0.48,
    // Parked folded forward over its own hub rather than stood upright. At
    // the old 0.18/-0.7 the longer links left both near-side wheel machines
    // standing almost vertical in the foreground, crossing each other in an
    // X - a pose no wheel-mount robot rests in, and the most visually
    // dominant thing in the settle shot.
    endEffector: 'gripper', baseYaw: 0, upperTilt: 0.62, foreTilt: -1.5,
    job: 'wheel',
  },
};

// How far the tool arcs upward while carrying a tyre from stack to hub, and
// how many full turns it spins over that same carry (easing out into the
// mount) - purely presentational, so kept local to the renderer rather than
// stationTargets.ts's shared timing/frame logic.
const WHEEL_CARRY_LIFT = 0.4;
const WHEEL_CARRY_SPIN_TURNS = 1.5;

// Glossy powder-coat finish (low metalness, low roughness) so the HDRI's
// window/light-fixture reflections show up as sharp, defined highlight
// bands on the yellow arms instead of a soft plastic-flat sheen.
const ARM_METALNESS = 0.3;
const ARM_ROUGHNESS = 0.24;

function Link({ spec, length }: { spec: MachineSpec; length: number }) {
  const w = spec.linkWidth;
  if (spec.linkShape === 'cyl') {
    return (
      <mesh position={[0, length / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[w / 2, w / 2, length, 20]} />
        <meshStandardMaterial color={spec.linkColor} metalness={ARM_METALNESS} roughness={ARM_ROUGHNESS} envMapIntensity={1.3} />
      </mesh>
    );
  }
  return (
    <RoundedBox args={[w, length, w]} radius={0.05} smoothness={3} position={[0, length / 2, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={spec.linkColor} metalness={ARM_METALNESS} roughness={ARM_ROUGHNESS} envMapIntensity={1.3} />
    </RoundedBox>
  );
}

function Joint({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} envMapIntensity={1.3} />
    </mesh>
  );
}

/** End-effector at the tool tip. Different guns read as different machines
 *  even from a distance - and for 'spot'/'gripper', `jawRef` wraps the two
 *  jaw meshes so the caller can animate them pinching shut by scaling the
 *  group toward its centre. */
function EndEffector({
  kind,
  accent,
  jawRef,
  spinRef,
}: {
  kind: MachineSpec['endEffector'];
  accent: string;
  jawRef?: RefObject<THREE.Group | null>;
  spinRef?: RefObject<THREE.Mesh | null>;
}) {
  if (kind === 'spot') {
    // C-frame spot-weld gun: fixed yoke behind two prongs that pinch shut
    // top-to-bottom on the panel edge (jawRef scales toward Y=0).
    return (
      <group position={[0, -0.18, 0]}>
        <mesh castShadow position={[0, 0, -0.06]}>
          <boxGeometry args={[0.1, 0.4, 0.08]} />
          <meshStandardMaterial color="#1c1e22" metalness={0.6} roughness={0.35} />
        </mesh>
        <group ref={jawRef}>
          <mesh castShadow position={[0, 0.16, 0.14]}>
            <boxGeometry args={[0.12, 0.08, 0.18]} />
            <meshStandardMaterial color="#1c1e22" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh castShadow position={[0, -0.16, 0.14]}>
            <boxGeometry args={[0.12, 0.08, 0.18]} />
            <meshStandardMaterial color="#1c1e22" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry args={[0.14, 0.04, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.2} metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
    );
  }
  if (kind === 'gripper') {
    // Two-finger gripper for panel shell and wheel mounting: fingers pinch
    // front-to-back (jawRef scales toward Z=0).
    return (
      <group position={[0, -0.12, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.18, 16]} />
          <meshStandardMaterial color="#1c1e22" metalness={0.6} roughness={0.35} />
        </mesh>
        <group ref={jawRef}>
          {[0.13, -0.13].map((z) => (
            <mesh key={z} castShadow position={[0, -0.12, z]}>
              <boxGeometry args={[0.1, 0.22, 0.06]} />
              <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }
  if (kind === 'spray') {
    // Paint spray gun: a nozzle + a thin transparent "fan" cue + a soft
    // point light, recoloured from the weld spark's transparent-material
    // trick. spinRef rotates the wrist continuously to read as a painting
    // motion even when the arm is sweeping steadily.
    return (
      <group position={[0, -0.12, 0]}>
        <mesh castShadow rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.26, 12]} />
          <meshStandardMaterial color="#1c1e22" metalness={0.65} roughness={0.3} />
        </mesh>
        <mesh ref={spinRef} position={[0, -0.2, 0]}>
          <torusGeometry args={[0.095, 0.018, 8, 6]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
    );
  }
  // Default: MIG/MAG welding torch (kept for completeness; no station uses
  // it this phase - welding uses the spot gun above).
  return (
    <group position={[0, -0.1, 0]}>
      <mesh castShadow>
        <coneGeometry args={[0.08, 0.26, 12]} />
        <meshStandardMaterial color="#1c1e22" metalness={0.65} roughness={0.3} envMapIntensity={1.2} />
      </mesh>
    </group>
  );
}

/** A compact stack light bolted directly to the pedestal's top rim - a real
 *  andon tower is a ~0.5-1m mast mounted on the machine itself, not a
 *  free-standing pole planted in the floor a metre away (which is what this
 *  read as before: a 2.6m rod with no visual connection to the robot). The
 *  mount collar sits flush on the pedestal's accent ring so it reads as part
 *  of the machine's own housing. */
function AndonLight({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const levels: Array<'critical' | 'warning' | 'healthy'> = ['critical', 'warning', 'healthy'];
  const poleHeight = 0.8;
  // On the pedestal's top rim. Derived from the rim radius rather than a
  // literal, which is what let it drift once the pedestal grew.
  const mountOffset = 0.4;
  return (
    <group position={[mountOffset, SHOULDER_Y, mountOffset]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.075, 0.09, 0.07, 12]} />
        <meshStandardMaterial color={COLORS.robotBase} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, poleHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, poleHeight, 8]} />
        <meshStandardMaterial color={COLORS.robotBase} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, poleHeight + 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.05, 12]} />
        <meshStandardMaterial color={COLORS.robotBase} metalness={0.4} roughness={0.5} />
      </mesh>
      {levels.map((level, i) => {
        const lit = status === level;
        return (
          <mesh key={level} position={[0, poleHeight - 0.13 - i * 0.17, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.13, 16]} />
            <meshStandardMaterial
              color={lit ? STATUS_COLOR[level] : '#33363b'}
              emissive={lit ? STATUS_COLOR[level] : '#000000'}
              emissiveIntensity={lit ? 1.6 : 0}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** A real wheel - the car's own rim/tire/brake-disc/lug-nut meshes, not a
 *  stand-in - for the Wheel station's rack and the one riding the gripper
 *  during carry. `held` swings it from the rack's upright/standing pose to
 *  ride the tool pointed toward the car. */
function WheelProp({ held = false }: { held?: boolean }) {
  const wheel = useWheelPropModel();
  if (!wheel) return null;
  return (
    <group rotation={held ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <primitive object={wheel} />
    </group>
  );
}

function Pedestal({ spec }: { spec: MachineSpec }) {
  return (
    <group>
      {/* Every offset here is expressed against SHOULDER_Y rather than
          hardcoded, so the pedestal always spans floor to shoulder. These
          were literals tuned for a 0.7m pedestal - raising the shoulder
          left the cone sunk through the floor and ending short of the
          joint it is supposed to be carrying. */}
      <mesh position={[0, SHOULDER_Y / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.68, SHOULDER_Y, 24]} />
        <meshStandardMaterial color={spec.baseColor} metalness={0.4} roughness={0.5} envMapIntensity={0.8} />
      </mesh>
      <mesh position={[0, SHOULDER_Y - 0.1, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.16, 24]} />
        <meshStandardMaterial color={spec.accent} metalness={0.3} roughness={0.5} emissive={spec.accent} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, SHOULDER_Y * 0.34, 0.6]}>
        <boxGeometry args={[0.46, 0.11, 0.02]} />
        <meshStandardMaterial color={spec.accent} metalness={0.5} roughness={0.4} emissive={spec.accent} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

/** Per-frame choreography output: where the arm should reach and what the
 *  end-effector should be doing this frame. The target is in robot-ground-
 *  local coords (null → sit at the authored rest pose). */
interface ChoreoState {
  target: THREE.Vector3 | null;
  jawScale: number;
  sparkEnvelope: number;
  sparkTint: boolean;
  spin: boolean;
  heldItem: 'panel' | 'wheel' | null;
  /** Extra spin (rad) applied to a carried wheel, on top of its held pose -
   *  sells "carrying/aligning a tire" instead of a rigid prop sliding
   *  through the air. 0 outside the wheel-carry beat. */
  wheelSpin: number;
}

/** Reach-blend envelope across a station's dwell: ramp up after the car has
 *  glided in, hold, then retract before the next index step. 0 outside the
 *  dwell. The choreographed target drives during the hold; the rest pose
 *  shows outside it. */
function reachBlend(elapsedMs: number, workMs: number): number {
  if (elapsedMs < 0 || elapsedMs > workMs) return 0;
  const rampMs = 350;
  const start = SNAP_TRANSITION_MS;
  const retract = workMs - rampMs;
  if (elapsedMs < start) return 0;
  if (elapsedMs < start + rampMs) return smoothstep((elapsedMs - start) / rampMs);
  if (elapsedMs > retract) return smoothstep((workMs - elapsedMs) / rampMs);
  return 1;
}

export function RobotArm({
  robotId,
  wheelCorner,
  showProps = true,
}: {
  robotId: RobotId;
  wheelCorner?: WheelName;
  /** Panel's shell rack / Wheel's tyre stack - on by default for the real
   *  scene. The fleet overview's standalone per-machine preview cards turn
   *  this off so an isolated arm doesn't drag a nearby rack into a tightly
   *  framed shot. */
  showProps?: boolean;
}) {
  // The andon shows the same verdict as the machine cards: the worst of the
  // weld trend and the arm's own sensors, so it lights the moment the arm
  // starts shaking rather than a few cars later.
  const status = useStore((s) => machineSeverity(s, robotId));
  const spec = useMemo(() => MACHINES[robotId], [robotId]);
  const stationIndex = ROBOT_IDS.indexOf(robotId);
  const dockedCar = useStore((s) => s.activeCars.find((c) => c.stationIndex === stationIndex));
  const wheelHubs = useWheelHubOffsets();
  // The Wheel station is four machines, one per corner - `wheelCorner` picks
  // which wheel this instance mounts, which side of the car it stands on
  // (WHEEL_CORNER_MIRRORED) and, via the hub's own carFrame x, how far
  // toward the front or rear it's shifted from the station's nominal x (see
  // carFrameToRobotLocal's xOffset). Every other station renders a single
  // instance at that nominal x (wheelCorner undefined, xOffset 0).
  const mirrored = wheelCorner ? WHEEL_CORNER_MIRRORED[wheelCorner] : false;
  const wheelHub = wheelCorner ? wheelHubs[wheelCorner] : undefined;
  const xOffset = wheelHub?.x ?? 0;

  const baseRef = useRef<THREE.Group>(null);
  const shoulderRef = useRef<THREE.Group>(null);
  const forearmRef = useRef<THREE.Group>(null);
  const toolRef = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Mesh>(null);
  const sparkLightRef = useRef<THREE.PointLight>(null);
  const heldPanelRef = useRef<THREE.Mesh>(null);
  const heldWheelRef = useRef<THREE.Group>(null);
  const propRef = useRef<PropStackHandle>(null);

  const effNowRef = useRef<number>(0);
  // Track phase transitions so a prop pick fires exactly once per grip.
  const prevPanelPhase = useRef<string>('idle');
  const wheelPicked = useRef(false);
  // Latches true the instant the mount pulse first crosses its hand-off
  // threshold, so the held wheel props stay hidden for the rest of that
  // pulse. mountPulse is a symmetric rise-then-fall triangle (see
  // wheelMountPhase), so a live `mountPulse > 0.5` comparison flips true
  // then false again as it decays - without this latch the held props
  // would reappear riding the gripper for the pulse's tail, alongside the
  // wheels they just handed off to the car (which itself only ever latches
  // on, via CarShell's isWheelMounted check, so this brings the gripper
  // side in line with it). Also the one-shot trigger for restocking the
  // rack (see the wheel case below). Reset at the top of each dwell's
  // reach phase.
  const wheelMountReleased = useRef(false);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // All four wheel machines share robotId/ROBOT_X, so without a phase
    // offset they'd idle-sway in perfect lockstep - mirrored contributes a
    // half-cycle split (near vs far side) and xOffset a further per-corner
    // one (front vs rear), so all four read as independent machines instead
    // of two mirrored pairs.
    const idlePhase = ROBOT_X[robotId] + xOffset + (mirrored ? Math.PI : 0);
    const idleSway = Math.sin(t * 0.65 + idlePhase) * 0.16;
    // A second, faster/smaller wobble on the shoulder - out of phase with
    // the base sway - so idle machines read as gently alive rather than a
    // single slow twist that's easy to miss at a glance.
    const idleBreath = Math.sin(t * 0.9 + idlePhase + 1.2) * 0.045;


    if (!useStore.getState().paused) effNowRef.current = Date.now();
    const elapsed = dockedCar ? effNowRef.current - dockedCar.dockedAt : -1;
    const blend = dockedCar ? reachBlend(elapsed, WORK_MS[robotId]) : 0;

    const carGroupY = CONVEYOR_Y;

    // ---- per-job choreography ----
    const choreo: ChoreoState = {
      target: null,
      jawScale: 1,
      sparkEnvelope: 0,
      sparkTint: false,
      spin: false,
      heldItem: null,
      wheelSpin: 0,
    };

    if (dockedCar && elapsed >= 0) {
      switch (spec.job) {
        case 'paint': {
          // Sweep the spray target front→rear across the roof line.
          const p = paintSweepProgress(elapsed);
          const carPoint = new THREE.Vector3().lerpVectors(PAINT_SWEEP_FRONT, PAINT_SWEEP_REAR, p);
          choreo.target = carFrameToRobotLocal(carPoint, carGroupY);
          choreo.spin = true;
          choreo.sparkEnvelope = blend; // spray fan on for the whole sweep
          choreo.sparkTint = true;
          break;
        }
        case 'weld': {
          const dart = weldDartPhase(elapsed);
          if (dart.pointIndex >= 0) {
            const target = WELD_SEAM_POINTS[dart.pointIndex];
            const arrive = dart.pointIndex === 0 ? dart.arrive : 1;
            if (dart.pointIndex === 0) {
              choreo.target = carFrameToRobotLocal(target, carGroupY);
            } else {
              const prev = WELD_SEAM_POINTS[dart.pointIndex - 1];
              const carPoint = new THREE.Vector3().lerpVectors(prev, target, arrive);
              choreo.target = carFrameToRobotLocal(carPoint, carGroupY);
            }
            choreo.sparkEnvelope = dart.pulse * blend;
            choreo.jawScale = 1 - dart.pulse * 0.72 * blend; // jaws snap at the spark
          }
          break;
        }
        case 'wheel': {
          // All four machines call this with the same `elapsed`, so they're
          // always on the same cycle - each one carries + mounts its own
          // single wheel, so all 4 land on the car at the same instant.
          const ph = wheelMountPhase(elapsed);
          const hub = wheelHub;
          if (ph.active && hub) {
            const intoCycle = ph.cycleT * WHEEL_CYCLE_MS;
            if (intoCycle < WHEEL_REACH) {
              wheelPicked.current = false;
              wheelMountReleased.current = false;
              // Reach to the stack top - this fires once per dwell, right
              // after the car docks, so `blend` is still easing up from the
              // idle/rest pose and a constant target reads fine (no prior
              // "at the car" position to glide back from, unlike the old
              // two-cycle version).
              choreo.target = WHEEL_STACK_PICK.clone();
              choreo.jawScale = 1;
            } else if (intoCycle < WHEEL_REACH + WHEEL_GRIP) {
              choreo.target = WHEEL_STACK_PICK.clone();
              choreo.jawScale = 1 - smoothstep((intoCycle - WHEEL_REACH) / WHEEL_GRIP) * 0.7; // grip
              if (!wheelPicked.current) {
                propRef.current?.pick();
                wheelPicked.current = true;
              }
            } else if (intoCycle < WHEEL_REACH + WHEEL_GRIP + WHEEL_CARRY) {
              // Carry to the hub. A straight lerp reads as the tyre sliding
              // through the air on rails; real pick-and-place lifts clear of
              // the rack/hub first - add a parabolic arc so the tool visibly
              // rises off the stack then descends onto the car, and spin the
              // wheel (decelerating into the mount, like it's being rolled/
              // aligned to the bolt pattern) instead of holding one rigid
              // pose the whole carry.
              const carryT = smoothstep((intoCycle - WHEEL_REACH - WHEEL_GRIP) / WHEEL_CARRY);
              choreo.target = new THREE.Vector3().lerpVectors(
                WHEEL_STACK_PICK,
                carFrameToRobotLocal(hub, carGroupY, mirrored, xOffset),
                carryT,
              );
              choreo.target.y += Math.sin(carryT * Math.PI) * WHEEL_CARRY_LIFT;
              choreo.jawScale = 0.3; // keep grip
              choreo.heldItem = 'wheel';
              choreo.wheelSpin = (1 - (1 - carryT) ** 2) * WHEEL_CARRY_SPIN_TURNS * Math.PI * 2;
            } else {
              // Mount pulse at the hub, release the wheel. Keep it riding the
              // tool through the whole pulse and only hand off to the car's
              // own (now-visible) wheel once isWheelMounted's exact
              // threshold (CarShell.tsx, stationTargets.ts) is crossed -
              // matching that condition exactly closes what was otherwise a
              // visible gap where neither the carried nor the mounted wheel
              // was on screen for a frame or two. That same instant is also
              // when the rack is safe to restock: the tool has moved on to
              // the car, so a fresh tyre popping back onto the (now-empty)
              // rack doesn't compete with anything else on screen.
              choreo.target = carFrameToRobotLocal(hub, carGroupY, mirrored, xOffset);
              choreo.jawScale = 1 - ph.mountPulse * 0.4;
              if (ph.mountPulse > 0.5 && !wheelMountReleased.current) {
                wheelMountReleased.current = true;
                propRef.current?.refill();
              }
              choreo.heldItem = wheelMountReleased.current ? null : 'wheel';
              choreo.wheelSpin = WHEEL_CARRY_SPIN_TURNS * Math.PI * 2;
            }
          }
          break;
        }
        case 'panel': {
          const ph = panelPhase(elapsed);
          if (ph.phase === 'idle') break;
          if (ph.phase === 'reach') {
            choreo.target = PANEL_RACK_PICK.clone();
            choreo.jawScale = 1;
          } else if (ph.phase === 'grip') {
            choreo.target = PANEL_RACK_PICK.clone();
            choreo.jawScale = 0.3;
            if (prevPanelPhase.current !== 'grip') {
              propRef.current?.pick();
              prevPanelPhase.current = 'grip';
            }
          } else if (ph.phase === 'carry') {
            const carryStart = SNAP_TRANSITION_MS + 100 + 500 + 150;
            const carryT = smoothstep((elapsed - carryStart) / 650);
            choreo.target = new THREE.Vector3().lerpVectors(PANEL_RACK_PICK, carFrameToRobotLocal(PANEL_PLACEMENT, carGroupY), carryT);
            choreo.jawScale = 0.3;
            choreo.heldItem = 'panel';
          } else if (ph.phase === 'reveal') {
            choreo.target = carFrameToRobotLocal(PANEL_PLACEMENT, carGroupY);
            choreo.jawScale = ph.reveal >= 0.9 ? 1 : 0.3;
            choreo.heldItem = ph.reveal < 0.9 ? 'panel' : null;
          } else {
            // retract - ease back toward rest (target null)
            choreo.target = null;
          }
          if (ph.phase !== 'grip') prevPanelPhase.current = ph.phase;
          break;
        }
      }
    }

    // ---- pose: blend rest → IK(target) ----
    const ik = choreo.target && blend > 0
      ? solveTwoBoneIK(choreo.target, spec.upperArmLen, spec.forearmLen)
      : null;
    const ikBaseYaw = ik?.baseYaw ?? spec.baseYaw;
    const ikUpperTilt = ik?.upperTilt ?? spec.upperTilt;
    const ikForeTilt = ik?.foreTilt ?? spec.foreTilt;
    const swayScale = 1 - blend;
    const basePose = THREE.MathUtils.lerp(spec.baseYaw, ikBaseYaw, blend);
    const shoulderPose = THREE.MathUtils.lerp(spec.upperTilt, ikUpperTilt, blend);
    const forePose = THREE.MathUtils.lerp(spec.foreTilt, ikForeTilt, blend);

    if (baseRef.current) baseRef.current.rotation.y = basePose + idleSway * swayScale;
    if (shoulderRef.current) shoulderRef.current.rotation.x = shoulderPose + idleBreath * swayScale;
    if (forearmRef.current) forearmRef.current.rotation.x = forePose;

    // Tool offset: a small forward thrust while sparking/gripping reads as
    // contact with the panel. Paint sprays from a stand-off.
    let toolZ = 0;
    if (spec.job === 'weld') toolZ = choreo.sparkEnvelope * 0.12;
    if (spec.job === 'paint') toolZ = -0.08;
    if (toolRef.current) toolRef.current.position.set(0, 0, toolZ);

    const jawScale = THREE.MathUtils.lerp(1, choreo.jawScale, blend);
    if (jawRef.current) {
      if (spec.endEffector === 'gripper') jawRef.current.scale.z = jawScale;
      else jawRef.current.scale.y = jawScale;
    }

    // ---- spark / spray visual ----
    const env = choreo.sparkEnvelope * blend;
    const sparkVisible = env > 0.05;
    if (sparkRef.current) {
      sparkRef.current.visible = sparkVisible;
      sparkRef.current.scale.setScalar(0.5 + env * 0.9);
      const mat = sparkRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = env;
      mat.color.set(choreo.sparkTint ? '#eaf0ff' : COLORS.sparkCore);
      mat.emissive.set(choreo.sparkTint ? '#9fc0ff' : COLORS.spark);
    }
    if (sparkLightRef.current) {
      sparkLightRef.current.intensity = env * (choreo.sparkTint ? 3.5 : 8);
      sparkLightRef.current.color.set(choreo.sparkTint ? '#9fc0ff' : COLORS.spark);
    }
    if (choreo.spin && spinRef.current) spinRef.current.rotation.z += delta * 3.2;

    // ---- held item riding the tool ----
    if (heldPanelRef.current) heldPanelRef.current.visible = choreo.heldItem === 'panel';
    if (heldWheelRef.current) {
      heldWheelRef.current.visible = choreo.heldItem === 'wheel';
      // Applied to this wrapper, not WheelProp's own inner group (which
      // sets its static "held" pose each render) - the two rotations
      // compose independently, so the spin doesn't fight the held pose.
      heldWheelRef.current.rotation.x = choreo.wheelSpin;
    }
  });

  const usesJaw = spec.endEffector === 'spot' || spec.endEffector === 'gripper';
  const isPanel = spec.job === 'panel';
  const isWheel = spec.job === 'wheel';

  return (
    <group
      position={[ROBOT_X[robotId] + xOffset, 0, mirrored ? -ROBOT_Z : ROBOT_Z]}
      rotation={mirrored ? [0, Math.PI, 0] : [0, 0, 0]}
    >
      <Pedestal spec={spec} />

      <group ref={baseRef} position={[0, SHOULDER_Y, 0]}>
        <Joint radius={0.34} color={spec.linkColor} />
        <group ref={shoulderRef} rotation={[spec.upperTilt, 0, 0]}>
          <Link spec={spec} length={spec.upperArmLen} />
          <group ref={forearmRef} position={[0, spec.upperArmLen, 0]}>
            <Joint radius={0.3} color={spec.linkColor} />
            <Link spec={spec} length={spec.forearmLen} />
            <group position={[0, spec.forearmLen, 0]}>
              <Joint radius={0.22} color={spec.linkColor} />
              <group ref={toolRef}>
                <EndEffector
                  kind={spec.endEffector}
                  accent={spec.accent}
                  jawRef={usesJaw ? jawRef : undefined}
                  spinRef={spinRef}
                />
                {/* Spark / spray fan at the tool contact point. */}
                <group position={[0, spec.endEffector === 'spray' ? -0.32 : -0.05, spec.job === 'paint' ? 0 : 0.18]}>
                  <mesh ref={sparkRef} visible={false}>
                    <sphereGeometry args={[0.07, 12, 12]} />
                    <meshStandardMaterial
                      color={COLORS.sparkCore}
                      emissive={COLORS.spark}
                      emissiveIntensity={2.6}
                      transparent
                      opacity={0}
                    />
                  </mesh>
                  <pointLight ref={sparkLightRef} color={COLORS.spark} intensity={0} distance={3.2} decay={2} />
                </group>
                {/* Held prop riding the tool during carry (before reveal/mount). */}
                <mesh ref={heldPanelRef} position={[0, -0.32, 0.18]} visible={false} castShadow>
                  <boxGeometry args={[1.2, 0.4, 0.8]} />
                  <meshStandardMaterial color="#b9b9bd" metalness={0.3} roughness={0.6} />
                </mesh>
                {/* This machine's one wheel, riding the tool during carry. */}
                <group ref={heldWheelRef} position={[0, -0.3, 0.18]} visible={false}>
                  <WheelProp held />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {showProps && isPanel && (
        <PropStack
          ref={propRef}
          position={[PANEL_RACK_PICK.x, 0, PANEL_RACK_PICK.z - 0.4]}
          count={4}
          itemOffset={(i) => [0, 0.6 + (i + 0.5) * 0.46, 0]}
          stand={
            <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.8, 0.6, 1.1]} />
              <meshStandardMaterial color="#4a4e55" metalness={0.4} roughness={0.6} />
            </mesh>
          }
          renderItem={() => <ShellSlab />}
        />
      )}
      {showProps && isWheel && (
        <PropStack
          ref={propRef}
          position={[WHEEL_STACK_PICK.x, 0, WHEEL_STACK_PICK.z - 0.4]}
          // One machine, one wheel - its own rack stocks just the one.
          count={1}
          itemOffset={() => [0, 0.08 + 0.34, -0.02]}
          stand={<RackFrame width={0.6} height={1.05} />}
          renderItem={() => <WheelProp />}
        />
      )}

      <AndonLight status={status} />
    </group>
  );
}