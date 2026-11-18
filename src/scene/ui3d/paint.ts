// Flat floor paint built as real geometry (not a texture), so stripes and
// lane lines stay razor sharp at any zoom. Everything lies in the XZ plane.
import * as THREE from 'three';

type P = [number, number];
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

function clip(poly: P[], axis: 0 | 1, bound: number, keepBelow: boolean): P[] {
  const out: P[] = [];
  const inside = (p: P) => (keepBelow ? p[axis] <= bound : p[axis] >= bound);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export class Paint {
  private pos: number[] = [];

  /** A convex polygon, in either winding. */
  poly(points: P[]): this {
    if (points.length < 3) return this;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[(i + 1) % points.length];
      area += ax * bz - bx * az;
    }
    // Faces must wind so the normal points up (+y).
    const pts = area > 0 ? [...points].reverse() : points;
    for (let i = 1; i < pts.length - 1; i++) {
      for (const [x, z] of [pts[0], pts[i], pts[i + 1]]) this.pos.push(x, 0, z);
    }
    return this;
  }

  rect(r: Rect): this {
    return this.poly([
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ]);
  }

  /** A straight painted line. `dash`/`gap` make it dashed. */
  line(x0: number, z0: number, x1: number, z1: number, width = 0.07, opts: { dash?: number; gap?: number } = {}): this {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-6) return this;
    const ux = (x1 - x0) / len;
    const uz = (z1 - z0) / len;
    const nx = (-uz * width) / 2;
    const nz = (ux * width) / 2;
    const seg = (a: number, b: number) => {
      if (b - a < 0.02) return;
      this.poly([
        [x0 + ux * a + nx, z0 + uz * a + nz],
        [x0 + ux * b + nx, z0 + uz * b + nz],
        [x0 + ux * b - nx, z0 + uz * b - nz],
        [x0 + ux * a - nx, z0 + uz * a - nz],
      ]);
    };
    const period = opts.dash ? opts.dash + (opts.gap ?? opts.dash) : len;
    const dash = opts.dash ?? len;
    for (let s = 0; s < len - 1e-6; s += period) {
      seg(s, Math.min(s + dash, len));
    }
    return this;
  }

  /**
   * Diagonal stripes filling a rectangle. `along` is the band's long axis;
   * `lean` is how far a stripe shifts along it while crossing the band, as a
   * multiple of the band's width.
   */
  stripes(r: Rect, along: 'x' | 'z', stripe = 0.26, gap = 0.26, lean = 1): this {
    // Work in (u, v): u along the band, v across it.
    const [u0, u1, v0, v1] = along === 'x' ? [r.x0, r.x1, r.z0, r.z1] : [r.z0, r.z1, r.x0, r.x1];
    const shift = (v1 - v0) * lean;
    const period = stripe + gap;
    for (let u = u0 - Math.abs(shift) - period; u < u1 + Math.abs(shift) + period; u += period) {
      let p: P[] = [
        [u, v0],
        [u + stripe, v0],
        [u + stripe + shift, v1],
        [u + shift, v1],
      ];
      p = clip(p, 0, u0, false);
      p = clip(p, 0, u1, true);
      this.poly(along === 'x' ? p : p.map(([a, b]): P => [b, a]));
    }
    return this;
  }

  /** A walking-direction arrow at (x, z), pointing along `angle` (0 = +x, toward +z as it grows). */
  arrow(x: number, z: number, angle: number, size = 0.5): this {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const at = (u: number, v: number): P => [x + (u * c - v * s) * size, z + (u * s + v * c) * size];
    this.poly([at(-0.9, -0.14), at(0.1, -0.14), at(0.1, 0.14), at(-0.9, 0.14)]);
    this.poly([at(0.1, -0.45), at(0.9, 0), at(0.1, 0.45)]);
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const n = this.pos.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    const normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) normals[i * 3 + 1] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return g;
  }
}
