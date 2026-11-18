// Presenter-mode configuration, read once from the URL at module load.
//
// Two things a keynote needs that an ambient demo does not: the same numbers
// every time it runs, and a pace that fits the time between two sentences.
// Both are set here rather than scattered through the simulation so there is
// exactly one place to look when the run on stage does not match the
// rehearsal.
//
//   ?speed=2      run the line and the fault at 2x
//   ?seed=1234    fix the process noise stream to this seed
//   ?seed=random  explicitly opt out of determinism
//
// Defaults are 1x and a fixed seed, i.e. deterministic out of the box.

function readParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

const params = readParams();

/** Simulation rate multiplier. Everything time-based in the streaming layer
 *  and the story director divides by this, so the whole narrative compresses
 *  or stretches together and the tuned relationships between ramp, window
 *  and thresholds are preserved - see `scaleMs`. */
export const SPEED = (() => {
  const raw = Number(params.get('speed'));
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  // Past about 3x loaves crowd the belt and inspection's trend window gets
  // too short to mean much.
  return Math.min(Math.max(raw, 0.5), 3);
})();

/** Scale a duration by the presenter speed. Applied to schedules and
 *  windows, never to geometry. */
export function scaleMs(ms: number): number {
  return Math.round(ms / SPEED);
}

const DEFAULT_SEED = 20260915;

/** Seed for the bake process-noise stream. Null means "genuinely random",
 *  only when explicitly asked for. A fixed seed is the default because a
 *  demo you cannot rehearse against is a demo you cannot write speaker
 *  notes for: with this set, the defect count, the detection latency and
 *  the gap number are the same on stage as they were in the run-through. */
export const SEED: number | null = (() => {
  const raw = params.get('seed');
  if (raw === 'random') return null;
  const n = Number(raw);
  return Number.isFinite(n) && raw !== null ? n : DEFAULT_SEED;
})();

export const IS_DETERMINISTIC = SEED !== null;
