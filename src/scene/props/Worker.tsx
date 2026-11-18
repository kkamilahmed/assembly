// A bakery worker in food-plant whites: white jacket, hairnet, blue nitrile
// gloves, dark trousers, white safety boots. About 1.75 m tall, origin on the
// ground between the feet, facing +x.
//
// The figure is posed by targets rather than joint angles: each pose says
// where the hands and feet are, and a two-bone solver bends the elbows and
// knees to reach them. That keeps hands on the things they hold and boots
// flat on the floor whatever the torso is doing.
import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glow, matte, PALETTE, plastic } from '@/scene/style';
import { capsule, cyl, dome, lathe, limb, rbox, rng, sphere, studioWhite, torus } from './kit';
import { crustMaterial, LOAF, loafGeometry, loafScoreGeometry, scoreMaterial } from './loaf';
import { Instances, Part } from './Part';
import { Carton } from './Stock';
import { WALK_RATE, WALK_STRIDE } from './workerRig';

export type WorkerPose = 'stand' | 'tablet' | 'carry' | 'push' | 'inspect' | 'walk';

type GroupProps = Omit<ThreeElements['group'], 'children'>;
type Ref = RefObject<THREE.Group | null>;

export interface WorkerProps extends GroupProps {
  pose?: WorkerPose;
  /** Index into PALETTE.skinTones. */
  skin?: number;
  /** Orange hi-vis vest over the whites (yard and forklift staff). */
  vest?: boolean;
  /** Varies height, hair, headwear and animation phase. */
  seed?: number;
  /** What a 'carry' worker holds. */
  carrying?: 'box' | 'tray';
}

// Skeleton, in metres. z is the worker's right.
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

const POSES: Record<Exclude<WorkerPose, 'carry'> | 'carryBox' | 'carryTray', Pose> = {
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
  carryTray: {
    lean: -0.04,
    headPitch: 0.06,
    headYaw: 0,
    pelvis: [0, 0],
    hands: [[0.29, 1.06, 0.3], [0.29, 1.06, -0.3]],
    poles: [[-0.6, -0.7, 1], [-0.6, -0.7, -1]],
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
};

const WHITES = studioWhite(PALETTE.coat, 0.62);

const HAIR = ['#2a1f18', '#17171a', '#4b3524', '#6d4c30', '#3a2a20', '#8b6b46'];

// Solver scratch, shared by every worker (frames run one at a time).
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

let trayLoaves: THREE.Matrix4[] | undefined;
function trayLoafMatrices(): THREE.Matrix4[] {
  if (!trayLoaves) {
    trayLoaves = [];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        trayLoaves.push(new THREE.Matrix4().compose(new THREE.Vector3((i - 1) * 0.13, 0.012, (j - 0.5) * (LOAF.l + 0.02)), q, s));
      }
    }
  }
  return trayLoaves;
}

export function Worker({ pose = 'stand', skin = 0, vest = false, seed = 1, carrying = 'box', ...props }: WorkerProps) {
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
    return {
      // A touch larger than life, the way the references draw people:
      // at the overview zoom they are the storytellers, not ant-sized.
      scale: (0.965 + r() * 0.06) * 1.28,
      build: 0.96 + r() * 0.1,
      hair: HAIR[Math.floor(r() * HAIR.length)],
      visorCap: r() < 0.28,
      phase: r() * 20,
    };
  }, [seed, skin]);

  const key = pose === 'carry' ? (carrying === 'tray' ? 'carryTray' : 'carryBox') : pose;
  const P = POSES[key];

  useFrame(({ clock }) => {
    if (!body.current || !torso.current || !head.current) return;
    const t = clock.elapsedTime + look.phase;
    const breath = Math.sin(t * 1.7);
    const sway = Math.sin(t * 0.55);
    const walking = pose === 'walk';
    const ph = t * WALK_RATE;
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
      headYaw += 0.22 * Math.sin(t * 0.31) + 0.08 * Math.sin(t * 0.83);
    } else if (pose === 'inspect') {
      headYaw += 0.1 * Math.sin(t * 0.5);
      lean += 0.02 * Math.sin(t * 0.5);
    } else if (pose === 'tablet') {
      headPitch += 0.04 * Math.sin(t * 0.4);
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
      if (walking) {
        const s = Math.sin(ph + (i === 0 ? Math.PI : 0));
        vT.x += 0.2 * s;
        vT.y += 0.035 * s * s + (s > 0 ? 0.03 * s : 0);
      } else if (pose === 'tablet' && i === 0) {
        // The free hand taps and scrolls.
        vT.x += 0.02 * Math.sin(t * 2.3);
        vT.z += 0.02 * Math.sin(t * 1.3);
      } else if (pose === 'inspect' && i === 0) {
        vT.x += 0.04 * Math.sin(t * 0.9);
        vT.z += 0.05 * Math.sin(t * 0.6);
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
      }
      vS.set(P.pelvis[0], HIP_Y + pelvisY, swayZ + side * HIP_Z);
      vT.set(fx, ANKLE_Y + lift, side * FOOT_Z);
      vP.set(1, 0, side * 0.12);
      const upper = (i === 0 ? thighR : thighL).current;
      const lower = (i === 0 ? shinR : shinL).current;
      const boot = (i === 0 ? bootR : bootL).current;
      if (!upper || !lower || !boot) continue;
      solveLimb(upper, lower, THIGH, SHIN);
      boot.position.copy(vEnd);
      boot.rotation.set(0, walking ? 0 : -side * 0.1, pitch);
    }
  });

  const skinMat = matte(PALETTE.skinTones[skin % PALETTE.skinTones.length], 0.62);
  const coat = matte(WHITES, 0.72);
  const trousers = matte(PALETTE.trousers, 0.8);
  const glove = plastic(PALETTE.glove, 0.45);
  const boot = matte(WHITES, 0.5);
  const sole = matte(PALETTE.steelDark, 0.8);
  const hair = matte(look.hair, 0.85);
  const net = look.visorCap ? matte(WHITES, 0.7) : matte(PALETTE.hairnet, 0.6);
  const dark = matte('#1c1d21', 0.5);
  const hiVis = matte(PALETTE.orange, 0.7);
  const reflective = matte('#e9edf0', 0.35);
  const b = look.build;

  const arm = (upper: Ref, lower: Ref, hand: Ref) => (
    <>
      <group ref={upper}>
        <Part g={limb(0.057, 0.046, UPPER_ARM)} m={coat} />
      </group>
      <group ref={lower}>
        <Part g={limb(0.046, 0.04, FOREARM - 0.045)} m={coat} />
      </group>
      <group ref={hand}>
        <Part g={cyl(0.03, 0.033, 0.06, 14)} m={glove} position-y={-0.012} />
        <Part g={sphere(0.044, 14, 10)} m={glove} position-y={-0.045} scale={[0.86, 1.22, 0.72]} />
        <Part g={capsule(0.013, 0.03, 6)} m={glove} position={[0.03, -0.04, 0]} rotation-z={0.5} />
      </group>
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
        <Part g={cyl(0.059, 0.062, 0.075, 16)} m={boot} position-y={0.002} />
        <Part g={rbox(0.225, 0.085, 0.104, 0.04, 4)} m={boot} position={[0.048, -0.048, 0]} />
        <Part g={rbox(0.237, 0.026, 0.112, 0.012, 2)} m={sole} position={[0.048, -0.084, 0]} />
      </group>
    </>
  );

  return (
    <group {...props}>
      <group scale={look.scale}>
        {leg(thighR, shinR, bootR)}
        {leg(thighL, shinL, bootL)}

        <group ref={body}>
          {/* Seat of the trousers, bridging the two thighs under the jacket. */}
          <Part g={sphere(0.1)} m={trousers} position-y={0.9} scale={[0.95, 0.95, 1.36 * b]} />

          <group ref={torso} position-y={HIP_Y}>
            <group position-y={-HIP_Y}>
              <Part g={lathe('jacket', JACKET, 26)} m={coat} scale={[DEPTH, 1, b]} />
              <Part g={torus(0.057, 0.017, 20)} m={coat} position-y={1.478} rotation-x={Math.PI / 2} scale={[0.95, 1, 1]} />
              {!vest && [0.92, 1.03, 1.14, 1.25].map((y) => (
                <Part key={y} g={sphere(0.0095, 8, 6)} m={matte(PALETTE.steel, 0.4)} position={[jacketR(y) * DEPTH + 0.002, y, 0]} castShadow={false} />
              ))}
              {/* Name badge on the left chest. */}
              <Part
                g={rbox(0.008, 0.042, 0.066, 0.004, 1)}
                m={plastic(PALETTE.blue)}
                position={[Math.sqrt(Math.max(0, jacketR(1.31) ** 2 - 0.085 ** 2)) * DEPTH + 0.001, 1.31, -0.085 * b]}
                rotation-y={0.38}
                castShadow={false}
              />
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
                  {/* Hair shows at the forehead, temples and nape under the net. */}
                  <Part g={dome(0.112, Math.PI * 0.5)} m={hair} position={[-0.004, 0.006, 0]} rotation-z={0.42} scale={[1, 1.12, 0.93]} />
                  <group position={[-0.016, 0.012, 0]} rotation-z={0.4}>
                    <Part g={dome(0.121, Math.PI * 0.46)} m={net} scale={[1.06, 0.97, 0.98]} />
                    <Part g={torus(0.12, 0.0055, 24)} m={net} position-y={0.015} rotation-x={Math.PI / 2} scale={[1.06, 0.98, 1]} />
                  </group>
                  {look.visorCap && (
                    <Part g={cyl(0.085, 0.085, 0.012, 20)} m={net} position={[0.088, 0.062, 0]} rotation-z={-0.12} scale={[1, 1, 1.05]} />
                  )}
                </group>
              </group>

              {arm(armR, foreR, handR)}
              {arm(armL, foreL, handL)}

              {pose === 'tablet' && (
                <group position={[0.275, 1.118, -0.025]} rotation={[0, 0.12, 0.6]}>
                  <Part g={rbox(0.25, 0.014, 0.18, 0.007, 2)} m={plastic(PALETTE.graphite, 0.35)} />
                  <mesh geometry={rbox(0.226, 0.004, 0.156, 0.002, 1)} material={glow('#cfe1ff', 0.55)} position-y={0.008} />
                </group>
              )}
              {key === 'carryBox' && <Carton size={[0.36, 0.3, 0.44]} position={[0.31, 0.955, 0]} />}
              {key === 'carryTray' && (
                <group position={[0.37, 1.045, 0]}>
                  <Part g={rbox(0.42, 0.022, 0.62, 0.01, 2)} m={plastic(PALETTE.steelDark, 0.45)} />
                  <Instances g={loafGeometry()} m={crustMaterial()} matrices={trayLoafMatrices()} />
                  <Instances g={loafScoreGeometry()} m={scoreMaterial()} matrices={trayLoafMatrices()} shadows={false} />
                </group>
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
