// The look of the city block, in one place.
//
// The target is an isometric 3D illustration: a dark diorama slab on seamless
// white, glossy rounded props, two accent colours (warm orange for the brand,
// clean blue for the network and its people) and crisp bevel highlights on
// every edge. Every mesh in the scene takes its colours and materials from
// here, so the whole block reads as one illustration rather than a pile of
// separately styled parts.
//
// Rules for anything added to the scene:
// - Nothing has a hard edge. Use drei's <RoundedBox> (radius 0.03-0.08 for
//   props, up to 0.15 for big building parts) or capsule/cylinder shapes.
// - Use the material factories below, never a bare <meshStandardMaterial>
//   with ad-hoc colours. Materials are cached and shared.
// - Every mesh casts and receives shadows unless it is emissive.
import * as THREE from 'three';

export const PALETTE = {
  /** Clear colour. Set a touch above the target so it lands on a clean
   *  off-white after tone mapping. */
  background: '#fbfbfc',
  slabTop: '#3a3d45',
  slabSide: '#1b1d21',
  slabEdge: '#3a3d44',
  hazardLight: '#eceef1',
  hazardDark: '#16171a',
  wall: '#2e3036',
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
  tape: '#f6c431',
  palletWood: '#dcb47e',

  /** The avenue the lanes run along, a shade darker than the block. */
  asphalt: '#2d3037',
  paving: '#c8ccd3',
  pavingDark: '#aeb3bb',
  tile: '#eef0f3',
  stone: '#ebe6dc',
  gold: '#d9a640',
  /** Brand colours of the sources. */
  cafeGreen: '#2f9e6b',
  tdzYellow: '#f6c431',
  tdzInk: '#1f2126',
  foliage: '#58a95a',
  foliageDark: '#3d8a48',
  bark: '#8a6446',

  skinTones: ['#f1c7a5', '#d9a07a', '#a8714f', '#7a4e33'],

  healthy: '#2fb574',
  warning: '#f2a33a',
  critical: '#e5484d',
} as const;

const cache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

/** Glossy painted/plastic surface: shopfronts, cards, vehicles. */
export function plastic(color: string, roughness = 0.32): THREE.MeshPhysicalMaterial {
  return cached(`plastic:${color}:${roughness}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  );
}

/** Brushed metal: fittings, rails, frames, the vault door. */
export function metal(color: string = PALETTE.steel, roughness = 0.28): THREE.MeshStandardMaterial {
  return cached(`metal:${color}:${roughness}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.85, envMapIntensity: 1.2 }),
  );
}

/** Flat, non-reflective: cardboard, wood, fabric, rubber, skin. */
export function matte(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
  return cached(`matte:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
}

/** Self-lit: indicator lamps, screens, light strips. Not shadow-casting. */
export function glow(color: string, intensity = 2): THREE.MeshStandardMaterial {
  return cached(`glow:${color}:${intensity}`, () =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, toneMapped: false }),
  );
}

/** Clear partitions and shop windows. */
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
