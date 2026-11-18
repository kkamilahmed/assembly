// The bridge between the streaming layer and the store - the ONLY file that
// imports both `streaming/` and `state/store.ts`. Swapping in a real
// Kafka/Flink backend means replacing the LineProducer/DriftAnalyzer/
// SensorStream construction below with something exposing the same listener
// surface (a WebSocket bridge, most likely); nothing in state/store.ts,
// scene/ or ui/ needs to know the difference.
import { STATION_S } from '@/scene/layout';
import { DriftAnalyzer } from '@/streaming/DriftAnalyzer';
import { LineProducer } from '@/streaming/LineProducer';
import { PROBLEM_MACHINE_ID, type MachineId } from '@/streaming/lineConfig';
import { SensorStream } from '@/streaming/sensorStream';
import { useStore } from './store';

// The weld check scores every module the laser welder welds.
const inspection = new DriftAnalyzer(PROBLEM_MACHINE_ID);
const producer = new LineProducer();
const sensorStream = new SensorStream();

let initialized = false;

/** Start everything: the line, the inspection analyzer and the sensor
 *  stream. Idempotent. */
export function initEngine() {
  if (initialized) return;
  initialized = true;

  producer.init(
    { weldOut: STATION_S.weldOut, inspect: STATION_S.inspect, reject: STATION_S.reject, ship: STATION_S.ship },
    inspection,
  );
  producer.onSpawn((id, spawnedAt) => useStore.getState().ingestModuleSpawn(id, spawnedAt));
  producer.onWelded((id, offset) => useStore.getState().ingestModuleWelded(id, offset));
  producer.onScrap((id, timestamp) => useStore.getState().ingestModuleScrap(id, timestamp));
  producer.onShipped((id) => useStore.getState().ingestModuleShipped(id));
  producer.onPauseShift((deltaMs) => useStore.getState().shiftModuleTimestamps(deltaMs));

  inspection.onQCCheck((event) => useStore.getState().ingestQCCheck(event));
  inspection.onWindowStats((event) => useStore.getState().ingestWindowStats(event));
  inspection.onAction((event) => useStore.getState().ingestAction(event));

  sensorStream.onFrame((frame, timestamp) => useStore.getState().ingestSensorFrame(frame, timestamp));

  // The store owns no stream state and the streams own no store state: this
  // subscription is the one place that carries line state across.
  let prevPaused = useStore.getState().paused;
  let prevInjections = useStore.getState().injections;
  useStore.subscribe((state) => {
    if (state.paused !== prevPaused) {
      prevPaused = state.paused;
      producer.configure({ paused: state.paused });
      inspection.configure({ paused: state.paused });
      sensorStream.configure({ paused: state.paused });
    }
    if (state.injections !== prevInjections) {
      prevInjections = state.injections;
      sensorStream.setInjections(state.injections);
    }
  });

  producer.start();
  inspection.start();
  sensorStream.start();
}

/** How far below nominal the laser is welding, N. Written by the story
 *  director's ramps and by recalibration. */
export function setWeldOffset(offset: number) {
  producer.setWeldOffset(offset);
}

/** A recalibrated machine is a new process: back on setpoint, the trend
 *  window that measured the old one dropped, sensors settled. */
export function recalibrateMachine(machineId: MachineId) {
  if (machineId === PROBLEM_MACHINE_ID) {
    producer.setWeldOffset(0);
    inspection.reset();
  }
  sensorStream.recover(machineId);
}

/** Settle one machine's sensors without touching the line, e.g. the tester
 *  once the weak modules that were heating it have gone to scrap. */
export function recoverSensors(machineId: MachineId) {
  sensorStream.recover(machineId);
}

export function resetLine() {
  producer.reset();
  inspection.reset();
  sensorStream.reset();
  useStore.getState().reset();
}
