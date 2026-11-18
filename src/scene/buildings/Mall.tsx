// Northgate Mall: shelves of brightly packed goods, a checkout with a card
// terminal, and shoppers.
import { CheckoutCounter, ShopShelf } from '@/scene/props/extra';
import { Person, WALK_SPEED } from '@/scene/props';
import { MALL, SOURCE_WALL } from '../layout';
import { Mover } from '../Mover';
import { PALETTE } from '../style';
import { LaneOrigin } from './LaneOrigin';
import { Shell } from './Shell';
import { Sign } from './Sign';

const PORT = -0.8;

function drawBag(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-0.34 * s, -0.16 * s, 0.68 * s, 0.56 * s, 0.08 * s);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.08 * s;
  ctx.beginPath();
  ctx.arc(0, -0.16 * s, 0.17 * s, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

export function Mall({ people = true }: { people?: boolean }) {
  return (
    <group>
      <Shell {...MALL} height={SOURCE_WALL} wall="#dfe6ef" ports={[PORT]} door={[-2.0, -0.7]} />
      <Sign position={[0.35, 1.45, MALL.z0 + 0.18]} width={1.75} height={0.56} text="Northgate" sub="MALL" color={PALETTE.blue} mark={drawBag} />
      <ShopShelf position={[-3.0, 0, 4.0]} rotation-y={-Math.PI / 2} length={2.4} seed={2} />
      <ShopShelf position={[-4.25, 0, 6.05]} length={1.7} levels={3} seed={5} />
      <CheckoutCounter position={[-0.15, 0, 5.75]} />
      <LaneOrigin x={PORT} z={4.1} />
      {people && (
        <>
          <Person position={[-0.85, 0, 5.75]} pose="inspect" outfit="casual" seed={52} skin={1} />
          <Person position={[0.6, 0, 5.55]} rotation-y={Math.PI} pose="tablet" carrying="phone" outfit="casual" seed={57} skin={3} />
          <Person position={[-2.1, 0, 4.85]} rotation-y={Math.PI / 2} pose="inspect" outfit="casual" seed={61} skin={0} />
          <Mover path={[[-3.5, 5.75], [-1.75, 5.75], [-1.75, 6.75]]} speed={WALK_SPEED * 0.85} offset={2}>
            <Person pose="walkCarry" carrying="basket" outfit="casual" seed={66} skin={2} />
          </Mover>
        </>
      )}
    </group>
  );
}
