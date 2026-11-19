import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Bucket {
  material: THREE.Material;
  cast: boolean;
  receive: boolean;
  geos: THREE.BufferGeometry[];
  sources: THREE.Mesh[];
}

/** A copy of `src` with only position/normal(/uv), transformed by `matrix`
 *  and de-indexed so any two can be merged. Null when it can't be merged. */
function bakeable(src: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry | null {
  if (!src.attributes.position || !src.attributes.normal || Object.keys(src.morphAttributes).length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.attributes.position.clone());
  g.setAttribute('normal', src.attributes.normal.clone());
  if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv.clone());
  if (src.index) g.setIndex(src.index.clone());
  g.applyMatrix4(matrix);
  if (!g.index) return g;
  const flat = g.toNonIndexed();
  g.dispose();
  return flat;
}

/** Collects `mesh` into the bucket for its material and shadow flags. */
function collect(buckets: Map<string, Bucket>, mesh: THREE.Mesh, matrix: THREE.Matrix4) {
  if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return;
  const g = bakeable(mesh.geometry, matrix);
  if (g) add(buckets, mesh, g);
}

function add(buckets: Map<string, Bucket>, mesh: THREE.Mesh, g: THREE.BufferGeometry) {
  const material = mesh.material as THREE.Material;
  const key = `${material.uuid}|${!!g.attributes.uv}|${mesh.castShadow}|${mesh.receiveShadow}`;
  let b = buckets.get(key);
  if (!b) {
    b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], sources: [] };
    buckets.set(key, b);
  }
  b.geos.push(g);
  if (!b.sources.includes(mesh)) b.sources.push(mesh);
}

/** Vertices an instanced mesh may expand to before it is left instanced:
 *  a few hundred stacked cartons bake in fine, a thousand trees would not. */
const MAX_BAKED_INSTANCE_VERTICES = 250_000;

/** Bakes every instance of a static, uncoloured instanced mesh into the
 *  buckets, so stock stacks join the batch instead of costing a draw (and
 *  a shadow draw) each. */
function collectInstances(buckets: Map<string, Bucket>, mesh: THREE.InstancedMesh, toRoot: THREE.Matrix4) {
  if (mesh.instanceColor || Array.isArray(mesh.material) || mesh.count === 0) return false;
  if (mesh.count * mesh.geometry.attributes.position.count > MAX_BAKED_INSTANCE_VERTICES) return false;
  const base = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
  const inst = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, inst);
    const g = bakeable(mesh.geometry, m.multiplyMatrices(base, inst));
    if (!g) return false;
    add(buckets, mesh, g);
  }
  return true;
}

/** One material for every plain, untextured part of a rigged figure: the
 *  part's own colour rides in its vertices, so a bone carrying a sleeve, a
 *  glove and a badge is one draw instead of three. At the size people are
 *  drawn, the differences in gloss between those materials don't read. */
let tintMaterial: THREE.MeshStandardMaterial | undefined;
function tint(): THREE.MeshStandardMaterial {
  tintMaterial ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 });
  return tintMaterial;
}

/** A plain colour with no texture, glow or transparency. */
function isPlain(m: THREE.Material): m is THREE.MeshStandardMaterial {
  const s = m as THREE.MeshStandardMaterial;
  return (
    s.isMeshStandardMaterial === true &&
    !s.map &&
    !s.transparent &&
    s.toneMapped &&
    s.metalness < 0.5 &&
    (!s.emissive || s.emissive.getHex() === 0)
  );
}

/** Like `collect`, but plain materials share one vertex-coloured bucket. */
function collectTinted(buckets: Map<string, Bucket>, mesh: THREE.Mesh, matrix: THREE.Matrix4) {
  const material = mesh.material as THREE.Material;
  if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material) || !isPlain(material)) {
    collect(buckets, mesh, matrix);
    return;
  }
  const g = bakeable(mesh.geometry, matrix);
  if (!g) return;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = material.color;
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const key = `tint|${mesh.castShadow}|${mesh.receiveShadow}`;
  let b = buckets.get(key);
  if (!b) {
    b = { material: tint(), cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], sources: [] };
    buckets.set(key, b);
  }
  b.geos.push(g);
  b.sources.push(mesh);
}

/** Turns each bucket of two or more meshes into one merged mesh added to
 *  `target`, hiding the originals (left in place, so React still owns them).
 *  Returns the merged meshes. */
function flush(buckets: Map<string, Bucket>, target: THREE.Object3D): THREE.Mesh[] {
  const made: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    if (b.geos.length < 2) {
      b.geos.forEach((g) => g.dispose());
      continue;
    }
    const geometry = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.userData.merged = true;
    target.add(mesh);
    made.push(mesh);
    for (const s of b.sources) {
      s.visible = false;
      s.userData.batched = true;
    }
  }
  return made;
}

/**
 * Within every node of a rigged figure, merges the node's direct mesh
 * children: plain colours into one vertex-coloured mesh, anything lit,
 * textured or see-through per material. Bones (the groups an animation
 * rotates) keep moving; only the meshes riding on the same bone become one
 * draw. A worker drops from about 45 draws to about 15.
 */
export function mergeRigidChildren(root: THREE.Object3D): THREE.Mesh[] {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh && o.children.length > 1) nodes.push(o);
  });
  const made: THREE.Mesh[] = [];
  for (const node of nodes) {
    const buckets = new Map<string, Bucket>();
    for (const child of node.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || mesh.userData.merged) continue;
      mesh.updateMatrix();
      collectTinted(buckets, mesh, mesh.matrix);
    }
    made.push(...flush(buckets, node));
  }
  return made;
}

function hiddenOrDynamic(o: THREE.Object3D, stop: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== stop; p = p.parent) {
    if (!p.visible || p.userData.dynamic) return true;
  }
  return false;
}

/** Merges every static mesh under `root` into `out`, one mesh per
 *  material, in `root`'s space, baking small uncoloured instanced meshes in
 *  too. Skips anything under a `userData.dynamic` node and anything
 *  hidden. */
export function mergeStatic(root: THREE.Object3D, out: THREE.Object3D): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const buckets = new Map<string, Bucket>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || hiddenOrDynamic(mesh, root)) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      collectInstances(buckets, mesh as THREE.InstancedMesh, toRoot);
      return;
    }
    m.multiplyMatrices(toRoot, mesh.matrixWorld);
    collect(buckets, mesh, m);
  });
  return flush(buckets, out);
}

/** Undoes either merge: removes merged meshes and shows the originals. */
export function unmerge(root: THREE.Object3D, made: THREE.Mesh[]) {
  for (const mesh of made) {
    mesh.geometry.dispose();
    mesh.parent?.remove(mesh);
  }
  root.traverse((o) => {
    if (o.userData.batched) {
      o.visible = true;
      delete o.userData.batched;
    }
  });
}
