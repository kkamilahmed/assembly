// A finished loaf as a static prop (trolley trays, a carried tray). The
// line's own loaves belong to the simulation; these only dress the set.
import * as THREE from 'three';
import { crustColor, matte } from '@/scene/style';
import { merged, rbox } from './kit';

export const LOAF = { l: 0.27, w: 0.125, h: 0.1 } as const;

/** Batard lying along x, origin at the centre of its base. */
export function loafGeometry(): THREE.BufferGeometry {
  return merged('loaf', () => {
    const g = new THREE.CapsuleGeometry(LOAF.w / 2, LOAF.l - LOAF.w, 6, 14);
    g.rotateZ(Math.PI / 2);
    g.scale(1, LOAF.h / LOAF.w, 1);
    // Sit it a little into the tray so the base reads flat.
    g.translate(0, LOAF.h / 2 - 0.012, 0);
    return [g];
  });
}

/** Three slanted score marks across the top of the loaf. */
export function loafScoreGeometry(): THREE.BufferGeometry {
  return merged('loafScores', () =>
    [-0.065, 0, 0.065].map((x) => {
      const g = rbox(0.016, 0.012, 0.085, 0.005, 1).clone();
      g.rotateY(0.6);
      g.translate(x, LOAF.h - 0.016, 0);
      return g;
    }),
  );
}

const hex = (bake: number) => `#${crustColor(bake).getHexString()}`;
export const crustMaterial = () => matte(hex(1), 0.62);
export const scoreMaterial = () => matte(hex(0.35), 0.7);
