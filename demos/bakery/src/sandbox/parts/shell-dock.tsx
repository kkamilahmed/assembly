// Close-up of the yard steps, loading dock, hazard edges and status tags.
import { Diorama } from '@/scene/Diorama';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { StatusTag } from '@/scene/ui3d/StatusTag';
import PlaceholderLine from './shell-placeholder';

export const view = { target: [6, 1, 3] as [number, number, number], zoom: 105 };

export default function ShellDock() {
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <PlaceholderLine />
      <StatusTag position={[MACHINE_POS.vision.x + 0.9, 2.7, MACHINE_POS.vision.z]} label="Vision check" value="Pass" tone="healthy" icon="eye" facing="x" />
      <StatusTag position={[MACHINE_POS.rejectBin.x, 1.3, MACHINE_POS.rejectBin.z]} label="Rejects" value={14} tone="warning" />
      <StatusTag position={[MACHINE_POS.packer.x, 2.3, MACHINE_POS.packer.z]} label="Packed" value={1245} tone="neutral" icon="box" />
      <StatusTag position={[4.4, 0.4, 5.6]} label="Oven zone 3" value="251 °C" tone="critical" icon="thermo" facing="camera" />
    </group>
  );
}
