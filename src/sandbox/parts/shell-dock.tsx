// Close-up of the yard steps, airlock, loading dock and status tags.
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
      <StatusTag position={[MACHINE_POS.vision.x + 0.9, 2.7, MACHINE_POS.vision.z]} label="Tablet weight" value="250.1 mg" tone="healthy" icon="pill" facing="x" />
      <StatusTag position={[MACHINE_POS.rejectBin.x, 1.3, MACHINE_POS.rejectBin.z]} label="Rejects" value={14} tone="warning" />
      <StatusTag position={[MACHINE_POS.cartoner.x, 2.3, MACHINE_POS.cartoner.z]} label="Passed" value={12450} tone="neutral" icon="box" />
      <StatusTag position={[4.4, 0.4, 5.6]} label="Cold store" value="5.0 °C" tone="neutral" icon="thermo" facing="camera" />
    </group>
  );
}
