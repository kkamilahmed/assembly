// Shared plumbing for the in-scene UI: chunky rounded slabs, and canvas
// textures drawn in "design pixels" (100 per world unit) so card content is
// laid out like a normal 2D UI and stays crisp at the close-up zoom.
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';

/** Design pixels per world unit. */
export const UNIT = 100;
/** Canvas pixels per design pixel. */
const RES = 2.5;

export const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/** Text and chart neutrals used on every card. */
export const INK = {
  ink: '#1c1f26',
  sub: '#545a66',
  muted: '#8d939e',
  grid: '#e6e8ec',
  track: '#e9ebef',
} as const;

export type Tone = 'healthy' | 'warning' | 'critical' | 'neutral';
export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** A rounded rectangle centred on the origin. */
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - rr);
  s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x + rr, y + h);
  s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + rr);
  s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

/**
 * A rounded-rectangle slab with softly bevelled edges. Lies in the XY plane,
 * centred, spanning z 0..depth. Material group 0 is the two flat faces,
 * group 1 the rim.
 */
export function slabGeometry(w: number, h: number, depth: number, r: number, bevel = 0.025): THREE.BufferGeometry {
  const key = `slab:${w}:${h}:${depth}:${r}:${bevel}`;
  let g = geoCache.get(key);
  if (!g) {
    const b = Math.min(bevel, depth / 2 - 0.001);
    const shape = roundedRectShape(w - 2 * b, h - 2 * b, Math.max(r - b, 0.001));
    g = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * b,
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 4,
      curveSegments: 10,
    });
    g.translate(0, 0, b);
    geoCache.set(key, g);
  }
  return g;
}

/** The flat front face of a slab from `slabGeometry`, with 0..1 UVs. */
export function faceGeometry(w: number, h: number, r: number, bevel = 0.025): THREE.BufferGeometry {
  const key = `face:${w}:${h}:${r}:${bevel}`;
  let g = geoCache.get(key);
  if (!g) {
    const fw = w - 2 * bevel;
    const fh = h - 2 * bevel;
    g = new THREE.ShapeGeometry(roundedRectShape(fw, fh, Math.max(r - bevel, 0.001)), 10);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / fw + 0.5, pos.getY(i) / fh + 0.5);
    uv.needsUpdate = true;
    geoCache.set(key, g);
  }
  return g;
}

// Canvas text is rasterised once, so redraw when a web font finishes
// loading after the first paint.
function subscribeFonts(cb: () => void) {
  document.fonts.addEventListener('loadingdone', cb);
  return () => document.fonts.removeEventListener('loadingdone', cb);
}
let fontEpoch = 0;
if (typeof document !== 'undefined') document.fonts.addEventListener('loadingdone', () => fontEpoch++);
const getFontEpoch = () => fontEpoch;

/**
 * A texture for a w x h (world units) face, drawn by `draw` in design
 * pixels. Redrawn only when `draw` changes identity, so memoise it on the
 * data it shows.
 */
export function useCanvasTexture(w: number, h: number, draw: Draw): THREE.CanvasTexture {
  const epoch = useSyncExternalStore(subscribeFonts, getFontEpoch);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * UNIT * RES);
    canvas.height = Math.round(h * UNIT * RES);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [w, h]);
  useLayoutEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.clearRect(0, 0, w * UNIT, h * UNIT);
    draw(ctx, w * UNIT, h * UNIT);
    // Flagging a three.js texture for re-upload is the one mutation needed.
    // oxlint-disable-next-line react-hooks/immutability
    texture.needsUpdate = true;
  }, [texture, draw, epoch, w, h]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Width of `text` in design pixels. */
export function measure(text: string, cssFont: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 10;
  measureCtx.font = cssFont;
  return measureCtx.measureText(text).width;
}
