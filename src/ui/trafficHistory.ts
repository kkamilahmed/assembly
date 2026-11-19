// Short rolling history of the network's output, for the dashboard screen:
// payments approved clean, fraud approved and payments blocked per
// interval, plus a once-a-second sample of the fraud rate.
//
// Every payment is counted in the interval in which it *reached the hub*,
// worked out from its own send time, its lane and the packet speed - its
// event time - not in the interval in which the store happened to hear
// about it. A throttled tab or a slow frame delivers several seconds of
// events in one burst; counting by arrival piled them into one fat bar and
// spiked the fraud rate. By event time every interval holds the same slice
// of the stream, and late events land in the interval they belong to.
import { useSyncExternalStore } from 'react';
import { useStore, type Payment, type StoreState } from '@/state/store';
import { FLIGHT, PACKET_SPEED } from '@/streaming/networkConfig';
import { fraudRate, type FraudRate } from './businessCase';

export const BUCKET_MS = 5_000;
export const BUCKETS = 24;
/** The fraud rate is the rate over this many whole seconds... */
const RATE_WINDOW_S = 15;
/** ...ending this many seconds ago, so the window only covers seconds whose
 *  payments have all been delivered. */
const RATE_LAG_S = 2;
const RATE_SAMPLES = 90;

export interface Bucket {
  settled: number;
  fraud: number;
  blocked: number;
}

interface History {
  /** Completed intervals, oldest first, always BUCKETS long. */
  buckets: Bucket[];
  /** The interval in progress. */
  current: Bucket;
  /** Fraud rate (share of online payments), one sample a second. */
  rates: number[];
  /** The latest sample, in full: what the dashboard's numbers quote. */
  latest: FraudRate;
}

const empty = (): Bucket => ({ settled: 0, fraud: 0, blocked: 0 });

let epoch = Date.now();
/** Counts per interval index since the epoch. */
let counts = new Map<number, Bucket>();
/** Fraud approved per whole second since the epoch. */
let fraudPerSecond = new Map<number, number>();
let rates: number[] = [];
let latest = fraudRate(0, RATE_WINDOW_S);

/** When a payment was scored at the hub, ms since the epoch. */
function hubTime(p: Payment): number {
  return p.spawnedAt + (FLIGHT.scan / PACKET_SPEED) * 1000 - epoch;
}

function count(p: Payment) {
  const t = hubTime(p);
  const field: keyof Bucket = !p.approved ? 'blocked' : p.suspect ? 'fraud' : 'settled';
  const index = Math.floor(t / BUCKET_MS);
  const bucket = counts.get(index) ?? empty();
  bucket[field] += 1;
  counts.set(index, bucket);
  if (field === 'fraud') {
    const sec = Math.floor(t / 1000);
    fraudPerSecond.set(sec, (fraudPerSecond.get(sec) ?? 0) + 1);
  }
}

function snapshot(): History {
  const index = Math.floor((Date.now() - epoch) / BUCKET_MS);
  const buckets: Bucket[] = [];
  for (let i = index - BUCKETS; i < index; i++) buckets.push(counts.get(i) ?? empty());
  for (const key of counts.keys()) if (key < index - BUCKETS) counts.delete(key);
  return { buckets, current: counts.get(index) ?? empty(), rates, latest };
}

let history: History = snapshot();
const listeners = new Set<() => void>();

function emit() {
  history = snapshot();
  listeners.forEach((l) => l());
}

function onStore(state: StoreState, prev: StoreState) {
  // A reset zeroes the counters: start the charts over with it.
  if (state.settled < prev.settled || state.fraudSettled < prev.fraudSettled || state.blocked < prev.blocked) {
    epoch = Date.now();
    counts = new Map();
    fraudPerSecond = new Map();
    rates = [];
    latest = fraudRate(0, RATE_WINDOW_S);
    emit();
    return;
  }
  if (state.payments === prev.payments) return;
  const wasScored = new Set<string>();
  for (const p of prev.payments) if (p.approved !== null) wasScored.add(p.id);
  let changed = false;
  for (const p of state.payments) {
    if (p.approved !== null && !wasScored.has(p.id)) {
      count(p);
      changed = true;
    }
  }
  if (changed) emit();
}
useStore.subscribe(onStore);

/** Once a second: the fraud rate over the last whole, fully delivered
 *  seconds of event time. */
window.setInterval(() => {
  const end = Math.floor((Date.now() - epoch) / 1000) - RATE_LAG_S;
  let fraud = 0;
  for (let s = end - RATE_WINDOW_S; s < end; s++) fraud += fraudPerSecond.get(s) ?? 0;
  for (const key of fraudPerSecond.keys()) if (key < end - RATE_WINDOW_S) fraudPerSecond.delete(key);
  latest = fraudRate(fraud, RATE_WINDOW_S);
  rates = [...rates, latest.rate].slice(-RATE_SAMPLES);
  emit();
}, 1000);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTrafficHistory(): History {
  return useSyncExternalStore(subscribe, () => history);
}
