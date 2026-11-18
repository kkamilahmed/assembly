import { machineSeverity, useStore } from '@/state/store';
import { BROWNING_TARGET, PROBLEM_MACHINE_ID } from '@/streaming/lineConfig';
import { formatReading, SENSOR_SPECS } from '@/streaming/sensorStream';
import { BELT_Y, MACHINE_POS } from './layout';
import { Conveyor } from './machines/Conveyor';
import { DoughMixer } from './machines/DoughMixer';
import { Packer } from './machines/Packer';
import { RejectStation } from './machines/RejectStation';
import { TunnelOven } from './machines/TunnelOven';
import { VisionInspection } from './machines/VisionInspection';
import { StatusTag } from './ui3d/StatusTag';

const OVEN_MID: [number, number, number] = [
  (MACHINE_POS.ovenStart.x + MACHINE_POS.ovenEnd.x) / 2,
  0,
  (MACHINE_POS.ovenStart.z + MACHINE_POS.ovenEnd.z) / 2,
];
const OVEN_SPEC = SENSOR_SPECS[PROBLEM_MACHINE_ID].temperature;

/** The line's machines, driven from the live store: the oven glows hotter
 *  with its zone temperature, the reject pusher fires on every kick, the bin
 *  fills, everything stops when the line stops, and each machine's andon
 *  shows the same severity as its card on the machines screen. */
export function Line() {
  const running = useStore((s) => !s.paused);
  const mixerSev = useStore((s) => machineSeverity(s, 'MIXER-01'));
  const ovenSev = useStore((s) => machineSeverity(s, 'OVEN-01'));
  const visionSev = useStore((s) => machineSeverity(s, 'VISION-01'));
  const packSev = useStore((s) => machineSeverity(s, 'PACK-01'));
  const zoneTemp = useStore((s) => s.sensors[PROBLEM_MACHINE_ID].temperature);
  const lastKickAt = useStore((s) => s.lastKickAt);
  const rejected = useStore((s) => s.loavesRejected);
  const packed = useStore((s) => s.loavesPacked);
  const browning = useStore((s) => BROWNING_TARGET + s.machines[PROBLEM_MACHINE_ID].trend);
  const qualityStatus = useStore((s) => s.machines[PROBLEM_MACHINE_ID].status);

  // 1 at setpoint, rising to about 2.5 at a burner runaway.
  const heat = 1 + Math.max(0, zoneTemp - OVEN_SPEC.base) / 38;

  return (
    <group>
      <Conveyor running={running} />
      <DoughMixer position={MACHINE_POS.mixer} rotation={[0, Math.PI / 2, 0]} running={running} severity={mixerSev} />
      <TunnelOven position={OVEN_MID} heat={heat} severity={ovenSev} running={running} />
      <VisionInspection position={MACHINE_POS.vision} rotation={[0, -Math.PI / 2, 0]} scanning={running} severity={visionSev} />
      <RejectStation
        position={MACHINE_POS.rejectGate}
        rotation={[0, -Math.PI / 2, 0]}
        kickAt={lastKickAt}
        binCount={Math.min(rejected, 12)}
      />
      <Packer position={MACHINE_POS.packer} running={running} severity={packSev} />

      {/* Live tags pinned over the machines, the way the references pin
          status cards over shelves. */}
      <StatusTag
        position={[OVEN_MID[0] - 1.2, 2.75, OVEN_MID[2]]}
        label="Zone 2"
        value={formatReading(PROBLEM_MACHINE_ID, 'temperature', zoneTemp)}
        tone={ovenSev}
        icon="thermo"
        scale={1.25}
      />
      <StatusTag
        position={[MACHINE_POS.vision.x, BELT_Y + 2.2, MACHINE_POS.vision.z]}
        label="Browning"
        value={browning.toFixed(1)}
        tone={qualityStatus}
        icon="eye"
        facing="x"
        scale={1.25}
      />
      <StatusTag
        position={[MACHINE_POS.rejectBin.x + 0.2, 1.7, MACHINE_POS.rejectBin.z]}
        label="Rejected"
        value={rejected}
        tone={rejected > 0 ? 'critical' : 'neutral'}
        icon="alert"
        facing="x"
        scale={1.25}
      />
      <StatusTag
        position={[MACHINE_POS.packer.x, 2.6, MACHINE_POS.packer.z]}
        label="Packed"
        value={packed.toLocaleString()}
        tone="neutral"
        icon="box"
        scale={1.25}
      />
    </group>
  );
}
