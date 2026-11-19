// Shared, plain (no React/Three) constants for the tablet line: which
// machines exist, the line's cadence, and the weight limits the inspection
// and the analyzer judge every tray of tablets against.

import { scaleMs } from '@/presenter/presenterConfig';

export const MACHINE_IDS = ['BLEND-01', 'PRESS-P2', 'COAT-01', 'VISION-01', 'BLISTER-01', 'CARTON-01'] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

export const MACHINE_LABELS: Record<MachineId, string> = {
  'BLEND-01': 'Powder Blender',
  'PRESS-P2': 'Tablet Press P-2',
  'COAT-01': 'Coating Drum',
  'VISION-01': 'Vision Inspection',
  'BLISTER-01': 'Blister Packer',
  'CARTON-01': 'Cartoner',
};

/** The machine the presenter's D / E keys knock out of calibration: press
 *  P-2. Its fill depth drifting is what turns into underweight, underdosed
 *  tablets at inspection. */
export const PROBLEM_MACHINE_ID: MachineId = 'PRESS-P2';

// ---- Cadence ----

/** A tray of freshly pressed tablets leaves the press this often. */
export const TRAY_INTERVAL_MS = scaleMs(800);
/** Belt speed, world units per second. Scaled with presenter speed so the
 *  line runs faster without the layout changing. */
export const BELT_SPEED = 0.9 * (1000 / scaleMs(1000));

/** How often the producer advances the line and fires station events. */
export const LINE_TICK_MS = 50;

/** Tablets on one tray: a 4 x 6 grid. Every count on screen is in tablets. */
export const TABLETS_PER_TRAY = 24;

// ---- Quality ----
//
// The inspection station weighs a sample from every tray and reports its
// mean tablet weight. The label claim is 250 mg; a tray passes inside
// +/- WEIGHT_TOLERANCE_MG of it. The analyzer and the store both judge
// against these numbers, so they can never disagree.

export const WEIGHT_TARGET_MG = 250;
export const WEIGHT_TOLERANCE_MG = 5;
/** The limit an underdosing press crosses. */
export const WEIGHT_LOWER_LIMIT_MG = WEIGHT_TARGET_MG - WEIGHT_TOLERANCE_MG;

/** Normal tray-to-tray variation with the press on setpoint. Tight relative
 *  to the tolerance, so a healthy line essentially never rejects a tray and
 *  every reject on screen is caused by the fault the presenter injected. */
export const WEIGHT_SIGMA_MG = 0.7;

/**
 * Where each fault level takes the mean tablet weight (mg from target):
 *
 *  slight    (D) - the fill depth creeps shallower as punch 14 wears. The
 *                  weight slides through the lower limit and keeps going,
 *                  to 8% under the label claim if nobody acts.
 *  emergency (E) - pressure spike and the press starts jamming: dies
 *                  half-fill and every tray is badly underweight.
 */
export const DEVIATION_OFFSET = { slight: -20, emergency: -32 } as const;
export type DeviationLevel = keyof typeof DEVIATION_OFFSET;

/** How long the press takes to get there. A worn punch is a slow drift
 *  (the limit is crossed about a quarter of the way in); a jam is sudden. */
export const DEVIATION_RAMP_MS = { slight: scaleMs(24_000), emergency: scaleMs(1500) } as const;

/** Control limits on the windowed mean weight offset. A mean outside the
 *  tolerance means the batch is being made out of spec: critical. */
export const WARN_TREND = 2.5;
export const CRITICAL_TREND = WEIGHT_TOLERANCE_MG;

/** Trailing window for the trend, ms: about eight trays. */
export const TREND_WINDOW_MS = scaleMs(6500);

/** Below this many samples a windowed average is too noisy to act on. */
export const MIN_TREND_SAMPLES = 4;

/** Trays in the reject bin that are drawn; the count keeps going. */
export const REJECT_BIN_VISIBLE = 12;

/** How much less medicine a tablet this far off target carries than the
 *  label claims, %. The active ingredient is blended uniformly through the
 *  powder, so dose follows weight. */
export function doseShortfallPct(offsetMg: number): number {
  return Math.max(0, (-offsetMg / WEIGHT_TARGET_MG) * 100);
}
