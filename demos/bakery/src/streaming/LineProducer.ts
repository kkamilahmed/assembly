import { random, resetRandom } from '@/presenter/rng';
import type { DriftAnalyzer } from './DriftAnalyzer';
import { BELT_SPEED, BROWNING_SIGMA, LINE_TICK_MS, LOAF_INTERVAL_MS, PROBLEM_MACHINE_ID } from './lineConfig';

/** Where along the belt (arc length, world units) each station acts. Passed
 *  in by the engine from the scene layout, so the stream and the picture
 *  agree on where the oven and the inspection are. */
export interface LineStations {
  ovenOut: number;
  inspect: number;
  reject: number;
  pack: number;
}

export interface LineProducerConfig {
  paused: boolean;
  /** How far over the browning target the oven is currently baking. The
   *  story director ramps this; recalibration zeroes it. */
  ovenOffset: number;
}

interface Loaf {
  id: string;
  /** Effective spawn time: shifted forward by every stop, so a loaf's
   *  distance along the belt is always (now - spawnedAt) * speed. */
  spawnedAt: number;
  offset: number | null;
  failed: boolean | null;
  stage: 'proving' | 'baked' | 'inspected' | 'done';
}

export type LoafSpawnListener = (id: string, spawnedAt: number) => void;
export type LoafBakedListener = (id: string, offset: number, timestamp: number) => void;
export type LoafRejectListener = (id: string, timestamp: number) => void;
export type LoafPackedListener = (id: string, timestamp: number) => void;
export type PauseShiftListener = (deltaMs: number) => void;

/** Box-Muller over the seedable stream, so a rehearsal reproduces. */
function gaussian(mean: number, stddev: number): number {
  const u = 1 - random();
  const v = random();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stddev;
}

let nextId = 1;

/**
 * A stand-in for the line's Kafka producers: drops a dough piece on the belt
 * every LOAF_INTERVAL_MS, bakes it at whatever the oven is currently doing,
 * hands each loaf to vision inspection (the analyzer) as it passes the
 * camera, kicks failed loaves into the reject bin and packs the rest.
 * Driven by wall-clock deadlines, not render frames, so it keeps time
 * whatever the frame rate.
 */
export class LineProducer {
  private config: LineProducerConfig = { paused: false, ovenOffset: 0 };
  private stations: LineStations | null = null;
  private analyzer: DriftAnalyzer | null = null;
  private loaves: Loaf[] = [];
  private nextSpawnAt = 0;
  private pausedAt: number | null = null;
  private intervalId: number | null = null;

  private spawnListeners = new Set<LoafSpawnListener>();
  private bakedListeners = new Set<LoafBakedListener>();
  private rejectListeners = new Set<LoafRejectListener>();
  private packedListeners = new Set<LoafPackedListener>();
  private pauseShiftListeners = new Set<PauseShiftListener>();

  init(stations: LineStations, analyzer: DriftAnalyzer) {
    this.stations = stations;
    this.analyzer = analyzer;
    analyzer.onQCCheck((event) => {
      const loaf = this.loaves.find((l) => l.id === event.item_id);
      if (loaf) loaf.failed = event.suspect;
    });
  }

  start() {
    if (this.intervalId !== null) return;
    this.nextSpawnAt = Date.now() + 300;
    this.intervalId = window.setInterval(() => this.tick(), LINE_TICK_MS);
  }

  reset() {
    resetRandom();
    this.config.ovenOffset = 0;
    this.loaves = [];
    this.pausedAt = null;
    this.nextSpawnAt = Date.now() + 300;
  }

  setOvenOffset(offset: number) {
    this.config.ovenOffset = offset;
  }

  configure({ paused }: { paused: boolean }) {
    if (paused === this.config.paused) return;
    this.config.paused = paused;
    if (paused) {
      this.pausedAt = Date.now();
      return;
    }
    if (this.pausedAt === null) return;
    // Shift every schedule forward by the stop, so the line resumes exactly
    // where it froze instead of jumping.
    const shift = Date.now() - this.pausedAt;
    this.pausedAt = null;
    this.nextSpawnAt += shift;
    for (const loaf of this.loaves) loaf.spawnedAt += shift;
    this.pauseShiftListeners.forEach((l) => l(shift));
  }

  onSpawn(l: LoafSpawnListener) {
    this.spawnListeners.add(l);
  }
  onBaked(l: LoafBakedListener) {
    this.bakedListeners.add(l);
  }
  onReject(l: LoafRejectListener) {
    this.rejectListeners.add(l);
  }
  onPacked(l: LoafPackedListener) {
    this.packedListeners.add(l);
  }
  onPauseShift(l: PauseShiftListener) {
    this.pauseShiftListeners.add(l);
  }

  private tick() {
    if (this.config.paused || !this.stations || !this.analyzer) return;
    const now = Date.now();

    let guard = 0;
    while (now >= this.nextSpawnAt && guard++ < 10) {
      const loaf: Loaf = { id: `L${nextId++}`, spawnedAt: this.nextSpawnAt, offset: null, failed: null, stage: 'proving' };
      this.loaves.push(loaf);
      this.spawnListeners.forEach((l) => l(loaf.id, loaf.spawnedAt));
      this.nextSpawnAt += LOAF_INTERVAL_MS;
    }

    const st = this.stations;
    for (const loaf of this.loaves) {
      const s = ((now - loaf.spawnedAt) / 1000) * BELT_SPEED;
      if (loaf.stage === 'proving' && s >= st.ovenOut) {
        // Baked at whatever the oven is doing as the loaf leaves it.
        loaf.offset = this.config.ovenOffset + gaussian(0, BROWNING_SIGMA);
        loaf.stage = 'baked';
        this.bakedListeners.forEach((l) => l(loaf.id, loaf.offset!, now));
      }
      if (loaf.stage === 'baked' && s >= st.inspect) {
        loaf.stage = 'inspected';
        this.analyzer.ingest({
          topic: 'measurements',
          machine_id: PROBLEM_MACHINE_ID,
          item_id: loaf.id,
          timestamp: now,
          offset: loaf.offset!,
        });
      }
      if (loaf.stage === 'inspected' && loaf.failed && s >= st.reject) {
        loaf.stage = 'done';
        this.rejectListeners.forEach((l) => l(loaf.id, now));
      }
      if (loaf.stage === 'inspected' && !loaf.failed && s >= st.pack) {
        loaf.stage = 'done';
        this.packedListeners.forEach((l) => l(loaf.id, now));
      }
    }
    this.loaves = this.loaves.filter((l) => l.stage !== 'done');
  }
}
