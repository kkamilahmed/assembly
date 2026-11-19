// Two tiny mesh helpers every prop is built from.
import { useLayoutEffect, useRef } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';

type PartProps = Omit<ThreeElements['mesh'], 'geometry' | 'material'> & {
  g: THREE.BufferGeometry;
  m: THREE.Material;
};

/** A shadow-casting, shadow-receiving mesh from a shared geometry and a
 *  shared material. */
export function Part({ g, m, ...rest }: PartProps) {
  return <mesh geometry={g} material={m} castShadow receiveShadow {...rest} />;
}

/** Many copies of one geometry in a single draw call. `matrices` is read
 *  once per change of the array identity, so memoise it. */
export function Instances({
  g,
  m,
  matrices,
  shadows = true,
}: {
  g: THREE.BufferGeometry;
  m: THREE.Material;
  matrices: THREE.Matrix4[];
  shadows?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [matrices]);
  if (matrices.length === 0) return null;
  return (
    <instancedMesh
      key={matrices.length}
      ref={ref}
      args={[g, m, matrices.length]}
      castShadow={shadows}
      receiveShadow
    />
  );
}
