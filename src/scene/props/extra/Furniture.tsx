// Stainless work furniture: the warehouse's packing table. Origin at the
// footprint centre on the ground.
import type { ThreeElements } from '@react-three/fiber';
import { matte, metal, PALETTE } from '@/scene/style';
import { cyl, mergedBoxes, rbox, type BoxSpec } from '@/scene/props/kit';
import { Part } from '@/scene/props/Part';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const HALF = Math.PI / 2;
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
