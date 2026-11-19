// Packaging materials on pallets: rolls of PVC and lidding foil for the
// blister packer, bundles of flat-packed
// cartons and a stack of empty pallets. Origins are at the footprint centre
// on the ground; the pallet's long side is on x.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, metal, PALETTE, plastic } from '@/scene/style';
import { cyl, lathe, mergedBoxes, rbox, rng, studioWhite, type BoxSpec } from '@/scene/props/kit';
import { Instances, Part } from '@/scene/props/Part';
import { PalletInstances } from '@/scene/props/Stock';
import { at, PALLET } from '@/scene/props/stockLayout';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const ROLL = { r: 0.19, h: 0.5 } as const;

function rollGeometry() {
  const { r, h } = ROLL;
  return lathe('filmRoll', [[0.062, 0], [r - 0.02, 0], [r, 0.02], [r, h - 0.02], [r - 0.02, h], [0.062, h]], 28);
}

/** Blister materials standing on a pallet: a layer of six white PVC rolls,
 *  a slip sheet, then `top` rolls of aluminium lidding foil. */
export function FilmRollPallet({ top = 3, ...props }: GroupProps & { top?: number }) {
  const { lower, upper } = useMemo(() => {
    const lower: THREE.Matrix4[] = [];
    const upper: THREE.Matrix4[] = [];
    for (const z of [-0.23, 0.23]) for (const x of [-0.39, 0, 0.39]) lower.push(at(x, PALLET.h, z));
    const y = PALLET.h + ROLL.h + 0.014;
    const slots: Array<[number, number]> = [[-0.39, -0.23], [0, -0.23], [0.39, -0.23], [-0.39, 0.23], [0, 0.23], [0.39, 0.23]];
    for (let i = 0; i < Math.min(top, slots.length); i++) upper.push(at(slots[i][0], y, slots[i][1]));
    return { lower, upper };
  }, [top]);
  const all = useMemo(() => [...lower, ...upper], [lower, upper]);
  const cores = useMemo(() => all.map((m) => m.clone().multiply(at(0, ROLL.h / 2, 0))), [all]);
  const pallet = useMemo(() => [at(0, 0, 0)], []);
  return (
    <group {...props}>
      <PalletInstances matrices={pallet} />
      <Instances g={rollGeometry()} m={plastic(studioWhite(PALETTE.offWhite, 0.72), 0.16)} matrices={lower} />
      <Instances g={rollGeometry()} m={metal(PALETTE.foil, 0.3)} matrices={upper} />
      {/* Cardboard cores, with a dark cap that reads as the hollow. */}
      <Instances g={cyl(0.066, 0.066, ROLL.h + 0.006, 18)} m={matte(PALETTE.cardboard, 0.8)} matrices={cores} shadows={false} />
      <Instances g={cyl(0.05, 0.05, ROLL.h + 0.01, 16)} m={matte(PALETTE.rubber, 0.9)} matrices={cores} shadows={false} />
      {upper.length > 0 && <Part g={rbox(1.16, 0.014, 0.96, 0.006, 1)} m={matte(PALETTE.cardboardDark, 0.85)} position-y={PALLET.h + ROLL.h + 0.007} />}
    </group>
  );
}

const FLAT: [number, number, number] = [0.54, 0.036, 0.92];

function strapGeometry(h: number) {
  return mergedBoxes(`flatStraps:${h}`, () => {
    const out: BoxSpec[] = [];
    for (const z of [-0.26, 0.26]) out.push({ size: [FLAT[0] + 0.014, h + 0.012, 0.035], pos: [0, h / 2, z], r: 0.006 });
    return out;
  }, 1);
}

/** Two strapped bundles of flat-packed cartons side by side on a pallet.
 *  `flats` is the number of flats in each bundle. */
export function FlatCartonPallet({ flats: counts = [12, 8], seed = 1, ...props }: GroupProps & { flats?: [number, number]; seed?: number }) {
  const [a, b] = counts;
  const flats = useMemo(() => {
    const rand = rng(seed * 13 + 3);
    const out: THREE.Matrix4[] = [];
    [a, b].forEach((n, k) => {
      const x = (k - 0.5) * 0.58;
      for (let i = 0; i < n; i++) out.push(at(x + (rand() - 0.5) * 0.012, PALLET.h + FLAT[1] / 2 + i * FLAT[1], (rand() - 0.5) * 0.012, (rand() - 0.5) * 0.02));
    });
    return out;
  }, [a, b, seed]);
  const pallet = useMemo(() => [at(0, 0, 0)], []);
  return (
    <group {...props}>
      <PalletInstances matrices={pallet} />
      <Instances g={rbox(FLAT[0], FLAT[1] - 0.004, FLAT[2], 0.008, 1)} m={matte(PALETTE.cardboard, 0.82)} matrices={flats} />
      {[a, b].map((n, k) => (
        <Part key={k} g={strapGeometry(n * FLAT[1])} m={matte(PALETTE.tape, 0.45)} position={[(k - 0.5) * 0.58, PALLET.h, 0]} castShadow={false} />
      ))}
    </group>
  );
}

/** A neat stack of empty pallets. */
export function PalletStack({ count = 5, seed = 1, ...props }: GroupProps & { count?: number; seed?: number }) {
  const matrices = useMemo(() => {
    const rand = rng(seed * 7 + 5);
    return Array.from({ length: count }, (_, i) => at((rand() - 0.5) * 0.03, i * PALLET.h, (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.05));
  }, [count, seed]);
  return (
    <group {...props}>
      <PalletInstances matrices={matrices} />
    </group>
  );
}
