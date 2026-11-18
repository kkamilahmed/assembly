// The presenter's controls, as plain functions the keyboard and the on-screen
// action bar both call:
//
//   D  slight deviation   - WELD-01's torch creeps off the seam. Some cars fail.
//   E  emergency          - the torch jumps well off the seam. Every car fails.
//   S  stop / start line
//   C  recalibrate WELD-01
//   A  run on autopilot   - the line recalibrates itself the moment the
//                           pipeline flags a deviation
//
// Nothing here runs on its own: the line stays healthy until a key is
// pressed, so the presenter decides when the story moves.
import { scaleMs } from '@/presenter/presenterConfig';
import {
  DEVIATION_OFFSET_MM,
  DEVIATION_RAMP_MS,
  PROBLEM_ROBOT_ID,
  type DeviationLevel,
} from '@/streaming/lineConfig';
import type { SensorChannel } from '@/streaming/sensorStream';
import { recalibrateMachine, resetLine, setRobotBias } from './engine';
import { machineSeverity, useStore } from './store';

/**
 * What a misaligned torch does to the arm's own sensors. The weld offset is
 * only measured once per car, but the arm fighting its own mis-set wrist
 * shows up in vibration and temperature within a second or two - which is
 * why the machines screen lights up before the first bad car comes off the
 * weld station, and why the autopilot can act before one does.
 *
 * Intensities are on the fault-injection scale (1-20, a fraction of each
 * channel's headroom): slight settles in the warning band, emergency in
 * critical.
 */
const SENSOR_SIGNATURE: Record<DeviationLevel, Partial<Record<SensorChannel, number>>> = {
  slight: { vibration: 9, temperature: 6 },
  emergency: { vibration: 18, temperature: 16, pressure: 12 },
};

const FAULT_TEXT: Record<DeviationLevel, string> = {
  slight: `${PROBLEM_ROBOT_ID} torch alignment starting to drift`,
  emergency: `${PROBLEM_ROBOT_ID} torch knocked off the seam`,
};

let rampTimers: number[] = [];
let autopilotTimer: number | undefined;
let currentBiasMm = 0;

function clearRamp() {
  rampTimers.forEach((id) => window.clearTimeout(id));
  rampTimers = [];
}

function rampBias(to: number, durationMs: number) {
  clearRamp();
  const from = currentBiasMm;
  const steps = Math.max(Math.round(durationMs / 250), 1);
  for (let i = 1; i <= steps; i++) {
    rampTimers.push(
      window.setTimeout(() => {
        currentBiasMm = from + ((to - from) * i) / steps;
        setRobotBias(PROBLEM_ROBOT_ID, currentBiasMm);
      }, (i / steps) * durationMs),
    );
  }
}

/** D / E. Drifts the weld torch to the level's offset and puts the matching
 *  physical signature on the arm's sensors. Pressing E during a slight
 *  deviation escalates it. */
export function injectDeviation(level: DeviationLevel) {
  const store = useStore.getState();
  store.openIncident(Date.now(), FAULT_TEXT[level]);
  store.clearInjections('scenario');
  for (const [channel, intensity] of Object.entries(SENSOR_SIGNATURE[level])) {
    store.injectFaults([PROBLEM_ROBOT_ID], [channel as SensorChannel], intensity, 'scenario');
  }
  rampBias(DEVIATION_OFFSET_MM[level], DEVIATION_RAMP_MS[level]);
}

/** C. Puts the torch back on the seam: zero offset, sensors settle, trend
 *  window restarts, incident closed. */
export function recalibrate(by: 'operator' | 'autopilot' = 'operator') {
  clearRamp();
  currentBiasMm = 0;
  const store = useStore.getState();
  store.clearInjections('scenario');
  recalibrateMachine(PROBLEM_ROBOT_ID);
  store.markRecalibrated(PROBLEM_ROBOT_ID, Date.now(), by);
}

/** S. Stops the line, or restarts it in whatever mode it was in. */
export function toggleLine() {
  const store = useStore.getState();
  store.setPaused(!store.paused);
}

/** A. Turns autopilot on and makes sure the line is running. Pressed while
 *  autopilot is already on, it turns it back off. */
export function toggleAutopilot() {
  const store = useStore.getState();
  if (store.autopilot) {
    store.setAutopilot(false);
    return;
  }
  store.setAutopilot(true);
  if (store.paused) store.setPaused(false);
  // An incident already detected when autopilot is switched on is exactly
  // the case the policy exists for.
  maybeAutoRecalibrate();
}

/** R. Back to a clean, healthy, running line. Autopilot stays as it was. */
export function resetDemo() {
  clearRamp();
  window.clearTimeout(autopilotTimer);
  autopilotTimer = undefined;
  currentBiasMm = 0;
  resetLine();
}

/** How long autopilot takes to act once the machine is flagged: long enough
 *  that the flagged state is visible for a beat on screen, short enough that
 *  the next car through the weld station is already back in spec. */
const AUTOPILOT_REACTION_MS = scaleMs(600);

/**
 * The autopilot acts on what the pipeline has *detected*, not on what the
 * story director knows it caused: it waits for WELD-01 to leave healthy on
 * the same readings the dashboard shows, then recalibrates. That is the
 * honest version of the claim - real-time analysis is what lets the line
 * fix itself before a stream of bad cars comes off it.
 */
function maybeAutoRecalibrate() {
  const state = useStore.getState();
  const incident = state.incident;
  if (!state.autopilot || state.paused || !incident || incident.resolvedAt !== null) return;
  if (machineSeverity(state, PROBLEM_ROBOT_ID) === 'healthy') return;
  if (autopilotTimer !== undefined) return;
  autopilotTimer = window.setTimeout(() => {
    const now = useStore.getState();
    // Still marked pending while recalibrating, so the store updates the
    // recalibration itself makes don't schedule a second one.
    if (now.autopilot && now.incident && now.incident.resolvedAt === null) recalibrate('autopilot');
    autopilotTimer = undefined;
  }, AUTOPILOT_REACTION_MS);
}

useStore.subscribe(maybeAutoRecalibrate);
