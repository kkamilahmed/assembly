// What a stopped-early incident is worth, in the units a plant manager
// thinks in. The simulation runs a short stretch of belt so the story fits
// on stage; these convert the scrap *rate* it measured into a real line's
// terms. Illustrative figures, kept in one place so they can be set to a
// specific customer's numbers before a talk.
import { CELLS_PER_MODULE } from '@/streaming/lineConfig';

/** Modules per hour off Module Line 1. */
export const LINE_JOBS_PER_HOUR = 600;
/** Hours a fault would run before the end-of-shift quality audit caught it. */
export const SHIFT_HOURS = 8;
/** Cells, busbars, casing and labour lost with every scrapped module: 24
 *  cylindrical cells at about $4.60 each plus about $28 of the rest. */
export const COST_PER_REJECT_USD = 138;

export { CELLS_PER_MODULE };

export interface ShiftProjection {
  modules: number;
  cells: number;
  usd: number;
}

/** Modules a whole shift would scrap at this measured failure rate. */
export function projectRate(rate: number): ShiftProjection {
  const modules = Math.round(rate * LINE_JOBS_PER_HOUR * SHIFT_HOURS);
  return { modules, cells: modules * CELLS_PER_MODULE, usd: Math.round(modules * COST_PER_REJECT_USD) };
}

/** If the line had kept running at the measured failure rate until the
 *  end-of-shift audit. Null when nothing has been checked since the fault
 *  started, because there is no rate to project from. */
export function projectShift(inspected: number, rejects: number): ShiftProjection | null {
  if (inspected === 0) return null;
  return projectRate(rejects / inspected);
}
