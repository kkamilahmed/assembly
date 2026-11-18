// What a stopped-early incident is worth, in the units a plant manager
// thinks in. The simulation runs a car through every few seconds so the
// story fits on stage; these convert the scrap *rate* it measured into a
// real line's terms. Illustrative figures, kept in one place so they can be
// set to a specific customer's numbers before a talk.

/** Cars per hour through a typical high-volume body shop. */
export const LINE_JOBS_PER_HOUR = 60;
/** Hours a fault would run before the end-of-shift quality audit caught it. */
export const SHIFT_HOURS = 8;
/** Material, energy and rework labour lost per rejected body-in-white. */
export const COST_PER_REJECT_USD = 1800;

export interface ShiftProjection {
  cars: number;
  usd: number;
}

/** If the line had kept running at the measured reject rate until the
 *  end-of-shift audit. Null when nothing has been welded since the fault
 *  started, because there is no rate to project from. */
export function projectShift(welds: number, rejects: number): ShiftProjection | null {
  if (welds === 0) return null;
  const cars = Math.round((rejects / welds) * LINE_JOBS_PER_HOUR * SHIFT_HOURS);
  return { cars, usd: cars * COST_PER_REJECT_USD };
}
