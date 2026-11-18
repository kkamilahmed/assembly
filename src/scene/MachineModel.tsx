import type { MachineId } from '@/streaming/lineConfig';
import { useMachineSeverity } from '@/ui/fleetTelemetry';
import { BlisterPacker } from './machines/BlisterPacker';
import { Cartoner } from './machines/Cartoner';
import { CoatingDrum } from './machines/CoatingDrum';
import { PowderBlender } from './machines/PowderBlender';
import { TabletPress } from './machines/TabletPress';
import { VisionInspection } from './machines/VisionInspection';

/** One machine on its own, centred on the origin, for the machines screen's
 *  preview cards. Same models as the plant, so a card and the plant view
 *  show the same object. */
export function MachineModel({ machineId }: { machineId: MachineId }) {
  const severity = useMachineSeverity(machineId);
  switch (machineId) {
    case 'BLEND-01':
      return <PowderBlender position={[-0.35, 0, 0]} severity={severity} scale={0.78} />;
    case 'PRESS-P2':
      return <TabletPress rotation={[0, Math.PI / 2, 0]} severity={severity} scale={1.05} />;
    case 'COAT-01':
      return <CoatingDrum length={2.6} ductRun={0.6} severity={severity} scale={0.66} />;
    case 'VISION-01':
      return <VisionInspection rotation={[0, -Math.PI / 2, 0]} severity={severity} scale={0.95} />;
    case 'BLISTER-01':
      return <BlisterPacker rotation={[0, -Math.PI / 2, 0]} severity={severity} scale={0.82} />;
    case 'CARTON-01':
      return <Cartoner position={[0.3, 0, 0]} severity={severity} scale={0.85} />;
  }
}
