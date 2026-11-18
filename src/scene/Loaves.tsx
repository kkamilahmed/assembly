import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useStore } from '@/state/store';
import { bakeLevel, BELT_SPEED } from '@/streaming/lineConfig';
import { BELT_Y, LINE_LENGTH, LINE_PATH, MACHINE_POS, STATION_S } from './layout';
import { crustColor } from './style';

const CAPACITY = 160;
const LOAF_LENGTH = 0.56;
const LOAF_RADIUS = 0.18;
/** Height of the loaf's base above the belt surface. */
const SIT = 0.012;
/** How long a kicked loaf takes to fly into the bin. */
const KICK_MS = 520;

/** A bloomer: a squashed capsule with three diagonal score cuts across the
 *  top, so it reads as bread and not as a pill. */
function loafGeometry(): THREE.BufferGeometry {
  const body = new THREE.CapsuleGeometry(LOAF_RADIUS, LOAF_LENGTH - LOAF_RADIUS * 2, 6, 14);
  body.rotateZ(Math.PI / 2);
  body.scale(1, 0.72, 0.92);
  const cuts: THREE.BufferGeometry[] = [-0.1, 0, 0.1].map((x) => {
    const g = new THREE.CapsuleGeometry(0.012, 0.16, 2, 6);
    g.rotateX(Math.PI / 2);
    g.rotateY(0.6);
    g.translate(x, LOAF_RADIUS * 0.7 + 0.004, 0);
    return g;
  });
  // Cuts are the same mesh so the whole loaf is one instance; their darker
  // look comes from sitting in the body's ambient occlusion.
  const merged = mergeGeometries([body, ...cuts].map((g) => g.toNonIndexed()));
  merged.translate(0, LOAF_RADIUS * 0.72 + SIT, 0);
  merged.computeVertexNormals();
  return merged;
}

const tmpPos = new THREE.Vector3();
const tmpTan = new THREE.Vector3();
const tmpColor = new THREE.Color();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const gatePos = new THREE.Vector3();
const binPos = new THREE.Vector3(MACHINE_POS.rejectBin.x, 0.55, MACHINE_POS.rejectBin.z);

LINE_PATH.getPointAt(STATION_S.reject / LINE_LENGTH, gatePos);

/** Every loaf on the line, as one instanced mesh. Positions come from each
 *  loaf's spawn time and the belt speed, so the picture can never disagree
 *  with the stream about where a loaf is. */
export function Loaves() {
  const geometry = useMemo(() => loafGeometry(), []);
  const material = useMemo(
    () => new THREE.MeshPhysicalMaterial({ roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.15, sheenRoughness: 0.7, sheenColor: '#fff3d6' }),
    [],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { loaves, paused, pausedAt } = useStore.getState();
    const now = paused && pausedAt !== null ? pausedAt : Date.now();
    let n = 0;
    for (const loaf of loaves) {
      if (n >= CAPACITY) break;
      const s = ((now - loaf.spawnedAt) / 1000) * BELT_SPEED;
      if (s < 0) continue;

      let bake: number;
      let rise: number;
      if (s < STATION_S.ovenIn) {
        bake = 0;
        rise = 0.82;
      } else if (s < STATION_S.ovenOut) {
        const p = (s - STATION_S.ovenIn) / (STATION_S.ovenOut - STATION_S.ovenIn);
        bake = p;
        rise = 0.82 + 0.18 * Math.min(p * 1.5, 1);
      } else {
        bake = loaf.offset === null ? 1 : bakeLevel(loaf.offset);
        rise = 1;
      }

      if (loaf.rejectedAt !== null) {
        // Kicked off the belt: a short arc from the gate into the bin, then
        // the bin's own pile takes over.
        const t = (now - loaf.rejectedAt) / KICK_MS;
        if (t >= 1) continue;
        tmpPos.lerpVectors(gatePos, binPos, t);
        tmpPos.y = BELT_Y + (binPos.y - BELT_Y) * t + Math.sin(t * Math.PI) * 0.6;
        tmpQuat.setFromAxisAngle(X_AXIS, t * 2.4);
      } else {
        const u = Math.min(s / LINE_LENGTH, 1);
        LINE_PATH.getPointAt(u, tmpPos);
        LINE_PATH.getTangentAt(u, tmpTan);
        tmpQuat.setFromUnitVectors(X_AXIS, tmpTan.setY(0).normalize());
      }

      tmpScale.set(rise, rise, rise);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(n, tmpMat);
      mesh.setColorAt(n, crustColor(bake, tmpColor));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, CAPACITY]} castShadow receiveShadow frustumCulled={false}>
      <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(CAPACITY * 3), 3]} />
    </instancedMesh>
  );
}
