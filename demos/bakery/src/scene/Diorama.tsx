// The diorama shell: the raised factory slab, hazard edges and floor paint,
// the L of back walls with their services, the tiled hygiene zone with its
// glass partition, the yard steps and loading dock, and the brand sign.
//
// Heights: the slab top is y=0 and the slab extends down to
// y=-SLAB.thickness, where the white yard floor is.
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { SLAB, WALL } from './layout';
import { glass, glow, matte, metal, PALETTE, plastic } from './style';
import { BrandSign } from './ui3d/BrandSign';
import { slabGeometry } from './ui3d/kit';
import { Paint } from './ui3d/paint';
import { WALL_FACE_X, WALL_FACE_Z, WALL_INSET, WALL_X_END_Z, WALL_Z_END_X } from './ui3d/wallFrame';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Tiled hygiene zone around the mixer. */
const CLEAN = { x0: -11.5, x1: -6.5, z0: 1.6, z1: 7.2 } as const;
/** Yard steps and loading dock on the +x edge. */
const STEPS = { z0: 1.0, z1: 3.8 } as const;
const DOCK = { z0: 4.05, z1: 7.1 } as const;

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
// Sealed epoxy: low roughness so the oven glow and the key light leave a
// soft sheen on it, with the environment kept low so it stays charcoal.
const FLOOR = dimmed(matte(PALETTE.slabTop, 0.38), 0.5);
const PAINT_WHITE = dimmed(matte(PALETTE.hazardLight, 0.6), 0.3);
const PAINT_AMBER = dimmed(matte(PALETTE.amber, 0.6), 0.45);
const PAINT_BLUE = dimmed(matte(PALETTE.blue, 0.6), 0.45);
const TILE = dimmed(matte(PALETTE.floorWhite, 0.45), 0.35);
const TILE_LINE = dimmed(matte(PALETTE.steel, 0.6), 0.35);

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

const BAND = { near: 0.25, far: 0.75 } as const; // distance in from the slab edge

function buildPaint() {
  const white = new Paint();
  const amber = new Paint();
  const hazard = new Paint();
  const xe = SLAB.maxX;
  const ze = SLAB.maxZ;

  // Hazard stripes along the two open edges, broken for the steps and dock.
  const bands = [
    { x0: WALL_FACE_X + 0.1, x1: xe - BAND.far - 0.1, z0: ze - BAND.far, z1: ze - BAND.near, along: 'x' as const },
    { x0: xe - BAND.far, x1: xe - BAND.near, z0: WALL_FACE_Z + 0.1, z1: STEPS.z0 - 0.25, along: 'z' as const },
  ];
  // A 45 degree stripe would look vertical in the isometric view, so the
  // stripes lean less than that and read as slanted on screen.
  for (const b of bands) hazard.stripes(b, b.along, 0.3, 0.3, b.along === 'x' ? 0.4 : -0.4);

  // Walkway down the yard side of the inspection leg, from the electrical
  // cabinet to a zebra at the steps. Packaging stock sits either side of it.
  const C = 0.95; // keep paint this far from the conveyor centreline
  white.line(5.12, -6.4, 5.12, 1.55, 0.06, { clear: C });
  white.line(6.08, -6.4, 6.08, 1.55, 0.06, { clear: C });
  white.arrow(5.6, -5.0, Math.PI / 2, 0.38).arrow(5.6, -1.9, Math.PI / 2, 0.38);
  for (let x = 4.05; x < 7.1; x += 0.5) white.rect({ x0: x, x1: x + 0.27, z0: 1.75, z1: 3.05 });
  amber.line(3.95, 1.6, 7.2, 1.6, 0.06, { clear: C });
  amber.line(3.95, 3.2, 7.2, 3.2, 0.06, { clear: C });
  white.line(xe - 0.14, STEPS.z0, xe - 0.14, STEPS.z1, 0.08);

  // Walkways inside the line's U: one across the floor in front of the
  // oven, one from the hygiene zone's door, and a link between the two.
  const cross = { z0: -2.02, z1: -0.82, x0: -7.7, x1: 1.95 };
  const link = { x0: -3.0, x1: -1.98 };
  const door = { z0: 4.92, z1: 6.08, x0: CLEAN.x1 + 0.1 };
  white.line(cross.x0, cross.z0, cross.x1, cross.z0, 0.06, { clear: C });
  white.line(cross.x0, cross.z1, link.x0, cross.z1, 0.06, { clear: C });
  white.line(link.x1, cross.z1, cross.x1, cross.z1, 0.06, { clear: C });
  white.line(link.x0, cross.z1, link.x0, door.z0, 0.06);
  white.line(link.x1, cross.z1, link.x1, door.z1, 0.06);
  white.line(door.x0, door.z0, link.x0, door.z0, 0.06);
  white.line(door.x0, door.z1, link.x1, door.z1, 0.06);
  white.arrow(-5.6, -1.42, 0, 0.38).arrow(0.9, -1.42, 0, 0.38);
  white.arrow(-2.49, 2.4, -Math.PI / 2, 0.38).arrow(-4.4, 5.5, Math.PI, 0.38);

  // Cooling bay for the rack trolleys, and the goods-in bays by the door.
  const dash = { dash: 0.3, gap: 0.2 };
  const bays = [
    { x0: -1.85, x1: 1.95, z0: -0.62, z1: 1.5 },
    { x0: -6.38, x1: -3.66, z0: 6.14, z1: 7.2 },
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

  // Dock edge.
  amber.line(xe - 0.14, DOCK.z0, xe - 0.14, DOCK.z1, 0.1);

  return { white: white.build(), amber: amber.build(), hazard: hazard.build(), bands };
}

function FloorPaint() {
  const { white, amber, hazard, bands } = useMemo(() => buildPaint(), []);
  const kerb = 0.028;
  return (
    <group>
      <mesh geometry={white} position-y={0.004} material={PAINT_WHITE} receiveShadow />
      <mesh geometry={amber} position-y={0.004} material={PAINT_AMBER} receiveShadow />
      {/* Hazard bands sit on a low dark kerb strip, like a stuck-down mat. */}
      {bands.map((b, i) => (
        <RoundedBox
          key={i}
          args={[b.x1 - b.x0 + 0.08, kerb, b.z1 - b.z0 + 0.08]}
          radius={0.012}
          smoothness={2}
          position={[(b.x0 + b.x1) / 2, kerb / 2, (b.z0 + b.z1) / 2]}
          material={matte(PALETTE.hazardDark, 0.6)}
          receiveShadow
        />
      ))}
      <mesh geometry={hazard} position-y={kerb + 0.002} material={PAINT_WHITE} receiveShadow />
    </group>
  );
}

// ------------------------------------------------------- hygiene zone

function buildTileLines() {
  const lines = new Paint();
  const border = new Paint();
  const w = 0.028;
  for (let x = CLEAN.x0 + 1; x < CLEAN.x1 - 0.2; x += 1) lines.line(x, CLEAN.z0 + 0.05, x, CLEAN.z1 - 0.05, w);
  const rows = 6;
  const pitch = (CLEAN.z1 - CLEAN.z0) / rows;
  for (let i = 1; i < rows; i++) lines.line(CLEAN.x0 + 0.05, CLEAN.z0 + pitch * i, CLEAN.x1 - 0.05, CLEAN.z0 + pitch * i, w);
  // Blue hygiene line just inside the two open sides.
  const m = 0.2;
  border.line(CLEAN.x0 + m, CLEAN.z1 - m, CLEAN.x1 - m + 0.04, CLEAN.z1 - m, 0.08);
  border.line(CLEAN.x1 - m, CLEAN.z0 + m, CLEAN.x1 - m, CLEAN.z1 - m, 0.08);
  return { lines: lines.build(), border: border.build() };
}

/** A run of framed glass panels between two floor points. */
function GlassRun({ from, to, height = 2.4, open = false }: { from: [number, number]; to: [number, number]; height?: number; open?: boolean }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const panes = Math.max(1, Math.round(len / 1.7));
  const frame = metal(PALETTE.steelDark, 0.35);
  const posts = Array.from({ length: panes + 1 }, (_, i) => -len / 2 + (len * i) / panes);
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation-y={-Math.atan2(dz, dx)}>
      <RoundedBox args={[len + 0.07, 0.07, 0.08]} radius={0.02} smoothness={2} position-y={height} material={frame} castShadow />
      {!open && (
        <mesh position-y={height / 2 + 0.05} material={glass()}>
          <boxGeometry args={[len - 0.06, height - 0.14, 0.03]} />
        </mesh>
      )}
      {!open && <RoundedBox args={[len, 0.1, 0.09]} radius={0.02} smoothness={2} position-y={0.05} material={frame} castShadow receiveShadow />}
      {(open ? [] : posts).map((x, i) => (
        <RoundedBox key={i} args={[0.07, height, 0.08]} radius={0.02} smoothness={2} position={[x, height / 2, 0]} material={frame} castShadow />
      ))}
    </group>
  );
}

function HygieneZone({ partition }: { partition: boolean }) {
  const { lines, border } = useMemo(() => buildTileLines(), []);
  const w = CLEAN.x1 - CLEAN.x0;
  const d = CLEAN.z1 - CLEAN.z0;
  const t = 0.03;
  return (
    <group>
      <mesh
        rotation={FLAT}
        position={[(CLEAN.x0 + CLEAN.x1) / 2, 0, (CLEAN.z0 + CLEAN.z1) / 2]}
        geometry={slabGeometry(w, d, t, 0.1, 0.01)}
        material={TILE}
        receiveShadow
      />
      <mesh geometry={lines} position-y={t + 0.002} material={TILE_LINE} receiveShadow />
      <mesh geometry={border} position-y={t + 0.003} material={PAINT_BLUE} receiveShadow />
      {partition && (
        <>
          {/* Back side, with a gap where the conveyor leaves the zone. */}
          <GlassRun from={[CLEAN.x0 + 0.05, CLEAN.z0]} to={[-9.95, CLEAN.z0]} />
          <GlassRun from={[-9.95, CLEAN.z0]} to={[-8.05, CLEAN.z0]} open />
          <GlassRun from={[-8.05, CLEAN.z0]} to={[CLEAN.x1, CLEAN.z0]} />
          {/* Room side, with a doorway onto the pedestrian lane. */}
          <GlassRun from={[CLEAN.x1, CLEAN.z0]} to={[CLEAN.x1, 4.85]} />
          <GlassRun from={[CLEAN.x1, 4.85]} to={[CLEAN.x1, 6.25]} open />
          <GlassRun from={[CLEAN.x1, 6.25]} to={[CLEAN.x1, CLEAN.z1]} />
        </>
      )}
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

      {/* Services on the -z wall: pipe runs, a cable tray, vents, a cabinet. */}
      <group position={[0, 0, WALL_FACE_Z]}>
        <Rod a={[-2.3, pipeY, 0.16]} b={[6.75, pipeY, 0.16]} r={0.07} material={plastic(PALETTE.orange, 0.3)} />
        <Rod a={[-2.3, pipeY, 0.16]} b={[-2.3, 0.3, 0.16]} r={0.07} material={plastic(PALETTE.orange, 0.3)} />
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
          <RoundedBox args={[0.05, 0.3, 0.05]} radius={0.02} smoothness={2} position={[0.36, 1.75, 0.41]} material={plastic(PALETTE.orange)} />
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
  /** White tiled hygiene zone around the mixer. */
  hygieneZone?: boolean;
  /** Glass partition around the hygiene zone. */
  partition?: boolean;
  /** The brand sign on the -z wall. */
  sign?: boolean;
}

export function Diorama({ hygieneZone = true, partition = true, sign = true }: DioramaProps) {
  useStudioDimming();
  return (
    <group>
      <Slab />
      <FloorPaint />
      {hygieneZone && <HygieneZone partition={partition} />}
      <YardSteps />
      <LoadingDock />
      <Walls />
      {sign && <BrandSign position={[-4.6, 5.6, WALL_FACE_Z]} />}
    </group>
  );
}
