// Orchestrates the scripted weld-drift story for the "problem" robot.
// Deliberately driven by real setTimeout timers, not requestAnimationFrame
// or a useFrame loop, so the narrative's pacing stays correct regardless of
// how fast the tab is actually rendering.
import { scaleMs } from '@/presenter/presenterConfig';
import { PROBLEM_ROBOT_ID, type RobotId } from '@/streaming/lineConfig';
import { setRobotBias } from './engine';
import { useStore } from './store';

// ---- Ramp shape ----
// These four constants and the three thresholds in streaming/lineConfig.ts
// are ONE tuned system, not independent knobs. Together they have to satisfy
// the claim the whole demo rests on: `drift_critical` must fire while every
// weld is still inside WELD_TOLERANCE_MM, with enough lead time left to
// actually do something about it.
//
// The previous values (peak 1.55mm over 50s, thresholds 0.55/0.85) failed
// that test outright: because a trailing-window mean lags the physical drift
// by roughly half the window, `drift_critical` landed in the same 4.8s line
// cycle as the first out-of-spec weld — zero warning — and 58% of all cars
// built came out as scrap. A ramp that is gentler relative to the window,
// against control limits set well below the spec limit, is what buys the
// lead time back.
//
// Current shape: median ~24s (worst case ~19s) of warning before the first
// weld can breach tolerance, ~14% of cars affected if the warning is ignored
// all the way through, and a peak that never breaches spec on drift alone —
// defects come from drift *plus* normal process variation stacking, which is
// how this actually fails on a real line.
const DRIFT_PEAK_MM = 1.25;
// Scaled with the line cadence (see presenter/presenterConfig.ts). The ramp
// and the analyzer window have to scale by the same factor or the lead time
// the thresholds were tuned for disappears.
const RAMP_UP_MS = scaleMs(60_000);
const HOLD_MS = scaleMs(12_000);
const RAMP_DOWN_MS = scaleMs(6_000);
// If nobody recalibrates manually, the story still resolves on its own so
// an unattended/looping demo never gets stuck waiting for a click.
const AUTO_RECAL_GRACE_MS = scaleMs(10_000);

type Schedule = (ms: number, fn: () => void) => void;

let driftTimers: number[] = [];
function afterDrift(ms: number, fn: () => void) {
  driftTimers.push(window.setTimeout(fn, ms));
}
function clearDriftTimers() {
  driftTimers.forEach((id) => clearTimeout(id));
  driftTimers = [];
}

function rampBias(schedule: Schedule, robotId: RobotId, from: number, to: number, durationMs: number) {
  const steps = Math.max(Math.round(durationMs / 800), 1);
  for (let i = 1; i <= steps; i++) {
    schedule((i / steps) * durationMs, () => setRobotBias(robotId, from + ((to - from) * i) / steps));
  }
}

let cycleActive = false;

function runDriftCycle() {
  if (cycleActive) return;
  cycleActive = true;
  const target = PROBLEM_ROBOT_ID;

  // Stamp the moment the physical fault actually begins. Everything the
  // incident screen reports about detection latency is measured from here —
  // this is the only place in the app that knows ground-zero, because it's
  // the only place that causes it.
  useStore.getState().markFaultStarted(target, Date.now());

  rampBias(afterDrift, target, 0, DRIFT_PEAK_MM, RAMP_UP_MS);
  afterDrift(RAMP_UP_MS + HOLD_MS + AUTO_RECAL_GRACE_MS, () => resolveWhenSomeoneIsWatching(target));
}

/** How often to re-check whether anyone has started watching again. */
const RESOLVE_RECHECK_MS = 2000;

/**
 * The drift only heals itself once inspection is actually live.
 *
 * The auto-resolve exists so an unattended demo never gets stuck waiting for
 * a click. But under spot checks nobody has been told anything, so a fault
 * quietly fixing itself is narratively backwards — and it broke the reveal
 * in practice: the drift would ramp, ship a handful of defects, and recover
 * on a timer, leaving roughly a thirteen-second window in which the shipped
 * bay still held a defective car for the reveal to turn red. That is not a
 * window a presenter should have to hit.
 *
 * Holding at peak until someone is watching is both truer (nothing gets
 * fixed while nobody knows) and removes the timing pressure entirely: the
 * line keeps producing defects for as long as the blind window lasts.
 */
function resolveWhenSomeoneIsWatching(target: RobotId) {
  if (!useStore.getState().liveVisionQC) {
    afterDrift(RESOLVE_RECHECK_MS, () => resolveWhenSomeoneIsWatching(target));
    return;
  }
  rampBias(afterDrift, target, DRIFT_PEAK_MM, 0, RAMP_DOWN_MS);
  afterDrift(RAMP_DOWN_MS + 500, () => {
    cycleActive = false;
  });
}

let started = false;

/** How long the line runs clean before the scripted fault begins. The drift
 *  used to start 2.5s in, which meant the line had built almost nothing
 *  before the incident dominated every counter on screen — the header
 *  opened on a double-digit scrap rate with no healthy baseline to compare
 *  it against. Long enough now to bank a run of good cars first, and short
 *  enough that an unattended demo still gets to the story on its own.
 *  Pressing D triggers the cycle immediately regardless. */
const BASELINE_MS = scaleMs(34_000);

export function initStoryDirector() {
  if (started) return;
  started = true;
  afterDrift(BASELINE_MS, runDriftCycle);
}

export function stopStoryDirector() {
  started = false;
  cycleActive = false;
  clearDriftTimers();
}

/** Manual re-trigger (keyboard shortcut) — a no-op while a cycle is
 * already in flight. */
export function triggerDriftCycle() {
  runDriftCycle();
}

/** The "Recalibrate" action: cancels any in-flight scripted ramp for this
 * robot so it can't fight the manual fix, snaps the physical bias back to
 * true, and records the recalibration. */
export function recalibrateRobot(robotId: RobotId) {
  if (robotId === PROBLEM_ROBOT_ID && cycleActive) {
    clearDriftTimers();
    cycleActive = false;
  }
  setRobotBias(robotId, 0);
  useStore.getState().markRecalibrated(robotId, Date.now());
}

// Auto-recalibrate policy watcher — module-scoped (not gated by
// init/stopStoryDirector) so it's registered exactly once for the app's
// lifetime and survives Reset. Fires on the rising edge of
// recalibrationRecommended (never on every render where it's still true),
// and only when the policy toggle (set from the incident-replay screen) is
// on. recalibrationRecommended can only ever become true while live vision
// QC is on (see store.ts's ingestAction) — so this can't silently "fix"
// something nobody was watching; the policy only ever closes a loop that
// was already being observed.
let prevRecommended = false;
useStore.subscribe((state) => {
  const recommended = state.robots[PROBLEM_ROBOT_ID].recalibrationRecommended;
  const justRecommended = recommended && !prevRecommended;
  prevRecommended = recommended;
  if (justRecommended && state.autoRecalibrate) recalibrateRobot(PROBLEM_ROBOT_ID);
});
