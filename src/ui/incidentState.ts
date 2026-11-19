// What the side screens say once an incident has been dealt with: the
// numbers come from the incident's own timestamps and counts.
import { useStore } from '@/state/store';
import { LOSS_PER_FRAUD_CHARGE_USD, packetsToCharges } from './businessCase';
import { fmtSeconds, fmtUsd } from './format';

export interface Resolved {
  by: 'analyst' | 'autopilot';
  /** Fraudulent charges that got through before the block. */
  charges: number;
  usd: string;
  /** Attack to fix, measured. */
  took: string | null;
}

/** The last incident, if it has been closed. Null while one is open or
 *  before the first. */
export function useResolved(): Resolved | null {
  const incident = useStore((s) => s.incident);
  if (!incident || incident.resolvedAt === null || incident.resolvedBy === null) return null;
  const charges = packetsToCharges(incident.fraudApproved);
  return {
    by: incident.resolvedBy,
    charges,
    usd: fmtUsd(Math.round(charges * LOSS_PER_FRAUD_CHARGE_USD)),
    took: incident.detectedAt !== null ? fmtSeconds(incident.resolvedAt - incident.faultStartedAt) : null,
  };
}

/** One line for a closed incident. */
export function resolvedLine(r: Resolved): string {
  const what = `${r.charges.toLocaleString()} test charge${r.charges === 1 ? '' : 's'} (${r.usd})`;
  const lead = r.by === 'autopilot' ? `Caught${r.took ? ` in ${r.took}` : ''}` : 'Fixed';
  if (r.charges === 0) return `${lead}: not one test charge got through`;
  return r.by === 'autopilot' ? `${lead}: ${what} got through before the block` : `${lead}: ${what} got through before the rule was refit`;
}
