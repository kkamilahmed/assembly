import { machineSeverity, useStore } from '@/state/store';
import { PROBLEM_MACHINE_ID, TABLETS_PER_TRAY } from '@/streaming/lineConfig';
import { STATUS_HEX } from './colors';
import { ViewNav } from './ViewNav';
import type { View } from './views';

/** The line's state in one phrase, coloured by how worried to be. */
function useLineState(): { label: string; color: string } {
  const paused = useStore((s) => s.paused);
  const severity = useStore((s) => machineSeverity(s, PROBLEM_MACHINE_ID));
  if (paused) return { label: 'Line stopped', color: STATUS_HEX.critical };
  if (severity === 'critical') return { label: 'Running · tablets underdosed', color: STATUS_HEX.critical };
  if (severity === 'warning') return { label: 'Running · quality alert', color: STATUS_HEX.warning };
  return { label: 'Running', color: STATUS_HEX.healthy };
}

export function TopBar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const packed = useStore((s) => s.traysPacked);
  const rejected = useStore((s) => s.traysRejected);
  const autopilot = useStore((s) => s.autopilot);
  const setShortcutOverlayOpen = useStore((s) => s.setShortcutOverlayOpen);
  const line = useLineState();

  const total = packed + rejected;
  const yieldPct = total > 0 ? (packed / total) * 100 : 100;

  return (
    <div className="flex items-center justify-between gap-6 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
      <div className="flex items-center gap-5">
        <div>
          <div className="text-sm font-semibold">Meridian Pharma · Tablet Line 2</div>
          <div className="text-xs text-[var(--text-secondary)]">Blood pressure tablets · 120,000 an hour</div>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{ color: line.color, backgroundColor: `${line.color}1a` }}
        >
          <span className="relative flex h-2 w-2">
            {line.color !== STATUS_HEX.healthy && (
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: line.color }}
              />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
          </span>
          {line.label}
        </span>

        {autopilot && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white">
            Autopilot on
          </span>
        )}
      </div>

      <div className="flex items-center gap-5">
        <dl className="font-mono-ui flex items-center gap-5 text-xs">
          <Stat label="Passed" value={(packed * TABLETS_PER_TRAY).toLocaleString()} />
          <Stat
            label="Rejected"
            value={(rejected * TABLETS_PER_TRAY).toLocaleString()}
            color={rejected > 0 ? STATUS_HEX.critical : undefined}
          />
          <Stat
            label="Yield"
            value={`${yieldPct.toFixed(1)}%`}
            color={yieldPct < 95 ? STATUS_HEX.critical : STATUS_HEX.healthy}
          />
        </dl>
        <ViewNav view={view} onChange={onNavigate} />
        <button
          onClick={() => setShortcutOverlayOpen(true)}
          aria-label="Keyboard shortcuts"
          className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-black/5"
        >
          ?
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</dt>
      <dd className="text-sm font-semibold" style={{ color }}>
        {value}
      </dd>
    </div>
  );
}
