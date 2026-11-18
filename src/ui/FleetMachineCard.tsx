import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { MachineModel } from '@/scene/MachineModel';
import { useStore } from '@/state/store';
import {
  MACHINE_LABELS,
  PROBLEM_MACHINE_ID,
  WEIGHT_TARGET_MG,
  WEIGHT_TOLERANCE_MG,
  type MachineId,
} from '@/streaming/lineConfig';
import {
  channelRangeLabel,
  channelSeverity,
  channelSpec,
  formatReading,
  SENSOR_CHANNELS,
  type SensorChannel,
} from '@/streaming/sensorStream';
import { METRIC_HEX, STATUS_HEX } from './colors';
import { useChannelInjection, useMachineSeverity, useSensorReading } from './fleetTelemetry';
import { SegmentedMeter } from './SegmentedMeter';

/** One machine rendered alone, from the same isometric angle as the plant,
 *  so a card and the plant view show the same object. Lighter than the
 *  plant's stage (no post-processing): four of these run at once. */
function MachinePreview({ machineId, active }: { machineId: MachineId; active: boolean }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <OrthographicCamera makeDefault position={[20, 20 + 1.2, 20]} zoom={78} near={1} far={100} onUpdate={(c) => c.lookAt(0, 1.2, 0)} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 0.9]} />
      <directionalLight position={[-8, 18, 6]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[10, 6, -8]} intensity={0.4} color="#dfe8ff" />
      <Environment resolution={128} background={false} environmentIntensity={0.9}>
        <color attach="background" args={['#c9ced6']} />
        <Lightformer form="rect" intensity={3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-10, 4, 6]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} />
      </Environment>
      <MachineModel machineId={machineId} />
      <ContactShadows position={[0, 0.005, 0]} scale={8} blur={2.4} far={4} resolution={512} opacity={0.4} color="#1a1d24" />
    </Canvas>
  );
}

export function MachinePreviewCard({ machineId, active }: { machineId: MachineId; active: boolean }) {
  // Same reading as the telemetry card below it - the two cards describe the
  // same machine, so they must never disagree about whether it is healthy.
  const severity = useMachineSeverity(machineId);
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
        <MachinePreview machineId={machineId} active={active} />
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-3 py-2 text-xs">
        <span className="font-mono-ui text-[var(--text-secondary)]">{machineId}</span>
        <span className="text-[var(--text-secondary)]">{MACHINE_LABELS[machineId]}</span>
      </div>
    </div>
  );
}

export function TelemetryCard({ machineId }: { machineId: MachineId }) {
  const severity = useMachineSeverity(machineId);
  const reading = useSensorReading(machineId);
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
          <div className="font-mono-ui text-xs font-semibold">{machineId}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">{MACHINE_LABELS[machineId]}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {severity}
        </span>
      </div>

      {machineId === PROBLEM_MACHINE_ID && <WeightMeter />}
      {SENSOR_CHANNELS.map((channel) => (
        <ChannelMeter key={channel} machineId={machineId} channel={channel} value={reading[channel]} />
      ))}

      <div className="font-mono-ui text-[11px] text-[var(--text-secondary)]">Cycles: {Math.round(reading.cycles)}</div>
    </div>
  );
}

/** The press's quality signal, alongside its process sensors: the windowed
 *  mean tablet weight inspection measures on every tray. */
function WeightMeter() {
  const machine = useStore((s) => s.machines[PROBLEM_MACHINE_ID]);
  const color = machine.status === 'healthy' ? METRIC_HEX.offset : STATUS_HEX[machine.status];
  const value = WEIGHT_TARGET_MG + machine.trend;
  const lo = WEIGHT_TARGET_MG - 30;
  const hi = WEIGHT_TARGET_MG + 10;
  return (
    <SegmentedMeter
      label="Tablet weight"
      displayValue={`${value.toFixed(1)} mg`}
      fraction={(value - lo) / (hi - lo)}
      color={color}
      rangeLabel={`${lo}-${hi} mg · target ${WEIGHT_TARGET_MG} ±${WEIGHT_TOLERANCE_MG}`}
    />
  );
}

/** One sensor channel. Healthy readings keep the channel's own hue so the
 *  three meters read apart; once a reading crosses a limit the bar switches
 *  to the status colour, because at that point which sensor it is matters
 *  less than that it is out of range. */
function ChannelMeter({ machineId, channel, value }: { machineId: MachineId; channel: SensorChannel; value: number }) {
  const injection = useChannelInjection(machineId, channel);
  const severity = channelSeverity(machineId, channel, value);
  const spec = channelSpec(machineId, channel);
  const color = severity === 'healthy' ? METRIC_HEX[channel] : STATUS_HEX[severity];

  return (
    <SegmentedMeter
      label={spec.label}
      displayValue={formatReading(machineId, channel, value)}
      fraction={(value - spec.min) / (spec.max - spec.min)}
      color={color}
      rangeLabel={channelRangeLabel(machineId, channel)}
      badge={
        injection && (
          <span
            className="font-mono-ui shrink-0 rounded-sm px-1 py-px text-[9px] font-semibold tracking-normal"
            style={{ color: 'var(--brand)', backgroundColor: 'rgba(24, 104, 214, 0.12)' }}
            title={`Fault injected at level ${injection.intensity}`}
          >
            INJ L{injection.intensity}
          </span>
        )
      }
    />
  );
}
