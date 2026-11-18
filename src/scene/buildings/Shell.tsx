// The cutaway every building on the block is built from: a light floor, one
// tall back wall (on the -z side, toward the avenue) with a lit port where
// each payment lane leaves, and low glass walls on the other sides so
// nothing hides what goes on inside.
import type { ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import { glass, glow, matte, metal, PALETTE, plastic } from '../style';
import { RAIL_WIDTH } from '../layout';

/** Height of a port opening, enough for a packet to glide through. */
const PORT_H = 0.62;
const PORT_W = RAIL_WIDTH + 0.22;
const T = 0.18;

export type SideWall = 'glass' | 'low' | 'none';

export interface ShellProps {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Back wall height. */
  height: number;
  wall: string;
  floor?: string;
  /** World x of each lane leaving through the back wall. */
  ports?: number[];
  left?: SideWall;
  right?: SideWall;
  front?: SideWall;
  /** World x range of the street door in the front wall. */
  door?: [number, number];
  children?: ReactNode;
}

/** A wall segment along x at depth z, from xa to xb, with its base at y0. */
function XWall({ xa, xb, z, h, y0 = 0, color }: { xa: number; xb: number; z: number; h: number; y0?: number; color: string }) {
  if (xb - xa < 0.02) return null;
  return (
    <RoundedBox
      args={[xb - xa, h, T]}
      radius={0.04}
      smoothness={2}
      position={[(xa + xb) / 2, y0 + h / 2, z]}
      material={plastic(color, 0.32)}
      castShadow
      receiveShadow
    />
  );
}

/** A low glass run between two floor points: a solid sill, a glass pane
 *  and a top rail. Leaves a gap for each `gaps` range along its length. */
function GlassRun({ a, b, gaps = [] }: { a: [number, number]; b: [number, number]; gaps?: Array<[number, number]> }) {
  const along = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? 'x' : 'z';
  const lo = along === 'x' ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
  const hi = along === 'x' ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
  const fixed = along === 'x' ? a[1] : a[0];
  const spans: Array<[number, number]> = [];
  let cursor = lo;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > cursor) spans.push([cursor, g0]);
    cursor = Math.max(cursor, g1);
  }
  if (hi > cursor) spans.push([cursor, hi]);
  const sill = plastic(PALETTE.wallTrim, 0.35);
  const rail = metal(PALETTE.steelDark, 0.35);
  return (
    <group>
      {spans.map(([s0, s1]) => {
        const len = s1 - s0;
        const mid = (s0 + s1) / 2;
        const pos = (y: number): [number, number, number] => (along === 'x' ? [mid, y, fixed] : [fixed, y, mid]);
        const size = (h: number, d: number): [number, number, number] => (along === 'x' ? [len, h, d] : [d, h, len]);
        return (
          <group key={s0}>
            <RoundedBox args={size(0.32, 0.12)} radius={0.03} smoothness={2} position={pos(0.16)} material={sill} castShadow receiveShadow />
            <mesh position={pos(0.72)} material={glass()}>
              <boxGeometry args={size(0.8, 0.03)} />
            </mesh>
            <RoundedBox args={size(0.05, 0.07)} radius={0.02} smoothness={2} position={pos(1.14)} material={rail} castShadow />
          </group>
        );
      })}
    </group>
  );
}

function LowRun({ a, b, gaps = [] }: { a: [number, number]; b: [number, number]; gaps?: Array<[number, number]> }) {
  const along = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? 'x' : 'z';
  const lo = along === 'x' ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
  const hi = along === 'x' ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
  const fixed = along === 'x' ? a[1] : a[0];
  const spans: Array<[number, number]> = [];
  let cursor = lo;
  for (const [g0, g1] of gaps) {
    if (g0 > cursor) spans.push([cursor, g0]);
    cursor = Math.max(cursor, g1);
  }
  if (hi > cursor) spans.push([cursor, hi]);
  return (
    <group>
      {spans.map(([s0, s1]) => {
        const len = s1 - s0;
        const mid = (s0 + s1) / 2;
        return (
          <RoundedBox
            key={s0}
            args={along === 'x' ? [len, 0.5, 0.16] : [0.16, 0.5, len]}
            radius={0.04}
            smoothness={2}
            position={along === 'x' ? [mid, 0.25, fixed] : [fixed, 0.25, mid]}
            material={plastic(PALETTE.paving, 0.45)}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
}

function Side({ kind, a, b, gaps }: { kind: SideWall; a: [number, number]; b: [number, number]; gaps?: Array<[number, number]> }) {
  if (kind === 'glass') return <GlassRun a={a} b={b} gaps={gaps} />;
  if (kind === 'low') return <LowRun a={a} b={b} gaps={gaps} />;
  return null;
}

export function Shell({
  x0,
  x1,
  z0,
  z1,
  height,
  wall,
  floor = PALETTE.tile,
  ports = [],
  left = 'glass',
  right = 'glass',
  front = 'glass',
  door,
  children,
}: ShellProps) {
  const zw = z0 + T / 2;
  // Back wall: full height between ports, a lintel over each port.
  const cuts = [...ports].sort((a, b) => a - b);
  const pieces: Array<[number, number]> = [];
  let cursor = x0;
  for (const p of cuts) {
    pieces.push([cursor, p - PORT_W / 2]);
    cursor = p + PORT_W / 2;
  }
  pieces.push([cursor, x1]);
  return (
    <group>
      <RoundedBox
        args={[x1 - x0, 0.04, z1 - z0]}
        radius={0.015}
        smoothness={2}
        position={[(x0 + x1) / 2, 0.02, (z0 + z1) / 2]}
        material={matte(floor, 0.45)}
        receiveShadow
      />
      {pieces.map(([a, b]) => (
        <XWall key={a} xa={a} xb={b} z={zw} h={height} color={wall} />
      ))}
      {cuts.map((p) => (
        <group key={p}>
          <XWall xa={p - PORT_W / 2 - 0.01} xb={p + PORT_W / 2 + 0.01} z={zw} h={height - PORT_H} y0={PORT_H} color={wall} />
          {/* The port's lit frame: where this source's payments leave. */}
          <mesh position={[p, PORT_H - 0.03, zw + T / 2 + 0.006]} material={glow('#5aa8ff', 1.3)}>
            <boxGeometry args={[PORT_W, 0.04, 0.01]} />
          </mesh>
          <mesh position={[p, PORT_H - 0.03, zw - T / 2 - 0.006]} material={glow('#5aa8ff', 1.3)}>
            <boxGeometry args={[PORT_W, 0.04, 0.01]} />
          </mesh>
        </group>
      ))}
      <Side kind={left} a={[x0 + 0.06, z0 + T]} b={[x0 + 0.06, z1 - 0.06]} />
      <Side kind={right} a={[x1 - 0.06, z0 + T]} b={[x1 - 0.06, z1 - 0.06]} />
      <Side kind={front} a={[x0, z1 - 0.06]} b={[x1, z1 - 0.06]} gaps={door ? [door] : []} />
      {children}
    </group>
  );
}
