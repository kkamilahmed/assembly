import { useStore } from '@/state/store';
import { resetLine } from '@/state/engine';
import { initStoryDirector, stopStoryDirector } from '@/state/storyDirector';
import { ROBOT_IDS } from '@/streaming/lineConfig';
import { STATUS_HEX } from './colors';

const SEVERITY_ORDER = { healthy: 0, warning: 1, critical: 2 } as const;

function overallStatus(robots: Record<string, { status: keyof typeof SEVERITY_ORDER }>) {
  let worst: keyof typeof SEVERITY_ORDER = 'healthy';
  for (const id of ROBOT_IDS) {
    if (SEVERITY_ORDER[robots[id].status] > SEVERITY_ORDER[worst]) worst = robots[id].status;
  }
  return worst;
}

export function TopBar() {
  const robots = useStore((s) => s.robots);
  const liveVisionQC = useStore((s) => s.liveVisionQC);
  const toggleLiveVisionQC = useStore((s) => s.toggleLiveVisionQC);
  const paused = useStore((s) => s.paused);
  const togglePause = useStore((s) => s.togglePause);
  const carsBuilt = useStore((s) => s.carsBuilt);
  const suspectWeldsCaught = useStore((s) => s.suspectWeldsCaught);
  const recoveryReveal = useStore((s) => s.recoveryReveal);
  const setShortcutOverlayOpen = useStore((s) => s.setShortcutOverlayOpen);

  const status = overallStatus(robots);
  const color = STATUS_HEX[status];

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
            <div className="text-sm font-semibold">Body Shop 2 — Assembly Line Monitor</div>
            <div className="font-mono-ui text-xs text-[var(--text-secondary)]">
              {carsBuilt} cars built · {suspectWeldsCaught} flagged for rework
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
          <div className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium">
            <span>Live Vision QC</span>
            <button
              onClick={toggleLiveVisionQC}
              aria-pressed={liveVisionQC}
              aria-label="Toggle live vision QC"
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{ backgroundColor: liveVisionQC ? 'var(--status-healthy)' : '#c7ccd2' }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: liveVisionQC ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </div>
      </div>

      {recoveryReveal && (
        <div className="animate-fade-in-out absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-medium shadow-lg"
          style={{ borderColor: STATUS_HEX.critical, backgroundColor: 'var(--surface)' }}
        >
          <span style={{ color: STATUS_HEX.critical }}>{recoveryReveal.gap}</span> suspect weld
          {recoveryReveal.gap === 1 ? '' : 's'} shipped undetected while live QC was off.
        </div>
      )}
    </div>
  );
}
