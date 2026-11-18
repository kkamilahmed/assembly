// Close-up of the dashboard wall.
import { Diorama } from '@/scene/Diorama';
import { SLAB } from '@/scene/layout';
import { DashboardWall } from '@/scene/ui3d/DashboardWall';

export const view = { target: [-10, 3.6, 0.2] as [number, number, number], zoom: 92 };

export default function ShellWall() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <DashboardWall />
    </group>
  );
}
