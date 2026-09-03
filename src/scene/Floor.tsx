import { EXIT_WALL_X, SPAWN_WALL_X } from './Backdrop';
import { COLORS } from './constants';

const JOINT_GAP = 3; // metres between control joints — real poured-slab bays are ~3-4m
const JOINT_WIDTH = 0.045;

// Was a fixed 22 wide, ~48 long, centred on the line — short enough on both
// counts that it had a visible edge well inside where a camera could
// reasonably go: DESPAWN_X (constants.ts, ~42 — where a car is actually
// still travelling) was past the old +X edge entirely, and the +Z side
// (Backdrop.tsx: deliberately no wall there) only needed to reach ~11
// before hitting open background, against a scripted camera excursion to
// z=16 and free-orbit's own 40-unit range. Anchoring X to the end-cap walls
// (with the same margin Conveyor.tsx uses to tuck the belt behind them) and
// giving Z a flat, generous half-depth comfortably past both those reaches
// means there's no edge for fog — now removed — to have been hiding.
const X_MARGIN = 3;
const Z_HALF_DEPTH = 45;

/** Polished epoxy floor over poured concrete. A touch of reflectivity lets
 *  the environment and the line of cars/car bodies read with a real sheen,
 *  and scored control joints at regular intervals (real slabs are poured in
 *  bays, not one seamless sheet) are what actually sell "concrete floor"
 *  instead of a flat studio-cyc color. */
export function Floor() {
  const startX = SPAWN_WALL_X - X_MARGIN;
  const endX = EXIT_WALL_X + X_MARGIN;
  const length = endX - startX;
  const width = Z_HALF_DEPTH * 2;
  const midX = (startX + endX) / 2;
  const jointCount = Math.floor(length / JOINT_GAP);
  return (
    <group>
      <mesh position={[midX, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[length, width]} />
        {/* roughness 0.55 read fine head-on, but at the shallow, near-grazing
            angles this scene is actually viewed from, Fresnel reflectance of
            the bright studio HDRI approaches 1 across almost the whole floor
            — washing it toward white regardless of the base color. A more
            matte finish (real sealed concrete, not a polished showroom
            floor) keeps a hint of sheen without letting it dominate. */}
        <meshStandardMaterial color={COLORS.floor} roughness={0.82} metalness={0} envMapIntensity={0.35} />
      </mesh>
      {Array.from({ length: jointCount + 1 }).map((_, i) => (
        <mesh key={i} position={[startX + i * JOINT_GAP, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[JOINT_WIDTH, width]} />
          <meshStandardMaterial color={COLORS.floorJoint} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
