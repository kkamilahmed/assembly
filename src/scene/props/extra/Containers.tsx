// Street bins. Origins are at the footprint centre on the ground.
import type { ThreeElements } from '@react-three/fiber';
import { matte, PALETTE, plastic } from '@/scene/style';
import { cyl, rbox } from '@/scene/props/kit';
import { Part } from '@/scene/props/Part';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const HALF = Math.PI / 2;

// ------------------------------------------------------------ waste bin

/** Wheelie bin, 0.5 x 0.56 and 0.95 tall, dark body with a coloured lid. */
export function WasteBin({ lid = 'orange', ...props }: GroupProps & { lid?: 'blue' | 'orange' | 'green' }) {
  const lidColor = lid === 'blue' ? PALETTE.blue : lid === 'green' ? PALETTE.healthy : PALETTE.orange;
  const body = plastic(PALETTE.graphite, 0.5);
  return (
    <group {...props}>
      <Part g={rbox(0.46, 0.8, 0.5, 0.06, 3)} m={body} position-y={0.47} />
      <Part g={rbox(0.5, 0.05, 0.54, 0.02, 2)} m={body} position-y={0.84} />
      <group position={[0, 0.89, 0]} rotation-z={-0.05}>
        <Part g={rbox(0.54, 0.06, 0.56, 0.028, 3)} m={plastic(lidColor, 0.4)} />
        <Part g={rbox(0.05, 0.03, 0.34, 0.012, 2)} m={plastic(lidColor, 0.4)} position={[0.25, 0.03, 0]} />
      </group>
      {/* Axle wheels at the back and the tow handle above them. */}
      {[1, -1].map((s) => (
        <Part key={s} g={cyl(0.085, 0.085, 0.05, 18)} m={matte(PALETTE.rubber, 0.7)} position={[-0.2, 0.085, s * 0.24]} rotation-x={HALF} />
      ))}
      <Part g={rbox(0.04, 0.04, 0.42, 0.018, 2)} m={body} position={[-0.27, 0.86, 0]} />
    </group>
  );
}
