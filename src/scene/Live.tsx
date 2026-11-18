// Everything on the block that changes with the stream: each source's
// status light, the scanner's beam, the pile in the quarantine tray, the
// warning light under TechDealz's billboard, and the status tags pinned
// over the action. Kept out of the static batch.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sourceSeverity, useStore, type Severity } from '@/state/store';
import { PROBLEM_SOURCE_ID, QUARANTINE_VISIBLE, type SourceId } from '@/streaming/networkConfig';
import { formatReading } from '@/streaming/signalStream';
import { packetsToCharges } from '@/ui/businessCase';
import { StatusLight } from './buildings/StatusLight';
import { ATM, CAFE, MALL, QUARANTINE, SCANNER, SOURCE_WALL, TDZ_BILLBOARD, VAULT, WAREHOUSE } from './layout';
import { PALETTE } from './style';
import { StatusTag } from './ui3d/StatusTag';

const LIGHTS: Record<SourceId, [number, number, number]> = {
  'CAFE-01': [CAFE.x1 - 0.3, SOURCE_WALL, CAFE.z0 + 0.09],
  'ATM-07': [ATM.x + 0.55, 2.44, ATM.z - 0.2],
  'MALL-03': [MALL.x1 - 0.3, SOURCE_WALL, MALL.z0 + 0.09],
  'TDZ-WEB': [WAREHOUSE.x0 + 0.3, SOURCE_WALL, WAREHOUSE.z0 + 0.09],
};

function SourceLight({ id }: { id: SourceId }) {
  const severity = useStore((s) => sourceSeverity(s, id));
  return <StatusLight position={LIGHTS[id]} severity={severity} />;
}

const GREEN = new THREE.Color(PALETTE.healthy).multiplyScalar(2.2);
const RED = new THREE.Color(PALETTE.critical).multiplyScalar(2.6);
const BLUE = new THREE.Color('#5aa8ff').multiplyScalar(1.8);

/** The beam under the scanner arch: blue while it scores, a red flash each
 *  time it pulls a payment off into quarantine. */
// One scanner on the block, so its two materials are made once.
const beamBar = new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false });
const beamCurtain = new THREE.MeshBasicMaterial({
  color: '#5aa8ff',
  transparent: true,
  opacity: 0.1,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

function ScannerBeam() {
  const bar = beamBar;
  const curtain = beamCurtain;
  useFrame(() => {
    const { lastKickAt, payments } = useStore.getState();
    const flash = lastKickAt !== null ? Math.max(0, 1 - (Date.now() - lastKickAt) / 260) : 0;
    const scored = payments.length > 0;
    bar.color.copy(scored ? BLUE : GREEN).lerp(RED, flash);
    curtain.color.copy(bar.color).multiplyScalar(0.5);
    curtain.opacity = 0.08 + flash * 0.14;
  });
  const w = SCANNER.x1 - SCANNER.x0 - 0.24;
  const cx = (SCANNER.x0 + SCANNER.x1) / 2;
  return (
    <group position={[cx, 0, SCANNER.z]}>
      <mesh position-y={SCANNER.beamY - 0.005} material={bar}>
        <boxGeometry args={[w, 0.03, 0.12]} />
      </mesh>
      <mesh position-y={(SCANNER.beamY + 0.15) / 2} material={curtain}>
        <planeGeometry args={[w, SCANNER.beamY - 0.15]} />
      </mesh>
    </group>
  );
}

const PILE_SLOTS = (() => {
  const out: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < QUARANTINE_VISIBLE; i++) {
    const layer = Math.floor(i / 8);
    const k = i % 8;
    const x = ((k % 4) - 1.5) * 0.2 + Math.sin(i * 7.1) * 0.03;
    const z = (Math.floor(k / 4) - 0.5) * 0.24 + Math.cos(i * 3.3) * 0.03;
    q.setFromEuler(e.set(Math.sin(i * 1.7) * 0.25, Math.sin(i * 2.9) * 1.2, Math.cos(i * 1.3) * 0.25));
    out.push(new THREE.Matrix4().compose(new THREE.Vector3(QUARANTINE.x + x, 0.37 + layer * 0.05, QUARANTINE.z + z), q, s));
  }
  return out;
})();

/** Blocked payments piled in the quarantine tray, drawn from the count. */
function QuarantinePile() {
  const blocked = useStore((s) => s.blocked);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(0.26, 0.04, 0.17, 2, 0.015), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.critical, emissive: PALETTE.critical, emissiveIntensity: 0.45, roughness: 0.35 }),
    [],
  );
  const n = Math.min(blocked, QUARANTINE_VISIBLE);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, PILE_SLOTS[i]);
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, QUARANTINE_VISIBLE]} castShadow receiveShadow frustumCulled={false} />;
}

/** The warning light under TechDealz's billboard: dark while the merchant
 *  is healthy, pulsing amber or red with its severity. */
function TdzWarning({ severity }: { severity: Severity }) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false }), []);
  const amber = useMemo(() => new THREE.Color(PALETTE.warning).multiplyScalar(2.2), []);
  const red = useMemo(() => new THREE.Color(PALETTE.critical).multiplyScalar(2.6), []);
  const off = useMemo(() => new THREE.Color('#3a3d44'), []);
  useFrame(({ clock }) => {
    if (severity === 'healthy') {
      material.color.copy(off);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * (severity === 'critical' ? 10 : 6));
    material.color.copy(off).lerp(severity === 'critical' ? red : amber, 0.35 + 0.65 * pulse);
  });
  return (
    <mesh position={[TDZ_BILLBOARD.x, TDZ_BILLBOARD.y - 0.06, TDZ_BILLBOARD.z + 0.12]} material={material}>
      <boxGeometry args={[TDZ_BILLBOARD.w - 0.3, 0.07, 0.07]} />
    </mesh>
  );
}

export function Live() {
  const tdz = useStore((s) => sourceSeverity(s, PROBLEM_SOURCE_ID));
  const velocity = useStore((s) => s.signals[PROBLEM_SOURCE_ID].velocity);
  const blocked = useStore((s) => s.blocked);
  const fraud = useStore((s) => s.fraudSettled);
  return (
    <group>
      {(Object.keys(LIGHTS) as SourceId[]).map((id) => (
        <SourceLight key={id} id={id} />
      ))}
      <ScannerBeam />
      <QuarantinePile />
      <TdzWarning severity={tdz} />

      {/* Live tags pinned over the action, the way the references pin
          status cards over shelves. */}
      <StatusTag
        position={[TDZ_BILLBOARD.x + 1.9, TDZ_BILLBOARD.y + TDZ_BILLBOARD.h + 0.1, TDZ_BILLBOARD.z]}
        label="Approved"
        value={formatReading(PROBLEM_SOURCE_ID, 'velocity', velocity)}
        tone={tdz}
        icon="bolt"
        scale={1.2}
      />
      <StatusTag
        position={[QUARANTINE.x - 0.3, 0.6, QUARANTINE.z]}
        label="Blocked"
        value={packetsToCharges(blocked).toLocaleString()}
        tone={blocked > 0 ? 'healthy' : 'neutral'}
        icon="shield"
        facing="x"
        scale={1.4}
      />
      <StatusTag
        position={[VAULT.x1 - 0.2, 4.0, -3.9]}
        label="Fraud settled"
        value={packetsToCharges(fraud).toLocaleString()}
        tone={fraud > 0 ? 'critical' : 'neutral'}
        icon="card"
        facing="x"
        scale={1.6}
      />
    </group>
  );
}
