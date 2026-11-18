import { useEffect, type ReactNode } from 'react';
import { useStore } from '@/state/store';
import { PROBLEM_ROBOT_ID } from '@/streaming/lineConfig';
import { projectShift, SHIFT_HOURS } from './businessCase';
import { fmtSeconds, fmtUsd } from './format';
import { STATUS_HEX } from './colors';
import { Kbd } from './Kbd';

/** How long the autopilot's summary stays up before clearing itself - long
 *  enough to say it out loud. */
const AUTOPILOT_TOAST_MS = 15_000;

/** Cards that float over the top of the 3D plant: the stop report while the
 *  line is stopped, and the autopilot's own summary when it fixes something. */
export function LineOverlay() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
      <StopReport />
      <AutopilotToast />
    </div>
  );
}

function Card({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div
      className="animate-fade-in pointer-events-auto w-[34rem] max-w-full overflow-hidden rounded-xl border bg-[var(--surface)] shadow-xl"
      style={{ borderColor: `${accent}66` }}
    >
      <div className="h-1" style={{ backgroundColor: accent }} />
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * The payoff of the manual run. Every figure is measured off the incident as
 * it happened: when the fault began, when the pipeline flagged it, when the
 * line was stopped, and what had been welded in between. The shift
 * projection turns the measured reject rate into what waiting for the
 * end-of-shift audit would have cost.
 */
function StopReport() {
  const paused = useStore((s) => s.paused);
  const incident = useStore((s) => s.incident);
  if (!paused) return null;

  const open = incident !== null && incident.resolvedAt === null;
  const relevant = incident !== null && incident.stoppedAt !== null;

  if (!relevant) {
    return (
      <Card accent={STATUS_HEX.critical}>
        <div className="text-sm font-semibold">Line stopped</div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          Press <Kbd>S</Kbd> to start it again.
        </div>
      </Card>
    );
  }

  const detectMs = incident.detectedAt !== null ? incident.detectedAt - incident.faultStartedAt : null;
  const reactMs = incident.detectedAt !== null ? incident.stoppedAt! - incident.detectedAt : null;
  const shift = projectShift(incident.welds, incident.scrapped);
  const saved = shift ? Math.max(shift.cars - incident.scrapped, 0) : 0;

  return (
    <Card accent={open ? STATUS_HEX.critical : STATUS_HEX.healthy}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: open ? STATUS_HEX.critical : STATUS_HEX.healthy }}>
            {open ? 'Line stopped' : 'Fixed · line still stopped'}
          </div>
          <div className="mt-0.5 text-base font-semibold">
            {open ? `${PROBLEM_ROBOT_ID} torch is off the weld seam` : `${PROBLEM_ROBOT_ID} recalibrated, torch back on the seam`}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: incident.scrapped ? STATUS_HEX.critical : STATUS_HEX.healthy }}>
            {incident.scrapped}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
            car{incident.scrapped === 1 ? '' : 's'} to rework
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Fault to alert" value={detectMs !== null ? fmtSeconds(detectMs) : '-'} />
        <Metric label="Alert to stop" value={reactMs !== null ? fmtSeconds(reactMs) : '-'} />
        <Metric label="Rejects while running" value={`${incident.scrapped} of ${incident.welds}`} />
      </dl>

      {shift && shift.cars > 0 && (
        <div className="mt-3 rounded-lg px-3 py-2 text-xs leading-snug" style={{ backgroundColor: `${STATUS_HEX.healthy}14` }}>
          Waiting for the end-of-shift audit at this reject rate would have scrapped{' '}
          <span className="font-semibold">≈{shift.cars} cars</span> ({fmtUsd(shift.usd)}) over {SHIFT_HOURS}h.
          Stopping now saved <span className="font-semibold" style={{ color: STATUS_HEX.healthy }}>≈{saved} cars</span>.
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {open ? (
          <>
            Next: <Kbd>C</Kbd> recalibrate {PROBLEM_ROBOT_ID}
          </>
        ) : (
          <>
            Next: <Kbd>A</Kbd> run on autopilot, or <Kbd>S</Kbd> restart manually
          </>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[0.035] px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-mono-ui mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

/** The autopilot run's payoff: same fault, nobody touched anything, and the
 *  line fixed itself before it became a pile of rejects. */
function AutopilotToast() {
  const paused = useStore((s) => s.paused);
  const caught = useStore((s) => s.autopilotCatch);
  const dismiss = useStore((s) => s.dismissAutopilotCatch);

  useEffect(() => {
    if (!caught) return;
    const id = window.setTimeout(dismiss, AUTOPILOT_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [caught, dismiss]);

  if (!caught || paused) return null;
  return (
    <Card accent={STATUS_HEX.healthy}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: STATUS_HEX.healthy }}>
            Autopilot
          </div>
          <div className="mt-0.5 text-base font-semibold">Caught and fixed {PROBLEM_ROBOT_ID} on its own</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            The stream flagged the deviation, the line recalibrated the torch, and production never stopped.
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: caught.scrapped ? STATUS_HEX.warning : STATUS_HEX.healthy }}>
            {caught.scrapped}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">car{caught.scrapped === 1 ? '' : 's'} to rework</div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Fault to alert" value={fmtSeconds(caught.detectMs)} />
        <Metric label="Alert to fix" value={fmtSeconds(caught.fixMs)} />
        <Metric label="Line downtime" value="0s" />
      </dl>
    </Card>
  );
}
