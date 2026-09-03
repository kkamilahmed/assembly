import { create } from 'zustand';
import {
  CRITICAL_TREND_MM,
  MIN_TREND_SAMPLES,
  ROBOT_IDS,
  ROBOT_LABELS,
  WARN_TREND_MM,
  type RobotId,
} from '@/streaming/lineConfig';

export type Severity = 'healthy' | 'warning' | 'critical';

export interface TrendSample {
  t: number;
  v: number;
}

export interface RobotState {
  id: RobotId;
  label: string;
  /** Purely derived from displayedTrendMm below — there is no separate
   * "set status" action, so it can never drift out of sync with the
   * number actually driving it. */
  status: Severity;
  /** What the operator dashboard shows: tracks ground truth live when
   * live vision QC is on; freezes between samples when it's off. */
  displayedTrendMm: number;
  history: TrendSample[];
  /** The silent, always-on ground-truth trend — never shown directly,
   * only used for the eventual reveal. */
  groundTruthHistory: TrendSample[];
  lastWeldAt: number | null;
  recalibrationRecommended: boolean;
  lastRecalibratedAt: number | null;
}

export interface ActiveCar {
  carId: string;
  spawnedAt: number;
  flaggedRobotId: RobotId | null;
  /** Which walking-beam slot this car currently occupies: 0..3 = docked at
   * a station, EXIT_STATION_INDEX = the one-cycle exit-lane holding cell,
   * SIDING_STATION_INDEX = parked on the rework siding (see lineConfig.ts). */
  stationIndex: number;
  /** Wall-clock ts this car arrived at its CURRENT stationIndex. */
  dockedAt: number;
}

export interface ReworkItem {
  id: string;
  carId: string;
  robotId: RobotId;
  timestamp: number;
  deviationMm: number;
}

export interface FeedItem {
  id: string;
  timestamp: number;
  text: string;
  tone: 'info' | 'warning' | 'critical' | 'success';
}

export interface RecoveryReveal {
  gap: number;
  expiresAt: number;
}

const HISTORY_MAX = 90;
const FEED_MAX = 40;
const REWORK_MAX = 12;
const ACTIVE_CAR_MAX_AGE_MS = 45_000;

export function deriveStatus(displayedTrendMm: number): Severity {
  if (displayedTrendMm > CRITICAL_TREND_MM) return 'critical';
  if (displayedTrendMm > WARN_TREND_MM) return 'warning';
  return 'healthy';
}

function makeInitialRobots(): Record<RobotId, RobotState> {
  return Object.fromEntries(
    ROBOT_IDS.map((id) => [
      id,
      {
        id,
        label: ROBOT_LABELS[id],
        status: 'healthy',
        displayedTrendMm: 0,
        history: [],
        groundTruthHistory: [],
        lastWeldAt: null,
        recalibrationRecommended: false,
        lastRecalibratedAt: null,
      } satisfies RobotState,
    ]),
  ) as unknown as Record<RobotId, RobotState>;
}

interface GroundTruthPayload {
  robot_id: RobotId;
  timestamp: number;
}

interface QCCheckPayload {
  robot_id: RobotId;
  car_id: string;
  timestamp: number;
  suspect: boolean;
  deviation_mm: number;
  inspectionMode: 'live' | 'sampled';
}

interface WindowStatsPayload {
  robot_id: RobotId;
  timestamp: number;
  groundTruthTrendMm: number;
  displayedTrendMm: number;
  sampleCount: number;
}

interface ActionPayload {
  robot_id: RobotId;
  timestamp: number;
  action: 'drift_warning' | 'drift_critical' | 'drift_cleared';
  reason: string;
}

interface StoreState {
  robots: Record<RobotId, RobotState>;
  activeCars: ActiveCar[];
  reworkQueue: ReworkItem[];
  feed: FeedItem[];

  liveVisionQC: boolean;
  paused: boolean;

  carsBuilt: number;
  suspectWeldsGroundTruth: number;
  suspectWeldsCaught: number;
  recoveryReveal: RecoveryReveal | null;

  selectedRobotId: RobotId | null;
  shortcutOverlayOpen: boolean;

  // ---- ingestion actions — called only from state/engine.ts ----
  ingestCarSpawn: (carId: string, timestamp: number) => void;
  advanceCar: (carId: string, stationIndex: number, timestamp: number) => void;
  ingestCarExit: (carId: string, timestamp: number) => void;
  /** Shifts every active car's `dockedAt` forward by the same duration the
   * conveyor's own schedule was shifted on resume, so a paused mid-dwell
   * animation doesn't jump the instant the line resumes. */
  shiftDockedTimestamps: (deltaMs: number) => void;
  ingestGroundTruth: (weld: GroundTruthPayload, suspect: boolean) => void;
  ingestQCCheck: (event: QCCheckPayload) => void;
  ingestWindowStats: (event: WindowStatsPayload) => void;
  ingestAction: (event: ActionPayload) => void;
  markRecalibrated: (robotId: RobotId, timestamp: number) => void;
  setRecoveryReveal: (reveal: RecoveryReveal | null) => void;

  // ---- UI actions ----
  toggleLiveVisionQC: () => void;
  togglePause: () => void;
  setSelectedRobot: (id: RobotId | null) => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  robots: makeInitialRobots(),
  activeCars: [],
  reworkQueue: [],
  feed: [],

  liveVisionQC: true,
  paused: false,

  carsBuilt: 0,
  suspectWeldsGroundTruth: 0,
  suspectWeldsCaught: 0,
  recoveryReveal: null,

  selectedRobotId: null,
  shortcutOverlayOpen: false,

  ingestCarSpawn: (carId, timestamp) =>
    set((state) => {
      const cutoff = timestamp - ACTIVE_CAR_MAX_AGE_MS;
      const activeCars = state.activeCars.filter((c) => c.spawnedAt >= cutoff);
      activeCars.push({ carId, spawnedAt: timestamp, flaggedRobotId: null, stationIndex: 0, dockedAt: timestamp });
      return { activeCars };
    }),

  advanceCar: (carId, stationIndex, timestamp) =>
    set((state) => ({
      activeCars: state.activeCars.map((c) => (c.carId === carId ? { ...c, stationIndex, dockedAt: timestamp } : c)),
    })),

  ingestCarExit: (carId, _timestamp) =>
    set((state) => ({
      carsBuilt: state.carsBuilt + 1,
      activeCars: state.activeCars.filter((c) => c.carId !== carId),
    })),

  shiftDockedTimestamps: (deltaMs) =>
    set((state) => ({
      activeCars: state.activeCars.map((c) => ({ ...c, dockedAt: c.dockedAt + deltaMs })),
    })),

  ingestGroundTruth: (weld, suspect) =>
    set((state) => {
      const robot = state.robots[weld.robot_id];
      if (!robot) return state;
      return {
        suspectWeldsGroundTruth: state.suspectWeldsGroundTruth + (suspect ? 1 : 0),
        robots: { ...state.robots, [weld.robot_id]: { ...robot, lastWeldAt: weld.timestamp } },
      };
    }),

  ingestQCCheck: (event) =>
    set((state) => {
      if (!event.suspect) return state;
      const item: ReworkItem = {
        id: `${event.car_id}-${event.robot_id}`,
        carId: event.car_id,
        robotId: event.robot_id,
        timestamp: event.timestamp,
        deviationMm: event.deviation_mm,
      };
      const activeCars = state.activeCars.map((c) =>
        c.carId === event.car_id ? { ...c, flaggedRobotId: event.robot_id } : c,
      );
      const feedItem: FeedItem = {
        id: `${event.car_id}-${event.robot_id}-qc-${event.timestamp}`,
        timestamp: event.timestamp,
        text: `${event.robot_id} pulled car ${event.car_id.slice(0, 6)} for rework (${
          event.inspectionMode === 'sampled' ? 'spot check' : 'live QC'
        }, ${event.deviation_mm > 0 ? '+' : ''}${event.deviation_mm.toFixed(2)}mm)`,
        tone: 'warning',
      };
      return {
        suspectWeldsCaught: state.suspectWeldsCaught + 1,
        reworkQueue: [item, ...state.reworkQueue].slice(0, REWORK_MAX),
        activeCars,
        feed: [feedItem, ...state.feed].slice(0, FEED_MAX),
      };
    }),

  ingestWindowStats: (event) =>
    set((state) => {
      const robot = state.robots[event.robot_id];
      if (!robot) return state;
      const history = [...robot.history, { t: event.timestamp, v: event.displayedTrendMm }].slice(-HISTORY_MAX);
      const groundTruthHistory = [...robot.groundTruthHistory, { t: event.timestamp, v: event.groundTruthTrendMm }].slice(
        -HISTORY_MAX,
      );
      // Too few samples to trust the average yet — a fresh robot (or one
      // just past a mode switch) shouldn't be able to flash "critical" off
      // a single noisy weld. Mirrors DriftAnalyzer's own action gating.
      const status = event.sampleCount >= MIN_TREND_SAMPLES ? deriveStatus(event.displayedTrendMm) : 'healthy';
      return {
        robots: {
          ...state.robots,
          [event.robot_id]: {
            ...robot,
            displayedTrendMm: event.displayedTrendMm,
            status,
            history,
            groundTruthHistory,
          },
        },
      };
    }),

  ingestAction: (event) =>
    set((state) => {
      // The analyzer keeps computing this regardless — it's only ever
      // surfaced to the feed while someone's actually watching. This is
      // the silent-decisioning mechanic: turning monitoring off doesn't
      // stop the analysis, it stops the analysis from reaching anyone.
      if (!state.liveVisionQC) return state;
      const robot = state.robots[event.robot_id];
      if (!robot) return state;
      const recalibrationRecommended =
        event.action === 'drift_critical' ? true : event.action === 'drift_cleared' ? false : robot.recalibrationRecommended;
      const toneMap = { drift_warning: 'warning', drift_critical: 'critical', drift_cleared: 'success' } as const;
      const textMap = {
        drift_warning: `${event.robot_id} trending toward tolerance — early warning`,
        drift_critical: `${event.robot_id} drift critical — recalibration recommended`,
        drift_cleared: `${event.robot_id} recovered to healthy`,
      } as const;
      const feedItem: FeedItem = {
        id: `${event.robot_id}-${event.action}-${event.timestamp}`,
        timestamp: event.timestamp,
        text: textMap[event.action],
        tone: toneMap[event.action],
      };
      return {
        robots: { ...state.robots, [event.robot_id]: { ...robot, recalibrationRecommended } },
        feed: [feedItem, ...state.feed].slice(0, FEED_MAX),
      };
    }),

  markRecalibrated: (robotId, timestamp) =>
    set((state) => {
      const robot = state.robots[robotId];
      if (!robot) return state;
      const feedItem: FeedItem = {
        id: `${robotId}-recal-${timestamp}`,
        timestamp,
        text: `${robotId} recalibrated — tool-center-point reset`,
        tone: 'success',
      };
      return {
        robots: { ...state.robots, [robotId]: { ...robot, recalibrationRecommended: false, lastRecalibratedAt: timestamp } },
        feed: [feedItem, ...state.feed].slice(0, FEED_MAX),
      };
    }),

  setRecoveryReveal: (reveal) => set({ recoveryReveal: reveal }),

  toggleLiveVisionQC: () => set((state) => ({ liveVisionQC: !state.liveVisionQC })),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  setSelectedRobot: (id) => set({ selectedRobotId: id }),
  setShortcutOverlayOpen: (open) => set({ shortcutOverlayOpen: open }),

  reset: () =>
    set({
      robots: makeInitialRobots(),
      activeCars: [],
      reworkQueue: [],
      feed: [],
      liveVisionQC: true,
      paused: false,
      carsBuilt: 0,
      suspectWeldsGroundTruth: 0,
      suspectWeldsCaught: 0,
      recoveryReveal: null,
      selectedRobotId: null,
    }),
}));
