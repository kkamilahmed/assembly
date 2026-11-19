import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useStore } from '@/state/store';
import { PACKET_LENGTH, PACKET_SPEED, SOURCE_IDS, type SourceId } from '@/streaming/networkConfig';
import { LANE_STATIONS, LANES, PACKET_Y, QUARANTINE } from './layout';

const CAPACITY = 220;
/** How long a blocked packet takes to fly into quarantine. */
const KICK_MS = 560;
/** Card proportions: a payment card, seen as a glowing token. */
const CARD = { l: PACKET_LENGTH.normal, h: 0.08, w: 0.46 } as const;
/** The bright edge each card sits on, so it reads against both the dark
 *  rails and the light pavements. */
const EDGE = 0.06;
/** Cards ride tipped up toward the viewer, so their face reads from the
 *  iso camera instead of showing only a thin edge. */
const TIP = 0.55;

const COLORS = {
  /** On its way to be scored. */
  pending: new THREE.Color('#ffffff'),
  approved: new THREE.Color('#14a85a'),
  fraud: new THREE.Color('#e3242b'),
};

const tmpPos = new THREE.Vector3();
const tmpTan = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tilt = new THREE.Quaternion();
const side = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Where each lane hands a blocked packet to quarantine. */
const KICK_FROM = Object.fromEntries(
  SOURCE_IDS.map((id) => [id, LANES[id].path.getPointAt(LANE_STATIONS[id].kick / LANES[id].length)]),
) as Record<SourceId, THREE.Vector3>;
const BIN_TOP = new THREE.Vector3(QUARANTINE.x, 0.42, QUARANTINE.z);

/** A card that glows in its own colour: the instance colour drives the
 *  emissive term as well as the diffuse one, so a red packet reads as red
 *  from across the room. */
function glowCardMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.32, roughness: 0.3, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n\ttotalEmissiveRadiance *= vColor;\n#endif',
    );
  };
  return m;
}

/** Every payment in flight, as one instanced mesh. Positions come from each
 *  payment's send time and the packet speed, so the picture can never
 *  disagree with the stream about where a payment is. */
export function Packets() {
  const geometry = useMemo(() => new RoundedBoxGeometry(CARD.l, CARD.h, CARD.w, 2, 0.022), []);
  const material = useMemo(() => glowCardMaterial(), []);
  const edgeGeometry = useMemo(() => {
    const g = new RoundedBoxGeometry(CARD.l + EDGE * 2, CARD.h * 0.6, CARD.w + EDGE * 2, 2, 0.04);
    g.translate(0, -CARD.h * 0.3, 0);
    return g;
  }, []);
  const edgeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false }), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const edgeRef = useRef<THREE.InstancedMesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { payments } = useStore.getState();
    const now = Date.now();
    let n = 0;
    for (const p of payments) {
      if (n >= CAPACITY) break;
      const lane = LANES[p.source];
      const s = ((now - p.spawnedAt) / 1000) * PACKET_SPEED;
      if (s < 0) continue;
      const scale = p.kind === 'attack' ? PACKET_LENGTH.attack / PACKET_LENGTH.normal : 1;

      if (p.blockedAt !== null) {
        // Pulled off the lane: a short arc over the other lanes into the
        // quarantine tray, then the tray's own pile takes over.
        const t = (now - p.blockedAt) / KICK_MS;
        if (t >= 1) continue;
        const from = KICK_FROM[p.source];
        tmpPos.lerpVectors(from, BIN_TOP, t);
        tmpPos.y = PACKET_Y + (BIN_TOP.y - PACKET_Y) * t + Math.sin(t * Math.PI) * 1.1;
        tmpQuat.setFromAxisAngle(X_AXIS, t * 3.2);
      } else {
        const u = Math.min(s / lane.length, 1);
        lane.path.getPointAt(u, tmpPos);
        lane.path.getTangentAt(u, tmpTan);
        tmpQuat.setFromUnitVectors(X_AXIS, tmpTan.setY(0).normalize());
        // A gentle hover, out of step from card to card.
        tmpPos.y += Math.sin(s * 3.1 + p.spawnedAt * 0.001) * 0.025;
        // Tip the face toward the camera (the +x +z side), whichever way
        // the lane is heading.
        side.set(0, 0, 1).applyQuaternion(tmpQuat);
        tilt.setFromAxisAngle(X_AXIS, TIP * THREE.MathUtils.clamp((side.x + side.z) * 2, -1, 1));
        tmpQuat.multiply(tilt);
      }

      tmpScale.set(scale, scale, scale);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(n, tmpMat);
      edgeRef.current?.setMatrixAt(n, tmpMat);
      const color = p.suspect === null ? COLORS.pending : p.suspect ? COLORS.fraud : COLORS.approved;
      mesh.setColorAt(n, color);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    const edge = edgeRef.current;
    if (edge) {
      edge.count = n;
      edge.instanceMatrix.needsUpdate = true;
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[geometry, material, CAPACITY]} castShadow receiveShadow frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(CAPACITY * 3), 3]} />
      </instancedMesh>
      <instancedMesh ref={edgeRef} args={[edgeGeometry, edgeMaterial, CAPACITY]} frustumCulled={false} />
    </>
  );
}
