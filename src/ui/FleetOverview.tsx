import { MachinePreviewCard, TelemetryCard } from './FleetMachineCard';
import { ROBOT_IDS } from '@/streaming/lineConfig';

/** Landing frame: a fleet-wide grid of the line's 4 machines, each with its
 *  own idle 3D preview and a synthetic telemetry readout (see
 *  ui/fleetTelemetry.ts). Right arrow (wired in App.tsx) — or clicking a
 *  card, or the header button here — hands off to the full interactive 3D
 *  line. */
export function FleetOverview({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide">Assembly Line</span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
          {ROBOT_IDS.length} arms
        </span>
        <button
          onClick={onEnter}
          className="ml-auto flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-black/5"
        >
          Enter 3D line
          <kbd className="font-mono-ui rounded bg-black/5 px-1.5 py-0.5 text-[10px]">&rarr;</kbd>
        </button>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
          {ROBOT_IDS.map((id) => (
            <MachinePreviewCard key={id} robotId={id} onEnter={onEnter} />
          ))}
        </div>
        <div className="grid shrink-0 grid-cols-4 gap-4">
          {ROBOT_IDS.map((id) => (
            <TelemetryCard key={id} robotId={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
