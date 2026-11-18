import { machineSeverity, useStore } from '@/state/store';
import { PROBLEM_MACHINE_ID, TESTER_MACHINE_ID, WELD_NOMINAL_N } from '@/streaming/lineConfig';
import { formatReading } from '@/streaming/sensorStream';
import { BELT_Y, MACHINE_POS } from './layout';
import { CellSorter } from './machines/CellSorter';
import { Conveyor } from './machines/Conveyor';
import { EolTester } from './machines/EolTester';
import { LaserWelder } from './machines/LaserWelder';
import { RejectStation } from './machines/RejectStation';
import { CasingStation, CellStacker } from './machines/RobotCells';
import { TransferStation } from './machines/TransferStation';
import { VisionCheck } from './machines/VisionCheck';
import { StatusTag } from './ui3d/StatusTag';

const WELDER_MID: [number, number, number] = [
  (MACHINE_POS.welderStart.x + MACHINE_POS.welderEnd.x) / 2,
  0,
  (MACHINE_POS.welderStart.z + MACHINE_POS.welderEnd.z) / 2,
];

/** The line's machines, driven from the live store: the laser flash dims
 *  and warms as the delivered power drifts low, the reject pusher fires on
 *  every scrapped module, the cage fills, everything stops when the line
 *  stops, and each machine's stack light shows the same severity as its
 *  card on the machines screen. */
export function Line() {
  const running = useStore((s) => !s.paused);
  const stackSev = useStore((s) => machineSeverity(s, 'STK-2'));
  const weldSev = useStore((s) => machineSeverity(s, PROBLEM_MACHINE_ID));
  const caseSev = useStore((s) => machineSeverity(s, 'CAS-4'));
  const testSev = useStore((s) => machineSeverity(s, TESTER_MACHINE_ID));
  const powerLow = useStore((s) => s.sensors[PROBLEM_MACHINE_ID].load);
  const hottestCell = useStore((s) => s.sensors[TESTER_MACHINE_ID].temperature);
  const lastKickAt = useStore((s) => s.lastKickAt);
  const scrapped = useStore((s) => s.modulesScrapped);
  const passed = useStore((s) => s.modulesPassed);
  const strength = useStore((s) => WELD_NOMINAL_N + s.machines[PROBLEM_MACHINE_ID].trend);
  const qualityStatus = useStore((s) => s.machines[PROBLEM_MACHINE_ID].status);

  const power = 1 - powerLow / 100;

  return (
    <group>
      <Conveyor running={running} />
      <CellSorter position={MACHINE_POS.sorter} rotation={[0, Math.PI / 2, 0]} running={running} />
      <CellStacker position={MACHINE_POS.stackRobot} running={running} severity={stackSev} />
      <LaserWelder position={WELDER_MID} power={power} severity={weldSev} running={running} />
      <VisionCheck position={MACHINE_POS.vision} rotation={[0, Math.PI, 0]} scanning={running} severity={weldSev} />
      <CasingStation position={MACHINE_POS.casingRobot} rotation={[0, Math.PI, 0]} running={running} severity={caseSev} />
      <EolTester position={MACHINE_POS.tester} rotation={[0, -Math.PI / 2, 0]} running={running} hot={testSev === 'critical'} severity={testSev} />
      <RejectStation
        position={MACHINE_POS.rejectGate}
        rotation={[0, -Math.PI / 2, 0]}
        kickAt={lastKickAt}
        binCount={scrapped}
      />
      <TransferStation position={MACHINE_POS.transfer} running={running} />

      {/* Live tags pinned over the machines, the way the references pin
          status cards over shelves. */}
      <StatusTag
        position={[WELDER_MID[0] - 1.25, 3.05, WELDER_MID[2]]}
        label="Laser power"
        value={`${Math.round(power * 100)}%`}
        tone={weldSev}
        icon="bolt"
        scale={1.7}
      />
      <StatusTag
        position={[MACHINE_POS.vision.x, BELT_Y + 2.15, MACHINE_POS.vision.z]}
        label="Weld strength"
        value={`${strength.toFixed(0)} N`}
        tone={qualityStatus}
        icon="eye"
        scale={1.7}
      />
      {testSev !== 'healthy' && (
        <StatusTag
          position={[MACHINE_POS.tester.x, 2.75, MACHINE_POS.tester.z]}
          label="Hottest cell"
          value={formatReading(TESTER_MACHINE_ID, 'temperature', hottestCell)}
          tone={testSev}
          icon="thermo"
          facing="x"
          scale={1.7}
        />
      )}
      <StatusTag
        position={[MACHINE_POS.rejectBin.x + 1.6, 1.5, MACHINE_POS.rejectBin.z + 0.2]}
        label="Scrapped"
        value={scrapped}
        tone={scrapped > 0 ? 'critical' : 'neutral'}
        icon="alert"
        facing="x"
        scale={1.7}
      />
      <StatusTag
        position={[MACHINE_POS.transfer.x + 0.3, 2.85, MACHINE_POS.transfer.z + 0.6]}
        label="Passed"
        value={passed.toLocaleString()}
        tone="neutral"
        icon="battery"
        scale={1.7}
      />
    </group>
  );
}
