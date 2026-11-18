// Per-machine process sensors, plus the manual fault injection that drives
// them out of range.
//
// Every machine publishes three channels. The channel keys are generic
// (process, feed, mechanical) so the stream, the store and the cards can
// treat every machine alike; what each one means on a given machine (press
// compression force, fill depth, ejection force...) lives in SENSOR_SPECS.
//
// Most channels go wrong upward (a seal jaw running hot). Some go wrong
// downward (a press losing compression force); those are marked `low`, and
// their limits sit below the healthy base instead of above it.
//
// Generation is a mean-reverting random walk so a long-idle session never
// wanders off and pins at a limit nobody injected.
import { MACHINE_IDS, type MachineId } from './lineConfig';

export const SENSOR_CHANNELS = ['process', 'feed', 'mechanical'] as const;
export type SensorChannel = (typeof SENSOR_CHANNELS)[number];

/** Machine-independent names, for places that pick a channel across the
 *  whole fleet (the fault-injection panel). */
export const CHANNEL_NAMES: Record<SensorChannel, string> = {
  process: 'Process',
  feed: 'Feed',
  mechanical: 'Mechanical',
};

export type SensorSeverity = 'healthy' | 'warning' | 'critical';

export interface ChannelSpec {
  label: string;
  unit: string;
  /** Whether the unit reads with a space after the number ("62 %") or not
   *  ("41.2°C"). */
  unitGap: boolean;
  /** Ends of the displayed scale. The end a fault drives toward (`max`, or
   *  `min` for a low channel) doubles as the point an injection ramps
   *  toward, so a level-20 fault pins the channel at full scale. */
  min: number;
  max: number;
  warn: number;
  critical: number;
  /** Goes wrong downward: warn and critical sit below the base. */
  low?: boolean;
  decimals: number;
  /** Healthy operating point and run-to-run wobble. */
  base: number;
  jitter: number;
}

type MachineSpecs = Record<SensorChannel, ChannelSpec>;

const temp = (label: string, min: number, max: number, warn: number, critical: number, base: number, jitter: number): ChannelSpec => ({
  label, unit: '°C', unitGap: false, min, max, warn, critical, decimals: 1, base, jitter,
});
const pct = (label: string, warn: number, critical: number, base: number, jitter: number): ChannelSpec => ({
  label, unit: '%', unitGap: false, min: 0, max: 100, warn, critical, decimals: 0, base, jitter,
});
const vib = (label: string, base: number, jitter: number): ChannelSpec => ({
  label, unit: 'mm/s', unitGap: true, min: 0, max: 10, warn: 5.5, critical: 7.2, decimals: 2, base, jitter,
});

export const SENSOR_SPECS: Record<MachineId, MachineSpecs> = {
  'BLEND-01': {
    process: { label: 'Blend RSD', unit: '%', unitGap: false, min: 0, max: 10, warn: 4, critical: 6, decimals: 1, base: 1.8, jitter: 0.08 },
    feed: pct('Motor load', 82, 92, 46, 2.2),
    mechanical: vib('Frame vibration', 2.4, 0.22),
  },
  'PRESS-P2': {
    process: { label: 'Compression force', unit: 'kN', unitGap: true, min: 8, max: 24, warn: 16.6, critical: 14.6, low: true, decimals: 1, base: 18, jitter: 0.08 },
    feed: { label: 'Fill depth', unit: 'mm', unitGap: true, min: 3, max: 4.4, warn: 3.68, critical: 3.5, low: true, decimals: 2, base: 3.8, jitter: 0.006 },
    mechanical: { label: 'Ejection force', unit: 'kN', unitGap: true, min: 0, max: 5, warn: 2, critical: 3, decimals: 2, base: 0.82, jitter: 0.03 },
  },
  'COAT-01': {
    process: temp('Bed temp', 30, 60, 46, 50, 41, 0.25),
    feed: { label: 'Spray rate', unit: 'g/min', unitGap: true, min: 0, max: 400, warn: 300, critical: 340, decimals: 0, base: 220, jitter: 3 },
    mechanical: vib('Pan vibration', 2.1, 0.2),
  },
  'VISION-01': {
    process: temp('Camera temp', 20, 70, 50, 58, 36, 0.4),
    feed: pct('Inference load', 85, 95, 41, 3),
    mechanical: vib('Gantry vibration', 0.8, 0.1),
  },
  'BLISTER-01': {
    process: temp('Seal temp', 120, 220, 186, 196, 165, 0.8),
    feed: pct('Motor load', 82, 92, 54, 2.5),
    mechanical: vib('Frame vibration', 3.1, 0.3),
  },
  'CARTON-01': {
    process: temp('Glue temp', 130, 190, 172, 180, 158, 0.6),
    feed: pct('Motor load', 82, 92, 49, 2.4),
    mechanical: vib('Frame vibration', 2.7, 0.26),
  },
};

export function channelSpec(machineId: MachineId, channel: SensorChannel): ChannelSpec {
  return SENSOR_SPECS[machineId][channel];
}

export function channelSeverity(machineId: MachineId, channel: SensorChannel, value: number): SensorSeverity {
  const spec = channelSpec(machineId, channel);
  const past = (limit: number) => (spec.low ? value <= limit : value >= limit);
  if (past(spec.critical)) return 'critical';
  if (past(spec.warn)) return 'warning';
  return 'healthy';
}

export function formatReading(machineId: MachineId, channel: SensorChannel, value: number): string {
  const spec = channelSpec(machineId, channel);
  return `${value.toFixed(spec.decimals)}${spec.unitGap ? ' ' : ''}${spec.unit}`;
}

/** "120-220°C · limits 186 / 196" - a reading means nothing without the
 *  scale it sits on and the lines it is judged against. */
export function channelRangeLabel(machineId: MachineId, channel: SensorChannel): string {
  const spec = channelSpec(machineId, channel);
  const gap = spec.unitGap ? ' ' : '';
  return `${spec.min}-${spec.max}${gap}${spec.unit} · limits ${spec.warn} / ${spec.critical}`;
}

export interface SensorReading {
  process: number;
  feed: number;
  mechanical: number;
  cycles: number;
}

export type SensorFrame = Record<MachineId, SensorReading>;

const CYCLES_BASE: Record<MachineId, number> = {
  'BLEND-01': 312,
  'PRESS-P2': 48_120,
  'COAT-01': 1_406,
  'VISION-01': 47_985,
  'BLISTER-01': 9_870,
  'CARTON-01': 4_935,
};

export function initialSensorFrame(): SensorFrame {
  return Object.fromEntries(
    MACHINE_IDS.map((id) => [
      id,
      {
        process: SENSOR_SPECS[id].process.base,
        feed: SENSOR_SPECS[id].feed.base,
        mechanical: SENSOR_SPECS[id].mechanical.base,
        cycles: CYCLES_BASE[id],
      } satisfies SensorReading,
    ]),
  ) as Record<MachineId, SensorReading>;
}

export const INTENSITY_MIN = 1;
export const INTENSITY_MAX = 20;

export interface FaultInjection {
  /** `${machineId}:${channel}`. One injection per machine+channel pair, so
   *  re-injecting a pair retunes it rather than stacking a second fault on
   *  top of the first. */
  id: string;
  machineId: MachineId;
  channel: SensorChannel;
  /** 1..INTENSITY_MAX. */
  intensity: number;
  startedAt: number;
  /** `manual` came from the fault-injection panel. `scenario` is the
   *  physical side effect of the presenter's D / E deviation: a press with a
   *  worn punch shows it in its fill depth and compression force. Only manual
   *  injections are badged on the dashboard, because a scenario fault is
   *  meant to read as the machine genuinely misbehaving. */
  source: 'manual' | 'scenario';
}

export const injectionId = (machineId: MachineId, channel: SensorChannel) => `${machineId}:${channel}`;

/** Where an injected channel settles: a fraction of the way from this
 *  machine's healthy base to the end of the channel's scale it fails
 *  toward, set by intensity. Bases differ per machine, so one intensity
 *  lands at different severities across the fleet - which is exactly what
 *  makes injecting all of them at once worth looking at. */
export function injectionTarget(machineId: MachineId, channel: SensorChannel, intensity: number): number {
  const spec = SENSOR_SPECS[machineId][channel];
  const end = spec.low ? spec.min : spec.max;
  return spec.base + (end - spec.base) * (intensity / INTENSITY_MAX);
}

/** What an injection at this intensity will settle at, before it is armed -
 *  so the panel can say what the slider is about to do rather than making
 *  you press Inject to find out. */
export function injectionSeverity(machineId: MachineId, channel: SensorChannel, intensity: number): SensorSeverity {
  return channelSeverity(machineId, channel, injectionTarget(machineId, channel, intensity));
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

/** The edge of the healthy envelope on the side the channel fails toward. */
function healthyEdge(machineId: MachineId, channel: SensorChannel): number {
  const spec = SENSOR_SPECS[machineId][channel];
  return spec.base + (spec.warn - spec.base) * HEALTHY_ENVELOPE;
}

function step(machineId: MachineId, channel: SensorChannel, value: number, injection: FaultInjection | undefined): number {
  const spec = SENSOR_SPECS[machineId][channel];
  const target = injection ? injectionTarget(machineId, channel, injection.intensity) : spec.base;
  // Work in "toward the limit" space, so a low channel is the same walk as
  // a high one mirrored about its base.
  const dir = spec.low ? -1 : 1;
  const edge = healthyEdge(machineId, channel);
  // Past its healthy envelope with nothing injected into it: this channel
  // is on its way back from a fault that was just cleared.
  const recovering = !injection && (value - edge) * dir > 0;
  const pull = injection ? INJECTED_PULL : recovering ? RECOVERY_PULL : HEALTHY_PULL;
  // A failing machine does not just read off, it reads unstable - so jitter
  // scales with intensity. A level-20 fault visibly rattles instead of
  // sitting at a suspiciously steady number.
  const jitter = spec.jitter * (injection ? 1 + injection.intensity / 8 : 1);
  const noise = (Math.random() - 0.5) * jitter * 2;
  const next = value + (target - value) * pull + noise;
  const clamp = (v: number) => Math.min(spec.max, Math.max(spec.min, v));

  if (injection) return clamp(next);
  // Uninjected readings reflect off the envelope rather than being clamped
  // flat against it - a reading that pins to a constant limit for six
  // seconds looks exactly as synthetic as it is. A channel still recovering
  // reflects off its own current value instead, so it can only come back.
  const bound = dir * Math.max(edge * dir, value * dir);
  return clamp((next - bound) * dir > 0 ? bound - (next - bound) : next);
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
   *  recalibration removes the cause, so the machine settles
   *  the moment it is done, not a dozen ticks later. */
  recover(machineId: MachineId) {
    this.frame = { ...this.frame, [machineId]: { ...initialSensorFrame()[machineId], cycles: this.frame[machineId].cycles } };
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
    for (const machineId of MACHINE_IDS) {
      const prev = this.frame[machineId];
      const reading: SensorReading = { ...prev, cycles: prev.cycles + (this.tickCount % 3 === 0 ? 1 : 0) };
      for (const channel of SENSOR_CHANNELS) {
        reading[channel] = step(machineId, channel, prev[channel], this.injections.get(injectionId(machineId, channel)));
      }
      next[machineId] = reading;
    }
    this.frame = next;
    this.emit();
  }

  private emit() {
    const timestamp = Date.now();
    for (const listener of this.listeners) listener(this.frame, timestamp);
  }
}
