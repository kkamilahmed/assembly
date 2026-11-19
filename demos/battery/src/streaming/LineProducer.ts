import { random, resetRandom } from '@/presenter/rng';
import type { DriftAnalyzer } from './DriftAnalyzer';
import { BELT_SPEED, LINE_TICK_MS, MODULE_INTERVAL_MS, PROBLEM_MACHINE_ID, WELD_SIGMA_N } from './lineConfig';

/** Where along the belt (arc length, world units) each station acts. Passed
 *  in by the engine from the scene layout, so the stream and the picture
 *  agree on where the welder and the weld check are. */
export interface LineStations {
  weldOut: number;
  inspect: number;
  reject: number;
  ship: number;
}

export interface LineProducerConfig {
  paused: boolean;
  /** How far below nominal the laser is currently welding, N. The story
   *  director ramps this; recalibration zeroes it. */
  weldOffset: number;
}

interface Module {
  id: string;
  /** Effective spawn time: shifted forward by every stop, so a module's
   *  distance along the belt is always (now - spawnedAt) * speed. */
  spawnedAt: number;
  offset: number | null;
  failed: boolean | null;
  stage: 'cells' | 'welded' | 'checked' | 'done';
}

export type ModuleSpawnListener = (id: string, spawnedAt: number) => void;
export type ModuleWeldedListener = (id: string, offset: number, timestamp: number) => void;
export type ModuleScrapListener = (id: string, timestamp: number) => void;
export type ModuleShippedListener = (id: string, timestamp: number) => void;
export type PauseShiftListener = (deltaMs: number) => void;

/** Box-Muller over the seedable stream, so a rehearsal reproduces. */
function gaussian(mean: number, stddev: number): number {
  const u = 1 - random();
  const v = random();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stddev;
}

let nextId = 1;

/**
 * A stand-in for the line's Kafka producers: drops a carrier of sorted cells
 * on the belt every MODULE_INTERVAL_MS, welds it at whatever the laser is
 * currently doing, hands each module to the weld check (the analyzer) as it
 * passes the camera, diverts failed modules to scrap at the reject station
 * and ships the rest to the AGVs. Driven by wall-clock deadlines, not
 * render frames, so it keeps time whatever the frame rate.
 */
export class LineProducer {
  private config: LineProducerConfig = { paused: false, weldOffset: 0 };
  private stations: LineStations | null = null;
  private analyzer: DriftAnalyzer | null = null;
  private modules: Module[] = [];
  private nextSpawnAt = 0;
  private pausedAt: number | null = null;
  private intervalId: number | null = null;

  private spawnListeners = new Set<ModuleSpawnListener>();
  private weldedListeners = new Set<ModuleWeldedListener>();
  private scrapListeners = new Set<ModuleScrapListener>();
  private shippedListeners = new Set<ModuleShippedListener>();
  private pauseShiftListeners = new Set<PauseShiftListener>();

  init(stations: LineStations, analyzer: DriftAnalyzer) {
    this.stations = stations;
    this.analyzer = analyzer;
    analyzer.onQCCheck((event) => {
      const module = this.modules.find((m) => m.id === event.item_id);
      if (module) module.failed = event.suspect;
    });
  }

  start() {
    if (this.intervalId !== null) return;
    this.nextSpawnAt = Date.now() + 300;
    this.intervalId = window.setInterval(() => this.tick(), LINE_TICK_MS);
  }

  reset() {
    resetRandom();
    this.config.weldOffset = 0;
    this.modules = [];
    this.pausedAt = null;
    this.nextSpawnAt = Date.now() + 300;
  }

  setWeldOffset(offset: number) {
    this.config.weldOffset = offset;
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
    for (const module of this.modules) module.spawnedAt += shift;
    this.pauseShiftListeners.forEach((l) => l(shift));
  }

  onSpawn(l: ModuleSpawnListener) {
    this.spawnListeners.add(l);
  }
  onWelded(l: ModuleWeldedListener) {
    this.weldedListeners.add(l);
  }
  onScrap(l: ModuleScrapListener) {
    this.scrapListeners.add(l);
  }
  onShipped(l: ModuleShippedListener) {
    this.shippedListeners.add(l);
  }
  onPauseShift(l: PauseShiftListener) {
    this.pauseShiftListeners.add(l);
  }

  private tick() {
    if (this.config.paused || !this.stations || !this.analyzer) return;
    const now = Date.now();

    let guard = 0;
    while (now >= this.nextSpawnAt && guard++ < 10) {
      const module: Module = { id: `M${nextId++}`, spawnedAt: this.nextSpawnAt, offset: null, failed: null, stage: 'cells' };
      this.modules.push(module);
      this.spawnListeners.forEach((l) => l(module.id, module.spawnedAt));
      this.nextSpawnAt += MODULE_INTERVAL_MS;
    }

    const st = this.stations;
    for (const module of this.modules) {
      const s = ((now - module.spawnedAt) / 1000) * BELT_SPEED;
      if (module.stage === 'cells' && s >= st.weldOut) {
        // Welded at whatever the laser is doing as the module leaves it.
        module.offset = this.config.weldOffset + gaussian(0, WELD_SIGMA_N);
        module.stage = 'welded';
        this.weldedListeners.forEach((l) => l(module.id, module.offset!, now));
      }
      if (module.stage === 'welded' && s >= st.inspect) {
        module.stage = 'checked';
        this.analyzer.ingest({
          topic: 'measurements',
          machine_id: PROBLEM_MACHINE_ID,
          item_id: module.id,
          timestamp: now,
          offset: module.offset!,
        });
      }
      if (module.stage === 'checked' && module.failed && s >= st.reject) {
        module.stage = 'done';
        this.scrapListeners.forEach((l) => l(module.id, now));
      }
      if (module.stage === 'checked' && !module.failed && s >= st.ship) {
        module.stage = 'done';
        this.shippedListeners.forEach((l) => l(module.id, now));
      }
    }
    this.modules = this.modules.filter((m) => m.stage !== 'done');
  }
}
