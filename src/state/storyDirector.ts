// The presenter's controls, as plain functions the keyboard and the on-screen
// action bar both call:
//
//   D  slight deviation  - card testing starts at TechDealz Online: a storm
//                          of $1 charges paced under the velocity rule, so
//                          every one is approved.
//   E  emergency         - account-takeover wave: the storm grows and stolen
//                          logins start paying at every source at once.
//   S  freeze / unfreeze the merchant
//   C  recalibrate the rules to the live attack
//   A  run on autopilot  - the network refits its rules the moment the
//                          stream flags the attack
//
// Nothing here runs on its own: the network stays healthy until a key is
// pressed, so the presenter decides when the story moves.
import { scaleMs } from '@/presenter/presenterConfig';
import type { AttackConfig } from '@/streaming/PaymentProducer';
import {
  ATTACK,
  ATTACK_FADE_MS,
  ATTACK_RAMP_MS,
  PROBLEM_SOURCE_ID,
  SOURCE_LABELS,
  type DeviationLevel,
  type SourceId,
} from '@/streaming/networkConfig';
import type { SignalChannel } from '@/streaming/signalStream';
import { recalibrateNetwork, resetNetwork, setAttack, setRulesHold } from './engine';
import { sourceSeverity, useStore } from './store';

/**
 * What an attack does to the sources' own live signals. The risk of a
 * payment is only known once it has travelled to the hub, but a merchant's
 * approval velocity and new-card share move within a second or two - which
 * is why the sources screen lights up before the first fraudulent packet
 * reaches the scanner, and why the autopilot can act before a pile of them
 * settles.
 *
 * Intensities are on the fault-injection scale (1-20, a fraction of each
 * channel's headroom): slight settles in the warning band, emergency in
 * critical at the merchant and warning everywhere else.
 */
const SIGNAL_SIGNATURE: Record<DeviationLevel, Partial<Record<SourceId, Partial<Record<SignalChannel, number>>>>> = {
  slight: { [PROBLEM_SOURCE_ID]: { velocity: 9, newCards: 13 } },
  emergency: {
    [PROBLEM_SOURCE_ID]: { velocity: 16, newCards: 18, newDevices: 15 },
    'CAFE-01': { newDevices: 8 },
    'ATM-07': { newDevices: 8 },
    'MALL-03': { newDevices: 8 },
  },
};

const FAULT_TEXT: Record<DeviationLevel, string> = {
  slight: `Card testing starting at ${SOURCE_LABELS[PROBLEM_SOURCE_ID]}`,
  emergency: 'Account-takeover wave across the network',
};

const NO_ATTACK: AttackConfig = { perSec: 0, risk: 0, takeoverShare: 0 };

let rampTimers: number[] = [];
let autopilotTimer: number | undefined;
let current: AttackConfig = NO_ATTACK;

function clearRamp() {
  rampTimers.forEach((id) => window.clearTimeout(id));
  rampTimers = [];
}

/** Moves the attack's rate to `toPerSec` over `durationMs`; its risk and
 *  takeover share switch at once. */
function rampAttack(to: AttackConfig, durationMs: number) {
  clearRamp();
  const from = current.perSec;
  current = { ...to, perSec: from };
  setAttack(current);
  const steps = Math.max(Math.round(durationMs / 250), 1);
  for (let i = 1; i <= steps; i++) {
    rampTimers.push(
      window.setTimeout(() => {
        current = { ...current, perSec: from + ((to.perSec - from) * i) / steps };
        setAttack(current);
      }, (i / steps) * durationMs),
    );
  }
}

/** D / E. Starts the level's attack and puts its signature on the sources'
 *  signals. Pressing E during a slight attack escalates it. */
export function injectDeviation(level: DeviationLevel) {
  const store = useStore.getState();
  store.openIncident(Date.now(), FAULT_TEXT[level]);
  store.clearInjections('scenario');
  for (const [sourceId, channels] of Object.entries(SIGNAL_SIGNATURE[level])) {
    for (const [channel, intensity] of Object.entries(channels)) {
      store.injectFaults([sourceId as SourceId], [channel as SignalChannel], intensity, 'scenario');
    }
  }
  // Paced under the rules: they approve it until somebody refits them.
  setRulesHold(false);
  rampAttack({ ...ATTACK[level] }, ATTACK_RAMP_MS[level]);
}

/** C. Fits the rules to the live attack: from here every fraudulent charge
 *  is blocked at the hub, the testers give up over a few seconds, the
 *  sources' signals settle and the incident is closed. */
export function recalibrate(by: 'analyst' | 'autopilot' = 'analyst') {
  const store = useStore.getState();
  store.clearInjections('scenario');
  recalibrateNetwork();
  rampAttack({ ...current, takeoverShare: 0, perSec: 0 }, ATTACK_FADE_MS);
  store.markRecalibrated(PROBLEM_SOURCE_ID, Date.now(), by);
}

/** S. Freezes the merchant, or unfreezes it in whatever mode the network
 *  is in. */
export function toggleFreeze() {
  const store = useStore.getState();
  store.setFrozen(!store.frozen);
}

/** A. Turns autopilot on and makes sure the merchant is unfrozen. Pressed
 *  while autopilot is already on, it turns it back off. */
export function toggleAutopilot() {
  const store = useStore.getState();
  if (store.autopilot) {
    store.setAutopilot(false);
    return;
  }
  store.setAutopilot(true);
  if (store.frozen) store.setFrozen(false);
  // An incident already detected when autopilot is switched on is exactly
  // the case the policy exists for.
  maybeAutoRecalibrate();
}

/** R. Back to a clean, healthy network. Autopilot stays as it was. */
export function resetDemo() {
  clearRamp();
  window.clearTimeout(autopilotTimer);
  autopilotTimer = undefined;
  current = NO_ATTACK;
  resetNetwork();
}

/** How long autopilot takes to act once the source is flagged: long enough
 *  that the flagged state is visible for a beat on screen, short enough that
 *  the attack's first packets are blocked at the hub. */
const AUTOPILOT_REACTION_MS = scaleMs(600);

/**
 * The autopilot acts on what the pipeline has *detected*, not on what the
 * story director knows it caused: it waits for TDZ-WEB to leave healthy on
 * the same readings the dashboard shows, then refits the rules. That is the
 * honest version of the claim - real-time analysis is what lets the network
 * block an attack before the money is gone.
 */
function maybeAutoRecalibrate() {
  const state = useStore.getState();
  const incident = state.incident;
  if (!state.autopilot || state.frozen || !incident || incident.resolvedAt !== null) return;
  if (sourceSeverity(state, PROBLEM_SOURCE_ID) === 'healthy') return;
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
