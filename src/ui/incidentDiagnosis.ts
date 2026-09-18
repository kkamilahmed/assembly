// Turns the same raw trend/rework/timing data the chart plots into the
// templated root-cause narration for the incident-replay screen. Every fact
// here is read straight off retained state (groundTruthHistory never stopped
// being computed; the timing stamps were taken at the instant each thing
// happened) — nothing is invented or estimated after the fact.
import type { IncidentTiming, ReworkItem, TrendSample } from '@/state/store';

/** What actually became of this incident. Previously the replay screen
 *  derived "was action needed" from `recalibrationRecommended`, a flag that
 *  gets cleared again the moment drift resolves — so an incident that had
 *  visibly crossed the critical line two lines above would render
 *  "No action needed: drift never reached the recalibration threshold"
 *  directly underneath it. The outcome is now computed from what the
 *  incident did, not from a live flag that has since moved on. */
export type IncidentOutcome =
  /** No fault has been injected yet this run. */
  | 'none'
  /** Fault happened, was surfaced, and not one weld ever left out of spec. */
  | 'prevented'
  /** Surfaced before the first defect, but wasn't acted on in time. */
  | 'warned-then-shipped'
  /** Defects were already shipping by the time anyone was told. */
  | 'detected-late'
  /** Defects shipped and no alert ever reached anyone at all. The
   *  spot-check case: there is no detection latency to report because
   *  there was no detection. */
  | 'never-surfaced'
  /** Fault is live and nothing has been surfaced yet. */
  | 'in-progress';

export interface IncidentDiagnosis {
  outcome: IncidentOutcome;
  warnCrossedAt: number | null;
  criticalCrossedAt: number | null;
  peakTrendMm: number;
  /** How long from the physical fault starting to a human being told. */
  detectLatencyMs: number | null;
  /** firstDefect - detected. Positive is warning *ahead* of the first
   *  defect (the entire pitch); negative means the defect came first. */
  leadTimeMs: number | null;
  defectsBeforeDetection: number;
  /** Suspect welds that shipped uninspected during the last dark period. */
  gap: number;
  resolvedAt: number | null;
}

export function computeDiagnosis(
  groundTruthHistory: TrendSample[],
  warnMm: number,
  criticalMm: number,
  incident: IncidentTiming,
  gap: number,
): IncidentDiagnosis {
  const warnCrossedAt = groundTruthHistory.find((s) => s.v > warnMm)?.t ?? null;
  const criticalCrossedAt = groundTruthHistory.find((s) => s.v > criticalMm)?.t ?? null;
  const peakTrendMm = groundTruthHistory.reduce((max, s) => Math.max(max, s.v), 0);

  const { faultStartedAt, detectedAt, firstDefectAt, defectsBeforeDetection, resolvedAt } = incident;

  const detectLatencyMs = faultStartedAt !== null && detectedAt !== null ? detectedAt - faultStartedAt : null;
  const leadTimeMs = detectedAt !== null && firstDefectAt !== null ? firstDefectAt - detectedAt : null;

  let outcome: IncidentOutcome;
  if (faultStartedAt === null) outcome = 'none';
  // Nothing surfaced. Distinguish "still early, nothing to report yet" from
  // "this ran its whole course and nobody was ever told" — the second is
  // the spot-check outcome and the strongest statement the screen can make,
  // so it must not render as a row of em-dashes.
  else if (detectedAt === null) outcome = firstDefectAt === null ? 'in-progress' : 'never-surfaced';
  else if (firstDefectAt === null) outcome = 'prevented';
  else if (firstDefectAt > detectedAt) outcome = 'warned-then-shipped';
  else outcome = 'detected-late';

  return {
    outcome,
    warnCrossedAt,
    criticalCrossedAt,
    peakTrendMm,
    detectLatencyMs,
    leadTimeMs,
    defectsBeforeDetection,
    gap,
    resolvedAt,
  };
}

/** The oldest rework item still retained, i.e. the first car this incident
 *  put on the siding. The queue is newest-first and capped, so a long
 *  incident can age its own first entry out — callers that need the true
 *  first defect should use IncidentTiming.firstDefectAt, which is stamped
 *  from ground truth and never truncated. */
export function firstReworkAt(reworkForRobot: ReworkItem[]): number | null {
  return reworkForRobot.length ? reworkForRobot[reworkForRobot.length - 1].timestamp : null;
}

/** Wall-clock, unambiguous. Was minute+second only, which rendered 13:11:39
 *  as "11:39" — indistinguishable from an hour:minute reading, on a screen
 *  whose entire job is being precise about when things happened. */
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

/** Offset from the start of the incident, e.g. "T+38s" — the form that
 *  actually communicates latency. Falls back to wall-clock when there's no
 *  fault origin to measure from. */
export function fmtOffset(ts: number, origin: number | null): string {
  if (origin === null) return fmtTime(ts);
  const s = Math.round((ts - origin) / 1000);
  return `T+${s}s`;
}

export function fmtDuration(ms: number): string {
  const s = Math.abs(Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
