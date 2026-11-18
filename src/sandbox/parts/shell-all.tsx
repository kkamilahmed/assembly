// Hero shot of the diorama shell with the dashboard and a few status tags.
// The sandbox's shadow floor is at y=0, so the whole shell is lifted by the
// slab thickness here: the yard is at y=0 and the slab top at y=0.6.
import { Diorama } from '@/scene/Diorama';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { StatusTag } from '@/scene/ui3d/StatusTag';
import PlaceholderLine from './shell-placeholder';

export const view = { target: [-1, 2.6, 0] as [number, number, number], zoom: 41 };

export default function ShellAll() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <PlaceholderLine />
      <StatusTag position={[-5.6, 3.0, -5]} label="Laser power" value="100%" tone="healthy" icon="bolt" />
      <StatusTag position={[MACHINE_POS.vision.x, 3.0, MACHINE_POS.vision.z]} label="Weld strength" value="240 N" tone="healthy" icon="eye" />
      <StatusTag position={[MACHINE_POS.rejectBin.x, 1.3, MACHINE_POS.rejectBin.z]} label="Scrapped" value={14} tone="warning" />
      <StatusTag position={[MACHINE_POS.transfer.x, 2.3, MACHINE_POS.transfer.z]} label="Passed" value={1245} tone="neutral" icon="battery" />
    </group>
  );
}
