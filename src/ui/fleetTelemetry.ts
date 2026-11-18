// Selectors over the process-sensor stream for the machines screen. The
// numbers themselves are generated in streaming/sensorStream.ts and land in
// the store through state/engine.ts; nothing is computed here that a second
// component could compute differently.
import { machineSeverity, useStore, type Severity } from '@/state/store';
import type { RobotId } from '@/streaming/lineConfig';
import type { FaultInjection, SensorChannel, SensorReading } from '@/streaming/sensorStream';

export function useSensorReading(robotId: RobotId): SensorReading {
  return useStore((s) => s.sensors[robotId]);
}

/** The dot on a machine's card: the worst of what the weld pipeline says
 *  about it and what its own sensors say. */
export function useMachineSeverity(robotId: RobotId): Severity {
  return useStore((s) => machineSeverity(s, robotId));
}

/** A fault somebody injected by hand from the panel. Scenario faults are
 *  deliberately not returned: they are the machine misbehaving, and badging
 *  them would give the demo away. */
export function useChannelInjection(robotId: RobotId, channel: SensorChannel): FaultInjection | undefined {
  return useStore((s) =>
    s.injections.find((i) => i.robotId === robotId && i.channel === channel && i.source === 'manual'),
  );
}
