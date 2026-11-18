// The battery module, the product on the line, as cached geometry: shared by
// the line itself (instanced, one mesh per build stage), the scrap cage, the
// AGV loads and the finished-goods pallets.
//
// A module is 24 cylindrical cells, 6 along its length (x) by 4 across (z),
// standing in a carrier. Built up in stages along the line:
//   cells   - carrier and the 24 cells, as the sorter fills it
//   frame   - top holder plate, end plates and straps, added by the stacker
//   busbars - copper busbars laser-welded across the cell tops
//   case    - aluminium case and cover, added at the casing station
// Every stage is one geometry with its colours in vertex colours, so each is
// a single instanced draw however many modules are on the belt.
// Origin at the centre of the carrier's base; length along x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/scene/style';

export const MODULE = {
  /** Carrier footprint, x by z. */
  l: 0.62,
  w: 0.44,
  base: 0.045,
  cellR: 0.041,
  cellH: 0.25,
  pitchX: 0.095,
  pitchZ: 0.098,
  /** Top of the busbars on an open module. */
  openTop: 0.318,
  /** Top of the cover on a cased module. */
  casedTop: 0.34,
} as const;

const COLS = 6;
const ROWS = 4;
const CELL_TOP = MODULE.base + MODULE.cellH;

const COLORS = {
  carrier: '#dfe3e8',
  pin: PALETTE.orange,
  wrap: '#3a8fd9',
  shoulder: '#24548a',
  cap: PALETTE.steel,
  holder: '#eef0f3',
  endPlate: PALETTE.graphite,
  strap: PALETTE.steelDark,
  copper: '#d28a4c',
  weld: '#8f5428',
  caseBody: '#c3c9d1',
  cover: '#3a3d44',
  terminal: PALETTE.orange,
  label: '#f4f5f7',
  stripe: PALETTE.orange,
};

const _c = new THREE.Color();
function paint(g: THREE.BufferGeometry, hex: string, pos?: [number, number, number], rot?: [number, number, number]): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  if (rot) out.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  if (pos) out.translate(...pos);
  _c.set(hex);
  const n = out.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** Bevelled box; `seg` 1 for small details, which are drawn by the
 *  thousand in the racks. */
const box = (w: number, h: number, d: number, r: number, hex: string, pos: [number, number, number], seg = 1) =>
  paint(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), hex, pos);
const cyl = (r: number, h: number, hex: string, pos: [number, number, number], seg = 12) =>
  paint(new THREE.CylinderGeometry(r, r, h, seg, 1), hex, pos);

function each(fn: (x: number, z: number, i: number, j: number) => void) {
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) fn((i - (COLS - 1) / 2) * MODULE.pitchX, (j - (ROWS - 1) / 2) * MODULE.pitchZ, i, j);
  }
}

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry[]): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    const parts = make();
    g = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    cache.set(key, g);
  }
  return g;
}

/** Carrier and cells. */
export function moduleCellsGeometry(): THREE.BufferGeometry {
  return cached('cells', () => {
    const out = [box(MODULE.l, MODULE.base, MODULE.w, 0.012, COLORS.carrier, [0, MODULE.base / 2, 0], 2)];
    for (const sx of [1, -1]) for (const sz of [1, -1]) out.push(cyl(0.016, 0.03, COLORS.pin, [sx * (MODULE.l / 2 - 0.03), MODULE.base + 0.012, sz * (MODULE.w / 2 - 0.03)], 10));
    each((x, z) => {
      out.push(cyl(MODULE.cellR, MODULE.cellH - 0.02, COLORS.wrap, [x, MODULE.base + (MODULE.cellH - 0.02) / 2, z]));
      out.push(cyl(MODULE.cellR * 0.96, 0.012, COLORS.shoulder, [x, CELL_TOP - 0.014, z]));
      out.push(cyl(MODULE.cellR * 0.62, 0.016, COLORS.cap, [x, CELL_TOP - 0.004, z], 8));
    });
    return out;
  });
}

/** What the stacker adds: holder plate over the cells, end plates, straps. */
export function moduleFrameGeometry(): THREE.BufferGeometry {
  return cached('frame', () => {
    const out: THREE.BufferGeometry[] = [];
    const span = (COLS - 1) * MODULE.pitchX + MODULE.cellR * 2 + 0.03;
    out.push(box(span, 0.016, MODULE.w - 0.03, 0.006, COLORS.holder, [0, CELL_TOP - 0.03, 0]));
    for (const sx of [1, -1]) {
      out.push(box(0.022, CELL_TOP - MODULE.base + 0.01, MODULE.w - 0.01, 0.008, COLORS.endPlate, [sx * (span / 2 + 0.012), MODULE.base + (CELL_TOP - MODULE.base) / 2, 0]));
    }
    for (const sz of [1, -1]) out.push(box(span + 0.06, 0.03, 0.008, 0.003, COLORS.strap, [0, MODULE.base + 0.11, sz * (MODULE.w / 2 - 0.006)]));
    return out;
  });
}

/** The welded busbars: one copper strip per cell column, a weld spot on each
 *  cell, and the two terminal tabs. */
export function moduleBusbarGeometry(): THREE.BufferGeometry {
  return cached('busbars', () => {
    const out: THREE.BufferGeometry[] = [];
    const y = CELL_TOP + 0.008;
    for (let i = 0; i < COLS; i++) {
      const x = (i - (COLS - 1) / 2) * MODULE.pitchX;
      out.push(box(0.06, 0.008, (ROWS - 1) * MODULE.pitchZ + 0.07, 0.003, COLORS.copper, [x, y, 0]));
    }
    each((x, z) => out.push(cyl(0.013, 0.004, COLORS.weld, [x, y + 0.005, z], 8)));
    for (const sx of [1, -1]) out.push(box(0.05, 0.03, 0.12, 0.008, COLORS.copper, [sx * (MODULE.l / 2 - 0.035), y + 0.012, 0]));
    return out;
  });
}

/** The cased module. */
export function moduleCaseGeometry(): THREE.BufferGeometry {
  return cached('case', () => {
    const h = MODULE.casedTop - 0.03;
    const out = [
      box(MODULE.l + 0.02, h, MODULE.w + 0.02, 0.02, COLORS.caseBody, [0, h / 2, 0], 2),
      box(MODULE.l + 0.01, 0.034, MODULE.w + 0.01, 0.014, COLORS.cover, [0, h + 0.012, 0], 2),
    ];
    for (const sx of [1, -1]) out.push(box(0.07, 0.03, 0.14, 0.01, COLORS.terminal, [sx * (MODULE.l / 2 - 0.06), MODULE.casedTop - 0.004, 0]));
    // Label and stripe on both long faces.
    for (const sz of [1, -1]) {
      out.push(box(0.2, 0.12, 0.006, 0.003, COLORS.label, [0.12, h * 0.5, sz * (MODULE.w / 2 + 0.012)]));
      out.push(box(MODULE.l - 0.04, 0.022, 0.006, 0.003, COLORS.stripe, [0, h * 0.84, sz * (MODULE.w / 2 + 0.012)]));
    }
    // Stacking ribs on the ends.
    for (const sx of [1, -1]) for (const y of [0.08, 0.16, 0.24]) out.push(box(0.008, 0.018, MODULE.w - 0.06, 0.004, COLORS.cover, [sx * (MODULE.l / 2 + 0.012), y, 0]));
    return out;
  });
}

/** The red reject flag the weld check clips onto a failed module: a red
 *  tag lying on top and a pennant on a short post. Origin on the top face. */
export function rejectFlagGeometry(): THREE.BufferGeometry {
  return cached('flag', () => [
    box(0.22, 0.014, 0.16, 0.005, PALETTE.critical, [-0.06, 0.007, 0]),
    cyl(0.009, 0.3, '#f4f5f7', [0.16, 0.15, 0.12], 8),
    box(0.15, 0.1, 0.012, 0.004, PALETTE.critical, [0.085, 0.25, 0.12]),
  ]);
}

/** Loose cells standing in a transport tray, 9 x 6, for the cell carts and
 *  the racks in the dry room. About 0.68 x 0.47, 0.18 tall; origin at the
 *  centre of the tray's base. */
export function cellTrayGeometry(): THREE.BufferGeometry {
  return cached('cellTray', () => {
    const out = [box(0.68, 0.025, 0.47, 0.008, COLORS.endPlate, [0, 0.0125, 0])];
    const r = 0.03;
    const h = 0.15;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 6; j++) {
        const x = (i - 4) * 0.072;
        const z = (j - 2.5) * 0.072;
        out.push(cyl(r, h, COLORS.wrap, [x, 0.025 + h / 2, z], 8));
        out.push(cyl(r * 0.6, 0.012, COLORS.cap, [x, 0.025 + h + 0.004, z], 6));
      }
    }
    return out;
  });
}

let bodyMat: THREE.MeshPhysicalMaterial | undefined;
/** Shared material for every module stage: colour comes from the geometry. */
export function moduleMaterial(): THREE.MeshPhysicalMaterial {
  bodyMat ??= new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  return bodyMat;
}

let flagMat: THREE.MeshStandardMaterial | undefined;
/** Slightly self-lit, so a flagged module reads from across the room. */
export function flagMaterial(): THREE.MeshStandardMaterial {
  flagMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: PALETTE.critical, emissiveIntensity: 0.35 });
  return flagMat;
}
