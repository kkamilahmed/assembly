// Per-source live signals, plus the manual fault injection that drives them
// out of range.
//
// Every source publishes three channels. The channel keys are generic
// (velocity, newCards, newDevices) so the stream, the store and the cards
// can treat every source alike; what each one means at a given source
// (approved charges a minute, withdrawals a minute, failed PINs...) lives in
// SIGNAL_SPECS.
//
// Generation is a mean-reverting random walk so a long-idle session never
// wanders off and pins at a limit nobody injected.
import { PROBLEM_SOURCE_ID, SOURCE_IDS, type SourceId } from './networkConfig';

export const SIGNAL_CHANNELS = ['velocity', 'newCards', 'newDevices'] as const;
export type SignalChannel = (typeof SIGNAL_CHANNELS)[number];

/** Source-independent names, for places that pick a channel across every
 *  source (the fault-injection panel). */
export const CHANNEL_NAMES: Record<SignalChannel, string> = {
  velocity: 'Velocity',
  newCards: 'New cards',
  newDevices: 'New devices',
};

export type SignalSeverity = 'healthy' | 'warning' | 'critical';

export interface ChannelSpec {
  label: string;
  unit: string;
  /** Whether the unit reads with a space after the number ("62 /min") or
   *  not ("62%"). */
  unitGap: boolean;
  /** Ends of the displayed scale. `max` doubles as the ceiling an injection
   *  ramps toward, so a level-20 fault pins the channel at full scale. */
  min: number;
  max: number;
  warn: number;
  critical: number;
  decimals: number;
  /** Everyday operating point and minute-to-minute wobble. */
  base: number;
  jitter: number;
}

type SourceSpecs = Record<SignalChannel, ChannelSpec>;

const rate = (label: string, max: number, warn: number, critical: number, base: number, jitter: number): ChannelSpec => ({
  label, unit: '/min', unitGap: true, min: 0, max, warn, critical, decimals: 0, base, jitter,
});
const pct = (label: string, warn: number, critical: number, base: number, jitter: number, max = 100): ChannelSpec => ({
  label, unit: '%', unitGap: false, min: 0, max, warn, critical, decimals: 0, base, jitter,
});

export const SIGNAL_SPECS: Record<SourceId, SourceSpecs> = {
  'CAFE-01': {
    velocity: rate('Approved', 80, 40, 60, 14, 1),
    newCards: pct('New cards', 30, 60, 6, 0.8),
    newDevices: pct('New phone wallets', 25, 50, 4, 0.6),
  },
  'ATM-07': {
    velocity: rate('Withdrawals', 30, 12, 20, 3, 0.3),
    newCards: pct('New cards', 30, 60, 5, 0.8),
    newDevices: pct('Failed PINs', 15, 30, 3, 0.5, 60),
  },
  'MALL-03': {
    velocity: rate('Approved', 600, 380, 500, 210, 6),
    newCards: pct('New cards', 30, 60, 7, 0.8),
    newDevices: pct('New phone wallets', 25, 50, 5, 0.7),
  },
  'TDZ-WEB': {
    velocity: rate('Approved', 2000, 400, 1400, 120, 3),
    newCards: pct('New cards', 40, 85, 9, 1),
    newDevices: pct('New devices', 35, 70, 11, 1),
  },
};

export function channelSpec(sourceId: SourceId, channel: SignalChannel): ChannelSpec {
  return SIGNAL_SPECS[sourceId][channel];
}

export function channelSeverity(sourceId: SourceId, channel: SignalChannel, value: number): SignalSeverity {
  const spec = channelSpec(sourceId, channel);
  if (value >= spec.critical) return 'critical';
  if (value >= spec.warn) return 'warning';
  return 'healthy';
}

export function formatReading(sourceId: SourceId, channel: SignalChannel, value: number): string {
  const spec = channelSpec(sourceId, channel);
  const n = value.toLocaleString('en-US', { minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals });
  return `${n}${spec.unitGap ? ' ' : ''}${spec.unit}`;
}

/** "0-2,000 /min · limits 400 / 1,400" - a reading means nothing without
 *  the scale it sits on and the lines it is judged against. */
export function channelRangeLabel(sourceId: SourceId, channel: SignalChannel): string {
  const spec = channelSpec(sourceId, channel);
  const gap = spec.unitGap ? ' ' : '';
  const f = (n: number) => n.toLocaleString('en-US');
  return `${f(spec.min)}-${f(spec.max)}${gap}${spec.unit} · limits ${f(spec.warn)} / ${f(spec.critical)}`;
}

export interface SignalReading {
  velocity: number;
  newCards: number;
  newDevices: number;
  /** Payments scored at this source today. */
  scored: number;
}

export type SignalFrame = Record<SourceId, SignalReading>;

const SCORED_BASE: Record<SourceId, number> = { 'CAFE-01': 1_240, 'ATM-07': 312, 'MALL-03': 18_870, 'TDZ-WEB': 6_410 };

export function initialSignalFrame(): SignalFrame {
  return Object.fromEntries(
    SOURCE_IDS.map((id) => [
      id,
      {
        velocity: SIGNAL_SPECS[id].velocity.base,
        newCards: SIGNAL_SPECS[id].newCards.base,
        newDevices: SIGNAL_SPECS[id].newDevices.base,
        scored: SCORED_BASE[id],
      } satisfies SignalReading,
    ]),
  ) as Record<SourceId, SignalReading>;
}

export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 20;

export interface FaultInjection {
  /** `${sourceId}:${channel}`. One injection per source+channel pair, so
   *  re-injecting a pair retunes it rather than stacking a second fault on
   *  top of the first. */
  id: string;
  sourceId: SourceId;
  channel: SignalChannel;
  /** 1..INTENSITY_MAX. */
  intensity: number;
  startedAt: number;
  /** `manual` came from the fault-injection panel. `scenario` is the
   *  side effect of the presenter's D / E attack: card testing shows up in
   *  a merchant's approval velocity and new-card share. Only manual
   *  injections are badged, because a scenario fault is meant to read as
   *  the source genuinely misbehaving. */
  source: 'manual' | 'scenario';
}

export const injectionId = (sourceId: SourceId, channel: SignalChannel) => `${sourceId}:${channel}`;

/** Where an injected channel settles: a fraction of the way from this
 *  source's everyday base to the top of the channel's scale, set by
 *  intensity. */
export function injectionTarget(sourceId: SourceId, channel: SignalChannel, intensity: number): number {
  const spec = SIGNAL_SPECS[sourceId][channel];
  return spec.base + (spec.max - spec.base) * (intensity / INTENSITY_MAX);
}

/** What an injection at this intensity will settle at, before it is armed -
 *  so the panel can say what the slider is about to do rather than making
 *  you press Inject to find out. */
export function injectionSeverity(sourceId: SourceId, channel: SignalChannel, intensity: number): SignalSeverity {
  return channelSeverity(sourceId, channel, injectionTarget(sourceId, channel, intensity));
}

/** Fraction of the gap to its target a channel closes per tick. An everyday
 *  channel only needs enough pull to stop it wandering; an injected one has
 *  to be visibly climbing within a couple of seconds of the key press,
 *  because somebody is standing in front of an audience having just pressed
 *  it. */
const HEALTHY_PULL = 0.08;
const INJECTED_PULL = 0.45;
/** A channel released from a fault settles back faster than it wanders, but
 *  not as fast as it climbed: still a recovery you can watch rather than a
 *  value that teleports. */
const RECOVERY_PULL = 0.28;

/** How far an uninjected channel may wander from its base, as a fraction of
 *  the gap between that base and its warn limit. A dashboard that trips its
 *  own amber light on noise teaches an audience to ignore amber, so an
 *  uninjected source never does: every anomaly on this screen is something
 *  somebody caused. */
const HEALTHY_ENVELOPE = 0.5;

function healthyCeiling(sourceId: SourceId, channel: SignalChannel): number {
  const spec = SIGNAL_SPECS[sourceId][channel];
  return spec.base + (spec.warn - spec.base) * HEALTHY_ENVELOPE;
}

function step(sourceId: SourceId, channel: SignalChannel, value: number, injection: FaultInjection | undefined): number {
  const spec = SIGNAL_SPECS[sourceId][channel];
  const target = injection ? injectionTarget(sourceId, channel, injection.intensity) : spec.base;
  // Above its everyday envelope with nothing injected into it: this channel
  // is on its way back down from a fault that was just cleared.
  const envelope = healthyCeiling(sourceId, channel);
  const recovering = !injection && value > envelope;
  const pull = injection ? INJECTED_PULL : recovering ? RECOVERY_PULL : HEALTHY_PULL;
  // An attacked source does not just read high, it reads unstable - so
  // jitter scales with intensity.
  const jitter = spec.jitter * (injection ? 1 + injection.intensity / 8 : 1);
  const noise = (Math.random() - 0.5) * jitter * 2;
  const next = value + (target - value) * pull + noise;

  if (injection) return Math.min(spec.max, Math.max(spec.min, next));
  // Uninjected readings reflect off the envelope rather than being clamped
  // flat against it. A channel still recovering reflects off its own
  // current value instead, so it can only come down.
  const ceiling = Math.max(envelope, value);
  return Math.max(spec.min, next > ceiling ? ceiling - (next - ceiling) : next);
}

/** Publish cadence. */
export const SIGNAL_TICK_MS = 900;

export type SignalFrameListener = (frame: SignalFrame, timestamp: number) => void;

/**
 * Stands in for the per-source metrics topic a real network would publish.
 * Swapping in a real backend means replacing this class with a bridge that
 * emits the same frames; nothing in state/ or ui/ needs to know.
 */
export class SignalStream {
  private frame: SignalFrame = initialSignalFrame();
  private injections = new Map<string, FaultInjection>();
  private frozen = false;
  private intervalId: number | null = null;
  private listeners: SignalFrameListener[] = [];

  onFrame(listener: SignalFrameListener) {
    this.listeners.push(listener);
  }

  start() {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.tick(), SIGNAL_TICK_MS);
  }

  stop() {
    if (this.intervalId === null) return;
    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /** A frozen merchant's readings hold where they were when it was frozen,
   *  so the evidence stays on screen while the analyst decides. */
  configure({ frozen }: { frozen: boolean }) {
    this.frozen = frozen;
  }

  setInjections(injections: readonly FaultInjection[]) {
    this.injections = new Map(injections.map((injection) => [injection.id, injection]));
  }

  /** Snap one source's channels back to its everyday baseline. Fitting the
   *  rules to the attack stops the charges getting approved, so approval
   *  velocity drops the moment it is done, not a dozen ticks later. */
  recover(sourceId: SourceId) {
    this.frame = { ...this.frame, [sourceId]: { ...initialSignalFrame()[sourceId], scored: this.frame[sourceId].scored } };
    this.emit();
  }

  reset() {
    this.frame = initialSignalFrame();
    this.injections.clear();
    // Emit immediately: the cards should land back on their baseline with
    // the reset, not a tick later.
    this.emit();
  }

  private tick() {
    const next = {} as SignalFrame;
    for (const sourceId of SOURCE_IDS) {
      const prev = this.frame[sourceId];
      if (this.frozen && sourceId === PROBLEM_SOURCE_ID) {
        next[sourceId] = prev;
        continue;
      }
      const reading: SignalReading = { ...prev, scored: prev.scored + Math.max(1, Math.round(prev.velocity / 60)) };
      for (const channel of SIGNAL_CHANNELS) {
        reading[channel] = step(sourceId, channel, prev[channel], this.injections.get(injectionId(sourceId, channel)));
      }
      next[sourceId] = reading;
    }
    this.frame = next;
    this.emit();
  }

  private emit() {
    const timestamp = Date.now();
    for (const listener of this.listeners) listener(this.frame, timestamp);
  }
}
