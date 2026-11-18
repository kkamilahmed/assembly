// Handling equipment for the yard and the shop floor: forklift, pallet
// jack, hand truck, traffic cone and the dry room's cell cart.
// Origins are at the footprint centre on the ground. Each faces +x: forks,
// toe plates and the direction of travel point that way.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { capsule, cyl, lathe, mergedBoxes, rbox, rng, sphere, torus, type BoxSpec } from './kit';
import { cellTrayGeometry, moduleMaterial } from './module';
import { Instances, Part } from './Part';
import { Carton, CartonStack, ModuleStack } from './Stock';
import { Wheel } from './Wheel';

type GroupProps = Omit<ThreeElements['group'], 'children'>;
export type PalletLoad = 'cartons' | 'modules';

const HALF = Math.PI / 2;

function Load({ kind, seed }: { kind: PalletLoad; seed: number }) {
  return kind === 'cartons' ? <CartonStack layers={2} seed={seed} /> : <ModuleStack layers={2} seed={seed} />;
}

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

// ------------------------------------------------------------- forklift

function guardRoofGeometry() {
  return mergedBoxes('forkliftRoof', () => {
    const out: BoxSpec[] = [];
    for (const z of [-0.47, 0.47]) out.push({ size: [1.22, 0.06, 0.07], pos: [0, 0, z], r: 0.02 });
    for (const x of [-0.58, 0.58]) out.push({ size: [0.07, 0.06, 1.0], pos: [x, 0, 0], r: 0.02 });
    for (let i = 0; i < 6; i++) out.push({ size: [0.035, 0.035, 0.94], pos: [-0.42 + i * 0.168, 0, 0], r: 0.012 });
    return out;
  });
}

function backrestGeometry() {
  return mergedBoxes('forkliftBackrest', () => {
    const out: BoxSpec[] = [
      { size: [0.07, 0.42, 0.98], pos: [0, 0.25, 0], r: 0.02 },
      { size: [0.04, 0.05, 0.98], pos: [0, 1.12, 0], r: 0.015 },
    ];
    for (const z of [-0.47, -0.235, 0, 0.235, 0.47]) out.push({ size: [0.035, 0.7, 0.04], pos: [0, 0.79, z], r: 0.012 });
    return out;
  });
}

export interface ForkliftProps extends GroupProps {
  /** A loaded pallet on the forks. */
  load?: PalletLoad;
  /** Fork height above the ground. */
  lift?: number;
  seed?: number;
}

/** Counterbalance forklift, about 2.2 long plus 1.1 of fork. The forks
 *  point +x; a carried pallet sits centred at x = 1.72. */
export function Forklift({ load, lift = load ? 0.32 : 0.06, seed = 1, ...props }: ForkliftProps) {
  const orange = plastic(PALETTE.orange);
  const black = plastic('#1d1e22', 0.4);
  const graphite = plastic(PALETTE.graphite, 0.42);
  const steel = metal(PALETTE.steel, 0.3);
  const forkSteel = metal(PALETTE.steelDark, 0.38);
  const rim = plastic(PALETTE.amber, 0.4);
  return (
    <group {...props}>
      {/* Chassis, engine hood, counterweight. */}
      <Part g={rbox(1.5, 0.44, 1.06, 0.09, 4)} m={orange} position={[0.02, 0.52, 0]} />
      <Part g={rbox(0.9, 0.46, 0.96, 0.12, 4)} m={orange} position={[-0.3, 0.9, 0]} />
      <Part g={rbox(0.66, 0.84, 1.12, 0.2, 5)} m={graphite} position={[-0.8, 0.72, 0]} />
      <Part g={rbox(0.5, 0.05, 0.9, 0.02, 2)} m={black} position={[-0.82, 1.15, 0]} />
      {/* Floor plate and front cowl with the dash. */}
      <Part g={rbox(0.5, 0.06, 0.96, 0.02, 2)} m={black} position={[0.34, 0.76, 0]} />
      <Part g={rbox(0.2, 0.62, 1.0, 0.07, 3)} m={orange} position={[0.66, 0.98, 0]} />
      <Part g={rbox(0.14, 0.1, 0.5, 0.03, 2)} m={black} position={[0.62, 1.3, 0]} rotation-z={0.5} />
      {/* Side panels with a dark step. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Part g={rbox(0.44, 0.05, 0.1, 0.02, 2)} m={black} position={[0.32, 0.42, s * 0.56]} />
          <Part g={rbox(0.7, 0.07, 0.02, 0.008, 1)} m={black} position={[-0.3, 0.86, s * 0.485]} />
          <mesh geometry={rbox(0.03, 0.1, 0.16, 0.012, 2)} material={glow(PALETTE.critical, 1.2)} position={[-1.125, 0.86, s * 0.36]} />
        </group>
      ))}

      {/* Seat. */}
      <Part g={rbox(0.44, 0.11, 0.48, 0.045, 3)} m={black} position={[-0.26, 1.17, 0]} />
      <Part g={rbox(0.11, 0.5, 0.46, 0.045, 3)} m={black} position={[-0.5, 1.42, 0]} rotation-z={0.14} />
      {/* Steering column and wheel, hydraulic levers. */}
      <Tube a={[0.6, 1.2, 0]} b={[0.34, 1.5, 0]} r={0.025} m={black} />
      <group position={[0.33, 1.51, 0]} rotation-z={0.72}>
        <Part g={torus(0.15, 0.02, 24)} m={black} rotation-x={HALF} />
        <Part g={rbox(0.03, 0.02, 0.28, 0.008, 1)} m={black} />
      </group>
      {[0.3, 0.38].map((z) => (
        <group key={z}>
          <Tube a={[0.62, 1.28, z]} b={[0.56, 1.46, z]} r={0.01} m={steel} />
          <Part g={sphere(0.024, 10, 8)} m={black} position={[0.56, 1.47, z]} />
        </group>
      ))}

      {/* Overhead guard. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Tube a={[0.68, 1.22, s * 0.47]} b={[0.5, 2.2, s * 0.47]} r={0.034} m={black} />
          <Tube a={[-0.9, 1.1, s * 0.47]} b={[-0.66, 2.2, s * 0.47]} r={0.034} m={black} />
          <mesh geometry={cyl(0.055, 0.045, 0.05, 14)} material={glow('#fff3d6', 1.1)} position={[0.6, 2.06, s * 0.47]} rotation-z={-HALF} />
          <Part g={cyl(0.066, 0.066, 0.05, 14)} m={black} position={[0.57, 2.06, s * 0.47]} rotation-z={-HALF} />
        </group>
      ))}
      <Part g={guardRoofGeometry()} m={black} position={[-0.08, 2.22, 0]} />
      <mesh geometry={cyl(0.045, 0.05, 0.09, 14)} material={glow(PALETTE.amber, 1.6)} position={[-0.6, 2.3, 0.3]} />
      <Part g={cyl(0.06, 0.06, 0.025, 14)} m={black} position={[-0.6, 2.255, 0.3]} />

      {/* Wheels: big drive wheels in front, small steer wheels behind. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Wheel r={0.31} w={0.24} rim={rim} position={[0.5, 0.31, s * 0.5]} />
          <Wheel r={0.24} w={0.2} rim={rim} position={[-0.72, 0.24, s * 0.47]} />
          <Part g={torus(0.37, 0.05, 18, Math.PI)} m={orange} position={[0.5, 0.33, s * 0.5]} scale={[1, 1, 2.6]} />
        </group>
      ))}

      {/* Mast: two channels, cross members, lift cylinder, tilt rams. */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Part g={rbox(0.11, 2.2, 0.09, 0.02, 2)} m={black} position={[0.9, 1.2, s * 0.34]} />
          <Part g={rbox(0.07, 1.5, 0.06, 0.015, 2)} m={graphite} position={[0.9, 1.1 + lift * 0.5, s * 0.27]} />
          <Tube a={[0.72, 0.6, s * 0.4]} b={[0.88, 0.95, s * 0.4]} r={0.022} m={steel} />
        </group>
      ))}
      {[0.22, 1.3, 2.26].map((y) => (
        <Part key={y} g={rbox(0.08, 0.1, 0.72, 0.02, 2)} m={black} position={[0.9, y, 0]} />
      ))}
      <Part g={cyl(0.045, 0.045, 1.5, 14)} m={steel} position={[0.88, 0.95, 0]} />
      <Part g={cyl(0.03, 0.03, 0.5 + lift, 12)} m={metal(PALETTE.white, 0.15)} position={[0.88, 1.7 + (0.5 + lift) / 2 - 0.25, 0]} />

      {/* Carriage, load backrest and forks ride with the lift. */}
      <group position={[1.0, lift, 0]}>
        <Part g={backrestGeometry()} m={black} />
        {[1, -1].map((s) => (
          <group key={s}>
            <Part g={rbox(0.05, 0.52, 0.11, 0.015, 2)} m={forkSteel} position={[0.06, 0.26, s * 0.27]} />
            <Part g={rbox(1.12, 0.045, 0.11, 0.015, 2)} m={forkSteel} position={[0.6, 0.0225, s * 0.27]} />
          </group>
        ))}
        {load && (
          <group position={[0.72, 0.046, 0]}>
            <Load kind={load} seed={seed} />
          </group>
        )}
      </group>
    </group>
  );
}

// ---------------------------------------------------------- pallet jack

/** Where a 'push' worker stands to hold the jack's handle, relative to the
 *  jack's origin. */
export const PALLET_JACK_OPERATOR_X = -1.44;

/** Blue hand pallet jack. Origin under the middle of the forks, so a
 *  pallet placed at the same position sits on it; the tiller is at -x. */
export function PalletJack({ load, seed = 1, ...props }: GroupProps & { load?: PalletLoad; seed?: number }) {
  const blue = plastic(PALETTE.blue);
  const dark = matte(PALETTE.graphite, 0.6);
  const steel = metal(PALETTE.steel, 0.3);
  return (
    <group {...props}>
      {[1, -1].map((s) => (
        <group key={s}>
          <Part g={rbox(1.2, 0.05, 0.17, 0.02, 3)} m={blue} position={[0.02, 0.07, s * 0.19]} />
          {/* Tapered entry tip and the load roller under it. */}
          <Part g={rbox(0.16, 0.035, 0.15, 0.015, 2)} m={blue} position={[0.64, 0.058, s * 0.19]} rotation-z={-0.12} />
          <Part g={cyl(0.04, 0.04, 0.1, 14)} m={dark} position={[0.46, 0.04, s * 0.19]} rotation-x={HALF} />
        </group>
      ))}
      {/* Bridge and pump housing. */}
      <Part g={rbox(0.17, 0.2, 0.56, 0.04, 3)} m={blue} position={[-0.62, 0.16, 0]} />
      <Part g={rbox(0.2, 0.26, 0.26, 0.05, 3)} m={blue} position={[-0.74, 0.34, 0]} />
      <Part g={cyl(0.045, 0.045, 0.2, 14)} m={steel} position={[-0.74, 0.54, 0]} />
      {/* Steer wheels. */}
      {[1, -1].map((s) => (
        <Wheel key={s} r={0.095} w={0.06} position={[-0.76, 0.095, s * 0.075]} />
      ))}
      <Part g={rbox(0.05, 0.14, 0.24, 0.015, 2)} m={dark} position={[-0.76, 0.16, 0]} />
      {/* Tiller with its loop handle and release lever. */}
      <Tube a={[-0.76, 0.55, 0]} b={[-0.98, 1.0, 0]} r={0.022} m={blue} />
      <group position={[-1.01, 1.12, 0]} rotation-z={0.45}>
        <Part g={torus(0.115, 0.019, 24)} m={blue} rotation-y={HALF} scale={[1, 0.85, 1]} />
        <Part g={capsule(0.024, 0.1, 8)} m={dark} position={[0, 0.098, 0]} rotation-x={HALF} />
        <Part g={rbox(0.02, 0.09, 0.03, 0.008, 1)} m={dark} position={[0.02, -0.02, 0]} />
      </group>
      {load && (
        <group position={[0.02, 0.096, 0]}>
          <Load kind={load} seed={seed} />
        </group>
      )}
    </group>
  );
}

// ----------------------------------------------------------- hand truck

/** Blue sack truck standing on its toe plate, plate toward +x. `cartons`
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

// -------------------------------------------------------------- trolley

const CART = { l: 0.74, w: 0.52, base: 0.17, pitch: 0.215 } as const;

function cartFrameGeometry(levels: number) {
  return mergedBoxes(`trolleyFrame:${levels}`, () => {
    const { l, w, base, pitch } = CART;
    const top = base + 0.16 + levels * pitch;
    const out: BoxSpec[] = [];
    const r = 0.009;
    for (const x of [-l / 2, l / 2]) {
      for (const z of [-w / 2, w / 2]) out.push({ size: [0.03, top - base, 0.03], pos: [x, (top + base) / 2, z], r });
      // End frames only: the long sides stay open so trays slide in.
      for (const y of [base, top]) out.push({ size: [0.03, 0.03, w], pos: [x, y, 0], r });
    }
    for (const z of [-w / 2, w / 2]) for (const y of [base, top]) out.push({ size: [l, 0.03, 0.03], pos: [0, y, z], r });
    // Tray runners.
    for (let i = 0; i < levels; i++) {
      for (const z of [-w / 2 + 0.022, w / 2 - 0.022]) out.push({ size: [l - 0.03, 0.012, 0.03], pos: [0, base + 0.12 + i * pitch, z], r: 0.004 });
    }
    return out;
  });
}

function casterGeometry() {
  return mergedBoxes('cartCasters', () => {
    const { l, w, base } = CART;
    const out: BoxSpec[] = [];
    for (const x of [-l / 2 + 0.03, l / 2 - 0.03]) {
      for (const z of [-w / 2 + 0.03, w / 2 - 0.03]) {
        out.push({ size: [0.07, 0.015, 0.06], pos: [x, base - 0.022, z], r: 0.004 });
        out.push({ size: [0.05, 0.08, 0.008], pos: [x - 0.015, base - 0.07, z + 0.022], r: 0.003 });
        out.push({ size: [0.05, 0.08, 0.008], pos: [x - 0.015, base - 0.07, z - 0.022], r: 0.003 });
      }
    }
    return out;
  }, 1);
}

export interface CellCartProps extends GroupProps {
  /** Tray levels. */
  levels?: number;
  /** Share of the trays that carry cells, filled from the top. */
  fill?: number;
  seed?: number;
}

/** Cell cart: a stainless frame on casters with trays of cells standing in
 *  their holders. Trays slide in along x. About 0.74 x 0.52 and 1.6 tall. */
export function CellCart({ levels = 6, fill = 1, seed = 1, ...props }: CellCartProps) {
  const layout = useMemo(() => {
    const { l, w, base, pitch } = CART;
    const trays: THREE.Matrix4[] = [];
    const cells: THREE.Matrix4[] = [];
    const wheels: THREE.Matrix4[] = [];
    const rand = rng(seed * 17 + 1);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const loaded = Math.round(levels * fill);
    for (let i = 0; i < levels; i++) {
      const y = base + 0.135 + i * pitch;
      trays.push(new THREE.Matrix4().makeTranslation(0, y, 0));
      if (i < levels - loaded) continue;
      p.set((rand() - 0.5) * 0.012, y + 0.01, (rand() - 0.5) * 0.01);
      q.setFromEuler(e.set(0, 0, 0));
      cells.push(new THREE.Matrix4().compose(p, q, one));
    }
    q.setFromEuler(e.set(HALF, 0, 0));
    for (const x of [-l / 2 + 0.03, l / 2 - 0.03]) {
      for (const z of [-w / 2 + 0.03, w / 2 - 0.03]) wheels.push(new THREE.Matrix4().compose(p.set(x - 0.02, 0.05, z), q, one));
    }
    return { trays, cells, wheels };
  }, [levels, fill, seed]);

  const steel = metal(PALETTE.steel, 0.3);
  return (
    <group {...props}>
      <Part g={cartFrameGeometry(levels)} m={steel} />
      <Part g={casterGeometry()} m={steel} />
      <Instances g={cyl(0.05, 0.05, 0.032, 16)} m={matte(PALETTE.graphite, 0.6)} matrices={layout.wheels} />
      <Instances g={rbox(CART.l - 0.05, 0.018, CART.w - 0.07, 0.008, 2)} m={metal(PALETTE.steelDark, 0.45)} matrices={layout.trays} />
      <Instances g={cellTrayGeometry()} m={moduleMaterial()} matrices={layout.cells} />
    </group>
  );
}
