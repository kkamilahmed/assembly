import type { MachineId } from '@/streaming/lineConfig';
import { useMachineSeverity } from '@/ui/fleetTelemetry';
import { EolTester } from './machines/EolTester';
import { LaserWelder } from './machines/LaserWelder';
import { CasingStation, CellStacker } from './machines/RobotCells';

/** One machine on its own, centred on the origin, for the machines screen's
 *  preview cards. Same models as the plant, so a card and the plant view
 *  show the same object. */
export function MachineModel({ machineId }: { machineId: MachineId }) {
  const severity = useMachineSeverity(machineId);
  switch (machineId) {
    case 'STK-2':
      return <CellStacker position={[-0.55, 0, 0.55]} severity={severity} scale={1.2} />;
    case 'LW-3':
      return <LaserWelder length={3.0} severity={severity} scale={0.72} position={[0, 0, 0.2]} />;
    case 'CAS-4':
      return <CasingStation position={[0.55, 0, -0.55]} rotation={[0, Math.PI, 0]} severity={severity} scale={1.2} />;
    case 'EOL-5':
      return <EolTester rotation={[0, -Math.PI / 2, 0]} severity={severity} hot={severity === 'critical'} />;
  }
}
