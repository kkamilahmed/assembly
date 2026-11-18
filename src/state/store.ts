import { create } from 'zustand';
import {
  CRITICAL_TREND,
  MIN_TREND_SAMPLES,
  PROBLEM_SOURCE_ID,
  SOURCE_IDS,
  SOURCE_LABELS,
  WARN_TREND,
  type SourceId,
} from '@/streaming/networkConfig';
import type { PacketKind } from '@/streaming/PaymentProducer';
import {
  channelSeverity,
  initialSignalFrame,
  injectionId,
  SIGNAL_CHANNELS,
  type FaultInjection,
  type SignalChannel,
  type SignalFrame,
} from '@/streaming/signalStream';

export type Severity = 'healthy' | 'warning' | 'critical';

const SEVERITY_RANK: Record<Severity, number> = { healthy: 0, warning: 1, critical: 2 };

export function worstSeverity(...levels: Severity[]): Severity {
  return levels.reduce<Severity>((worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst), 'healthy');
}

export interface TrendSample {
  t: number;
  v: number;
}

/** What the stream knows about one source's approved charges. */
export interface SourceState {
  id: SourceId;
  label: string;
  /** Derived from `trend`, never set directly. */
  status: Severity;
  /** Windowed mean risk over baseline of the charges this source got
   *  approved. */
  trend: number;
  history: TrendSample[];
  /** The most recent single payment's risk over baseline. */
  lastOffset: number | null;
  recalibrationRecommended: boolean;
  lastRecalibratedAt: number | null;
  projectedBreachMs: number | null;
}

/** One payment on its way through the network. */
export interface Payment {
  id: string;
  source: SourceId;
  kind: PacketKind;
  /** When it left its source; its distance along its lane is always
   *  (now - spawnedAt) * PACKET_SPEED. */
  spawnedAt: number;
  /** Risk over baseline, known once the hub has scored it. */
  offset: number | null;
  /** Scored as fraud. Null until scored. */
  suspect: boolean | null;
  /** What the rules decided. Null until scored. */
  approved: boolean | null;
  /** Set when quarantine pulls it off its lane. */
  blockedAt: number | null;
}

export interface FeedItem {
  id: string;
  timestamp: number;
  text: string;
  tone: 'info' | 'warning' | 'critical' | 'success';
}

/**
 * The current incident, stamped at the moment each thing happened. The
 * freeze report and the autopilot summary are built from this, so every
 * number the audience sees is measured rather than asserted.
 */
export interface Incident {
  /** Ground zero: when the attack started. Only the story director knows
   *  this, because it causes it. */
  faultStartedAt: number;
  /** When the stream first flagged the problem source as anything but
   *  healthy, from its signals or the risk of its approved charges,
   *  whichever came first. */
  detectedAt: number | null;
  /** When the merchant was frozen. */
  stoppedAt: number | null;
  resolvedAt: number | null;
  /** Payments scored since the attack started, fraud that was approved,
   *  and payments blocked. */
  scored: number;
  fraudApproved: number;
  blocked: number;
  resolvedBy: 'analyst' | 'autopilot' | null;
}

/** The autopilot's own account of an incident it closed. */
export interface AutopilotCatch {
  at: number;
  detectMs: number;
  fixMs: number;
  fraudApproved: number;
}

const HISTORY_MAX = 120;
const FEED_MAX = 40;

export function deriveStatus(trend: number): Severity {
  const m = Math.abs(trend);
  if (m > CRITICAL_TREND) return 'critical';
  if (m > WARN_TREND) return 'warning';
  return 'healthy';
}

function makeSource(id: SourceId): SourceState {
  return {
    id,
    label: SOURCE_LABELS[id],
    status: 'healthy',
    trend: 0,
    history: [],
    lastOffset: null,
    recalibrationRecommended: false,
    lastRecalibratedAt: null,
    projectedBreachMs: null,
  };
}

function makeInitialSources(): Record<SourceId, SourceState> {
  return Object.fromEntries(SOURCE_IDS.map((id) => [id, makeSource(id)])) as Record<SourceId, SourceState>;
}

/** A source's overall condition: the worst of the risk getting through and
 *  its own live signals. One definition, used by the cards, the scene's
 *  beacons and tags, detection and the autopilot, so none of them can
 *  disagree. */
export function sourceSeverity(state: Pick<StoreState, 'sources' | 'signals'>, sourceId: SourceId): Severity {
  const reading = state.signals[sourceId];
  return worstSeverity(
    state.sources[sourceId].status,
    ...SIGNAL_CHANNELS.map((channel) => channelSeverity(sourceId, channel, reading[channel])),
  );
}

function fmtLatency(ms: number): string {
  return ms < 100 ? '<0.1' : (ms / 1000).toFixed(1);
}

/** Stamp detection the first time the problem source leaves healthy while
 *  an incident is open. */
function withDetection(state: StoreState, next: Partial<StoreState>, now: number): Partial<StoreState> {
  const incident = state.incident;
  if (!incident || incident.detectedAt !== null || incident.resolvedAt !== null) return next;
  const merged = { sources: next.sources ?? state.sources, signals: next.signals ?? state.signals };
  if (sourceSeverity(merged, PROBLEM_SOURCE_ID) === 'healthy') return next;
  const item: FeedItem = {
    id: `detect-${now}`,
    timestamp: now,
    text: `${PROBLEM_SOURCE_ID} anomaly detected ${fmtLatency(now - incident.faultStartedAt)}s after onset`,
    tone: 'warning',
  };
  return {
    ...next,
    incident: { ...incident, detectedAt: now },
    feed: [item, ...(next.feed ?? state.feed)].slice(0, FEED_MAX),
  };
}

interface ScorePayload {
  source_id: SourceId;
  item_id: string;
  timestamp: number;
  suspect: boolean;
  approved: boolean;
  offset: number;
}

interface WindowStatsPayload {
  source_id: SourceId;
  timestamp: number;
  trend: number;
  sampleCount: number;
  projectedBreachMs: number | null;
}

interface ActionPayload {
  source_id: SourceId;
  timestamp: number;
  action: 'drift_warning' | 'drift_critical' | 'drift_cleared';
}

export interface StoreState {
  sources: Record<SourceId, SourceState>;
  payments: Payment[];
  feed: FeedItem[];

  /** The problem merchant is frozen: nothing new leaves it, and its charges
   *  still in flight are declined at the hub. Every other source keeps
   *  paying. */
  frozen: boolean;
  frozenAt: number | null;
  /** Standing policy: refit the rules the moment the stream flags the
   *  problem source. Not cleared by reset(): it is a policy the network now
   *  runs under. */
  autopilot: boolean;

  /** Payments settled at the vault that the stream scored clean. */
  settled: number;
  /** Payments settled at the vault that the stream had scored as fraud:
   *  money lost. */
  fraudSettled: number;
  /** Payments pulled into quarantine at the hub. */
  blocked: number;
  /** Wall clock of the last quarantine pull, for the gate animation. */
  lastKickAt: number | null;
  incident: Incident | null;
  autopilotCatch: AutopilotCatch | null;

  shortcutOverlayOpen: boolean;

  signals: SignalFrame;
  signalsAt: number;
  injections: FaultInjection[];
  signalPipeline: { readings: number; anomalies: number };
  faultPanelOpen: boolean;

  // ---- ingestion actions, called only from state/engine.ts ----
  ingestSpawn: (id: string, source: SourceId, kind: PacketKind, spawnedAt: number) => void;
  ingestScore: (event: ScorePayload) => void;
  ingestBlock: (id: string, timestamp: number) => void;
  ingestSettle: (id: string) => void;
  ingestWindowStats: (event: WindowStatsPayload) => void;
  ingestAction: (event: ActionPayload) => void;
  ingestSignalFrame: (frame: SignalFrame, timestamp: number) => void;

  // ---- scenario actions, called only from state/storyDirector.ts ----
  openIncident: (timestamp: number, text: string) => void;
  markRecalibrated: (sourceId: SourceId, timestamp: number, by: 'analyst' | 'autopilot') => void;

  // ---- UI actions ----
  setFrozen: (frozen: boolean) => void;
  setAutopilot: (on: boolean) => void;
  dismissAutopilotCatch: () => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  injectFaults: (
    sourceIds: readonly SourceId[],
    channels: readonly SignalChannel[],
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

/** Blocked packets linger long enough to fly into quarantine, then leave the
 *  list; the tray draws its pile from the count. */
const BLOCK_LINGER_MS = 1500;

export const useStore = create<StoreState>((set) => ({
  sources: makeInitialSources(),
  payments: [],
  feed: [],

  frozen: false,
  frozenAt: null,
  autopilot: false,

  settled: 0,
  fraudSettled: 0,
  blocked: 0,
  lastKickAt: null,
  incident: null,
  autopilotCatch: null,

  shortcutOverlayOpen: false,

  signals: initialSignalFrame(),
  signalsAt: Date.now(),
  injections: [],
  signalPipeline: { readings: 0, anomalies: 0 },
  faultPanelOpen: false,

  ingestSpawn: (id, source, kind, spawnedAt) =>
    set((state) => ({
      payments: [
        ...state.payments.filter((p) => p.blockedAt === null || spawnedAt - p.blockedAt < BLOCK_LINGER_MS),
        { id, source, kind, spawnedAt, offset: null, suspect: null, approved: null, blockedAt: null },
      ],
    })),

  ingestScore: (event) =>
    set((state) => {
      const source = state.sources[event.source_id];
      const payments = state.payments.map((p) =>
        p.id === event.item_id ? { ...p, offset: event.offset, suspect: event.suspect, approved: event.approved } : p,
      );
      const incident =
        state.incident && state.incident.resolvedAt === null
          ? {
              ...state.incident,
              scored: state.incident.scored + 1,
              fraudApproved: state.incident.fraudApproved + (event.suspect && event.approved ? 1 : 0),
              blocked: state.incident.blocked + (event.approved ? 0 : 1),
            }
          : state.incident;
      const sources = { ...state.sources, [event.source_id]: { ...source, lastOffset: event.offset } };
      return { payments, incident, sources };
    }),

  ingestBlock: (id, timestamp) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, blockedAt: timestamp } : p)),
      blocked: state.blocked + 1,
      lastKickAt: timestamp,
    })),

  ingestSettle: (id) =>
    set((state) => {
      const p = state.payments.find((x) => x.id === id);
      const fraud = p?.suspect === true;
      return {
        payments: state.payments.filter((x) => x.id !== id),
        settled: state.settled + (fraud ? 0 : 1),
        fraudSettled: state.fraudSettled + (fraud ? 1 : 0),
      };
    }),

  ingestWindowStats: (event) =>
    set((state) => {
      const source = state.sources[event.source_id];
      const history = [...source.history, { t: event.timestamp, v: event.trend }].slice(-HISTORY_MAX);
      const status = event.sampleCount >= MIN_TREND_SAMPLES ? deriveStatus(event.trend) : 'healthy';
      const sources = {
        ...state.sources,
        [event.source_id]: { ...source, trend: event.trend, status, history, projectedBreachMs: event.projectedBreachMs },
      };
      return withDetection(state, { sources }, event.timestamp);
    }),

  ingestAction: (event) =>
    set((state) => {
      const source = state.sources[event.source_id];
      const text = {
        drift_warning: `${event.source_id} risky charges getting approved`,
        drift_critical: `${event.source_id} fraud pouring through - freeze and recalibrate`,
        drift_cleared: `${event.source_id} approved charges back to everyday risk`,
      }[event.action];
      const tone = ({ drift_warning: 'warning', drift_critical: 'critical', drift_cleared: 'success' } as const)[event.action];
      return {
        sources: {
          ...state.sources,
          [event.source_id]: { ...source, recalibrationRecommended: event.action !== 'drift_cleared' },
        },
        feed: feed(state, { id: `${event.source_id}-${event.action}-${event.timestamp}`, timestamp: event.timestamp, text, tone }),
      };
    }),

  ingestSignalFrame: (frame, timestamp) =>
    set((state) => {
      let anomalies = 0;
      for (const id of SOURCE_IDS) {
        for (const channel of SIGNAL_CHANNELS) {
          if (channelSeverity(id, channel, frame[id][channel]) !== 'healthy') anomalies += 1;
        }
      }
      return withDetection(
        state,
        {
          signals: frame,
          signalsAt: timestamp,
          signalPipeline: {
            readings: state.signalPipeline.readings + SOURCE_IDS.length * SIGNAL_CHANNELS.length,
            anomalies: state.signalPipeline.anomalies + anomalies,
          },
        },
        timestamp,
      );
    }),

  openIncident: (timestamp, text) =>
    set((state) => {
      // A second key press while an incident is open escalates it rather
      // than restarting the clock: the attack began when it began.
      const open = state.incident && state.incident.resolvedAt === null;
      return {
        incident: open
          ? state.incident
          : {
              faultStartedAt: timestamp,
              detectedAt: null,
              stoppedAt: null,
              resolvedAt: null,
              scored: 0,
              fraudApproved: 0,
              blocked: 0,
              resolvedBy: null,
            },
        autopilotCatch: null,
        feed: feed(state, { id: `fault-${timestamp}`, timestamp, text, tone: 'info' }),
      };
    }),

  markRecalibrated: (sourceId, timestamp, by) =>
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
              fraudApproved: incident.fraudApproved,
            }
          : state.autopilotCatch;
      // Every source's window restarts: the rules now stop what slipped
      // through before, on all of them.
      const sources = Object.fromEntries(
        SOURCE_IDS.map((id) => [
          id,
          { ...makeSource(id), history: state.sources[id].history, lastRecalibratedAt: id === sourceId ? timestamp : state.sources[id].lastRecalibratedAt },
        ]),
      ) as Record<SourceId, SourceState>;
      return {
        incident,
        autopilotCatch,
        sources,
        feed: feed(state, {
          id: `${sourceId}-recal-${timestamp}`,
          timestamp,
          text:
            by === 'autopilot'
              ? `Autopilot refitted the rules to ${sourceId} - fraud now blocked`
              : `Rules recalibrated for ${sourceId} - fraud now blocked`,
          tone: 'success',
        }),
      };
    }),

  setFrozen: (frozen) =>
    set((state) => {
      if (frozen === state.frozen) return state;
      const now = Date.now();
      const incident =
        frozen && state.incident && state.incident.resolvedAt === null && state.incident.stoppedAt === null
          ? { ...state.incident, stoppedAt: now }
          : state.incident;
      return {
        frozen,
        frozenAt: frozen ? now : null,
        incident,
        feed: feed(state, {
          id: `merchant-${frozen ? 'freeze' : 'unfreeze'}-${now}`,
          timestamp: now,
          text: frozen
            ? `${PROBLEM_SOURCE_ID} frozen by analyst`
            : state.autopilot
              ? `${PROBLEM_SOURCE_ID} unfrozen on autopilot`
              : `${PROBLEM_SOURCE_ID} unfrozen`,
          tone: frozen ? 'critical' : 'info',
        }),
      };
    }),
  setAutopilot: (on) => set({ autopilot: on }),
  dismissAutopilotCatch: () => set({ autopilotCatch: null }),
  setShortcutOverlayOpen: (open) => set({ shortcutOverlayOpen: open }),

  injectFaults: (sourceIds, channels, intensity, source = 'manual') =>
    set((state) => {
      const now = Date.now();
      const next = new Map(state.injections.map((injection) => [injection.id, injection]));
      for (const sourceId of sourceIds) {
        for (const channel of channels) {
          const id = injectionId(sourceId, channel);
          const startedAt = next.get(id)?.startedAt ?? now;
          next.set(id, { id, sourceId, channel, intensity, startedAt, source });
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
      sources: makeInitialSources(),
      payments: [],
      feed: [],
      frozen: false,
      frozenAt: null,
      settled: 0,
      fraudSettled: 0,
      blocked: 0,
      lastKickAt: null,
      incident: null,
      autopilotCatch: null,
      signals: initialSignalFrame(),
      signalsAt: Date.now(),
      injections: [],
      signalPipeline: { readings: 0, anomalies: 0 },
    }),
}));
