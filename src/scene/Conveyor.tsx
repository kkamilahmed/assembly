import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/state/store';
import { CONVEYOR_WIDTH, CONVEYOR_Y, COLORS, DESPAWN_X, LINE_START_X, REWORK_SIDING_Z, REWORK_STOP_X } from './constants';

// Both belt ends used to just fade into fog a fixed render-length past
// LINE_START/REWORK_STOP, hoping the camera could never get close enough to
// see the raw edge. It could: looking at the first station up close — an
// entirely natural thing to do — put the camera well inside partial-fog
// range of that "hidden" tail. Anchoring the ends to the end-cap walls
// (Backdrop.tsx) instead fixed the distance problem, but not the underlying
// one: free orbit can put the camera on the far side of either wall just as
// easily as the near side, and from there the wall doesn't occlude
// anything — it's behind the camera, not in front of the belt. There's no
// camera position that trick works from unconditionally.
//
// So: stop hiding the ends and cap them instead, the way a real belt
// conveyor actually ends — a roller drum the belt visibly wraps around
// (RollerCap below). That reads as finished, deliberate geometry from any
// angle, which no amount of distance or occlusion trickery can claim.
// INFEED_MARGIN is just enough belt showing before the first car spawns
// (LINE_START_X) to look like a real infeed, not a hidden length pushed
// somewhere a camera might catch it; OUTFEED_MARGIN is the same past
// DESPAWN_X, where a car actually disappears.
const INFEED_MARGIN = 2.6;
const OUTFEED_MARGIN = 2.6;

// CONVEYOR_Y is documented (constants.ts) and used everywhere else — every
// car's own ride height — as the belt's top surface. A box mesh centers on
// its `position`, so pinning the slab's actual top there (rather than its
// center) means shifting the mesh down by half its own thickness; skipping
// that shift is what put the real top surface 0.07 higher than every
// car-height calculation assumed, reading as the whole line sitting sunk
// into the belt.
const BELT_THICKNESS = 0.14;
const BELT_CENTER_Y = CONVEYOR_Y - BELT_THICKNESS / 2;
const ROLLER_RADIUS = 0.22;

/** The drum a real belt conveyor wraps around at each end — a tail pulley
 *  at the infeed, a head pulley at the outfeed. Reads as a finished,
 *  intentional terminus from any viewing angle (a rounded profile doesn't
 *  vanish end-on the way a flat box edge does), which is the point: nothing
 *  needs to stay hidden from the camera anymore. `x` is local to the
 *  conveyor group, matching the slats/rails below. */
function RollerCap({ x }: { x: number }) {
  return (
    <group position={[x, BELT_CENTER_Y, 0]}>
      {/* Axis along Z (the belt's width) via a rotation around X — not the
          [0,0,PI/2] the wall pipes (FactoryStructure.tsx) use, which lays a
          cylinder's axis along X instead and would point this one straight
          down the belt's length like a rod poking out past the end, not
          across it like a roller. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[ROLLER_RADIUS, ROLLER_RADIUS, CONVEYOR_WIDTH - 0.06, 20]} />
        <meshStandardMaterial color={COLORS.frame} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Bearing blocks at each end, bolting the drum to the side rails —
          without them it reads as a loose cylinder rather than a mounted
          roller. */}
      {[CONVEYOR_WIDTH / 2, -CONVEYOR_WIDTH / 2].map((z) => (
        <mesh key={z} position={[0, 0, z]} castShadow>
          <boxGeometry args={[ROLLER_RADIUS * 1.7, ROLLER_RADIUS * 1.7, 0.12]} />
          <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Conveyor() {
  const textureRef = useRef<THREE.Texture | null>(null);
  const startX = LINE_START_X - INFEED_MARGIN;
  const endX = DESPAWN_X + OUTFEED_MARGIN;
  const length = endX - startX;
  const midX = (startX + endX) / 2;

  useFrame((_, delta) => {
    if (useStore.getState().paused) return;
    if (textureRef.current) textureRef.current.offset.x -= delta * 0.12;
  });

  const slatCount = Math.round(length / 1.4);

  return (
    <group position={[midX, 0, 0]}>
      {Array.from({ length: slatCount }).map((_, i) => {
        const x = startX + (i / (slatCount - 1)) * length - midX;
        return (
          // Sized to sit fully inside the belt's own footprint (not
          // CONVEYOR_WIDTH + 0.5, which used to poke past the belt's edges)
          // and clear of its underside by a real margin, not fractions of a
          // centimetre. Poking out created a regularly-spaced grating of
          // thin edges that, seen nearly edge-on down the line, aliased into
          // a jagged, glitchy-looking pattern on the belt.
          <mesh key={i} position={[x, CONVEYOR_Y / 2 - 0.12, 0]} castShadow>
            <boxGeometry args={[0.2, 0.24, CONVEYOR_WIDTH - 0.1]} />
            <meshStandardMaterial color={COLORS.frame} metalness={0.35} roughness={0.6} />
          </mesh>
        );
      })}
      <mesh position={[0, BELT_CENTER_Y, 0]} receiveShadow castShadow>
        <boxGeometry args={[length, BELT_THICKNESS, CONVEYOR_WIDTH]} />
        <meshStandardMaterial color={COLORS.belt} metalness={0.15} roughness={0.85} />
      </mesh>
      {[CONVEYOR_WIDTH / 2 + 0.08, -CONVEYOR_WIDTH / 2 - 0.08].map((z) => (
        <mesh key={z} position={[0, CONVEYOR_Y + 0.05, z]}>
          <boxGeometry args={[length, 0.18, 0.1]} />
          <meshStandardMaterial color={COLORS.frame} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      {/* Rework siding pad — flush with the belt, where flagged cars park */}
      <mesh position={[REWORK_STOP_X - midX, BELT_CENTER_Y, REWORK_SIDING_Z]} receiveShadow>
        <boxGeometry args={[3.5, BELT_THICKNESS, 2.6]} />
        <meshStandardMaterial color={COLORS.frame} metalness={0.15} roughness={0.85} />
      </mesh>
      <RollerCap x={startX - midX} />
      <RollerCap x={endX - midX} />
    </group>
  );
}
