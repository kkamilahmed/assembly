// The floor dressing in place: the shell, the line and its machines, the
// owner's crew positions as stand-ins, and the dressing itself. The sandbox
// floor is at y=0, so everything is lifted by the slab thickness.
// Query string: bare=1 hides the dressing, for before and after.
import { Diorama } from '@/scene/Diorama';
import { Dressing } from '@/scene/Dressing';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { Conveyor } from '@/scene/machines/Conveyor';
import { DoughMixer } from '@/scene/machines/DoughMixer';
import { Packer } from '@/scene/machines/Packer';
import { RejectStation } from '@/scene/machines/RejectStation';
import { TunnelOven } from '@/scene/machines/TunnelOven';
import { VisionInspection } from '@/scene/machines/VisionInspection';
import { Trolley, Worker } from '@/scene/props';

const query = new URLSearchParams(location.search);

// oxlint-disable-next-line react/only-export-components
export const view = {
  target: (query.get('target')?.split(',').map(Number) ?? [-1.2, 0.6, 0.4]) as [number, number, number],
  zoom: Number(query.get('zoom') ?? 46),
};

export default function DressingPart() {
  const ovenMid = MACHINE_POS.ovenStart.clone().lerp(MACHINE_POS.ovenEnd, 0.5);
  return (
    <group position-y={SLAB.thickness}>
      <Diorama />
      <Conveyor running />
      <DoughMixer position={MACHINE_POS.mixer} rotation={[0, Math.PI / 2, 0]} running severity="healthy" />
      <TunnelOven position={ovenMid} heat={1} severity="healthy" running />
      <VisionInspection position={MACHINE_POS.vision} rotation={[0, -Math.PI / 2, 0]} scanning severity="healthy" />
      <RejectStation position={MACHINE_POS.rejectGate} rotation={[0, -Math.PI / 2, 0]} kickAt={null} binCount={5} />
      <Packer position={MACHINE_POS.packer} running severity="healthy" />
      {/* Stand-ins for the crew the scene owner places (Yard.tsx, Crew). */}
      <Worker position={[-7.4, 0, 4.6]} rotation-y={-2.25} pose="tablet" seed={2} skin={0} />
      <Worker position={[-3.2, 0, -3.2]} rotation-y={Math.PI / 2} pose="inspect" seed={5} skin={1} />
      <Trolley position={[-0.6, 0, -2.6]} rotation-y={0.3} fill={0.85} seed={4} />
      <Worker position={[4.3, 0, -2.3]} rotation-y={Math.PI} pose="inspect" seed={8} skin={3} />
      <Worker position={[6.6, 0, 6.6]} rotation-y={Math.PI / 2} pose="carry" carrying="tray" seed={14} skin={2} />
      <Worker position={[-2.6, 0, -1.4]} pose="walk" seed={17} skin={0} />
      {!query.get('bare') && <Dressing />}
    </group>
  );
}
