import type { ReactNode } from 'react';
import { useStore } from '@/state/store';
import { injectDeviation, recalibrate, toggleAutopilot, toggleLine } from '@/state/storyDirector';
import { PROBLEM_ROBOT_ID } from '@/streaming/lineConfig';
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
 * The bottom strip over the plant view. Left half simulates a fault (what
 * the presenter does to the line), right half is what an operator does about
 * it. Every button has the same key as its label, so the demo can be driven
 * from the keyboard without ever looking down.
 */
export function ActionBar() {
  const paused = useStore((s) => s.paused);
  const autopilot = useStore((s) => s.autopilot);
  const next = useNext();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-1.5 shadow-lg backdrop-blur">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Simulate
        </span>
        <Action k="D" onClick={() => injectDeviation('slight')}>
          Slight deviation
        </Action>
        <Action k="E" onClick={() => injectDeviation('emergency')} danger>
          Emergency
        </Action>

        <span className="mx-1.5 h-6 w-px bg-[var(--border)]" />

        <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Operate
        </span>
        <Action k="S" onClick={toggleLine} primary={next === 'stop'} danger={!paused}>
          {paused ? 'Start line' : 'Stop line'}
        </Action>
        <Action k="C" onClick={() => recalibrate('operator')} primary={next === 'recalibrate'}>
          Recalibrate {PROBLEM_ROBOT_ID}
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
        backgroundColor: filled ? 'var(--brand-orange)' : undefined,
        color: filled ? '#fff' : danger ? 'var(--status-critical)' : undefined,
        ['--pulse-color' as string]: 'rgba(232, 98, 44, 0.3)',
      }}
    >
      <Kbd tone={filled ? 'inverse' : 'default'}>{k}</Kbd>
      {children}
    </button>
  );
}
