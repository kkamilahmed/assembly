// Sizes and placement maths for palletised stock. Kept apart from the
// components so the rack can lay out a whole wall of pallets and draw all of
// its cartons in one instanced mesh.
import * as THREE from 'three';
import { cartonFaceTexture, decal, merged, mergedBoxes, quad, rbox, rng } from './kit';

/** A 1200 x 1000 pallet: long side on x. */
export const PALLET = { w: 1.2, h: 0.144, d: 1.0 } as const;
/** Default carton, [x, y, z]. Four fit a pallet layer. */
export const CARTON_SIZE: [number, number, number] = [0.56, 0.36, 0.46];

/** Parcel cart footprint: length on x, width on z, deck height. */
export const PARCEL_CART = { l: 1.0, w: 0.62, deck: 0.2 } as const;

/** Racking module: bay width (x), depth (z) and level pitch. */
export const RACK = { bay: 2.72, depth: 1.1, level: 1.72 } as const;

export function palletGeometry(): THREE.BufferGeometry {
  return mergedBoxes('pallet', () => {
    const out: Array<{ size: [number, number, number]; pos: [number, number, number]; r: number }> = [];
    const r = 0.007;
    // Bottom boards, along x.
    for (const z of [-0.45, 0, 0.45]) out.push({ size: [1.2, 0.022, 0.1], pos: [0, 0.011, z], r });
    // Nine blocks.
    for (const x of [-0.525, 0, 0.525]) for (const z of [-0.44, 0, 0.44]) out.push({ size: [0.15, 0.078, 0.12], pos: [x, 0.061, z], r });
    // Stringers, along z.
    for (const x of [-0.525, 0, 0.525]) out.push({ size: [0.15, 0.022, 1.0], pos: [x, 0.111, 0], r });
    // Top deck slats, along x, with gaps you can see through.
    const n = 7;
    const sw = 0.112;
    const gap = (1.0 - n * sw) / (n - 1);
    for (let i = 0; i < n; i++) out.push({ size: [1.2, 0.022, sw], pos: [0, 0.133, -0.5 + sw / 2 + i * (sw + gap)], r });
    return out;
    // One bevel segment: a 7mm bevel on a board a few pixels tall needs no
    // more, and pallets are drawn by the hundred.
  }, 1);
}

export function cartonGeometries(size: [number, number, number]) {
  const [w, h, d] = size;
  const key = size.join('x');
  const body = rbox(w, h, d, 0.014, 2);
  const tapeW = Math.min(0.075, d * 0.2);
  const tab = Math.min(0.11, h * 0.34);
  const tape = mergedBoxes(`tape:${key}`, () => [
    { size: [w + 0.01, 0.01, tapeW], pos: [0, h / 2, 0], r: 0.003 },
    { size: [0.01, tab, tapeW], pos: [w / 2, h / 2 - tab / 2 + 0.005, 0], r: 0.003 },
    { size: [0.01, tab, tapeW], pos: [-w / 2, h / 2 - tab / 2 + 0.005, 0], r: 0.003 },
  ], 1);
  const qh = h * 0.9;
  const qw = Math.min(qh * 1.28, Math.min(w, d) * 0.94);
  const faces = merged(`cartonFaces:${key}`, () => {
    const mk = (ry: number, x: number, z: number) => {
      const g = quad(qw, qh).clone();
      g.rotateY(ry);
      g.translate(x, 0, z);
      return g;
    };
    const e = 0.0015;
    return [mk(0, 0, d / 2 + e), mk(Math.PI, 0, -d / 2 - e), mk(Math.PI / 2, w / 2 + e, 0), mk(-Math.PI / 2, -w / 2 - e, 0)];
  });
  return { body, tape, faces, faceMaterial: decal('cartonFace', cartonFaceTexture, 0.75, '#c9c9c9') };
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

export interface CartonStackOpts {
  /** Along z. */
  rows?: number;
  /** Along x. */
  cols?: number;
  layers?: number;
  /** Cartons actually present, filled bottom-up. Defaults to a full stack. */
  count?: number;
  size?: [number, number, number];
  seed?: number;
  /** Random offset in metres; 0 for a machine-perfect stack. */
  jitter?: number;
}

/** Appends one matrix per carton, stacked upward from `base` (the surface
 *  the bottom layer stands on). */
export function cartonStackMatrices(opts: CartonStackOpts, base: THREE.Matrix4, out: THREE.Matrix4[]): THREE.Matrix4[] {
  const { rows = 2, cols = 2, layers = 3, size = CARTON_SIZE, seed = 1, jitter = 0.012 } = opts;
  const [w, h, d] = size;
  const total = rows * cols * layers;
  const count = Math.min(opts.count ?? total, total);
  const rand = rng(seed);
  const gap = 0.012;
  let i = 0;
  for (let l = 0; l < layers; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, i++) {
        // Always draw the randoms so a growing stack never reshuffles.
        const jx = (rand() - 0.5) * 2 * jitter;
        const jz = (rand() - 0.5) * 2 * jitter;
        const yaw = (rand() - 0.5) * jitter * 5 + (rand() < 0.5 ? 0 : Math.PI);
        if (i >= count) continue;
        _p.set((c - (cols - 1) / 2) * (w + gap) + jx, h / 2 + l * (h + 0.002), (r - (rows - 1) / 2) * (d + gap) + jz);
        _q.setFromEuler(_e.set(0, yaw, 0));
        out.push(new THREE.Matrix4().compose(_p, _q, _s).premultiply(base));
      }
    }
  }
  return out;
}

/** Matrix for a translation, for use as a stack `base`. */
export function at(x: number, y: number, z: number, yaw = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, yaw, 0)), _s);
}

export const IDENTITY = _m.identity().clone();
