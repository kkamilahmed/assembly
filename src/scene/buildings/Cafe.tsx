// Harbor Cafe: a counter with the card terminal customers tap their phones
// on, a striped awning, and two tables of regulars.
import { RoundedBox } from '@react-three/drei';
import { CafeTable, CoffeeCounter, StoolChair } from '@/scene/props/extra';
import { Person } from '@/scene/props';
import { CAFE, SOURCE_WALL } from '../layout';
import { PALETTE, plastic } from '../style';
import { LaneOrigin } from './LaneOrigin';
import { Shell } from './Shell';
import { Sign } from './Sign';

const PORT = -9.4;
const WALL = '#efe9df';

function drawCup(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-0.32 * s, -0.22 * s);
  ctx.lineTo(0.26 * s, -0.22 * s);
  ctx.lineTo(0.2 * s, 0.32 * s);
  ctx.lineTo(-0.26 * s, 0.32 * s);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 0.08 * s;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0.3 * s, 0.02 * s, 0.12 * s, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.restore();
}

/** Striped awning along the back wall, leaning out over the counter. */
function Awning() {
  const n = 9;
  const x0 = CAFE.x0 + 0.25;
  const w = (CAFE.x1 - 0.25 - x0) / n;
  return (
    <group position={[0, SOURCE_WALL - 0.1, CAFE.z0 + 0.45]} rotation-x={0.38}>
      {Array.from({ length: n }, (_, i) => (
        <RoundedBox
          key={i}
          args={[w + 0.002, 0.04, 0.72]}
          radius={0.015}
          smoothness={2}
          position={[x0 + w * (i + 0.5), 0, 0]}
          material={plastic(i % 2 ? '#f4f5f7' : PALETTE.cafeGreen, 0.5)}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

export function Cafe({ people = true }: { people?: boolean }) {
  return (
    <group>
      <Shell {...CAFE} height={SOURCE_WALL} wall={WALL} ports={[PORT]} left="none" front="low" door={[-9.2, -8.0]} />
      <Awning />
      <Sign position={[-8.15, 1.32, CAFE.z0 + 0.18]} width={1.9} height={0.56} text="Harbor Cafe" color={PALETTE.cafeGreen} mark={drawCup} />
      <CoffeeCounter position={[-10.52, 0, 5.35]} />
      <LaneOrigin x={PORT} z={4.1} />
      <CafeTable position={[-8.15, 0, 5.15]} cups={2} />
      <StoolChair position={[-8.77, 0, 5.15]} />
      <StoolChair position={[-7.53, 0, 5.15]} rotation-y={Math.PI} />
      <CafeTable position={[-8.45, 0, 6.6]} />
      <StoolChair position={[-7.83, 0, 6.6]} rotation-y={Math.PI} />
      <StoolChair position={[-9.07, 0, 6.6]} />
      {people && (
        <>
          <Person position={[-11.22, 0, 5.0]} pose="inspect" outfit="barista" seed={3} skin={1} />
          <Person position={[-9.72, 0, 5.4]} rotation-y={Math.PI} pose="tablet" carrying="phone" outfit="casual" seed={14} skin={0} />
          <Person position={[-8.77, 0, 5.15]} pose="sitSip" outfit="casual" seed={22} skin={2} />
          <Person position={[-7.83, 0, 6.6]} rotation-y={Math.PI} pose="sitSip" outfit="casual" seed={9} skin={3} />
        </>
      )}
    </group>
  );
}
