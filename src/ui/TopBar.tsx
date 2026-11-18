import { sourceSeverity, useStore } from '@/state/store';
import { PROBLEM_SOURCE_ID } from '@/streaming/networkConfig';
import { packetsToCharges } from './businessCase';
import { STATUS_HEX } from './colors';
import { ViewNav } from './ViewNav';
import type { View } from './views';

/** The network's state in one phrase, coloured by how worried to be. */
function useNetworkState(): { label: string; color: string } {
  const frozen = useStore((s) => s.frozen);
  const severity = useStore((s) => sourceSeverity(s, PROBLEM_SOURCE_ID));
  if (frozen) return { label: 'TechDealz frozen', color: STATUS_HEX.critical };
  if (severity === 'critical') return { label: 'Live · fraud pouring through', color: STATUS_HEX.critical };
  if (severity === 'warning') return { label: 'Live · fraud alert', color: STATUS_HEX.warning };
  return { label: 'Live', color: STATUS_HEX.healthy };
}

export function TopBar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const settled = useStore((s) => s.settled);
  const fraud = useStore((s) => s.fraudSettled);
  const blocked = useStore((s) => s.blocked);
  const autopilot = useStore((s) => s.autopilot);
  const setShortcutOverlayOpen = useStore((s) => s.setShortcutOverlayOpen);
  const state = useNetworkState();

  return (
    <div className="flex items-center justify-between gap-6 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
      <div className="flex items-center gap-5">
        <div>
          <div className="text-sm font-semibold">Northgate Payments · City network</div>
          <div className="text-xs text-[var(--text-secondary)]">Pay, score, approve, settle</div>
        </div>

        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{ color: state.color, backgroundColor: `${state.color}1a` }}
        >
          <span className="relative flex h-2 w-2">
            {state.color !== STATUS_HEX.healthy && (
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: state.color }}
              />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: state.color }} />
          </span>
          {state.label}
        </span>

        {autopilot && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-orange)] px-3 py-1 text-xs font-semibold text-white">
            Autopilot on
          </span>
        )}
      </div>

      <div className="flex items-center gap-5">
        <dl className="font-mono-ui flex items-center gap-5 text-xs">
          <Stat label="Settled" value={settled.toLocaleString()} />
          <Stat
            label="Fraud approved"
            value={packetsToCharges(fraud).toLocaleString()}
            color={fraud > 0 ? STATUS_HEX.critical : undefined}
          />
          <Stat
            label="Fraud blocked"
            value={packetsToCharges(blocked).toLocaleString()}
            color={blocked > 0 ? STATUS_HEX.healthy : undefined}
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
