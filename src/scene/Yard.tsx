import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { useStore } from '@/state/store';
import { SLAB } from './layout';
import {
  CartonStack,
  Cone,
  FlourSackStack,
  Forklift,
  HandTruck,
  Pallet,
  PALLET_JACK_OPERATOR_X,
  PalletJack,
  Rack,
  Trolley,
  Truck,
  Worker,
  WORKER_WALK_SPEED,
} from './props';

/** Loaves per carton at the packer. */
const LOAVES_PER_CARTON = 8;
/** The outfeed pallet's layout: 2 x 2 per layer, 3 layers. */
const OUTFEED = { rows: 2, cols: 2, layers: 3 };
const OUTFEED_CAPACITY = OUTFEED.rows * OUTFEED.cols * OUTFEED.layers;

/** The pallet the packer's cartons land on fills one carton at a time as
 *  loaves are packed, then starts again as if a full one was taken away. */
function OutfeedPallet() {
  const packed = useStore((s) => s.loavesPacked);
  const cartons = Math.floor(packed / LOAVES_PER_CARTON);
  const count = cartons === 0 ? 0 : ((cartons - 1) % OUTFEED_CAPACITY) + 1;
  return <CartonStack position={[9.7, 0, 5.2]} {...OUTFEED} count={count} seed={3} />;
}

/** A worker strolling back and forth along a lane. */
function Walker({ from, to, seed, skin }: { from: [number, number]; to: [number, number]; seed: number; skin: number }) {
  const ref = useRef<THREE.Group>(null);
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const { paused, pausedAt } = useStore.getState();
    const t = ((paused && pausedAt ? pausedAt : Date.now()) / 1000) * WORKER_WALK_SPEED * 0.85;
    const leg = Math.floor(t / len) % 2;
    const f = (t % len) / len;
    const p = leg === 0 ? f : 1 - f;
    g.position.set(from[0] + dx * p, 0, from[1] + dz * p);
    g.rotation.y = Math.atan2(-(leg === 0 ? dz : -dz), leg === 0 ? dx : -dx);
  });
  return (
    <group ref={ref}>
      <Worker pose="walk" seed={seed} skin={skin} />
    </group>
  );
}

/** Everything outside, on the white floor one slab-thickness down: racked
 *  flour and cartons, the outfeed pallet, a forklift, pallet jacks and the
 *  delivery trucks backed up to the dock. */
export function Yard() {
  return (
    <group position-y={-SLAB.thickness}>
      {/* Raw materials store, screen upper right. */}
      <Rack position={[13.6, 0, -6.4]} bays={2} levels={3} color="blue" seed={4} />
      <Rack position={[13.6, 0, -3.4]} bays={2} levels={3} color="orange" seed={9} />
      <FlourSackStack position={[9.6, 0, -6.8]} layers={4} seed={2} />
      <FlourSackStack position={[9.6, 0, -5.4]} layers={3} seed={5} />
      <Pallet position={[9.6, 0, -3.9]} />

      {/* Forklift bringing flour toward the dough room. */}
      <Forklift position={[11.2, 0, -0.6]} rotation-y={Math.PI * 0.85} load="sacks" lift={0.25} seed={2} />
      <Cone position={[10.2, 0, 1.4]} />
      <Cone position={[11.0, 0, 1.0]} />

      {/* Outfeed and dispatch. */}
      <OutfeedPallet />
      <CartonStack position={[11.6, 0, 4.2]} rows={2} cols={2} layers={3} seed={8} />
      <group position={[12.2, 0, 7.3]} rotation-y={Math.PI}>
        <PalletJack load="cartons" seed={4} />
        <Worker position={[PALLET_JACK_OPERATOR_X, 0, 0]} pose="push" seed={6} skin={2} vest />
      </group>
      <HandTruck position={[10.6, 0, 8.6]} rotation-y={-0.4} cartons={3} />
      <Worker position={[10.4, 0, 6.6]} rotation-y={Math.PI * 0.5} pose="tablet" seed={11} skin={1} vest />

      {/* Delivery trucks, backed toward the dock (roller door at -x). */}
      <Truck position={[17.2, 0, 4.4]} />
      <Truck position={[18.4, 0, 9.0]} cabColor="#f4f5f7" />
      <Walker from={[11, 2.6]} to={[14.6, 2.6]} seed={21} skin={3} />
    </group>
  );
}

/** People and loose kit on the factory floor itself (slab top, y=0). */
export function Crew() {
  return (
    <group>
      <Worker position={[-7.4, 0, 4.6]} rotation-y={-2.25} pose="tablet" seed={2} skin={0} />
      <Worker position={[-3.2, 0, -3.2]} rotation-y={Math.PI / 2} pose="inspect" seed={5} skin={1} />
      <Trolley position={[-0.6, 0, -2.6]} rotation-y={0.3} fill={0.85} seed={4} />
      <Worker position={[4.3, 0, -2.3]} rotation-y={Math.PI} pose="inspect" seed={8} skin={3} />
      <Worker position={[6.6, 0, 6.6]} rotation-y={Math.PI / 2} pose="carry" carrying="tray" seed={14} skin={2} />
      <Walker from={[-5.6, -1.4]} to={[0.4, -1.4]} seed={17} skin={0} />
    </group>
  );
}
