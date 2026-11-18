// Short rolling history of the line's output, for the dashboard screen:
// modules that passed and failed, per interval. Derived from the store's
// stream as it arrives, outside React, so the screen just reads the latest
// snapshot.
//
// Each module is counted in the interval in which it *reached its station*,
// worked out from its own spawn time and the belt speed, not in the interval
// in which the event happened to be delivered. A throttled tab or a slow
// frame delivers several seconds of events in one burst; bucketing by
// arrival piled them all into one fat bar. Passed and failed modules are
// both counted at the time they reach the end of the line (a failed one
// would have, had it not been pushed off), so every interval holds the same
// slice of the stream and no bar is ever more than one interval's worth.
//
// Time here is line time: the wall clock with every stop taken out, so a
// stopped line's chart stops with it rather than filling with empty bars.
import { useSyncExternalStore } from 'react';
import { STATION_S } from '@/scene/layout';
import { useStore, type LineModule, type StoreState } from '@/state/store';
import { BELT_SPEED, MODULE_INTERVAL_MS } from '@/streaming/lineConfig';

export const BUCKET_MS = 5_000;
export const BUCKETS = 24;
/** Modules a full interval holds at the line's cadence. */
export const MODULES_PER_BUCKET = BUCKET_MS / MODULE_INTERVAL_MS;

export interface Bucket {
  good: number;
  rejected: number;
}

interface History {
  /** Completed intervals, oldest first, always BUCKETS long. */
  buckets: Bucket[];
  /** The interval in progress. */
  current: Bucket;
  /** How far through the current interval the line is, 0-1. */
  progress: number;
}

const empty = (): Bucket => ({ good: 0, rejected: 0 });

/** Line time at which the stream epoch started, and stop bookkeeping. */
let epoch = Date.now();
let stoppedMs = 0;
let stoppedAt: number | null = null;
/** Counts per interval index since the epoch. */
let counts = new Map<number, Bucket>();

function lineNow(): number {
  const wall = stoppedAt ?? Date.now();
  return wall - epoch - stoppedMs;
}

/** Wall-clock arrival at arc length `s` for a module whose spawn time has
 *  already been shifted past every stop, in line time. Stops shift spawn
 *  times forward, so subtracting the stops so far lands on line time. */
function lineTimeAt(module: LineModule, s: number): number {
  return module.spawnedAt + (s / BELT_SPEED) * 1000 - epoch - stoppedMs;
}

function count(t: number, field: keyof Bucket) {
  const index = Math.floor(t / BUCKET_MS);
  const bucket = counts.get(index) ?? empty();
  bucket[field] += 1;
  counts.set(index, bucket);
}

function snapshot(): History {
  const now = lineNow();
  const index = Math.floor(now / BUCKET_MS);
  const buckets: Bucket[] = [];
  for (let i = index - BUCKETS; i < index; i++) buckets.push(counts.get(i) ?? empty());
  // Forget what has scrolled off.
  for (const key of counts.keys()) if (key < index - BUCKETS) counts.delete(key);
  return { buckets, current: counts.get(index) ?? empty(), progress: (now - index * BUCKET_MS) / BUCKET_MS };
}

let history: History = snapshot();
const listeners = new Set<() => void>();

function emit() {
  const next = snapshot();
  const same =
    next.progress === history.progress &&
    next.current.good === history.current.good &&
    next.current.rejected === history.current.rejected &&
    next.buckets.every((b, i) => b.good === history.buckets[i].good && b.rejected === history.buckets[i].rejected);
  if (same) return;
  history = next;
  listeners.forEach((l) => l());
}

function onStore(state: StoreState, prev: StoreState) {
  // A reset zeroes the counters: start the chart over with it.
  if (state.modulesPassed < prev.modulesPassed || state.modulesScrapped < prev.modulesScrapped) {
    epoch = Date.now();
    stoppedMs = 0;
    stoppedAt = state.paused ? epoch : null;
    counts = new Map();
    emit();
    return;
  }
  if (state.paused !== prev.paused) {
    if (state.paused) stoppedAt = state.pausedAt ?? Date.now();
    else if (stoppedAt !== null) {
      stoppedMs += Date.now() - stoppedAt;
      stoppedAt = null;
    }
  }
  if (state.modulesPassed > prev.modulesPassed) {
    // Shipped modules leave the list; find which ones went.
    const still = new Set(state.modules.map((m) => m.id));
    for (const m of prev.modules) if (!still.has(m.id) && m.scrappedAt === null) count(lineTimeAt(m, STATION_S.ship), 'good');
  }
  if (state.modulesScrapped > prev.modulesScrapped) {
    const was = new Map(prev.modules.map((m) => [m.id, m.scrappedAt]));
    for (const m of state.modules) if (m.scrappedAt !== null && was.get(m.id) === null) count(lineTimeAt(m, STATION_S.ship), 'rejected');
  }
}
useStore.subscribe(onStore);

// The chart scrolls on the line's clock, not only when an event arrives.
window.setInterval(emit, 250);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProductionHistory(): History {
  return useSyncExternalStore(subscribe, () => history);
}
