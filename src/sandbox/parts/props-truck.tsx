// Both Voltline trucks, front and rear quarter views.
import { Truck } from '@/scene/props';
import { PALETTE } from '@/scene/style';

export const view = { target: [0, 1.6, 0] as [number, number, number], zoom: 78 };

export default function PropsTruck() {
  return (
    <group>
      <Truck position={[-0.5, 0, 3]} rotation-y={-0.12} />
      <Truck cabColor={PALETTE.white} position={[0.5, 0, -3.2]} rotation-y={Math.PI + 0.35} />
    </group>
  );
}
