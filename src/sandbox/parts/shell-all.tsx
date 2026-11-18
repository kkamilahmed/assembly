// Hero shot of the diorama shell with the dashboard and a few status tags.
// The sandbox's shadow floor is at y=0, so the whole shell is lifted by the
// slab thickness here: the yard is at y=0 and the slab top at y=0.6.
import { Diorama } from '@/scene/Diorama';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { DashboardWall } from '@/scene/ui3d/DashboardWall';
import { StatusTag } from '@/scene/ui3d/StatusTag';
import PlaceholderLine from './shell-placeholder';

export const view = { target: [-1, 2.6, 0] as [number, number, number], zoom: 41 };

export default function ShellAll() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <DashboardWall />
      <PlaceholderLine />
      <StatusTag position={[-2.8, 2.6, -4.4]} label="Oven zone 2" value="221 °C" tone="healthy" icon="thermo" />
      <StatusTag position={[MACHINE_POS.vision.x + 0.9, 2.7, MACHINE_POS.vision.z]} label="Vision check" value="Pass" tone="healthy" icon="eye" facing="x" />
      <StatusTag position={[MACHINE_POS.rejectBin.x, 1.3, MACHINE_POS.rejectBin.z]} label="Rejects" value={14} tone="warning" />
      <StatusTag position={[MACHINE_POS.packer.x, 2.3, MACHINE_POS.packer.z]} label="Packed" value={1245} tone="neutral" icon="box" />
    </group>
  );
}
