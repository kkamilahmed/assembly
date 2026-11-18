// Close-up of the hygiene zone, glass partition and floor paint.
import { Diorama } from '@/scene/Diorama';
import { SLAB } from '@/scene/layout';
import PlaceholderLine from './shell-placeholder';

export const view = { target: [-6.5, 0.8, 4.2] as [number, number, number], zoom: 95 };

export default function ShellFloor() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <PlaceholderLine />
    </group>
  );
}
