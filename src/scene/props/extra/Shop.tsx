// Shop fittings for the sources: the cafe's tables, chairs, parasol and
// counter, the mall's shelves and checkout, the online store's server rack.
// Built life-size and scaled to the people. Origins are at the footprint
// centre on the ground. Counters face +x: staff stand on the -x side,
// customers on the +x side.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { screenMaterial } from '@/scene/buildings/kit';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { cyl, mergedBoxes, rbox, rng, type BoxSpec } from '@/scene/props/kit';
import { Instances, Part } from '@/scene/props/Part';
import { PERSON_SCALE } from '@/scene/props/personRig';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

/** Round cafe table, 0.74 high, with a cup or two on it. */
export function CafeTable({ cups = 1, ...props }: GroupProps & { cups?: number }) {
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={cyl(0.36, 0.36, 0.035, 28)} m={plastic('#f4f5f7', 0.35)} position-y={0.725} />
        <Part g={cyl(0.03, 0.03, 0.7, 10)} m={metal(PALETTE.graphite, 0.4)} position-y={0.36} />
        <Part g={cyl(0.22, 0.24, 0.03, 20)} m={metal(PALETTE.graphite, 0.4)} position-y={0.015} />
        {Array.from({ length: cups }, (_, i) => (
          <group key={i} position={[i ? -0.14 : 0.12, 0.79, i ? 0.12 : -0.1]}>
            <Part g={cyl(0.04, 0.032, 0.08, 14)} m={plastic('#f4f5f7', 0.45)} />
            <Part g={cyl(0.07, 0.07, 0.008, 18)} m={plastic('#f4f5f7', 0.45)} position-y={-0.04} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Bistro chair facing +x, seat 0.47 high. */
export function StoolChair({ color = PALETTE.cafeGreen, ...props }: GroupProps & { color?: string }) {
  const frame = metal(PALETTE.graphite, 0.4);
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={rbox(0.4, 0.05, 0.4, 0.02, 2)} m={plastic(color, 0.45)} position={[-0.02, 0.445, 0]} />
        <Part g={rbox(0.04, 0.36, 0.38, 0.02, 2)} m={plastic(color, 0.45)} position={[-0.22, 0.68, 0]} rotation-z={0.1} />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <Part key={`${sx}${sz}`} g={cyl(0.015, 0.015, 0.43, 8)} m={frame} position={[-0.02 + sx * 0.16, 0.21, sz * 0.16]} />),
        )}
      </group>
    </group>
  );
}

/** Striped market parasol on a pole. */
export function Parasol({ color = PALETTE.cafeGreen, ...props }: GroupProps & { color?: string }) {
  const panels = 8;
  return (
    <group {...props}>
      <Part g={cyl(0.03, 0.03, 2.6, 10)} m={metal(PALETTE.steel, 0.3)} position-y={1.3} />
      <Part g={cyl(0.22, 0.26, 0.06, 16)} m={plastic(PALETTE.graphite, 0.4)} position-y={0.03} />
      {Array.from({ length: panels }, (_, i) => (
        <mesh key={i} position-y={2.45} rotation-y={(i / panels) * Math.PI * 2} castShadow receiveShadow material={plastic(i % 2 ? '#f4f5f7' : color, 0.55)}>
          <coneGeometry args={[1.25, 0.45, 2, 1, true, 0, (Math.PI * 2) / panels]} />
        </mesh>
      ))}
      <Part g={cyl(0.04, 0.02, 0.12, 8)} m={metal(PALETTE.steel, 0.3)} position-y={2.72} />
    </group>
  );
}

/** A card terminal on a counter: dark body, lit screen facing +x. */
function Terminal(props: GroupProps) {
  return (
    <group {...props}>
      <Part g={rbox(0.08, 0.04, 0.12, 0.015, 2)} m={plastic(PALETTE.tdzInk, 0.35)} position-y={0.02} />
      <Part g={rbox(0.05, 0.16, 0.1, 0.015, 2)} m={plastic(PALETTE.tdzInk, 0.35)} position={[0, 0.1, 0]} rotation-z={-0.35} />
      <mesh position={[0.03, 0.115, 0]} rotation={[0, Math.PI / 2, 0.35]} material={screenMaterial('pos')}>
        <planeGeometry args={[0.085, 0.11]} />
      </mesh>
    </group>
  );
}

/** Cafe counter, 2.2 long on z, with the espresso machine, a pastry case
 *  and the card terminal customers tap their phones on. */
export function CoffeeCounter(props: GroupProps) {
  const body = plastic(PALETTE.cafeGreen, 0.45);
  const top = plastic('#f4f5f7', 0.3);
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={rbox(0.6, 0.9, 2.2, 0.04, 3)} m={body} position-y={0.45} />
        <Part g={rbox(0.7, 0.05, 2.3, 0.02, 2)} m={top} position-y={0.925} />
        {/* Espresso machine. */}
        <group position={[-0.1, 0.95, -0.55]}>
          <Part g={rbox(0.4, 0.38, 0.6, 0.05, 3)} m={metal(PALETTE.steel, 0.25)} position-y={0.19} />
          <Part g={rbox(0.06, 0.06, 0.5, 0.02, 2)} m={plastic(PALETTE.tdzInk, 0.4)} position={[0.21, 0.2, 0]} />
          {[-0.12, 0.12].map((z) => (
            <Part key={z} g={cyl(0.03, 0.03, 0.1, 10)} m={metal(PALETTE.steelDark, 0.3)} position={[0.2, 0.1, z]} />
          ))}
        </group>
        {/* Pastry case. */}
        <group position={[0.05, 0.95, 0.35]}>
          <Part g={rbox(0.44, 0.04, 0.7, 0.015, 2)} m={top} position-y={0.02} />
          {[-0.2, 0, 0.2].map((z, i) => (
            <Part key={z} g={rbox(0.12, 0.07, 0.14, 0.03, 2)} m={matte(i === 1 ? '#c98a3f' : '#d9a35a', 0.7)} position={[0, 0.075, z]} />
          ))}
          <mesh position={[0, 0.17, 0]} material={plastic(PALETTE.glass, 0.05)}>
            <boxGeometry args={[0.42, 0.26, 0.68]} />
          </mesh>
        </group>
        <Terminal position={[0.2, 0.95, -0.05]} />
      </group>
    </group>
  );
}

/** Mall checkout, 1.6 long on z, with a belt top and a terminal. */
export function CheckoutCounter(props: GroupProps) {
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={rbox(0.7, 0.86, 1.6, 0.04, 3)} m={plastic('#f4f5f7', 0.4)} position-y={0.43} />
        <Part g={rbox(0.5, 0.02, 1.2, 0.01, 2)} m={matte(PALETTE.tdzInk, 0.7)} position={[0, 0.87, 0.15]} castShadow={false} />
        <Part g={rbox(0.72, 0.1, 1.62, 0.03, 2)} m={plastic(PALETTE.blue, 0.4)} position-y={0.7} />
        <Terminal position={[0.24, 0.86, -0.58]} />
        <Part g={rbox(0.16, 0.24, 0.24, 0.03, 2)} m={plastic(PALETTE.graphite, 0.4)} position={[-0.18, 0.98, -0.5]} />
      </group>
    </group>
  );
}

const GOODS = ['#3b86e3', '#f2782a', '#2fb574', '#f5b53d', '#e5484d', '#f4f5f7', '#2f3a4d', '#7cc4e8'];

/** A run of shop shelving, `length` long on z, stocked with brightly
 *  packaged goods. Open to +x. */
export function ShopShelf({ length = 2.4, levels = 4, seed = 1, ...props }: GroupProps & { length?: number; levels?: number; seed?: number }) {
  const { frame, goods } = useMemo(() => {
    const rand = rng(seed * 11 + 3);
    const frame = mergedBoxes(`shelf:${length}:${levels}`, () => {
      const out: BoxSpec[] = [{ size: [0.04, 0.2 + levels * 0.36, length], pos: [-0.2, 0.1 + levels * 0.18, 0], r: 0.012 }];
      for (const z of [-length / 2, length / 2]) out.push({ size: [0.44, 0.2 + levels * 0.36, 0.04], pos: [0, 0.1 + levels * 0.18, z], r: 0.012 });
      for (let i = 0; i < levels; i++) out.push({ size: [0.42, 0.03, length], pos: [0, 0.12 + i * 0.36, 0], r: 0.01 });
      return out;
    });
    const goods: Record<string, THREE.Matrix4[]> = {};
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3();
    for (let i = 0; i < levels; i++) {
      let z = -length / 2 + 0.1;
      while (z < length / 2 - 0.12) {
        const w = 0.1 + rand() * 0.1;
        const h = 0.14 + rand() * 0.14;
        const c = GOODS[Math.floor(rand() * GOODS.length)];
        (goods[c] ??= []).push(new THREE.Matrix4().compose(new THREE.Vector3(0.02, 0.135 + i * 0.36 + h / 2, z + w / 2), q, one.set(1, h / 0.2, w / 0.15)));
        z += w + 0.02;
      }
    }
    return { frame, goods };
  }, [length, levels, seed]);
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={frame} m={plastic('#e8eaee', 0.45)} />
        {Object.entries(goods).map(([c, m]) => (
          <Instances key={c} g={rbox(0.3, 0.2, 0.15, 0.015, 1)} m={plastic(c, 0.45)} matrices={m} />
        ))}
      </group>
    </group>
  );
}

/** Server rack: a dark cabinet with rows of status lights, door facing +x.
 *  The online store lives in here; its payments start here. */
export function ServerRack(props: GroupProps) {
  const leds = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 3; j++) out.push(new THREE.Matrix4().makeTranslation(0.31, 0.35 + i * 0.17, -0.18 + j * 0.06));
    }
    return out;
  }, []);
  return (
    <group {...props}>
      <Part g={rbox(0.6, 1.9, 0.62, 0.04, 3)} m={plastic(PALETTE.tdzInk, 0.35)} position-y={0.95} />
      {Array.from({ length: 9 }, (_, i) => (
        <Part key={i} g={rbox(0.02, 0.12, 0.54, 0.008, 1)} m={plastic('#2b2f37', 0.3)} position={[0.3, 0.35 + i * 0.17, 0]} castShadow={false} />
      ))}
      <Instances g={rbox(0.012, 0.025, 0.03, 0.005, 1)} m={glow(PALETTE.healthy, 1.6)} matrices={leds} shadows={false} />
    </group>
  );
}
