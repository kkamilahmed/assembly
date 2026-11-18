// The whole block without the slab's people moving about: every building
// and the lanes between them, for judging the architecture.
import { City } from '@/scene/City';
import { Diorama } from '@/scene/Diorama';
import { SLAB } from '@/scene/layout';
import { Live } from '@/scene/Live';

export const view = { target: [-1.2, 1.4, 1.2] as [number, number, number], zoom: 45 };

export default function Buildings() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <City />
      <Live />
    </group>
  );
}
