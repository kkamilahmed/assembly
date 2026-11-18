import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import { PROBLEM_MACHINE_ID, WARN_TREND, WELD_MIN_N, WELD_NOMINAL_N } from '@/streaming/lineConfig';
import { CELLS_PER_MODULE, projectRate, SHIFT_HOURS } from './businessCase';
import { STATUS_HEX } from './colors';
import { fmtUsd } from './format';
import { Kbd } from './Kbd';
import { BUCKET_MS, BUCKETS, useProductionHistory, type Bucket } from './productionHistory';
import { ViewNav } from './ViewNav';
import type { View } from './views';

const PASSED = '#3b86e3';
const FAILED = STATUS_HEX.critical;
/** Intervals the "recent" failure rate is taken over. */
const RECENT = 3;

function recentRate(buckets: Bucket[], current: Bucket): { rejected: number; total: number } {
  const recent = [...buckets.slice(-RECENT), current];
  const rejected = recent.reduce((n, b) => n + b.rejected, 0);
  const total = recent.reduce((n, b) => n + b.good + b.rejected, 0);
  return { rejected, total };
}

/**
 * The outcome screen, to the right of the plant: what the line is actually
 * producing. It shows the effect (weak welds, scrapped modules, money) and
 * deliberately not the cause; finding the cause is the machines screen's
 * job, one screen to the left of the plant.
 */
export function DashboardScreen({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const passed = useStore((s) => s.modulesPassed);
  const scrapped = useStore((s) => s.modulesScrapped);
  const paused = useStore((s) => s.paused);
  const strength = useStore((s) => s.machines[PROBLEM_MACHINE_ID].history);
  const { buckets, current } = useProductionHistory();

  const recent = recentRate(buckets, current);
  const rate = recent.total ? recent.rejected / recent.total : 0;
  const shift = projectRate(rate);
  const failing = rate > 0 && !paused;

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Dashboard · Module Line 1</div>
          <div className="text-xs text-[var(--text-secondary)]">What the line is producing, live</div>
        </div>
        <div className="ml-auto">
          <ViewNav view={view} onChange={onNavigate} />
        </div>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <Outcome rate={rate} recent={recent} paused={paused} shift={shift} />

        <div className="grid shrink-0 grid-cols-4 gap-4">
          <Kpi
            label="Weld failures, last 20s"
            value={`${Math.round(rate * 100)}%`}
            color={rate > 0.1 ? FAILED : rate > 0 ? STATUS_HEX.warning : STATUS_HEX.healthy}
          />
          <Kpi label="Modules scrapped" value={scrapped.toLocaleString()} color={scrapped ? FAILED : undefined} />
          <Kpi
            label="Scrap cost per shift, at this rate"
            value={fmtUsd(shift.usd)}
            color={failing ? FAILED : undefined}
          />
          <Kpi label="Modules passed" value={passed.toLocaleString()} />
        </div>

        <Risk failing={failing} />

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
          <Card className="col-span-2" title="Modules at end-of-line test" legend={[['Passed', PASSED], ['Failed, scrapped', FAILED]]}>
            <OutputBars buckets={buckets} current={current} />
          </Card>
          <Card title="Weld strength" legend={[['Minimum', FAILED], ['Alert', STATUS_HEX.warning]]}>
            <StrengthChart values={strength.map((p) => WELD_NOMINAL_N + p.v)} />
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
  shift,
}: {
  rate: number;
  recent: { rejected: number; total: number };
  paused: boolean;
  shift: ReturnType<typeof projectRate>;
}) {
  const failing = rate > 0 && !paused;
  const color = paused ? STATUS_HEX.warning : failing ? FAILED : STATUS_HEX.healthy;
  return (
    <div
      className="flex h-36 shrink-0 items-center gap-6 overflow-hidden rounded-xl border bg-[var(--surface)] px-6 transition-colors"
      style={{ borderColor: failing ? `${color}88` : 'var(--border)', boxShadow: failing ? `0 0 0 3px ${color}1a` : undefined }}
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}26` }} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
          {paused ? 'Line stopped' : failing ? 'Weak welds rising' : 'On spec'}
        </div>
        <div className="mt-0.5 text-xl font-semibold">
          {paused
            ? 'Production is paused while the cause is fixed'
            : failing
              ? `${recent.rejected} of the last ${recent.total} modules failed the weld check`
              : 'Every module coming off the line passes its weld check'}
        </div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          {failing ? (
            <>
              Find the cause: <Kbd>&larr;</Kbd> <Kbd>&larr;</Kbd> machines
            </>
          ) : paused ? (
            'Nothing is being welded, so nothing is being scrapped.'
          ) : (
            'Weld strength is checked on every module as it leaves the laser welder.'
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-[var(--text-secondary)]">If nothing changes, by end of shift</div>
        <div className="font-mono-ui mt-1 text-3xl font-semibold leading-none" style={{ color: failing ? FAILED : undefined }}>
          {failing ? fmtUsd(shift.usd) : '$0'}
        </div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          {failing
            ? `scrapped · ${shift.modules.toLocaleString()} modules · ${shift.cells.toLocaleString()} cells`
            : `scrapped over ${SHIFT_HOURS}h`}
        </div>
      </div>
    </div>
  );
}

/** Why a weak weld matters past the scrap bin. Always on screen, so the
 *  stakes are stated before anything goes wrong; it turns red while modules
 *  are failing. */
function Risk({ failing }: { failing: boolean }) {
  const color = failing ? FAILED : 'var(--text-secondary)';
  return (
    <div
      className="flex shrink-0 items-center gap-3 rounded-xl border px-5 py-3 text-sm transition-colors"
      style={{
        borderColor: failing ? `${FAILED}55` : 'var(--border)',
        backgroundColor: failing ? `${FAILED}0d` : 'var(--surface)',
      }}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden style={{ color }}>
        <path d="M10 2.5 18.5 17h-17L10 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 8v4.2M10 14.6v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>
        <span className="font-semibold" style={{ color: failing ? FAILED : undefined }}>
          Every failed module scraps {CELLS_PER_MODULE} cells.
        </span>{' '}
        <span className="text-[var(--text-secondary)]">
          Weak welds that slip past the tester can overheat in a customer's car, which means a recall and a fire risk.
        </span>
      </span>
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

/** Passed and failed modules per interval, stacked: the moment the laser
 *  drifts the red climbs up through the bars, which is the whole story in
 *  one picture. */
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-label="Modules per interval">
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
            <rect x={x} y={H - gh} width={bw} height={gh} rx={0.6} fill={PASSED} />
            <rect x={x} y={H - gh - rh} width={bw} height={rh} rx={0.6} fill={FAILED} />
          </g>
        );
      })}
    </svg>
  );
}

/** The welder's windowed mean weld strength, falling toward the minimum as
 *  the laser loses power. The alert line is where the stream flags it; the
 *  minimum is where modules start failing. */
function StrengthChart({ values }: { values: number[] }) {
  const series = values.slice(-80);
  const lo = 100;
  const hi = 270;
  const alert = WELD_NOMINAL_N - WARN_TREND;
  const W = 100;
  const H = 60;
  const y = (v: number) => H - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * H;
  const pts = series.map((v, i) => `${((i / Math.max(series.length - 1, 1)) * W).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = series.at(-1) ?? WELD_NOMINAL_N;
  const tone = last < WELD_MIN_N ? FAILED : last < alert ? STATUS_HEX.warning : undefined;
  return (
    <div className="flex h-full flex-col">
      <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: tone }}>
        {last.toFixed(0)} N
        <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
          nominal {WELD_NOMINAL_N} · min {WELD_MIN_N}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 min-h-0 w-full flex-1" aria-label="Weld strength trend">
        <rect x={0} y={y(WELD_MIN_N)} width={W} height={H - y(WELD_MIN_N)} fill={FAILED} fillOpacity={0.07} />
        {[
          [alert, STATUS_HEX.warning],
          [WELD_MIN_N, FAILED],
        ].map(([v, c]) => (
          <line
            key={c}
            x1={0}
            x2={W}
            y1={y(v as number)}
            y2={y(v as number)}
            stroke={c as string}
            strokeDasharray="4,4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.length > 1 && (
          <polyline
            points={pts}
            fill="none"
            stroke={tone ?? PASSED}
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
