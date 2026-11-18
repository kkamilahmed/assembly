// Main St ATM: a freestanding cash machine pod under a blue canopy. Its
// lane starts right behind the pod.
import { RoundedBox } from '@react-three/drei';
import { Person } from '@/scene/props';
import { ATM } from '../layout';
import { glow, metal, PALETTE, plastic } from '../style';
import { screenMaterial } from './kit';
import { Sign } from './Sign';

function drawAtmMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-0.42 * s, -0.28 * s, 0.84 * s, 0.56 * s, 0.08 * s);
  ctx.fill();
  ctx.fillStyle = PALETTE.blue;
  ctx.font = `800 ${0.4 * s}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 0.02 * s);
  ctx.restore();
}

/** The pod, centred on the origin, its screen facing +z. */
export function AtmPod() {
  const body = plastic('#e9edf2', 0.35);
  const blue = plastic(PALETTE.blue, 0.38);
  return (
    <group>
      <RoundedBox args={[1.3, 0.08, 1.0]} radius={0.03} smoothness={2} position={[0, 0.04, 0.05]} material={plastic(PALETTE.paving, 0.5)} receiveShadow />
      <RoundedBox args={[1.0, 2.0, 0.7]} radius={0.08} smoothness={3} position={[0, 1.04, 0]} material={body} castShadow receiveShadow />
      <RoundedBox args={[0.84, 0.9, 0.08]} radius={0.04} smoothness={2} position={[0, 1.25, 0.36]} material={plastic(PALETTE.tdzInk, 0.35)} castShadow />
      <mesh position={[0, 1.42, 0.405]} material={screenMaterial('atm')}>
        <planeGeometry args={[0.56, 0.36]} />
      </mesh>
      {/* Keypad shelf and card slot. */}
      <RoundedBox args={[0.6, 0.06, 0.26]} radius={0.02} smoothness={2} position={[0, 1.0, 0.48]} rotation-x={0.3} material={metal(PALETTE.steel, 0.3)} castShadow />
      <mesh position={[0.28, 1.14, 0.42]} material={glow(PALETTE.healthy, 1.2)}>
        <boxGeometry args={[0.14, 0.02, 0.01]} />
      </mesh>
      {/* Canopy. */}
      <RoundedBox args={[1.5, 0.12, 1.4]} radius={0.05} smoothness={3} position={[0, 2.38, 0.25]} material={blue} castShadow receiveShadow />
      <mesh position={[0, 2.31, 0.25]} material={glow('#e9f2ff', 0.9)}>
        <boxGeometry args={[1.2, 0.01, 1.0]} />
      </mesh>
      {[-0.66, 0.66].map((x) => (
        <RoundedBox key={x} args={[0.07, 2.32, 0.07]} radius={0.025} smoothness={2} position={[x, 1.16, -0.32]} material={metal(PALETTE.steelDark, 0.35)} castShadow />
      ))}
      <Sign position={[0, 2.7, 0.2]} width={1.3} height={0.46} text="ATM" sub="Main St" color={PALETTE.blue} mark={drawAtmMark} />
    </group>
  );
}

export function Atm({ people = true }: { people?: boolean }) {
  return (
    <group>
      <group position={[ATM.x, 0, ATM.z]}>
        <AtmPod />
      </group>
      {people && <Person position={[ATM.x, 0, ATM.z + 0.95]} rotation-y={Math.PI / 2} pose="inspect" outfit="casual" seed={41} skin={2} />}
    </group>
  );
}
