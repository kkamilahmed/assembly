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
  if (!g) return;
  const material = mesh.material as THREE.Material;
  const key = `${material.uuid}|${!!g.attributes.uv}|${mesh.castShadow}|${mesh.receiveShadow}`;
  let b = buckets.get(key);
  if (!b) {
    b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], sources: [] };
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
    if (b.sources.length < 2) {
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
 * children per material. Bones (the groups an animation rotates) keep
 * moving; only the meshes riding on the same bone become one draw. A worker
 * drops from about 45 draws to about 20.
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
      collect(buckets, mesh, mesh.matrix);
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
 *  material, in `root`'s space. Skips anything under a `userData.dynamic`
 *  node and anything hidden. */
export function mergeStatic(root: THREE.Object3D, out: THREE.Object3D): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const buckets = new Map<string, Bucket>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || hiddenOrDynamic(mesh, root)) return;
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
