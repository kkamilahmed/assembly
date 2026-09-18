import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import { resetLine } from '@/state/engine';
import { initStoryDirector, stopStoryDirector } from '@/state/storyDirector';
import { ROBOT_IDS, SAMPLE_EVERY_N, STATION_CYCLE_MS } from '@/streaming/lineConfig';
import { STATUS_HEX } from './colors';
import { fmtDuration } from './incidentDiagnosis';

const SEVERITY_ORDER = { healthy: 0, warning: 1, critical: 2 } as const;

function overallStatus(robots: Record<string, { status: keyof typeof SEVERITY_ORDER }>) {
  let worst: keyof typeof SEVERITY_ORDER = 'healthy';
  for (const id of ROBOT_IDS) {
    if (SEVERITY_ORDER[robots[id].status] > SEVERITY_ORDER[worst]) worst = robots[id].status;
  }
  return worst;
}

/** How long the blind window between two manual checks actually lasts, at
 *  the line's own cadence. Derived rather than written down, so it can't go
 *  stale against the sampling rate or the conveyor cycle. */
const BLIND_WINDOW_MS = SAMPLE_EVERY_N * STATION_CYCLE_MS;

export function TopBar() {
  const robots = useStore((s) => s.robots);
  const liveVisionQC = useStore((s) => s.liveVisionQC);
  const toggleLiveVisionQC = useStore((s) => s.toggleLiveVisionQC);
  const weldsUntilNextInspection = useStore((s) => s.weldsUntilNextInspection);
  const paused = useStore((s) => s.paused);
  const togglePause = useStore((s) => s.togglePause);
  const carsBuilt = useStore((s) => s.carsBuilt);
  const suspectWeldsCaught = useStore((s) => s.suspectWeldsCaught);
  const recoveryReveal = useStore((s) => s.recoveryReveal);
  const setRecoveryReveal = useStore((s) => s.setRecoveryReveal);
  const setShortcutOverlayOpen = useStore((s) => s.setShortcutOverlayOpen);
  const setReplayOpen = useStore((s) => s.setReplayOpen);

  // Grey while inspecting by sample: the line's health genuinely is not
  // known, and a green dot there is the same false confidence the demo is
  // about. See RobotPanel for the same reasoning on the status pill.
  const status = overallStatus(robots);
  const color = liveVisionQC ? STATUS_HEX[status] : '#9aa0a8';

  // Yield over everything this line has actually finished. The header used
  // to read "15 cars built · 11 flagged" next to a green dot, which is a
  // 42% scrap rate reported as healthy. A rate makes the number mean
  // something instead of just accumulating.
  const totalStarted = carsBuilt + suspectWeldsCaught;
  const yieldPct = totalStarted > 0 ? (carsBuilt / totalStarted) * 100 : 100;

  const handleReset = () => {
    stopStoryDirector();
    resetLine();
    initStoryDirector();
  };

  return (
    <div className="relative border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <div>
            <div className="text-sm font-semibold">Assembly Line Monitor &middot; Body Shop 2</div>
            <div className="font-mono-ui flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>{carsBuilt} built</span>
              <span aria-hidden>&middot;</span>
              <span style={{ color: suspectWeldsCaught > 0 ? STATUS_HEX.warning : undefined }}>
                {suspectWeldsCaught} to rework
              </span>
              <span aria-hidden>&middot;</span>
              <span style={{ color: yieldPct < 95 ? STATUS_HEX.critical : STATUS_HEX.healthy }}>
                {yieldPct.toFixed(1)}% yield
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={togglePause}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-black/5"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-black/5"
          >
            Reset
          </button>
          <button
            onClick={() => setShortcutOverlayOpen(true)}
            aria-label="Keyboard shortcuts"
            className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-black/5"
          >
            ?
          </button>

          {/* Named for what it actually is. "Live Vision QC" with an on/off
              switch reads as a feature being disabled; the real comparison
              is between two inspection regimes that both exist on real
              lines, which is the entire argument. */}
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] p-1">
            <span className="pl-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Inspection
            </span>
            <div className="flex overflow-hidden rounded bg-black/5">
              <ModeButton
                active={liveVisionQC}
                activeColor={STATUS_HEX.healthy}
                onClick={() => !liveVisionQC && toggleLiveVisionQC()}
              >
                Every weld
              </ModeButton>
              <ModeButton
                active={!liveVisionQC}
                activeColor={STATUS_HEX.warning}
                onClick={() => liveVisionQC && toggleLiveVisionQC()}
              >
                1 in {SAMPLE_EVERY_N}
              </ModeButton>
            </div>
          </div>
        </div>
      </div>

      {/* The blind window, as something you watch tick rather than a claim
          you have to take on faith. */}
      {!liveVisionQC && (
        <div
          className="animate-fade-in absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-sm"
          style={{ borderColor: STATUS_HEX.warning, backgroundColor: 'var(--surface)' }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: STATUS_HEX.warning }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_HEX.warning }} />
          </span>
          <span className="font-medium">Spot-check mode</span>
          <span className="text-[var(--text-secondary)]">
            next manual check in{' '}
            <span className="font-mono-ui font-semibold text-[var(--text-primary)]">
              {weldsUntilNextInspection ?? SAMPLE_EVERY_N} welds
            </span>{' '}
            &middot; {fmtDuration(BLIND_WINDOW_MS)} blind between checks
          </span>
        </div>
      )}

      {/* No auto-expiry: this is the punchline, and it used to fade out
          after 7 seconds — often mid-sentence. It stays until dismissed. */}
      {recoveryReveal && (
        <div
          className="animate-fade-in absolute left-1/2 top-full z-30 mt-2 w-[30rem] -translate-x-1/2 rounded-lg border-2 bg-[var(--surface)] p-4 shadow-xl"
          style={{ borderColor: STATUS_HEX.critical }}
        >
          <div className="flex items-start gap-3">
            <div className="font-mono-ui text-4xl font-semibold leading-none" style={{ color: STATUS_HEX.critical }}>
              {recoveryReveal.gap}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                suspect weld{recoveryReveal.gap === 1 ? '' : 's'} shipped with no inspection at all
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Measured the whole time. Surfaced to nobody, for {fmtDuration(recoveryReveal.durationMs)}. Those cars
                have already left the building.
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setRecoveryReveal(null);
                setReplayOpen(true);
              }}
              className="rounded-md bg-[var(--brand-orange)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Investigate
            </button>
            <button
              onClick={() => setRecoveryReveal(null)}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-black/5"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  activeColor,
  onClick,
  children,
}: {
  active: boolean;
  activeColor: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="px-2.5 py-1 text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? activeColor : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}
