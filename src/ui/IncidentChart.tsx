import type { IncidentTiming, ReworkItem, TrendSample } from '@/state/store';
import { STATUS_HEX } from './colors';

// Uniform scaling, deliberately. This was `preserveAspectRatio="none"` over
// a 100x100 box stretched to ~1500x200, which squashed every circle into a
// flat ellipse and made a 0.4-unit stroke a different weight horizontally
// than vertically. A fixed wide aspect that scales evenly costs nothing —
// the chart is always in a wide column — and lets marker dots be dots.
const VIEW_W = 1000;
const VIEW_H = 300;
const PAD = { left: 46, right: 14, top: 14, bottom: 28 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

interface IncidentChartProps {
  groundTruth: TrendSample[];
  displayed: TrendSample[];
  warnMm: number;
  criticalMm: number;
  specMm: number;
  reworkMarks: ReworkItem[];
  incident: IncidentTiming;
  scrubIndex: number;
  onScrub: (index: number) => void;
}

export function IncidentChart({
  groundTruth,
  displayed,
  warnMm,
  criticalMm,
  specMm,
  reworkMarks,
  incident,
  scrubIndex,
  onScrub,
}: IncidentChartProps) {
  // Always include the spec limit in range, so the gap between the control
  // limits and the spec limit is visible even on a run that never got near
  // it — that gap IS the argument.
  const rawMax = Math.max(specMm * 1.15, ...groundTruth.map((d) => d.v), ...displayed.map((d) => d.v));
  // Round the scale up to a whole number of ticks so the axis reads
  // 0.00 / 0.25 / 0.50 ... rather than 0.00 / 0.34 / 0.69 / 1.03 / 1.38.
  const tickStep = [0.1, 0.2, 0.25, 0.5, 1].find((s) => rawMax / s <= 6) ?? 2;
  const maxV = Math.ceil(rawMax / tickStep) * tickStep;
  const ticks = Array.from({ length: Math.round(maxV / tickStep) + 1 }, (_, i) => i * tickStep);

  const xAt = (i: number, len: number) => PAD.left + (len > 1 ? (i / (len - 1)) * PLOT_W : 0);
  const yFor = (v: number) => PAD.top + PLOT_H - Math.min(v / maxV, 1) * PLOT_H;

  const points = (data: TrendSample[]) =>
    data.length < 2 ? '' : data.map((d, i) => `${xAt(i, data.length).toFixed(1)},${yFor(d.v).toFixed(1)}`).join(' ');

  const first = groundTruth[0]?.t ?? 0;
  const last = groundTruth[groundTruth.length - 1]?.t ?? 0;
  const xForTime = (t: number) =>
    last === first ? PAD.left : PAD.left + ((Math.min(Math.max(t, first), last) - first) / (last - first)) * PLOT_W;
  const inRange = (t: number | null): t is number => t !== null && t >= first && t <= last && last > first;

  const clampedIndex = Math.min(scrubIndex, Math.max(groundTruth.length - 1, 0));
  const scrubX = xAt(clampedIndex, groundTruth.length);
  const gtAtScrub = groundTruth[clampedIndex]?.v ?? 0;
  const shownAtScrub = displayed[clampedIndex]?.v ?? 0;

  // The band between what was true and what was on screen. When inspection
  // is live the two series coincide and this is a zero-width sliver that
  // renders as nothing — which is the correct picture, not a missing one.
  const gapBand =
    groundTruth.length > 1 && displayed.length > 1
      ? `${points(groundTruth)} ${displayed
          .map((d, i) => `${xAt(i, displayed.length).toFixed(1)},${yFor(d.v).toFixed(1)}`)
          .reverse()
          .join(' ')}`
      : '';

  const gridLines: Array<{ v: number; label: string; color: string; dash: string; weight: number }> = [
    { v: warnMm, label: `warn ${warnMm}mm`, color: STATUS_HEX.warning, dash: '5,4', weight: 1 },
    { v: criticalMm, label: `critical ${criticalMm}mm`, color: STATUS_HEX.critical, dash: '5,4', weight: 1 },
    { v: specMm, label: `SPEC LIMIT ${specMm}mm`, color: '#8a1f18', dash: '', weight: 1.6 },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full" role="img" aria-label="Weld deviation trend">
          {/* y grid */}
          {ticks.map((v) => {
            return (
              <g key={v}>
                <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={yFor(v)} y2={yFor(v)} stroke="var(--border)" strokeWidth={1} />
                <text x={PAD.left - 8} y={yFor(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-secondary)" className="font-mono-ui">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}
          <text
            x={12}
            y={PAD.top + PLOT_H / 2}
            fontSize={10}
            fill="var(--text-secondary)"
            textAnchor="middle"
            transform={`rotate(-90 12 ${PAD.top + PLOT_H / 2})`}
          >
            mean |deviation| mm
          </text>

          {/* rework markers: a bad weld actually shipped */}
          {reworkMarks.filter((m) => inRange(m.timestamp)).map((item) => (
            <line
              key={item.id}
              x1={xForTime(item.timestamp)}
              x2={xForTime(item.timestamp)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke={STATUS_HEX.critical}
              strokeWidth={1}
              strokeOpacity={0.28}
            />
          ))}

          {/* the divergence between truth and what was on screen */}
          {gapBand && <polygon points={gapBand} fill={STATUS_HEX.critical} fillOpacity={0.14} />}

          {/* thresholds. Two control limits low, the hard spec limit high —
              the distance between them is the early-warning budget. */}
          {gridLines.map((g) => (
            <g key={g.label}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={yFor(g.v)}
                y2={yFor(g.v)}
                stroke={g.color}
                strokeWidth={g.weight}
                strokeDasharray={g.dash || undefined}
              />
              <text x={VIEW_W - PAD.right} y={yFor(g.v) - 5} textAnchor="end" fontSize={10} fill={g.color} className="font-mono-ui">
                {g.label}
              </text>
            </g>
          ))}

          {/* what the operator actually saw */}
          <polyline
            points={points(displayed)}
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth={1.8}
            strokeDasharray="6,4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ground truth — always computed, whether or not it was shown */}
          <polyline
            points={points(groundTruth)}
            fill="none"
            stroke="var(--brand-orange)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* The two moments the whole argument is about: when a human was
              told, and when the first defect actually left the station. */}
          {inRange(incident.detectedAt) && (
            <EventMarker x={xForTime(incident.detectedAt)} color={STATUS_HEX.warning} label="alerted" />
          )}
          {inRange(incident.firstDefectAt) && (
            <EventMarker x={xForTime(incident.firstDefectAt)} color={STATUS_HEX.critical} label="1st defect" />
          )}

          {/* scrub playhead */}
          <line x1={scrubX} x2={scrubX} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--text-primary)" strokeWidth={1.2} />
          <circle cx={scrubX} cy={yFor(gtAtScrub)} r={4} fill="var(--brand-orange)" stroke="var(--surface)" strokeWidth={1.5} />
          <circle cx={scrubX} cy={yFor(shownAtScrub)} r={4} fill="var(--text-secondary)" stroke="var(--surface)" strokeWidth={1.5} />
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: 'var(--brand-orange)' }} />
            Ground truth (computed for every weld, always)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--text-secondary)' }} />
            Shown to the operator
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: `${STATUS_HEX.critical}24` }} />
            What nobody could see
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(groundTruth.length - 1, 0)}
          value={clampedIndex}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--brand-orange)]"
          aria-label="Scrub through the incident timeline"
        />
        <span className="font-mono-ui w-20 shrink-0 text-right text-xs text-[var(--text-secondary)]">
          {groundTruth[clampedIndex] ? new Date(groundTruth[clampedIndex].t).toLocaleTimeString([], { hour12: false }) : '--:--:--'}
        </span>
      </div>

      <div className="flex gap-3 text-xs">
        <ScrubReadout label="Ground truth" value={gtAtScrub} color="var(--brand-orange)" />
        <ScrubReadout label="On the dashboard" value={shownAtScrub} color="var(--text-secondary)" />
        <ScrubReadout
          label="Hidden from the operator"
          value={Math.max(0, gtAtScrub - shownAtScrub)}
          color={gtAtScrub - shownAtScrub > 0.01 ? STATUS_HEX.critical : 'var(--text-secondary)'}
        />
      </div>
    </div>
  );
}

function EventMarker({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <g>
      <line x1={x} x2={x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke={color} strokeWidth={1.4} strokeDasharray="3,3" />
      <rect x={x - 30} y={PAD.top + PLOT_H + 4} width={60} height={16} rx={3} fill={color} />
      <text x={x} y={PAD.top + PLOT_H + 15} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

function ScrubReadout({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono-ui text-sm font-semibold" style={{ color }}>
        {value.toFixed(2)}mm
      </div>
    </div>
  );
}
