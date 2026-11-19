// The presenter's controls, as plain functions the keyboard and the on-screen
// action bar both call:
//
//   D  slight deviation  - the oven's zone 2 creeps over setpoint. Some loaves
//                          come out over-baked and are rejected.
//   E  emergency         - burner runaway. Every loaf burns.
//   S  stop / start line
//   C  recalibrate the oven
//   A  run on autopilot  - the line recalibrates itself the moment the stream
//                          flags the oven
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
import { recalibrateMachine, resetLine, setOvenOffset } from './engine';
import { machineSeverity, useStore } from './store';

/**
 * What an oven running hot does to its own sensors. A loaf's browning is only
 * measured once it has travelled from the oven to the camera, but the zone
 * temperature and the burner output move within a second or two - which is
 * why the machines screen lights up before the first over-baked loaf reaches
 * inspection, and why the autopilot can act before a pile of them does.
 *
 * Intensities are on the fault-injection scale (1-20, a fraction of each
 * channel's headroom): slight settles in the warning band, emergency in
 * critical.
 */
const SENSOR_SIGNATURE: Record<DeviationLevel, Partial<Record<SensorChannel, number>>> = {
  slight: { temperature: 5, load: 11 },
  emergency: { temperature: 14, load: 17, vibration: 9 },
};

const FAULT_TEXT: Record<DeviationLevel, string> = {
  slight: `${PROBLEM_MACHINE_ID} zone 2 starting to run hot`,
  emergency: `${PROBLEM_MACHINE_ID} burner runaway`,
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
        setOvenOffset(currentOffset);
      }, (i / steps) * durationMs),
    );
  }
}

/** D / E. Drifts the oven to the level's offset and puts the matching
 *  physical signature on its sensors. Pressing E during a slight deviation
 *  escalates it. */
export function injectDeviation(level: DeviationLevel) {
  const store = useStore.getState();
  store.openIncident(Date.now(), FAULT_TEXT[level]);
  store.clearInjections('scenario');
  for (const [channel, intensity] of Object.entries(SENSOR_SIGNATURE[level])) {
    store.injectFaults([PROBLEM_MACHINE_ID], [channel as SensorChannel], intensity, 'scenario');
  }
  rampOffset(DEVIATION_OFFSET[level], DEVIATION_RAMP_MS[level]);
}

/** C. Puts the oven back on setpoint: zero offset, sensors settle, trend
 *  window restarts, incident closed. */
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
  currentOffset = 0;
  resetLine();
}

/** How long autopilot takes to act once the machine is flagged: long enough
 *  that the flagged state is visible for a beat on screen, short enough that
 *  the next loaf out of the oven is already back on target. */
const AUTOPILOT_REACTION_MS = scaleMs(600);

/**
 * The autopilot acts on what the pipeline has *detected*, not on what the
 * story director knows it caused: it waits for OVEN-01 to leave healthy on
 * the same readings the dashboard shows, then recalibrates. That is the
 * honest version of the claim - real-time analysis is what lets the line
 * fix itself before a stream of burnt loaves comes off it.
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
