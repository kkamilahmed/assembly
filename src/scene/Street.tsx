// Everything between the buildings: the plaza beside the hub, lamps and
// bins along the pavements, passers-by, and on the white street beyond the
// block, TechDealz's delivery trucks with a courier loading them.
import { Bench, Bollards, CafeTable, Parasol, Planter, StoolChair, StreetLamp, Tree, WasteBin } from '@/scene/props/extra';
import { CartonStack, Cone, ParcelCart, PARCEL_CART, Person, PUSH_GRIP, Truck, WALK_SPEED } from '@/scene/props';
import { SLAB } from './layout';
import { Mover } from './Mover';

/** The plaza east of the hub. */
function Plaza() {
  return (
    <group>
      <Planter position={[2.1, 0, -6.75]} seed={2} />
      <Planter position={[7.15, 0, -6.75]} seed={5} />
      <Planter position={[7.15, 0, -2.35]} seed={3} />
      <Bench position={[3.4, 0, -4.7]} rotation-y={-Math.PI / 2} />
      <Bench position={[5.5, 0, -4.7]} rotation-y={-Math.PI / 2} />
      <Person position={[3.4, 0, -4.7]} rotation-y={-Math.PI / 2} pose="sitSip" outfit="casual" seed={141} skin={1} />
      <CafeTable position={[4.6, 0, -6.2]} cups={2} />
      <Parasol position={[4.6, 0, -6.2]} />
      <StoolChair position={[3.98, 0, -6.2]} />
      <StoolChair position={[5.22, 0, -6.2]} rotation-y={Math.PI} />
      <WasteBin position={[6.55, 0, -4.7]} rotation-y={Math.PI} lid="green" />
      <Mover path={[[2.3, -2.45], [6.3, -2.45]]} offset={3}>
        <Person pose="walk" carrying="bags" outfit="casual" seed={147} skin={0} />
      </Mover>
    </group>
  );
}

/** Lamps, bins and bollards along the pavements, clear of every lane. */
function Pavements() {
  return (
    <group>
      <StreetLamp position={[0.9, 0, -1.0]} />
      <StreetLamp position={[6.9, 0, -1.0]} />
      <StreetLamp position={[-3.0, 0, 2.2]} />
      <StreetLamp position={[2.1, 0, 2.2]} />
      <StreetLamp position={[-7.6, 0, 2.2]} />
      <WasteBin position={[-6.9, 0, 2.5]} rotation-y={-Math.PI / 2} lid="blue" />
      <WasteBin position={[7.2, 0, 2.5]} rotation-y={-Math.PI / 2} lid="green" />
      <Bollards points={[[-8.0, -1.0], [-6.9, -1.0], [7.4, 1.55], [7.4, 3.35]]} />
      {/* Shoppers along the front of the shops. */}
      <Mover path={[[-10.6, 7.62], [-2.6, 7.62]]} offset={0.5}>
        <Person pose="walk" carrying="bags" outfit="casual" seed={151} skin={2} />
      </Mover>
      <Mover path={[[0.4, 7.62], [6.6, 7.62]]} offset={5} speed={WALK_SPEED * 0.9}>
        <Person pose="walkCarry" carrying="coffee" outfit="casual" seed={157} skin={1} />
      </Mover>
    </group>
  );
}

/** The white street past the block, one slab-thickness down: TechDealz's
 *  trucks backed up to the warehouse, a courier loading them, trees. */
function Beyond() {
  return (
    <group position-y={-SLAB.thickness}>
      <Truck position={[12.75, 0, 6.0]} />
      <Truck position={[16.6, 0, 1.4]} cabColor="#f4f5f7" />
      <Mover path={[[8.9, 3.85], [11.4, 3.85]]} speed={WALK_SPEED * 0.75} offset={2} turn={false}>
        <ParcelCart boxes={3} />
        <Person position={[-(PUSH_GRIP.x + PARCEL_CART.l / 2 + 0.04), 0, 0]} pose="walkPush" outfit="courier" seed={161} skin={2} />
      </Mover>
      <CartonStack position={[9.4, 0, 8.6]} rows={2} cols={2} layers={2} seed={12} />
      <CartonStack position={[10.9, 0, 9.2]} rows={1} cols={2} layers={1} seed={13} />
      <Cone position={[8.8, 0, 2.6]} />
      <Cone position={[9.5, 0, 2.3]} />
      <Tree position={[-6.6, 0, 10.0]} seed={4} />
      <Tree position={[-0.8, 0, 10.6]} seed={7} size={0.9} />
      <Tree position={[4.4, 0, 10.3]} seed={2} />
      <Bench position={[-3.6, 0, 9.8]} rotation-y={-Math.PI / 2} />
      <Person position={[-3.6, 0, 9.8]} rotation-y={-Math.PI / 2} pose="sitSip" outfit="casual" seed={167} skin={3} />
    </group>
  );
}

export function Street() {
  return (
    <group>
      <Plaza />
      <Pavements />
      <Beyond />
    </group>
  );
}
