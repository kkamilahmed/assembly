import { useEffect, useState, type ReactNode } from 'react';
import { recalibrateRobot } from '@/state/storyDirector';
import { useStore } from '@/state/store';
import { CRITICAL_TREND_MM, WARN_TREND_MM, WELD_TOLERANCE_MM } from '@/streaming/lineConfig';
import { STATUS_HEX } from './colors';
import { computeDiagnosis, fmtDuration, fmtOffset, type IncidentOutcome } from './incidentDiagnosis';
import { IncidentChart } from './IncidentChart';
import { ReworkList } from './ReworkList';

const ROBOT_ID = 'WELD-01' as const;

const VERDICT: Record<IncidentOutcome, { title: string; body: string; tone: 'good' | 'bad' | 'neutral' }> = {
  none: {
    title: 'No incident yet this run',
    body: 'Nothing has gone wrong on the line so far. Press D to inject a tool-center-point drift.',
    tone: 'neutral',
  },
  'in-progress': {
    title: 'Fault in progress, nothing surfaced yet',
    body: 'The mechanical drift has started and the window is still filling. No alert has reached an operator.',
    tone: 'neutral',
  },
  prevented: {
    title: 'Caught before a single defect',
    body: 'The windowed trend crossed its control limit while every individual weld was still inside spec, and the fix landed before any car left out of tolerance.',
    tone: 'good',
  },
  'warned-then-shipped': {
    title: 'Warned in time, acted on too late',
    body: 'The alert arrived before the first out-of-spec weld. The defects that followed were a response-time failure, not a detection failure.',
    tone: 'bad',
  },
  'detected-late': {
    title: 'Defects were already shipping before anyone was told',
    body: 'By the time the problem surfaced, out-of-spec welds had already left the station.',
    tone: 'bad',
  },
  'never-surfaced': {
    title: 'No alert ever reached anyone',
    body: 'Every one of these welds was measured. Under periodic sampling the measurements never became a trend, so nothing crossed a threshold, so nobody was told — and the defects shipped anyway.',
    tone: 'bad',
  },
};

/** Screen 3: replays the retained trend history for the incident that just
 *  happened, side by side with a templated root-cause narration built
 *  entirely from data that was already being computed — nothing here is
 *  invented after the fact, it's just given room to be read. Rendered as a
 *  full-bleed overlay on top of the 3D line (App.tsx), not a separate
 *  fleet<->line style route — see the store's `replayOpen` for why. */
export function IncidentReplay() {
  const open = useStore((s) => s.replayOpen);
  const setOpen = useStore((s) => s.setReplayOpen);
  const robot = useStore((s) => s.robots[ROBOT_ID]);
  const reworkQueue = useStore((s) => s.reworkQueue);
  const incident = useStore((s) => s.incident);
  const suspectWeldsGroundTruth = useStore((s) => s.suspectWeldsGroundTruth);
  const suspectWeldsCaught = useStore((s) => s.suspectWeldsCaught);
  const autoRecalibrate = useStore((s) => s.autoRecalibrate);
  const toggleAutoRecalibrate = useStore((s) => s.toggleAutoRecalibrate);

  const [scrubIndex, setScrubIndex] = useState(0);

  // Jump to "now" (the most recent sample) every time the panel opens, so
  // the story starts at the visible consequence and rewinds from there.
  useEffect(() => {
    if (open) setScrubIndex(Math.max(robot.groundTruthHistory.length - 1, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const reworkForRobot = reworkQueue.filter((item) => item.robotId === ROBOT_ID);
  const diagnosis = computeDiagnosis(
    robot.groundTruthHistory,
    WARN_TREND_MM,
    CRITICAL_TREND_MM,
    incident,
    Math.max(0, suspectWeldsGroundTruth - suspectWeldsCaught),
  );
  const verdict = VERDICT[diagnosis.outcome];
  const verdictColor =
    verdict.tone === 'good' ? STATUS_HEX.healthy : verdict.tone === 'bad' ? STATUS_HEX.critical : 'var(--text-secondary)';
  const origin = incident.faultStartedAt;

  const leadMs = diagnosis.leadTimeMs;
  const caughtAhead = leadMs !== null && leadMs > 0;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <span className="text-sm font-semibold">Incident Replay</span>
        <span className="font-mono-ui text-xs text-[var(--text-secondary)]">
          {ROBOT_ID} &middot; {robot.label}
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close incident replay"
          className="ml-auto rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-black/5"
        >
          Close
          <kbd className="font-mono-ui ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px]">Esc</kbd>
        </button>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 gap-4 overflow-y-auto p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* The three numbers the whole demo exists to produce. */}
          <div className="grid grid-cols-3 gap-3">
            <BigStat
              label="Fault started to alert"
              value={
                diagnosis.detectLatencyMs !== null
                  ? fmtDuration(diagnosis.detectLatencyMs)
                  : diagnosis.outcome === 'never-surfaced'
                    ? 'never'
                    : '—'
              }
              hint={
                diagnosis.outcome === 'never-surfaced'
                  ? 'no alert was raised at any point'
                  : 'how long the line ran hurt before anyone knew'
              }
              color={diagnosis.outcome === 'never-surfaced' ? STATUS_HEX.critical : undefined}
            />
            <BigStat
              label={
                diagnosis.outcome === 'never-surfaced'
                  ? 'Warning ahead of first defect'
                  : caughtAhead
                    ? 'Warning ahead of first defect'
                    : 'Defect ahead of warning'
              }
              value={
                diagnosis.outcome === 'never-surfaced'
                  ? 'none'
                  : leadMs === null
                    ? diagnosis.outcome === 'prevented'
                      ? 'never'
                      : '—'
                    : fmtDuration(leadMs)
              }
              hint={
                diagnosis.outcome === 'never-surfaced'
                  ? 'there was no warning to be ahead of'
                  : diagnosis.outcome === 'prevented'
                    ? 'no weld ever left out of spec'
                    : caughtAhead
                      ? 'time available to act before scrap'
                      : 'scrap was already being produced'
              }
              color={diagnosis.outcome === 'prevented' || caughtAhead ? STATUS_HEX.healthy : STATUS_HEX.critical}
            />
            <BigStat
              label="Shipped undetected"
              value={String(diagnosis.gap)}
              hint="suspect welds that passed with no inspection at all"
              color={diagnosis.gap > 0 ? STATUS_HEX.critical : undefined}
            />
          </div>

          <IncidentChart
            groundTruth={robot.groundTruthHistory}
            displayed={robot.history}
            warnMm={WARN_TREND_MM}
            criticalMm={CRITICAL_TREND_MM}
            specMm={WELD_TOLERANCE_MM}
            reworkMarks={reworkForRobot}
            incident={incident}
            scrubIndex={scrubIndex}
            onScrub={setScrubIndex}
          />

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Timeline</div>
            <ol className="flex flex-col gap-1.5 text-xs">
              {origin !== null && (
                <TimelineRow at="T+0s" color="var(--text-secondary)">
                  Tool-center-point starts drifting. No alert is possible yet — one weld proves nothing.
                </TimelineRow>
              )}
              {diagnosis.warnCrossedAt !== null && (
                <TimelineRow at={fmtOffset(diagnosis.warnCrossedAt, origin)} color={STATUS_HEX.warning}>
                  Windowed mean deviation crosses the {WARN_TREND_MM}mm control limit. Every individual weld is still
                  well inside the {WELD_TOLERANCE_MM}mm spec — a per-weld threshold rule sees nothing here.
                </TimelineRow>
              )}
              {diagnosis.criticalCrossedAt !== null && (
                <TimelineRow at={fmtOffset(diagnosis.criticalCrossedAt, origin)} color={STATUS_HEX.critical}>
                  Crosses the {CRITICAL_TREND_MM}mm critical limit. Recalibration recommended.
                </TimelineRow>
              )}
              {incident.firstDefectAt !== null ? (
                <TimelineRow at={fmtOffset(incident.firstDefectAt, origin)} color={STATUS_HEX.critical}>
                  First weld genuinely out of spec.{' '}
                  {caughtAhead
                    ? `${fmtDuration(leadMs!)} after the alert — that gap was the window to act in.`
                    : diagnosis.outcome === 'never-surfaced'
                      ? 'No alert was ever raised, before or after.'
                      : 'The alert had not arrived yet.'}
                </TimelineRow>
              ) : (
                origin !== null && (
                  <TimelineRow at="—" color={STATUS_HEX.healthy}>
                    No weld ever left out of spec.
                  </TimelineRow>
                )
              )}
              {diagnosis.resolvedAt !== null && (
                <TimelineRow at={fmtOffset(diagnosis.resolvedAt, origin)} color={STATUS_HEX.healthy}>
                  Alignment restored, trend recovering.
                </TimelineRow>
              )}
              {diagnosis.peakTrendMm > 0 && (
                <li className="pl-14 text-[var(--text-secondary)]">Peak windowed deviation {diagnosis.peakTrendMm.toFixed(2)}mm.</li>
              )}
            </ol>
          </div>
        </div>

        <div className="flex w-80 flex-shrink-0 flex-col gap-3">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: verdictColor, backgroundColor: verdict.tone === 'neutral' ? 'var(--surface)' : `${verdictColor}0d` }}
          >
            <div className="text-sm font-semibold" style={{ color: verdictColor }}>
              {verdict.title}
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{verdict.body}</div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Recommended action</div>
            {robot.recalibrationRecommended ? (
              <button
                onClick={() => recalibrateRobot(ROBOT_ID)}
                className="w-full rounded-md bg-[var(--brand-orange)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Recalibrate {ROBOT_ID}
              </button>
            ) : diagnosis.resolvedAt !== null ? (
              <div className="text-xs" style={{ color: STATUS_HEX.healthy }}>
                Resolved &mdash; alignment restored at {fmtOffset(diagnosis.resolvedAt, origin)}.
              </div>
            ) : (
              <div className="text-xs text-[var(--text-secondary)]">
                Nothing outstanding &mdash; no drift is currently above the control limit.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Prevent recurrence</div>
              <button
                onClick={toggleAutoRecalibrate}
                aria-pressed={autoRecalibrate}
                aria-label="Toggle auto-recalibrate policy"
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                style={{ backgroundColor: autoRecalibrate ? 'var(--status-healthy)' : '#c7ccd2' }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: autoRecalibrate ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              Auto-recalibrate the instant drift crosses critical, without waiting for someone to see a chart first.
              {autoRecalibrate && (
                <span className="mt-1 block font-medium" style={{ color: STATUS_HEX.healthy }}>
                  Active. Reset and re-run the fault &mdash; nobody has to be watching.
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Rework queue</div>
            <ReworkList />
          </div>
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono-ui mt-0.5 text-2xl font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">{hint}</div>
    </div>
  );
}

function TimelineRow({ at, color, children }: { at: string; color: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono-ui w-11 shrink-0 text-right font-semibold" style={{ color }}>
        {at}
      </span>
      <span className="text-[var(--text-secondary)]">{children}</span>
    </li>
  );
}
