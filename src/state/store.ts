import { create } from 'zustand';
import {
  CRITICAL_TREND_MM,
  MIN_TREND_SAMPLES,
  PROBLEM_ROBOT_ID,
  REWORK_BAY_BASE_INDEX,
  REWORK_BAY_SLOTS,
  reworkBaySlot,
  ROBOT_IDS,
  ROBOT_LABELS,
  WARN_TREND_MM,
  type RobotId,
} from '@/streaming/lineConfig';
import {
  channelSeverity,
  initialSensorFrame,
  injectionId,
  SENSOR_CHANNELS,
  type FaultInjection,
  type SensorChannel,
  type SensorFrame,
} from '@/streaming/sensorStream';

export type Severity = 'healthy' | 'warning' | 'critical';

const SEVERITY_RANK: Record<Severity, number> = { healthy: 0, warning: 1, critical: 2 };

export function worstSeverity(...levels: Severity[]): Severity {
  return levels.reduce<Severity>((worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst), 'healthy');
}

export interface TrendSample {
  t: number;
  v: number;
}

export interface RobotState {
  id: RobotId;
  label: string;
  /** Derived from trendMm - there is no separate "set status" action, so it
   *  can never disagree with the number driving it. */
  status: Severity;
  /** Windowed mean |weld offset|, mm. */
  trendMm: number;
  history: TrendSample[];
  /** The most recent single weld's signed offset, mm. */
  lastDeviationMm: number | null;
  recalibrationRecommended: boolean;
  lastRecalibratedAt: number | null;
  /** Forward projection from the windowed slope: ms until the trend reaches
   *  the hard spec limit if nothing changes. Null when it isn't heading
   *  there. */
  projectedBreachMs: number | null;
}

/**
 * What QC knows about one car, and therefore what floats above it in the
 * 3D scene.
 *
 *  none - hasn't reached the weld station yet
 *  pass - welded inside spec
 *  fail - welded out of spec, pulled into the rework bay
 */
export type CarVerdict = 'none' | 'pass' | 'fail';

export interface ActiveCar {
  carId: string;
  spawnedAt: number;
  verdict: CarVerdict;
  /** Weld offset this car was measured at, once it has been welded. */
  deviationMm: number | null;
  /** 0..3 = docked at a station, EXIT_STATION_INDEX = rolling off the end,
   *  a reworkBaySlot() sentinel = parked in the rework bay. */
  stationIndex: number;
  /** Wall-clock ts this car arrived at its CURRENT stationIndex. */
  dockedAt: number;
}

export interface FeedItem {
  id: string;
  timestamp: number;
  text: string;
  tone: 'info' | 'warning' | 'critical' | 'success';
}

/**
 * The current incident, stamped at the moment each thing actually happened.
 * This is what the stop report and the autopilot summary are built from, so
 * every number the audience is shown is measured rather than asserted.
 */
export interface Incident {
  /** Ground zero: when the mechanical fault started. Only the story
   *  director knows this, because it is what causes it. */
  faultStartedAt: number;
  /** When the streaming pipeline first flagged WELD-01 as anything other
   *  than healthy - from its sensors or its weld trend, whichever was
   *  first. Null until then. */
  detectedAt: number | null;
  /** When the line was stopped while this incident was open. */
  stoppedAt: number | null;
  /** When the torch was recalibrated. Closes the incident. */
  resolvedAt: number | null;
  /** Welds made since the fault started, and how many of them failed. */
  welds: number;
  scrapped: number;
  /** Who closed it. */
  resolvedBy: 'operator' | 'autopilot' | null;
}

/** The autopilot's own account of an incident it closed, shown as a toast. */
export interface AutopilotCatch {
  at: number;
  detectMs: number;
  /** Alert to recalibration. */
  fixMs: number;
  scrapped: number;
}

const HISTORY_MAX = 90;
const FEED_MAX = 40;
const ACTIVE_CAR_MAX_AGE_MS = 60_000;

export function deriveStatus(trendMm: number): Severity {
  if (trendMm > CRITICAL_TREND_MM) return 'critical';
  if (trendMm > WARN_TREND_MM) return 'warning';
  return 'healthy';
}

function makeRobot(id: RobotId): RobotState {
  return {
    id,
    label: ROBOT_LABELS[id],
    status: 'healthy',
    trendMm: 0,
    history: [],
    lastDeviationMm: null,
    recalibrationRecommended: false,
    lastRecalibratedAt: null,
    projectedBreachMs: null,
  };
}

function makeInitialRobots(): Record<RobotId, RobotState> {
  return Object.fromEntries(ROBOT_IDS.map((id) => [id, makeRobot(id)])) as Record<RobotId, RobotState>;
}

/** WELD-01's overall condition: the worst of its weld trend and its own
 *  process sensors. One definition, used by the machine cards, the plant
 *  view's station marker, detection and the autopilot, so none of them can
 *  disagree about whether the machine is healthy. */
export function machineSeverity(state: Pick<StoreState, 'robots' | 'sensors'>, robotId: RobotId): Severity {
  const reading = state.sensors[robotId];
  return worstSeverity(
    state.robots[robotId].status,
    ...SENSOR_CHANNELS.map((channel) => channelSeverity(channel, reading[channel])),
  );
}

/** Stamp detection the first time the machine leaves healthy during an open
 *  incident. */
function withDetection(state: StoreState, next: Partial<StoreState>, now: number): Partial<StoreState> {
  const incident = state.incident;
  if (!incident || incident.detectedAt !== null || incident.resolvedAt !== null) return next;
  const merged = { robots: next.robots ?? state.robots, sensors: next.sensors ?? state.sensors };
  if (machineSeverity(merged, PROBLEM_ROBOT_ID) === 'healthy') return next;
  const latencyMs = now - incident.faultStartedAt;
  const feedItem: FeedItem = {
    id: `detect-${now}`,
    timestamp: now,
    text: `${PROBLEM_ROBOT_ID} anomaly detected ${latencyMs < 100 ? '<0.1' : (latencyMs / 1000).toFixed(1)}s after onset`,
    tone: 'warning',
  };
  return {
    ...next,
    incident: { ...incident, detectedAt: now },
    feed: [feedItem, ...(next.feed ?? state.feed)].slice(0, FEED_MAX),
  };
}

interface QCCheckPayload {
  robot_id: RobotId;
  car_id: string;
  timestamp: number;
  suspect: boolean;
  deviation_mm: number;
}

interface WindowStatsPayload {
  robot_id: RobotId;
  timestamp: number;
  trendMm: number;
  sampleCount: number;
  projectedBreachMs: number | null;
}

interface ActionPayload {
  robot_id: RobotId;
  timestamp: number;
  action: 'drift_warning' | 'drift_critical' | 'drift_cleared';
}

export interface StoreState {
  robots: Record<RobotId, RobotState>;
  activeCars: ActiveCar[];
  feed: FeedItem[];

  /** The line is stopped. Freezes the conveyor, the arms and the analyzer
   *  window together. */
  paused: boolean;
  /** Standing policy: the moment the pipeline flags WELD-01, recalibrate it
   *  without waiting for anyone. Deliberately not cleared by reset(): it is
   *  a rule the line now runs under. */
  autopilot: boolean;

  carsBuilt: number;
  carsScrapped: number;
  /** Null until the presenter injects a deviation. */
  incident: Incident | null;
  autopilotCatch: AutopilotCatch | null;

  shortcutOverlayOpen: boolean;

  /** Latest process-sensor frame for all four machines. */
  sensors: SensorFrame;
  /** Wall clock of the last frame published. */
  sensorsAt: number;
  /** Faults riding on top of that stream, one per machine+channel pair. */
  injections: FaultInjection[];
  /** Running totals for the fault panel's pipeline readout. */
  sensorPipeline: { readings: number; anomalies: number };
  faultPanelOpen: boolean;

  // ---- ingestion actions - called only from state/engine.ts ----
  ingestCarSpawn: (carId: string, timestamp: number) => void;
  advanceCar: (carId: string, stationIndex: number, timestamp: number) => void;
  /** A failed car leaves the line for the rework bay. */
  ingestCarRework: (carId: string, timestamp: number) => void;
  ingestCarExit: (carId: string, timestamp: number) => void;
  /** Shifts every active car's `dockedAt` forward by the same duration the
   * conveyor's own schedule was shifted on resume, so a stopped mid-dwell
   * animation doesn't jump the instant the line restarts. */
  shiftDockedTimestamps: (deltaMs: number) => void;
  ingestQCCheck: (event: QCCheckPayload) => void;
  ingestWindowStats: (event: WindowStatsPayload) => void;
  ingestAction: (event: ActionPayload) => void;
  ingestSensorFrame: (frame: SensorFrame, timestamp: number) => void;

  // ---- scenario actions - called only from state/storyDirector.ts ----
  openIncident: (timestamp: number, text: string) => void;
  markRecalibrated: (robotId: RobotId, timestamp: number, by: 'operator' | 'autopilot') => void;

  // ---- UI actions ----
  setPaused: (paused: boolean) => void;
  setAutopilot: (on: boolean) => void;
  dismissAutopilotCatch: () => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  injectFaults: (
    robotIds: readonly RobotId[],
    channels: readonly SensorChannel[],
    intensity: number,
    source?: FaultInjection['source'],
  ) => void;
  clearInjection: (id: string) => void;
  clearInjections: (source?: FaultInjection['source']) => void;
  setFaultPanelOpen: (open: boolean) => void;
  reset: () => void;
}

function feed(state: StoreState, item: FeedItem): FeedItem[] {
  return [item, ...state.feed].slice(0, FEED_MAX);
}

export const useStore = create<StoreState>((set) => ({
  robots: makeInitialRobots(),
  activeCars: [],
  feed: [],

  paused: false,
  autopilot: false,

  carsBuilt: 0,
  carsScrapped: 0,
  incident: null,
  autopilotCatch: null,

  shortcutOverlayOpen: false,

  sensors: initialSensorFrame(),
  sensorsAt: Date.now(),
  injections: [],
  sensorPipeline: { readings: 0, anomalies: 0 },
  faultPanelOpen: false,

  ingestCarSpawn: (carId, timestamp) =>
    set((state) => {
      // Parked rework cars are exempt from the age prune: they sit in the
      // bay until a newer reject pushes them out. Only cars still moving
      // down the line can go stale.
      const cutoff = timestamp - ACTIVE_CAR_MAX_AGE_MS;
      const activeCars = state.activeCars.filter(
        (c) => c.spawnedAt >= cutoff || reworkBaySlot(c.stationIndex) !== null,
      );
      activeCars.push({
        carId,
        spawnedAt: timestamp,
        verdict: 'none',
        deviationMm: null,
        stationIndex: 0,
        dockedAt: timestamp,
      });
      return { activeCars };
    }),

  advanceCar: (carId, stationIndex, timestamp) =>
    set((state) => ({
      activeCars: state.activeCars.map((c) => (c.carId === carId ? { ...c, stationIndex, dockedAt: timestamp } : c)),
    })),

  // Newest reject takes slot 0, nearest the weld station; older ones shuffle
  // one slot along and whatever falls off the end leaves the scene.
  ingestCarRework: (carId, timestamp) =>
    set((state) => {
      const bay = state.activeCars
        .filter((c) => reworkBaySlot(c.stationIndex) !== null)
        .sort((a, b) => reworkBaySlot(a.stationIndex)! - reworkBaySlot(b.stationIndex)!);
      const keep = bay.slice(0, REWORK_BAY_SLOTS - 1);
      const evicted = new Set(bay.slice(REWORK_BAY_SLOTS - 1).map((c) => c.carId));
      const shifted = new Map(keep.map((c, i) => [c.carId, REWORK_BAY_BASE_INDEX - (i + 1)]));
      return {
        activeCars: state.activeCars
          .filter((c) => !evicted.has(c.carId))
          .map((c) => {
            if (c.carId === carId) return { ...c, stationIndex: REWORK_BAY_BASE_INDEX, dockedAt: timestamp };
            const next = shifted.get(c.carId);
            return next === undefined ? c : { ...c, stationIndex: next, dockedAt: timestamp };
          }),
      };
    }),

  ingestCarExit: (carId) =>
    set((state) => ({
      carsBuilt: state.carsBuilt + 1,
      activeCars: state.activeCars.filter((c) => c.carId !== carId),
    })),

  shiftDockedTimestamps: (deltaMs) =>
    set((state) => ({
      activeCars: state.activeCars.map((c) => ({ ...c, dockedAt: c.dockedAt + deltaMs })),
    })),

  ingestQCCheck: (event) =>
    set((state) => {
      const robot = state.robots[event.robot_id];
      const activeCars = state.activeCars.map((c) =>
        c.carId === event.car_id
          ? { ...c, verdict: (event.suspect ? 'fail' : 'pass') as CarVerdict, deviationMm: event.deviation_mm }
          : c,
      );
      const incident =
        state.incident && state.incident.resolvedAt === null
          ? {
              ...state.incident,
              welds: state.incident.welds + 1,
              scrapped: state.incident.scrapped + (event.suspect ? 1 : 0),
            }
          : state.incident;
      const robots = { ...state.robots, [event.robot_id]: { ...robot, lastDeviationMm: event.deviation_mm } };
      if (!event.suspect) return { activeCars, incident, robots };
      return {
        activeCars,
        incident,
        robots,
        carsScrapped: state.carsScrapped + 1,
        feed: feed(state, {
          id: `${event.car_id}-qc`,
          timestamp: event.timestamp,
          text: `Car ${event.car_id.slice(0, 4).toUpperCase()} failed weld QC (${event.deviation_mm > 0 ? '+' : ''}${event.deviation_mm.toFixed(2)}mm) - pulled for rework`,
          tone: 'critical',
        }),
      };
    }),

  ingestWindowStats: (event) =>
    set((state) => {
      const robot = state.robots[event.robot_id];
      const history = [...robot.history, { t: event.timestamp, v: event.trendMm }].slice(-HISTORY_MAX);
      // Too few samples to trust the average yet - a fresh robot shouldn't
      // be able to flash "critical" off a single weld. Mirrors
      // DriftAnalyzer's own action gating.
      const status = event.sampleCount >= MIN_TREND_SAMPLES ? deriveStatus(event.trendMm) : 'healthy';
      const robots = {
        ...state.robots,
        [event.robot_id]: { ...robot, trendMm: event.trendMm, status, history, projectedBreachMs: event.projectedBreachMs },
      };
      return withDetection(state, { robots }, event.timestamp);
    }),

  ingestAction: (event) =>
    set((state) => {
      const robot = state.robots[event.robot_id];
      const recalibrationRecommended = event.action !== 'drift_cleared';
      const text = {
        drift_warning: `${event.robot_id} weld offset drifting - trending toward spec limit`,
        drift_critical: `${event.robot_id} weld offset critical - stop and recalibrate`,
        drift_cleared: `${event.robot_id} weld offset back inside limits`,
      }[event.action];
      const tone = ({ drift_warning: 'warning', drift_critical: 'critical', drift_cleared: 'success' } as const)[
        event.action
      ];
      return {
        robots: { ...state.robots, [event.robot_id]: { ...robot, recalibrationRecommended } },
        feed: feed(state, { id: `${event.robot_id}-${event.action}-${event.timestamp}`, timestamp: event.timestamp, text, tone }),
      };
    }),

  ingestSensorFrame: (frame, timestamp) =>
    set((state) => {
      let anomalies = 0;
      for (const robotId of ROBOT_IDS) {
        for (const channel of SENSOR_CHANNELS) {
          if (channelSeverity(channel, frame[robotId][channel]) !== 'healthy') anomalies += 1;
        }
      }
      return withDetection(
        state,
        {
          sensors: frame,
          sensorsAt: timestamp,
          sensorPipeline: {
            readings: state.sensorPipeline.readings + ROBOT_IDS.length * SENSOR_CHANNELS.length,
            anomalies: state.sensorPipeline.anomalies + anomalies,
          },
        },
        timestamp,
      );
    }),

  openIncident: (timestamp, text) =>
    set((state) => {
      // A second key press while an incident is still open escalates it
      // rather than restarting the clock: the fault began when it began.
      const open = state.incident && state.incident.resolvedAt === null;
      return {
        incident: open
          ? state.incident
          : {
              faultStartedAt: timestamp,
              detectedAt: null,
              stoppedAt: null,
              resolvedAt: null,
              welds: 0,
              scrapped: 0,
              resolvedBy: null,
            },
        autopilotCatch: null,
        feed: feed(state, { id: `fault-${timestamp}`, timestamp, text, tone: 'info' }),
      };
    }),

  markRecalibrated: (robotId, timestamp, by) =>
    set((state) => {
      const incident =
        state.incident && state.incident.resolvedAt === null
          ? { ...state.incident, resolvedAt: timestamp, resolvedBy: by }
          : state.incident;
      const autopilotCatch =
        by === 'autopilot' && incident && incident.detectedAt !== null
          ? {
              at: timestamp,
              detectMs: incident.detectedAt - incident.faultStartedAt,
              fixMs: timestamp - incident.detectedAt,
              scrapped: incident.scrapped,
            }
          : state.autopilotCatch;
      return {
        incident,
        autopilotCatch,
        robots: { ...state.robots, [robotId]: { ...makeRobot(robotId), history: state.robots[robotId].history, lastRecalibratedAt: timestamp } },
        feed: feed(state, {
          id: `${robotId}-recal-${timestamp}`,
          timestamp,
          text:
            by === 'autopilot'
              ? `Autopilot recalibrated ${robotId} - torch back on the seam`
              : `${robotId} recalibrated - torch back on the seam`,
          tone: 'success',
        }),
      };
    }),

  setPaused: (paused) =>
    set((state) => {
      if (paused === state.paused) return state;
      const now = Date.now();
      const incident =
        paused && state.incident && state.incident.resolvedAt === null && state.incident.stoppedAt === null
          ? { ...state.incident, stoppedAt: now }
          : state.incident;
      return {
        paused,
        incident,
        feed: feed(state, {
          id: `line-${paused ? 'stop' : 'start'}-${now}`,
          timestamp: now,
          text: paused ? 'Line stopped by operator' : state.autopilot ? 'Line restarted on autopilot' : 'Line restarted',
          tone: paused ? 'critical' : 'info',
        }),
      };
    }),
  setAutopilot: (on) => set({ autopilot: on }),
  dismissAutopilotCatch: () => set({ autopilotCatch: null }),
  setShortcutOverlayOpen: (open) => set({ shortcutOverlayOpen: open }),

  injectFaults: (robotIds, channels, intensity, source = 'manual') =>
    set((state) => {
      const now = Date.now();
      const next = new Map(state.injections.map((injection) => [injection.id, injection]));
      for (const robotId of robotIds) {
        for (const channel of channels) {
          const id = injectionId(robotId, channel);
          // Re-injecting a pair retunes it in place and keeps its original
          // start time, so "running for 2m 10s" doesn't reset because the
          // intensity was nudged.
          const startedAt = next.get(id)?.startedAt ?? now;
          next.set(id, { id, robotId, channel, intensity, startedAt, source });
        }
      }
      return { injections: [...next.values()] };
    }),

  clearInjection: (id) => set((state) => ({ injections: state.injections.filter((i) => i.id !== id) })),
  clearInjections: (source) =>
    set((state) => ({ injections: source ? state.injections.filter((i) => i.source !== source) : [] })),
  setFaultPanelOpen: (open) => set({ faultPanelOpen: open }),

  // autopilot is deliberately kept - see its field comment.
  reset: () =>
    set({
      robots: makeInitialRobots(),
      activeCars: [],
      feed: [],
      paused: false,
      carsBuilt: 0,
      carsScrapped: 0,
      incident: null,
      autopilotCatch: null,
      sensors: initialSensorFrame(),
      sensorsAt: Date.now(),
      injections: [],
      sensorPipeline: { readings: 0, anomalies: 0 },
    }),
}));
