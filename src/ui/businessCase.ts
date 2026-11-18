// What an underdosing incident is worth, in the units a plant manager and a
// quality head think in. The simulation runs far fewer tablets than a real
// press so the story fits on stage; these put what it measured into a real
// line's terms. Illustrative figures, kept in one place so they can be set
// to a specific customer's numbers before a talk.

/** Tablets per hour off Tablet Line 2. */
export const LINE_TABLETS_PER_HOUR = 120_000;
/** One batch of the blood pressure tablet. A deviation found in it puts the
 *  whole batch on hold: underweight tablets cannot be sorted out of 2 million
 *  after the fact. */
export const BATCH_TABLETS = 2_000_000;
/** What recalling one shipped batch costs: retrieval from pharmacies and
 *  wholesalers, destruction, replacement stock and the investigation. */
export const RECALL_COST_USD = 420_000;
/** Stopping the press quarantines what it made in this window, for the
 *  quality team to test and release or destroy. */
export const QUARANTINE_MINUTES = 10;
export const QUARANTINE_TABLETS = Math.round((LINE_TABLETS_PER_HOUR * QUARANTINE_MINUTES) / 60);
/** Materials and press time lost per quarantined tablet, if it is
 *  destroyed. */
export const COST_PER_TABLET_USD = 0.06;
