import * as THREE from 'three';
import { LINE_END_X, LINE_START_X, ROBOT_X } from '@/scene/constants';
import { PROBLEM_ROBOT_ID } from '@/streaming/lineConfig';

export interface ShotDef {
  id: number;
  duration: number; // seconds
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startLookAt: THREE.Vector3;
  endLookAt: THREE.Vector3;
}

const midX = (LINE_START_X + LINE_END_X) / 2;
const problemX = ROBOT_X[PROBLEM_ROBOT_ID];

// A short scripted intro: wide establishing flythrough down the line, a
// push into the problem robot's station, then settle into the overview
// angle OrbitControls hands off to. Coords are in metres (real-world scale).
export const SHOTS: ShotDef[] = [
  {
    id: 0,
    duration: 4,
    startPos: new THREE.Vector3(LINE_START_X - 10, 16, -14),
    endPos: new THREE.Vector3(midX, 12, -13),
    startLookAt: new THREE.Vector3(LINE_START_X, 1.2, 0),
    endLookAt: new THREE.Vector3(midX, 1.2, 0),
  },
  {
    id: 1,
    duration: 3.5,
    startPos: new THREE.Vector3(midX, 12, -13),
    endPos: new THREE.Vector3(problemX + 5, 4.5, -6),
    startLookAt: new THREE.Vector3(midX, 1.2, 0),
    endLookAt: new THREE.Vector3(problemX, 2, -1.5),
  },
  {
    id: 2,
    duration: 3,
    startPos: new THREE.Vector3(problemX + 5, 4.5, -6),
    endPos: new THREE.Vector3(midX + 4, 10, 16),
    startLookAt: new THREE.Vector3(problemX, 2, -1.5),
    endLookAt: new THREE.Vector3(midX, 1.2, 0),
  },
];

export const TOTAL_CINEMATIC_DURATION = SHOTS.reduce((a, s) => a + s.duration, 0);
