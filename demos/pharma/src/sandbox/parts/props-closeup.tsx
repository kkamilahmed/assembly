// Two workers at portrait distance, for checking faces, masks, hands and
// seams: one gowned for the clean room, one in yard kit.
import { Worker } from '@/scene/props';

export const view = { target: [0, 0.95, 0] as [number, number, number], zoom: 520 };

export default function PropsCloseup() {
  return (
    <group>
      <Worker pose="stand" skin={0} seed={1} position={[0.45, 0, -0.45]} rotation-y={-Math.PI / 4 + 0.5} />
      <Worker pose="tablet" skin={2} seed={5} vest position={[-0.45, 0, 0.45]} rotation-y={-Math.PI / 4 - 0.3} />
    </group>
  );
}
