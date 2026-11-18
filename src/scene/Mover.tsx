import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GaitContext, type Gait } from './props/gait';
import { WALK_SPEED } from './props';

/** Seconds spent at each end of a route: turning round, or pausing before
 *  pulling a load back. */
const END_S = 0.9;

/**
 * Walks its children back and forth along a short route on the floor:
 * a person on their own, or a courier together with the cart they push.
 * Children are authored facing +x.
 *
 * `turn` (default) turns round at each end, which is what a person on foot
 * does. A person pushing a load must not: they stand behind it, so spinning
 * the whole rig swings them through whatever is beside the route. With
 * `turn={false}` the rig keeps facing its outbound direction and the person
 * pulls the load back, stepping backwards.
 *
 * Driven by the render clock, so people keep going about their day while a
 * merchant is frozen, the way they would in a real city.
 */
export function Mover({
  path,
  speed = WALK_SPEED,
  offset = 0,
  turn = true,
  children,
}: {
  /** Route waypoints on the floor, [x, z]. */
  path: Array<[number, number]>;
  speed?: number;
  /** Start part-way along the route, seconds, so movers don't move in step. */
  offset?: number;
  turn?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const gait = useRef<Gait['current']>({ dir: 1 });
  const route = useMemo(() => {
    const pts = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = lens.reduce((a, b) => a + b, 0);
    return { pts, lens, total, legS: total / speed };
  }, [path, speed]);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const cycle = 2 * (route.legS + END_S);
    const u = (clock.elapsedTime + offset) % cycle;
    const out = u < route.legS + END_S;
    const tLeg = out ? u : u - route.legS - END_S;
    const moving = tLeg < route.legS;
    // Distance along the route in the outbound direction.
    const d = moving ? (tLeg / route.legS) * route.total : route.total;
    const along = out ? d : route.total - d;

    let rest = along;
    let i = 0;
    while (i < route.lens.length - 1 && rest > route.lens[i]) {
      rest -= route.lens[i];
      i++;
    }
    const a = route.pts[i];
    const b = route.pts[i + 1];
    const f = route.lens[i] ? rest / route.lens[i] : 0;
    g.position.lerpVectors(a, b, f);

    const dirOut = Math.atan2(-(b.z - a.z), b.x - a.x);
    if (!turn) {
      g.rotation.y = dirOut;
      gait.current.dir = moving ? (out ? 1 : -1) : 0;
      return;
    }
    const heading = out ? dirOut : dirOut + Math.PI;
    if (moving) {
      g.rotation.y = heading;
      gait.current.dir = 1;
    } else {
      // Turning round on the spot, stepping as they turn.
      const k = (tLeg - route.legS) / END_S;
      g.rotation.y = heading + Math.PI * k * k * (3 - 2 * k);
      gait.current.dir = 1;
    }
  });

  return (
    <GaitContext.Provider value={gait}>
      {/* `dynamic`: everything riding on a mover (the cart as well as the
          person pushing it) must stay out of the scene's static batcher,
          or a frozen copy of it is left standing where the route began. */}
      <group ref={ref} userData={{ dynamic: true }}>
        {children}
      </group>
    </GaitContext.Provider>
  );
}
