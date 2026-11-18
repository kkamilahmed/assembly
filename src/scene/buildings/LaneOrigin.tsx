import { RoundedBox } from '@react-three/drei';
import { glow, PALETTE, plastic } from '../style';
import { RAIL_TOP, RAIL_WIDTH } from '../layout';

/** Where a source's lane begins: a little lit post its payments leave
 *  from, standing just behind the start of the rail. */
export function LaneOrigin({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[RAIL_WIDTH + 0.16, 0.5, 0.26]} radius={0.06} smoothness={3} position={[0, 0.25, 0.14]} material={plastic(PALETTE.graphite, 0.35)} castShadow receiveShadow />
      <mesh position={[0, RAIL_TOP + 0.13, 0.005]} material={glow('#5aa8ff', 1.4)}>
        <boxGeometry args={[RAIL_WIDTH - 0.04, 0.05, 0.012]} />
      </mesh>
    </group>
  );
}
