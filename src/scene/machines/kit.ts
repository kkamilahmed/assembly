// Geometry kit for the machines. Each machine is modelled from many small
// soft-edged primitives, then merged into one geometry per material, so a
// machine with hundreds of parts still costs about ten draw calls.
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

/** Frees merged pieces when they are replaced or the machine unmounts. */
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

/** Modular belt surface: slats across the belt with dark hinge grooves.
 *  One texture repeat is one slat; scroll `map.offset.x` to run the belt. */
export function beltTexture(): THREE.CanvasTexture {
  const t = texture('belt', 64, 64, (ctx, w, h) => {
    const slat = new THREE.Color(PALETTE.rubber).lerp(new THREE.Color(PALETTE.graphite), 0.35);
    ctx.fillStyle = `#${slat.getHexString()}`;
    ctx.fillRect(0, 0, w, h);
    // Lit leading edge of the slat.
    ctx.fillStyle = PALETTE.graphite;
    ctx.fillRect(12, 0, 5, h);
    // Hinge groove.
    ctx.fillStyle = PALETTE.hazardDark;
    ctx.fillRect(0, 0, 11, h);
    // Hinge knuckles break the groove up across the belt.
    ctx.fillStyle = PALETTE.rubber;
    for (let y = 0; y < h; y += 16) ctx.fillRect(2, y + 5, 7, 6);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function beltMaterial(): THREE.MeshStandardMaterial {
  return cached('belt', () => {
    const map = beltTexture();
    return new THREE.MeshStandardMaterial({ color: '#ffffff', map, bumpMap: map, bumpScale: 1, roughness: 0.7, metalness: 0 });
  });
}

export type ScreenKind = 'hmi' | 'trend' | 'vision' | 'pack';

function drawScreen(kind: ScreenKind, ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = PALETTE.slabSide;
  ctx.fillRect(0, 0, w, h);
  // Header strip with status dots.
  ctx.fillStyle = PALETTE.graphite;
  ctx.fillRect(0, 0, w, 22);
  [PALETTE.healthy, PALETTE.amber, PALETTE.blue].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(14 + i * 16, 11, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = PALETTE.offWhite;
  ctx.fillRect(w - 78, 8, 64, 6);

  const pad = 12;
  if (kind === 'trend') {
    // Compression force trend with a setpoint band and a big readout.
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(pad, 34, w - pad * 2 - 74, h - 48);
    ctx.strokeStyle = PALETTE.wallTrim;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = 34 + ((h - 48) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad - 74, y);
      ctx.stroke();
    }
    const line = (color: string, phase: number, amp: number, base: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const x0 = pad + 4;
      const x1 = w - pad - 78;
      for (let i = 0; i <= 24; i++) {
        const x = x0 + ((x1 - x0) * i) / 24;
        const y = base + Math.sin(i * 0.7 + phase) * amp + Math.sin(i * 1.9 + phase * 2) * amp * 0.4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    line(PALETTE.teal, 0.4, 9, 70);
    line(PALETTE.blue, 2.1, 6, 108);
    ctx.fillStyle = PALETTE.brand;
    ctx.fillRect(w - 74, 34, 62, 40);
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('18kN', w - 43, 61);
    ctx.fillStyle = PALETTE.wallTrim;
    ctx.fillRect(w - 74, 82, 62, 26);
    ctx.fillRect(w - 74, 114, 62, 26);
    ctx.fillStyle = PALETTE.healthy;
    ctx.fillRect(w - 68, 90, 34, 10);
    ctx.fillStyle = PALETTE.blue;
    ctx.fillRect(w - 68, 122, 46, 10);
  } else if (kind === 'vision') {
    // Camera frame: a tray of tablets, each one ringed by the detector.
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(pad, 32, w - pad * 2, h - 44);
    ctx.fillStyle = PALETTE.blue;
    ctx.fillRect(w * 0.42 - 70, h * 0.6 - 38, 140, 76);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        const cx = w * 0.42 - 55 + i * 22;
        const cy = h * 0.6 - 22 + j * 22;
        ctx.fillStyle = PALETTE.white;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.healthy;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = PALETTE.healthy;
    ctx.fillRect(w - 62, 40, 42, 16);
    ctx.fillStyle = PALETTE.blue;
    ctx.fillRect(w - 62, 62, 42, 8);
    ctx.fillRect(w - 62, 76, 28, 8);
  } else if (kind === 'pack') {
    // Carton counter: tiles and a progress bar.
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i < 4 ? PALETTE.blue : PALETTE.wallTrim;
      ctx.fillRect(pad + (i % 3) * 56, 34 + Math.floor(i / 3) * 40, 48, 32);
    }
    ctx.fillStyle = PALETTE.brand;
    ctx.fillRect(w - 68, 34, 56, 72);
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('48', w - 40, 80);
    ctx.fillStyle = PALETTE.wallTrim;
    ctx.fillRect(pad, h - 34, w - pad * 2, 14);
    ctx.fillStyle = PALETTE.healthy;
    ctx.fillRect(pad, h - 34, (w - pad * 2) * 0.68, 14);
  } else {
    // Generic HMI: bar chart, recipe rows and soft keys.
    const bars = [0.5, 0.8, 0.62, 0.9, 0.7, 0.4];
    bars.forEach((v, i) => {
      ctx.fillStyle = i === 3 ? PALETTE.brand : PALETTE.blue;
      const bh = v * 62;
      ctx.fillRect(pad + i * 20, 100 - bh, 14, bh);
    });
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = PALETTE.wallTrim;
      ctx.fillRect(142, 34 + i * 18, 102, 12);
      ctx.fillStyle = i === 1 ? PALETTE.amber : PALETTE.offWhite;
      ctx.fillRect(146, 37 + i * 18, 30 + ((i * 23) % 50), 6);
    }
    [PALETTE.healthy, PALETTE.blue, PALETTE.wallTrim, PALETTE.brand].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(pad + i * 59, h - 44, 52, 30);
    });
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

/** Hazard label for the reject bin: diagonal stripes around a red plate. */
export function rejectLabelMaterial(): THREE.MeshStandardMaterial {
  return cached('rejectLabel', () => {
    const map = texture('rejectLabel', 256, 96, (ctx, w, h) => {
      ctx.fillStyle = PALETTE.amber;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.hazardDark;
      for (let x = -h; x < w + h; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 18, h);
        ctx.lineTo(x + 18 + h, 0);
        ctx.lineTo(x + h, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(34, 16, w - 68, h - 32);
      ctx.fillStyle = PALETTE.critical;
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('REJECT', w / 2, h / 2 + 3);
    });
    return new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0 });
  });
}
