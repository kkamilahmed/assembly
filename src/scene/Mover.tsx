import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORKER_WALK_SPEED } from './props';

/** Seconds spent turning round at each end of a route. */
const TURN_S = 0.7;

/**
 * Walks its children back and forth along a short route on the floor:
 * a worker on their own, or a worker together with the trolley or pallet
 * jack they push. Children are authored facing +x; the mover turns them to
 * face the way they are going, and eases the turn at each end.
 *
 * Driven by the render clock, so people keep working while the line is
 * stopped, the way they would in a real plant.
 */
export function Mover({
  path,
  speed = WORKER_WALK_SPEED,
  offset = 0,
  children,
}: {
  /** Route waypoints on the floor, [x, z]. */
  path: Array<[number, number]>;
  speed?: number;
  /** Start part-way along the route, seconds, so movers don't move in step. */
  offset?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const route = useMemo(() => {
    const pts = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = lens.reduce((a, b) => a + b, 0);
    return { pts, lens, total, legS: total / speed };
  }, [path, speed]);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const cycle = 2 * (route.legS + TURN_S);
    const u = (clock.elapsedTime + offset) % cycle;
    const out = u < route.legS + TURN_S;
    const tLeg = out ? u : u - route.legS - TURN_S;
    const walking = tLeg < route.legS;
    // Distance along the route in the outbound direction.
    const d = walking ? (tLeg / route.legS) * route.total : route.total;
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
    const heading = out ? dirOut : dirOut + Math.PI;
    if (walking) {
      g.rotation.y = heading;
    } else {
      // Turning round at the end of the leg.
      const k = (tLeg - route.legS) / TURN_S;
      const s = k * k * (3 - 2 * k);
      g.rotation.y = heading + Math.PI * s;
    }
  });

  return <group ref={ref}>{children}</group>;
}
