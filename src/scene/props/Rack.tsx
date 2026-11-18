// Steel pallet racking, stocked. The rack runs along x (bays side by side)
// and is picked from either z side; origin at the footprint centre.
//
// All the stock in a rack is drawn instanced: one mesh of pallets, one set
// of cartons, however many bays there are.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { metal, PALETTE, plastic } from '@/scene/style';
import { mergedBoxes, rng, type BoxSpec } from './kit';
import { Instances } from './Part';
import { CartonInstances, PalletInstances } from './Stock';
import { at, cartonStackMatrices, PALLET, RACK } from './stockLayout';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

function frameGeometry(height: number) {
  return mergedBoxes(`rackFrame:${height}`, () => {
    const d = RACK.depth;
    const out: BoxSpec[] = [];
    for (const z of [-d / 2, d / 2]) {
      out.push({ size: [0.1, height, 0.075], pos: [0, height / 2, z], r: 0.014 });
      out.push({ size: [0.17, 0.014, 0.15], pos: [0, 0.007, z], r: 0.005 });
    }
    const step = 0.86;
    const n = Math.max(1, Math.floor((height - 0.3) / step));
    for (let i = 0; i <= n; i++) {
      const y = 0.18 + i * step;
      out.push({ size: [0.035, 0.035, d], pos: [0, y, 0], r: 0.008 });
      if (i < n) {
        const a = Math.atan2(step, d) * (i % 2 === 0 ? -1 : 1);
        out.push({ size: [0.03, 0.03, Math.hypot(step, d) - 0.06], pos: [0, y + step / 2, 0], rot: [a, 0, 0], r: 0.008 });
      }
    }
    return out;
  });
}

function beamGeometry() {
  return mergedBoxes('rackBeam', () => [
    { size: [RACK.bay - 0.1, 0.12, 0.05], pos: [0, -0.06, 0], r: 0.012 },
    // End connectors that hook onto the uprights.
    { size: [0.02, 0.2, 0.07], pos: [-(RACK.bay - 0.1) / 2, -0.07, 0], r: 0.006 },
    { size: [0.02, 0.2, 0.07], pos: [(RACK.bay - 0.1) / 2, -0.07, 0], r: 0.006 },
  ]);
}

export interface RackProps extends GroupProps {
  bays?: number;
  /** Storage levels, counting the floor. 2 or 3 read best. */
  levels?: number;
  color?: 'orange' | 'blue';
  /** Leave false for an empty rack. */
  stocked?: boolean;
  seed?: number;
}

export function Rack({ bays = 2, levels = 3, color = 'blue', stocked = true, seed = 1, ...props }: RackProps) {
  const height = (levels - 1) * RACK.level + 1.3;
  const layout = useMemo(() => {
    const frames: THREE.Matrix4[] = [];
    const beams: THREE.Matrix4[] = [];
    const pallets: THREE.Matrix4[] = [];
    const cartons: THREE.Matrix4[] = [];
    const x0 = (-bays * RACK.bay) / 2;
    const rand = rng(seed * 13 + 5);
    for (let i = 0; i <= bays; i++) frames.push(at(x0 + i * RACK.bay, 0, 0));
    for (let b = 0; b < bays; b++) {
      const cx = x0 + (b + 0.5) * RACK.bay;
      for (let l = 0; l < levels; l++) {
        const y = l * RACK.level;
        if (l > 0) for (const z of [-0.5, 0.5]) beams.push(at(cx, y, z * (RACK.depth - 0.075)));
        if (!stocked) continue;
        for (const dx of [-0.66, 0.66]) {
          const kind = rand();
          const pick = rand();
          const s = Math.floor(rand() * 1000);
          const jx = (rand() - 0.5) * 0.05;
          const yaw = (rand() - 0.5) * 0.04;
          if (kind < 0.1) continue;
          const base = at(cx + dx + jx, y, 0, yaw);
          pallets.push(base);
          const top = at(cx + dx + jx, y + PALLET.h, 0, yaw);
          const full = pick < 0.55 ? 12 : pick < 0.8 ? 8 : 12 - 1 - Math.floor(pick * 3);
          cartonStackMatrices({ layers: 3, count: full, seed: s }, top, cartons);
        }
      }
    }
    return { frames, beams, pallets, cartons };
  }, [bays, levels, stocked, seed]);

  const paint = plastic(color === 'orange' ? PALETTE.orange : PALETTE.blue, 0.38);
  return (
    <group {...props}>
      <Instances g={frameGeometry(height)} m={paint} matrices={layout.frames} />
      <Instances g={beamGeometry()} m={metal(PALETTE.steel, 0.36)} matrices={layout.beams} />
      <PalletInstances matrices={layout.pallets} />
      <CartonInstances matrices={layout.cartons} />
    </group>
  );
}
