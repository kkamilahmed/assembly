// Short rolling history of the line's output, for the dashboard screen:
// passed and rejected trays per interval. Derived from the store's outcome
// log, which stamps every tray with the moment inspection judged it, on the
// line's own clock. Bucketing by those stamps, not by when an update
// happened to arrive, means a tab that stalls for a few seconds cannot pile
// several intervals into one fat bar, and a stopped line adds nothing.
import { useSyncExternalStore } from 'react';
import { useStore, type StoreState } from '@/state/store';

export const BUCKET_MS = 5_000;
export const BUCKETS = 24;

export interface Bucket {
  good: number;
  rejected: number;
}

interface History {
  /** Completed intervals, oldest first, always BUCKETS long. */
  buckets: Bucket[];
  /** The interval in progress, and how far through it the line is (0-1). */
  current: Bucket;
  progress: number;
}

function derive(state: StoreState): History {
  const wall = state.paused && state.pausedAt !== null ? state.pausedAt : Date.now();
  const now = wall - state.stoppedMs;
  const index = Math.floor(now / BUCKET_MS);
  const first = index - BUCKETS;
  const buckets: Bucket[] = Array.from({ length: BUCKETS }, () => ({ good: 0, rejected: 0 }));
  const current: Bucket = { good: 0, rejected: 0 };
  for (const o of state.outcomes) {
    const i = Math.floor(o.t / BUCKET_MS);
    const b = i >= index ? current : i >= first ? buckets[i - first] : null;
    if (!b) continue;
    if (o.ok) b.good += 1;
    else b.rejected += 1;
  }
  return { buckets, current, progress: (now - index * BUCKET_MS) / BUCKET_MS };
}

let history: History = derive(useStore.getState());
const listeners = new Set<() => void>();

function same(a: Bucket, b: Bucket) {
  return a.good === b.good && a.rejected === b.rejected;
}

useStore.subscribe((state) => {
  const next = derive(state);
  // Keep the snapshot stable while nothing visible changed, so the
  // dashboard only re-renders when a bar moves.
  const changed =
    !same(next.current, history.current) ||
    next.buckets.some((b, i) => !same(b, history.buckets[i])) ||
    Math.abs(next.progress - history.progress) > 0.2;
  if (!changed) return;
  history = next;
  listeners.forEach((l) => l());
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProductionHistory(): History {
  return useSyncExternalStore(subscribe, () => history);
}
