import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import { BROWNING_TARGET, BROWNING_TOLERANCE, PROBLEM_MACHINE_ID } from '@/streaming/lineConfig';
import { COST_PER_REJECT_USD, DOUGH_KG_PER_LOAF, LINE_JOBS_PER_HOUR, SHIFT_HOURS } from './businessCase';
import { STATUS_HEX } from './colors';
import { fmtUsd } from './format';
import { Kbd } from './Kbd';
import { BUCKET_MS, BUCKETS, useProductionHistory, type Bucket } from './productionHistory';
import { ViewNav } from './ViewNav';
import type { View } from './views';

const GOOD = '#d98c38';
const BURNT = STATUS_HEX.critical;
/** Intervals the "recent" reject rate is taken over. */
const RECENT = 3;

function recentRate(buckets: Bucket[], current: Bucket): { rejected: number; total: number } {
  const recent = [...buckets.slice(-RECENT), current];
  const rejected = recent.reduce((n, b) => n + b.rejected, 0);
  const total = recent.reduce((n, b) => n + b.good + b.rejected, 0);
  return { rejected, total };
}

/**
 * The outcome screen, to the right of the plant: what the line is actually
 * producing. It shows the effect (burnt loaves, waste) and deliberately not
 * the cause; finding the cause is the machines screen's job, one screen to
 * the left of the plant.
 */
export function DashboardScreen({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const packed = useStore((s) => s.loavesPacked);
  const rejected = useStore((s) => s.loavesRejected);
  const paused = useStore((s) => s.paused);
  const browning = useStore((s) => s.machines[PROBLEM_MACHINE_ID].history);
  const { buckets, current } = useProductionHistory();

  const total = packed + rejected;
  const yieldPct = total ? (packed / total) * 100 : 100;
  const recent = recentRate(buckets, current);
  const rate = recent.total ? recent.rejected / recent.total : 0;

  const atRiskLoaves = Math.round(rate * LINE_JOBS_PER_HOUR * SHIFT_HOURS);
  const atRiskKg = Math.round(atRiskLoaves * DOUGH_KG_PER_LOAF);
  const atRiskUsd = Math.round(atRiskLoaves * COST_PER_REJECT_USD);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Dashboard · Line 1</div>
          <div className="text-xs text-[var(--text-secondary)]">What the line is producing, live</div>
        </div>
        <div className="ml-auto">
          <ViewNav view={view} onChange={onNavigate} />
        </div>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <Outcome rate={rate} recent={recent} paused={paused} atRiskLoaves={atRiskLoaves} atRiskKg={atRiskKg} atRiskUsd={atRiskUsd} />

        <div className="grid shrink-0 grid-cols-4 gap-4">
          <Kpi label="Loaves packed" value={packed.toLocaleString()} />
          <Kpi label="Burnt and rejected" value={rejected.toLocaleString()} color={rejected ? BURNT : undefined} />
          <Kpi label="Yield" value={`${yieldPct.toFixed(1)}%`} color={yieldPct < 95 ? BURNT : STATUS_HEX.healthy} />
          <Kpi
            label="Reject rate, last 20s"
            value={`${Math.round(rate * 100)}%`}
            color={rate > 0.2 ? BURNT : rate > 0 ? STATUS_HEX.warning : STATUS_HEX.healthy}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
          <Card className="col-span-2" title="Loaves off the line" legend={[['Good', GOOD], ['Burnt, rejected', BURNT]]}>
            <OutputBars buckets={buckets} current={current} />
          </Card>
          <Card title="Crust browning at inspection" legend={[['Target band', '#9aa0a8']]}>
            <BrowningChart values={browning.map((p) => BROWNING_TARGET + p.v)} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Outcome({
  rate,
  recent,
  paused,
  atRiskLoaves,
  atRiskKg,
  atRiskUsd,
}: {
  rate: number;
  recent: { rejected: number; total: number };
  paused: boolean;
  atRiskLoaves: number;
  atRiskKg: number;
  atRiskUsd: number;
}) {
  const burning = rate > 0 && !paused;
  const color = paused ? STATUS_HEX.warning : burning ? BURNT : STATUS_HEX.healthy;
  return (
    <div
      className="flex h-36 shrink-0 items-center gap-6 overflow-hidden rounded-xl border bg-[var(--surface)] px-6 transition-colors"
      style={{ borderColor: burning ? `${color}88` : 'var(--border)', boxShadow: burning ? `0 0 0 3px ${color}1a` : undefined }}
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}26` }} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
          {paused ? 'Line stopped' : burning ? 'Burnt loaves rising' : 'On target'}
        </div>
        <div className="mt-0.5 text-xl font-semibold">
          {paused
            ? 'Production is paused while the cause is fixed'
            : burning
              ? `${recent.rejected} of the last ${recent.total} loaves came out burnt`
              : 'Every loaf coming off the line is inside spec'}
        </div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          {burning ? (
            <>
              Find the cause: <Kbd>&larr;</Kbd> <Kbd>&larr;</Kbd> machines
            </>
          ) : paused ? (
            'Nothing is being baked, so nothing is being wasted.'
          ) : (
            'Browning is scored on every loaf as it leaves the oven.'
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-[var(--text-secondary)]">If nothing changes, by end of shift</div>
        <div className="font-mono-ui mt-1 text-3xl font-semibold leading-none" style={{ color: burning ? BURNT : undefined }}>
          {burning ? `${atRiskKg.toLocaleString()} kg` : '0 kg'}
        </div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          {burning ? `of dough wasted · ${atRiskLoaves.toLocaleString()} loaves · ${fmtUsd(atRiskUsd)}` : 'of dough wasted'}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono-ui mt-1 text-3xl font-semibold leading-none" style={{ color }}>
        {value}
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

/** Good and burnt loaves per interval, stacked: the moment the oven drifts
 *  the red climbs up through the bars, which is the whole story in one
 *  picture. */
function OutputBars({ buckets, current }: { buckets: Bucket[]; current: Bucket }) {
  const all = [...buckets, current];
  while (all.length < BUCKETS + 1) all.unshift({ good: 0, rejected: 0 });
  const perBucket = BUCKET_MS / 800;
  const max = Math.max(perBucket, ...all.map((b) => b.good + b.rejected));
  const W = 100;
  const H = 60;
  const slot = W / all.length;
  const bw = slot * 0.66;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-label="Loaves per interval">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#e5e8ec" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {all.map((b, i) => {
        const x = i * slot + (slot - bw) / 2;
        const gh = (b.good / max) * H;
        const rh = (b.rejected / max) * H;
        const live = i === all.length - 1;
        return (
          <g key={i} opacity={live ? 0.55 : 1}>
            <rect x={x} y={H - gh} width={bw} height={gh} rx={0.6} fill={GOOD} />
            <rect x={x} y={H - gh - rh} width={bw} height={rh} rx={0.6} fill={BURNT} />
          </g>
        );
      })}
    </svg>
  );
}

function BrowningChart({ values }: { values: number[] }) {
  const series = values.slice(-80);
  const lo = BROWNING_TARGET - 12;
  const hi = BROWNING_TARGET + 22;
  const W = 100;
  const H = 60;
  const y = (v: number) => H - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * H;
  const pts = series.map((v, i) => `${((i / Math.max(series.length - 1, 1)) * W).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = series.at(-1) ?? BROWNING_TARGET;
  const over = last > BROWNING_TARGET + BROWNING_TOLERANCE;
  return (
    <div className="flex h-full flex-col">
      <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: over ? BURNT : undefined }}>
        {last.toFixed(1)}
        <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
          target {BROWNING_TARGET} &plusmn;{BROWNING_TOLERANCE}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 min-h-0 w-full flex-1" aria-label="Crust browning trend">
        <rect
          x={0}
          y={y(BROWNING_TARGET + BROWNING_TOLERANCE)}
          width={W}
          height={y(BROWNING_TARGET - BROWNING_TOLERANCE) - y(BROWNING_TARGET + BROWNING_TOLERANCE)}
          fill="#9aa0a8"
          fillOpacity={0.12}
        />
        <line
          x1={0}
          x2={W}
          y1={y(BROWNING_TARGET + BROWNING_TOLERANCE)}
          y2={y(BROWNING_TARGET + BROWNING_TOLERANCE)}
          stroke={BURNT}
          strokeDasharray="4,4"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {series.length > 1 && (
          <polyline
            points={pts}
            fill="none"
            stroke={over ? BURNT : GOOD}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
