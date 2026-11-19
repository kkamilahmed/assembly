// The human side of the network screens: who is on shift, and what they
// (and the autopilot) did about the incident, when, measured.
import { useStore, type TimelineEntry } from '@/state/store';
import { STATUS_HEX } from './colors';

const ANALYST = { name: 'Maya R.', role: 'fraud analyst', initials: 'MR' } as const;

/** "On shift: Maya R., fraud analyst" with her initials. */
export function AnalystOnShift() {
  const autopilot = useStore((s) => s.autopilot);
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f3a4d] text-[11px] font-semibold text-white">
        {ANALYST.initials}
      </span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">On shift</div>
        <div className="text-xs font-semibold">
          {ANALYST.name}, {ANALYST.role}
          {autopilot && <span className="font-normal text-[var(--text-secondary)]"> · autopilot on</span>}
        </div>
      </div>
    </div>
  );
}

const TONE: Record<TimelineEntry['kind'], string> = {
  attack: STATUS_HEX.critical,
  alert: STATUS_HEX.warning,
  frozen: '#2f3a4d',
  unfrozen: '#8a92a0',
  refit: STATUS_HEX.healthy,
  caught: STATUS_HEX.healthy,
  autopilot: '#e8622c',
};

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour12: false });
}

/** The incident timeline, newest first. Every time is a timestamp taken
 *  as it happened. */
export function IncidentTimeline({ limit = 6 }: { limit?: number }) {
  const entries = useStore((s) => s.timeline).slice(0, limit);
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Incident timeline</div>
        <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">live</div>
      </div>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-secondary)]">Quiet. {ANALYST.name} is watching the stream; nothing has fired this shift.</p>
      ) : (
        <ol className="scroll-thin mt-3 flex min-h-0 flex-col gap-2.5 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="animate-fade-in flex gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE[e.kind] }} />
              <div className="min-w-0">
                <div className="text-xs font-medium leading-snug">{e.text}</div>
                <div className="font-mono-ui text-[10px] text-[var(--text-secondary)]">
                  {clock(e.at)}
                  {e.measure && ` · ${e.measure}`}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
