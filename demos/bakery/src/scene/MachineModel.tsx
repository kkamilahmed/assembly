import type { MachineId } from '@/streaming/lineConfig';
import { useMachineSeverity } from '@/ui/fleetTelemetry';
import { DoughMixer } from './machines/DoughMixer';
import { Packer } from './machines/Packer';
import { TunnelOven } from './machines/TunnelOven';
import { VisionInspection } from './machines/VisionInspection';

/** One machine on its own, centred on the origin, for the machines screen's
 *  preview cards. Same models as the plant, so a card and the plant view
 *  show the same object. */
export function MachineModel({ machineId }: { machineId: MachineId }) {
  const severity = useMachineSeverity(machineId);
  switch (machineId) {
    case 'MIXER-01':
      return <DoughMixer rotation={[0, Math.PI / 2, 0]} severity={severity} />;
    case 'OVEN-01':
      return <TunnelOven length={4.2} severity={severity} scale={0.85} />;
    case 'VISION-01':
      return <VisionInspection rotation={[0, -Math.PI / 2, 0]} severity={severity} />;
    case 'PACK-01':
      return <Packer position={[0.4, 0, 0]} severity={severity} />;
  }
}
