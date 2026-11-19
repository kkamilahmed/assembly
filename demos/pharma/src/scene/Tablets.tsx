import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/state/store';
import { BELT_SPEED } from '@/streaming/lineConfig';
import { BELT_Y, LINE_LENGTH, LINE_PATH, MACHINE_POS, STATION_S } from './layout';
import { cardGeometry, cardPocketsGeometry, foilMaterial, trayGeometry, trayTabletsGeometry } from './props/tablet';
import { studioWhite } from './props/kit';
import { PALETTE, tabletColor } from './style';

const CAPACITY = 160;
/** Height of a tray's base above the belt surface. */
const SIT = 0.008;
/** How long a diverted tray takes to slide into the bin. */
const KICK_MS = 520;
/** How much thinner a tablet is drawn per mg underweight, as a fraction of
 *  its height. Exaggerated well past life, so an underdosing press is
 *  something you can see on the belt before inspection flags it. */
const THIN_PER_MG = 0.024;

const TRAY_OK = new THREE.Color(PALETTE.blue);
const TRAY_FLAGGED = new THREE.Color(PALETTE.critical);
const WHITE_K = 0.86;

const tmpPos = new THREE.Vector3();
const tmpTan = new THREE.Vector3();
const tmpColor = new THREE.Color();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const gatePos = new THREE.Vector3();
const binPos = new THREE.Vector3(MACHINE_POS.rejectBin.x, 0.6, MACHINE_POS.rejectBin.z);

LINE_PATH.getPointAt(STATION_S.reject / LINE_LENGTH, gatePos);

function onBelt(s: number) {
  const u = Math.min(s / LINE_LENGTH, 1);
  LINE_PATH.getPointAt(u, tmpPos);
  LINE_PATH.getTangentAt(u, tmpTan);
  tmpPos.y = BELT_Y + SIT;
  tmpQuat.setFromUnitVectors(X_AXIS, tmpTan.setY(0).normalize());
}

/**
 * Everything on the belt, as four instanced meshes: trays and their tablets
 * from the press to the blister packer, then sealed blister cards from the
 * packer to the cartoner. Positions come from each tray's spawn time and the
 * belt speed, so the picture can never disagree with the stream about where
 * a tray is.
 *
 * Tablets leave the press matte and creamy and come out of the coating drum
 * bright white. An underweight tray's tablets are drawn thinner, and once
 * inspection fails it the tray itself turns red until the gate diverts it.
 */
export function Tablets() {
  const trayGeo = useMemo(() => trayGeometry(), []);
  const tabletGeo = useMemo(() => trayTabletsGeometry(), []);
  const cardGeo = useMemo(() => cardGeometry(), []);
  const pocketGeo = useMemo(() => cardPocketsGeometry(), []);
  // White bases, so the per-instance colours come through as they are.
  const trayMat = useMemo(() => new THREE.MeshPhysicalMaterial({ roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 }), []);
  const tabletMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 }), []);
  const pocketMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: studioWhite(PALETTE.white, 0.9), roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1 }),
    [],
  );
  const trays = useRef<THREE.InstancedMesh>(null);
  const tablets = useRef<THREE.InstancedMesh>(null);
  const cards = useRef<THREE.InstancedMesh>(null);
  const pockets = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const tm = trays.current;
    const pm = tablets.current;
    const cm = cards.current;
    const km = pockets.current;
    if (!tm || !pm || !cm || !km) return;
    const { trays: list, paused, pausedAt } = useStore.getState();
    const now = paused && pausedAt !== null ? pausedAt : Date.now();
    let n = 0;
    let c = 0;
    for (const tray of list) {
      const s = ((now - tray.spawnedAt) / 1000) * BELT_SPEED;
      if (s < 0) continue;

      if (tray.rejectedAt === null && s >= STATION_S.blisterIn) {
        // Inside the blister packer, then out of it as a sealed card.
        if (s < STATION_S.blisterOut || c >= CAPACITY) continue;
        onBelt(s);
        tmpMat.compose(tmpPos, tmpQuat, ONE);
        cm.setMatrixAt(c, tmpMat);
        km.setMatrixAt(c, tmpMat);
        c++;
        continue;
      }
      if (n >= CAPACITY) continue;

      if (tray.rejectedAt !== null) {
        // Diverted: a short slide from the gate into the bin, then the bin's
        // own pile takes over.
        const t = (now - tray.rejectedAt) / KICK_MS;
        if (t >= 1) continue;
        tmpPos.lerpVectors(gatePos, binPos, t);
        tmpPos.y = BELT_Y + (binPos.y - BELT_Y) * t + Math.sin(t * Math.PI) * 0.35;
        tmpQuat.setFromAxisAngle(X_AXIS, t * 0.9);
      } else {
        onBelt(s);
      }

      const flagged = tray.verdict === 'fail' && s >= STATION_S.inspect - 0.05;
      tmpMat.compose(tmpPos, tmpQuat, ONE);
      tm.setMatrixAt(n, tmpMat);
      tm.setColorAt(n, flagged ? TRAY_FLAGGED : TRAY_OK);

      const thin = THREE.MathUtils.clamp(1 + tray.offset * THIN_PER_MG, 0.3, 1.15);
      tmpScale.set(1, thin, 1);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      pm.setMatrixAt(n, tmpMat);
      const coat = (s - STATION_S.coatIn) / (STATION_S.coatOut - STATION_S.coatIn);
      pm.setColorAt(n, tabletColor(coat, tmpColor).multiplyScalar(WHITE_K));
      n++;
    }
    tm.count = n;
    pm.count = n;
    cm.count = c;
    km.count = c;
    for (const m of [tm, pm, cm, km]) m.instanceMatrix.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={trays} args={[trayGeo, trayMat, CAPACITY]} castShadow receiveShadow frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(CAPACITY * 3), 3]} />
      </instancedMesh>
      <instancedMesh ref={tablets} args={[tabletGeo, tabletMat, CAPACITY]} castShadow receiveShadow frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(CAPACITY * 3), 3]} />
      </instancedMesh>
      <instancedMesh ref={cards} args={[cardGeo, foilMaterial(), CAPACITY]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={pockets} args={[pocketGeo, pocketMat, CAPACITY]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}
