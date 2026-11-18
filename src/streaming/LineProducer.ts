import { random, resetRandom } from '@/presenter/rng';
import type { DriftAnalyzer } from './DriftAnalyzer';
import { BELT_SPEED, LINE_TICK_MS, PROBLEM_MACHINE_ID, TRAY_INTERVAL_MS, WEIGHT_SIGMA_MG } from './lineConfig';

/** Where along the belt (arc length, world units) each station acts. Passed
 *  in by the engine from the scene layout, so the stream and the picture
 *  agree on where the inspection and the reject gate are. */
export interface LineStations {
  inspect: number;
  reject: number;
  pack: number;
}

export interface LineProducerConfig {
  paused: boolean;
  /** How far off the target weight the press is currently making tablets,
   *  mg. The story director ramps this; recalibration zeroes it. */
  pressOffset: number;
}

interface Tray {
  id: string;
  /** Effective spawn time: shifted forward by every stop, so a tray's
   *  distance along the belt is always (now - spawnedAt) * speed. */
  spawnedAt: number;
  /** Mean tablet weight offset, fixed when the tray is pressed. */
  offset: number;
  failed: boolean | null;
  stage: 'pressed' | 'inspected' | 'done';
}

export type TraySpawnListener = (id: string, spawnedAt: number, offset: number) => void;
export type TrayRejectListener = (id: string, timestamp: number) => void;
export type TrayPackedListener = (id: string, timestamp: number) => void;
export type PauseShiftListener = (deltaMs: number) => void;

/** Box-Muller over the seedable stream, so a rehearsal reproduces. */
function gaussian(mean: number, stddev: number): number {
  const u = 1 - random();
  const v = random();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stddev;
}

let nextId = 1;

/**
 * A stand-in for the line's Kafka producers: the press puts a tray of
 * tablets on the belt every TRAY_INTERVAL_MS, at whatever weight it is
 * currently making them, hands each tray to inspection (the analyzer) as it
 * passes the camera and weigh cell, diverts failed trays into the reject bin
 * and sends the rest on to the blister packer.
 * Driven by wall-clock deadlines, not render frames, so it keeps time
 * whatever the frame rate.
 */
export class LineProducer {
  private config: LineProducerConfig = { paused: false, pressOffset: 0 };
  private stations: LineStations | null = null;
  private analyzer: DriftAnalyzer | null = null;
  private trays: Tray[] = [];
  private nextSpawnAt = 0;
  private pausedAt: number | null = null;
  private intervalId: number | null = null;

  private spawnListeners = new Set<TraySpawnListener>();
  private rejectListeners = new Set<TrayRejectListener>();
  private packedListeners = new Set<TrayPackedListener>();
  private pauseShiftListeners = new Set<PauseShiftListener>();

  init(stations: LineStations, analyzer: DriftAnalyzer) {
    this.stations = stations;
    this.analyzer = analyzer;
    analyzer.onQCCheck((event) => {
      const tray = this.trays.find((t) => t.id === event.item_id);
      if (tray) tray.failed = event.suspect;
    });
  }

  start() {
    if (this.intervalId !== null) return;
    this.nextSpawnAt = Date.now() + 300;
    this.intervalId = window.setInterval(() => this.tick(), LINE_TICK_MS);
  }

  reset() {
    resetRandom();
    this.config.pressOffset = 0;
    this.trays = [];
    this.pausedAt = null;
    this.nextSpawnAt = Date.now() + 300;
  }

  setPressOffset(offset: number) {
    this.config.pressOffset = offset;
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
    for (const tray of this.trays) tray.spawnedAt += shift;
    this.pauseShiftListeners.forEach((l) => l(shift));
  }

  onSpawn(l: TraySpawnListener) {
    this.spawnListeners.add(l);
  }
  onReject(l: TrayRejectListener) {
    this.rejectListeners.add(l);
  }
  onPacked(l: TrayPackedListener) {
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
      // Pressed at whatever weight the press is making as the tray fills.
      const tray: Tray = {
        id: `T${nextId++}`,
        spawnedAt: this.nextSpawnAt,
        offset: this.config.pressOffset + gaussian(0, WEIGHT_SIGMA_MG),
        failed: null,
        stage: 'pressed',
      };
      this.trays.push(tray);
      this.spawnListeners.forEach((l) => l(tray.id, tray.spawnedAt, tray.offset));
      this.nextSpawnAt += TRAY_INTERVAL_MS;
    }

    const st = this.stations;
    for (const tray of this.trays) {
      const s = ((now - tray.spawnedAt) / 1000) * BELT_SPEED;
      if (tray.stage === 'pressed' && s >= st.inspect) {
        tray.stage = 'inspected';
        this.analyzer.ingest({
          topic: 'measurements',
          machine_id: PROBLEM_MACHINE_ID,
          item_id: tray.id,
          timestamp: now,
          offset: tray.offset,
        });
      }
      if (tray.stage === 'inspected' && tray.failed && s >= st.reject) {
        tray.stage = 'done';
        this.rejectListeners.forEach((l) => l(tray.id, now));
      }
      if (tray.stage === 'inspected' && !tray.failed && s >= st.pack) {
        tray.stage = 'done';
        this.packedListeners.forEach((l) => l(tray.id, now));
      }
    }
    this.trays = this.trays.filter((t) => t.stage !== 'done');
  }
}
