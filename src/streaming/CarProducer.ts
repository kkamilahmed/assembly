import { v4 as uuidv4 } from 'uuid';
import { random, resetRandom } from '@/presenter/rng';
import type { DriftAnalyzer } from './DriftAnalyzer';
import {
  EXIT_STATION_INDEX,
  ROBOT_IDS,
  STATION_CYCLE_MS,
  WELD_PROCESS_SIGMA_MM,
  type RobotId,
} from './lineConfig';

export interface CarProducerConfig {
  paused: boolean;
  /** Per-robot signed deviation bias, mm — the mechanical "true" drift.
   * The story director ramps this up/down for the problem robot. */
  robotBiasMm: Record<RobotId, number>;
  /** Baseline per-weld process variation (1 sigma, mm), independent of
   * bias. See WELD_PROCESS_SIGMA_MM for why it's tight relative to the
   * spec limit. */
  noiseMm: number;
}

const DEFAULT_CONFIG: CarProducerConfig = {
  paused: false,
  robotBiasMm: Object.fromEntries(ROBOT_IDS.map((id) => [id, 0])) as unknown as Record<RobotId, number>,
  noiseMm: WELD_PROCESS_SIGMA_MM,
};

/** The one station that actually measures/QCs a weld this phase — see the
 * plan doc. Slot index derived from ROBOT_IDS so a future reorder can't
 * silently desync it from the station it's meant to point at. */
const WELD_ROBOT_ID: RobotId = 'WELD-01';
const WELD_SLOT_INDEX = ROBOT_IDS.indexOf(WELD_ROBOT_ID);

export type CarSpawnListener = (carId: string, timestamp: number) => void;
export type CarAdvanceListener = (carId: string, stationIndex: number, timestamp: number) => void;
export type CarSidingListener = (carId: string, timestamp: number) => void;
export type CarExitListener = (carId: string, timestamp: number) => void;
export type PauseShiftListener = (deltaMs: number) => void;

/** Box-Muller. Draws from the seedable stream, not Math.random, so a run is
 *  reproducible — see presenter/rng.ts. */
function gaussian(mean: number, stddev: number): number {
  const u = 1 - random();
  const v = random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stddev;
}

/**
 * A minimal in-browser stand-in for a Kafka producer scoped to the
 * assembly line — a walking-beam conveyor: every occupied station's car
 * advances one slot in lockstep on a shared cadence (STATION_CYCLE_MS),
 * dwells, then advances again. `slots[0..ROBOT_IDS.length-1]` are the real
 * stations; `slots[EXIT_STATION_INDEX]` is a one-cycle "exit lane" holding
 * cell so a car has time to visually glide off toward DESPAWN_X before
 * it's actually removed from the line. Uses a real wall-clock deadline
 * (`nextIndexAt`) rather than a render-frame loop, so scheduling stays
 * correct regardless of render performance.
 */
export class CarProducer {
  private config: CarProducerConfig = { ...DEFAULT_CONFIG };
  private analyzers: Partial<Record<RobotId, DriftAnalyzer>> = {};
  private intervalId: number | null = null;
  private nextIndexAt = 0;
  private slots: Array<string | null> = new Array(EXIT_STATION_INDEX + 1).fill(null);
  private pausedAt: number | null = null;
  /** Cars QC caught as suspect while dwelling at the weld slot, consumed
   * (and cleared) the moment routing decides where that car goes next. */
  private flaggedCarIds = new Set<string>();

  private carSpawnListeners = new Set<CarSpawnListener>();
  private carAdvanceListeners = new Set<CarAdvanceListener>();
  private carSidingListeners = new Set<CarSidingListener>();
  private carExitListeners = new Set<CarExitListener>();
  private pauseShiftListeners = new Set<PauseShiftListener>();

  init(analyzers: Partial<Record<RobotId, DriftAnalyzer>>) {
    this.analyzers = analyzers;
    analyzers[WELD_ROBOT_ID]?.onQCCheck((event) => {
      if (event.suspect) this.flaggedCarIds.add(event.car_id);
    });
  }

  start() {
    if (this.intervalId !== null) return;
    this.nextIndexAt = Date.now() + 800;
    this.intervalId = window.setInterval(() => this.tick(), 200);
  }

  stop() {
    if (this.intervalId !== null) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  reset() {
    resetRandom();
    // Zero the mechanical drift too. This used to reset the conveyor and
    // the counters but leave `robotBiasMm` wherever the interrupted ramp
    // had pushed it, because the bias is written from outside (the story
    // director) and nothing here owned clearing it. Resetting mid-incident
    // therefore produced a "fresh" line whose robot was still physically
    // misaligned: the trend jumped straight back above the control limit
    // from a standing start, and the incident timeline reported crossings
    // at negative offsets — before the fault it was measuring had begun.
    this.config.robotBiasMm = Object.fromEntries(
      ROBOT_IDS.map((id) => [id, 0]),
    ) as unknown as Record<RobotId, number>;
    this.slots = new Array(EXIT_STATION_INDEX + 1).fill(null);
    this.flaggedCarIds.clear();
    this.pausedAt = null;
    this.nextIndexAt = Date.now() + 800;
  }

  /** Direct setter for the story director's frequent ramp calls. */
  setRobotBias(robotId: RobotId, biasMm: number) {
    this.config.robotBiasMm = { ...this.config.robotBiasMm, [robotId]: biasMm };
  }

  configure(partial: Partial<CarProducerConfig>) {
    const { robotBiasMm, paused, ...rest } = partial;

    // Shift the index deadline forward by however long we were paused, so
    // resuming doesn't fire a burst of backlogged index steps — and tell
    // listeners the same delta so in-flight dwell timers (CarShell's
    // dockedAt) can shift too, or a paused animation would jump on resume.
    if (paused !== undefined && paused !== this.config.paused) {
      if (paused) {
        this.pausedAt = Date.now();
      } else if (this.pausedAt !== null) {
        const shift = Date.now() - this.pausedAt;
        this.nextIndexAt += shift;
        this.pausedAt = null;
        this.pauseShiftListeners.forEach((l) => l(shift));
      }
    }

    this.config = {
      ...this.config,
      ...rest,
      ...(paused !== undefined ? { paused } : {}),
      robotBiasMm: robotBiasMm ? { ...this.config.robotBiasMm, ...robotBiasMm } : this.config.robotBiasMm,
    };
  }

  getConfig(): CarProducerConfig {
    return this.config;
  }

  onCarSpawn(listener: CarSpawnListener) {
    this.carSpawnListeners.add(listener);
    return () => this.carSpawnListeners.delete(listener);
  }
  onCarAdvance(listener: CarAdvanceListener) {
    this.carAdvanceListeners.add(listener);
    return () => this.carAdvanceListeners.delete(listener);
  }
  onCarSiding(listener: CarSidingListener) {
    this.carSidingListeners.add(listener);
    return () => this.carSidingListeners.delete(listener);
  }
  onCarExit(listener: CarExitListener) {
    this.carExitListeners.add(listener);
    return () => this.carExitListeners.delete(listener);
  }
  onPauseShift(listener: PauseShiftListener) {
    this.pauseShiftListeners.add(listener);
    return () => this.pauseShiftListeners.delete(listener);
  }

  private tick() {
    if (this.config.paused) return;
    const now = Date.now();
    let guard = 0;
    while (now >= this.nextIndexAt && guard < 20) {
      this.indexStep(this.nextIndexAt);
      this.nextIndexAt += STATION_CYCLE_MS;
      guard++;
    }
  }

  /** One walking-beam step: evict the exit lane, advance every occupied
   * station forward one slot (high index -> low, so nothing overwrites a
   * slot before it's been read), then admit a new car into slot 0. */
  private indexStep(time: number) {
    const exiting = this.slots[EXIT_STATION_INDEX];
    if (exiting !== null) {
      this.slots[EXIT_STATION_INDEX] = null;
      this.carExitListeners.forEach((l) => l(exiting, time));
    }

    for (let i = ROBOT_IDS.length - 1; i >= 0; i--) {
      const carId = this.slots[i];
      if (carId === null) continue;

      if (i === WELD_SLOT_INDEX && this.flaggedCarIds.delete(carId)) {
        // QC caught this one while it dwelled here — divert to the rework
        // siding instead of continuing down the line.
        this.slots[i] = null;
        this.carSidingListeners.forEach((l) => l(carId, time));
        continue;
      }

      const destIndex = i + 1;
      this.slots[destIndex] = carId;
      this.slots[i] = null;
      this.carAdvanceListeners.forEach((l) => l(carId, destIndex, time));

      if (destIndex === WELD_SLOT_INDEX) this.fireWeldMeasurement(carId, time);
    }

    if (this.slots[0] === null) {
      const carId = uuidv4();
      this.slots[0] = carId;
      this.carSpawnListeners.forEach((l) => l(carId, time));
    }
  }

  private fireWeldMeasurement(carId: string, time: number) {
    const bias = this.config.robotBiasMm[WELD_ROBOT_ID] ?? 0;
    const deviation_mm = bias + gaussian(0, this.config.noiseMm);
    this.analyzers[WELD_ROBOT_ID]?.ingestWeld({
      topic: 'welds',
      robot_id: WELD_ROBOT_ID,
      car_id: carId,
      timestamp: time,
      deviation_mm,
    });
  }
}
