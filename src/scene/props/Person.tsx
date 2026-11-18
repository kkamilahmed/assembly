// A person on the city block: analysts at their desks, shoppers, a barista,
// a courier, a guard. About 1.75 m tall, origin on the ground between the
// feet, facing +x.
//
// The figure is posed by targets rather than joint angles: each pose says
// where the hands and feet are, and a two-bone solver bends the elbows and
// knees to reach them. That keeps hands on the things they hold, feet flat
// on the floor and a seated person's knees over the chair, whatever the
// torso is doing.
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glow, matte, PALETTE, plastic } from '@/scene/style';
import { capsule, cyl, dome, lathe, limb, rbox, rng, sphere, studioWhite, torus } from './kit';
import { Part } from './Part';
import { Carton } from './Stock';
import { mergeRigidChildren, unmerge } from '@/scene/mergeMeshes';
import { useGait } from './gait';
import { WALK_RATE, WALK_STRIDE, PERSON_SCALE } from './personRig';

/** 'walkCarry' and 'walkPush' walk with the hands where 'carry' and 'push'
 *  put them; move the person's group along at WALK_SPEED. 'sit'
 *  types at a desk and 'sitSip' drinks a coffee at a table: both expect a
 *  seat 0.47 high under the origin. */
export type PersonPose =
  | 'stand'
  | 'tablet'
  | 'carry'
  | 'push'
  | 'inspect'
  | 'walk'
  | 'walkCarry'
  | 'walkPush'
  | 'sit'
  | 'sitSip';

/** What a person wears. Each look has a few colourways picked by seed. */
export type Outfit = 'analyst' | 'casual' | 'barista' | 'courier' | 'guard' | 'packer';

/** What a person holds. 'tablet' and 'phone' go with the 'tablet' pose,
 *  'bags' and 'coffee' with 'walk', the rest with 'carry' / 'walkCarry'. */
export type Carrying = 'box' | 'laptop' | 'basket' | 'coffee' | 'bags' | 'phone' | 'tablet' | 'none';

type GroupProps = Omit<ThreeElements['group'], 'children'>;
type Ref = RefObject<THREE.Group | null>;

export interface PersonProps extends GroupProps {
  pose?: PersonPose;
  outfit?: Outfit;
  carrying?: Carrying;
  /** Index into PALETTE.skinTones. */
  skin?: number;
  /** Hi-vis vest over the top (courier, warehouse). */
  vest?: boolean;
  /** Varies height, hair, colourway and animation phase. */
  seed?: number;
}

// Skeleton, in metres. z is the person's right.
const HIP_Y = 0.93;
const HIP_Z = 0.085;
const FOOT_Z = 0.098;
const ANKLE_Y = 0.1;
const THIGH = 0.425;
const SHIN = 0.408;
const SHOULDER_Y = 1.388;
const SHOULDER_Z = 0.168;
const UPPER_ARM = 0.285;
const FOREARM = 0.255;
const NECK_Y = 1.5;
/** How far a seated person's body drops: hips land on a 0.47 seat. */
const SEAT_DROP = 0.44;

interface Pose {
  lean: number;
  headPitch: number;
  headYaw: number;
  pelvis: [number, number];
  /** Wrist targets in torso space, right then left. */
  hands: [[number, number, number], [number, number, number]];
  /** Which way the elbows point, right then left. */
  poles: [[number, number, number], [number, number, number]];
  /** Ankle x, lift and toe pitch, right then left. */
  feet: [[number, number, number], [number, number, number]];
}

type PoseKey =
  | Exclude<PersonPose, 'carry' | 'walkCarry' | 'walkPush'>
  | 'carryBox'
  | 'carryLaptop'
  | 'carryBasket'
  | 'carryCoffee';

// Torso space is the standing body's frame: a seated pose drops the pelvis
// by SEAT_DROP, so a hand on a 0.74 desk is at 0.74 + SEAT_DROP.
const DESK = 0.74 + SEAT_DROP;

const POSES: Record<PoseKey, Pose> = {
  stand: {
    lean: 0.02,
    headPitch: 0.04,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.04, 0.882, 0.215], [0.02, 0.882, -0.215]],
    poles: [[-1, 0, 0.15], [-1, 0, -0.15]],
    feet: [[0.02, 0, 0], [-0.02, 0, 0]],
  },
  walk: {
    lean: 0.07,
    headPitch: 0,
    headYaw: 0,
    pelvis: [0, -0.035],
    hands: [[0.03, 0.89, 0.215], [0.03, 0.89, -0.215]],
    poles: [[-1, 0, 0.15], [-1, 0, -0.15]],
    feet: [[0, 0, 0], [0, 0, 0]],
  },
  tablet: {
    lean: 0.03,
    headPitch: 0.42,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.27, 1.175, 0.07], [0.235, 1.07, -0.105]],
    poles: [[-0.3, -1, 0.9], [-0.3, -1, -0.9]],
    feet: [[0.03, 0, 0], [-0.03, 0, 0]],
  },
  carryBox: {
    lean: -0.06,
    headPitch: 0.02,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.3, 0.99, 0.238], [0.3, 0.99, -0.238]],
    poles: [[-0.6, -0.5, 1], [-0.6, -0.5, -1]],
    feet: [[0.05, 0, 0], [-0.04, 0, 0]],
  },
  carryLaptop: {
    lean: 0.02,
    headPitch: 0.1,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.24, 1.05, 0.17], [0.24, 1.05, -0.17]],
    poles: [[-0.6, -0.7, 1], [-0.6, -0.7, -1]],
    feet: [[0.05, 0, 0], [-0.04, 0, 0]],
  },
  carryBasket: {
    lean: 0.02,
    headPitch: 0.12,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.1, 0.9, 0.24], [0.03, 0.89, -0.215]],
    poles: [[-1, 0, 0.3], [-1, 0, -0.15]],
    feet: [[0.05, 0, 0], [-0.04, 0, 0]],
  },
  carryCoffee: {
    lean: 0.04,
    headPitch: 0.05,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.27, 1.1, 0.16], [0.03, 0.89, -0.215]],
    poles: [[-0.5, -1, 0.7], [-1, 0, -0.15]],
    feet: [[0.05, 0, 0], [-0.04, 0, 0]],
  },
  push: {
    lean: 0.18,
    headPitch: -0.1,
    headYaw: 0,
    pelvis: [0, -0.045],
    hands: [[0.38, 1.2, 0.115], [0.38, 1.2, -0.115]],
    poles: [[-0.2, -1, 0.7], [-0.2, -1, -0.7]],
    feet: [[0.2, 0, 0], [-0.25, 0.035, -0.4]],
  },
  inspect: {
    lean: 0.24,
    headPitch: 0.3,
    headYaw: 0.12,
    pelvis: [-0.05, -0.025],
    hands: [[0.37, 1.1, 0.1], [0.06, 0.97, -0.235]],
    poles: [[-0.3, -1, 0.6], [-1, 0.1, -0.7]],
    feet: [[0.07, 0, 0], [-0.1, 0, 0]],
  },
  sit: {
    lean: 0.1,
    headPitch: 0.16,
    headYaw: 0,
    pelvis: [-0.04, -SEAT_DROP],
    hands: [[0.37, DESK + 0.035, 0.12], [0.37, DESK + 0.035, -0.12]],
    poles: [[-0.4, -1, 0.9], [-0.4, -1, -0.9]],
    feet: [[0.42, 0, 0.02], [0.4, 0, -0.02]],
  },
  sitSip: {
    lean: 0.02,
    headPitch: 0.05,
    headYaw: 0,
    pelvis: [-0.04, -SEAT_DROP],
    hands: [[0.33, DESK + 0.03, 0.14], [0.33, DESK + 0.03, -0.16]],
    poles: [[-0.4, -1, 0.9], [-0.4, -1, -0.9]],
    feet: [[0.4, 0, 0.03], [0.36, 0, -0.03]],
  },
};

/** Colourways: [top, bottom, shoes]. */
const OUTFITS: Record<Outfit, Array<[string, string, string]>> = {
  analyst: [
    ['#f4f5f7', '#2f3a4d', '#26272b'],
    ['#cfdcef', '#3a3d44', '#3b2b22'],
    ['#2f3a4d', '#5a6372', '#26272b'],
    ['#e8e2d6', '#2f3a4d', '#26272b'],
  ],
  casual: [
    ['#d96c3a', '#3d5a80', '#f4f5f7'],
    ['#2fa38a', '#2f3a4d', '#f4f5f7'],
    ['#f2c14e', '#3d5a80', '#26272b'],
    ['#3b86e3', '#b9a88e', '#f4f5f7'],
    ['#8a5a44', '#2f3a4d', '#f4f5f7'],
    ['#e8e2d6', '#3d5a80', '#26272b'],
  ],
  barista: [['#f4f5f7', '#26272b', '#26272b']],
  courier: [[PALETTE.tdzYellow, PALETTE.tdzInk, '#26272b']],
  guard: [['#2f3a4d', '#2f3a4d', '#1c1d21']],
  packer: [['#5a6372', PALETTE.tdzInk, '#26272b']],
};

const HAIR = ['#2a1f18', '#17171a', '#4b3524', '#6d4c30', '#3a2a20', '#8b6b46', '#b9a17a'];

// Solver scratch, shared by every person (frames run one at a time).
const DOWN = new THREE.Vector3(0, -1, 0);
const vS = new THREE.Vector3();
const vT = new THREE.Vector3();
const vP = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vPerp = new THREE.Vector3();
const vE = new THREE.Vector3();
const vEnd = new THREE.Vector3();
const vTmp = new THREE.Vector3();

/** Two-bone IK from vS toward vT with the joint pushed toward vP. Leaves
 *  the reached end point in vEnd. */
function solveLimb(upper: THREE.Object3D, lower: THREE.Object3D, a: number, b: number) {
  vDir.subVectors(vT, vS);
  const d = Math.min(vDir.length(), (a + b) * 0.998);
  vDir.normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  vPerp.copy(vP).addScaledVector(vDir, -vP.dot(vDir)).normalize();
  vE.copy(vS).addScaledVector(vDir, x).addScaledVector(vPerp, h);
  vEnd.copy(vS).addScaledVector(vDir, d);
  upper.position.copy(vS);
  upper.quaternion.setFromUnitVectors(DOWN, vTmp.subVectors(vE, vS).normalize());
  lower.position.copy(vE);
  lower.quaternion.setFromUnitVectors(DOWN, vTmp.subVectors(vEnd, vE).normalize());
}

// Jacket silhouette, [half width, height]: hem, hip, waist, chest, shoulder
// slope, collar. Squashed front-to-back when used.
const JACKET: Array<[number, number]> = [
  [0.18, 0.835], [0.187, 0.85], [0.185, 0.88], [0.172, 0.96], [0.15, 1.1], [0.16, 1.28],
  [0.168, 1.36], [0.17, 1.4], [0.158, 1.435], [0.13, 1.46], [0.09, 1.476], [0.05, 1.487], [0, 1.49],
];
const VEST: Array<[number, number]> = [
  [0.178, 0.9], [0.178, 0.95], [0.158, 1.1], [0.168, 1.28], [0.178, 1.36], [0.18, 1.4], [0.168, 1.437], [0.14, 1.464], [0.1, 1.482],
];
const DEPTH = 0.7;
/** Half width of the jacket at a height, for placing things on its front. */
function jacketR(y: number): number {
  for (let i = 1; i < JACKET.length; i++) {
    if (y <= JACKET[i][1]) {
      const [r0, y0] = JACKET[i - 1];
      const [r1, y1] = JACKET[i];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return 0;
}
const band = (y0: number, y1: number): Array<[number, number]> => [
  [jacketR(y0) + 0.02, y0], [jacketR((y0 + y1) / 2) + 0.02, (y0 + y1) / 2], [jacketR(y1) + 0.02, y1],
];

export function Person({ pose = 'stand', outfit = 'casual', carrying = 'none', skin = 0, vest = false, seed = 1, ...props }: PersonProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Group>(null);
  const thighR = useRef<THREE.Group>(null);
  const thighL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const bootR = useRef<THREE.Group>(null);
  const bootL = useRef<THREE.Group>(null);

  const look = useMemo(() => {
    const r = rng(seed * 31 + skin * 7 + 3);
    const ways = OUTFITS[outfit];
    return {
      // A touch larger than life, the way the references draw people:
      // at the overview zoom they are the storytellers, not ant-sized.
      scale: (0.965 + r() * 0.06) * PERSON_SCALE,
      build: 0.96 + r() * 0.1,
      hair: HAIR[Math.floor(r() * HAIR.length)],
      longHair: r() < 0.4,
      colours: ways[Math.floor(r() * ways.length) % ways.length],
      phase: r() * 20,
    };
  }, [seed, skin, outfit]);

  // Merge the meshes that ride on the same bone, once the figure is built:
  // about 45 draws per person becomes about 20, and every bone still moves.
  useLayoutEffect(() => {
    const r = root.current;
    if (!r) return;
    const made = mergeRigidChildren(r);
    return () => unmerge(r, made);
  }, [pose, vest, carrying, seed, outfit]);

  const key: PoseKey =
    pose === 'carry' || pose === 'walkCarry'
      ? carrying === 'laptop'
        ? 'carryLaptop'
        : carrying === 'basket'
          ? 'carryBasket'
          : carrying === 'coffee'
            ? 'carryCoffee'
            : 'carryBox'
      : pose === 'walkPush'
        ? 'push'
        : pose;
  const P = POSES[key];

  const gait = useGait();
  const stride = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!body.current || !torso.current || !head.current) return;
    const t = clock.elapsedTime + look.phase;
    const breath = Math.sin(t * 1.7);
    const sway = Math.sin(t * 0.55);
    const dir = gait.current.dir;
    const walking = (pose === 'walk' || pose === 'walkCarry' || pose === 'walkPush') && dir !== 0;
    // Stride phase is accumulated, so reversing direction (pulling a load
    // back) steps the feet backwards without a jump in the cycle.
    stride.current += Math.min(delta, 0.1) * WALK_RATE * dir;
    // Work cycles: a slow reach-and-return for hands-on work, a glance up
    // from a screen every few seconds, a sip every few. Big enough to read
    // at the overview zoom.
    const reachU = (t % 3.4) / 3.4;
    const reach = Math.sin(Math.PI * Math.min(reachU / 0.85, 1)) ** 2;
    const glanceU = (t % 5.5) / 5.5;
    const glance = glanceU > 0.62 ? Math.sin(Math.PI * ((glanceU - 0.62) / 0.38)) ** 2 : 0;
    const sipU = (t % 6.2) / 6.2;
    const sip = sipU < 0.36 ? Math.sin(Math.PI * (sipU / 0.36)) ** 2 : 0;
    const ph = stride.current + look.phase;
    const sinR = Math.sin(ph);

    let lean = P.lean + breath * 0.004;
    let pelvisY = P.pelvis[1];
    let swayZ = sway * 0.012;
    let twist = 0;
    let headYaw = P.headYaw;
    let headPitch = P.headPitch;
    if (walking) {
      pelvisY += 0.012 * Math.cos(2 * ph);
      swayZ = 0.012 * sinR;
      twist = -0.09 * sinR;
    } else if (pose === 'stand') {
      headYaw += 0.4 * Math.sin(t * 0.45) + 0.1 * Math.sin(t * 0.83);
    } else if (pose === 'inspect') {
      headYaw += 0.12 * Math.sin(t * 0.5);
      lean += 0.11 * reach;
      headPitch += 0.18 * reach;
    } else if (pose === 'tablet') {
      headYaw += 0.55 * glance;
      headPitch -= 0.3 * glance;
    } else if (pose === 'sit') {
      // Eyes on the screen, a turn to the colleague now and then.
      swayZ *= 0.4;
      headYaw += 0.5 * glance;
      headPitch -= 0.1 * glance;
    } else if (pose === 'sitSip') {
      swayZ *= 0.4;
      headPitch -= 0.25 * sip;
      lean -= 0.06 * sip;
      headYaw += 0.35 * Math.sin(t * 0.4);
    }

    body.current.position.set(P.pelvis[0], pelvisY, swayZ);
    torso.current.rotation.set(-swayZ * 1.2, twist, -lean);
    head.current.rotation.set(0, headYaw - twist * 0.7, -headPitch);

    // Arms, in torso space.
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const h = P.hands[i];
      const p = P.poles[i];
      vS.set(0, SHOULDER_Y, side * SHOULDER_Z * look.build);
      vT.set(h[0], h[1] + breath * 0.004, h[2]);
      vP.set(p[0], p[1], p[2]);
      // A free arm swings with the walk; one holding something stays put.
      const swings = pose === 'walk' || (walking && key === 'carryCoffee' && i === 1) || (walking && key === 'carryBasket' && i === 1);
      if (swings && walking) {
        const s = Math.sin(ph + (i === 0 ? Math.PI : 0));
        vT.x += 0.2 * s;
        vT.y += 0.035 * s * s + (s > 0 ? 0.03 * s : 0);
      } else if (walking) {
        // Hands stay on the load; it bobs a little with the stride.
        vT.y += 0.012 * Math.cos(2 * ph);
      } else if (pose === 'tablet' && i === 0) {
        // The free hand taps and scrolls, and rests while the eyes are up.
        const busy = 1 - glance;
        vT.y += 0.04 * Math.max(0, Math.sin(t * 6.5)) * busy;
        vT.z += 0.04 * Math.sin(t * 1.3) * busy;
      } else if (pose === 'inspect') {
        // Reach over the work and back: the leading hand goes out and down,
        // the other follows a little.
        const k = i === 0 ? 1 : 0.4;
        vT.x += 0.2 * reach * k;
        vT.y -= 0.16 * reach * k;
        vT.z += 0.04 * Math.sin(t * 0.6) * k;
      } else if (pose === 'sit') {
        // Typing: the hands take turns on the keys and drift along the
        // keyboard; both rest while the head is turned.
        const busy = 1 - glance;
        vT.y += 0.03 * Math.max(0, Math.sin(t * 9 + i * 2.1)) * busy;
        vT.z += 0.035 * Math.sin(t * 0.9 + i) * busy;
      } else if (pose === 'sitSip' && i === 0) {
        // Cup from the table to the lips and back.
        vT.x += (0.16 - h[0]) * sip;
        vT.y += (1.48 - h[1]) * sip;
        vT.z += (0.07 - h[2]) * sip;
      } else if (pose === 'stand') {
        vT.x += 0.03 * Math.sin(t * 0.7 + i);
      }
      const upper = (i === 0 ? armR : armL).current;
      const lower = (i === 0 ? foreR : foreL).current;
      const hand = (i === 0 ? handR : handL).current;
      if (!upper || !lower || !hand) continue;
      solveLimb(upper, lower, UPPER_ARM, FOREARM);
      hand.position.copy(vEnd);
      hand.quaternion.copy(lower.quaternion);
    }

    // Legs, in root space, so planted feet stay planted.
    const seated = pose === 'sit' || pose === 'sitSip';
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const f = P.feet[i];
      let fx = f[0];
      let lift = f[1];
      let pitch = f[2];
      if (walking) {
        const a = ph + (i === 0 ? 0 : Math.PI);
        const s = Math.sin(a);
        const c = Math.cos(a);
        fx = WALK_STRIDE * s;
        lift = 0.085 * Math.max(0, c) + 0.035 * Math.max(0, -s);
        pitch = 0.3 * s;
      } else if (seated) {
        pitch = 0;
        // Fidget: one foot taps now and then.
        if (i === 0) lift = 0.03 * Math.max(0, Math.sin(t * 5)) * glance;
      }
      vS.set(P.pelvis[0], HIP_Y + pelvisY, swayZ + side * HIP_Z);
      vT.set(fx, ANKLE_Y + lift, side * FOOT_Z + (seated ? f[2] : 0));
      vP.set(1, seated ? 0.6 : 0, side * 0.12);
      const upper = (i === 0 ? thighR : thighL).current;
      const lower = (i === 0 ? shinR : shinL).current;
      const boot = (i === 0 ? bootR : bootL).current;
      if (!upper || !lower || !boot) continue;
      solveLimb(upper, lower, THIGH, SHIN);
      boot.position.copy(vEnd);
      boot.rotation.set(0, walking ? 0 : -side * 0.1, pitch);
    }
  });

  const [topColour, bottomColour, shoeColour] = look.colours;
  const skinMat = matte(PALETTE.skinTones[skin % PALETTE.skinTones.length], 0.62);
  const top = matte(studioWhite(topColour, 0.72), 0.72);
  const trousers = matte(bottomColour, 0.8);
  const shoe = matte(shoeColour, 0.5);
  const sole = matte(PALETTE.steelDark, 0.8);
  const hair = matte(look.hair, 0.85);
  const dark = matte('#1c1d21', 0.5);
  const hiVis = matte(outfit === 'courier' ? PALETTE.orange : PALETTE.tdzYellow, 0.7);
  const reflective = matte('#e9edf0', 0.35);
  const capMat = outfit === 'courier' ? plastic(PALETTE.tdzInk, 0.5) : plastic('#232a38', 0.5);
  const hasCap = outfit === 'courier' || outfit === 'guard';
  const b = look.build;
  const jacketFront = (y: number) => jacketR(y) * DEPTH;

  const hand = (side: 1 | -1) => (
    <>
      <Part g={cyl(0.03, 0.033, 0.06, 14)} m={skinMat} position-y={-0.012} />
      <Part g={sphere(0.044, 14, 10)} m={skinMat} position-y={-0.045} scale={[0.86, 1.22, 0.72]} />
      <Part g={capsule(0.013, 0.03, 6)} m={skinMat} position={[0.03, -0.04, 0]} rotation-z={0.5} />
      {side === 1 && (carrying === 'coffee' || pose === 'sitSip') && (
        <group position={[0.035, -0.07, 0]}>
          <Part g={cyl(0.042, 0.032, 0.12, 16)} m={plastic('#f4f5f7', 0.5)} />
          <Part g={cyl(0.046, 0.046, 0.018, 16)} m={plastic(PALETTE.tdzInk, 0.5)} position-y={0.066} />
          <Part g={cyl(0.044, 0.04, 0.035, 16)} m={matte(PALETTE.bark, 0.8)} position-y={-0.005} />
        </group>
      )}
      {carrying === 'bags' && (
        <group position={[0, -0.09, 0]}>
          <Part g={torus(0.05, 0.008, 12, Math.PI)} m={matte(PALETTE.tdzInk, 0.6)} rotation-x={Math.PI / 2} rotation-z={Math.PI} position-y={-0.01} />
          <Part
            g={rbox(0.26, 0.3, 0.1, 0.02, 2)}
            m={plastic(side === 1 ? PALETTE.orange : PALETTE.cafeGreen, 0.55)}
            position-y={-0.2}
          />
        </group>
      )}
    </>
  );

  const arm = (upper: Ref, lower: Ref, handRef: Ref, side: 1 | -1) => (
    <>
      <group ref={upper}>
        <Part g={limb(0.057, 0.046, UPPER_ARM)} m={top} />
      </group>
      <group ref={lower}>
        <Part g={limb(0.046, 0.04, FOREARM - 0.045)} m={outfit === 'analyst' || outfit === 'guard' ? top : skinMat} />
      </group>
      <group ref={handRef}>{hand(side)}</group>
    </>
  );

  const leg = (upper: Ref, lower: Ref, foot: Ref) => (
    <>
      <group ref={upper}>
        <Part g={limb(0.08, 0.066, THIGH)} m={trousers} />
      </group>
      <group ref={lower}>
        <Part g={limb(0.066, 0.05, SHIN - 0.06)} m={trousers} />
      </group>
      <group ref={foot}>
        <Part g={cyl(0.059, 0.062, 0.075, 16)} m={shoe} position-y={0.002} />
        <Part g={rbox(0.225, 0.085, 0.104, 0.04, 4)} m={shoe} position={[0.048, -0.048, 0]} />
        <Part g={rbox(0.237, 0.026, 0.112, 0.012, 2)} m={sole} position={[0.048, -0.084, 0]} />
      </group>
    </>
  );

  return (
    // `dynamic` keeps the scene's static batcher from freezing the figure;
    // its own rigid parts are merged per bone instead (see useLayoutEffect).
    <group ref={root} {...props} userData={{ dynamic: true }}>
      <group scale={look.scale}>
        {leg(thighR, shinR, bootR)}
        {leg(thighL, shinL, bootL)}

        <group ref={body}>
          {/* Seat of the trousers, bridging the two thighs under the top. */}
          <Part g={sphere(0.1)} m={trousers} position-y={0.9} scale={[0.95, 0.95, 1.36 * b]} />

          <group ref={torso} position-y={HIP_Y}>
            <group position-y={-HIP_Y}>
              <Part g={lathe('jacket', JACKET, 26)} m={top} scale={[DEPTH, 1, b]} />
              <Part g={torus(0.057, 0.017, 20)} m={top} position-y={1.478} rotation-x={Math.PI / 2} scale={[0.95, 1, 1]} />
              {outfit === 'barista' && (
                // Apron: a green bib over the front of the shirt.
                <Part g={rbox(0.02, 0.5, 0.26 * b, 0.01, 2)} m={matte(PALETTE.cafeGreen, 0.7)} position={[jacketFront(1.05) + 0.012, 1.08, 0]} />
              )}
              {(outfit === 'analyst' || outfit === 'guard') && (
                // Lanyard pass (analysts) or badge (the guard) on the chest.
                <Part
                  g={rbox(0.008, 0.06, 0.045, 0.004, 1)}
                  m={plastic(outfit === 'guard' ? PALETTE.gold : PALETTE.blue)}
                  position={[jacketFront(outfit === 'guard' ? 1.31 : 1.2) + 0.006, outfit === 'guard' ? 1.31 : 1.2, outfit === 'guard' ? -0.08 * b : 0]}
                  castShadow={false}
                />
              )}
              {vest && (
                <>
                  <Part g={lathe('vest', VEST, 26)} m={hiVis} scale={[DEPTH + 0.03, 1, b]} />
                  <Part g={lathe('vestBandA', band(0.98, 1.04), 26)} m={reflective} scale={[DEPTH + 0.03, 1, b]} castShadow={false} />
                  <Part g={lathe('vestBandB', band(1.17, 1.23), 26)} m={reflective} scale={[DEPTH + 0.03, 1, b]} castShadow={false} />
                </>
              )}

              <Part g={cyl(0.04, 0.046, 0.1, 14)} m={skinMat} position-y={1.515} />

              <group ref={head} position={[0.008, NECK_Y, 0]}>
                <group position-y={0.14} scale={1.1}>
                  <Part g={sphere(0.108, 24, 18)} m={skinMat} scale={[1, 1.13, 0.9]} />
                  <Part g={sphere(0.07, 16, 12)} m={skinMat} position={[0.024, -0.066, 0]} scale={[1, 0.9, 0.96]} />
                  <Part g={sphere(0.017, 10, 8)} m={skinMat} position={[0.107, -0.014, 0]} scale={[1, 1.35, 0.9]} castShadow={false} />
                  {[1, -1].map((s) => (
                    <group key={s}>
                      <Part g={sphere(0.022, 10, 8)} m={skinMat} position={[-0.002, -0.012, s * 0.096]} scale={[0.6, 1.2, 0.5]} />
                      <Part g={sphere(0.0115, 8, 6)} m={dark} position={[0.0965, 0.02, s * 0.038]} scale={[0.5, 1.25, 1]} castShadow={false} />
                      <Part g={rbox(0.008, 0.005, 0.03, 0.002, 1)} m={hair} position={[0.097, 0.05, s * 0.039]} castShadow={false} />
                    </group>
                  ))}
                  {/* Hair: a cap of it over the crown, and for some a fall
                      of it down the back. */}
                  <Part g={dome(0.118, Math.PI * 0.52)} m={hair} position={[-0.012, 0.012, 0]} rotation-z={0.36} scale={[1.02, 1.08, 0.97]} />
                  {look.longHair && !hasCap && (
                    <Part g={capsule(0.075, 0.12, 8)} m={hair} position={[-0.075, -0.06, 0]} rotation-z={0.15} scale={[0.75, 1, 1.2]} />
                  )}
                  {hasCap && (
                    <>
                      <Part g={dome(0.122, Math.PI * 0.5)} m={capMat} position={[-0.008, 0.03, 0]} rotation-z={0.22} />
                      <Part g={cyl(0.07, 0.07, 0.012, 20)} m={capMat} position={[0.1, 0.045, 0]} scale={[1.2, 1, 1.25]} rotation-z={-0.1} />
                    </>
                  )}
                </group>
              </group>

              {arm(armR, foreR, handR, 1)}
              {arm(armL, foreL, handL, -1)}

              {pose === 'tablet' && carrying !== 'phone' && (
                <group position={[0.275, 1.118, -0.025]} rotation={[0, 0.12, 0.6]}>
                  <Part g={rbox(0.25, 0.014, 0.18, 0.007, 2)} m={plastic(PALETTE.graphite, 0.35)} />
                  <mesh geometry={rbox(0.226, 0.004, 0.156, 0.002, 1)} material={glow('#cfe1ff', 0.55)} position-y={0.008} />
                </group>
              )}
              {pose === 'tablet' && carrying === 'phone' && (
                <group position={[0.255, 1.1, -0.06]} rotation={[0, 0.12, 0.75]}>
                  <Part g={rbox(0.1, 0.012, 0.055, 0.006, 2)} m={plastic(PALETTE.tdzInk, 0.3)} />
                  <mesh geometry={rbox(0.088, 0.004, 0.046, 0.002, 1)} material={glow('#cfe1ff', 0.7)} position-y={0.007} />
                </group>
              )}
              {key === 'carryBox' && <Carton size={[0.36, 0.3, 0.44]} position={[0.31, 0.955, 0]} />}
              {key === 'carryLaptop' && (
                <group position={[0.27, 1.02, 0]}>
                  <Part g={rbox(0.24, 0.03, 0.33, 0.01, 2)} m={plastic('#c7ccd3', 0.3)} />
                </group>
              )}
              {key === 'carryBasket' && (
                <group position={[0.14, 0.72, 0.27]}>
                  <Part g={rbox(0.36, 0.2, 0.26, 0.03, 2)} m={plastic(PALETTE.blue, 0.45)} />
                  <Part g={rbox(0.32, 0.06, 0.22, 0.02, 2)} m={plastic(PALETTE.orange, 0.5)} position={[0.03, 0.11, 0]} />
                  <Part g={torus(0.11, 0.01, 12, Math.PI)} m={plastic(PALETTE.blueDeep, 0.45)} position={[-0.03, 0.1, 0]} />
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
