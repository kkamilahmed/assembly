// The floor dressing in place: the shell, the line and its machines, the
// scene owner's crew, and the dressing itself. The sandbox floor is at y=0,
// so everything is lifted by the slab thickness.
// Query string: bare=1 hides the dressing, for before and after.
import { Diorama } from '@/scene/Diorama';
import { Dressing } from '@/scene/Dressing';
import { SLAB } from '@/scene/layout';
import { Crew } from '@/scene/Yard';
import { MachinesPlant } from './machines-all';

const query = new URLSearchParams(location.search);

// oxlint-disable-next-line react/only-export-components
export const view = {
  target: (query.get('target')?.split(',').map(Number) ?? [-1.2, 0.6, 0.4]) as [number, number, number],
  zoom: Number(query.get('zoom') ?? 46),
};

export default function DressingPart() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <MachinesPlant />
      <Crew />
      {!query.get('bare') && <Dressing />}
    </group>
  );
}
