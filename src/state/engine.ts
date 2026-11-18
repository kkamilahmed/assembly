// The bridge between the streaming layer and the store - the ONLY file
// that imports both `streaming/` and `state/store.ts`. Swapping in a real
// Kafka/Flink backend means replacing the CarProducer/DriftAnalyzer/
// SensorStream construction below with something exposing the same
// listener surface (a WebSocket bridge, most likely); nothing in
// state/store.ts, scene/, or ui/ needs to know the difference.
import { CarProducer } from '@/streaming/CarProducer';
import { DriftAnalyzer } from '@/streaming/DriftAnalyzer';
import { PROBLEM_ROBOT_ID, type RobotId } from '@/streaming/lineConfig';
import { SensorStream } from '@/streaming/sensorStream';
import { useStore } from './store';

// Only the weld station measures the cars it works on. Panel, paint and
// wheel are deterministic, visual-only stations.
const weldAnalyzer = new DriftAnalyzer(PROBLEM_ROBOT_ID);
const producer = new CarProducer();
const sensorStream = new SensorStream();

let initialized = false;

/** Start everything: the conveyor, the weld analyzer and the per-machine
 *  sensor stream. Idempotent. */
export function initEngine() {
  if (initialized) return;
  initialized = true;

  producer.init({ [PROBLEM_ROBOT_ID]: weldAnalyzer });
  producer.onCarSpawn((carId, timestamp) => useStore.getState().ingestCarSpawn(carId, timestamp));
  producer.onCarAdvance((carId, stationIndex, timestamp) => useStore.getState().advanceCar(carId, stationIndex, timestamp));
  producer.onCarSiding((carId, timestamp) => useStore.getState().ingestCarRework(carId, timestamp));
  producer.onCarExit((carId, timestamp) => useStore.getState().ingestCarExit(carId, timestamp));
  producer.onPauseShift((deltaMs) => useStore.getState().shiftDockedTimestamps(deltaMs));

  weldAnalyzer.onQCCheck((event) => useStore.getState().ingestQCCheck(event));
  weldAnalyzer.onWindowStats((event) => useStore.getState().ingestWindowStats(event));
  weldAnalyzer.onAction((event) => useStore.getState().ingestAction(event));

  sensorStream.onFrame((frame, timestamp) => useStore.getState().ingestSensorFrame(frame, timestamp));

  // The store owns no stream state and the streams own no store state: these
  // subscriptions are the one place that carries line state across.
  let prevPaused = useStore.getState().paused;
  let prevInjections = useStore.getState().injections;
  useStore.subscribe((state) => {
    if (state.paused !== prevPaused) {
      prevPaused = state.paused;
      producer.configure({ paused: state.paused });
      // The analyzer's trailing window is wall-clock aged, so it has to be
      // told about the stop too - otherwise stopping the line to look at a
      // fault silently ages every sample out from under it.
      weldAnalyzer.configure({ paused: state.paused });
      sensorStream.configure({ paused: state.paused });
    }
    if (state.injections !== prevInjections) {
      prevInjections = state.injections;
      sensorStream.setInjections(state.injections);
    }
  });

  producer.start();
  weldAnalyzer.start();
  sensorStream.start();
}

/** Physical torch offset - the mechanical "true" drift on a robot. Written
 *  by the story director's ramps and by recalibration. */
export function setRobotBias(robotId: RobotId, biasMm: number) {
  producer.setRobotBias(robotId, biasMm);
}

/** A recalibrated machine is a new process: zero its offset, drop the trend
 *  window that was measuring the old one, and settle its sensors. */
export function recalibrateMachine(robotId: RobotId) {
  producer.setRobotBias(robotId, 0);
  if (robotId === PROBLEM_ROBOT_ID) weldAnalyzer.reset();
  sensorStream.recover(robotId);
}

export function resetLine() {
  producer.reset();
  weldAnalyzer.reset();
  sensorStream.reset();
  useStore.getState().reset();
}
