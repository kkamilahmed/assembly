// The keynote run of show, as executable stage directions.
//
// Each act is one keypress that puts the demo into a known state and starts
// the beat. That matters for two reasons. Setting an act up by hand live is
// four or five keystrokes in the right order (reset, then mode, then fault —
// get it wrong and reset clears the mode you just set), and the acts are
// meant to be compared against each other, which is only honest if the
// starting conditions are identical. Combined with the fixed RNG seed in
// presenterConfig.ts, running act 1 twice produces the same numbers twice.
import { resetLine } from '@/state/engine';
import { useStore } from '@/state/store';
import { recalibrateRobot, stopStoryDirector, triggerDriftCycle } from '@/state/storyDirector';
import { PROBLEM_ROBOT_ID } from '@/streaming/lineConfig';
import { scaleMs } from './presenterConfig';

export interface Act {
  n: number;
  title: string;
  /** The claim this act exists to make, for the presenter's own reference. */
  beat: string;
  /** What to do while it plays out. */
  cue: string;
}

/** A short run of clean line before the fault, so the yield figure has
 *  healthy production to average against and the trend window has real
 *  samples in it before anything starts moving. Short enough to talk over. */
const BASELINE_BEAT_MS = scaleMs(9000);

export const ACTS: Act[] = [
  {
    n: 1,
    title: 'How the line runs today',
    beat: 'Periodic sampling is not "no monitoring" — it is a blind window, every window, forever.',
    cue: 'Let it run. Yield stays green while grey "shipped unchecked" cars pile up in the bay. Press 2 whenever you are ready.',
  },
  {
    n: 2,
    title: 'What it cost',
    beat: 'Every weld was measured. The measurement was just late.',
    cue: 'Inspection comes back on, the bay turns red, the line pauses. Scrub the divergence.',
  },
  {
    n: 3,
    title: 'Same fault, stream on',
    beat: 'Alert fires below spec, before any weld fails. Recalibrate when prompted.',
    cue: 'Click Recalibrate the moment it appears. Zero defects.',
  },
  {
    n: 4,
    title: 'Close the loop',
    beat: 'Real-time analysis is not a faster dashboard. It is the system acting without you.',
    cue: 'Hands off the keyboard. The line fixes itself.',
  },
];

let pendingFault: number | undefined;

function stageFault() {
  window.clearTimeout(pendingFault);
  pendingFault = window.setTimeout(triggerDriftCycle, BASELINE_BEAT_MS);
}

/** Reset to a known-clean line. Order matters: `reset()` restores continuous
 *  inspection, so any mode change has to happen after it, not before. */
function freshLine() {
  stopStoryDirector();
  window.clearTimeout(pendingFault);
  resetLine();
}

export function runAct(n: number) {
  const store = useStore.getState();

  switch (n) {
    // Act 1 — the pre-streaming baseline: a periodic manual sample, and a
    // dashboard that cannot see between the samples.
    case 1: {
      freshLine();
      store.setReplayOpen(false);
      if (store.autoRecalibrate) store.toggleAutoRecalibrate();
      if (useStore.getState().liveVisionQC) store.toggleLiveVisionQC();
      stageFault();
      break;
    }

    // Act 2 — switch the lights back on. Restoring continuous inspection is
    // what turns the parked cars red and fires the reveal banner; freezing
    // the line keeps that tableau on screen instead of scrolling it away.
    // Deliberately does NOT open the incident replay: the banner IS the
    // beat, and it carries its own Investigate button for going deeper once
    // the room has seen the cars.
    case 2: {
      if (!useStore.getState().liveVisionQC) store.toggleLiveVisionQC();
      if (!useStore.getState().paused) store.togglePause();
      store.setReplayOpen(false);
      break;
    }

    // Act 3 — identical fault, identical seed, continuous inspection. The
    // only variable that changed is when the analysis happened.
    case 3: {
      freshLine();
      store.setReplayOpen(false);
      if (useStore.getState().paused) store.togglePause();
      if (store.autoRecalibrate) store.toggleAutoRecalibrate();
      stageFault();
      break;
    }

    // Act 4 — same again, with the standing policy on. Nobody touches
    // anything; the loop closes itself.
    case 4: {
      freshLine();
      store.setReplayOpen(false);
      if (useStore.getState().paused) store.togglePause();
      if (!useStore.getState().autoRecalibrate) store.toggleAutoRecalibrate();
      stageFault();
      break;
    }
  }

  useStore.getState().setPresenterAct(n);
}

/** The manual fix, for when act 3's Recalibrate button is easier to hit as a
 *  keystroke than as a click on stage. */
export function presenterRecalibrate() {
  recalibrateRobot(PROBLEM_ROBOT_ID);
}
