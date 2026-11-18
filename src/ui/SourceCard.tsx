import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { SourceModel } from '@/scene/SourceModel';
import { useStore } from '@/state/store';
import { PROBLEM_SOURCE_ID, RISK_BASELINE, RISK_FLAG, SOURCE_KINDS, SOURCE_LABELS, type SourceId } from '@/streaming/networkConfig';
import {
  channelRangeLabel,
  channelSeverity,
  channelSpec,
  formatReading,
  SIGNAL_CHANNELS,
  type SignalChannel,
} from '@/streaming/signalStream';
import { METRIC_HEX, STATUS_HEX } from './colors';
import { useChannelInjection, useSignalReading, useSourceSeverity } from './sourceTelemetry';
import { SegmentedMeter } from './SegmentedMeter';

/** One source rendered alone, from the same isometric angle as the network,
 *  so a card and the network view show the same building. Lighter than the
 *  network's stage (no post-processing): four of these run at once. */
function SourcePreview({ sourceId, active }: { sourceId: SourceId; active: boolean }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <OrthographicCamera makeDefault position={[20, 20 + 1.2, 20]} zoom={44} near={1} far={100} onUpdate={(c) => c.lookAt(0, 1.2, 0)} />
      <hemisphereLight args={['#ffffff', '#c9ccd2', 0.9]} />
      <directionalLight position={[-8, 18, 6]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[10, 6, -8]} intensity={0.4} color="#dfe8ff" />
      <Environment resolution={128} background={false} environmentIntensity={0.9}>
        <color attach="background" args={['#c9ced6']} />
        <Lightformer form="rect" intensity={3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-10, 4, 6]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} />
      </Environment>
      <SourceModel sourceId={sourceId} />
      <ContactShadows position={[0, 0.005, 0]} scale={9} blur={2.4} far={4} resolution={512} opacity={0.4} color="#1a1d24" />
    </Canvas>
  );
}

export function SourcePreviewCard({ sourceId, active }: { sourceId: SourceId; active: boolean }) {
  // Same reading as the signal card below it - the two cards describe the
  // same source, so they must never disagree about whether it is healthy.
  const severity = useSourceSeverity(sourceId);
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
        <SourcePreview sourceId={sourceId} active={active} />
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-3 py-2 text-xs">
        <span className="font-mono-ui text-[var(--text-secondary)]">{sourceId}</span>
        <span className="text-[var(--text-secondary)]">{SOURCE_LABELS[sourceId]}</span>
      </div>
    </div>
  );
}

export function SignalCard({ sourceId }: { sourceId: SourceId }) {
  const severity = useSourceSeverity(sourceId);
  const reading = useSignalReading(sourceId);
  const color = STATUS_HEX[severity];
  const alarmed = severity !== 'healthy';

  return (
    <div
      className="flex flex-col gap-2.5 rounded-lg border bg-[var(--surface)] p-3 transition-colors"
      style={{
        // An out-of-limits source is findable across the grid at a glance,
        // rather than only from the one small pill in its corner.
        borderColor: alarmed ? `${color}66` : 'var(--border)',
        boxShadow: alarmed ? `0 0 0 3px ${color}14` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-ui text-xs font-semibold">{sourceId}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">{SOURCE_KINDS[sourceId]}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {severity}
        </span>
      </div>

      <RiskMeter sourceId={sourceId} />
      {SIGNAL_CHANNELS.map((channel) => (
        <ChannelMeter key={channel} sourceId={sourceId} channel={channel} value={reading[channel]} />
      ))}

      <div className="font-mono-ui text-[11px] text-[var(--text-secondary)]">Scored today: {Math.round(reading.scored).toLocaleString()}</div>
    </div>
  );
}

/** The source's quality signal, alongside its live signals: the windowed
 *  risk of the charges it is getting approved. */
function RiskMeter({ sourceId }: { sourceId: SourceId }) {
  const source = useStore((s) => s.sources[sourceId]);
  const color = source.status === 'healthy' ? METRIC_HEX.offset : STATUS_HEX[source.status];
  const value = RISK_BASELINE + source.trend;
  return (
    <SegmentedMeter
      label={sourceId === PROBLEM_SOURCE_ID ? 'Risk of approved charges' : 'Risk approved'}
      displayValue={value.toFixed(0)}
      fraction={value / 100}
      color={color}
      rangeLabel={`0-100 · fraud above ${RISK_BASELINE + RISK_FLAG}`}
    />
  );
}

/** One signal channel. Healthy readings keep the channel's own hue so the
 *  three meters read apart; once a reading crosses a limit the bar switches
 *  to the status colour, because at that point which signal it is matters
 *  less than that it is out of range. */
function ChannelMeter({ sourceId, channel, value }: { sourceId: SourceId; channel: SignalChannel; value: number }) {
  const injection = useChannelInjection(sourceId, channel);
  const severity = channelSeverity(sourceId, channel, value);
  const spec = channelSpec(sourceId, channel);
  const color = severity === 'healthy' ? METRIC_HEX[channel] : STATUS_HEX[severity];

  return (
    <SegmentedMeter
      label={spec.label}
      displayValue={formatReading(sourceId, channel, value)}
      fraction={(value - spec.min) / (spec.max - spec.min)}
      color={color}
      rangeLabel={channelRangeLabel(sourceId, channel)}
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
