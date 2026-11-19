// Every payment in flight, as an arc from where it was sent to where it
// lands: its faint full path, a bright trail behind its head, and the head
// itself. Positions come from each payment's send time and the packet
// speed, so the picture can never disagree with the stream about where a
// payment is.
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InterleavedBufferAttribute } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useStore, type Payment } from '@/state/store';
import { FLIGHT, HUB_AT, MERCHANT_AT, PACKET_SPEED } from '@/streaming/networkConfig';
import { Flight, latLon } from './geo';
import { FLIGHT_HEX } from './palette';

const CAPACITY = 120;
const PATH_SEGS = 28;
const TRAIL_SEGS = 10;
/** Share of the flight the bright trail covers. */
const TRAIL = 0.16;
/** How long a blocked or held flight takes to die away. */
const DIE_MS = 900;

const COLOR = Object.fromEntries(Object.entries(FLIGHT_HEX).map(([k, v]) => [k, new THREE.Color(v)])) as Record<
  keyof typeof FLIGHT_HEX,
  THREE.Color
>;

const flights = new Map<string, Flight>();
function flightFor(p: Payment): Flight {
  let f = flights.get(p.id);
  if (!f) {
    const to = p.source === 'TDZ-WEB' ? MERCHANT_AT['TDZ-WEB'] : HUB_AT;
    f = new Flight(latLon(p.from[0], p.from[1]), latLon(to[0], to[1]));
    flights.set(p.id, f);
  }
  return f;
}

function colorOf(p: Payment): THREE.Color {
  if (p.blockedAt !== null || p.approved === false) return COLOR.blocked;
  if (p.suspect === null) return COLOR.pending;
  return p.suspect ? COLOR.fraud : COLOR.approved;
}

/** A segment buffer of fixed capacity that is rewritten in place each frame. */
function makeLines(capacity: number, width: number, opacity: number) {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(new Float32Array(capacity * 6));
  geometry.setColors(new Float32Array(capacity * 6));
  const material = new LineMaterial({ linewidth: width, vertexColors: true, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  const line = new LineSegments2(geometry, material);
  line.frustumCulled = false;
  const pos = (geometry.attributes.instanceStart as InterleavedBufferAttribute).data;
  const col = (geometry.attributes.instanceColorStart as InterleavedBufferAttribute).data;
  return { line, geometry, material, pos, col };
}

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const head = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();

function makeHeads() {
  const m = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.0085, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    CAPACITY,
  );
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
  m.frustumCulled = false;
  return m;
}

// One globe in the app, so its flight buffers are made once and rewritten
// in place every frame.
let graphics: { paths: ReturnType<typeof makeLines>; trails: ReturnType<typeof makeLines>; heads: THREE.InstancedMesh } | null = null;
function flightGraphics() {
  graphics ??= {
    paths: makeLines(CAPACITY * PATH_SEGS, 1.2, 0.28),
    trails: makeLines(CAPACITY * TRAIL_SEGS, 2.6, 1),
    heads: makeHeads(),
  };
  return graphics;
}

const glowColor = new THREE.Color();

function resize(w: number, h: number) {
  const { paths, trails } = flightGraphics();
  paths.material.resolution.set(w, h);
  trails.material.resolution.set(w, h);
}

/** Hands this frame's segment and head counts to the GPU buffers. */
function commit(pathCount: number, trailCount: number, headCount: number) {
  const { paths, trails, heads } = flightGraphics();
  paths.geometry.instanceCount = pathCount;
  trails.geometry.instanceCount = trailCount;
  paths.pos.needsUpdate = true;
  paths.col.needsUpdate = true;
  trails.pos.needsUpdate = true;
  trails.col.needsUpdate = true;
  heads.count = headCount;
  heads.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
}

export function Flights() {
  const size = useThree((s) => s.size);
  const { paths, trails, heads } = flightGraphics();

  useFrame(() => {
    resize(size.width, size.height);
    const { payments } = useStore.getState();
    const now = Date.now();
    const pa = paths.pos.array as Float32Array;
    const pc = paths.col.array as Float32Array;
    const ta = trails.pos.array as Float32Array;
    const tc = trails.col.array as Float32Array;
    let ps = 0;
    let ts = 0;
    let n = 0;
    const live = new Set<string>();
    for (const p of payments) {
      if (n >= CAPACITY) break;
      const elapsed = ((now - p.spawnedAt) / 1000) * PACKET_SPEED;
      if (elapsed < 0) continue;
      live.add(p.id);
      const f = flightFor(p);
      // Where the head is, and how much of the trail is left: a blocked
      // flight stops just short of landing and a held one where it was,
      // and either one's trail then shrinks into its head.
      const stopAt = p.heldAt ?? p.blockedAt;
      let u = Math.min(elapsed / FLIGHT.settle, 1);
      let trail = TRAIL;
      let pathAlpha = 1;
      if (stopAt !== null) {
        const stopU = Math.min((((stopAt - p.spawnedAt) / 1000) * PACKET_SPEED) / FLIGHT.settle, 1);
        u = stopU;
        const k = (now - stopAt) / DIE_MS;
        if (k >= 1) continue;
        trail = TRAIL * (1 - k);
        pathAlpha = 1 - k;
      }
      const color = colorOf(p);

      // Faint full path, up to where the head is now plus a little ahead.
      if (pathAlpha > 0.05) {
        const end = stopAt !== null ? u : 1;
        for (let i = 0; i < PATH_SEGS; i++) {
          f.at((i / PATH_SEGS) * end, a);
          f.at(((i + 1) / PATH_SEGS) * end, b);
          pa.set([a.x, a.y, a.z, b.x, b.y, b.z], ps * 6);
          const c = pathAlpha;
          pc.set([color.r * c, color.g * c, color.b * c, color.r * c, color.g * c, color.b * c], ps * 6);
          ps++;
        }
      }

      // Bright trail, fading toward its tail.
      const t0 = Math.max(0, u - trail);
      for (let i = 0; i < TRAIL_SEGS; i++) {
        const s0 = t0 + ((u - t0) * i) / TRAIL_SEGS;
        const s1 = t0 + ((u - t0) * (i + 1)) / TRAIL_SEGS;
        f.at(s0, a);
        f.at(s1, b);
        ta.set([a.x, a.y, a.z, b.x, b.y, b.z], ts * 6);
        const w0 = 0.25 + (0.75 * i) / TRAIL_SEGS;
        const w1 = 0.25 + (0.75 * (i + 1)) / TRAIL_SEGS;
        tc.set([color.r * w0, color.g * w0, color.b * w0, color.r * w1, color.g * w1, color.b * w1], ts * 6);
        ts++;
      }

      // The head, a little over-bright so the bloom catches it.
      f.at(u, head);
      const scale = stopAt !== null ? Math.max(0.01, 1 - (now - stopAt) / DIE_MS) : 1;
      m4.compose(head, q, a.set(scale, scale, scale));
      heads.setMatrixAt(n, m4);
      heads.setColorAt(n, glowColor.copy(color).multiplyScalar(2.4));
      n++;
    }
    for (const id of flights.keys()) if (!live.has(id)) flights.delete(id);

    commit(ps, ts, n);
  });

  return (
    <group>
      <primitive object={paths.line} />
      <primitive object={trails.line} />
      <primitive object={heads} />
    </group>
  );
}
