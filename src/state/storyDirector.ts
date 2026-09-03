// Orchestrates the scripted weld-drift story for the "problem" robot.
// Deliberately driven by real setTimeout timers, not requestAnimationFrame
// or a useFrame loop, so the narrative's pacing stays correct regardless of
// how fast the tab is actually rendering.
import { PROBLEM_ROBOT_ID, type RobotId } from '@/streaming/lineConfig';
import { setRobotBias } from './engine';
import { useStore } from './store';

const DRIFT_PEAK_MM = 1.55;
// Slow enough that the windowed trend (a trailing 30s average) climbs
// through healthy -> warning -> critical on real accumulating samples,
// rather than the ramp finishing before enough welds have even arrived to
// trust the average — see MIN_TREND_SAMPLES in streaming/lineConfig.ts.
const RAMP_UP_MS = 50_000;
const HOLD_MS = 22_000;
const RAMP_DOWN_MS = 7_000;
// If nobody recalibrates manually, the story still resolves on its own so
// an unattended/looping demo never gets stuck waiting for a click.
const AUTO_RECAL_GRACE_MS = 16_000;

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

  rampBias(afterDrift, target, 0, DRIFT_PEAK_MM, RAMP_UP_MS);
  afterDrift(RAMP_UP_MS + HOLD_MS + AUTO_RECAL_GRACE_MS, () => {
    rampBias(afterDrift, target, DRIFT_PEAK_MM, 0, RAMP_DOWN_MS);
    afterDrift(RAMP_DOWN_MS + 500, () => {
      cycleActive = false;
    });
  });
}

let started = false;

export function initStoryDirector() {
  if (started) return;
  started = true;
  afterDrift(2500, runDriftCycle);
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
