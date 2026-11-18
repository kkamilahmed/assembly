import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import { recalibrate, toggleAutopilot, toggleLine } from '@/state/storyDirector';
import { Kbd } from './Kbd';

type Next = 'deviate' | 'stop' | 'recalibrate' | 'autopilot';

/** Which control the story wants next. Highlighted, so the presenter (and
 *  the room) can always see what the obvious move is. */
function useNext(): Next {
  const paused = useStore((s) => s.paused);
  const autopilot = useStore((s) => s.autopilot);
  const open = useStore((s) => s.incident !== null && s.incident.resolvedAt === null);
  if (paused) return open ? 'recalibrate' : 'autopilot';
  if (open && !autopilot) return 'stop';
  return 'deviate';
}

/**
 * The operator controls along the bottom of the plant view. Only what an
 * operator would do is on screen; the presenter injects the fault from the
 * keyboard (D / E), so the audience never sees a "break it" button. Every
 * button carries its key, so the demo can be driven without looking down.
 */
export function ActionBar() {
  const paused = useStore((s) => s.paused);
  const autopilot = useStore((s) => s.autopilot);
  const next = useNext();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-1.5 shadow-lg backdrop-blur">
        <Action k="S" onClick={toggleLine} primary={next === 'stop'} danger={!paused}>
          {paused ? 'Start line' : 'Stop line'}
        </Action>
        <Action k="C" onClick={() => recalibrate('operator')} primary={next === 'recalibrate'}>
          Recalibrate fill depth
        </Action>
        <Action k="A" onClick={toggleAutopilot} primary={next === 'autopilot'} active={autopilot}>
          {autopilot ? 'Autopilot on' : 'Run on autopilot'}
        </Action>
      </div>
    </div>
  );
}

function Action({
  k,
  onClick,
  children,
  primary = false,
  danger = false,
  active = false,
}: {
  k: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  const filled = primary || active;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        filled ? 'text-white shadow-sm' : 'hover:bg-black/5'
      } ${primary ? 'animate-card-pulse' : ''}`}
      style={{
        backgroundColor: filled ? 'var(--brand)' : undefined,
        color: filled ? '#fff' : danger ? 'var(--status-critical)' : undefined,
        ['--pulse-color' as string]: 'rgba(24, 104, 214, 0.3)',
      }}
    >
      <Kbd tone={filled ? 'inverse' : 'default'}>{k}</Kbd>
      {children}
    </button>
  );
}
