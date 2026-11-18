import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import {
  doseShortfallPct,
  PROBLEM_MACHINE_ID,
  TABLETS_PER_TRAY,
  TRAY_INTERVAL_MS,
  WEIGHT_LOWER_LIMIT_MG,
  WEIGHT_TARGET_MG,
  WEIGHT_TOLERANCE_MG,
} from '@/streaming/lineConfig';
import { BATCH_TABLETS, QUARANTINE_MINUTES, QUARANTINE_TABLETS, RECALL_COST_USD } from './businessCase';
import { STATUS_HEX } from './colors';
import { fmtCount, fmtUsd } from './format';
import { Kbd } from './Kbd';
import { BUCKET_MS, BUCKETS, useProductionHistory, type Bucket } from './productionHistory';
import { ViewNav } from './ViewNav';
import type { View } from './views';

const GOOD = '#6f9fd8';
const BAD = STATUS_HEX.critical;
/** Intervals the "recent" reject rate is taken over. */
const RECENT = 3;
/** Trend samples (one every half second) the "up to X% less medicine"
 *  figure looks back over. */
const SHORTFALL_LOOKBACK = 20;

function recentRate(buckets: Bucket[], current: Bucket): { rejected: number; total: number } {
  const recent = [...buckets.slice(-RECENT), current];
  const rejected = recent.reduce((n, b) => n + b.rejected, 0);
  const total = recent.reduce((n, b) => n + b.good + b.rejected, 0);
  return { rejected, total };
}

/** Where the batch stands, in one word, for the banner and the KPIs. */
type BatchState = 'ok' | 'underdosing' | 'quarantined' | 'paused';

/**
 * The outcome screen, to the right of the plant: what the line is actually
 * producing. It shows the effect (underdosed tablets, a batch at risk) and
 * deliberately not the cause; finding the cause is the machines screen's
 * job, one screen to the left of the plant.
 */
export function DashboardScreen({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const packed = useStore((s) => s.traysPacked);
  const rejected = useStore((s) => s.traysRejected);
  const paused = useStore((s) => s.paused);
  const incident = useStore((s) => s.incident);
  const weight = useStore((s) => s.machines[PROBLEM_MACHINE_ID].history);
  const { buckets, current } = useProductionHistory();

  const total = packed + rejected;
  const outOfSpecPct = total ? (rejected / total) * 100 : 0;
  const recent = recentRate(buckets, current);
  const lightest = Math.min(0, ...weight.slice(-SHORTFALL_LOOKBACK).map((p) => p.v));
  const shortfall = doseShortfallPct(lightest);

  // Underdosed tablets made since the fault began: while the press runs the
  // whole batch is exposed; once it is stopped, what it made is quarantined.
  const madeBad = incident !== null && incident.rejected > 0;
  const open = incident !== null && incident.resolvedAt === null;
  let state: BatchState = 'ok';
  if (paused) state = madeBad && incident.stoppedAt !== null ? 'quarantined' : 'paused';
  else if (open && madeBad && recent.rejected > 0) state = 'underdosing';

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Dashboard · Tablet Line 2</div>
          <div className="text-xs text-[var(--text-secondary)]">What the line is producing, live</div>
        </div>
        <div className="ml-auto">
          <ViewNav view={view} onChange={onNavigate} />
        </div>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <Outcome state={state} recent={recent} shortfall={shortfall} />

        <div className="grid shrink-0 grid-cols-4 gap-4">
          <Kpi
            label="Out of spec, this batch"
            value={`${outOfSpecPct.toFixed(1)}%`}
            note={rejected ? `${fmtCount(rejected * TABLETS_PER_TRAY)} tablets under ${WEIGHT_LOWER_LIMIT_MG} mg` : `of ${fmtCount(total * TABLETS_PER_TRAY)} tablets weighed`}
            color={rejected ? BAD : STATUS_HEX.healthy}
          />
          <Kpi
            label="Batch at risk"
            value={state === 'underdosing' ? fmtCount(BATCH_TABLETS) : state === 'quarantined' ? fmtCount(QUARANTINE_TABLETS) : '0'}
            note={
              state === 'underdosing'
                ? 'tablets, the whole batch'
                : state === 'quarantined'
                  ? `tablets quarantined, last ${QUARANTINE_MINUTES} min`
                  : 'tablets'
            }
            color={state === 'underdosing' ? BAD : state === 'quarantined' ? STATUS_HEX.warning : undefined}
          />
          <Kpi
            label="Recall cost if it ships"
            value={state === 'underdosing' ? fmtUsd(RECALL_COST_USD) : '$0'}
            note={state === 'underdosing' ? 'plus a report to the regulator' : state === 'quarantined' ? 'caught before release' : 'nothing at risk'}
            color={state === 'underdosing' ? BAD : undefined}
          />
          <Kpi label="Tablets passed" value={fmtCount(packed * TABLETS_PER_TRAY)} note="on to the blister packer" />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
          <Card className="col-span-2" title="Tablets off the press" legend={[['Passed', GOOD], ['Underweight, rejected', BAD]]}>
            <OutputBars buckets={buckets} current={current} />
          </Card>
          <Card title="Tablet weight at inspection" legend={[['Spec band', '#9aa0a8']]}>
            <WeightChart values={weight.map((p) => WEIGHT_TARGET_MG + p.v)} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Outcome({ state, recent, shortfall }: { state: BatchState; recent: { rejected: number; total: number }; shortfall: number }) {
  const bad = state === 'underdosing';
  const color = bad ? BAD : state === 'ok' ? STATUS_HEX.healthy : STATUS_HEX.warning;
  const copy = {
    ok: {
      label: 'On target',
      head: 'Every tablet coming off the press is inside spec',
      body: <>A sample from every tray is weighed at inspection, against {WEIGHT_TARGET_MG} mg &plusmn;{WEIGHT_TOLERANCE_MG}.</>,
    },
    underdosing: {
      label: 'Tablets underdosed',
      head: `${recent.rejected} of the last ${recent.total} trays came out under ${WEIGHT_LOWER_LIMIT_MG} mg`,
      body: (
        <>
          Patients would get up to {Math.max(1, Math.round(shortfall))}% less medicine than prescribed. Find the cause:{' '}
          <Kbd>&larr;</Kbd> <Kbd>&larr;</Kbd> machines
        </>
      ),
    },
    quarantined: {
      label: 'Line stopped',
      head: `Press stopped, the last ${QUARANTINE_MINUTES} minutes of output quarantined`,
      body: `${fmtCount(QUARANTINE_TABLETS)} tablets held for QA testing. Nothing underdosed has left the plant.`,
    },
    paused: {
      label: 'Line stopped',
      head: 'Production is paused',
      body: 'Nothing is being pressed, so nothing is going out of spec.',
    },
  }[state];

  return (
    <div
      className="flex h-36 shrink-0 items-center gap-6 overflow-hidden rounded-xl border bg-[var(--surface)] px-6 transition-colors"
      style={{ borderColor: bad ? `${color}88` : 'var(--border)', boxShadow: bad ? `0 0 0 3px ${color}1a` : undefined }}
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}26` }} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
          {copy.label}
        </div>
        <div className="mt-0.5 text-xl font-semibold">{copy.head}</div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">{copy.body}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[11px] text-[var(--text-secondary)]">If this batch ships</div>
        <div className="font-mono-ui mt-1 text-3xl font-semibold leading-none" style={{ color: bad ? BAD : undefined }}>
          {bad ? fmtUsd(RECALL_COST_USD) : '$0'}
        </div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          {bad ? `recall of ${fmtCount(BATCH_TABLETS)} tablets and a regulator report` : state === 'quarantined' ? 'caught before release' : 'recall exposure'}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono-ui mt-1 text-3xl font-semibold leading-none" style={{ color }}>
        {value}
      </div>
      {note && <div className="mt-1.5 truncate text-[11px] text-[var(--text-secondary)]">{note}</div>}
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

/** Passed and rejected trays per interval, stacked: the moment the press
 *  drifts the red climbs up through the bars, which is the whole story in
 *  one picture. */
function OutputBars({ buckets, current }: { buckets: Bucket[]; current: Bucket }) {
  // A fixed scale: a full interval at line speed sits at about 80%, so the
  // bars never rescale under the audience's eyes.
  const perBucket = BUCKET_MS / TRAY_INTERVAL_MS;
  const max = perBucket * 1.25;
  const W = 100;
  const H = 60;
  const slot = W / (BUCKETS + 1);
  const bw = slot * 0.66;
  const bar = (b: Bucket, i: number) => {
    const x = i * slot + (slot - bw) / 2;
    const gh = (Math.min(b.good, max) / max) * H;
    const rh = (Math.min(b.rejected, max - Math.min(b.good, max)) / max) * H;
    return { x, gh, rh };
  };
  const live = bar(current, BUCKETS);
  const full = (perBucket / max) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-label="Trays per interval">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#e5e8ec" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      {buckets.map((b, i) => {
        const { x, gh, rh } = bar(b, i);
        return (
          <g key={i}>
            <rect x={x} y={H - gh} width={bw} height={gh} rx={0.6} fill={GOOD} />
            <rect x={x} y={H - gh - rh} width={bw} height={rh} rx={0.6} fill={BAD} />
          </g>
        );
      })}
      {/* The interval in progress: an outline of a full interval, filling
          up as trays arrive, so it never reads as a short bar. */}
      <rect
        x={live.x}
        y={H - full}
        width={bw}
        height={full}
        rx={0.6}
        fill="none"
        stroke="#c3cad3"
        strokeDasharray="3,3"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <g opacity={0.55}>
        <rect x={live.x} y={H - live.gh} width={bw} height={live.gh} rx={0.6} fill={GOOD} />
        <rect x={live.x} y={H - live.gh - live.rh} width={bw} height={live.rh} rx={0.6} fill={BAD} />
      </g>
    </svg>
  );
}

function WeightChart({ values }: { values: number[] }) {
  const series = values.slice(-80);
  const lo = WEIGHT_TARGET_MG - 24;
  const hi = WEIGHT_TARGET_MG + 8;
  const upper = WEIGHT_TARGET_MG + WEIGHT_TOLERANCE_MG;
  const W = 100;
  const H = 60;
  const y = (v: number) => H - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * H;
  const pts = series.map((v, i) => `${((i / Math.max(series.length - 1, 1)) * W).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = series.at(-1) ?? WEIGHT_TARGET_MG;
  const under = last < WEIGHT_LOWER_LIMIT_MG;
  return (
    <div className="flex h-full flex-col">
      <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: under ? BAD : undefined }}>
        {last.toFixed(1)}
        <span className="ml-1 text-base font-medium">mg</span>
        <span className="ml-2 font-sans text-xs font-normal text-[var(--text-secondary)]">
          target {WEIGHT_TARGET_MG}, lower limit {WEIGHT_LOWER_LIMIT_MG}
        </span>
      </div>
      <div className="relative mt-3 min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-label="Tablet weight trend">
          <rect x={0} y={y(upper)} width={W} height={y(WEIGHT_LOWER_LIMIT_MG) - y(upper)} fill="#9aa0a8" fillOpacity={0.12} />
          <line
            x1={0}
            x2={W}
            y1={y(WEIGHT_TARGET_MG)}
            y2={y(WEIGHT_TARGET_MG)}
            stroke="#9aa0a8"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            x2={W}
            y1={y(WEIGHT_LOWER_LIMIT_MG)}
            y2={y(WEIGHT_LOWER_LIMIT_MG)}
            stroke={BAD}
            strokeDasharray="4,4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {series.length > 1 && (
            <polyline
              points={pts}
              fill="none"
              stroke={under ? BAD : GOOD}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span
          className="font-mono-ui absolute right-0 -translate-y-full pb-0.5 text-[10px]"
          style={{ top: `${(y(WEIGHT_LOWER_LIMIT_MG) / H) * 100}%`, color: BAD }}
        >
          {WEIGHT_LOWER_LIMIT_MG} mg
        </span>
      </div>
    </div>
  );
}
