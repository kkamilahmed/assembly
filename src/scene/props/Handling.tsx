// Handling kit for the street and the warehouse: the courier's hand truck
// and a traffic cone. Origins are at the footprint centre on the ground.
// Each faces +x: toe plates and the direction of travel point that way.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, metal, PALETTE, plastic } from '@/scene/style';
import { capsule, cyl, lathe, rbox } from './kit';
import { Part } from './Part';
import { Carton } from './Stock';
import { PARCEL_CART } from './stockLayout';
import { Wheel } from './Wheel';

type GroupProps = Omit<ThreeElements['group'], 'children'>;
const HALF = Math.PI / 2;

/** A straight tube between two points. */
function Tube({ a, b, r, m }: { a: [number, number, number]; b: [number, number, number]; r: number; m: THREE.Material }) {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  // Keyed on the numbers: call sites pass fresh tuple literals each render.
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(ax, ay, az);
    const vb = new THREE.Vector3(bx, by, bz);
    const dir = vb.clone().sub(va);
    const l = dir.length();
    return {
      pos: va.clone().add(vb).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
      len: Math.round(l * 1000) / 1000,
    };
  }, [ax, ay, az, bx, by, bz]);
  return <Part g={capsule(r, len, 8)} m={m} position={pos} quaternion={quat} />;
}

// ----------------------------------------------------------- hand truck

/** Blue hand truck standing on its toe plate, plate toward +x. `cartons`
 *  stacks that many boxes on it. */
export function HandTruck({ cartons = 0, ...props }: GroupProps & { cartons?: number }) {
  const blue = plastic(PALETTE.blue);
  const dark = matte(PALETTE.graphite, 0.6);
  const steel = metal(PALETTE.steel, 0.32);
  const size: [number, number, number] = [0.34, 0.3, 0.44];
  return (
    <group {...props}>
      {[1, -1].map((s) => (
        <Wheel key={s} r={0.13} w={0.07} position={[-0.1, 0.13, s * 0.29]} />
      ))}
      <Part g={cyl(0.016, 0.016, 0.56, 10)} m={steel} position={[-0.1, 0.13, 0]} rotation-x={HALF} />
      <Part g={rbox(0.32, 0.014, 0.46, 0.006, 1)} m={steel} position={[0.14, 0.012, 0]} />
      <Part g={rbox(0.014, 0.05, 0.46, 0.006, 1)} m={steel} position={[-0.015, 0.035, 0]} />
      <group position={[-0.02, 0.03, 0]} rotation-z={0.09}>
        {[1, -1].map((s) => (
          <group key={s}>
            <Tube a={[0, 0, s * 0.21]} b={[0, 1.12, s * 0.21]} r={0.019} m={blue} />
            {/* Handles sweep back from the top of each rail. */}
            <Tube a={[0, 1.12, s * 0.21]} b={[-0.16, 1.24, s * 0.21]} r={0.019} m={blue} />
            <Tube a={[-0.1, 1.195, s * 0.21]} b={[-0.2, 1.27, s * 0.21]} r={0.026} m={dark} />
            <Tube a={[0, 0.3, s * 0.21]} b={[-0.09, 0.12, s * 0.24]} r={0.015} m={blue} />
          </group>
        ))}
        {[0.22, 0.52, 0.82, 1.12].map((y) => (
          <Tube key={y} a={[0, y, -0.21]} b={[0, y, 0.21]} r={0.016} m={blue} />
        ))}
        <Tube a={[0, 0.22, 0]} b={[0, 1.12, 0]} r={0.013} m={blue} />
      </group>
      {Array.from({ length: cartons }, (_, i) => (
        <Carton key={i} size={size} position={[0.17 - i * 0.012, 0.02 + i * 0.302, 0]} rotation-y={(i % 2 ? 1 : -1) * 0.04} />
      ))}
    </group>
  );
}

// ----------------------------------------------------------------- cone

const CONE_R = (y: number) => 0.14 - ((y - 0.04) * 0.105) / 0.62;

/** Traffic cone, 0.7 tall, orange with two reflective bands. */
export function Cone(props: GroupProps) {
  const orange = plastic(PALETTE.orange, 0.42);
  const white = plastic(PALETTE.offWhite, 0.4);
  const bandA: Array<[number, number]> = [[CONE_R(0.26) + 0.003, 0.26], [CONE_R(0.38) + 0.003, 0.38]];
  const bandB: Array<[number, number]> = [[CONE_R(0.46) + 0.003, 0.46], [CONE_R(0.54) + 0.003, 0.54]];
  return (
    <group {...props}>
      <Part g={rbox(0.4, 0.04, 0.4, 0.018, 3)} m={orange} position-y={0.02} />
      <Part
        g={lathe('cone', [[0.165, 0.03], [0.15, 0.045], [CONE_R(0.06), 0.06], [CONE_R(0.66), 0.66], [0.028, 0.69], [0.016, 0.7], [0, 0.7]], 24)}
        m={orange}
      />
      <Part g={lathe('coneBandA', bandA, 24)} m={white} castShadow={false} />
      <Part g={lathe('coneBandB', bandB, 24)} m={white} castShadow={false} />
    </group>
  );
}

// ---------------------------------------------------------- parcel cart

/** Flat parcel cart with a push handle at its -x end and a few TechDealz
 *  boxes on the deck. A pushing person stands at -(PUSH_GRIP.x + l / 2). */
export function ParcelCart({ boxes = 3, ...props }: GroupProps & { boxes?: number }) {
  const { l, w, deck } = PARCEL_CART;
  const blue = plastic(PALETTE.blue);
  const dark = matte(PALETTE.graphite, 0.6);
  const steel = metal(PALETTE.steel, 0.32);
  return (
    <group {...props}>
      <Part g={rbox(l, 0.05, w, 0.02, 2)} m={blue} position-y={deck} />
      <Part g={rbox(l - 0.06, 0.012, w - 0.06, 0.005, 1)} m={dark} position-y={deck + 0.03} castShadow={false} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * (l / 2 - 0.1), 0, sz * (w / 2 - 0.08)]}>
            <Part g={rbox(0.05, 0.08, 0.05, 0.012, 1)} m={steel} position-y={deck - 0.06} />
            <Part g={cyl(0.065, 0.065, 0.04, 16)} m={dark} position-y={0.065} rotation-x={HALF} />
          </group>
        )),
      )}
      {/* Handle: two uprights and a grip bar at hand height. */}
      {[1, -1].map((s) => (
        <Tube key={s} a={[-l / 2 + 0.03, deck, s * (w / 2 - 0.05)]} b={[-l / 2 - 0.02, 1.12, s * (w / 2 - 0.05)]} r={0.018} m={blue} />
      ))}
      <Tube a={[-l / 2 - 0.02, 1.12, -(w / 2 - 0.05)]} b={[-l / 2 - 0.02, 1.12, w / 2 - 0.05]} r={0.024} m={dark} />
      {Array.from({ length: boxes }, (_, i) => (
        <Carton
          key={i}
          size={i === 2 ? [0.34, 0.24, 0.3] : [0.42, 0.3, 0.5]}
          position={[i === 2 ? 0.12 : -0.18 + i * 0.44, deck + 0.025 + (i === 2 ? 0.3 : 0), 0]}
          rotation-y={(i % 2 ? 1 : -1) * 0.05}
        />
      ))}
    </group>
  );
}
