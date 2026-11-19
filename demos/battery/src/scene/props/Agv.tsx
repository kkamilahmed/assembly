// A self-driving AGV: a low white chassis with orange bumpers, a lidar on
// its nose, a blue running-light strip and a lift deck. Origin at the centre
// of its footprint on the ground, nose toward +x. About 1.05 x 0.74, deck at
// AGV_DECK_Y.
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { useGait } from './gait';
import { mergedBoxes, rbox, cyl } from './kit';
import { moduleCaseGeometry, moduleMaterial } from './module';
import { Part } from './Part';

export const AGV_DECK_Y = 0.36;
const L = 1.05;
const W = 0.74;

function bumperGeometry() {
  return mergedBoxes('agvBumpers', () => [
    { size: [0.06, 0.1, W - 0.04], pos: [L / 2 + 0.01, 0.12, 0], r: 0.03 },
    { size: [0.06, 0.1, W - 0.04], pos: [-L / 2 - 0.01, 0.12, 0], r: 0.03 },
    { size: [0.18, 0.08, 0.04], pos: [L / 2 - 0.08, 0.12, W / 2 + 0.005], r: 0.02 },
    { size: [0.18, 0.08, 0.04], pos: [L / 2 - 0.08, 0.12, -W / 2 - 0.005], r: 0.02 },
    { size: [0.18, 0.08, 0.04], pos: [-L / 2 + 0.08, 0.12, W / 2 + 0.005], r: 0.02 },
    { size: [0.18, 0.08, 0.04], pos: [-L / 2 + 0.08, 0.12, -W / 2 - 0.005], r: 0.02 },
  ]);
}

/**
 * `load` 'auto' carries a module while its Mover is on the outbound leg and
 * runs back empty; true or false fixes it. The running lights pulse while it
 * drives.
 */
export function Agv({ load = 'auto', ...props }: { load?: boolean | 'auto' } & Omit<ThreeElements['group'], 'children'>) {
  const gait = useGait();
  const loadRef = useRef<THREE.Mesh>(null);
  const lidarRef = useRef<THREE.Mesh>(null);
  const white = plastic(PALETTE.white, 0.3);
  const dark = plastic(PALETTE.graphite);
  const strip = useMemo(() => glow(PALETTE.blue, 1.4), []);
  useFrame((_, dt) => {
    if (loadRef.current) loadRef.current.visible = load === 'auto' ? gait.current.outbound : load;
    if (lidarRef.current) lidarRef.current.rotation.y += Math.min(dt, 0.1) * 6;
  });
  return (
    <group {...props}>
      <Part g={rbox(L, 0.22, W, 0.07, 3)} m={white} position-y={0.15} />
      <Part g={rbox(L - 0.12, 0.05, W - 0.1, 0.02, 2)} m={dark} position-y={0.03} />
      <Part g={bumperGeometry()} m={plastic(PALETTE.orange, 0.3)} />
      {/* Lift deck. */}
      <Part g={cyl(0.3, 0.3, 0.06, 24)} m={metal(PALETTE.steelDark, 0.35)} position-y={0.29} />
      <Part g={rbox(0.82, 0.04, 0.56, 0.015, 2)} m={dark} position-y={AGV_DECK_Y - 0.02} />
      {/* Lidar on the nose, and the running-light strips on both sides. */}
      <Part g={cyl(0.07, 0.08, 0.06, 18)} m={dark} position={[L / 2 - 0.12, 0.29, 0]} />
      <mesh ref={lidarRef} geometry={cyl(0.055, 0.055, 0.05, 16)} material={matte('#4a5059', 0.3)} position={[L / 2 - 0.12, 0.345, 0]} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={rbox(L - 0.4, 0.025, 0.01, 0.005, 1)} material={strip} position={[0, 0.2, s * (W / 2 + 0.002)]} />
      ))}
      <mesh ref={loadRef} geometry={moduleCaseGeometry()} material={moduleMaterial()} position-y={AGV_DECK_Y} castShadow receiveShadow />
    </group>
  );
}

