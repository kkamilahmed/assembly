import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import { FRAUD_RATE_LIMIT, HOURS_UNTIL_BATCH, packetsToCharges } from './businessCase';
import { OUTCOME_HEX, STATUS_HEX } from './colors';
import { fmtUsd } from './format';
import { Kbd } from './Kbd';
import { useTrafficHistory, type Bucket } from './trafficHistory';
import { AnalystOnShift, IncidentTimeline } from './Shift';
import { ViewNav } from './ViewNav';
import type { View } from './views';

const FRAUD = OUTCOME_HEX.fraud;

/** "0.93%": two decimals under 1%, where a fraud rate lives. */
function fmtRate(rate: number): string {
  const pct = rate * 100;
  return `${pct < 10 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}

/**
 * The outcome screen, to the right of the network: what the attack is
 * costing. It shows the effect (fraud getting through, money lost) and
 * deliberately not the cause; finding the cause is the sources screen's job,
 * one screen to the left of the network.
 */
export function DashboardScreen({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const frozen = useStore((s) => s.frozen);
  const blocked = useStore((s) => s.blocked);
  const history = useTrafficHistory();
  const { latest, rates, buckets, current } = history;
  const rising = rates.length > 4 && latest.rate > (rates.at(-5) ?? 0) + 0.0002;
  const leaking = latest.rate > 0;

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Dashboard · Northgate Payments</div>
          <div className="text-xs text-[var(--text-secondary)]">What the network is approving, live</div>
        </div>
        <div className="ml-6">
          <AnalystOnShift />
        </div>
        <div className="ml-auto">
          <ViewNav view={view} onChange={onNavigate} />
        </div>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <Outcome leaking={leaking} frozen={frozen} byBatchUsd={latest.byBatchUsd} byBatchCharges={latest.byBatchCharges} />

        <div className="grid shrink-0 grid-cols-4 gap-4">
          <Kpi
            label="Fraud rate, online payments"
            value={fmtRate(latest.rate)}
            note={leaking ? (rising ? 'rising' : 'holding') : 'nothing getting through'}
            color={latest.rate > FRAUD_RATE_LIMIT ? FRAUD : leaking ? STATUS_HEX.warning : STATUS_HEX.healthy}
          />
          <Kpi label="Lost in the last 10 min, at this rate" value={fmtUsd(latest.per10MinUsd)} color={leaking ? FRAUD : undefined} />
          <Kpi label="On track to lose today" value={fmtUsd(latest.byBatchUsd)} color={leaking ? FRAUD : undefined} />
          <Kpi
            label="Fraudulent charges blocked"
            value={packetsToCharges(blocked).toLocaleString()}
            color={blocked ? STATUS_HEX.healthy : undefined}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
          <Card
            className="col-span-2"
            title="Payments through the hub"
            legend={[
              ['Approved', OUTCOME_HEX.settled],
              ['Fraud, approved', FRAUD],
              ['Blocked', OUTCOME_HEX.blocked],
            ]}
          >
            <OutcomeBars buckets={buckets} current={current} />
          </Card>
          <Card title="Fraud getting through" legend={[['Limit', FRAUD]]}>
            <RateChart rates={rates} />
          </Card>
          <IncidentTimeline />
        </div>
      </div>
    </div>
  );
}

function Outcome({
  leaking,
  frozen,
  byBatchUsd,
  byBatchCharges,
}: {
  leaking: boolean;
  frozen: boolean;
  byBatchUsd: number;
  byBatchCharges: number;
}) {
  const color = leaking ? FRAUD : frozen ? STATUS_HEX.warning : STATUS_HEX.healthy;
  return (
    <div
      className="flex h-36 shrink-0 items-center gap-6 overflow-hidden rounded-xl border bg-[var(--surface)] px-6 transition-colors"
      style={{ borderColor: leaking ? `${color}88` : 'var(--border)', boxShadow: leaking ? `0 0 0 3px ${color}1a` : undefined }}
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}26` }} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
          {leaking ? 'Fraud losses climbing' : frozen ? 'Merchant frozen' : 'Under control'}
        </div>
        <div className="mt-0.5 text-xl font-semibold">
          {leaking
            ? 'Fraudulent charges are being approved right now'
            : frozen
              ? 'TechDealz Online is frozen while its rules are fixed'
              : 'Every payment is scored before it is approved'}
        </div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          {leaking ? (
            <>
              Overnight batch checks would catch this tomorrow morning; by then the money is gone. Find the cause:{' '}
              <Kbd>&larr;</Kbd> <Kbd>&larr;</Kbd> sources
            </>
          ) : frozen ? (
            'Nothing new is leaving the merchant, so nothing more is being lost.'
          ) : (
            'About 3,000 card payments a second, scored as they stream.'
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[11px] text-[var(--text-secondary)]">If nothing changes, by tomorrow&apos;s batch check</div>
        <div className="font-mono-ui mt-1 text-3xl font-semibold leading-none" style={{ color: leaking ? FRAUD : undefined }}>
          {fmtUsd(leaking ? byBatchUsd : 0)}
        </div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          {leaking ? `lost to fraud · ≈${byBatchCharges.toLocaleString()} charges in ${HOURS_UNTIL_BATCH}h` : 'lost to fraud'}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="truncate text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono-ui text-3xl font-semibold leading-none" style={{ color }}>
          {value}
        </span>
        {note && <span className="text-xs text-[var(--text-secondary)]">{note}</span>}
      </div>
    </div>
  );
}

function Card({
  title,
  legend,
  className = '',
  children,
}: {
  title: string;
  legend: Array<[string, string]>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-h-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-3">
          {legend.map(([name, c]) => (
            <span key={name} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              {name}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** Approved, fraud approved and blocked per interval, stacked: the moment
 *  the attack starts the red climbs up through the bars, and the moment the
 *  rule is fixed it turns grey. The interval still in progress is drawn as
 *  what it is: a dashed outline of a typical interval, filling up. */
function OutcomeBars({ buckets, current }: { buckets: Bucket[]; current: Bucket }) {
  const total = (b: Bucket) => b.settled + b.fraud + b.blocked;
  const recent = buckets.slice(-3).map(total);
  const typical = recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const max = Math.max(14, typical * 1.15, ...buckets.map(total), total(current));
  const W = 100;
  const H = 60;
  const slot = W / (buckets.length + 1);
  const bw = slot * 0.66;
  const bar = (b: Bucket, i: number, live: boolean) => {
    const x = i * slot + (slot - bw) / 2;
    const sh = (b.settled / max) * H;
    const fh = (b.fraud / max) * H;
    const bh = (b.blocked / max) * H;
    return (
      <g key={i} opacity={live ? 0.6 : 1}>
        <rect x={x} y={H - sh} width={bw} height={sh} rx={0.6} fill={OUTCOME_HEX.settled} />
        <rect x={x} y={H - sh - fh} width={bw} height={fh} rx={0.6} fill={FRAUD} />
        <rect x={x} y={H - sh - fh - bh} width={bw} height={bh} rx={0.6} fill={OUTCOME_HEX.blocked} />
      </g>
    );
  };
  const outline = (typical / max) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-label="Payments per interval">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#e5e8ec" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {buckets.map((b, i) => bar(b, i, false))}
      {outline > 0 && (
        <rect
          x={buckets.length * slot + (slot - bw) / 2}
          y={H - outline}
          width={bw}
          height={outline}
          rx={0.6}
          fill="none"
          stroke="#c5cad3"
          strokeDasharray="3,3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {bar(current, buckets.length, true)}
    </svg>
  );
}

/** The fraud rate, once a second, against the limit the card schemes hold
 *  the network to. */
function RateChart({ rates }: { rates: number[] }) {
  const series = rates.slice(-80);
  const hi = 0.015;
  const W = 100;
  const H = 60;
  const y = (v: number) => H - (Math.min(Math.max(v, 0), hi) / hi) * H;
  const x = (i: number) => (i / Math.max(series.length - 1, 1)) * W;
  const last = series.at(-1) ?? 0;
  const over = last > FRAUD_RATE_LIMIT;
  return (
    <div className="flex h-full flex-col">
      <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: over ? FRAUD : undefined }}>
        {fmtRate(last)}
        <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">limit {fmtRate(FRAUD_RATE_LIMIT)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 min-h-0 w-full flex-1" aria-label="Fraud rate trend">
        <rect x={0} y={y(hi)} width={W} height={y(FRAUD_RATE_LIMIT) - y(hi)} fill={FRAUD} fillOpacity={0.06} />
        <line
          x1={0}
          x2={W}
          y1={y(FRAUD_RATE_LIMIT)}
          y2={y(FRAUD_RATE_LIMIT)}
          stroke={FRAUD}
          strokeDasharray="4,4"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* Each segment in its own colour: red where fraud was over the
            limit, neutral where it was not, so the history stays honest
            after the line comes back down. */}
        {series.slice(1).map((v, i) => (
          <line
            key={i}
            x1={x(i)}
            y1={y(series[i])}
            x2={x(i + 1)}
            y2={y(v)}
            stroke={Math.max(v, series[i]) > FRAUD_RATE_LIMIT ? FRAUD : '#7b8494'}
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
