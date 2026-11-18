// What a stopped-early incident is worth, in the units a plant manager
// thinks in. The simulation runs far fewer loaves than a real line so the
// story fits on stage; these convert the scrap *rate* it measured into a
// real line's terms. Illustrative figures, kept in one place so they can be
// set to a specific customer's numbers before a talk.

/** Loaves per hour off a typical industrial bread line. */
export const LINE_JOBS_PER_HOUR = 4000;
/** Hours a fault would run before the end-of-shift quality audit caught it. */
export const SHIFT_HOURS = 8;
/** Ingredients, energy and packaging lost per rejected loaf. */
export const COST_PER_REJECT_USD = 1.2;

export interface ShiftProjection {
  loaves: number;
  usd: number;
}

/** If the line had kept running at the measured reject rate until the
 *  end-of-shift audit. Null when nothing has been inspected since the fault
 *  started, because there is no rate to project from. */
export function projectShift(inspected: number, rejects: number): ShiftProjection | null {
  if (inspected === 0) return null;
  const loaves = Math.round((rejects / inspected) * LINE_JOBS_PER_HOUR * SHIFT_HOURS);
  return { loaves, usd: Math.round(loaves * COST_PER_REJECT_USD) };
}

/** Dough that goes into one loaf, kg. */
export const DOUGH_KG_PER_LOAF = 0.9;
