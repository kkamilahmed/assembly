import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import { ROBOT_X, ROBOT_Z } from '@/scene/constants';
import { RobotArm } from '@/scene/RobotArm';
import { useStore } from '@/state/store';
import { PROBLEM_ROBOT_ID, ROBOT_LABELS, WELD_TOLERANCE_MM, type RobotId } from '@/streaming/lineConfig';
import {
  CHANNEL_SPECS,
  channelRangeLabel,
  channelSeverity,
  formatReading,
  SENSOR_CHANNELS,
  type SensorChannel,
} from '@/streaming/sensorStream';
import { METRIC_HEX, STATUS_HEX } from './colors';
import { useChannelInjection, useMachineSeverity, useSensorReading } from './fleetTelemetry';
import { SegmentedMeter } from './SegmentedMeter';

// R3F points the default camera at the world origin, which is ground level
// at the arm's pedestal base - too low to frame a ~3m machine with headroom.
// Re-aim it at roughly the arm's mid-height instead, once, on mount.
function AimCamera({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(...target);
  }, [camera, target]);
  return null;
}

/** One machine's arm rendered alone in its own canvas. RobotArm places
 *  itself at this station's world position on the full line (ROBOT_X/
 *  ROBOT_Z, scene/constants.ts) - the inner group cancels that offset so
 *  every card frames its arm at the origin regardless of which station it
 *  is. No docked car ever reaches these standalone canvases, so each arm
 *  just idles at its authored rest pose (RobotArm.tsx's `reachBlend`
 *  requires a docked car to blend into any IK pose). */
function MachinePreview({ robotId, active }: { robotId: RobotId; active: boolean }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: true }}
      // Pulled back and raised to match the larger machines - at the old
      // distance the taller arms clipped straight out of the top of the
      // card, which is what made WHEEL-01's preview look cropped.
      camera={{ fov: 32, near: 0.1, far: 40, position: [6.0, 3.6, 7.6] }}
    >
      <AimCamera target={[0, 2.0, 0]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.3} />
      <Environment preset="studio" background={false} environmentIntensity={0.3} />
      <group position={[-ROBOT_X[robotId], 0, -ROBOT_Z]}>
        <RobotArm robotId={robotId} showProps={false} />
      </group>
      <ContactShadows position={[0, 0.01, 0]} scale={5.4} blur={2.2} far={4} resolution={256} opacity={0.45} color="#1a1d24" />
    </Canvas>
  );
}

export function MachinePreviewCard({ robotId, active }: { robotId: RobotId; active: boolean }) {
  // Same reading as the telemetry card below it - the two cards describe the
  // same machine, so they must never disagree about whether it is healthy.
  const severity = useMachineSeverity(robotId);
  const color = STATUS_HEX[severity];
  const alarmed = severity !== 'healthy';

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border bg-[var(--surface)] transition-colors"
      style={{ borderColor: alarmed ? color : 'var(--border)', boxShadow: alarmed ? `0 0 0 3px ${color}26` : undefined }}
    >
      <div
        className="relative min-h-0 flex-1"
        style={{
          background: alarmed
            ? `linear-gradient(180deg, ${color}33 0%, #eef3f8 100%)`
            : 'linear-gradient(180deg, #dbe8f4 0%, #eef3f8 100%)',
        }}
      >
        <span
          className="absolute left-2.5 top-2.5 z-10 h-2 w-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}33` }}
        />
        <MachinePreview robotId={robotId} active={active} />
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-3 py-2 text-xs">
        <span className="font-mono-ui text-[var(--text-secondary)]">{robotId}</span>
        <span className="text-[var(--text-secondary)]">{ROBOT_LABELS[robotId]}</span>
      </div>
    </div>
  );
}

export function TelemetryCard({ robotId }: { robotId: RobotId }) {
  const severity = useMachineSeverity(robotId);
  const reading = useSensorReading(robotId);
  const color = STATUS_HEX[severity];
  const alarmed = severity !== 'healthy';

  return (
    <div
      className="flex flex-col gap-2.5 rounded-lg border bg-[var(--surface)] p-3 transition-colors"
      style={{
        // An out-of-limits machine is findable across the grid at a glance,
        // rather than only from the one small pill in its corner.
        borderColor: alarmed ? `${color}66` : 'var(--border)',
        boxShadow: alarmed ? `0 0 0 3px ${color}14` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-ui text-xs font-semibold">{robotId}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">{ROBOT_LABELS[robotId]}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {severity}
        </span>
      </div>

      {robotId === PROBLEM_ROBOT_ID && <WeldOffsetMeter />}
      {SENSOR_CHANNELS.map((channel) => (
        <ChannelMeter key={channel} robotId={robotId} channel={channel} value={reading[channel]} />
      ))}

      <div className="font-mono-ui text-[11px] text-[var(--text-secondary)]">Cycles: {Math.round(reading.cycles)}</div>
    </div>
  );
}

/** The weld station's quality signal, alongside its process sensors: the
 *  windowed weld offset the analyzer computes from every car. */
function WeldOffsetMeter() {
  const robot = useStore((s) => s.robots[PROBLEM_ROBOT_ID]);
  const color = robot.status === 'healthy' ? METRIC_HEX.offset : STATUS_HEX[robot.status];
  return (
    <SegmentedMeter
      label="Weld offset"
      displayValue={`${robot.trendMm.toFixed(2)} mm`}
      fraction={robot.trendMm / 2.5}
      color={color}
      rangeLabel={`0-2.5 mm · spec ±${WELD_TOLERANCE_MM}`}
    />
  );
}

/** One sensor channel. Healthy readings keep the channel's own hue so the
 *  three meters read apart; once a reading crosses a limit the bar switches
 *  to the status colour, because at that point which sensor it is matters
 *  less than that it is out of range. */
function ChannelMeter({ robotId, channel, value }: { robotId: RobotId; channel: SensorChannel; value: number }) {
  const injection = useChannelInjection(robotId, channel);
  const severity = channelSeverity(channel, value);
  const spec = CHANNEL_SPECS[channel];
  const color = severity === 'healthy' ? METRIC_HEX[channel] : STATUS_HEX[severity];

  return (
    <SegmentedMeter
      label={spec.label}
      displayValue={formatReading(channel, value)}
      fraction={(value - spec.min) / (spec.max - spec.min)}
      color={color}
      rangeLabel={channelRangeLabel(channel)}
      badge={
        injection && (
          <span
            className="font-mono-ui shrink-0 rounded-sm px-1 py-px text-[9px] font-semibold tracking-normal"
            style={{ color: 'var(--brand-orange)', backgroundColor: 'rgba(232, 98, 44, 0.12)' }}
            title={`Fault injected at level ${injection.intensity}`}
          >
            INJ L{injection.intensity}
          </span>
        )
      }
    />
  );
}
