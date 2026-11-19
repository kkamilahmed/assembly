import type { ThreeElements } from '@react-three/fiber';
import { metal, PALETTE, plastic } from '../style';
import { Kit } from './kit';
import type { Piece, ScreenKind } from './kit';
import { Pieces, Screen } from './Pieces';

const DEPTH = 0.16;
const cache = new Map<string, Piece[]>();

function build(w: number, h: number, accent: string): Piece[] {
  const key = `${w}:${h}:${accent}`;
  let pieces = cache.get(key);
  if (!pieces) {
    const k = new Kit();
    const white = plastic(PALETTE.white);
    const dark = plastic(PALETTE.graphite);
    const zf = DEPTH / 2;
    k.box(white, [w, h, DEPTH], [0, 0, 0], 0.04);
    k.box(plastic(accent), [w + 0.008, 0.05, DEPTH + 0.008], [0, h / 2 - 0.065, 0], 0.02);
    k.box(dark, [w - 0.08, h * 0.5, 0.02], [0, h * 0.07, zf + 0.004], 0.015);
    // Button row and a mushroom e-stop.
    const by = -h / 2 + 0.09;
    [PALETTE.healthy, PALETTE.amber, PALETTE.blue].forEach((c, i) => {
      k.cyl(metal(PALETTE.steel), 0.028, 0.012, [-w / 2 + 0.08 + i * 0.075, by, zf + 0.004], 'z', 0.004, 0.028, 12);
      k.cyl(plastic(c), 0.02, 0.03, [-w / 2 + 0.08 + i * 0.075, by, zf + 0.012], 'z', 0.007, 0.02, 12);
    });
    k.cyl(plastic(PALETTE.amber), 0.042, 0.016, [w / 2 - 0.085, by, zf + 0.006], 'z', 0.005, 0.042, 14);
    k.cyl(plastic(PALETTE.critical), 0.03, 0.045, [w / 2 - 0.085, by, zf + 0.03], 'z', 0.012, 0.03, 14);
    // Cable gland underneath.
    k.cyl(dark, 0.03, 0.05, [0, -h / 2 - 0.02, -0.02], 'y', 0.008, 0.03, 12);
    pieces = k.build();
    cache.set(key, pieces);
  }
  return pieces;
}

/**
 * Operator panel: a white box with a screen, three buttons and an e-stop.
 * Origin at the centre of the box; the screen faces local +z.
 */
export function ControlBox({
  kind = 'hmi',
  width = 0.5,
  height = 0.56,
  accent = PALETTE.brand,
  ...props
}: { kind?: ScreenKind; width?: number; height?: number; accent?: string } & ThreeElements['group']) {
  return (
    <group {...props}>
      <Pieces pieces={build(width, height, accent)} />
      <Screen kind={kind} size={[width - 0.13, height * 0.5 - 0.05]} position={[0, height * 0.07, DEPTH / 2 + 0.0155]} />
    </group>
  );
}
