// Short rolling history of the line's output, for the dashboard screen:
// modules that passed and failed the weld check, per interval. Derived from the store's stream as
// it arrives, outside React, so the screen just reads the latest snapshot.
import { useSyncExternalStore } from 'react';
import { useStore, type StoreState } from '@/state/store';

export const BUCKET_MS = 5_000;
export const BUCKETS = 24;

export interface Bucket {
  good: number;
  rejected: number;
}

interface History {
  /** Completed intervals, oldest first. */
  buckets: Bucket[];
  /** The interval in progress. */
  current: Bucket;
  currentStart: number;
}

const START = Date.now();
let history: History = { buckets: [], current: { good: 0, rejected: 0 }, currentStart: START };
const listeners = new Set<() => void>();

function emit(next: History) {
  history = next;
  listeners.forEach((l) => l());
}

function onStore(state: StoreState, prev: StoreState) {
  // A reset zeroes the counters: start the chart over with it.
  if (state.modulesPassed < prev.modulesPassed || state.modulesScrapped < prev.modulesScrapped) {
    emit({ buckets: [], current: { good: 0, rejected: 0 }, currentStart: Date.now() });
    return;
  }
  const good = state.modulesPassed - prev.modulesPassed;
  const rejected = state.modulesScrapped - prev.modulesScrapped;
  // A stopped line produces nothing; its chart stops with it rather than
  // filling up with empty intervals.
  const now = state.paused ? history.currentStart : Date.now();
  let next = history;
  if (good || rejected) {
    next = { ...next, current: { good: next.current.good + good, rejected: next.current.rejected + rejected } };
  }
  if (now - next.currentStart >= BUCKET_MS) {
    next = { buckets: [...next.buckets, next.current].slice(-BUCKETS), current: { good: 0, rejected: 0 }, currentStart: now };
  }
  if (next !== history) emit(next);
}
useStore.subscribe(onStore);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProductionHistory(): History {
  return useSyncExternalStore(subscribe, () => history);
}
