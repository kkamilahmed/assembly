// Synthetic per-machine sensor feed for the fleet overview cards. The real
// simulation (streaming/, state/engine.ts) only models weld-alignment drift
// for WELD-01 — temperature/pressure/vibration don't exist as ground truth
// anywhere else in the app, so this is a self-contained, purely-cosmetic
// generator local to the fleet overview screen.
import { useEffect, useRef, useState } from 'react';
import type { RobotId } from '@/streaming/lineConfig';

interface MetricProfile {
  base: number;
  jitter: number;
  min: number;
  max: number;
}

interface RobotTelemetryProfile {
  temperature: MetricProfile;
  pressure: MetricProfile;
  vibration: MetricProfile;
  cyclesBase: number;
}

const PROFILES: Record<RobotId, RobotTelemetryProfile> = {
  'PANEL-01': {
    temperature: { base: 52, jitter: 1.4, min: 20, max: 100 },
    pressure: { base: 4.8, jitter: 0.15, min: 0, max: 10 },
    vibration: { base: 2.9, jitter: 0.3, min: 0, max: 10 },
    cyclesBase: 340,
  },
  'WELD-01': {
    temperature: { base: 71, jitter: 1.8, min: 20, max: 100 },
    pressure: { base: 5.0, jitter: 0.12, min: 0, max: 10 },
    vibration: { base: 3.6, jitter: 0.35, min: 0, max: 10 },
    cyclesBase: 410,
  },
  'PAINT-01': {
    temperature: { base: 58, jitter: 1.2, min: 20, max: 100 },
    pressure: { base: 4.6, jitter: 0.18, min: 0, max: 10 },
    vibration: { base: 2.4, jitter: 0.25, min: 0, max: 10 },
    cyclesBase: 300,
  },
  'WHEEL-01': {
    temperature: { base: 55, jitter: 1.3, min: 20, max: 100 },
    pressure: { base: 5.1, jitter: 0.14, min: 0, max: 10 },
    vibration: { base: 3.1, jitter: 0.28, min: 0, max: 10 },
    cyclesBase: 380,
  },
};

export interface FleetTelemetry {
  temperature: number;
  pressure: number;
  vibration: number;
  cycles: number;
}

// Mean-reverting random walk (a little pull back toward `base` each tick)
// instead of a plain random walk, so a long-idle session doesn't let a
// reading wander off and sit pinned at its min/max clamp.
function step(v: number, profile: MetricProfile): number {
  const pull = (profile.base - v) * 0.08;
  const noise = (Math.random() - 0.5) * profile.jitter * 2;
  return Math.min(profile.max, Math.max(profile.min, v + pull + noise));
}

const TICK_MS = 1400;

export function useFleetTelemetry(robotId: RobotId): FleetTelemetry {
  const profile = PROFILES[robotId];
  const [state, setState] = useState<FleetTelemetry>(() => ({
    temperature: profile.temperature.base,
    pressure: profile.pressure.base,
    vibration: profile.vibration.base,
    cycles: profile.cyclesBase,
  }));
  const tickCount = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickCount.current += 1;
      setState((s) => ({
        temperature: step(s.temperature, profile.temperature),
        pressure: step(s.pressure, profile.pressure),
        vibration: step(s.vibration, profile.vibration),
        cycles: s.cycles + (tickCount.current % 3 === 0 ? 1 : 0),
      }));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [profile]);

  return state;
}
