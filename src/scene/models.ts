import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Real, royalty-free car mesh shipped under /public/models:
//  - Ferrari 458 body ( Sketchfab: vicent091036, CC-BY ) — used by the
//    official three.js webgl_materials_car demo. Stored self-contained as a
//    DRACO-compressed GLB; the decoder is vendored at /draco (copied from
//    three/examples/jsm/libs/draco) so the page never depends on a CDN.
//
// The robot arms are parametric (see RobotArm.tsx) so each station can be a
// genuinely different machine modelled on a real body-shop brand, rather
// than four clones of one imported mesh.
export const FERRARI_URL = '/models/ferrari.glb';

useGLTF.preload(FERRARI_URL, '/draco/');

let tireMaterialPatched = false;

export function useFerrariModel() {
  const gltf = useGLTF(FERRARI_URL, '/draco/');
  if (!tireMaterialPatched) {
    // The tire mesh isn't a fully closed shell (no modelled inner wall),
    // and glTF materials default to single-sided — so from some angles you
    // see straight through the tire to whatever's behind it (the light
    // floor/background) instead of rubber, reading as a white gap inside
    // the tire. useGLTF caches this GLTF by URL, and GLTFLoader shares one
    // material instance across all 4 tire meshes, so patching it once here
    // (rather than per-consumer) fixes it everywhere this model is used:
    // a car's own mounted wheels (CarShell) and the Wheel station's
    // rack/carried wheel props (stationTargets' useWheelPropModel), both
    // of which only clone the node hierarchy and share this same material.
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === 'Tires') {
        mesh.material.side = THREE.DoubleSide;
      }
    });
    tireMaterialPatched = true;
  }
  return gltf;
}

export interface Fit {
  scale: number;
  position: [number, number, number];
}

/** Compute a uniform scale + position for `obj` (in its current local pose)
 *  so that its extent along `axis` becomes `size`, then place the model so
 *  that its lowest point (min-Y) sits at y=0 (on the floor / belt), X is
 *  centred on 0 unless `pinX` (min corner pinned to 0), and Z is centred on
 *  0 unless `pinZ` (min corner pinned to 0, model extends +Z). */
export function fitObject3D(
  obj: THREE.Object3D,
  opts: { axis: 'x' | 'y' | 'z'; size: number; pinX?: boolean; pinZ?: boolean },
): Fit {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const sz = new THREE.Vector3();
  box.getSize(sz);
  const extent = opts.axis === 'x' ? sz.x : opts.axis === 'y' ? sz.y : sz.z;
  const scale = opts.size / extent;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const px = opts.pinX ? -box.min.x * scale : -cx * scale;
  const py = -box.min.y * scale;
  const pz = opts.pinZ ? -box.min.z * scale : -cz * scale;
  return { scale, position: [px, py, pz] };
}
