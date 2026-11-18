import { useSyncExternalStore } from 'react';
import { useStore, type Severity, type StoreState } from '@/state/store';
import { BROWNING_TOLERANCE, PROBLEM_MACHINE_ID } from '@/streaming/lineConfig';
import { channelSeverity, SENSOR_SPECS } from '@/streaming/sensorStream';
import { LINE_JOBS_PER_HOUR, projectShift } from '@/ui/businessCase';
import type { DashboardData } from './ui3d/dashboardData';
import { DashboardWall } from './ui3d/DashboardWall';

const TEMP_POINTS = 24;
const REJECT_BUCKETS = 8;
const BUCKET_MS = 10_000;
/** Average mass of a loaf, for turning rejects avoided into waste avoided. */
const LOAF_KG = 0.8;

const SPEC = SENSOR_SPECS[PROBLEM_MACHINE_ID].temperature;

interface History {
  temps: number[];
  /** Rejects counted in each completed bucket, oldest first. */
  buckets: number[];
  bucketStart: number;
  rejectedAtBucketStart: number;
  /** Waste the last closed incident avoided, kg. */
  avoidedKg: number;
}

function initialHistory(now: number): History {
  return { temps: Array(TEMP_POINTS).fill(SPEC.base), buckets: [], bucketStart: now, rejectedAtBucketStart: 0, avoidedKg: 0 };
}

// History is derived from the store's stream as it arrives, outside React,
// so components just read the latest snapshot.
let history = initialHistory(Date.now());
const listeners = new Set<() => void>();

function onStore(state: StoreState, prev: StoreState) {
  let next = history;
  if (state.loavesRejected < prev.loavesRejected) next = { ...initialHistory(state.sensorsAt), avoidedKg: next.avoidedKg };
  if (state.sensorsAt !== prev.sensorsAt) {
    next = { ...next, temps: [...next.temps.slice(1 - TEMP_POINTS), state.sensors[PROBLEM_MACHINE_ID].temperature] };
    if (state.sensorsAt - next.bucketStart >= BUCKET_MS) {
      next = {
        ...next,
        buckets: [...next.buckets, state.loavesRejected - next.rejectedAtBucketStart].slice(-(REJECT_BUCKETS - 1)),
        bucketStart: state.sensorsAt,
        rejectedAtBucketStart: state.loavesRejected,
      };
    }
  }
  const inc = state.incident;
  if (inc && inc.resolvedAt !== null && prev.incident?.resolvedAt !== inc.resolvedAt) {
    const shift = projectShift(inc.inspected, inc.rejected);
    if (shift) next = { ...next, avoidedKg: Math.round(Math.max(shift.loaves - inc.rejected, 0) * LOAF_KG) };
  }
  if (next !== history) {
    history = next;
    listeners.forEach((l) => l());
  }
}
useStore.subscribe(onStore);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const tone = (s: Severity): DashboardData['ovenTone'] => s;

/**
 * The dashboard wall, fed from the live stream: the oven's zone temperature,
 * throughput and line efficiency, rejects per interval, and the waste the
 * last stop avoided. The cards only redraw when a number actually changes.
 */
export function LiveDashboard() {
  const h = useSyncExternalStore(subscribe, () => history);
  const packed = useStore((s) => s.loavesPacked);
  const rejected = useStore((s) => s.loavesRejected);
  const trend = useStore((s) => s.machines[PROBLEM_MACHINE_ID].trend);
  const qualityStatus = useStore((s) => s.machines[PROBLEM_MACHINE_ID].status);

  const rejects = [...h.buckets, rejected - h.rejectedAtBucketStart];
  while (rejects.length < REJECT_BUCKETS) rejects.unshift(0);
  const total = packed + rejected;
  const efficiency = total ? packed / total : 1;
  // A bucket holds BUCKET_MS of line, one loaf per ~0.8s.
  const loavesPerBucket = BUCKET_MS / 800;
  const lastFull = h.buckets.at(-1) ?? 0;
  const temp = h.temps[h.temps.length - 1];

  const data: DashboardData = {
    ovenTemp: h.temps,
    ovenSetpoint: Array(TEMP_POINTS).fill(SPEC.base),
    ovenWarn: SPEC.warn,
    ovenCrit: SPEC.critical,
    ovenTone: tone(channelSeverity(PROBLEM_MACHINE_ID, 'temperature', temp)),
    loavesPerHour: Math.round(LINE_JOBS_PER_HOUR * efficiency),
    coreTemp: Math.round((96.5 + (trend / BROWNING_TOLERANCE) * 3.5) * 10) / 10,
    coreTempTone: tone(qualityStatus),
    efficiency,
    efficiencyLabel: 'Target 98%',
    rejects,
    rejectLabels: rejects.map((_, i) => (i === rejects.length - 1 ? 'now' : '')),
    rejectRate: Math.round(Math.min(lastFull / loavesPerBucket, 1) * 1000) / 10,
    rejectTone: tone(qualityStatus),
    wasteSavedKg: h.avoidedKg,
  };
  return <DashboardWall data={data} />;
}
