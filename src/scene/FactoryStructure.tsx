import { WALL_Z } from './Backdrop';
import { COLORS, LINE_END_X, LINE_START_X, ROBOT_X, ROBOT_Z } from './constants';

/** Industrial set-dressing so the line reads as a real body-shop cell
 *  instead of four robots floating in a clean void: an overhead gantry
 *  (steel truss + support columns), safety-yellow perimeter fencing along
 *  the walkway side, floor hazard markings, and control cabinets behind
 *  each station. Placement is deliberately checked against the *actual*
 *  robot/prop footprints (stationTargets.ts), not just nominal geometry:
 *   - Every station's own prop rack (PANEL_RACK_PICK / WHEEL_STACK_PICK,
 *     both z=-1.5 in robot-local space) resolves to world z ≈ -4.7 behind
 *     its robot. The gantry's column line sits well behind that, and well
 *     above every scripted camera waypoint (camera/waypoints.ts never dips
 *     below y=4.5), so the intro flythrough can't clip a column either. It's
 *     also pushed back further than a first pass suggested: the default
 *     hand-off camera (waypoints.ts SHOTS[2] end) looks nearly *along* the
 *     line's length, and a single continuous beam running parallel to that
 *     sightline visually smears into a solid band from that angle no matter
 *     how thin it actually is — verified by screenshotting that exact
 *     camera position, not just checking for 3D overlap. Pushing the beam
 *     back (smaller on screen) and using a matte, less specular material
 *     fixed it; a future pass touching this should re-check that same
 *     default view, not just orbit/top-down sanity shots.
 *   - WHEEL-01 is the one station with four machines instead of one — a
 *     near pair and a far, mirrored pair (world z ≈ +2.8, reaching toward
 *     the car — see RobotArm.tsx's `wheelCorner` prop), each also shifted
 *     along x toward its own wheel's hub, so the far pedestals sit closer
 *     to +2.8 than a single-machine station would. The aisle-side fence
 *     stops short of that station's x instead of running the full line
 *     length, so it doesn't run straight through any of those pedestals.
 */

const GANTRY_Y = 7.5;
const BEAM = 0.18;
const GANTRY_Z = ROBOT_Z - 7; // well clear of every prop rack (world z ≈ -4.7) and small on screen from the default hand-off angle
// Midway between the gantry line and the back wall — the strip of floor
// back there that used to just read as empty haze (see Backdrop.tsx's
// WALL_Z note). Derived off both rather than a hardcoded Z so it stays
// centred in that gap if either one moves again.
const BACK_CLUTTER_Z = (GANTRY_Z + WALL_Z) / 2;
const GANTRY_START_X = LINE_START_X - 2;
const GANTRY_END_X = LINE_END_X + 2;
const GANTRY_MID_X = (GANTRY_START_X + GANTRY_END_X) / 2;
const GANTRY_LENGTH = GANTRY_END_X - GANTRY_START_X;
const COLUMN_XS = [GANTRY_START_X, ...Object.values(ROBOT_X), GANTRY_END_X];

// Matte structural steel — a mirror-bright specular streak running the
// beam's full length is exactly what made it read as a solid slab from a
// shallow viewing angle (see module doc). Columns/base plates share this.
// Darker than the wall/floor palette so the truss actually reads as a
// distinct overhead structure instead of disappearing into a similarly-pale
// background.
const gantryMat = { color: COLORS.steelDark, metalness: 0.45, roughness: 0.6 } as const;

// Aisle-side fence: clear of the conveyor, and stops well before WHEEL-01's
// x so it doesn't run through that station's mirrored far-side machines
// (pedestals centred at world z ≈ +2.8, each also shifted a bit further in
// x toward its own wheel — see module doc above; the 3.2 margin comfortably
// covers that shift too, well under a typical car's half-wheelbase).
const FENCE_Z = 2.6;
const FENCE_START_X = LINE_START_X - 1;
const FENCE_END_X = ROBOT_X['WHEEL-01'] - 3.2;
const FENCE_LENGTH = FENCE_END_X - FENCE_START_X;
const FENCE_POST_GAP = 2.2;

function Gantry() {
  const fixtureCount = Math.max(2, Math.round(GANTRY_LENGTH / 7));
  return (
    <group>
      {/* One beam, not a twin-chord truss — a second parallel member only
          added more matte-but-still-visible mass along the same sightline
          that already causes the shallow-angle smearing (see module doc). */}
      <mesh position={[GANTRY_MID_X, GANTRY_Y, GANTRY_Z]} castShadow receiveShadow>
        <boxGeometry args={[GANTRY_LENGTH, BEAM, BEAM]} />
        <meshStandardMaterial {...gantryMat} />
      </mesh>
      {/* Support columns down to the floor. */}
      {COLUMN_XS.map((x) => (
        <mesh key={`col-${x}`} position={[x, GANTRY_Y / 2, GANTRY_Z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.09, 0.11, GANTRY_Y, 12]} />
          <meshStandardMaterial {...gantryMat} />
        </mesh>
      ))}
      {/* Base plates. */}
      {COLUMN_XS.map((x) => (
        <mesh key={`base-${x}`} position={[x, 0.03, GANTRY_Z]} receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
          <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {/* Sparse, dim suspended light fixtures — a hint of the overhead
          factory light source, deliberately small/dim/few so they read as
          discrete fixtures rather than merging into one bright strip from a
          shallow viewing angle. Each hangs off its own drop rod instead of
          sitting bare next to the beam — from a near-end-on view down the
          line, the matte beam itself can all but disappear (deliberately
          thin/matte, see module doc), and a fixture with nothing visibly
          holding it up read as floating. A vertical rod stays visible from
          any azimuth (it doesn't foreshorten the way the horizontal beam
          does), so the fixture keeps reading as suspended, not detached. */}
      {Array.from({ length: fixtureCount }).map((_, i) => {
        const x = GANTRY_START_X + ((i + 0.5) / fixtureCount) * GANTRY_LENGTH;
        return (
          <group key={`fix-${i}`}>
            <mesh position={[x, GANTRY_Y - 0.09, GANTRY_Z]}>
              <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
              <meshStandardMaterial color={COLORS.steelDark} metalness={0.3} roughness={0.6} />
            </mesh>
            <mesh position={[x, GANTRY_Y - 0.19, GANTRY_Z]}>
              <boxGeometry args={[0.6, 0.04, 0.14]} />
              <meshStandardMaterial color="#f4f7ff" emissive="#dfe9ff" emissiveIntensity={0.3} />
            </mesh>
          </group>
        );
      })}
      {/* Hazard-marked collar at every column/beam joint — the anti-collision
          yellow banding real overhead gantries and crane ways carry. Paint,
          not geometry, so it stays legible from a viewing angle so shallow
          the beam's own silhouette (see module doc) all but vanishes —
          exactly the angle that made the beam read as a stray disconnected
          line with columns rising into nothing above it. */}
      {COLUMN_XS.map((x) => (
        <mesh key={`collar-${x}`} position={[x, GANTRY_Y, GANTRY_Z]} castShadow>
          <boxGeometry args={[0.5, BEAM + 0.05, BEAM + 0.05]} />
          <meshStandardMaterial color={COLORS.safetyYellow} metalness={0.15} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function SafetyFence() {
  const postCount = Math.max(2, Math.round(FENCE_LENGTH / FENCE_POST_GAP) + 1);
  return (
    <group>
      {Array.from({ length: postCount }).map((_, i) => {
        const x = FENCE_START_X + (i / (postCount - 1)) * FENCE_LENGTH;
        return (
          <mesh key={i} position={[x, 0.5, FENCE_Z]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 1.0, 8]} />
            <meshStandardMaterial color={COLORS.steelDark} metalness={0.5} roughness={0.45} />
          </mesh>
        );
      })}
      {[0.95, 0.45].map((y) => (
        <mesh key={y} position={[FENCE_MID_X(), y, FENCE_Z]} castShadow>
          <boxGeometry args={[FENCE_LENGTH, 0.06, 0.06]} />
          <meshStandardMaterial color={COLORS.safetyYellow} metalness={0.2} roughness={0.5} />
        </mesh>
      ))}
      {/* Kickplate along the bottom — a bare pair of rails read as thin and
          insubstantial; a real pedestrian barrier has a solid toe-board at
          floor level to stop rolling stock/parts sliding under it. */}
      <mesh position={[FENCE_MID_X(), 0.09, FENCE_Z]} castShadow receiveShadow>
        <boxGeometry args={[FENCE_LENGTH, 0.14, 0.05]} />
        <meshStandardMaterial color="#1c1e22" metalness={0.2} roughness={0.6} />
      </mesh>
    </group>
  );
}

function FENCE_MID_X() {
  return (FENCE_START_X + FENCE_END_X) / 2;
}

/** A short run of alternating yellow/black diagonal hazard stripes, painted
 *  flat on the floor — the "keep clear" zone under a gantry column. */
function HazardPatch({ x, z }: { x: number; z: number }) {
  const stripes = 6;
  const width = 1.8;
  const stripeW = 0.16;
  return (
    <group position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      {Array.from({ length: stripes }).map((_, i) => (
        <mesh key={i} position={[0, (i - (stripes - 1) / 2) * stripeW, 0]}>
          <planeGeometry args={[width, stripeW * 0.82]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? COLORS.safetyYellow : '#1c1e22'}
            roughness={0.85}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  );
}

function FloorMarkings() {
  const walkwayZ = FENCE_Z - 0.55;
  return (
    <group>
      <mesh position={[FENCE_MID_X(), 0.006, walkwayZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FENCE_LENGTH, 0.12]} />
        <meshStandardMaterial color={COLORS.safetyYellow} roughness={0.85} metalness={0} />
      </mesh>
      <HazardPatch x={GANTRY_START_X + 0.5} z={0.9} />
      <HazardPatch x={GANTRY_END_X - 0.5} z={0.9} />
    </group>
  );
}

// ---- back-wall fixtures: pipe runs, signage, andon board, fire
// extinguisher, a personnel door — the wall was reading as an empty flat
// plane even with pilasters, because pilasters alone don't read as
// "equipment," just structure. These sit just proud of the wall face
// (z = WALL_Z + a few cm) the same way the pilasters already do. ----

const WALL_PROP_Z = WALL_Z + 0.13;
const PIPE_RUN_Y: readonly [number, string][] = [
  [2.5, COLORS.steel],
  [2.85, '#b3402f'], // fire-suppression line (real plants color-code this red)
  [5.6, COLORS.steel],
];

const PIPE_CLAMP_GAP = 4.5;

function PipeRuns() {
  const startX = GANTRY_START_X - 1.5;
  const endX = GANTRY_END_X + 1.5;
  const length = endX - startX;
  const midX = (startX + endX) / 2;
  const clampCount = Math.max(2, Math.round(length / PIPE_CLAMP_GAP) + 1);
  return (
    <group>
      {PIPE_RUN_Y.map(([y, color]) => (
        <group key={y}>
          <mesh position={[midX, y, WALL_PROP_Z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.045, 0.045, length, 10]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Wall-mounted support clamps every few metres — without these a
              long straight run viewed obliquely (the default hand-off and
              most close-orbit angles look nearly along the wall) reads as a
              stray diagonal line slicing the frame instead of pipework
              actually fastened to the wall behind it. A box here doesn't fix
              that: viewed nearly end-on down the pipe's own run (its long
              axis pointed almost straight at the camera), a box that thin
              foreshortens to nothing, so the pipe still read as floating.
              A collar sharing the pipe's rotation instead — same axis, just
              a bigger radius — keeps a full ring-shaped silhouette bulging
              around the pipe from every angle, including straight down its
              length, the one view a flat clamp couldn't cover. */}
          {Array.from({ length: clampCount }).map((_, i) => {
            const x = startX + (i / (clampCount - 1)) * length;
            return (
              <mesh key={i} position={[x, y, WALL_PROP_Z]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.085, 0.085, 0.12, 12]} />
                <meshStandardMaterial color={COLORS.steelDark} metalness={0.35} roughness={0.55} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function SignPlacard({ x, y = 3.2, color }: { x: number; y?: number; color: string }) {
  return (
    <group position={[x, y, WALL_PROP_Z]}>
      <mesh castShadow>
        <boxGeometry args={[0.52, 0.36, 0.04]} />
        <meshStandardMaterial color="#eef1f4" metalness={0.1} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[0.42, 0.24]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0} />
      </mesh>
    </group>
  );
}

/** A larger overhead status board (like the reference photo's line-status
 *  monitor) — bright and emissive so it reads as "active display" from
 *  across the room, not just another flat panel. */
function AndonBoard({ x }: { x: number }) {
  return (
    <group position={[x, 4.6, WALL_PROP_Z]}>
      <mesh castShadow>
        <boxGeometry args={[1.3, 0.75, 0.06]} />
        <meshStandardMaterial color="#1c1e22" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.14, 0.04]}>
        <planeGeometry args={[1.1, 0.28]} />
        <meshStandardMaterial color="#0c0e11" emissive={COLORS.healthy} emissiveIntensity={0.9} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.18, 0.04]}>
        <planeGeometry args={[1.1, 0.16]} />
        <meshStandardMaterial color="#0c0e11" emissive="#3a6ea5" emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function FireExtinguisher({ x }: { x: number }) {
  return (
    <group position={[x, 1.0, WALL_PROP_Z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.5, 12]} />
        <meshStandardMaterial color="#b3402f" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.14, 8]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.02, -0.09]}>
        <boxGeometry args={[0.2, 0.32, 0.05]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}

function WallDoor({ x }: { x: number }) {
  return (
    <group position={[x, 1.06, 0]}>
      <mesh position={[0, 0, WALL_Z + 0.045]}>
        <boxGeometry args={[1.14, 2.24, 0.05]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, WALL_Z + 0.07]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.1, 0.08]} />
        <meshStandardMaterial color="#767c84" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0.35, 0, WALL_Z + 0.12]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---- floor clutter: barrels, a crate stack, corner bollards — the open
// aisle floor (beyond the fence, z > FENCE_Z) reads as empty otherwise.
// Kept at z >= 5, well clear of the fence line (2.6) and every robot
// footprint (near-side <= 2.8, far WHEEL-01 pedestal ~2.3-3.3 — see module
// doc above). ----

function Barrel({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.32, 0.9, 16]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.04, 16]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}

function CrateStack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.2, 0.12, 1.0]} />
        <meshStandardMaterial color="#a9752f" roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[-0.2, 0.42, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.6, 0.7]} />
        <meshStandardMaterial color="#c7ccd2" metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0.28, 0.98, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.5, 0.55]} />
        <meshStandardMaterial color={COLORS.safetyYellow} metalness={0.15} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Bollard({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.6, 12]} />
        <meshStandardMaterial color={COLORS.safetyYellow} metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.06, 12]} />
        <meshStandardMaterial color="#1c1e22" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function ControlCabinet({ x }: { x: number }) {
  const z = GANTRY_Z + 0.05;
  return (
    <group position={[x, 0, z]}>
      {/* Body: a real electrical enclosure reads as painted steel, not a
          bright-white slab — near-white made this look like a floating prop
          rather than equipment bolted to the floor. */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 1.7, 0.45]} />
        <meshStandardMaterial color={COLORS.steel} metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.68, 0]} castShadow>
        <boxGeometry args={[0.62, 0.1, 0.47]} />
        <meshStandardMaterial color={COLORS.safetyYellow} metalness={0.2} roughness={0.5} />
      </mesh>
      {/* Door seam + recessed handle — breaks up the flat face so it reads
          as a hinged cabinet door, not a solid block. */}
      <mesh position={[0.06, 0.85, 0.226]}>
        <boxGeometry args={[0.01, 1.55, 0.01]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0.24, 0.85, 0.235]} castShadow>
        <boxGeometry args={[0.05, 0.22, 0.03]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Vent louvres near the top — sells "equipment enclosure with heat
          load" instead of a blank panel. */}
      {[1.42, 1.34, 1.26].map((y) => (
        <mesh key={y} position={[-0.1, y, 0.232]}>
          <boxGeometry args={[0.32, 0.02, 0.02]} />
          <meshStandardMaterial color={COLORS.steelDark} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0.235]}>
        <planeGeometry args={[0.34, 0.24]} />
        <meshStandardMaterial color="#0c0e11" roughness={0.3} metalness={0.1} emissive="#1a2a1e" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.22, 1.5, 0.235]}>
        <circleGeometry args={[0.03, 12]} />
        <meshStandardMaterial color={COLORS.healthy} emissive={COLORS.healthy} emissiveIntensity={1.4} />
      </mesh>
      {/* Cable conduit dropping from the gantry into the top of the cabinet
          — ties it visually to the overhead structure instead of sitting as
          an unconnected floor prop. */}
      <mesh position={[0, GANTRY_Y - (GANTRY_Y - 1.73) / 2, -0.15]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, GANTRY_Y - 1.73, 8]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Behind-the-robots overhead gantry + aisle-side safety fence/floor
 *  markings + one control cabinet per station. See module doc for the
 *  height/side reasoning that keeps this clear of the scripted camera
 *  flythrough. */
export function FactoryStructure() {
  return (
    <group>
      <Gantry />
      <SafetyFence />
      <FloorMarkings />
      {Object.values(ROBOT_X).map((x) => (
        <ControlCabinet key={x} x={x - 1.6} />
      ))}

      {/* Back-wall fixtures — fills the flat wall the pilasters alone left
          reading empty. */}
      <PipeRuns />
      <SignPlacard x={-3} color={COLORS.warning} />
      <SignPlacard x={20.5} color="#3a6ea5" />
      <AndonBoard x={12} />
      <FireExtinguisher x={2} />
      <WallDoor x={9} />

      {/* Open-aisle floor clutter (z >= 5, clear of the fence and every
          robot/rack footprint — see module doc). */}
      <Barrel x={-4} z={6} color="#2f6b9e" />
      <Barrel x={-3.2} z={6.5} color="#c26a1f" />
      <CrateStack x={9} z={6.5} />
      <Bollard x={15.2} z={1.6} />
      <Bollard x={15.2} z={3.3} />

      {/* Back-of-house clutter, between the gantry line and the wall
          (BACK_CLUTTER_Z) — staged pallets/parts the wall fixtures alone
          didn't fill; see BACK_CLUTTER_Z's own doc for why it sits there. */}
      <CrateStack x={-5} z={BACK_CLUTTER_Z} />
      <Barrel x={4.5} z={BACK_CLUTTER_Z} color="#2f6b9e" />
      <Barrel x={5.3} z={BACK_CLUTTER_Z + 0.6} color="#c26a1f" />
      <CrateStack x={14} z={BACK_CLUTTER_Z} />
      <Barrel x={22} z={BACK_CLUTTER_Z} color="#c26a1f" />
      <Barrel x={22.8} z={BACK_CLUTTER_Z + 0.6} color="#2f6b9e" />
    </group>
  );
}
