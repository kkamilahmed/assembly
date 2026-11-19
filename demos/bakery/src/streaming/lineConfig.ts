// Shared, plain (no React/Three) constants for the bakery line: which
// machines exist, the line's cadence, and the quality limits the inspection
// and the analyzer judge every loaf against.

import { scaleMs } from '@/presenter/presenterConfig';

export const MACHINE_IDS = ['MIXER-01', 'OVEN-01', 'VISION-01', 'PACK-01'] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

export const MACHINE_LABELS: Record<MachineId, string> = {
  'MIXER-01': 'Dough Mixer',
  'OVEN-01': 'Tunnel Oven',
  'VISION-01': 'Vision Inspection',
  'PACK-01': 'Packer',
};

/** The machine the presenter's D / E keys knock out of calibration: the
 *  oven. Its zone temperature drifting is what turns into over-baked loaves
 *  at inspection. */
export const PROBLEM_MACHINE_ID: MachineId = 'OVEN-01';

// ---- Cadence ----

/** A raw dough piece drops onto the belt this often. */
export const LOAF_INTERVAL_MS = scaleMs(800);
/** Belt speed, world units per second. Scaled with presenter speed so the
 *  line runs faster without the layout changing. */
export const BELT_SPEED = 0.9 * (1000 / scaleMs(1000));

/** How often the producer advances the line and fires station events. */
export const LINE_TICK_MS = 50;

// ---- Quality ----
//
// Vision inspection scores each loaf's crust browning on an index where 50 is
// the target bake. A loaf passes within +/- BROWNING_TOLERANCE of it. The
// analyzer and the store both judge against these numbers, so they can never
// disagree.

export const BROWNING_TARGET = 50;
export const BROWNING_TOLERANCE = 8;

/** Normal loaf-to-loaf variation with the oven on setpoint. Tight relative
 *  to the tolerance, so a healthy line essentially never rejects a loaf and
 *  every reject on screen is caused by the fault the presenter injected. */
export const BROWNING_SIGMA = 0.8;

/**
 * How far over target the oven drifts each fault level's loaves:
 *
 *  slight    (D) - just past the tolerance, so normal variation lets about
 *                  one loaf in three through and rejects the rest. The line
 *                  looks busy and fine while it fills the reject bin.
 *  emergency (E) - burner runaway. Every loaf comes out burnt.
 */
export const DEVIATION_OFFSET = { slight: 8.4, emergency: 17 } as const;
export type DeviationLevel = keyof typeof DEVIATION_OFFSET;

/** How long the oven takes to drift there. A slight drift creeps in, a
 *  runaway is sudden. */
export const DEVIATION_RAMP_MS = { slight: scaleMs(5000), emergency: scaleMs(1500) } as const;

/** Control limits on the windowed mean browning offset. Slight lands in
 *  warning, emergency in critical. */
export const WARN_TREND = 3;
export const CRITICAL_TREND = 12;

/** Trailing window for the trend, ms: about eight loaves. */
export const TREND_WINDOW_MS = scaleMs(6500);

/** Below this many samples a windowed average is too noisy to act on. */
export const MIN_TREND_SAMPLES = 4;

/** Loaves in the reject bin that are drawn; the count keeps going. */
export const REJECT_BIN_VISIBLE = 14;

/** Browning offset to a 0-3 bake level for colouring: 0 dough, 1 golden,
 *  2 at the reject limit, 3 burnt. */
export function bakeLevel(offset: number): number {
  return 1 + offset / BROWNING_TOLERANCE;
}
