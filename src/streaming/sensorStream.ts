// The per-machine process sensors - temperature, pressure and vibration for
// all four arms - plus the manual fault injection that drives them out of
// range.
//
// These channels are NOT the weld-alignment pipeline (DriftAnalyzer): no car
// is measured here and no QC verdict depends on them. They are the second,
// coarser signal a real line publishes continuously from every machine, and
// they exist so all four arms have something live to show on the fleet
// overview - and so a fault can be put on any machine, on demand, without
// waiting for the scripted weld-drift act to come round.
//
// Generation is a mean-reverting random walk rather than a plain one: a
// long-idle session would otherwise let a reading wander off and sit pinned
// at its clamp, which reads as a broken machine nobody injected.
import { ROBOT_IDS, type RobotId } from './lineConfig';

export const SENSOR_CHANNELS = ['temperature', 'pressure', 'vibration'] as const;
export type SensorChannel = (typeof SENSOR_CHANNELS)[number];

export type SensorSeverity = 'healthy' | 'warning' | 'critical';

export interface ChannelSpec {
  label: string;
  unit: string;
  /** Whether the unit reads with a space after the number ("5.0 psi") or
   *  without one ("71.0°C"). */
  unitGap: boolean;
  /** Ends of the displayed scale. `max` doubles as the ceiling an injection
   *  ramps toward, so a level-20 fault pins the channel at full scale. */
  min: number;
  max: number;
  /** Alarm limits. Every profile below sits far enough under `warn` that an
   *  uninjected line never trips one - an anomaly on this dashboard is
   *  always something somebody caused. */
  warn: number;
  critical: number;
  decimals: number;
}

export const CHANNEL_SPECS: Record<SensorChannel, ChannelSpec> = {
  temperature: { label: 'Temperature', unit: '°C', unitGap: false, min: 20, max: 100, warn: 78, critical: 88, decimals: 1 },
  pressure: { label: 'Pressure', unit: 'psi', unitGap: true, min: 0, max: 10, warn: 7.0, critical: 8.2, decimals: 1 },
  vibration: { label: 'Vibration', unit: 'mm/s', unitGap: true, min: 0, max: 10, warn: 5.5, critical: 7.2, decimals: 2 },
};

export function channelSeverity(channel: SensorChannel, value: number): SensorSeverity {
  const spec = CHANNEL_SPECS[channel];
  if (value >= spec.critical) return 'critical';
  if (value >= spec.warn) return 'warning';
  return 'healthy';
}

export function formatReading(channel: SensorChannel, value: number): string {
  const spec = CHANNEL_SPECS[channel];
  return `${value.toFixed(spec.decimals)}${spec.unitGap ? ' ' : ''}${spec.unit}`;
}

/** "20-100°C · limits 78 / 88" - a reading means nothing without the scale
 *  it sits on and the lines it is being judged against. */
export function channelRangeLabel(channel: SensorChannel): string {
  const spec = CHANNEL_SPECS[channel];
  const gap = spec.unitGap ? ' ' : '';
  return `${spec.min}-${spec.max}${gap}${spec.unit} · limits ${spec.warn} / ${spec.critical}`;
}

interface ChannelProfile {
  base: number;
  jitter: number;
}

interface MachineProfile {
  temperature: ChannelProfile;
  pressure: ChannelProfile;
  vibration: ChannelProfile;
  cyclesBase: number;
}

const PROFILES: Record<RobotId, MachineProfile> = {
  'PANEL-01': {
    temperature: { base: 52, jitter: 1.4 },
    pressure: { base: 4.8, jitter: 0.15 },
    vibration: { base: 2.9, jitter: 0.3 },
    cyclesBase: 340,
  },
  'WELD-01': {
    temperature: { base: 71, jitter: 1.8 },
    pressure: { base: 5.0, jitter: 0.12 },
    vibration: { base: 3.6, jitter: 0.35 },
    cyclesBase: 410,
  },
  'PAINT-01': {
    temperature: { base: 58, jitter: 1.2 },
    pressure: { base: 4.6, jitter: 0.18 },
    vibration: { base: 2.4, jitter: 0.25 },
    cyclesBase: 300,
  },
  'WHEEL-01': {
    temperature: { base: 55, jitter: 1.3 },
    pressure: { base: 5.1, jitter: 0.14 },
    vibration: { base: 3.1, jitter: 0.28 },
    cyclesBase: 380,
  },
};

export interface SensorReading {
  temperature: number;
  pressure: number;
  vibration: number;
  cycles: number;
}

export type SensorFrame = Record<RobotId, SensorReading>;

export function initialSensorFrame(): SensorFrame {
  return Object.fromEntries(
    ROBOT_IDS.map((id) => [
      id,
      {
        temperature: PROFILES[id].temperature.base,
        pressure: PROFILES[id].pressure.base,
        vibration: PROFILES[id].vibration.base,
        cycles: PROFILES[id].cyclesBase,
      } satisfies SensorReading,
    ]),
  ) as Record<RobotId, SensorReading>;
}

export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 20;

export interface FaultInjection {
  /** `${robotId}:${channel}`. One injection per machine+channel pair, so
   *  re-injecting a pair retunes it rather than stacking a second fault on
   *  top of the first. */
  id: string;
  robotId: RobotId;
  channel: SensorChannel;
  /** 1..INTENSITY_MAX. */
  intensity: number;
  startedAt: number;
  /** `manual` came from the fault-injection panel. `scenario` is the
   *  physical side effect of the presenter's D / E deviation: a torch being
   *  dragged off its seam shakes and heats the arm. Only manual injections
   *  are badged on the dashboard, because a scenario fault is meant to read
   *  as the machine genuinely misbehaving. */
  source: 'manual' | 'scenario';
}

export const injectionId = (robotId: RobotId, channel: SensorChannel) => `${robotId}:${channel}`;

/** Where an injected channel settles: a fraction of the way from this
 *  machine's healthy base to the top of the channel's scale, set by
 *  intensity. Bases differ per machine, so one intensity lands at different
 *  severities across the fleet - which is exactly what makes injecting all
 *  four at once worth looking at. */
export function injectionTarget(robotId: RobotId, channel: SensorChannel, intensity: number): number {
  const base = PROFILES[robotId][channel].base;
  const spec = CHANNEL_SPECS[channel];
  return base + (spec.max - base) * (intensity / INTENSITY_MAX);
}

/** What an injection at this intensity will settle at, before it is armed -
 *  so the panel can say what the slider is about to do rather than making
 *  you press Inject to find out. */
export function injectionSeverity(robotId: RobotId, channel: SensorChannel, intensity: number): SensorSeverity {
  return channelSeverity(channel, injectionTarget(robotId, channel, intensity));
}

/** Fraction of the gap to its target a channel closes per tick. A healthy
 *  channel only needs enough pull to stop it wandering; an injected one has
 *  to be visibly climbing within a couple of seconds of the button press,
 *  because somebody is standing in front of an audience having just pressed
 *  it. */
const HEALTHY_PULL = 0.08;
const INJECTED_PULL = 0.45;
/** A channel released from a fault settles back faster than it wanders, but
 *  not as fast as it climbed: clearing an injection should visibly bring the
 *  machine back inside its limits within a few seconds - nobody stands in
 *  front of an audience waiting out a realistic cool-down - while still
 *  being a recovery you can watch rather than a value that teleports. */
const RECOVERY_PULL = 0.28;

/** How far an uninjected channel may wander from its base, as a fraction of
 *  the gap between that base and its warn limit. A dashboard that trips its
 *  own amber light on noise teaches an audience to ignore amber, so an
 *  uninjected machine never does: every anomaly on this screen is something
 *  somebody caused. */
const HEALTHY_ENVELOPE = 0.5;

function healthyCeiling(robotId: RobotId, channel: SensorChannel): number {
  const base = PROFILES[robotId][channel].base;
  return base + (CHANNEL_SPECS[channel].warn - base) * HEALTHY_ENVELOPE;
}

function step(robotId: RobotId, channel: SensorChannel, value: number, injection: FaultInjection | undefined): number {
  const spec = CHANNEL_SPECS[channel];
  const profile = PROFILES[robotId][channel];
  const target = injection ? injectionTarget(robotId, channel, injection.intensity) : profile.base;
  // Above its healthy envelope with nothing injected into it: this channel
  // is on its way back down from a fault that was just cleared.
  const envelope = healthyCeiling(robotId, channel);
  const recovering = !injection && value > envelope;
  const pull = injection ? INJECTED_PULL : recovering ? RECOVERY_PULL : HEALTHY_PULL;
  // A failing machine does not just read high, it reads unstable - so jitter
  // scales with intensity. A level-20 fault visibly rattles instead of
  // sitting at a suspiciously steady number.
  const jitter = profile.jitter * (injection ? 1 + injection.intensity / 8 : 1);
  const noise = (Math.random() - 0.5) * jitter * 2;
  const next = value + (target - value) * pull + noise;

  if (injection) return Math.min(spec.max, Math.max(spec.min, next));
  // Uninjected readings reflect off the envelope rather than being clamped
  // flat against it - a reading that pins to a constant ceiling for six
  // seconds looks exactly as synthetic as it is. A channel still recovering
  // reflects off its own current value instead, so it can only come down.
  const ceiling = Math.max(envelope, value);
  return Math.max(spec.min, next > ceiling ? ceiling - (next - ceiling) : next);
}

/** Publish cadence. Faster than the old 1.4s so an injection reads as a live
 *  stream reacting, rather than a number that changes when you look away. */
export const SENSOR_TICK_MS = 900;

export type SensorFrameListener = (frame: SensorFrame, timestamp: number) => void;

/**
 * Stands in for the per-machine sensor topic a real line would publish.
 * Swapping in a real backend means replacing this class with a bridge that
 * emits the same frames; nothing in state/ or ui/ needs to know.
 */
export class SensorStream {
  private frame: SensorFrame = initialSensorFrame();
  private injections = new Map<string, FaultInjection>();
  private paused = false;
  private tickCount = 0;
  private intervalId: number | null = null;
  private listeners: SensorFrameListener[] = [];

  onFrame(listener: SensorFrameListener) {
    this.listeners.push(listener);
  }

  start() {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.tick(), SENSOR_TICK_MS);
  }

  stop() {
    if (this.intervalId === null) return;
    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /** Line-wide pause, fanned in from the same switch that pauses the
   *  conveyor - a stopped line that keeps publishing cycle counts is the
   *  kind of detail an audience notices. */
  configure({ paused }: { paused: boolean }) {
    this.paused = paused;
  }

  setInjections(injections: readonly FaultInjection[]) {
    this.injections = new Map(injections.map((injection) => [injection.id, injection]));
  }

  /** Snap one machine's channels back to its healthy baseline. A
   *  recalibration removes the mechanical cause, so the arm stops shaking
   *  the moment it is done, not a dozen ticks later. */
  recover(robotId: RobotId) {
    this.frame = { ...this.frame, [robotId]: { ...initialSensorFrame()[robotId], cycles: this.frame[robotId].cycles } };
    this.emit();
  }

  reset() {
    this.frame = initialSensorFrame();
    this.injections.clear();
    this.tickCount = 0;
    // Emit immediately: the cards should land back on their baseline with
    // the reset, not a tick later.
    this.emit();
  }

  private tick() {
    if (this.paused) return;
    this.tickCount += 1;
    const next = {} as SensorFrame;
    for (const robotId of ROBOT_IDS) {
      const prev = this.frame[robotId];
      const reading: SensorReading = { ...prev, cycles: prev.cycles + (this.tickCount % 3 === 0 ? 1 : 0) };
      for (const channel of SENSOR_CHANNELS) {
        reading[channel] = step(robotId, channel, prev[channel], this.injections.get(injectionId(robotId, channel)));
      }
      next[robotId] = reading;
    }
    this.frame = next;
    this.emit();
  }

  private emit() {
    const timestamp = Date.now();
    for (const listener of this.listeners) listener(this.frame, timestamp);
  }
}
