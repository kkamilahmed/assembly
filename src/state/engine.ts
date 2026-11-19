// The bridge between the streaming layer and the store - the ONLY file that
// imports both `streaming/` and `state/store.ts`. Swapping in a real
// Kafka/Flink backend means replacing the PaymentProducer/FraudAnalyzer/
// SignalStream construction below with something exposing the same listener
// surface (a WebSocket bridge, most likely); nothing in state/store.ts,
// scene/ or ui/ needs to know the difference.
import { FraudAnalyzer } from '@/streaming/FraudAnalyzer';
import { PaymentProducer, type AttackConfig } from '@/streaming/PaymentProducer';
import { SOURCE_IDS } from '@/streaming/networkConfig';
import { SignalStream } from '@/streaming/signalStream';
import { useStore } from './store';

// The hub scores every payment from every source.
const scoring = new FraudAnalyzer();
const producer = new PaymentProducer();
const signalStream = new SignalStream();

let initialized = false;

/** Start everything: the traffic, the scoring job and the signal stream.
 *  Idempotent. */
export function initEngine() {
  if (initialized) return;
  initialized = true;

  producer.init(scoring);
  producer.onSpawn((id, source, kind, spawnedAt, from) => useStore.getState().ingestSpawn(id, source, kind, spawnedAt, from));
  producer.onHold((id, timestamp) => useStore.getState().ingestHold(id, timestamp));
  producer.onBlock((id, timestamp) => useStore.getState().ingestBlock(id, timestamp));
  producer.onSettle((id) => useStore.getState().ingestSettle(id));

  scoring.onScore((event) => useStore.getState().ingestScore(event));
  scoring.onWindowStats((event) => useStore.getState().ingestWindowStats(event));
  scoring.onAction((event) => useStore.getState().ingestAction(event));

  signalStream.onFrame((frame, timestamp) => useStore.getState().ingestSignalFrame(frame, timestamp));

  // The store owns no stream state and the streams own no store state: this
  // subscription is the one place that carries network state across.
  let prevFrozen = useStore.getState().frozen;
  let prevInjections = useStore.getState().injections;
  useStore.subscribe((state) => {
    if (state.frozen !== prevFrozen) {
      prevFrozen = state.frozen;
      producer.configure({ frozen: state.frozen });
      scoring.configure({ frozen: state.frozen });
      signalStream.configure({ frozen: state.frozen });
    }
    if (state.injections !== prevInjections) {
      prevInjections = state.injections;
      signalStream.setInjections(state.injections);
    }
  });

  producer.start();
  scoring.start();
  signalStream.start();
}

/** The attack currently hitting the network. Written by the story
 *  director's ramps. */
export function setAttack(attack: AttackConfig) {
  producer.setAttack(attack);
}

/** Whether the production rules stop what the stream flags. */
export function setRulesHold(hold: boolean) {
  producer.setRulesHold(hold);
}

/** Rules fitted to the live attack: what slipped through before no longer
 *  counts against any source, and approval velocity drops back to everyday
 *  levels because the attack's charges stop being approved. */
export function recalibrateNetwork() {
  producer.setRulesHold(true);
  scoring.reset();
  for (const id of SOURCE_IDS) signalStream.recover(id);
}

export function resetNetwork() {
  producer.reset();
  scoring.reset();
  signalStream.reset();
  useStore.getState().reset();
}
