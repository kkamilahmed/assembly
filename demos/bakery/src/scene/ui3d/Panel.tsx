import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { PALETTE, plastic } from '@/scene/style';
import { faceGeometry, slabGeometry, useCanvasTexture } from './kit';
import type { Draw } from './kit';

const BEVEL = 0.03;

export interface PanelProps {
  /** Centre of the panel. Its back sits on the local z=0 plane (the wall). */
  position?: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
  depth?: number;
  radius?: number;
  /** Gap between the wall and the back of the panel. */
  standoff?: number;
  /** Body colour. The face texture should be filled with the same colour. */
  color?: string;
  /** Rim colour, when the edge should differ from the face. */
  rimColor?: string;
  /** How much the face is self-lit, so it stays readable on a shaded wall. */
  lift?: number;
  draw: Draw;
  children?: ReactNode;
}

/**
 * A chunky rounded slab standing proud of a wall with 2D content on its
 * face. The face is an opaque canvas texture on the same glossy material as
 * the body, so the content reads as printed on the object.
 */
export function Panel({
  position,
  rotation,
  width,
  height,
  depth = 0.14,
  radius = 0.22,
  standoff = 0.06,
  color = PALETTE.white,
  rimColor,
  lift = 0.22,
  draw,
  children,
}: PanelProps) {
  const texture = useCanvasTexture(width, height, draw);
  const faceMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: 0.32,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        emissive: '#ffffff',
        emissiveMap: texture,
        emissiveIntensity: lift,
      }),
    [texture, lift],
  );
  useEffect(() => () => faceMaterial.dispose(), [faceMaterial]);
  const body = useMemo(() => [plastic(color), plastic(rimColor ?? color)], [color, rimColor]);

  return (
    <group position={position} rotation={rotation}>
      {standoff > 0 && (
        <mesh position={[0, 0, standoff / 2]} material={plastic(PALETTE.rubber, 0.5)}>
          <boxGeometry args={[width * 0.7, height * 0.6, standoff]} />
        </mesh>
      )}
      <mesh
        position={[0, 0, standoff]}
        geometry={slabGeometry(width, height, depth, radius, BEVEL)}
        material={body}
        castShadow
        receiveShadow
      />
      <mesh
        position={[0, 0, standoff + depth + 0.0015]}
        geometry={faceGeometry(width, height, radius, BEVEL)}
        material={faceMaterial}
        receiveShadow
      />
      {children}
    </group>
  );
}
