import { COLORS, DESPAWN_X, LINE_END_X, LINE_START_X } from './constants';

// Was 15 — from a close, near-level orbit (easier to reach now that WALL_Z
// is closer, see below) the frustum routinely looked out over the top edge.
// Above it was just background color, which is deliberately identical to
// the wall's own upper-band color (constants.ts COLORS.backdrop), so that
// edge was never visible anyway — the wall didn't get cut off, it just
// dissolved into the same flat void the fog uses, reading as bottomless
// instead of built. Taller buys real headroom against ordinary framings;
// the cap band below is the actual fix, giving that edge a visible line
// regardless of how far up the camera ends up looking.
const WALL_HEIGHT = 22;
// Was -19 — that read as a huge, mostly-empty stretch of floor between the
// robot line/gantry (world z ≈ -9.8, FactoryStructure.tsx's GANTRY_Z) and
// the back wall, fading into fog with nothing in it. Pulled in to -16, the
// closest that still clears the scripted flythrough's z=-14 excursion
// (camera/waypoints.ts) with a 2-unit margin past the camera's own near
// plane (0.5) — plenty, since that shot also looks down from y=12-16, well
// above where the wall would fill the frame.
export const WALL_Z = -16;
// Matches WALL_Z: half of this (18) needs to clear both the new |WALL_Z|
// (16) and the +16 rework-siding camera excursion, each with a couple
// metres to spare, so the end-cap walls still meet the back wall's corner
// instead of overshooting it by the 4 extra metres the old 40/-19 pairing
// left dangling past the visible corner.
const CAP_DEPTH = 36;
const WAINSCOT_H = 1.7;
const PILASTER_GAP = 6.5;

// Exported so Conveyor.tsx can anchor the belt's own end caps to these —
// real opaque geometry a camera can't see past, unlike the fog-distance
// trick that used to do this job and failed for the very natural framing of
// looking at the first station up close (spawn is only ~20m from the old
// fog-hidden tail, well inside partial-fog range from there).
export const SPAWN_WALL_X = LINE_START_X - 6;
export const EXIT_WALL_X = DESPAWN_X + 6;

/** One wall as two coplanar bands (a painted-concrete wainscot below, a
 *  lighter upper wall above — real factory walls are two-tone, not one flat
 *  color) plus a steel baseboard and evenly-spaced pilasters standing
 *  slightly proud of the face. `width`/`height` match the old single-plane
 *  wall exactly; everything here is local to the wall's own position +
 *  rotation, so callers are unchanged. */
function Wall({
  position,
  rotation,
  width,
  height = WALL_HEIGHT,
  pilasters = false,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height?: number;
  pilasters?: boolean;
}) {
  const pilasterCount = pilasters ? Math.max(2, Math.round(width / PILASTER_GAP)) : 0;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, WAINSCOT_H / 2, 0]} receiveShadow>
        <planeGeometry args={[width, WAINSCOT_H]} />
        <meshStandardMaterial color={COLORS.backdropWainscot} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, (height + WAINSCOT_H) / 2, 0]} receiveShadow>
        <planeGeometry args={[width, height - WAINSCOT_H]} />
        <meshStandardMaterial color={COLORS.backdrop} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, 0.08, 0.03]} receiveShadow castShadow>
        <boxGeometry args={[width, 0.16, 0.06]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Roofline cap, proud of the face like the baseboard is at the
          bottom — without it the wall's top edge is invisible on any close
          or near-level framing (its own color matches the background
          exactly, by design, so there was nothing marking where it stopped;
          see WALL_HEIGHT's doc). A darker steel band reads as a real
          parapet/fascia trim from any angle the baseboard's box shape
          doesn't, the same reasoning the pipe clamps in
          FactoryStructure.tsx use. */}
      <mesh position={[0, height, 0.05]} castShadow>
        <boxGeometry args={[width, 0.3, 0.14]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.3} roughness={0.6} />
      </mesh>
      {Array.from({ length: pilasterCount }).map((_, i) => {
        const x = -width / 2 + ((i + 0.5) / pilasterCount) * width;
        return (
          <mesh key={i} position={[x, (height * 0.82) / 2, 0.07]} receiveShadow castShadow>
            <boxGeometry args={[0.34, height * 0.82, 0.14]} />
            <meshStandardMaterial color={COLORS.steel} metalness={0.4} roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Studio backdrop so the line doesn't read as floating in a white void: one
 *  back wall behind the robots (with pilasters for structural rhythm), two
 *  end-cap walls past the line's X extremes. Deliberately no wall on the +Z
 *  (rework-siding) side — the camera roams too far that direction for a
 *  wall to avoid clipping. Fog used to paper over the floor's edge showing
 *  on that open side; now that edge is just pushed out past where a camera
 *  can practically reach (Floor.tsx's Z_HALF_DEPTH), so there's nothing
 *  there for fog to have been hiding in the first place. */
export function Backdrop() {
  return (
    <group>
      <Wall
        position={[(LINE_START_X + LINE_END_X) / 2, 0, WALL_Z]}
        rotation={[0, 0, 0]}
        width={LINE_END_X - LINE_START_X + 40}
        pilasters
      />
      <Wall position={[SPAWN_WALL_X, 0, 0]} rotation={[0, Math.PI / 2, 0]} width={CAP_DEPTH} />
      <Wall position={[EXIT_WALL_X, 0, 0]} rotation={[0, -Math.PI / 2, 0]} width={CAP_DEPTH} />
    </group>
  );
}
