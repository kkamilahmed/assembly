// The look of the plant, in one place.
//
// The target is an isometric 3D illustration: a dark diorama slab on seamless
// white, glossy rounded props, two accent colours (warm orange for heat and
// the brand, clean blue for people and handling equipment) and crisp bevel
// highlights on every edge. Every mesh in the scene takes its colours and
// materials from here, so the whole plant reads as one illustration rather
// than a pile of separately styled parts.
//
// Rules for anything added to the scene:
// - Nothing has a hard edge. Use drei's <RoundedBox> (radius 0.03-0.08 for
//   props, up to 0.15 for big machine housings) or capsule/cylinder shapes.
// - Use the material factories below, never a bare <meshStandardMaterial>
//   with ad-hoc colours. Materials are cached and shared.
// - Every mesh casts and receives shadows unless it is emissive.
import * as THREE from 'three';

export const PALETTE = {
  /** Clear colour. Set a touch above the target so it lands on a clean
   *  off-white after tone mapping. */
  background: '#fbfbfc',
  slabTop: '#2b2d33',
  slabSide: '#1b1d21',
  slabEdge: '#3a3d44',
  hazardLight: '#eceef1',
  hazardDark: '#16171a',
  wall: '#24262b',
  wallTrim: '#34373e',
  floorWhite: '#f1f2f4',
  tileLine: '#dcdfe4',

  white: '#f6f7f9',
  offWhite: '#e7e9ed',
  steel: '#c7ccd3',
  steelDark: '#8a9099',
  graphite: '#3a3d44',
  rubber: '#26272b',
  glass: '#cfe3f1',

  orange: '#f2782a',
  orangeDeep: '#d9601a',
  orangeGlow: '#ff9440',
  blue: '#3b86e3',
  blueDeep: '#2563b8',
  amber: '#f5b53d',

  cardboard: '#c99a62',
  cardboardDark: '#a97a45',
  tape: '#3b86e3',
  palletWood: '#dcb47e',
  flourSack: '#efe6d3',

  skinTones: ['#f1c7a5', '#d9a07a', '#a8714f', '#7a4e33'],
  coat: '#f7f8fa',
  hairnet: '#5aa0ea',
  glove: '#3b86e3',
  trousers: '#2f3a4d',
  boots: '#f4f5f7',

  healthy: '#2fb574',
  warning: '#f2a33a',
  critical: '#e5484d',
} as const;

/** Bread, from raw dough to charcoal. `bake` 0 is dough, 1 is the perfect
 *  golden crust, 2 is the over-baked limit, 3 is burnt. */
const CRUST_STOPS: Array<[number, THREE.Color]> = [
  [0, new THREE.Color('#f1e9da')],
  [1, new THREE.Color('#d98c38')],
  [2, new THREE.Color('#9a5a26')],
  [3, new THREE.Color('#3a2418')],
];

export function crustColor(bake: number, out: THREE.Color = new THREE.Color()): THREE.Color {
  const b = THREE.MathUtils.clamp(bake, 0, 3);
  for (let i = 1; i < CRUST_STOPS.length; i++) {
    const [b1, c1] = CRUST_STOPS[i];
    if (b <= b1) {
      const [b0, c0] = CRUST_STOPS[i - 1];
      return out.copy(c0).lerp(c1, (b - b0) / (b1 - b0));
    }
  }
  return out.copy(CRUST_STOPS[CRUST_STOPS.length - 1][1]);
}

const cache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

/** Glossy painted/plastic surface: machine housings, cards, vehicles. */
export function plastic(color: string, roughness = 0.32): THREE.MeshPhysicalMaterial {
  return cached(`plastic:${color}:${roughness}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  );
}

/** Brushed stainless: food-grade machine bodies, rails, tunnels. */
export function metal(color: string = PALETTE.steel, roughness = 0.28): THREE.MeshStandardMaterial {
  return cached(`metal:${color}:${roughness}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.85, envMapIntensity: 1.2 }),
  );
}

/** Flat, non-reflective: cardboard, wood, fabric, rubber, skin. */
export function matte(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
  return cached(`matte:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
}

/** Self-lit: oven mouths, indicator lamps, screens. Not shadow-casting. */
export function glow(color: string, intensity = 2): THREE.MeshStandardMaterial {
  return cached(`glow:${color}:${intensity}`, () =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, toneMapped: false }),
  );
}

/** Clear partitions and machine guards. */
export function glass(): THREE.MeshPhysicalMaterial {
  return cached('glass', () =>
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.glass,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
}
