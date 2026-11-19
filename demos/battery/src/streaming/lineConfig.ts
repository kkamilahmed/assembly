// Shared, plain (no React/Three) constants for the battery module line:
// which machines exist, the line's cadence, and the weld-quality limits the
// weld check and the analyzer judge every module against.

import { scaleMs } from '@/presenter/presenterConfig';

/** Numbered by station along the line. The cell sorter (station 1) only
 *  feeds the line and is not monitored here. */
export const MACHINE_IDS = ['STK-2', 'LW-3', 'CAS-4', 'EOL-5'] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

export const MACHINE_LABELS: Record<MachineId, string> = {
  'STK-2': 'Cell Stacker',
  'LW-3': 'Laser Welder',
  'CAS-4': 'Module Casing',
  'EOL-5': 'End-of-Line Tester',
};

/** The machine the presenter's D / E keys knock out of calibration: the
 *  laser welder. Its power drifting low is what turns into weak welds at
 *  the weld check. */
export const PROBLEM_MACHINE_ID: MachineId = 'LW-3';

/** The tester, which sees a weak weld's consequence: a cell running hot. */
export const TESTER_MACHINE_ID: MachineId = 'EOL-5';

/** Cells welded into every module. */
export const CELLS_PER_MODULE = 24;

// ---- Cadence ----

/** A carrier of sorted cells drops onto the belt this often. */
export const MODULE_INTERVAL_MS = scaleMs(800);
/** Belt speed, world units per second. Scaled with presenter speed so the
 *  line runs faster without the layout changing. */
export const BELT_SPEED = 0.9 * (1000 / scaleMs(1000));

/** How often the producer advances the line and fires station events. */
export const LINE_TICK_MS = 50;

// ---- Quality ----
//
// The weld check estimates the pull strength of every module's busbar welds,
// in newtons. Nominal is WELD_NOMINAL_N; a module passes while its weakest
// weld holds at least WELD_MIN_N. The analyzer and the store both judge
// against these numbers, so they can never disagree.

export const WELD_NOMINAL_N = 240;
export const WELD_MIN_N = 180;
/** How far below nominal a weld may fall before the module fails. */
export const WELD_TOLERANCE_N = WELD_NOMINAL_N - WELD_MIN_N;

/** Normal module-to-module variation with the laser on its setpoint. Tight
 *  relative to the tolerance, so a healthy line essentially never fails a
 *  module and every failure on screen is caused by the fault the presenter
 *  injected. */
export const WELD_SIGMA_N = 8;

/**
 * How far below nominal each fault level pulls the welds (negative is
 * weaker):
 *
 *  slight    (D) - laser power about 9% low as the lens fogs. Most welds
 *                  still hold, but the weak tail slips under the minimum:
 *                  about one module in six fails. The line looks busy and
 *                  fine while it scraps.
 *  emergency (E) - power collapse. Welds barely penetrate, every module
 *                  fails and the tester sees a cell overheating.
 */
export const DEVIATION_OFFSET = { slight: -52, emergency: -125 } as const;
export type DeviationLevel = keyof typeof DEVIATION_OFFSET;

/** How long the laser takes to drift there. A slight drift creeps in, a
 *  collapse is sudden. */
export const DEVIATION_RAMP_MS = { slight: scaleMs(5000), emergency: scaleMs(1500) } as const;

/** Control limits on the windowed mean weld-strength offset, N. Slight
 *  lands in warning, emergency in critical. */
export const WARN_TREND = 22;
export const CRITICAL_TREND = 90;

/** Trailing window for the trend, ms: about eight modules. */
export const TREND_WINDOW_MS = scaleMs(6500);

/** Below this many samples a windowed average is too noisy to act on. */
export const MIN_TREND_SAMPLES = 4;

/** A weld this far below nominal fails the module. Strong welds never do. */
export function weldFails(offset: number): boolean {
  return offset < -WELD_TOLERANCE_N;
}
