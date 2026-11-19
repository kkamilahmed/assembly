import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Anything smaller than this across (world units) casts no shadow. At the
 *  plant's zoom its shadow is a pixel or two, but it still costs a draw call
 *  in the shadow pass, and the crew alone carry hundreds of such parts. */
const MIN_SHADOW_SIZE = 0.16;
const sphere = new THREE.Sphere();
const scale = new THREE.Vector3();

function prune(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    const g = mesh.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    sphere.copy(g.boundingSphere!);
    mesh.getWorldScale(scale);
    if (sphere.radius * 2 * Math.max(scale.x, scale.y, scale.z) < MIN_SHADOW_SIZE) mesh.castShadow = false;
  });
}

/** One pass over the finished scene that drops shadow casting on tiny parts.
 *  Runs once after mount and once more after everything has settled. */
export function ShadowBudget() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    prune(get().scene);
    const id = window.setTimeout(() => prune(get().scene), 1500);
    return () => window.clearTimeout(id);
  }, [get]);
  return null;
}
