import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { metal, PALETTE, plastic } from '../style';
import { Kit, lens, roundedCylinder } from './kit';
import type { Piece, Severity } from './kit';
import { Pieces } from './Pieces';

const LENS_R = 0.07;
const LENS_H = 0.1;
const POLE_H = 0.2;
/** Bottom to top, like a real stack light: green, amber, red. */
const ORDER: Array<{ severity: Severity; color: string }> = [
  { severity: 'healthy', color: PALETTE.healthy },
  { severity: 'warning', color: PALETTE.warning },
  { severity: 'critical', color: PALETTE.critical },
];

let shared: { body: Piece[]; lens: THREE.BufferGeometry } | null = null;
function parts() {
  if (!shared) {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const dark = plastic(PALETTE.graphite);
    k.cyl(steel, 0.06, 0.025, [0, 0.0125, 0], 'y', 0.008);
    k.cyl(steel, 0.02, POLE_H, [0, POLE_H / 2, 0], 'y', 0.004, 0.02, 12);
    k.cyl(dark, LENS_R + 0.008, 0.035, [0, POLE_H + 0.0175, 0], 'y', 0.01);
    for (let i = 1; i < 3; i++) k.cyl(dark, LENS_R + 0.004, 0.012, [0, POLE_H + 0.035 + i * (LENS_H + 0.012) - 0.006, 0], 'y', 0.004);
    k.cyl(dark, LENS_R + 0.006, 0.035, [0, POLE_H + 0.035 + 3 * LENS_H + 0.024 + 0.0175, 0], 'y', 0.014);
    shared = { body: k.build(), lens: roundedCylinder(LENS_R, LENS_R, LENS_H, 0.012, 20) };
  }
  return shared;
}

/**
 * Stack light. Origin at the foot of the pole, standing along +y, about
 * 0.6 tall. The segment for `severity` is lit; critical blinks.
 */
export function Andon({ severity = 'healthy', ...props }: { severity?: Severity } & ThreeElements['group']) {
  const { body, lens: lensGeo } = parts();
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(({ clock }) => {
    const blinkOn = severity !== 'critical' || clock.elapsedTime % 0.5 < 0.3;
    for (let i = 0; i < ORDER.length; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const want = lens(ORDER[i].color, ORDER[i].severity === severity && blinkOn);
      if (mesh.material !== want) mesh.material = want;
    }
  });
  return (
    <group {...props}>
      <Pieces pieces={body} />
      {ORDER.map((seg, i) => (
        <mesh
          key={seg.severity}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={lensGeo}
          position={[0, POLE_H + 0.035 + LENS_H / 2 + i * (LENS_H + 0.012), 0]}
          material={lens(seg.color, seg.severity === severity)}
        />
      ))}
    </group>
  );
}
