import { create } from 'zustand';
import {
  SHIPPED_BAY_BASE_INDEX,
  SHIPPED_BAY_SLOTS,
  SIDING_STATION_INDEX,
  shippedBaySlot,
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
  /** Forward projection from the windowed slope: ms until this robot's
   * trend reaches the hard spec limit if nothing changes. Null when it
   * isn't trending toward one. Only ever surfaced while inspection is
   * live — a spot-check regime has no window to fit a slope over. */
  projectedBreachMs: number | null;
}

/**
 * What the line publicly "knows" about one car's weld, and therefore what
 * floats above it in the 3D scene. This is the whole demo made visible: the
 * argument was previously only legible as numbers in a sidebar chart, so an
 * audience watching the line itself saw nothing wrong at any point.
 *
 *  none        - hasn't reached the weld station yet
 *  pass        - inspected, inside spec
 *  fail        - inspected, out of spec, diverted to the rework siding
 *  uninspected - went through the weld station and NOBODY LOOKED. The whole
 *                point: under spot checks this is 6 cars out of every 7, and
 *                it is visibly indistinguishable from `pass` at the time.
 *  revealed    - was `uninspected`, and ground truth says it was bad. Only
 *                ever set retroactively, when inspection is switched back
 *                on, so the audience watches cars they already saw leave
 *                turn red.
 */
export type CarVerdict = 'none' | 'pass' | 'fail' | 'uninspected' | 'revealed';

export interface ActiveCar {
  carId: string;
  spawnedAt: number;
  flaggedRobotId: RobotId | null;
  verdict: CarVerdict;
  /** The true measurement, computed for every car whether or not anyone
   *  inspected it. Never drives the tag directly — only the reveal. */
  trueSuspect: boolean;
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
  /** Suspect welds that shipped uninspected during THIS off-period only —
   * not the session running total. Re-toggling must not re-bill you for a
   * gap you were already shown. */
  gap: number;
  /** How long inspection was off, ms. */
  durationMs: number;
}

/**
 * Detection latency for the current incident — the numbers that make the
 * real-time argument concrete instead of rhetorical. Every field is a
 * wall-clock stamp of something that genuinely happened, recorded at the
 * moment it happened; nothing here is reconstructed afterwards.
 */
export interface IncidentTiming {
  /** Ground zero: when the mechanical fault actually started. Only the
   * story director knows this, because it's what causes it. */
  faultStartedAt: number | null;
  /** When an alert first *reached a human* — gated on inspection actually
   * being live, so switching to spot checks genuinely delays this. */
  detectedAt: number | null;
  /** When the first genuinely out-of-spec weld left the station, whether
   * or not anyone noticed. */
  firstDefectAt: number | null;
  /** Suspect welds already shipped at the moment of detection. Zero is the
   * whole point of the streaming case. */
  defectsBeforeDetection: number;
  resolvedAt: number | null;
}

function emptyIncident(): IncidentTiming {
  return {
    faultStartedAt: null,
    detectedAt: null,
    firstDefectAt: null,
    defectsBeforeDetection: 0,
    resolvedAt: null,
  };
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
        projectedBreachMs: null,
      } satisfies RobotState,
    ]),
  ) as unknown as Record<RobotId, RobotState>;
}

interface GroundTruthPayload {
  robot_id: RobotId;
  car_id: string;
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
  trendSlopeMmPerSec: number;
  projectedBreachMs: number | null;
  weldsUntilNextInspection: number | null;
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
  /** How many more welds pass uninspected before the next periodic manual
   * check. Null while every weld is inspected. Surfaced in the top bar so
   * the blind window is something you can watch tick down, rather than a
   * fact you have to be told. */
  weldsUntilNextInspection: number | null;
  paused: boolean;
  /** Standing policy, set from the incident-replay screen: recalibrate a
   * robot automatically the instant it crosses drift-critical, instead of
   * waiting for a manual click. Deliberately NOT cleared by reset() — it's
   * meant to persist as "a rule the line now runs under," so re-triggering
   * the drift scenario after enabling it proves the policy actually works. */
  autoRecalibrate: boolean;

  carsBuilt: number;
  suspectWeldsGroundTruth: number;
  suspectWeldsCaught: number;
  recoveryReveal: RecoveryReveal | null;
  incident: IncidentTiming;
  /** Counter snapshot + wall-clock taken the moment inspection dropped to
   * spot checks, so the reveal can bill exactly this off-period. */
  qcOffSince: { at: number; groundTruthAt: number; caughtAt: number } | null;

  selectedRobotId: RobotId | null;
  shortcutOverlayOpen: boolean;
  replayOpen: boolean;
  /** Which keynote act was last staged, for the presenter cue card. Null
   *  until an act key is pressed — the demo runs perfectly well without
   *  presenter mode ever being touched. */
  presenterAct: number | null;
  presenterCueOpen: boolean;

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
  /** Flip every car that went through uninspected AND was genuinely bad
   *  from its grey question mark to red. Called when inspection is switched
   *  back on: the count in the banner is the abstract version of this, and
   *  this is the version you can point at. */
  revealUninspectedDefects: () => void;
  /** Called by the story director at the instant it starts ramping a
   * robot's mechanical bias — ground zero for every latency number. */
  markFaultStarted: (robotId: RobotId, timestamp: number) => void;

  // ---- UI actions ----
  toggleLiveVisionQC: () => void;
  togglePause: () => void;
  toggleAutoRecalibrate: () => void;
  setSelectedRobot: (id: RobotId | null) => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  setReplayOpen: (open: boolean) => void;
  setPresenterAct: (n: number | null) => void;
  setPresenterCueOpen: (open: boolean) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  robots: makeInitialRobots(),
  activeCars: [],
  reworkQueue: [],
  feed: [],

  liveVisionQC: true,
  weldsUntilNextInspection: null,
  paused: false,
  autoRecalibrate: false,

  carsBuilt: 0,
  suspectWeldsGroundTruth: 0,
  suspectWeldsCaught: 0,
  recoveryReveal: null,
  incident: emptyIncident(),
  qcOffSince: null,

  selectedRobotId: null,
  shortcutOverlayOpen: false,
  replayOpen: false,
  presenterAct: null,
  presenterCueOpen: false,

  ingestCarSpawn: (carId, timestamp) =>
    set((state) => {
      // Parked cars are exempt from the age prune: a bay car is meant to
      // sit there until a newer one pushes it out, and the siding is a
      // holding area too. Only cars still moving down the line can go
      // stale.
      const cutoff = timestamp - ACTIVE_CAR_MAX_AGE_MS;
      const activeCars = state.activeCars.filter(
        (c) =>
          c.spawnedAt >= cutoff ||
          c.stationIndex === SIDING_STATION_INDEX ||
          shippedBaySlot(c.stationIndex) !== null,
      );
      activeCars.push({
        carId,
        spawnedAt: timestamp,
        flaggedRobotId: null,
        verdict: 'none',
        trueSuspect: false,
        stationIndex: 0,
        dockedAt: timestamp,
      });
      return { activeCars };
    }),

  advanceCar: (carId, stationIndex, timestamp) =>
    set((state) => ({
      activeCars: state.activeCars.map((c) => (c.carId === carId ? { ...c, stationIndex, dockedAt: timestamp } : c)),
    })),

  // A finished car moves into the "shipped today" bay rather than being
  // deleted, pushing older ones along and evicting whatever falls off the
  // end. See SHIPPED_BAY_SLOTS for why: the reveal needs the evidence to
  // still be on screen when it fires.
  ingestCarExit: (carId, timestamp) =>
    set((state) => {
      const exiting = state.activeCars.find((c) => c.carId === carId);
      if (!exiting) return state;

      const bay = state.activeCars
        .filter((c) => shippedBaySlot(c.stationIndex) !== null)
        .sort((a, b) => shippedBaySlot(a.stationIndex)! - shippedBaySlot(b.stationIndex)!);
      const keep = bay.slice(0, SHIPPED_BAY_SLOTS - 1);
      const evicted = new Set(bay.slice(SHIPPED_BAY_SLOTS - 1).map((c) => c.carId));
      const shifted = new Map(keep.map((c, i) => [c.carId, SHIPPED_BAY_BASE_INDEX - (i + 1)]));

      return {
        carsBuilt: state.carsBuilt + 1,
        activeCars: state.activeCars
          .filter((c) => !evicted.has(c.carId))
          .map((c) => {
            if (c.carId === carId) return { ...c, stationIndex: SHIPPED_BAY_BASE_INDEX, dockedAt: timestamp };
            const next = shifted.get(c.carId);
            return next === undefined ? c : { ...c, stationIndex: next, dockedAt: timestamp };
          }),
      };
    }),

  shiftDockedTimestamps: (deltaMs) =>
    set((state) => ({
      activeCars: state.activeCars.map((c) => ({ ...c, dockedAt: c.dockedAt + deltaMs })),
    })),

  ingestGroundTruth: (weld, suspect) =>
    set((state) => {
      const robot = state.robots[weld.robot_id];
      if (!robot) return state;
      // The first out-of-spec weld is stamped from ground truth, so it's
      // recorded whether or not anyone was inspecting at the time. That's
      // what lets the replay say "this shipped N seconds before you knew."
      const incident =
        suspect && state.incident.firstDefectAt === null && state.incident.faultStartedAt !== null
          ? { ...state.incident, firstDefectAt: weld.timestamp }
          : state.incident;
      // Provisionally "nobody looked". DriftAnalyzer.ingestWeld calls the
      // ground-truth listeners and then, synchronously in the same tick,
      // the QC listeners IF this weld was actually inspected — so a car
      // that gets inspected has this overwritten with pass/fail before any
      // render happens, and one that doesn't keeps it.
      const activeCars = state.activeCars.map((c) =>
        c.carId === weld.car_id ? { ...c, verdict: 'uninspected' as CarVerdict, trueSuspect: suspect } : c,
      );
      return {
        incident,
        activeCars,
        suspectWeldsGroundTruth: state.suspectWeldsGroundTruth + (suspect ? 1 : 0),
        robots: { ...state.robots, [weld.robot_id]: { ...robot, lastWeldAt: weld.timestamp } },
      };
    }),

  ingestQCCheck: (event) =>
    set((state) => {
      // A pass is a result too. It is what makes the green ticks on the line
      // mean something, and therefore what makes a grey question mark next
      // to them read as an absence rather than as decoration.
      if (!event.suspect) {
        return {
          activeCars: state.activeCars.map((c) =>
            c.carId === event.car_id ? { ...c, verdict: 'pass' as CarVerdict } : c,
          ),
        };
      }
      const item: ReworkItem = {
        id: `${event.car_id}-${event.robot_id}`,
        carId: event.car_id,
        robotId: event.robot_id,
        timestamp: event.timestamp,
        deviationMm: event.deviation_mm,
      };
      const activeCars = state.activeCars.map((c) =>
        c.carId === event.car_id ? { ...c, flaggedRobotId: event.robot_id, verdict: 'fail' as CarVerdict } : c,
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
      // A projection is a property of the window, so it exists only where a
      // window is actually being watched. Under spot checks there is no
      // series to fit a slope to, and claiming one would be exactly the
      // false confidence this demo is about.
      const projectedBreachMs = state.liveVisionQC ? event.projectedBreachMs : null;
      return {
        weldsUntilNextInspection: event.weldsUntilNextInspection,
        robots: {
          ...state.robots,
          [event.robot_id]: {
            ...robot,
            displayedTrendMm: event.displayedTrendMm,
            status,
            history,
            groundTruthHistory,
            projectedBreachMs,
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
      // First alert that actually reached a human. Gated by the same
      // liveVisionQC check above, so a spot-check regime genuinely delays
      // this stamp rather than quietly recording the truth anyway.
      const incident =
        event.action !== 'drift_cleared' && state.incident.detectedAt === null
          ? {
              ...state.incident,
              detectedAt: event.timestamp,
              defectsBeforeDetection: state.suspectWeldsGroundTruth,
            }
          : event.action === 'drift_cleared'
            ? { ...state.incident, resolvedAt: event.timestamp }
            : state.incident;
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
        incident,
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
        incident: { ...state.incident, resolvedAt: timestamp },
        robots: {
          ...state.robots,
          [robotId]: {
            ...robot,
            recalibrationRecommended: false,
            lastRecalibratedAt: timestamp,
            projectedBreachMs: null,
          },
        },
        feed: [feedItem, ...state.feed].slice(0, FEED_MAX),
      };
    }),

  setRecoveryReveal: (reveal) => set({ recoveryReveal: reveal }),

  revealUninspectedDefects: () =>
    set((state) => ({
      activeCars: state.activeCars.map((c) =>
        c.verdict === 'uninspected' && c.trueSuspect ? { ...c, verdict: 'revealed' as CarVerdict } : c,
      ),
    })),

  markFaultStarted: (_robotId, timestamp) =>
    set(() => ({ incident: { ...emptyIncident(), faultStartedAt: timestamp } })),

  toggleLiveVisionQC: () =>
    set((state) => {
      const next = !state.liveVisionQC;
      return {
        liveVisionQC: next,
        // Going dark: remember where the counters stood, so the reveal on
        // the way back bills this off-period and not the session total.
        qcOffSince: next
          ? null
          : {
              at: Date.now(),
              groundTruthAt: state.suspectWeldsGroundTruth,
              caughtAt: state.suspectWeldsCaught,
            },
      };
    }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  toggleAutoRecalibrate: () => set((state) => ({ autoRecalibrate: !state.autoRecalibrate })),
  setSelectedRobot: (id) => set({ selectedRobotId: id }),
  setShortcutOverlayOpen: (open) => set({ shortcutOverlayOpen: open }),
  setReplayOpen: (open) => set({ replayOpen: open }),
  // Staging an act opens the cue card — if you are driving by act keys you
  // want to see which beat you are on.
  setPresenterAct: (n) => set({ presenterAct: n, presenterCueOpen: n !== null }),
  setPresenterCueOpen: (open) => set({ presenterCueOpen: open }),

  // autoRecalibrate is deliberately omitted here — see its field comment.
  // presenterAct/presenterCueOpen likewise: every act stages itself by
  // calling reset(), so clearing them here would wipe the cue card at the
  // exact moment the act it describes begins.
  reset: () =>
    set({
      robots: makeInitialRobots(),
      activeCars: [],
      reworkQueue: [],
      feed: [],
      liveVisionQC: true,
      weldsUntilNextInspection: null,
      paused: false,
      carsBuilt: 0,
      suspectWeldsGroundTruth: 0,
      suspectWeldsCaught: 0,
      recoveryReveal: null,
      incident: emptyIncident(),
      qcOffSince: null,
      selectedRobotId: null,
      replayOpen: false,
    }),
}));
