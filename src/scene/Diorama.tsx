// The diorama shell: the raised city-block slab, the avenue's road paint
// and the pavements, the L of back walls with their big screens, and the
// brand sign.
//
// Heights: the slab top is y=0 and the slab extends down to
// y=-SLAB.thickness, where the white yard floor is.
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { AVENUE, HUB, PAVEMENT_NORTH, PLAZA, SLAB, SOURCE_ROW, WALL } from './layout';
import { matte, PALETTE, plastic } from './style';
import { BrandSign } from './ui3d/BrandSign';
import { slabGeometry } from './ui3d/kit';
import { Paint } from './ui3d/paint';
import { WallBoards } from './ui3d/WallBoards';
import { WALL_FACE_X, WALL_FACE_Z, WALL_INSET, WALL_X_END_Z, WALL_Z_END_X } from './ui3d/wallFrame';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

// The studio's overhead light panel reflects off every upward face. On the
// big floor planes that lifts charcoal to mid grey and pushes white paint
// into the bloom, so these materials take only a share of the environment.
// (A material only honours its own envMapIntensity once it has its own
// envMap, which useStudioDimming assigns from the scene.)
const DIMMED: THREE.MeshStandardMaterial[] = [];
function dimmed(base: THREE.MeshStandardMaterial, env: number): THREE.MeshStandardMaterial {
  const m = base.clone();
  m.envMapIntensity = env;
  DIMMED.push(m);
  return m;
}
// Sealed asphalt: low roughness so the lanes' glow and the key light leave
// a soft sheen on it, with the environment kept low so it stays charcoal.
const FLOOR = dimmed(matte(PALETTE.slabTop, 0.38), 0.5);
const PAINT_WHITE = dimmed(matte(PALETTE.hazardLight, 0.6), 0.3);
const PAINT_AMBER = dimmed(matte(PALETTE.amber, 0.6), 0.45);
const PAVING = dimmed(matte(PALETTE.paving, 0.55), 0.35);
const PAVING_JOINT = dimmed(matte(PALETTE.pavingDark, 0.6), 0.35);
const PLAZA_TILE = dimmed(matte('#d6d9de', 0.5), 0.35);

function useStudioDimming() {
  const env = useThree((s) => s.scene.environment);
  useEffect(() => {
    for (const m of DIMMED) {
      m.envMap = env;
      m.needsUpdate = true;
    }
  }, [env]);
}

// ---------------------------------------------------------------- slab

function Slab() {
  const w = SLAB.maxX - SLAB.minX;
  const d = SLAB.maxZ - SLAB.minZ;
  const cx = (SLAB.minX + SLAB.maxX) / 2;
  const cz = (SLAB.minZ + SLAB.maxZ) / 2;
  const lip = 0.07;
  const base = plastic(PALETTE.slabSide, 0.45);
  const top = useMemo(() => [FLOOR, plastic(PALETTE.slabEdge, 0.4)], []);
  return (
    <group position={[cx, 0, cz]}>
      <mesh
        rotation={FLAT}
        position-y={-SLAB.thickness}
        geometry={slabGeometry(w, d, SLAB.thickness - lip, 0.45, 0.04)}
        material={base}
        castShadow
        receiveShadow
      />
      {/* A thin top plate, a hair wider, gives the slab its lighter top edge. */}
      <mesh rotation={FLAT} position-y={-lip} geometry={slabGeometry(w + 0.03, d + 0.03, lip, 0.465, 0.02)} material={top} castShadow receiveShadow />
    </group>
  );
}

// ------------------------------------------------------------ the street

/** Kerb height of the pavements over the asphalt. */
const KERB = 0.06;
const X_FRONT = SLAB.maxX - 0.12;

interface Strip {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The raised pavements: along the front of the hub, behind the row of
 *  sources, and along the front edge of the block. */
const PAVEMENTS: Strip[] = [
  { x0: WALL_FACE_X, x1: X_FRONT, z0: PAVEMENT_NORTH.z0, z1: PAVEMENT_NORTH.z1 },
  { x0: WALL_FACE_X, x1: X_FRONT, z0: AVENUE.z1, z1: SOURCE_ROW.z0 },
  { x0: WALL_FACE_X, x1: X_FRONT, z0: SOURCE_ROW.z1, z1: SLAB.maxZ - 0.12 },
];

function buildPaint() {
  const white = new Paint();
  const amber = new Paint();
  const joints = new Paint();
  // The avenue: solid edge lines and a dashed centre line between the two
  // pairs of lanes.
  const x0 = WALL_FACE_X + 0.1;
  white.line(x0, AVENUE.z0 + 0.1, X_FRONT - 0.1, AVENUE.z0 + 0.1, 0.06);
  white.line(x0, AVENUE.z1 - 0.1, X_FRONT - 0.1, AVENUE.z1 - 0.1, 0.06);
  amber.line(x0, 0.325, X_FRONT - 0.1, 0.325, 0.06, { dash: 0.6, gap: 0.45 });
  // A zebra crossing at the east end, where no lane runs.
  for (let z = AVENUE.z0 + 0.2; z < AVENUE.z1 - 0.2; z += 0.36) white.rect({ x0: 5.7, x1: 6.9, z0: z, z1: z + 0.2 });
  // Paving joints on every pavement.
  for (const p of PAVEMENTS) {
    for (let x = p.x0 + 0.9; x < p.x1 - 0.2; x += 0.9) joints.line(x, p.z0 + 0.04, x, p.z1 - 0.04, 0.025);
  }
  // Plaza tiles.
  for (let x = PLAZA.x0 + 0.9; x < X_FRONT - 0.2; x += 0.9) joints.line(x, WALL_FACE_Z + 0.05, x, PLAZA.z1 - 0.05, 0.025);
  for (let z = WALL_FACE_Z + 0.9; z < PLAZA.z1 - 0.2; z += 0.9) joints.line(PLAZA.x0 + 0.05, z, X_FRONT - 0.05, z, 0.025);
  return { white: white.build(), amber: amber.build(), joints: joints.build() };
}

function Street() {
  const { white, amber, joints } = useMemo(() => buildPaint(), []);
  return (
    <group>
      {PAVEMENTS.map((p) => (
        <mesh
          key={p.z0}
          rotation={FLAT}
          position={[(p.x0 + p.x1) / 2, 0, (p.z0 + p.z1) / 2]}
          geometry={slabGeometry(p.x1 - p.x0, p.z1 - p.z0, KERB, 0.04, 0.012)}
          material={PAVING}
          castShadow
          receiveShadow
        />
      ))}
      <mesh
        rotation={FLAT}
        position={[(PLAZA.x0 + X_FRONT) / 2, 0, (WALL_FACE_Z + PLAZA.z1) / 2]}
        geometry={slabGeometry(X_FRONT - PLAZA.x0, PLAZA.z1 - WALL_FACE_Z, KERB, 0.04, 0.012)}
        material={PLAZA_TILE}
        receiveShadow
      />
      <mesh geometry={white} position-y={0.004} material={PAINT_WHITE} receiveShadow />
      <mesh geometry={amber} position-y={0.004} material={PAINT_AMBER} receiveShadow />
      <mesh geometry={joints} position-y={KERB + 0.002} material={PAVING_JOINT} receiveShadow />
    </group>
  );
}

// --------------------------------------------------------------- walls

function Walls() {
  const wall = plastic(PALETTE.wall, 0.2);
  const trim = plastic(PALETTE.wallTrim, 0.35);
  const t = WALL.thickness;
  const h = WALL.height;
  // The -x wall runs along z, the -z wall along x. They butt at the corner.
  const xWall = { z0: SLAB.minZ + WALL_INSET, z1: WALL_X_END_Z, x: WALL_FACE_X - t / 2 };
  const zWall = { x0: WALL_FACE_X, x1: WALL_Z_END_X, z: WALL_FACE_Z - t / 2 };
  const xLen = xWall.z1 - xWall.z0;
  const zLen = zWall.x1 - zWall.x0;
  const xMid = (xWall.z0 + xWall.z1) / 2;
  const zMid = (zWall.x0 + zWall.x1) / 2;
  return (
    <group>
      <RoundedBox args={[t, h, xLen]} radius={0.06} smoothness={3} position={[xWall.x, h / 2, xMid]} material={wall} castShadow receiveShadow />
      <RoundedBox args={[zLen, h, t]} radius={0.06} smoothness={3} position={[zMid, h / 2, zWall.z]} material={wall} castShadow receiveShadow />

      {/* Caps and skirting. */}
      <RoundedBox args={[t + 0.08, 0.1, xLen + 0.06]} radius={0.03} smoothness={2} position={[xWall.x, h + 0.03, xMid]} material={trim} castShadow />
      <RoundedBox args={[zLen + 0.04, 0.1, t + 0.08]} radius={0.03} smoothness={2} position={[zMid + 0.03, h + 0.03, zWall.z]} material={trim} castShadow />
      <RoundedBox args={[0.08, 0.32, xLen - 0.5]} radius={0.02} smoothness={2} position={[WALL_FACE_X + 0.02, 0.16, xMid + 0.1]} material={trim} receiveShadow />
      <RoundedBox args={[zLen - 0.3, 0.32, 0.08]} radius={0.02} smoothness={2} position={[zMid, 0.16, WALL_FACE_Z + 0.02]} material={trim} receiveShadow />

      {/* Panel joints on the -z wall. */}
      {[-7.9, -4.2, -0.5, 3.2].map((x) => (
        <mesh key={x} position={[x, h / 2 + 0.16, WALL_FACE_Z + 0.004]} material={trim}>
          <boxGeometry args={[0.035, h - 0.42, 0.008]} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------- diorama

export interface DioramaProps {
  /** The brand sign and the big screens on the walls. */
  boards?: boolean;
}

export function Diorama({ boards = true }: DioramaProps) {
  useStudioDimming();
  return (
    <group>
      <Slab />
      <Street />
      <Walls />
      {boards && (
        <>
          <BrandSign position={[(HUB.x0 + HUB.x1) / 2 - 0.4, 5.15, WALL_FACE_Z]} />
          <WallBoards />
        </>
      )}
    </group>
  );
}
