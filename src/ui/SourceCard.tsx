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

const PLACES: Record<SourceId, string> = {
  'CAFE-01': 'Brooklyn, NY',
  'ATM-07': 'Queens, NY',
  'MALL-03': 'Jersey City, NJ',
  'TDZ-WEB': 'Chicago, IL',
};

/** A plain line icon for each kind of source. */
function SourceIcon({ sourceId, color }: { sourceId: SourceId; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7">
      {sourceId === 'CAFE-01' && (
        <>
          <path {...common} d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
          <path {...common} d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path {...common} d="M8 3.5c0 1 1 1 1 2s-1 1-1 2M12 3.5c0 1 1 1 1 2s-1 1-1 2" />
        </>
      )}
      {sourceId === 'ATM-07' && (
        <>
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <rect {...common} x="7" y="6" width="10" height="6" rx="1" />
          <path {...common} d="M8 16h8M8 18.5h5" />
        </>
      )}
      {sourceId === 'MALL-03' && (
        <>
          <path {...common} d="M5 8h14l-1 12H6L5 8Z" />
          <path {...common} d="M9 8V6a3 3 0 0 1 6 0v2" />
        </>
      )}
      {sourceId === 'TDZ-WEB' && (
        <>
          <rect {...common} x="3" y="4" width="18" height="13" rx="2" />
          <path {...common} d="M8 21h8M12 17v4" />
          <path {...common} d="M13 7l-3 4h3l-1 3 3-4h-3l1-3Z" />
        </>
      )}
    </svg>
  );
}

/** The source's own sparkline: the risk of what it is getting approved,
 *  over the last minute or so. */
function RiskSparkline({ sourceId, color }: { sourceId: SourceId; color: string }) {
  const history = useStore((s) => s.sources[sourceId].history);
  const values = history.slice(-80).map((h) => RISK_BASELINE + h.v);
  const W = 100;
  const H = 30;
  const y = (v: number) => H - (Math.min(Math.max(v, 0), 100) / 100) * H;
  const pts = values.map((v, i) => `${((i / Math.max(values.length - 1, 1)) * W).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="min-h-10 w-full flex-1" aria-label="Risk of approved charges">
      <line x1={0} x2={W} y1={y(RISK_BASELINE + RISK_FLAG)} y2={y(RISK_BASELINE + RISK_FLAG)} stroke="#e2c4c2" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
      {values.length > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Who the source is, where it is, and how risky its approvals look. The
 *  globe on the network screen shows where its payments come from. */
export function SourceIdentityCard({ sourceId }: { sourceId: SourceId }) {
  // Same reading as the signal card below it - the two cards describe the
  // same source, so they must never disagree about whether it is healthy.
  const severity = useSourceSeverity(sourceId);
  const color = STATUS_HEX[severity];
  const alarmed = severity !== 'healthy';
  return (
    <div
      className="flex h-full flex-col justify-between gap-2 overflow-hidden rounded-lg border bg-[var(--surface)] p-3 transition-colors"
      style={{
        borderColor: alarmed ? color : 'var(--border)',
        boxShadow: alarmed ? `0 0 0 3px ${color}26` : undefined,
        background: alarmed ? `linear-gradient(180deg, ${color}1f 0%, #ffffff 70%)` : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: alarmed ? `${color}22` : '#eef3f8' }}>
          <SourceIcon sourceId={sourceId} color={alarmed ? color : '#3d5a80'} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{SOURCE_LABELS[sourceId]}</div>
          <div className="truncate text-[11px] text-[var(--text-secondary)]">{SOURCE_KINDS[sourceId]}</div>
          <div className="truncate text-[11px] text-[var(--text-secondary)]">{PLACES[sourceId]}</div>
        </div>
        <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}33` }} />
      </div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Risk of what it gets approved</div>
      <RiskSparkline sourceId={sourceId} color={alarmed ? color : METRIC_HEX.offset} />
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
