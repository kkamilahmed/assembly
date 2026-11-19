import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/state/store';
import { BELT_SPEED } from '@/streaming/lineConfig';
import { BELT_Y, LINE_LENGTH, LINE_PATH, MACHINE_POS, STATION_S } from './layout';
import {
  flagMaterial,
  MODULE,
  moduleBusbarGeometry,
  moduleCaseGeometry,
  moduleCellsGeometry,
  moduleFrameGeometry,
  moduleMaterial,
  rejectFlagGeometry,
} from './props/module';

const CAPACITY = 120;
/** Height of the carrier's base above the belt surface. */
const SIT = 0.004;
/** How long a scrapped module takes to slide into the scrap cage. */
const KICK_MS = 520;

const tmpPos = new THREE.Vector3();
const tmpTan = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const ONE = new THREE.Vector3(1, 1, 1);
const tmpMat = new THREE.Matrix4();
const flagMat = new THREE.Matrix4();
const lift = new THREE.Matrix4();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const gatePos = new THREE.Vector3();
const binPos = new THREE.Vector3(MACHINE_POS.rejectBin.x, 0.42, MACHINE_POS.rejectBin.z);

LINE_PATH.getPointAt(STATION_S.reject / LINE_LENGTH, gatePos);
gatePos.y = BELT_Y + SIT;

/** Every module on the line, as one instanced mesh per build stage. Positions
 *  come from each module's spawn time and the belt speed, and its stage from
 *  how far it has travelled, so the picture can never disagree with the
 *  stream about where a module is or what has been done to it. A module the
 *  weld check failed carries a red flag from the camera to the scrap cage. */
export function Modules() {
  const cells = useRef<THREE.InstancedMesh>(null);
  const frame = useRef<THREE.InstancedMesh>(null);
  const bus = useRef<THREE.InstancedMesh>(null);
  const cased = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const meshes = [cells.current, frame.current, bus.current, cased.current, flags.current];
    if (meshes.some((m) => !m)) return;
    const { modules, paused, pausedAt } = useStore.getState();
    const now = paused && pausedAt !== null ? pausedAt : Date.now();
    const n = [0, 0, 0, 0, 0];
    const put = (i: number, m: THREE.Matrix4) => {
      if (n[i] >= CAPACITY) return;
      meshes[i]!.setMatrixAt(n[i]++, m);
    };

    for (const module of modules) {
      const s = ((now - module.spawnedAt) / 1000) * BELT_SPEED;
      if (s < 0) continue;

      if (module.scrappedAt !== null) {
        // Pushed off the belt: a short slide and drop into the cage, then
        // the cage's own pile takes over.
        const t = (now - module.scrappedAt) / KICK_MS;
        if (t >= 1) continue;
        tmpPos.lerpVectors(gatePos, binPos, t);
        tmpPos.y = gatePos.y + (binPos.y - gatePos.y) * t * t + Math.sin(t * Math.PI) * 0.18;
        tmpQuat.setFromAxisAngle(X_AXIS, t * 0.5);
      } else {
        const u = Math.min(s / LINE_LENGTH, 1);
        LINE_PATH.getPointAt(u, tmpPos);
        LINE_PATH.getTangentAt(u, tmpTan);
        tmpPos.y = BELT_Y + SIT;
        tmpQuat.setFromUnitVectors(X_AXIS, tmpTan.setY(0).normalize());
      }
      tmpMat.compose(tmpPos, tmpQuat, ONE);

      const isCased = s >= STATION_S.casing || module.scrappedAt !== null;
      if (isCased) {
        put(3, tmpMat);
      } else {
        put(0, tmpMat);
        if (s >= STATION_S.stack) put(1, tmpMat);
        if (s >= STATION_S.weld) put(2, tmpMat);
      }
      if (module.verdict === 'fail') {
        flagMat.multiplyMatrices(tmpMat, lift.makeTranslation(0, isCased ? MODULE.casedTop : MODULE.openTop, 0));
        put(4, flagMat);
      }
    }
    meshes.forEach((m, i) => {
      m!.count = n[i];
      m!.instanceMatrix.needsUpdate = true;
    });
  });

  const mesh = (ref: RefObject<THREE.InstancedMesh | null>, g: THREE.BufferGeometry, m: THREE.Material) => (
    <instancedMesh ref={ref} args={[g, m, CAPACITY]} castShadow receiveShadow frustumCulled={false} />
  );
  return (
    <group>
      {mesh(cells, moduleCellsGeometry(), moduleMaterial())}
      {mesh(frame, moduleFrameGeometry(), moduleMaterial())}
      {mesh(bus, moduleBusbarGeometry(), moduleMaterial())}
      {mesh(cased, moduleCaseGeometry(), moduleMaterial())}
      {mesh(flags, rejectFlagGeometry(), flagMaterial())}
    </group>
  );
}
