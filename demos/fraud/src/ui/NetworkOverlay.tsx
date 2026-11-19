import { useEffect, type ReactNode } from 'react';
import { useStore } from '@/state/store';
import { fraudRate, HOURS_UNTIL_BATCH, LOSS_PER_FRAUD_CHARGE_USD, packetsToCharges } from './businessCase';
import { fmtSeconds, fmtUsd } from './format';
import { STATUS_HEX } from './colors';
import { Kbd } from './Kbd';

/** How long the autopilot's summary stays up before clearing itself - long
 *  enough to say it out loud. */
const AUTOPILOT_TOAST_MS = 15_000;

/** Cards docked in the right-hand column beside the globe, never over it:
 *  the freeze report while the merchant is frozen, and the autopilot's own
 *  summary when it stops an attack. */
export function NetworkOverlay() {
  return (
    <div className="pointer-events-none absolute right-5 top-12 z-20 flex w-[23rem] max-w-[calc(100%-2.5rem)] flex-col gap-3">
      <FreezeReport />
      <AutopilotToast />
    </div>
  );
}

function Card({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div
      className="animate-fade-in pointer-events-auto w-full overflow-hidden rounded-xl border bg-[var(--surface)] shadow-xl"
      style={{ borderColor: `${accent}66` }}
    >
      <div className="h-1" style={{ backgroundColor: accent }} />
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * The payoff of the manual run. Every figure is measured off the incident as
 * it happened: when the attack began, when the pipeline flagged it, when the
 * merchant was frozen, and what was approved in between. The projection
 * turns the measured fraud rate into what waiting for tomorrow's batch
 * check would have cost.
 */
function FreezeReport() {
  const frozen = useStore((s) => s.frozen);
  const incident = useStore((s) => s.incident);
  if (!frozen) return null;

  const open = incident !== null && incident.resolvedAt === null;
  const relevant = incident !== null && incident.stoppedAt !== null;

  if (!relevant) {
    return (
      <Card accent={STATUS_HEX.critical}>
        <div className="text-sm font-semibold">TechDealz Online frozen</div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          Press <Kbd>S</Kbd> to unfreeze it.
        </div>
      </Card>
    );
  }

  const detectMs = incident.detectedAt !== null ? incident.detectedAt - incident.faultStartedAt : null;
  const reactMs = incident.detectedAt !== null ? incident.stoppedAt! - incident.detectedAt : null;
  const charges = packetsToCharges(incident.fraudApproved);
  const lostUsd = Math.round(charges * LOSS_PER_FRAUD_CHARGE_USD);
  const ranFor = (incident.stoppedAt! - incident.faultStartedAt) / 1000;
  const projected = fraudRate(incident.fraudApproved, ranFor);
  const saved = Math.max(projected.byBatchUsd - lostUsd, 0);

  return (
    <Card accent={open ? STATUS_HEX.critical : STATUS_HEX.healthy}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: open ? STATUS_HEX.critical : STATUS_HEX.healthy }}>
            {open ? 'Merchant frozen' : 'Fixed · merchant still frozen'}
          </div>
          <div className="mt-0.5 text-base font-semibold">
            {open ? 'Card testers are checking stolen cards at TechDealz' : 'Rule recalibrated, every fraudulent charge now blocked'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: charges ? STATUS_HEX.critical : STATUS_HEX.healthy }}>
            {charges.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">fraudulent charge{charges === 1 ? '' : 's'} approved</div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Attack to alert" value={detectMs !== null ? fmtSeconds(detectMs) : '-'} />
        <Metric label="Alert to freeze" value={reactMs !== null ? fmtSeconds(reactMs) : '-'} />
        <Metric label="Lost while running" value={fmtUsd(lostUsd)} />
      </dl>

      {projected.byBatchUsd > 0 && (
        <div className="mt-3 rounded-lg px-3 py-2 text-xs leading-snug" style={{ backgroundColor: `${STATUS_HEX.healthy}14` }}>
          Waiting {HOURS_UNTIL_BATCH}h for tomorrow&apos;s batch check at this rate would have lost{' '}
          <span className="font-semibold">≈{fmtUsd(projected.byBatchUsd)}</span> on ≈{projected.byBatchCharges.toLocaleString()} fraudulent
          charges. Freezing now saved <span className="font-semibold" style={{ color: STATUS_HEX.healthy }}>≈{fmtUsd(saved)}</span>.
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {open ? (
          <>
            Next: <Kbd>C</Kbd> recalibrate the rule
          </>
        ) : (
          <>
            Next: <Kbd>A</Kbd> run on autopilot, or <Kbd>S</Kbd> unfreeze manually
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

/** The autopilot run's payoff: same attack, nobody touched anything, and
 *  the network blocked it before it became a pile of losses. */
function AutopilotToast() {
  const frozen = useStore((s) => s.frozen);
  const caught = useStore((s) => s.autopilotCatch);
  const dismiss = useStore((s) => s.dismissAutopilotCatch);

  useEffect(() => {
    if (!caught) return;
    const id = window.setTimeout(dismiss, AUTOPILOT_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [caught, dismiss]);

  if (!caught || frozen) return null;
  const charges = packetsToCharges(caught.fraudApproved);
  return (
    <Card accent={STATUS_HEX.healthy}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: STATUS_HEX.healthy }}>
            Autopilot
          </div>
          <div className="mt-0.5 text-base font-semibold">Caught the attack and blocked it on its own</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            The stream flagged the card testing, the rule was refitted to it, and every test charge after that was blocked at
            the hub. TechDealz never had to be frozen.
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-ui text-3xl font-semibold leading-none" style={{ color: charges ? STATUS_HEX.warning : STATUS_HEX.healthy }}>
            {charges}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">fraudulent charge{charges === 1 ? '' : 's'} approved</div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Attack to alert" value={fmtSeconds(caught.detectMs)} />
        <Metric label="Alert to fix" value={fmtSeconds(caught.fixMs)} />
        <Metric label="Merchant downtime" value="0s" />
      </dl>
    </Card>
  );
}
