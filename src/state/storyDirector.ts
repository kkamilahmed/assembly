// The presenter's controls, as plain functions the keyboard and the on-screen
// action bar both call:
//
//   D  slight deviation  - press P-2's fill depth creeps shallower as punch 14
//                          wears. Tablet weight slides under the lower limit
//                          and underweight trays are diverted.
//   E  emergency         - pressure spike, the press starts jamming. Every
//                          tray is badly underweight.
//   S  stop / start line (stopping quarantines the last 10 minutes of output)
//   C  recalibrate the press's fill depth
//   A  run on autopilot  - the line recalibrates itself the moment the stream
//                          flags the press
//
// Nothing here runs on its own: the line stays healthy until a key is
// pressed, so the presenter decides when the story moves.
import { scaleMs } from '@/presenter/presenterConfig';
import {
  DEVIATION_OFFSET,
  DEVIATION_RAMP_MS,
  PROBLEM_MACHINE_ID,
  type DeviationLevel,
} from '@/streaming/lineConfig';
import type { SensorChannel } from '@/streaming/sensorStream';
import { quarantineBelt, recalibrateMachine, resetLine, setPressOffset } from './engine';
import { machineSeverity, useStore } from './store';

/**
 * What a worn punch does to the press's own sensors. A tray's weight is only
 * measured once it has travelled from the press, through the coating drum,
 * to the inspection station, but the fill depth and the compression force
 * move within a second or two - which is why the machines screen lights up
 * before the first underweight tray reaches inspection, and why the
 * autopilot can act before a binful of them does.
 *
 * Intensities are on the fault-injection scale (1-20, a fraction of each
 * channel's headroom): slight settles in the warning band (compression
 * force about 11% down), emergency in critical with the ejection force
 * spiking as the press jams.
 */
const SENSOR_SIGNATURE: Record<DeviationLevel, Partial<Record<SensorChannel, number>>> = {
  slight: { process: 4, feed: 5 },
  emergency: { process: 10, feed: 12, mechanical: 14 },
};

const FAULT_TEXT: Record<DeviationLevel, string> = {
  slight: `${PROBLEM_MACHINE_ID} fill depth starting to drift`,
  emergency: `${PROBLEM_MACHINE_ID} pressure spike, press jamming`,
};

let rampTimers: number[] = [];
let autopilotTimer: number | undefined;
let currentOffset = 0;

function clearRamp() {
  rampTimers.forEach((id) => window.clearTimeout(id));
  rampTimers = [];
}

function rampOffset(to: number, durationMs: number) {
  clearRamp();
  const from = currentOffset;
  const steps = Math.max(Math.round(durationMs / 250), 1);
  for (let i = 1; i <= steps; i++) {
    rampTimers.push(
      window.setTimeout(() => {
        currentOffset = from + ((to - from) * i) / steps;
        setPressOffset(currentOffset);
      }, (i / steps) * durationMs),
    );
  }
}

/** D / E. Drifts the press to the level's weight offset and puts the
 *  matching physical signature on its sensors. Pressing E during a slight
 *  deviation escalates it. */
export function injectDeviation(level: DeviationLevel) {
  const store = useStore.getState();
  store.openIncident(Date.now(), FAULT_TEXT[level]);
  store.clearInjections('scenario');
  for (const [channel, intensity] of Object.entries(SENSOR_SIGNATURE[level])) {
    store.injectFaults([PROBLEM_MACHINE_ID], [channel as SensorChannel], intensity, 'scenario');
  }
  rampOffset(DEVIATION_OFFSET[level], DEVIATION_RAMP_MS[level]);
}

/** C. Puts the press's fill depth back on setpoint: zero offset, sensors
 *  settle, trend window restarts, incident closed. */
export function recalibrate(by: 'operator' | 'autopilot' = 'operator') {
  clearRamp();
  currentOffset = 0;
  const store = useStore.getState();
  store.clearInjections('scenario');
  recalibrateMachine(PROBLEM_MACHINE_ID);
  store.markRecalibrated(PROBLEM_MACHINE_ID, Date.now(), by);
}

/** S. Stops the line, or restarts it in whatever mode it was in. */
export function toggleLine() {
  const store = useStore.getState();
  const stopping = !store.paused;
  store.setPaused(stopping);
  // Stopping on an open incident quarantines what the press made: the
  // trays still on the belt are pulled off with it, so nothing pressed
  // before the fix is packed, or weighed against the fixed press, after it.
  const incident = useStore.getState().incident;
  if (stopping && incident && incident.resolvedAt === null && incident.rejected > 0) quarantineBelt();
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
  currentOffset = 0;
  resetLine();
}

/** How long autopilot takes to act once the machine is flagged: long enough
 *  that the flagged state is visible for a beat on screen, short enough that
 *  the next tray out of the press is already back on target. */
const AUTOPILOT_REACTION_MS = scaleMs(600);

/**
 * The autopilot acts on what the pipeline has *detected*, not on what the
 * story director knows it caused: it waits for PRESS-P2 to leave healthy on
 * the same readings the dashboard shows, then recalibrates. That is the
 * honest version of the claim - real-time analysis is what lets the line
 * fix itself before a stream of underdosed tablets comes off it.
 */
function maybeAutoRecalibrate() {
  const state = useStore.getState();
  const incident = state.incident;
  if (!state.autopilot || state.paused || !incident || incident.resolvedAt !== null) return;
  if (machineSeverity(state, PROBLEM_MACHINE_ID) === 'healthy') return;
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
