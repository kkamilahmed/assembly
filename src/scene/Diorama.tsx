// The diorama shell: the raised slab with the clean room's pale floor and
// its floor paint, the L of back walls with their services, glazing along
// the two open sides with the airlock staff come in through, the glazed
// compression suite around the blender and the press, the yard steps and
// the loading dock, and the brand sign.
//
// Heights: the slab top is y=0 and the slab extends down to
// y=-SLAB.thickness, where the white yard floor is.
import { useCallback, useEffect, useMemo } from 'react';
import { useThree, type ThreeElements } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { SLAB, WALL } from './layout';
import { glass, glow, matte, metal, PALETTE, plastic } from './style';
import { BrandSign } from './ui3d/BrandSign';
import { font, slabGeometry } from './ui3d/kit';
import { Panel } from './ui3d/Panel';
import { Paint } from './ui3d/paint';
import { WALL_FACE_X, WALL_FACE_Z, WALL_INSET, WALL_X_END_Z, WALL_Z_END_X } from './ui3d/wallFrame';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Yard steps and loading dock on the +x edge. */
const STEPS = { z0: 1.0, z1: 3.8 } as const;
const DOCK = { z0: 4.05, z1: 7.1 } as const;
/** The clean room's glass skin along the two open sides. */
const GLASS_X = SLAB.maxX - 0.22;
const GLASS_Z = SLAB.maxZ - 0.22;
const GLASS_H = 2.3;
/** Glazed compression suite around the blender and the press. */
const SUITE = { x0: -11.5, x1: -4.5, z0: 3.2, z1: GLASS_Z } as const;
/** The suite's door, on its +x side. */
const SUITE_DOOR = { z0: 4.85, z1: 6.25 } as const;
/** Airlock just inside the steps: outer door onto the steps, inner door
 *  into the room. */
const AIRLOCK = { x0: 6.0, x1: GLASS_X, z0: 1.3, z1: 3.5 } as const;
const AIRLOCK_DOOR = { z0: 2.0, z1: 2.8 } as const;
/** Where the cartoner's outfeed passes out through the glass. */
const HATCH = { z0: 4.55, z1: 5.45 } as const;

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
// Sealed vinyl: low roughness so the key light leaves a soft sheen on it,
// with the environment kept low so the pale floor keeps its tone instead of
// washing out into the white background.
const FLOOR = dimmed(matte(PALETTE.slabTop, 0.38), 0.32);
const PAINT_WHITE = dimmed(matte(PALETTE.hazardLight, 0.6), 0.3);
const PAINT_AMBER = dimmed(matte(PALETTE.amber, 0.6), 0.45);
const PAINT_BLUE = dimmed(matte(PALETTE.blue, 0.6), 0.45);
const PAINT_GREY = dimmed(matte(PALETTE.steelDark, 0.6), 0.35);
const TILE = dimmed(matte(PALETTE.floorWhite, 0.45), 0.3);
const TILE_LINE = dimmed(matte(PALETTE.tileLine, 0.6), 0.35);

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

// ---------------------------------------------------------- floor paint

/** Coved skirting strip under the glazing, in from the slab edge. */
const SILL = 0.32;

function buildPaint() {
  const blue = new Paint();
  const amber = new Paint();
  const grey = new Paint();

  // Walkway down the yard side of the inspection leg, from the electrical
  // cabinet to the airlock. Packaging stock sits either side of it.
  const C = 0.95; // keep paint this far from the conveyor centreline
  blue.line(5.12, -6.4, 5.12, 1.1, 0.06, { clear: C });
  blue.line(6.08, -6.4, 6.08, 1.1, 0.06, { clear: C });
  blue.arrow(5.6, -5.0, Math.PI / 2, 0.38).arrow(5.6, -1.9, Math.PI / 2, 0.38);
  // Step-over marks in front of the airlock's inner door.
  for (let z = AIRLOCK_DOOR.z0; z < AIRLOCK_DOOR.z1 - 0.05; z += 0.2) grey.rect({ x0: AIRLOCK.x0 - 0.5, x1: AIRLOCK.x0 - 0.12, z0: z, z1: z + 0.1 });

  // Walkways inside the line's U: one across the floor in front of the
  // coating drum, one from the suite's door, and a link between the two.
  const cross = { z0: -2.02, z1: -0.82, x0: -7.7, x1: 1.95 };
  const link = { x0: -3.0, x1: -1.98 };
  const door = { z0: SUITE_DOOR.z0 + 0.07, z1: SUITE_DOOR.z1 - 0.17, x0: SUITE.x1 + 0.1 };
  blue.line(cross.x0, cross.z0, cross.x1, cross.z0, 0.06, { clear: C });
  blue.line(cross.x0, cross.z1, link.x0, cross.z1, 0.06, { clear: C });
  blue.line(link.x1, cross.z1, cross.x1, cross.z1, 0.06, { clear: C });
  blue.line(link.x0, cross.z1, link.x0, door.z0, 0.06);
  blue.line(link.x1, cross.z1, link.x1, door.z1, 0.06);
  blue.line(door.x0, door.z0, link.x0, door.z0, 0.06);
  blue.line(door.x0, door.z1, link.x1, door.z1, 0.06);
  blue.arrow(-5.6, -1.42, 0, 0.38).arrow(0.9, -1.42, 0, 0.38);
  blue.arrow(-2.49, 2.4, -Math.PI / 2, 0.38).arrow(-3.7, 5.5, Math.PI, 0.38);

  // In-process hold for the tray trolleys, and the goods-in bay.
  const dash = { dash: 0.3, gap: 0.2 };
  const bays = [
    { x0: -1.85, x1: 1.95, z0: -0.62, z1: 1.5 },
    { x0: -4.4, x1: -3.25, z0: 6.15, z1: 7.3 },
  ];
  for (const b of bays) {
    amber.line(b.x0, b.z0, b.x1, b.z0, 0.06, dash).line(b.x0, b.z1, b.x1, b.z1, 0.06, dash);
    amber.line(b.x0, b.z0, b.x0, b.z1, 0.06, dash).line(b.x1, b.z0, b.x1, b.z1, 0.06, dash);
  }

  // Keep-clear box in front of the electrical cabinet on the back wall.
  const kc = { x0: 4.75, x1: 6.45, z0: WALL_FACE_Z + 0.12, z1: -6.55 };
  amber.stripes({ x0: kc.x0 + 0.1, x1: kc.x1 - 0.1, z0: kc.z0 + 0.1, z1: kc.z1 - 0.1 }, 'x', 0.12, 0.3, 0.4);
  amber.line(kc.x0, kc.z0, kc.x1, kc.z0, 0.07).line(kc.x0, kc.z1, kc.x1, kc.z1, 0.07);
  amber.line(kc.x0, kc.z0 - 0.035, kc.x0, kc.z1 + 0.035, 0.07).line(kc.x1, kc.z0 - 0.035, kc.x1, kc.z1 + 0.035, 0.07);

  return { blue: blue.build(), amber: amber.build(), grey: grey.build() };
}

function FloorPaint() {
  const { blue, amber, grey } = useMemo(() => buildPaint(), []);
  const kerb = 0.03;
  // Dark coved skirting along the two glazed sides, the references' dark
  // edge band, so the pale floor has a crisp boundary.
  const sills = [
    { x0: WALL_FACE_X - 0.36, x1: SLAB.maxX - 0.06, z0: SLAB.maxZ - SILL - 0.06, z1: SLAB.maxZ - 0.06 },
    { x0: SLAB.maxX - SILL - 0.06, x1: SLAB.maxX - 0.06, z0: WALL_FACE_Z - 0.36, z1: SLAB.maxZ - SILL - 0.06 },
  ];
  return (
    <group>
      <mesh geometry={blue} position-y={0.004} material={PAINT_BLUE} receiveShadow />
      <mesh geometry={amber} position-y={0.004} material={PAINT_AMBER} receiveShadow />
      <mesh geometry={grey} position-y={0.004} material={PAINT_GREY} receiveShadow />
      {sills.map((b, i) => (
        <RoundedBox
          key={i}
          args={[b.x1 - b.x0, kerb, b.z1 - b.z0]}
          radius={0.012}
          smoothness={2}
          position={[(b.x0 + b.x1) / 2, kerb / 2, (b.z0 + b.z1) / 2]}
          material={matte(PALETTE.hazardDark, 0.6)}
          receiveShadow
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------ compression suite

function buildTileLines() {
  const lines = new Paint();
  const border = new Paint();
  const w = 0.028;
  for (let x = SUITE.x0 + 1; x < SUITE.x1 - 0.2; x += 1) lines.line(x, SUITE.z0 + 0.05, x, SUITE.z1 - 0.05, w);
  const rows = 4;
  const pitch = (SUITE.z1 - SUITE.z0) / rows;
  for (let i = 1; i < rows; i++) lines.line(SUITE.x0 + 0.05, SUITE.z0 + pitch * i, SUITE.x1 - 0.05, SUITE.z0 + pitch * i, w);
  // Blue line just inside the suite's glass, broken at the door and where
  // the conveyor leaves.
  const m = 0.2;
  border.line(SUITE.x0 + m, SUITE.z0 + m, SUITE.x1 - m, SUITE.z0 + m, 0.08, { clear: 0.95 });
  border.line(SUITE.x1 - m, SUITE.z0 + m, SUITE.x1 - m, SUITE_DOOR.z0, 0.08);
  border.line(SUITE.x1 - m, SUITE_DOOR.z1, SUITE.x1 - m, SUITE.z1 - m, 0.08);
  return { lines: lines.build(), border: border.build() };
}

/** A run of framed glass panels between two floor points. `open` leaves
 *  a doorway (header rail only); `door` fills it with a glazed door leaf;
 *  `hatch` leaves a low opening for a conveyor under a glass transom. */
function GlassRun({
  from,
  to,
  height = 2.4,
  open = false,
  door = false,
  hatch = false,
}: {
  from: [number, number];
  to: [number, number];
  height?: number;
  open?: boolean;
  door?: boolean;
  hatch?: boolean;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const panes = Math.max(1, Math.round(len / 1.7));
  const frame = metal(PALETTE.steelDark, 0.35);
  const posts = Array.from({ length: panes + 1 }, (_, i) => -len / 2 + (len * i) / panes);
  const solid = !open && !door && !hatch;
  const sill = hatch ? 1.15 : 0;
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation-y={-Math.atan2(dz, dx)}>
      <RoundedBox args={[len + 0.07, 0.07, 0.08]} radius={0.02} smoothness={2} position-y={height} material={frame} castShadow />
      {(solid || hatch) && (
        <mesh position-y={(height + sill) / 2 + 0.05} material={glass()}>
          <boxGeometry args={[len - 0.06, height - sill - 0.14, 0.03]} />
        </mesh>
      )}
      {hatch && <RoundedBox args={[len + 0.04, 0.08, 0.1]} radius={0.02} smoothness={2} position-y={sill} material={frame} castShadow />}
      {solid && <RoundedBox args={[len, 0.1, 0.09]} radius={0.02} smoothness={2} position-y={0.05} material={frame} castShadow receiveShadow />}
      {(solid ? posts : hatch ? [-len / 2, len / 2] : []).map((x, i) => (
        <RoundedBox key={i} args={[0.07, height, 0.08]} radius={0.02} smoothness={2} position={[x, height / 2, 0]} material={frame} castShadow />
      ))}
      {door && (
        // A glazed leaf swung half open, on its hinge post.
        <group position={[-len / 2 + 0.04, 0, 0]} rotation-y={0.9}>
          <RoundedBox args={[0.07, height - 0.04, 0.07]} radius={0.02} smoothness={2} position={[0, height / 2 - 0.02, 0]} material={frame} castShadow />
          <RoundedBox args={[len - 0.1, 0.07, 0.06]} radius={0.02} smoothness={2} position={[(len - 0.1) / 2, height - 0.08, 0]} material={frame} castShadow />
          <RoundedBox args={[len - 0.1, 0.09, 0.06]} radius={0.02} smoothness={2} position={[(len - 0.1) / 2, 0.08, 0]} material={frame} castShadow />
          <RoundedBox args={[0.06, height - 0.04, 0.06]} radius={0.02} smoothness={2} position={[len - 0.12, height / 2 - 0.02, 0]} material={frame} castShadow />
          <mesh position={[(len - 0.1) / 2, height / 2, 0]} material={glass()}>
            <boxGeometry args={[len - 0.18, height - 0.2, 0.02]} />
          </mesh>
          <RoundedBox args={[0.03, 0.3, 0.05]} radius={0.012} smoothness={2} position={[len - 0.2, 1.05, 0.05]} material={matte(PALETTE.graphite, 0.5)} />
        </group>
      )}
    </group>
  );
}

function CompressionSuite({ partition }: { partition: boolean }) {
  const { lines, border } = useMemo(() => buildTileLines(), []);
  const w = SUITE.x1 - SUITE.x0;
  const d = SUITE.z1 - SUITE.z0;
  const t = 0.03;
  return (
    <group>
      <mesh
        rotation={FLAT}
        position={[(SUITE.x0 + SUITE.x1) / 2, 0, (SUITE.z0 + SUITE.z1) / 2]}
        geometry={slabGeometry(w, d, t, 0.1, 0.01)}
        material={TILE}
        receiveShadow
      />
      <mesh geometry={lines} position-y={t + 0.002} material={TILE_LINE} receiveShadow />
      <mesh geometry={border} position-y={t + 0.003} material={PAINT_BLUE} receiveShadow />
      {partition && (
        <>
          {/* Back side, with a gap where the conveyor leaves the suite. */}
          <GlassRun from={[SUITE.x0 + 0.05, SUITE.z0]} to={[-9.95, SUITE.z0]} />
          <GlassRun from={[-9.95, SUITE.z0]} to={[-8.05, SUITE.z0]} open />
          <GlassRun from={[-8.05, SUITE.z0]} to={[SUITE.x1, SUITE.z0]} />
          {/* Room side, with the door onto the walkway. */}
          <GlassRun from={[SUITE.x1, SUITE.z0]} to={[SUITE.x1, SUITE_DOOR.z0]} />
          <GlassRun from={[SUITE.x1, SUITE_DOOR.z0]} to={[SUITE.x1, SUITE_DOOR.z1]} open />
          <GlassRun from={[SUITE.x1, SUITE_DOOR.z1]} to={[SUITE.x1, GLASS_Z]} />
          <RoomSign position={[SUITE.x1 + 0.05, 2.66, (SUITE_DOOR.z0 + SUITE_DOOR.z1) / 2]} rotation-y={Math.PI / 2} text="COMPRESSION" />
        </>
      )}
    </group>
  );
}

/** A small sign over a door: brand blue with white lettering. */
function RoomSign({ text, ...props }: { text: string } & Omit<ThreeElements['group'], 'children'>) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = PALETTE.brand;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = font(700, h * 0.48);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${h * 0.06}px`;
      ctx.fillText(text, w / 2, h * 0.54);
    },
    [text],
  );
  return (
    <group {...props}>
      <Panel width={1.5} height={0.34} depth={0.06} radius={0.08} standoff={0.02} color={PALETTE.brand} rimColor={PALETTE.brandDeep} lift={0.03} draw={draw} />
    </group>
  );
}

/** The clean room's glazing along the two open sides of the slab, with the
 *  airlock in the +x side and a hatch for the cartoner's outfeed. */
function PerimeterGlass() {
  const wallX = WALL_FACE_X - WALL.thickness / 2;
  const wallZ = WALL_FACE_Z - WALL.thickness / 2;
  return (
    <group>
      {/* From the end of each back wall out to the corner of the glazing. */}
      <GlassRun from={[wallX, WALL_X_END_Z]} to={[wallX, GLASS_Z]} height={GLASS_H} />
      <GlassRun from={[WALL_Z_END_X, wallZ]} to={[GLASS_X, wallZ]} height={GLASS_H} />
      <GlassRun from={[wallX, GLASS_Z]} to={[GLASS_X, GLASS_Z]} height={GLASS_H} />
      <GlassRun from={[GLASS_X, wallZ]} to={[GLASS_X, AIRLOCK.z0]} height={GLASS_H} />
      <GlassRun from={[GLASS_X, AIRLOCK.z1]} to={[GLASS_X, HATCH.z0]} height={GLASS_H} />
      <GlassRun from={[GLASS_X, HATCH.z0]} to={[GLASS_X, HATCH.z1]} height={GLASS_H} hatch />
      <GlassRun from={[GLASS_X, HATCH.z1]} to={[GLASS_X, GLASS_Z]} height={GLASS_H} />
    </group>
  );
}

/** Airlock: a glazed box with an outer door onto the yard steps and an
 *  inner door into the room, a step-over bench and a rack of gowns. */
function Airlock() {
  const { x0, x1, z0, z1 } = AIRLOCK;
  const steel = metal(PALETTE.steel, 0.3);
  return (
    <group>
      <mesh rotation={FLAT} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} geometry={slabGeometry(x1 - x0, z1 - z0, 0.025, 0.06, 0.008)} material={TILE} receiveShadow />
      <GlassRun from={[x0, z0]} to={[x1, z0]} height={GLASS_H} />
      <GlassRun from={[x0, z1]} to={[x1, z1]} height={GLASS_H} />
      <GlassRun from={[x0, z0]} to={[x0, AIRLOCK_DOOR.z0]} height={GLASS_H} />
      <GlassRun from={[x0, AIRLOCK_DOOR.z0]} to={[x0, AIRLOCK_DOOR.z1]} height={GLASS_H} door />
      <GlassRun from={[x0, AIRLOCK_DOOR.z1]} to={[x0, z1]} height={GLASS_H} />
      <GlassRun from={[x1, AIRLOCK_DOOR.z0]} to={[x1, AIRLOCK_DOOR.z1]} height={GLASS_H} door />
      {/* Step-over bench across the middle, and gowns hung on a rail along
          the back glass. */}
      <RoundedBox args={[0.34, 0.06, 1.0]} radius={0.02} smoothness={2} position={[(x0 + x1) / 2, 0.46, z0 + 0.62]} material={plastic(PALETTE.white, 0.4)} castShadow receiveShadow />
      {[-0.4, 0.4].map((dz) => (
        <RoundedBox key={dz} args={[0.05, 0.44, 0.05]} radius={0.015} smoothness={2} position={[(x0 + x1) / 2, 0.22, z0 + 0.62 + dz]} material={steel} castShadow />
      ))}
      <Rod a={[x0 + 0.35, 1.72, z1 - 0.2]} b={[x1 - 0.35, 1.72, z1 - 0.2]} r={0.018} material={steel} />
      {[0, 1, 2].map((i) => (
        <RoundedBox
          key={i}
          args={[0.36, 0.92, 0.08]}
          radius={0.035}
          smoothness={2}
          position={[x0 + 0.55 + i * 0.4, 1.22, z1 - 0.22]}
          material={matte(PALETTE.coat, 0.75)}
          castShadow
        />
      ))}
      <RoomSign position={[x0 - 0.05, 2.66, (AIRLOCK_DOOR.z0 + AIRLOCK_DOOR.z1) / 2]} rotation-y={-Math.PI / 2} text="AIRLOCK" />
    </group>
  );
}

// ------------------------------------------------------ steps and dock

/** A round bar between two points. */
function Rod({ a, b, r = 0.03, material }: { a: [number, number, number]; b: [number, number, number]; r?: number; material: THREE.Material }) {
  const { mid, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    return {
      mid: va.clone().add(vb).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      len: dir.length(),
    };
    // Endpoints are literal tuples at every call site; compare by value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [a.join(), b.join()]);
  return (
    <mesh position={mid} quaternion={quat} material={material} castShadow>
      <capsuleGeometry args={[r, len, 4, 12]} />
    </mesh>
  );
}

function YardSteps() {
  const treads = 3;
  const rise = SLAB.thickness / (treads + 1);
  const run = 0.42;
  const width = STEPS.z1 - STEPS.z0;
  const zc = (STEPS.z0 + STEPS.z1) / 2;
  const x0 = SLAB.maxX - 0.1;
  const body = FLOOR;
  const rail = metal(PALETTE.steel, 0.3);
  const railY = 0.95;
  const endX = SLAB.maxX + run * treads;
  return (
    <group>
      {Array.from({ length: treads }, (_, i) => {
        const top = -rise * (i + 1);
        const x1 = SLAB.maxX + run * (i + 1);
        const h = SLAB.thickness + top;
        return (
          <group key={i}>
            <RoundedBox
              args={[x1 - x0, h, width]}
              radius={0.035}
              smoothness={3}
              position={[(x0 + x1) / 2, -SLAB.thickness + h / 2, zc]}
              material={body}
              castShadow
              receiveShadow
            />
            <mesh position={[x1 - 0.07, top + 0.002, zc]} rotation={FLAT} material={PAINT_WHITE} receiveShadow>
              <planeGeometry args={[0.06, width - 0.16]} />
            </mesh>
          </group>
        );
      })}
      {[STEPS.z0 + 0.06, STEPS.z1 - 0.06].map((z) => (
        <group key={z}>
          <Rod a={[SLAB.maxX - 0.3, 0, z]} b={[SLAB.maxX - 0.3, railY, z]} material={rail} />
          <Rod a={[endX - 0.12, -SLAB.thickness + rise, z]} b={[endX - 0.12, railY - SLAB.thickness + rise, z]} material={rail} />
          <Rod a={[SLAB.maxX - 0.3, railY, z]} b={[endX - 0.12, railY - SLAB.thickness + rise, z]} material={rail} />
          <Rod a={[SLAB.maxX - 0.3, railY * 0.5, z]} b={[endX - 0.12, railY * 0.5 - SLAB.thickness + rise, z]} r={0.02} material={rail} />
        </group>
      ))}
    </group>
  );
}

function LoadingDock() {
  const zc = (DOCK.z0 + DOCK.z1) / 2;
  const len = DOCK.z1 - DOCK.z0;
  return (
    <group>
      {/* Steel edge angle along the dock lip. */}
      <RoundedBox args={[0.1, 0.16, len]} radius={0.025} smoothness={2} position={[SLAB.maxX + 0.04, -0.06, zc]} material={metal(PALETTE.steelDark, 0.35)} castShadow />
      {/* Rubber bumpers on the dock face. */}
      {[DOCK.z0 + 0.35, DOCK.z1 - 0.35].map((z) => (
        <RoundedBox key={z} args={[0.16, 0.36, 0.34]} radius={0.05} smoothness={3} position={[SLAB.maxX + 0.1, -0.36, z]} material={matte(PALETTE.rubber, 0.7)} castShadow />
      ))}
    </group>
  );
}

// --------------------------------------------------------------- walls

function Vent({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.5, 0.95, 0.07]} radius={0.03} smoothness={2} position-z={0.035} material={plastic(PALETTE.wallTrim, 0.35)} castShadow />
      {[-0.3, -0.15, 0, 0.15, 0.3].map((y) => (
        <RoundedBox key={y} args={[1.26, 0.07, 0.05]} radius={0.02} smoothness={2} position={[0, y, 0.085]} rotation-x={0.5} material={metal(PALETTE.steelDark, 0.4)} />
      ))}
    </group>
  );
}

function Walls() {
  const wall = plastic(PALETTE.wall, 0.2);
  const trim = plastic(PALETTE.wallTrim, 0.35);
  const steel = metal(PALETTE.steel, 0.3);
  const t = WALL.thickness;
  const h = WALL.height;
  // The -x wall runs along z, the -z wall along x. They butt at the corner.
  const xWall = { z0: SLAB.minZ + WALL_INSET, z1: WALL_X_END_Z, x: WALL_FACE_X - t / 2 };
  const zWall = { x0: WALL_FACE_X, x1: WALL_Z_END_X, z: WALL_FACE_Z - t / 2 };
  const xLen = xWall.z1 - xWall.z0;
  const zLen = zWall.x1 - zWall.x0;
  const xMid = (xWall.z0 + xWall.z1) / 2;
  const zMid = (zWall.x0 + zWall.x1) / 2;
  const pipeY = 4.05;
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

      {/* Services on the -z wall: purified water and clean air runs, a cable
          tray, return-air grilles, a cabinet. */}
      <group position={[0, 0, WALL_FACE_Z]}>
        <Rod a={[-2.3, pipeY, 0.16]} b={[6.75, pipeY, 0.16]} r={0.07} material={plastic(PALETTE.brand, 0.3)} />
        <Rod a={[-2.3, pipeY, 0.16]} b={[-2.3, 0.3, 0.16]} r={0.07} material={plastic(PALETTE.brand, 0.3)} />
        <Rod a={[-1.9, pipeY + 0.26, 0.16]} b={[6.75, pipeY + 0.26, 0.16]} r={0.055} material={steel} />
        <Rod a={[-1.9, pipeY + 0.26, 0.16]} b={[-1.9, 0.3, 0.16]} r={0.055} material={steel} />
        {[-2.1, 0.2, 2.5, 4.8, 6.5].map((x) => (
          <RoundedBox key={x} args={[0.1, 0.6, 0.2]} radius={0.02} smoothness={2} position={[x, pipeY + 0.13, 0.1]} material={trim} castShadow />
        ))}
        {[1.2, 3.0].map((y) => (
          <RoundedBox key={y} args={[0.72, 0.1, 0.2]} radius={0.02} smoothness={2} position={[-2.1, y, 0.1]} material={trim} castShadow />
        ))}

        <RoundedBox args={[6.4, 0.07, 0.3]} radius={0.02} smoothness={2} position={[3.5, 5.25, 0.17]} material={metal(PALETTE.steelDark, 0.4)} castShadow />
        <RoundedBox args={[6.4, 0.14, 0.03]} radius={0.012} smoothness={2} position={[3.5, 5.31, 0.31]} material={metal(PALETTE.steelDark, 0.4)} castShadow />
        {[0.9, 3.5, 6.1].map((x) => (
          <RoundedBox key={x} args={[0.07, 0.3, 0.3]} radius={0.02} smoothness={2} position={[x, 5.12, 0.16]} material={trim} />
        ))}

        <Vent position={[1.3, 2.45, 0]} />
        <Vent position={[3.15, 2.45, 0]} />

        {/* Electrical cabinet with a status lamp, fed from the tray. */}
        <group position={[5.6, 0, 0]}>
          <RoundedBox args={[1.15, 1.7, 0.36]} radius={0.05} smoothness={3} position={[0, 1.75, 0.18]} material={metal(PALETTE.steel, 0.32)} castShadow receiveShadow />
          <RoundedBox args={[0.98, 1.5, 0.03]} radius={0.03} smoothness={2} position={[0, 1.75, 0.37]} material={metal(PALETTE.offWhite, 0.4)} />
          <RoundedBox args={[0.05, 0.3, 0.05]} radius={0.02} smoothness={2} position={[0.36, 1.75, 0.41]} material={plastic(PALETTE.brand)} />
          <mesh position={[-0.3, 2.3, 0.4]} material={glow(PALETTE.healthy, 2)}>
            <sphereGeometry args={[0.055, 16, 12]} />
          </mesh>
          <Rod a={[0.25, 2.6, 0.2]} b={[0.25, 5.2, 0.2]} r={0.04} material={matte(PALETTE.rubber, 0.6)} />
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------- diorama

export interface DioramaProps {
  /** The glazed compression suite around the blender and the press. */
  suite?: boolean;
  /** The suite's glass partition. */
  partition?: boolean;
  /** The perimeter glazing and the airlock. */
  glazing?: boolean;
  /** The brand sign on the -z wall. */
  sign?: boolean;
}

export function Diorama({ suite = true, partition = true, glazing = true, sign = true }: DioramaProps) {
  useStudioDimming();
  return (
    <group>
      <Slab />
      <FloorPaint />
      {suite && <CompressionSuite partition={partition} />}
      {glazing && <PerimeterGlass />}
      {glazing && <Airlock />}
      <YardSteps />
      <LoadingDock />
      <Walls />
      {sign && <BrandSign position={[-4.6, 5.6, WALL_FACE_Z]} />}
    </group>
  );
}
