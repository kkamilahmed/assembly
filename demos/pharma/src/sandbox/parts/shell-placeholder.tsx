// Stand-ins for the line and machines, only for judging the shell's
// composition in the sandbox.
import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BELT_Y, LINE_PATH, MACHINE_POS } from '@/scene/layout';
import { metal, PALETTE, plastic } from '@/scene/style';

export default function PlaceholderLine() {
  const segments = useMemo(() => {
    const out: Array<{ p: THREE.Vector3; yaw: number; len: number }> = [];
    const n = 90;
    for (let i = 0; i < n; i++) {
      const a = LINE_PATH.getPointAt(i / n);
      const b = LINE_PATH.getPointAt((i + 1) / n);
      out.push({ p: a.clone().lerp(b, 0.5), yaw: -Math.atan2(b.z - a.z, b.x - a.x), len: a.distanceTo(b) + 0.05 });
    }
    return out;
  }, []);
  return (
    <group>
      {segments.map((s, i) => (
        <RoundedBox key={i} args={[s.len, BELT_Y, 1.1]} radius={0.04} smoothness={2} position={[s.p.x, BELT_Y / 2, s.p.z]} rotation-y={s.yaw} material={plastic(PALETTE.graphite)} castShadow receiveShadow />
      ))}
      <RoundedBox args={[1.3, 2.2, 1.3]} radius={0.12} position={[MACHINE_POS.press.x, 1.1, MACHINE_POS.press.z]} material={plastic(PALETTE.white)} castShadow receiveShadow />
      <RoundedBox args={[1.9, 2.4, 2.2]} radius={0.12} position={[MACHINE_POS.blender.x, 1.2, MACHINE_POS.blender.z]} material={metal()} castShadow receiveShadow />
      <RoundedBox args={[3.6, 2.3, 1.7]} radius={0.15} position={[-4, 1.15, -5]} material={plastic(PALETTE.white)} castShadow receiveShadow />
      <RoundedBox args={[1.7, 2, 2.35]} radius={0.12} position={[3, 1, 2.1]} material={plastic(PALETTE.white)} castShadow receiveShadow />
      <RoundedBox args={[1.6, 2.4, 1.6]} radius={0.12} position={[MACHINE_POS.vision.x, 1.2, MACHINE_POS.vision.z]} material={plastic(PALETTE.white)} castShadow receiveShadow />
      <RoundedBox args={[1, 1, 1]} radius={0.08} position={[MACHINE_POS.rejectBin.x, 0.5, MACHINE_POS.rejectBin.z]} material={plastic(PALETTE.critical)} castShadow receiveShadow />
      <RoundedBox args={[1.9, 2, 2.1]} radius={0.12} position={[MACHINE_POS.cartoner.x, 1, MACHINE_POS.cartoner.z]} material={plastic(PALETTE.white)} castShadow receiveShadow />
    </group>
  );
}
