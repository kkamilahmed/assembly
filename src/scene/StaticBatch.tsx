import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Renders its children, then merges every static mesh under it into one mesh
 * per material, and hides the originals.
 *
 * The plant is built the readable way, a few dozen small meshes per prop, and
 * that is roughly two thousand draw calls a frame; most of them never move.
 * Batching the static set once after mount turns those into a few dozen
 * draws without changing how anything is authored.
 *
 * Left alone: instanced meshes (already one draw), anything under an object
 * with `userData.dynamic` (animated workers), meshes with multiple materials
 * and anything invisible at the time of the merge.
 */
const BATCH_AFTER_FRAMES = 5;

export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const merged = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = root.current;
    const out = merged.current;
    if (!group || !out) return;
    return () => {
      for (const child of [...out.children]) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        out.remove(mesh);
      }
      group.traverse((o) => {
        if (o.userData.batched) {
          o.visible = true;
          delete o.userData.batched;
        }
      });
    };
  }, []);

  // Batch only after the scene has rendered a few frames: some children
  // reach their final pose inside the render loop (workers set their limbs
  // in useFrame), and the batch captures whatever pose it finds. Counting
  // frames rather than milliseconds holds on a slow machine too.
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === BATCH_AFTER_FRAMES && root.current && merged.current) batch(root.current, merged.current);
  });

  return (
    <>
      <group ref={root}>{children}</group>
      <group ref={merged} />
    </>
  );
}

function isDynamic(o: THREE.Object3D, stop: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== stop; p = p.parent) {
    if (p.userData.dynamic) return true;
  }
  return false;
}

function isVisible(o: THREE.Object3D, stop: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== stop; p = p.parent) if (!p.visible) return false;
  return true;
}

function batch(root: THREE.Group, out: THREE.Group) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
  const m = new THREE.Matrix4();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return;
    if (!isVisible(mesh, root) || isDynamic(mesh, root)) return;
    const src = mesh.geometry;
    if (!src.attributes.position || !src.attributes.normal || Object.keys(src.morphAttributes).length) return;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.attributes.position.clone());
    g.setAttribute('normal', src.attributes.normal.clone());
    const hasUv = !!src.attributes.uv;
    if (hasUv) g.setAttribute('uv', src.attributes.uv.clone());
    if (src.index) g.setIndex(src.index.clone());
    m.multiplyMatrices(toRoot, mesh.matrixWorld);
    g.applyMatrix4(m);
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();

    const key = `${mesh.material.uuid}|${hasUv}|${mesh.castShadow}|${mesh.receiveShadow}`;
    let b = buckets.get(key);
    if (!b) {
      b = { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], sources: [] };
      buckets.set(key, b);
    }
    b.geos.push(flat);
    b.sources.push(mesh);
  });

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
    out.add(mesh);
    for (const s of b.sources) {
      s.visible = false;
      s.userData.batched = true;
    }
  }
}
