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
  let offSnapshot: { at: number; groundTruthAt: number; caughtAt: number } | null = null;
  useStore.subscribe((state) => {
    if (state.liveVisionQC === prevLiveQC) return;
    const wasOff = !prevLiveQC;
    prevLiveQC = state.liveVisionQC;
    if (!state.liveVisionQC) offSnapshot = state.qcOffSince;
    for (const analyzer of Object.values(analyzers)) analyzer.configure({ enabled: state.liveVisionQC });

    if (state.liveVisionQC && wasOff) {
      // Bill exactly this off-period against the snapshot taken when
      // inspection went dark (store.ts's qcOffSince), not the session
      // running total — toggling twice used to re-report the first
      // period's gap on top of the second one's.
      const since = offSnapshot;
      const gap = since
        ? state.suspectWeldsGroundTruth - since.groundTruthAt - (state.suspectWeldsCaught - since.caughtAt)
        : state.suspectWeldsGroundTruth - state.suspectWeldsCaught;
      // Turn the grey question marks still on the line red before the
      // banner appears, so the number in the banner is describing something
      // the audience can already see.
      useStore.getState().revealUninspectedDefects();
      if (gap > 0) {
        // No expiry. This is the punchline of the whole demo and it used to
        // fade itself out after 7s (against a 6s CSS animation, so it also
        // sat invisible for a second before unmounting) — which meant it
        // could vanish mid-sentence. It now stays until dismissed.
        useStore.getState().setRecoveryReveal({
          gap,
          durationMs: since ? Date.now() - since.at : 0,
        });
      }
    }
  });

  let prevPaused = useStore.getState().paused;
  useStore.subscribe((state) => {
    if (state.paused === prevPaused) return;
    prevPaused = state.paused;
    producer.configure({ paused: state.paused });
    // The analyzers' trailing window is wall-clock aged, so it has to be
    // told about the pause too — otherwise pausing to talk about an
    // incident silently ages every sample out from under it and the trend
    // decays to zero while the line is standing still.
    for (const analyzer of Object.values(analyzers)) analyzer.configure({ paused: state.paused });
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
