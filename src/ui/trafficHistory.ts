// Short rolling history of the network's output, for the dashboard screen:
// payments settled clean, fraud settled and payments blocked per interval,
// plus a once-a-second sample of the fraud rate. Derived from the store's
// stream as it arrives, outside React, so the screen just reads the latest
// snapshot.
import { useSyncExternalStore } from 'react';
import { useStore, type StoreState } from '@/state/store';
import { fraudRate, type FraudRate } from './businessCase';

export const BUCKET_MS = 5_000;
export const BUCKETS = 24;
/** The fraud-rate line is the trailing rate over this long, sampled once a
 *  second. */
const RATE_WINDOW_S = 10;
const RATE_SAMPLES = 90;

export interface Bucket {
  settled: number;
  fraud: number;
  blocked: number;
}

interface History {
  /** Completed intervals, oldest first. */
  buckets: Bucket[];
  /** The interval in progress. */
  current: Bucket;
  currentStart: number;
  /** Fraud rate (share of online payments), one sample a second. */
  rates: number[];
  /** The latest sample, in full: what the dashboard's numbers quote. */
  latest: FraudRate;
}

const EMPTY: Bucket = { settled: 0, fraud: 0, blocked: 0 };

const NONE = fraudRate(0, RATE_WINDOW_S);
let history: History = { buckets: [], current: EMPTY, currentStart: Date.now(), rates: [], latest: NONE };
/** Fraud packets settled in each of the last RATE_WINDOW_S seconds. */
let perSecond: number[] = [];
let thisSecond = 0;
const listeners = new Set<() => void>();

function emit(next: History) {
  history = next;
  listeners.forEach((l) => l());
}

function onStore(state: StoreState, prev: StoreState) {
  // A reset zeroes the counters: start the charts over with it.
  if (state.settled < prev.settled || state.fraudSettled < prev.fraudSettled || state.blocked < prev.blocked) {
    perSecond = [];
    thisSecond = 0;
    emit({ buckets: [], current: EMPTY, currentStart: Date.now(), rates: [], latest: NONE });
    return;
  }
  const settled = state.settled - prev.settled;
  const fraud = state.fraudSettled - prev.fraudSettled;
  const blocked = state.blocked - prev.blocked;
  thisSecond += fraud;
  const now = Date.now();
  let next = history;
  if (settled || fraud || blocked) {
    const c = next.current;
    next = { ...next, current: { settled: c.settled + settled, fraud: c.fraud + fraud, blocked: c.blocked + blocked } };
  }
  if (now - next.currentStart >= BUCKET_MS) {
    next = { ...next, buckets: [...next.buckets, next.current].slice(-BUCKETS), current: EMPTY, currentStart: now };
  }
  if (next !== history) emit(next);
}
useStore.subscribe(onStore);

window.setInterval(() => {
  perSecond = [...perSecond, thisSecond].slice(-RATE_WINDOW_S);
  thisSecond = 0;
  const fraud = perSecond.reduce((a, b) => a + b, 0);
  const latest = fraudRate(fraud, RATE_WINDOW_S);
  emit({ ...history, rates: [...history.rates, latest.rate].slice(-RATE_SAMPLES), latest });
}, 1000);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTrafficHistory(): History {
  return useSyncExternalStore(subscribe, () => history);
}
