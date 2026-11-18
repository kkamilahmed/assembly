// Shared building blocks for the street props and the people: cached
// geometries (so two hundred cartons share one box), the TechDealz brand
// textures drawn on canvases, and a small seeded random source.
//
// Everything here is created lazily and cached for the life of the page.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/scene/style';

const geoCache = new Map<string, THREE.BufferGeometry>();

function cachedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

/** Box with bevelled edges. The radius is clamped so thin plates stay valid. */
export function rbox(w: number, h: number, d: number, r = 0.03, seg = 3): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return cachedGeo(`rbox:${w}:${h}:${d}:${rr}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rr));
}

/** Cylinder along y. */
export function cyl(rTop: number, rBottom: number, h: number, seg = 20, open = false): THREE.BufferGeometry {
  return cachedGeo(`cyl:${rTop}:${rBottom}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open));
}

export function sphere(r: number, w = 20, h = 14): THREE.BufferGeometry {
  return cachedGeo(`sph:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
}

/** The top of a sphere, from the pole down to `polar` radians. */
export function dome(r: number, polar: number, w = 22, h = 10): THREE.BufferGeometry {
  return cachedGeo(`dome:${r}:${polar}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, polar));
}

/** Capsule along y; `len` is the straight section. */
export function capsule(r: number, len: number, seg = 12): THREE.BufferGeometry {
  return cachedGeo(`cap:${r}:${len}:${seg}`, () => new THREE.CapsuleGeometry(r, len, 6, seg));
}

export function torus(r: number, tube: number, seg = 28, arc = Math.PI * 2): THREE.BufferGeometry {
  return cachedGeo(`tor:${r}:${tube}:${seg}:${arc}`, () => new THREE.TorusGeometry(r, tube, 8, seg, arc));
}

/** Surface of revolution around y from [radius, y] pairs. */
export function lathe(key: string, profile: Array<[number, number]>, seg = 24): THREE.BufferGeometry {
  return cachedGeo(`lathe:${key}:${seg}`, () => {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * A limb segment: a tapered capsule that hangs from its origin down -y for
 * `len`, `rTop` thick at the joint it hangs from and `rBottom` at the far end.
 */
export function limb(rTop: number, rBottom: number, len: number): THREE.BufferGeometry {
  return cachedGeo(`limb:${rTop}:${rBottom}:${len}`, () => {
    const pts: THREE.Vector2[] = [];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(a) * rBottom, -len - Math.cos(a) * rBottom));
    }
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * rTop, Math.sin(a) * rTop));
    }
    const g = new THREE.LatheGeometry(pts, 14);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * A tyre around the z axis: a rounded-shoulder ring of outer radius `r`,
 * width `w`, open in the middle for the hub.
 */
export function tyre(r: number, w: number): THREE.BufferGeometry {
  return cachedGeo(`tyre:${r}:${w}`, () => {
    const inner = r * 0.56;
    const b = Math.min(w * 0.3, r * 0.2);
    const hw = w / 2;
    const pts: THREE.Vector2[] = [new THREE.Vector2(inner, -hw)];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - b + Math.sin(a) * b, -hw + b - Math.cos(a) * b));
    }
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, hw - b + Math.sin(a) * b));
    }
    pts.push(new THREE.Vector2(inner, hw));
    const g = new THREE.LatheGeometry(pts, 32);
    g.rotateX(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

export interface BoxSpec {
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  r?: number;
}

/** Many bevelled boxes baked into one geometry (one draw call). */
export function mergedBoxes(key: string, specs: () => BoxSpec[], seg = 2): THREE.BufferGeometry {
  return cachedGeo(`merged:${key}`, () => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const parts = specs().map((s) => {
      const [w, h, d] = s.size;
      const r = Math.min(s.r ?? 0.02, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
      const g = new RoundedBoxGeometry(w, h, d, seg, r);
      e.set(...(s.rot ?? [0, 0, 0]));
      m.compose(new THREE.Vector3(...s.pos), q.setFromEuler(e), one);
      g.applyMatrix4(m);
      return g;
    });
    const out = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return out;
  });
}

/** Any geometries baked into one, built once per key. */
export function merged(key: string, make: () => THREE.BufferGeometry[]): THREE.BufferGeometry {
  return cachedGeo(`mergedAny:${key}`, () => {
    const parts = make().map((g) => (g.index ? g.toNonIndexed() : g));
    return mergeGeometries(parts, false);
  });
}

/**
 * A near-white colour taken down a step. The studio key light is hot enough
 * that pure palette whites clip into the seamless background and bloom, which
 * flattens their form; scaled down they keep their shading and still read as
 * white. Colours that are not near-white are returned unchanged.
 */
export function studioWhite(color: string, k = 0.7): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.l < 0.8) return color;
  return `#${c.multiplyScalar(k).getHexString()}`;
}

/** Small deterministic random source (mulberry32). */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- brand

const FONT = '"Arial Rounded MT Bold", "Nunito", "Varela Round", "Helvetica Neue", Arial, sans-serif';

export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Bold text with its corners softened by a same-colour round stroke, so
 *  the wordmark looks rounded whichever system font is picked. */
export function roundText(c: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color: string, spacing = 0) {
  c.font = `900 ${px}px ${FONT}`;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = px * 0.028;
  (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
}

/** The TechDealz mark: a yellow price tag with a lightning bolt through it,
 *  centred on (x, y), `s` across. */
export function drawTdzMark(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.save();
  c.translate(x, y);
  c.fillStyle = PALETTE.tdzYellow;
  c.beginPath();
  c.roundRect(-0.5 * s, -0.5 * s, s, s, 0.22 * s);
  c.fill();
  c.fillStyle = PALETTE.tdzInk;
  c.beginPath();
  c.moveTo(0.08 * s, -0.36 * s);
  c.lineTo(-0.22 * s, 0.06 * s);
  c.lineTo(-0.02 * s, 0.06 * s);
  c.lineTo(-0.1 * s, 0.36 * s);
  c.lineTo(0.22 * s, -0.08 * s);
  c.lineTo(0.02 * s, -0.08 * s);
  c.closePath();
  c.fill();
  c.restore();
}

let wordmarkTex: THREE.CanvasTexture | undefined;
/** Truck-side wordmark: TechDealz on transparent, 4:1. */
export function wordmarkTexture(): THREE.CanvasTexture {
  wordmarkTex ??= canvasTexture(2048, 512, (c) => {
    drawTdzMark(c, 250, 256, 330);
    roundText(c, 'Tech', 470, 300, 270, PALETTE.tdzInk, 2);
    const techW = c.measureText('Tech').width;
    roundText(c, 'Dealz', 470 + techW + 6, 300, 270, '#e0a800', 2);
    roundText(c, 'ONLINE · NEXT-DAY DELIVERY', 482, 430, 80, PALETTE.tdzInk, 14);
  });
  return wordmarkTex;
}

let cartonTex: THREE.CanvasTexture | undefined;
/** One parcel face: printed handling marks and a white shipping label with
 *  the TechDealz mark and a barcode. Cut out with alphaTest. */
export function cartonFaceTexture(): THREE.CanvasTexture {
  cartonTex ??= canvasTexture(512, 400, (c) => {
    const ink = '#7d552c';
    // Printed "this way up" arrows.
    c.fillStyle = ink;
    for (const x of [70, 150]) {
      c.beginPath();
      c.moveTo(x, 40);
      c.lineTo(x + 34, 86);
      c.lineTo(x + 13, 86);
      c.lineTo(x + 13, 140);
      c.lineTo(x - 13, 140);
      c.lineTo(x - 13, 86);
      c.lineTo(x - 34, 86);
      c.closePath();
      c.fill();
    }
    c.fillRect(30, 152, 160, 12);
    // Printed brand line.
    roundText(c, 'TECHDEALZ', 30, 350, 50, ink, 2);
    // Shipping label.
    c.fillStyle = '#fbfbfc';
    c.beginPath();
    c.roundRect(262, 150, 226, 226, 14);
    c.fill();
    drawTdzMark(c, 312, 204, 60);
    roundText(c, 'TechDealz', 352, 216, 26, PALETTE.tdzInk, 0);
    c.fillStyle = '#c9ced6';
    c.fillRect(282, 250, 186, 10);
    c.fillRect(282, 270, 120, 10);
    c.fillStyle = '#23262b';
    let x = 282;
    const bars = [6, 3, 9, 3, 5, 8, 3, 6, 3, 10, 4, 3, 7, 3, 6, 9, 3, 5];
    bars.forEach((b, i) => {
      if (i % 2 === 0) c.fillRect(x, 296, b, 60);
      x += b + 2;
    });
  });
  return cartonTex;
}

const decalCache = new Map<string, THREE.MeshStandardMaterial>();
/** Matte cut-out decal material for a canvas texture. `tint` multiplies the
 *  print; white stickers want a grey tint for the same reason as studioWhite. */
export function decal(key: string, tex: () => THREE.Texture, roughness = 0.75, tint = '#ffffff'): THREE.MeshStandardMaterial {
  let m = decalCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex(),
      color: tint,
      roughness,
      metalness: 0,
      alphaTest: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    decalCache.set(key, m);
  }
  return m;
}

/** A flat rectangle in the xy plane, facing +z. */
export function quad(w: number, h: number): THREE.BufferGeometry {
  return cachedGeo(`quad:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));
}
