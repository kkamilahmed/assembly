// The two places the story is about: Northgate's scoring hub in New York
// and TechDealz Online's checkout in Chicago. Each has a lit pin, rings
// that say what it is doing, and a label chip that hides when the place
// turns to the far side of the globe.
import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { sourceSeverity, useStore } from '@/state/store';
import { HUB_AT, MERCHANT_AT, PROBLEM_SOURCE_ID } from '@/streaming/networkConfig';
import { latLon } from './geo';
import { FLIGHT_HEX } from './palette';

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const HUB = latLon(HUB_AT[0], HUB_AT[1]);
const TDZ = latLon(MERCHANT_AT[PROBLEM_SOURCE_ID][0], MERCHANT_AT[PROBLEM_SOURCE_ID][1]);
const Z = new THREE.Vector3(0, 0, 1);

/** A flat ring lying on the globe at `at`, for pulses and halos. */
function useRing(at: THREE.Vector3) {
  return useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(Z, at.clone().normalize());
    return { position: at.clone().multiplyScalar(1.004), quaternion: q };
  }, [at]);
}

const ringGeometry = new THREE.RingGeometry(0.85, 1, 48);
const discGeometry = new THREE.CircleGeometry(1, 32);

const world = new THREE.Vector3();
const toCam = new THREE.Vector3();

/** How squarely a place faces the camera, 0 at the limb or beyond, 1 when
 *  it faces it, for fading its label chip as it turns away. */
function facing(holder: THREE.Object3D, camera: THREE.Camera): number {
  holder.getWorldPosition(world);
  toCam.copy(camera.position).sub(world).normalize();
  return THREE.MathUtils.clamp((world.normalize().dot(toCam) - 0.05) * 5, 0, 1);
}

// One of each marker on the globe, so their materials are made once.
const rippleMat = new THREE.MeshBasicMaterial({ color: '#7fb0ff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
const pulseMat = new THREE.MeshBasicMaterial({ color: FLIGHT_HEX.fraud, transparent: true, depthWrite: false, side: THREE.DoubleSide });
const haloMat = new THREE.MeshBasicMaterial({ color: FLIGHT_HEX.blocked, transparent: true, opacity: 0.22, depthWrite: false });
const tdzPinMat = new THREE.MeshBasicMaterial({ toneMapped: false });
const hubPinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4f8dff').multiplyScalar(2.2), toneMapped: false });

function Chip({ tone, children }: { tone: 'light' | 'red' | 'dark'; children: ReactNode }) {
  const style =
    tone === 'red'
      ? 'bg-[var(--status-critical)] text-white'
      : tone === 'dark'
        ? 'bg-[#1d2027] text-white'
        : 'bg-white text-[#1d2027] border border-black/10';
  return <div className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shadow-md transition-colors ${style}`}>{children}</div>;
}

function Hub() {
  const ring = useRing(HUB);
  const ripple = useRef<THREE.Mesh>(null);
  const holder = useRef<THREE.Group>(null);
  const chip = useRef<HTMLDivElement>(null);
  useFrame(({ clock, camera }) => {
    if (holder.current && chip.current) chip.current.style.opacity = String(facing(holder.current, camera));
    const r = ripple.current;
    if (!r) return;
    const k = REDUCED ? 0.5 : (clock.elapsedTime % 1.8) / 1.8;
    r.scale.setScalar(0.02 + k * 0.05);
    rippleMat.opacity = 0.7 * (1 - k);
  });
  return (
    <group>
      <mesh position={HUB.clone().multiplyScalar(1.006)} material={hubPinMat}>
        <sphereGeometry args={[0.016, 20, 14]} />
      </mesh>
      <mesh ref={ripple} geometry={ringGeometry} material={rippleMat} {...ring} />
      <group ref={holder} position={HUB.clone().multiplyScalar(1.01)}>
        <Html center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div ref={chip} style={{ transform: 'translate(78px, 26px)' }}>
            <Chip tone="light">Northgate · New York</Chip>
          </div>
        </Html>
      </group>
    </group>
  );
}

function TechDealz() {
  const severity = useStore((s) => sourceSeverity(s, PROBLEM_SOURCE_ID));
  const frozen = useStore((s) => s.frozen);
  const shielded = useStore((s) => s.lastKickAt !== null && Date.now() - s.lastKickAt < 2500);
  const ring = useRing(TDZ);
  const pulse = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const holder = useRef<THREE.Group>(null);
  const chip = useRef<HTMLDivElement>(null);
  const attacked = severity !== 'healthy' && !frozen;
  useFrame(({ clock, camera }) => {
    if (holder.current && chip.current) chip.current.style.opacity = String(facing(holder.current, camera));
    const t = clock.elapsedTime;
    const p = pulse.current;
    if (p) {
      p.visible = attacked;
      const k = REDUCED ? 0.5 : (t % (severity === 'critical' ? 0.7 : 1.1)) / (severity === 'critical' ? 0.7 : 1.1);
      p.scale.setScalar(0.02 + k * 0.07);
      pulseMat.opacity = 0.85 * (1 - k);
    }
    if (halo.current) halo.current.visible = shielded || frozen;
    tdzPinMat.color.set(attacked ? FLIGHT_HEX.fraud : frozen ? '#c7ccd6' : '#ffffff').multiplyScalar(attacked ? 2.4 : 1.1);
  });
  const text = frozen ? 'TechDealz Online · frozen' : shielded && !attacked ? 'TechDealz: every test charge blocked' : 'TechDealz Online';
  return (
    <group>
      <mesh position={TDZ.clone().multiplyScalar(1.006)} material={tdzPinMat}>
        <sphereGeometry args={[0.013, 20, 14]} />
      </mesh>
      <mesh ref={pulse} geometry={ringGeometry} material={pulseMat} {...ring} />
      <mesh ref={halo} geometry={discGeometry} material={haloMat} {...ring} scale={0.055} />
      <group ref={holder} position={TDZ.clone().multiplyScalar(1.01)}>
        <Html center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div ref={chip} style={{ transform: 'translate(-92px, -30px)' }}>
            <Chip tone={attacked ? 'red' : 'dark'}>{text}</Chip>
          </div>
        </Html>
      </group>
    </group>
  );
}

export function Markers() {
  return (
    <group>
      <Hub />
      <TechDealz />
    </group>
  );
}
