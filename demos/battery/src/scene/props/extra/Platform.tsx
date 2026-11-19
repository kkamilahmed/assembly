// The supervisor's platform: a raised steel deck with guard rails, a stair
// down to the floor and a standing desk with a monitor. It gives the floor
// a second level and somewhere to oversee the line from.
//
// Origin at the centre of the deck's footprint on the ground. The stair
// leaves the +z edge at its +x end and descends toward +z. Children are
// placed on the deck: their y=0 is the deck surface.
import type { ReactNode } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { mergedBoxes, rbox, type BoxSpec } from '@/scene/props/kit';
import { Part } from '@/scene/props/Part';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const RAIL_H = 1.05;
const STAIR = { width: 0.95, run: 0.3, risers: 5 } as const;

interface Dims {
  l: number;
  d: number;
  h: number;
}

function frameGeometry({ l, d, h }: Dims) {
  return mergedBoxes(`platformFrame:${l}:${d}:${h}`, () => {
    const out: BoxSpec[] = [];
    const lx = l / 2 - 0.09;
    const lz = d / 2 - 0.09;
    const beamY = h - 0.1 - 0.07;
    for (const x of [-lx, lx]) for (const z of [-lz, lz]) {
      out.push({ size: [0.11, h - 0.1, 0.11], pos: [x, (h - 0.1) / 2, z], r: 0.025 });
      out.push({ size: [0.2, 0.025, 0.2], pos: [x, 0.0125, z], r: 0.008 });
    }
    for (const z of [-lz, lz]) out.push({ size: [l - 0.1, 0.14, 0.07], pos: [0, beamY, z], r: 0.02 });
    for (const x of [-lx, 0, lx]) out.push({ size: [0.07, 0.14, d - 0.1], pos: [x, beamY, 0], r: 0.02 });
    // Knee braces under the long beams.
    for (const x of [-lx, lx]) for (const z of [-lz, lz]) {
      const s = Math.sign(-x);
      out.push({ size: [0.5, 0.05, 0.05], pos: [x + s * 0.2, beamY - 0.2, z], rot: [0, 0, -s * (Math.PI / 4)], r: 0.015 });
    }
    return out;
  });
}

/** Guard rails round the deck and down the stair, as one mesh. */
function railGeometry({ l, d, h }: Dims) {
  return mergedBoxes(`platformRails:${l}:${d}:${h}`, () => {
    const out: BoxSpec[] = [];
    const t = 0.045;
    const ex = l / 2 - 0.05;
    const ez = d / 2 - 0.05;
    const stairX0 = l / 2 - STAIR.width;
    const post = (x: number, z: number) => out.push({ size: [t, RAIL_H, t], pos: [x, h + RAIL_H / 2, z], r: 0.016 });
    const railX = (x0: number, x1: number, z: number) => {
      for (const y of [RAIL_H, RAIL_H * 0.52]) out.push({ size: [x1 - x0 + t, t, t], pos: [(x0 + x1) / 2, h + y - t / 2, z], r: 0.016 });
    };
    const railZ = (z0: number, z1: number, x: number) => {
      for (const y of [RAIL_H, RAIL_H * 0.52]) out.push({ size: [t, t, z1 - z0 + t], pos: [x, h + y - t / 2, (z0 + z1) / 2], r: 0.016 });
    };
    // Back, left and right sides, then the front up to the stair opening.
    railX(-ex, ex, -ez);
    railZ(-ez, ez, -ex);
    railZ(-ez, ez, ex);
    railX(-ex, stairX0, ez);
    for (const x of [-ex, 0, ex]) post(x, -ez);
    for (const x of [-ex, ex]) post(x, 0);
    post(-ex, ez);
    post(ex, ez);
    post(stairX0, ez);
    if (stairX0 - -ex > 1.4) post((stairX0 - ex) / 2, ez);

    // Stair handrails, parallel to the flight.
    const len = STAIR.run * STAIR.risers;
    const slope = Math.atan2(h, len);
    const z0 = d / 2;
    const zEnd = z0 + len - 0.12;
    const drop = (zEnd - ez) * (h / len);
    const railLen = Math.hypot(zEnd - ez, drop);
    for (const x of [stairX0, ex]) {
      for (const y of [RAIL_H, RAIL_H * 0.52]) {
        out.push({ size: [t, t, railLen + t], pos: [x, h + y - t / 2 - drop / 2, (ez + zEnd) / 2], rot: [slope, 0, 0], r: 0.016 });
      }
      const footY = h - drop;
      out.push({ size: [t, footY + RAIL_H, t], pos: [x, (footY + RAIL_H) / 2 - 0.0, zEnd], r: 0.016 });
    }
    return out;
  });
}

function stairGeometry({ l, d, h }: Dims) {
  return mergedBoxes(`platformStair:${l}:${d}:${h}`, () => {
    const out: BoxSpec[] = [];
    const rise = h / STAIR.risers;
    const len = STAIR.run * STAIR.risers;
    const slope = Math.atan2(h, len);
    const cx = l / 2 - STAIR.width / 2;
    for (let i = 1; i < STAIR.risers; i++) {
      out.push({ size: [STAIR.width - 0.1, 0.05, STAIR.run + 0.02], pos: [cx, h - i * rise - 0.025, d / 2 + (i - 0.5) * STAIR.run], r: 0.016 });
    }
    // Stringers.
    for (const s of [-1, 1]) {
      out.push({
        size: [0.05, 0.2, Math.hypot(len, h) + 0.04],
        pos: [cx + s * (STAIR.width / 2 - 0.045), h / 2 - 0.09, d / 2 + len / 2],
        rot: [slope, 0, 0],
        r: 0.018,
      });
    }
    return out;
  });
}

function toeGeometry({ l, d, h }: Dims) {
  return mergedBoxes(`platformToe:${l}:${d}:${h}`, () => {
    const out: BoxSpec[] = [];
    const ex = l / 2 - 0.012;
    const ez = d / 2 - 0.012;
    const stairX0 = l / 2 - STAIR.width;
    const y = h + 0.02;
    out.push({ size: [l, 0.13, 0.024], pos: [0, y, -ez], r: 0.008 });
    out.push({ size: [stairX0 + l / 2, 0.13, 0.024], pos: [(stairX0 - l / 2) / 2, y, ez], r: 0.008 });
    for (const x of [-ex, ex]) out.push({ size: [0.024, 0.13, d], pos: [x, y, 0], r: 0.008 });
    // Yellow nosings on the stair treads.
    const rise = h / STAIR.risers;
    for (let i = 1; i < STAIR.risers; i++) {
      out.push({ size: [STAIR.width - 0.1, 0.054, 0.045], pos: [l / 2 - STAIR.width / 2, h - i * rise - 0.025, d / 2 + i * STAIR.run - 0.01], r: 0.014 });
    }
    return out;
  }, 1);
}

/** Standing desk with a monitor showing a small chart. The user stands on
 *  the +x side; the screen faces +x. */
function StandingDesk(props: GroupProps) {
  const steel = metal(PALETTE.steel, 0.3);
  const dark = plastic(PALETTE.graphite, 0.35);
  const bars: Array<[number, number, string]> = [
    [-0.18, 0.1, PALETTE.blue],
    [-0.09, 0.16, PALETTE.blue],
    [0, 0.12, PALETTE.blue],
    [0.09, 0.2, PALETTE.orangeGlow],
    [0.18, 0.15, PALETTE.blue],
  ];
  return (
    <group {...props}>
      <Part g={rbox(0.56, 0.045, 1.15, 0.018, 2)} m={plastic(PALETTE.offWhite, 0.4)} position-y={1.04} />
      {[-0.45, 0.45].map((z) => (
        <group key={z} position-z={z}>
          <Part g={rbox(0.07, 1.0, 0.07, 0.02, 2)} m={steel} position-y={0.52} />
          <Part g={rbox(0.5, 0.035, 0.08, 0.014, 2)} m={steel} position-y={0.02} />
        </group>
      ))}
      {/* Monitor on a stalk. */}
      <Part g={rbox(0.05, 0.3, 0.06, 0.016, 2)} m={dark} position={[-0.18, 1.2, 0]} />
      <Part g={rbox(0.2, 0.02, 0.26, 0.008, 2)} m={dark} position={[-0.16, 1.072, 0]} />
      <group position={[-0.14, 1.46, 0]}>
        <Part g={rbox(0.04, 0.42, 0.7, 0.016, 3)} m={dark} />
        <mesh geometry={rbox(0.006, 0.36, 0.64, 0.002, 1)} material={matte(PALETTE.hazardDark, 0.3)} position-x={0.02} />
        {bars.map(([z, hgt, c]) => (
          <mesh key={z} geometry={rbox(0.006, hgt, 0.055, 0.002, 1)} material={glow(c, 1.3)} position={[0.024, -0.13 + hgt / 2, -z]} />
        ))}
        <mesh geometry={rbox(0.006, 0.022, 0.3, 0.002, 1)} material={glow(PALETTE.healthy, 1.2)} position={[0.024, 0.13, 0.14]} />
      </group>
      {/* Keyboard and a mug. */}
      <Part g={rbox(0.14, 0.02, 0.4, 0.008, 2)} m={dark} position={[0.1, 1.073, 0.05]} />
      <Part g={rbox(0.08, 0.09, 0.08, 0.03, 3)} m={plastic(PALETTE.orange, 0.35)} position={[0.08, 1.108, -0.38]} />
    </group>
  );
}

export interface SupervisorPlatformProps extends GroupProps {
  /** Deck length on x and depth on z. */
  size?: [number, number];
  /** Deck surface height. */
  height?: number;
  children?: ReactNode;
}

export function SupervisorPlatform({ size = [2.8, 2.1], height = 1.1, children, ...props }: SupervisorPlatformProps) {
  const dims: Dims = { l: size[0], d: size[1], h: height };
  const { l, d, h } = dims;
  return (
    <group {...props}>
      <Part g={frameGeometry(dims)} m={metal(PALETTE.steelDark, 0.4)} />
      <Part g={rbox(l, 0.1, d, 0.03, 3)} m={plastic(PALETTE.graphite, 0.5)} position-y={h - 0.05} />
      <Part g={stairGeometry(dims)} m={metal(PALETTE.steelDark, 0.45)} />
      <Part g={railGeometry(dims)} m={metal(PALETTE.steel, 0.3)} />
      <Part g={toeGeometry(dims)} m={plastic(PALETTE.amber, 0.45)} />
      <group position-y={h}>
        <StandingDesk position={[-l / 2 + 0.45, 0, -0.25]} />
        {children}
      </group>
    </group>
  );
}
