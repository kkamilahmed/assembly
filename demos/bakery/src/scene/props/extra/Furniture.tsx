// Stainless furniture for the bakery floor: work tables, a utility cart, a
// handwash station and the weighing scales. Origins are at the footprint
// centre on the ground.
import type { ThreeElements } from '@react-three/fiber';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { cyl, mergedBoxes, rbox, studioWhite, torus, type BoxSpec } from '@/scene/props/kit';
import { Part } from '@/scene/props/Part';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const HALF = Math.PI / 2;
const WHITE = studioWhite(PALETTE.white, 0.68);
const steel = () => metal(PALETTE.steel, 0.3);

// ----------------------------------------------------------- work table

function tableGeometry(l: number, d: number, h: number, shelf: boolean, upstand: boolean) {
  return mergedBoxes(`table:${l}:${d}:${h}:${shelf}:${upstand}`, () => {
    const out: BoxSpec[] = [{ size: [l, 0.06, d], pos: [0, h - 0.03, 0], r: 0.02 }];
    const lx = l / 2 - 0.07;
    const lz = d / 2 - 0.07;
    for (const x of [-lx, lx]) for (const z of [-lz, lz]) out.push({ size: [0.055, h - 0.06, 0.055], pos: [x, (h - 0.06) / 2, z], r: 0.018 });
    // Apron rails under the top.
    for (const z of [-lz, lz]) out.push({ size: [l - 0.14, 0.07, 0.03], pos: [0, h - 0.1, z], r: 0.01 });
    if (shelf) out.push({ size: [l - 0.1, 0.035, d - 0.1], pos: [0, 0.24, 0], r: 0.012 });
    if (upstand) out.push({ size: [l, 0.14, 0.03], pos: [0, h + 0.06, -d / 2 + 0.015], r: 0.01 });
    return out;
  });
}

export interface WorkTableProps extends GroupProps {
  /** Length on x, depth on z, height of the top. */
  size?: [number, number, number];
  shelf?: boolean;
  /** Low splash upstand along the -z edge. */
  upstand?: boolean;
  /** On castors, as a cart. */
  castors?: boolean;
}

/** Stainless prep table with an undershelf. */
export function WorkTable({ size = [1.8, 0.75, 0.9], shelf = true, upstand = false, castors = false, ...props }: WorkTableProps) {
  const [l, d, h] = size;
  const lift = castors ? 0.1 : 0;
  return (
    <group {...props}>
      <Part g={tableGeometry(l, d, h - lift, shelf, upstand)} m={steel()} position-y={lift} />
      {castors &&
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <Part
              key={`${sx}${sz}`}
              g={cyl(0.05, 0.05, 0.036, 16)}
              m={matte(PALETTE.rubber, 0.7)}
              position={[sx * (l / 2 - 0.07), 0.05, sz * (d / 2 - 0.07)]}
              rotation-x={HALF}
            />
          )),
        )}
      {castors && <Part g={rbox(0.03, 0.03, d - 0.1, 0.012, 2)} m={steel()} position={[-l / 2 - 0.07, h - 0.02, 0]} />}
    </group>
  );
}

// ------------------------------------------------------- handwash sink

/** Knee-operated handwash station with a splashback, soap and towels.
 *  0.55 deep, 0.9 wide; the user stands on the +x side. */
export function HandwashStation(props: GroupProps) {
  const blue = plastic(PALETTE.blue, 0.36);
  return (
    <group {...props}>
      <Part g={rbox(0.5, 0.84, 0.9, 0.035, 3)} m={steel()} position={[0, 0.42, 0]} />
      <Part g={rbox(0.56, 0.05, 0.94, 0.02, 2)} m={steel()} position={[0.01, 0.865, 0]} />
      {/* Basin: a dark recess in the top. */}
      <Part g={rbox(0.34, 0.012, 0.52, 0.005, 1)} m={matte(PALETTE.graphite, 0.5)} position={[0.04, 0.893, -0.08]} castShadow={false} />
      {/* Splashback. */}
      <Part g={rbox(0.045, 0.72, 0.94, 0.018, 2)} m={steel()} position={[-0.25, 1.24, 0]} />
      {/* Gooseneck tap. */}
      <group position={[-0.16, 0.89, -0.08]}>
        <Part g={cyl(0.018, 0.022, 0.2, 12)} m={metal(PALETTE.steelDark, 0.2)} position-y={0.1} />
        <Part g={torus(0.07, 0.017, 16, Math.PI)} m={metal(PALETTE.steelDark, 0.2)} position={[0.07, 0.2, 0]} />
        <Part g={cyl(0.017, 0.017, 0.05, 12)} m={metal(PALETTE.steelDark, 0.2)} position={[0.14, 0.18, 0]} />
      </group>
      {/* Knee paddle, soap, sanitiser and a towel dispenser. */}
      <Part g={rbox(0.03, 0.22, 0.3, 0.012, 2)} m={blue} position={[0.262, 0.5, -0.08]} />
      <Part g={rbox(0.09, 0.2, 0.11, 0.03, 3)} m={blue} position={[-0.19, 1.2, 0.3]} />
      <Part g={rbox(0.09, 0.2, 0.11, 0.03, 3)} m={plastic(PALETTE.orange, 0.36)} position={[-0.19, 1.2, 0.14]} />
      <Part g={rbox(0.12, 0.26, 0.3, 0.035, 3)} m={plastic(WHITE, 0.4)} position={[-0.18, 1.36, -0.2]} />
      {/* "Wash your hands" sign above. */}
      <Part g={rbox(0.03, 0.2, 0.5, 0.012, 2)} m={blue} position={[-0.25, 1.72, 0]} />
      <Part g={cyl(0.055, 0.055, 0.012, 20)} m={plastic(WHITE, 0.5)} position={[-0.232, 1.72, 0]} rotation-z={HALF} castShadow={false} />
    </group>
  );
}

// ---------------------------------------------------------------- scales

/** Readout head: a small tilted screen with a glowing display, facing +x. */
function Readout(props: GroupProps) {
  return (
    <group {...props} rotation-z={-0.35}>
      <Part g={rbox(0.07, 0.15, 0.24, 0.025, 3)} m={plastic(PALETTE.graphite, 0.4)} />
      <mesh geometry={rbox(0.01, 0.075, 0.17, 0.004, 1)} material={glow(PALETTE.healthy, 1.4)} position={[0.036, 0.015, 0]} />
    </group>
  );
}

/** Bench scale for a table top: 0.36 square pan with a readout behind (-x). */
export function BenchScale(props: GroupProps) {
  return (
    <group {...props}>
      <Part g={rbox(0.36, 0.06, 0.36, 0.022, 3)} m={plastic(PALETTE.graphite, 0.45)} position-y={0.03} />
      <Part g={rbox(0.34, 0.02, 0.34, 0.008, 2)} m={steel()} position-y={0.072} />
      <Part g={cyl(0.016, 0.016, 0.3, 10)} m={steel()} position={[-0.2, 0.17, 0]} />
      <Readout position={[-0.19, 0.34, 0]} />
    </group>
  );
}

/** Low platform floor scale, 1.0 square, with its readout on a column at
 *  the -x edge. */
export function FloorScale(props: GroupProps) {
  const amber = plastic(PALETTE.amber, 0.45);
  return (
    <group {...props}>
      <Part g={rbox(1.0, 0.07, 1.0, 0.025, 3)} m={plastic(PALETTE.graphite, 0.5)} position-y={0.035} />
      <Part g={rbox(0.9, 0.02, 0.9, 0.008, 2)} m={metal(PALETTE.steel, 0.4)} position-y={0.078} />
      {/* Ramp lips front and back, painted safety yellow. */}
      <Part g={rbox(1.0, 0.03, 0.09, 0.012, 2)} m={amber} position={[0, 0.03, 0.53]} rotation-x={0.35} />
      <Part g={rbox(1.0, 0.03, 0.09, 0.012, 2)} m={amber} position={[0, 0.03, -0.53]} rotation-x={-0.35} />
      <Part g={rbox(0.14, 0.03, 0.2, 0.012, 2)} m={plastic(PALETTE.graphite, 0.5)} position={[-0.6, 0.015, 0]} />
      <Part g={cyl(0.026, 0.026, 1.1, 12)} m={steel()} position={[-0.6, 0.55, 0]} />
      <Readout position={[-0.585, 1.14, 0]} />
    </group>
  );
}
