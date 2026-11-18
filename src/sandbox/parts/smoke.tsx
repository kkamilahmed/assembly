import { RoundedBox } from '@react-three/drei';
import { glow, metal, PALETTE, plastic } from '@/scene/style';

export default function Smoke() {
  return (
    <group>
      <RoundedBox args={[2, 1, 1]} radius={0.12} position={[0, 0.5, 0]} castShadow receiveShadow material={plastic(PALETTE.brand)} />
      <RoundedBox args={[1, 2, 1]} radius={0.12} position={[2, 1, -1]} castShadow receiveShadow material={metal()} />
      <mesh position={[-2, 0.5, 1]} material={glow(PALETTE.blue, 3)}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
      </mesh>
    </group>
  );
}
