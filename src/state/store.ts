import { create } from 'zustand';
import {
  CRITICAL_TREND,
  MACHINE_IDS,
  MACHINE_LABELS,
  MIN_TREND_SAMPLES,
  PROBLEM_MACHINE_ID,
  WARN_TREND,
  WEIGHT_TARGET_MG,
  type MachineId,
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

/** What the inspection pipeline knows about one machine's output. Only the
 *  press's tablets are weighed, so for the others this stays at rest. */
export interface MachineState {
  id: MachineId;
  label: string;
  /** Derived from `trend`, never set directly. */
  status: Severity;
  /** Windowed mean tablet weight offset (mg) of the trays this machine
   *  pressed. */
  trend: number;
  history: TrendSample[];
  /** The most recent single tray's offset, mg. */
  lastOffset: number | null;
  recalibrationRecommended: boolean;
  lastRecalibratedAt: number | null;
  projectedBreachMs: number | null;
}

/**
 * One tray of tablets on the line.
 *  verdict none - not inspected yet
 *          pass - inside tolerance, heading for the blister packer
 *          fail - underweight, flagged and diverted into the reject bin
 */
export type TrayVerdict = 'none' | 'pass' | 'fail';

export interface Tray {
  id: string;
  /** Effective spawn time. Shifted forward by every stop, so a tray's
   *  distance along the belt is always (now - spawnedAt) * BELT_SPEED. */
  spawnedAt: number;
  /** Mean tablet weight offset, mg, fixed when the press filled the tray.
   *  The scene draws an underweight tray's tablets thinner. */
  offset: number;
  verdict: TrayVerdict;
  /** Set when the reject gate diverts it off the belt. */
  rejectedAt: number | null;
}

/** One tray's fate, stamped on the line's own clock (wall time minus every
 *  stop so far), so the output chart buckets by when trays came off the
 *  line and a stopped line simply adds nothing. */
export interface Outcome {
  t: number;
  ok: boolean;
}

/** Outcomes kept: comfortably more than the chart's two minutes. */
const OUTCOMES_MAX = 400;

export interface FeedItem {
  id: string;
  timestamp: number;
  text: string;
  tone: 'info' | 'warning' | 'critical' | 'success';
}

/**
 * The current incident, stamped at the moment each thing happened. The stop
 * report and the autopilot summary are built from this, so every number the
 * audience sees is measured rather than asserted.
 */
export interface Incident {
  /** Ground zero: when the press fault started. Only the story director
   *  knows this, because it causes it. */
  faultStartedAt: number;
  /** When the stream first flagged the press as anything but healthy, from
   *  its sensors or its tablets' weight trend, whichever came first. */
  detectedAt: number | null;
  stoppedAt: number | null;
  resolvedAt: number | null;
  /** Trays inspected since the fault started, and how many failed. */
  inspected: number;
  rejected: number;
  resolvedBy: 'operator' | 'autopilot' | null;
}

/** The autopilot's own account of an incident it closed. */
export interface AutopilotCatch {
  at: number;
  detectMs: number;
  fixMs: number;
  rejected: number;
}

const HISTORY_MAX = 120;
const FEED_MAX = 40;

export function deriveStatus(trend: number): Severity {
  const m = Math.abs(trend);
  if (m > CRITICAL_TREND) return 'critical';
  if (m > WARN_TREND) return 'warning';
  return 'healthy';
}

function makeMachine(id: MachineId): MachineState {
  return {
    id,
    label: MACHINE_LABELS[id],
    status: 'healthy',
    trend: 0,
    history: [],
    lastOffset: null,
    recalibrationRecommended: false,
    lastRecalibratedAt: null,
    projectedBreachMs: null,
  };
}

function makeInitialMachines(): Record<MachineId, MachineState> {
  return Object.fromEntries(MACHINE_IDS.map((id) => [id, makeMachine(id)])) as Record<MachineId, MachineState>;
}

/** A machine's overall condition: the worst of its quality trend and its own
 *  process sensors. One definition, used by the cards, the scene's andons
 *  and tags, detection and the autopilot, so none of them can disagree. */
export function machineSeverity(state: Pick<StoreState, 'machines' | 'sensors'>, machineId: MachineId): Severity {
  const reading = state.sensors[machineId];
  return worstSeverity(
    state.machines[machineId].status,
    ...SENSOR_CHANNELS.map((channel) => channelSeverity(machineId, channel, reading[channel])),
  );
}

function fmtLatency(ms: number): string {
  return ms < 100 ? '<0.1' : (ms / 1000).toFixed(1);
}

/** Stamp detection the first time the press leaves healthy while an
 *  incident is open. */
function withDetection(state: StoreState, next: Partial<StoreState>, now: number): Partial<StoreState> {
  const incident = state.incident;
  if (!incident || incident.detectedAt !== null || incident.resolvedAt !== null) return next;
  const merged = { machines: next.machines ?? state.machines, sensors: next.sensors ?? state.sensors };
  if (machineSeverity(merged, PROBLEM_MACHINE_ID) === 'healthy') return next;
  const item: FeedItem = {
    id: `detect-${now}`,
    timestamp: now,
    text: `${PROBLEM_MACHINE_ID} anomaly detected ${fmtLatency(now - incident.faultStartedAt)}s after onset`,
    tone: 'warning',
  };
  return {
    ...next,
    incident: { ...incident, detectedAt: now },
    feed: [item, ...(next.feed ?? state.feed)].slice(0, FEED_MAX),
  };
}

interface QCCheckPayload {
  machine_id: MachineId;
  item_id: string;
  timestamp: number;
  suspect: boolean;
  offset: number;
}

interface WindowStatsPayload {
  machine_id: MachineId;
  timestamp: number;
  trend: number;
  sampleCount: number;
  projectedBreachMs: number | null;
}

interface ActionPayload {
  machine_id: MachineId;
  timestamp: number;
  action: 'drift_warning' | 'drift_critical' | 'drift_cleared';
}

export interface StoreState {
  machines: Record<MachineId, MachineState>;
  trays: Tray[];
  feed: FeedItem[];

  /** The line is stopped: belt, machines and analyzer window freeze
   *  together. */
  paused: boolean;
  /** Wall clock the line was stopped at, so the scene can freeze its own
   *  clock at the same instant. */
  pausedAt: number | null;
  /** Standing policy: recalibrate the press the moment the stream flags it.
   *  Not cleared by reset(): it is a rule the line now runs under. */
  autopilot: boolean;

  /** Trays that passed inspection and went on to the blister packer. */
  traysPacked: number;
  traysRejected: number;
  outcomes: Outcome[];
  /** Total time the line has spent stopped; wall time minus this is the
   *  line's clock. */
  stoppedMs: number;
  /** Wall clock of the last reject gate kick, for the pusher animation. */
  lastKickAt: number | null;
  incident: Incident | null;
  autopilotCatch: AutopilotCatch | null;

  shortcutOverlayOpen: boolean;

  sensors: SensorFrame;
  sensorsAt: number;
  injections: FaultInjection[];
  sensorPipeline: { readings: number; anomalies: number };
  faultPanelOpen: boolean;

  // ---- ingestion actions, called only from state/engine.ts ----
  ingestTraySpawn: (id: string, spawnedAt: number, offset: number) => void;
  ingestTrayReject: (id: string, timestamp: number) => void;
  ingestTrayPacked: (id: string, timestamp: number) => void;
  shiftTrayTimestamps: (deltaMs: number) => void;
  ingestQCCheck: (event: QCCheckPayload) => void;
  ingestWindowStats: (event: WindowStatsPayload) => void;
  ingestAction: (event: ActionPayload) => void;
  ingestSensorFrame: (frame: SensorFrame, timestamp: number) => void;

  // ---- scenario actions, called only from state/storyDirector.ts ----
  openIncident: (timestamp: number, text: string) => void;
  markRecalibrated: (machineId: MachineId, timestamp: number, by: 'operator' | 'autopilot') => void;

  // ---- UI actions ----
  setPaused: (paused: boolean) => void;
  setAutopilot: (on: boolean) => void;
  dismissAutopilotCatch: () => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  injectFaults: (
    machineIds: readonly MachineId[],
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

/** Rejected trays linger long enough to slide into the bin, then leave the
 *  list; the bin draws its pile from the count. */
const REJECT_LINGER_MS = 1500;

export const useStore = create<StoreState>((set) => ({
  machines: makeInitialMachines(),
  trays: [],
  feed: [],

  paused: false,
  pausedAt: null,
  autopilot: false,

  traysPacked: 0,
  traysRejected: 0,
  outcomes: [],
  stoppedMs: 0,
  lastKickAt: null,
  incident: null,
  autopilotCatch: null,

  shortcutOverlayOpen: false,

  sensors: initialSensorFrame(),
  sensorsAt: Date.now(),
  injections: [],
  sensorPipeline: { readings: 0, anomalies: 0 },
  faultPanelOpen: false,

  ingestTraySpawn: (id, spawnedAt, offset) =>
    set((state) => ({
      trays: [
        ...state.trays.filter((l) => l.rejectedAt === null || spawnedAt - l.rejectedAt < REJECT_LINGER_MS),
        { id, spawnedAt, offset, verdict: 'none', rejectedAt: null },
      ],
    })),

  ingestTrayReject: (id, timestamp) =>
    set((state) => ({
      trays: state.trays.map((l) => (l.id === id ? { ...l, rejectedAt: timestamp } : l)),
      traysRejected: state.traysRejected + 1,
      outcomes: [...state.outcomes, { t: timestamp - state.stoppedMs, ok: false }].slice(-OUTCOMES_MAX),
      lastKickAt: timestamp,
    })),

  ingestTrayPacked: (id, timestamp) =>
    set((state) => ({
      trays: state.trays.filter((l) => l.id !== id),
      traysPacked: state.traysPacked + 1,
      outcomes: [...state.outcomes, { t: timestamp - state.stoppedMs, ok: true }].slice(-OUTCOMES_MAX),
    })),

  shiftTrayTimestamps: (deltaMs) =>
    set((state) => ({
      trays: state.trays.map((l) => ({
        ...l,
        spawnedAt: l.spawnedAt + deltaMs,
        rejectedAt: l.rejectedAt === null ? null : l.rejectedAt + deltaMs,
      })),
      lastKickAt: state.lastKickAt === null ? null : state.lastKickAt + deltaMs,
      stoppedMs: state.stoppedMs + deltaMs,
    })),

  ingestQCCheck: (event) =>
    set((state) => {
      const machine = state.machines[event.machine_id];
      const trays = state.trays.map((l) =>
        l.id === event.item_id ? { ...l, verdict: (event.suspect ? 'fail' : 'pass') as TrayVerdict } : l,
      );
      const incident =
        state.incident && state.incident.resolvedAt === null
          ? {
              ...state.incident,
              inspected: state.incident.inspected + 1,
              rejected: state.incident.rejected + (event.suspect ? 1 : 0),
            }
          : state.incident;
      const machines = { ...state.machines, [event.machine_id]: { ...machine, lastOffset: event.offset } };
      if (!event.suspect) return { trays, incident, machines };
      return {
        trays,
        incident,
        machines,
        feed: feed(state, {
          id: `${event.item_id}-qc`,
          timestamp: event.timestamp,
          text: `Tray ${event.item_id} underweight (${(WEIGHT_TARGET_MG + event.offset).toFixed(1)} mg) - diverted`,
          tone: 'critical',
        }),
      };
    }),

  ingestWindowStats: (event) =>
    set((state) => {
      const machine = state.machines[event.machine_id];
      const history = [...machine.history, { t: event.timestamp, v: event.trend }].slice(-HISTORY_MAX);
      const status = event.sampleCount >= MIN_TREND_SAMPLES ? deriveStatus(event.trend) : 'healthy';
      const machines = {
        ...state.machines,
        [event.machine_id]: { ...machine, trend: event.trend, status, history, projectedBreachMs: event.projectedBreachMs },
      };
      return withDetection(state, { machines }, event.timestamp);
    }),

  ingestAction: (event) =>
    set((state) => {
      const machine = state.machines[event.machine_id];
      const text = {
        drift_warning: `${event.machine_id} tablet weight drifting off target`,
        drift_critical: `${event.machine_id} tablets underdosed - stop and recalibrate`,
        drift_cleared: `${event.machine_id} tablet weight back on target`,
      }[event.action];
      const tone = ({ drift_warning: 'warning', drift_critical: 'critical', drift_cleared: 'success' } as const)[event.action];
      return {
        machines: {
          ...state.machines,
          [event.machine_id]: { ...machine, recalibrationRecommended: event.action !== 'drift_cleared' },
        },
        feed: feed(state, { id: `${event.machine_id}-${event.action}-${event.timestamp}`, timestamp: event.timestamp, text, tone }),
      };
    }),

  ingestSensorFrame: (frame, timestamp) =>
    set((state) => {
      let anomalies = 0;
      for (const id of MACHINE_IDS) {
        for (const channel of SENSOR_CHANNELS) {
          if (channelSeverity(id, channel, frame[id][channel]) !== 'healthy') anomalies += 1;
        }
      }
      return withDetection(
        state,
        {
          sensors: frame,
          sensorsAt: timestamp,
          sensorPipeline: {
            readings: state.sensorPipeline.readings + MACHINE_IDS.length * SENSOR_CHANNELS.length,
            anomalies: state.sensorPipeline.anomalies + anomalies,
          },
        },
        timestamp,
      );
    }),

  openIncident: (timestamp, text) =>
    set((state) => {
      // A second key press while an incident is open escalates it rather
      // than restarting the clock: the fault began when it began.
      const open = state.incident && state.incident.resolvedAt === null;
      return {
        incident: open
          ? state.incident
          : {
              faultStartedAt: timestamp,
              detectedAt: null,
              stoppedAt: null,
              resolvedAt: null,
              inspected: 0,
              rejected: 0,
              resolvedBy: null,
            },
        autopilotCatch: null,
        feed: feed(state, { id: `fault-${timestamp}`, timestamp, text, tone: 'info' }),
      };
    }),

  markRecalibrated: (machineId, timestamp, by) =>
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
              rejected: incident.rejected,
            }
          : state.autopilotCatch;
      return {
        incident,
        autopilotCatch,
        machines: {
          ...state.machines,
          [machineId]: { ...makeMachine(machineId), history: state.machines[machineId].history, lastRecalibratedAt: timestamp },
        },
        feed: feed(state, {
          id: `${machineId}-recal-${timestamp}`,
          timestamp,
          text:
            by === 'autopilot'
              ? `Autopilot recalibrated ${machineId} - fill depth back on setpoint`
              : `${machineId} recalibrated - fill depth back on setpoint`,
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
        pausedAt: paused ? now : null,
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

  injectFaults: (machineIds, channels, intensity, source = 'manual') =>
    set((state) => {
      const now = Date.now();
      const next = new Map(state.injections.map((injection) => [injection.id, injection]));
      for (const machineId of machineIds) {
        for (const channel of channels) {
          const id = injectionId(machineId, channel);
          const startedAt = next.get(id)?.startedAt ?? now;
          next.set(id, { id, machineId, channel, intensity, startedAt, source });
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
      machines: makeInitialMachines(),
      trays: [],
      feed: [],
      paused: false,
      pausedAt: null,
      traysPacked: 0,
      traysRejected: 0,
      outcomes: [],
      lastKickAt: null,
      incident: null,
      autopilotCatch: null,
      sensors: initialSensorFrame(),
      sensorsAt: Date.now(),
      injections: [],
      sensorPipeline: { readings: 0, anomalies: 0 },
    }),
}));
