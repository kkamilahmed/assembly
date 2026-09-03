// The bridge between the streaming layer and the store — the ONLY file
// that imports both `streaming/` and `state/store.ts`. Swapping in a real
// Kafka/Flink backend means replacing the CarProducer/DriftAnalyzer
// construction below with something exposing the same listener surface
// (a WebSocket bridge, most likely); nothing in state/store.ts, scene/, or
// ui/ needs to know the difference.
import { CarProducer } from '@/streaming/CarProducer';
import { DriftAnalyzer } from '@/streaming/DriftAnalyzer';
import { SIDING_STATION_INDEX, type RobotId } from '@/streaming/lineConfig';
import { useStore } from './store';

// Only the Welding station runs the drift/QC pipeline — Panel/Paint/Wheel
// are deterministic, visual-only stations this phase (see the plan doc).
const ANALYZED_ROBOT_IDS = ['WELD-01'] as const satisfies readonly RobotId[];

const analyzers = Object.fromEntries(ANALYZED_ROBOT_IDS.map((id) => [id, new DriftAnalyzer(id)])) as Record<
  (typeof ANALYZED_ROBOT_IDS)[number],
  DriftAnalyzer
>;
const producer = new CarProducer();

const RECOVERY_REVEAL_MS = 7000;

let initialized = false;

export function initLineEngine() {
  if (initialized) return;
  initialized = true;

  producer.init(analyzers);
  producer.onCarSpawn((carId, timestamp) => useStore.getState().ingestCarSpawn(carId, timestamp));
  producer.onCarAdvance((carId, stationIndex, timestamp) => useStore.getState().advanceCar(carId, stationIndex, timestamp));
  producer.onCarSiding((carId, timestamp) => useStore.getState().advanceCar(carId, SIDING_STATION_INDEX, timestamp));
  producer.onCarExit((carId, timestamp) => useStore.getState().ingestCarExit(carId, timestamp));
  producer.onPauseShift((deltaMs) => useStore.getState().shiftDockedTimestamps(deltaMs));

  for (const robotId of ANALYZED_ROBOT_IDS) {
    const analyzer = analyzers[robotId];
    analyzer.onGroundTruth((weld, suspect) => useStore.getState().ingestGroundTruth(weld, suspect));
    analyzer.onQCCheck((event) => useStore.getState().ingestQCCheck(event));
    analyzer.onWindowStats((event) => useStore.getState().ingestWindowStats(event));
    analyzer.onAction((event) => useStore.getState().ingestAction(event));
    analyzer.start();
  }

  // Line-wide live-vision-QC toggle fans out to every robot's analyzer,
  // and reveals the silently-accumulated ground-truth gap the instant
  // monitoring comes back on.
  let prevLiveQC = useStore.getState().liveVisionQC;
  useStore.subscribe((state) => {
    if (state.liveVisionQC === prevLiveQC) return;
    const wasOff = !prevLiveQC;
    prevLiveQC = state.liveVisionQC;
    for (const analyzer of Object.values(analyzers)) analyzer.configure({ enabled: state.liveVisionQC });

    if (state.liveVisionQC && wasOff) {
      const gap = state.suspectWeldsGroundTruth - state.suspectWeldsCaught;
      if (gap > 0) {
        const expiresAt = Date.now() + RECOVERY_REVEAL_MS;
        useStore.getState().setRecoveryReveal({ gap, expiresAt });
        setTimeout(() => {
          const current = useStore.getState().recoveryReveal;
          if (current && current.expiresAt === expiresAt) useStore.getState().setRecoveryReveal(null);
        }, RECOVERY_REVEAL_MS);
      }
    }
  });

  let prevPaused = useStore.getState().paused;
  useStore.subscribe((state) => {
    if (state.paused === prevPaused) return;
    prevPaused = state.paused;
    producer.configure({ paused: state.paused });
  });

  producer.start();
}

/** Physical bias setter — the mechanical "true" drift on a robot. Used by
 * the story director's scripted ramps and by manual recalibration. */
export function setRobotBias(robotId: RobotId, biasMm: number) {
  producer.setRobotBias(robotId, biasMm);
}

export function resetLine() {
  producer.reset();
  for (const analyzer of Object.values(analyzers)) analyzer.reset();
  useStore.getState().reset();
}
