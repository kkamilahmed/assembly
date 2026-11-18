import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { mergeStatic, unmerge } from './mergeMeshes';

/** Frames to render before batching; see the comment on useFrame below. */
const BATCH_AFTER_FRAMES = 5;

/**
 * Renders its children, then merges every static mesh under it into one mesh
 * per material and hides the originals.
 *
 * The block is built the readable way, a few dozen small meshes per prop,
 * which is a couple of thousand draw calls a frame; most of them never move.
 * Batching the static set once turns those into a few dozen draws without
 * changing how anything is authored. Instanced meshes and anything under a
 * `userData.dynamic` node (people, moving vehicles) are left alone.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const out = useRef<THREE.Group>(null);
  const made = useRef<THREE.Mesh[]>([]);
  const frames = useRef(0);

  // Batch only after a few rendered frames, so children that settle inside
  // the render loop are in their final place. Counting frames rather than
  // milliseconds holds on a slow machine too.
  useFrame(() => {
    frames.current += 1;
    if (frames.current === BATCH_AFTER_FRAMES && root.current && out.current) {
      made.current = mergeStatic(root.current, out.current);
    }
  });

  useEffect(() => {
    const r = root.current;
    return () => {
      if (r) unmerge(r, made.current);
    };
  }, []);

  return (
    <>
      <group ref={root}>{children}</group>
      <group ref={out} />
    </>
  );
}
