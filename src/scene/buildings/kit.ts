// Geometry kit for the buildings. Each building is modelled from many small
// soft-edged primitives, then merged into one geometry per material, so a
// building with hundreds of parts still costs about ten draw calls.
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../style';

export type V3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type Severity = 'healthy' | 'warning' | 'critical';

export interface Piece {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

const AXIS_ROT: Record<Axis, V3> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

/** A cylinder (or cone frustum) along +y with bevelled rims. */
export function roundedCylinder(rBottom: number, rTop: number, h: number, bevel: number, radial = 20): THREE.BufferGeometry {
  const b = Math.max(0.001, Math.min(bevel, rBottom * 0.9, rTop * 0.9, h * 0.45));
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -h / 2)];
  const steps = 3;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(rBottom - b + Math.cos(a) * b, -h / 2 + b + Math.sin(a) * b));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(rTop - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b));
  }
  pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, radial);
}

/** A polyline with rounded elbows, as one curve. */
export function elbowPath(points: V3[], bend = 0.08): THREE.CurvePath<THREE.Vector3> {
  const pts = points.map((p) => new THREE.Vector3(...p));
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const corner = pts[i];
    const next = pts[i + 1];
    if (!next) {
      path.add(new THREE.LineCurve3(cursor, corner.clone()));
      break;
    }
    const inDir = corner.clone().sub(pts[i - 1]);
    const outDir = next.clone().sub(corner);
    const r = Math.min(bend, inDir.length() * 0.45, outDir.length() * 0.45);
    const enter = corner.clone().addScaledVector(inDir.normalize(), -r);
    const exit = corner.clone().addScaledVector(outDir.normalize(), r);
    path.add(new THREE.LineCurve3(cursor, enter));
    path.add(new THREE.QuadraticBezierCurve3(enter, corner.clone(), exit));
    cursor = exit;
  }
  return path;
}

/** Collects primitives per material and merges them. */
export class Kit {
  private groups = new Map<THREE.Material, THREE.BufferGeometry[]>();

  /** Adds any geometry. Rotation is applied first, then the translation. */
  add(mat: THREE.Material, geo: THREE.BufferGeometry, pos: V3 = [0, 0, 0], rot?: V3): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    g.clearGroups();
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e), ONE);
    g.applyMatrix4(_m);
    const list = this.groups.get(mat);
    if (list) list.push(g);
    else this.groups.set(mat, [g]);
    return this;
  }

  /** Soft-edged box, centred on `pos`. */
  box(mat: THREE.Material, size: V3, pos: V3, r = 0.03, rot?: V3): this {
    const radius = Math.min(r, size[0] * 0.49, size[1] * 0.49, size[2] * 0.49);
    return this.add(mat, new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius), pos, rot);
  }

  /** Bevelled cylinder centred on `pos`, along `axis`. */
  cyl(mat: THREE.Material, r: number, h: number, pos: V3, axis: Axis = 'y', bevel = 0.015, rTop = r, radial = 20): this {
    return this.add(mat, roundedCylinder(r, rTop, h, bevel, radial), pos, AXIS_ROT[axis]);
  }

  /** Round pipe through `points` with rounded elbows. */
  tube(mat: THREE.Material, points: V3[], r: number, bend = 0.08): this {
    const path = elbowPath(points, bend);
    const segs = Math.max(6, Math.ceil(path.getLength() / 0.035));
    return this.add(mat, new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, segs, r, 10, false));
  }

  /** Small bolt head, sitting on a surface at `pos`, pointing along `axis`. */
  bolt(mat: THREE.Material, pos: V3, axis: Axis = 'y', r = 0.016): this {
    return this.add(mat, roundedCylinder(r, r, r * 0.9, r * 0.35, 8), pos, AXIS_ROT[axis]);
  }

  build(): Piece[] {
    const out: Piece[] = [];
    for (const [material, list] of this.groups) {
      const geometry = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (geometry) out.push({ geometry, material });
    }
    this.groups.clear();
    return out;
  }
}

/** Frees merged pieces when they are replaced or the building unmounts. */
export function useDispose(pieces: Piece[]): void {
  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces]);
}

/** Extrudes a 2D outline (drawn in the z-y plane, z to the right) along x,
 *  centred on x = 0, with a small bevel and smooth curved faces. */
export function extrudeAlongX(shape: THREE.Shape, length: number, bevel = 0.012): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, length - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 10,
    steps: 1,
  });
  g.translate(0, 0, -(length - bevel * 2) / 2);
  // Shape x becomes world z, the extrusion axis becomes world x.
  g.rotateY(-Math.PI / 2);
  const out = toCreasedNormals(g, 0.7);
  if (out !== g) g.dispose();
  return out;
}

/** An arch outline, open at the bottom: the cross-section of a tunnel hood.
 *  Outer half-width `hw` from y0 up to y1 with top corner radius `r`; the
 *  cavity has half-width `ihw`, ceiling `ih` and corner radius `ir`. */
export function archShape(hw: number, y0: number, y1: number, r: number, ihw: number, ih: number, ir: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-hw, y0);
  s.lineTo(-hw, y1 - r);
  s.absarc(-hw + r, y1 - r, r, Math.PI, Math.PI / 2, true);
  s.lineTo(hw - r, y1);
  s.absarc(hw - r, y1 - r, r, Math.PI / 2, 0, true);
  s.lineTo(hw, y0);
  s.lineTo(ihw, y0);
  s.lineTo(ihw, ih - ir);
  s.absarc(ihw - ir, ih - ir, ir, 0, Math.PI / 2, false);
  s.lineTo(-ihw + ir, ih);
  s.absarc(-ihw + ir, ih - ir, ir, Math.PI / 2, Math.PI, false);
  s.lineTo(-ihw, y0);
  s.closePath();
  return s;
}

// ---------------------------------------------------------------------------
// Local material variants. Colours still come from PALETTE.

const cache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

/** Stack-light lens: tinted and dark when off, self-lit when on. */
export function lens(color: string, on: boolean): THREE.MeshStandardMaterial {
  return cached(`lens:${color}:${on}`, () => {
    const c = new THREE.Color(color);
    return on
      ? new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.25), emissive: c, emissiveIntensity: 1.7, roughness: 0.35, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.42), roughness: 0.25, metalness: 0 });
  });
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const textures = new Map<string, THREE.CanvasTexture>();
function texture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  let t = textures.get(key);
  if (!t) {
    t = canvasTexture(w, h, draw);
    textures.set(key, t);
  }
  return t;
}

/** Soft light pool: bright at u = 0, fading to nothing at u = 1 and toward
 *  both v edges. For additive glow decals. */
export function spillTexture(): THREE.CanvasTexture {
  return texture('spill', 128, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const v = Math.abs(y / (h - 1) - 0.5) * 2;
        const a = Math.pow(1 - u, 2.2) * (1 - Math.pow(v, 3));
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Round soft falloff, for additive halos around self-lit parts. */
export function haloTexture(): THREE.CanvasTexture {
  return texture('halo', 64, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x / (w - 1) - 0.5) * 2;
        const dy = (y / (h - 1) - 0.5) * 2;
        const a = Math.pow(Math.max(0, 1 - Math.hypot(dx, dy)), 1.8);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Additive, unlit glow overlay. One per caller, so it can be animated. */
export function additive(color: THREE.ColorRepresentation, map: THREE.Texture | null = null): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

export type ScreenKind = 'feed' | 'chart' | 'map' | 'scores' | 'atm' | 'pos' | 'store';

const C = {
  bg: '#14171c',
  panel: '#1f242c',
  line: '#2b313b',
  text: '#c9d2de',
  muted: '#6d7887',
};

function rows(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, pitch: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const r = (Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
    const flagged = Math.abs(r) < 0.12;
    ctx.fillStyle = i % 2 ? C.panel : C.bg;
    ctx.fillRect(x, y + i * pitch, w, pitch - 2);
    ctx.fillStyle = flagged ? PALETTE.critical : PALETTE.healthy;
    ctx.beginPath();
    ctx.arc(x + 9, y + i * pitch + pitch / 2 - 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.fillRect(x + 20, y + i * pitch + pitch / 2 - 4, 40 + Math.abs(r) * 60, 5);
    ctx.fillStyle = C.muted;
    ctx.fillRect(x + w - 50, y + i * pitch + pitch / 2 - 4, 38, 5);
  }
}

function drawScreen(kind: ScreenKind, ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  const pad = 12;
  if (kind === 'feed') {
    // The live authorization feed: one row per payment, green or red.
    ctx.fillStyle = PALETTE.blue;
    ctx.fillRect(0, 0, w, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 7, 70, 6);
    rows(ctx, pad, 28, w - pad * 2, 8, 16, 3);
  } else if (kind === 'chart') {
    // Fraud score over time with a limit line.
    ctx.fillStyle = C.panel;
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = pad + ((h - pad * 2) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = PALETTE.critical;
    ctx.beginPath();
    ctx.moveTo(pad, h * 0.34);
    ctx.lineTo(w - pad, h * 0.34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = PALETTE.orange;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = pad + 4 + ((w - pad * 2 - 8) * i) / 24;
      const y = h * 0.66 + Math.sin(i * 0.8) * 10 + Math.sin(i * 2.1) * 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (kind === 'map') {
    // The city's payment map: streets and glowing source dots.
    ctx.fillStyle = C.panel;
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 6;
    for (const x of [60, 130, 200]) {
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, h - pad);
      ctx.stroke();
    }
    for (const y of [50, 105]) {
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }
    const dots: Array<[number, number, string]> = [
      [60, 50, PALETTE.healthy], [130, 105, PALETTE.healthy], [200, 50, PALETTE.healthy], [95, 78, PALETTE.blue],
      [170, 130, PALETTE.healthy], [225, 105, PALETTE.amber], [40, 120, PALETTE.healthy],
    ];
    for (const [x, y, c] of dots) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'scores') {
    // Risk score histogram: almost everything low, a thin tail high.
    const bars = [0.2, 0.62, 0.95, 0.7, 0.4, 0.22, 0.12, 0.07, 0.05, 0.08, 0.04];
    const bw = (w - pad * 2) / bars.length;
    bars.forEach((v, i) => {
      ctx.fillStyle = i >= 8 ? PALETTE.critical : i >= 6 ? PALETTE.amber : PALETTE.blue;
      const bh = v * (h - 40);
      ctx.fillRect(pad + i * bw + 2, h - pad - bh, bw - 4, bh);
    });
    ctx.fillStyle = C.text;
    ctx.fillRect(pad, pad, 80, 7);
  } else if (kind === 'atm') {
    // Cash machine: amount buttons either side of a prompt.
    ctx.fillStyle = '#1d3f73';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w / 2 - 60, 26, 120, 10);
    ctx.fillRect(w / 2 - 40, 44, 80, 6);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#3b86e3';
      ctx.fillRect(pad, 70 + i * 28, 70, 20);
      ctx.fillRect(w - pad - 70, 70 + i * 28, 70, 20);
    }
  } else if (kind === 'pos') {
    // Card terminal: amount and a tap prompt.
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.tdzInk;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$4.80', w / 2, h * 0.45);
    ctx.strokeStyle = PALETTE.blue;
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.78, 10 + i * 10, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
    }
  } else {
    // The TechDealz checkout page, which is all card testers ever see.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.tdzInk;
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = PALETTE.tdzYellow;
    ctx.fillRect(10, 7, 46, 10);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#e9ebef';
      ctx.fillRect(pad + i * 80, 36, 70, 60);
      ctx.fillStyle = PALETTE.tdzYellow;
      ctx.fillRect(pad + i * 80, 102, 40, 8);
    }
    ctx.fillStyle = PALETTE.blue;
    ctx.fillRect(w - 110, h - 34, 96, 22);
  }
}

/** Lit display panel. The picture is the emissive map, so it stays readable
 *  in shadow, while the glossy surface still catches studio reflections. */
export function screenMaterial(kind: ScreenKind): THREE.MeshStandardMaterial {
  return cached(`screen:${kind}`, () => {
    const map = texture(`screen:${kind}`, 256, 160, (ctx, w, h) => drawScreen(kind, ctx, w, h));
    return new THREE.MeshStandardMaterial({
      color: '#000000',
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: 1,
      roughness: 0.25,
      metalness: 0,
      toneMapped: false,
    });
  });
}
