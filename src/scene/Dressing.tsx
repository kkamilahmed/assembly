// Everything that makes the factory floor look worked in: the cooling bay
// of rack trolleys, the prep bench, ingredient staging by the hygiene door,
// the supervisor's platform, the packaging store along the yard side and
// the people doing those jobs. Rendered at world origin on the slab top.
//
// Clearances: nothing here comes within 0.9 of the conveyor centreline, and
// everything on the yard side of the inspection leg stays low enough not to
// hide the belt from the camera.
import { CartonStack, Cone, FlourSackStack, HandTruck, PalletJack, PALLET_JACK_OPERATOR_X, Trolley, Worker, WORKER_PUSH_GRIP } from '@/scene/props';
import {
  BarrierRun,
  BenchScale,
  Bollards,
  DoughBowl,
  DoughTub,
  FilmRollPallet,
  FlatCartonPallet,
  FloorMat,
  FloorScale,
  HandwashStation,
  IngredientBin,
  PalletStack,
  SupervisorPlatform,
  ToteStacks,
  WasteBin,
  WorkTable,
  type ToteStackSpec,
} from '@/scene/props/extra';

/** Yaw that turns a +x-facing prop toward each floor direction. */
const FACE = { px: 0, nx: Math.PI, pz: -Math.PI / 2, nz: Math.PI / 2 } as const;

// ---------------------------------------------------------- cooling bay

const COOLING_COLS = [-1.3, -0.4, 0.5, 1.4];
const COOLING_ROWS = [-0.1, 0.95];
const COOLING_BARRIER: Array<[number, number]> = [[-1.92, -0.5], [-1.92, 0.45], [-1.92, 1.4]];

/** Two rows of rack trolleys cooling the bake, one slot open, and a baker
 *  wheeling the next trolley in. */
function CoolingBay() {
  const trolleyHalf = 0.37;
  return (
    <group>
      {COOLING_ROWS.flatMap((z, r) =>
        COOLING_COLS.map((x, c) => {
          const i = r * COOLING_COLS.length + c;
          if (r === 1 && c === 3) return null;
          return <Trolley key={i} position={[x, 0, z]} rotation-y={((i * 37) % 7) * 0.012 - 0.04} fill={i % 3 === 1 ? 0.67 : 1} seed={20 + i} />;
        }),
      )}
      <group position={[1.4, 0, 2.15]} rotation-y={FACE.nz}>
        <Trolley fill={1} seed={31} />
        <Worker position={[-(WORKER_PUSH_GRIP.x + trolleyHalf + 0.02), 0, 0]} pose="push" seed={23} skin={3} />
      </group>
      {/* Trolleys queued at the oven end, beside the owner's one. */}
      <Trolley position={[0.42, 0, -2.78]} rotation-y={0.1} fill={1} seed={41} />
      {/* Belt barrier between the walkway and the trolley traffic. */}
      <BarrierRun points={COOLING_BARRIER} />
    </group>
  );
}

// ----------------------------------------------------------- prep bench

const PREP_TOTES: ToteStackSpec[] = [
  { at: [0.02, 4.42], count: 4, color: 'blue', top: 'lid' },
  { at: [0.7, 4.45], yaw: 0.06, count: 3, color: 'blue', top: 'open' },
  { at: [0.04, 3.96], yaw: -0.04, count: 2, color: 'white', top: 'dough' },
  { at: [0.72, 3.98], count: 5, color: 'white', top: 'lid' },
];

/** Stainless bench with dough tubs and a scale, a baker working at it, and
 *  the totes the dough travels in. */
function PrepBench() {
  return (
    <group>
      <FloorMat position={[-1.62, 0, 3.4]} size={[0.75, 1.7]} />
      <group position={[-0.9, 0, 3.4]} rotation-y={FACE.nz}>
        <WorkTable size={[1.9, 0.78, 0.9]} />
        <DoughTub position={[-0.62, 0.9, 0]} rotation-y={FACE.nz} />
        <DoughBowl position={[0.02, 0.9, 0.06]} />
        <BenchScale position={[0.62, 0.9, 0.02]} rotation-y={FACE.nz} />
        <DoughTub position={[-0.45, 0.258, 0]} filled={false} />
        <DoughTub position={[0.3, 0.258, 0]} filled={false} />
      </group>
      <Worker position={[-1.62, 0, 3.3]} rotation-y={FACE.px} pose="inspect" seed={27} skin={1} />
      <ToteStacks stacks={PREP_TOTES} seed={3} />
    </group>
  );
}

// ------------------------------------------------- supervisor platform

const PLATFORM = { x: -4.9, z: 0.75, l: 2.8, d: 2.1, h: 1.1 } as const;

const UNDER_DECK: ToteStackSpec[] = [
  { at: [-5.75, 0.3], yaw: Math.PI / 2, count: 2, color: 'blue', top: 'lid' },
  { at: [-5.75, 1.0], yaw: Math.PI / 2, count: 2, color: 'white', top: 'lid' },
  { at: [-5.1, 0.3], yaw: Math.PI / 2, count: 2, color: 'white', top: 'lid' },
  { at: [-5.1, 1.0], yaw: Math.PI / 2, count: 1, color: 'blue', top: 'open' },
];

function Platform() {
  return (
    <group>
      <SupervisorPlatform position={[PLATFORM.x, 0, PLATFORM.z]} size={[PLATFORM.l, PLATFORM.d]} height={PLATFORM.h}>
        {/* The shift supervisor at the front rail, overlooking the floor. */}
        <Worker position={[-0.15, 0, 0.62]} rotation-y={-0.9} pose="tablet" seed={33} skin={2} />
      </SupervisorPlatform>
      <ToteStacks stacks={UNDER_DECK} seed={5} />
      {/* Guard posts so trolleys do not clip the legs or the stair foot. */}
      <Bollards
        points={[
          [PLATFORM.x + PLATFORM.l / 2 + 0.22, PLATFORM.z - PLATFORM.d / 2 - 0.2],
          [PLATFORM.x - PLATFORM.l / 2 - 0.2, PLATFORM.z - PLATFORM.d / 2 - 0.2],
          [PLATFORM.x + PLATFORM.l / 2 + 0.22, PLATFORM.z + PLATFORM.d / 2 + 1.6],
        ]}
      />
    </group>
  );
}

// -------------------------------------------------- hygiene door side

function HygieneSide() {
  return (
    <group>
      {/* Handwash station against the glass, on the way into the zone. */}
      <HandwashStation position={[-6.14, 0, 3.0]} />
      <FloorMat position={[-5.45, 0, 3.0]} size={[0.7, 1.0]} />
      <Worker position={[-5.42, 0, 3.02]} rotation-y={FACE.nx} pose="inspect" seed={36} skin={0} />
      {/* Ingredient bins staged beside the door. */}
      <IngredientBin position={[-5.9, 0, 4.42]} rotation-y={FACE.pz} lid="blue" />
      <IngredientBin position={[-5.08, 0, 4.42]} rotation-y={FACE.pz} lid="blue" />
      <IngredientBin position={[-4.26, 0, 4.4]} rotation-y={FACE.pz - 0.08} lid="orange" />
      {/* Waste and recycling by the oven infeed, guard posts along the line. */}
      <WasteBin position={[-7.3, 0, -2.8]} rotation-y={FACE.pz} lid="green" />
      <WasteBin position={[-6.66, 0, -2.82]} rotation-y={FACE.pz} lid="orange" />
      <Bollards points={[[-7.95, -0.55], [-7.95, 0.33], [-7.95, 1.2]]} />
      {/* Utility cart by the oven infeed. */}
      <group position={[-5.6, 0, -2.85]} rotation-y={0.06}>
        <WorkTable size={[1.0, 0.58, 0.86]} castors />
        <DoughTub position={[-0.14, 0.86, 0]} rotation-y={FACE.nz} filled={false} />
        <ToteStacks stacks={CART_TOTE} />
      </group>
    </group>
  );
}

const CART_TOTE: ToteStackSpec[] = [{ at: [0.02, 0], y: 0.275, count: 1, color: 'blue', top: 'lid' }];

// ------------------------------------------------------ goods-in strip

/** Flour arriving along the front edge, on its way to the mixer. */
function GoodsIn() {
  return (
    <group>
      <FlourSackStack position={[-5.7, 0, 6.7]} layers={5} seed={3} />
      <FlourSackStack position={[-4.36, 0, 6.7]} layers={3} seed={6} />
      <group position={[-2.1, 0, 6.68]} rotation-y={FACE.nx}>
        <PalletJack load="sacks" seed={8} />
        <Worker position={[PALLET_JACK_OPERATOR_X, 0, 0]} pose="push" seed={39} skin={1} vest />
      </group>
      <PalletStack position={[1.1, 0, 6.66]} count={6} seed={2} />
      <Cone position={[1.95, 0, 6.2]} />
      <FloorScale position={[0.3, 0, 5.5]} rotation-y={FACE.pz} />
      <ToteStacks stacks={SCALE_TOTES} seed={9} />
    </group>
  );
}

const SCALE_TOTES: ToteStackSpec[] = [{ at: [0.3, 5.5], y: 0.088, count: 2, color: 'blue', top: 'dough' }];

// ------------------------------------------------------ packaging store

const STORE_TOTES: ToteStackSpec[] = [
  { at: [4.5, -5.95], yaw: Math.PI / 2, count: 3, color: 'blue', top: 'lid' },
  { at: [4.5, -5.3], yaw: Math.PI / 2, count: 2, color: 'blue', top: 'open' },
  { at: [4.5, -4.65], yaw: Math.PI / 2, count: 3, color: 'white', top: 'lid' },
  { at: [4.5, -4.0], yaw: Math.PI / 2, count: 1, color: 'orange', top: 'open' },
];

/** The yard side of the inspection leg: packaging materials on pallets, a
 *  QA check-weigh bench and the walkway to the steps. */
function PackagingStore() {
  return (
    <group>
      <FlatCartonPallet position={[6.65, 0, -5.6]} rotation-y={FACE.nz} flats={[13, 9]} seed={2} />
      <FilmRollPallet position={[6.65, 0, -4.2]} rotation-y={FACE.nz} top={3} />
      <CartonStack position={[6.65, 0, -2.8]} rotation-y={FACE.nz} rows={2} cols={2} layers={2} count={7} seed={12} />
      <ToteStacks stacks={STORE_TOTES} seed={11} />
      <Worker position={[5.6, 0, -3.9]} rotation-y={FACE.pz} pose="carry" carrying="box" seed={44} skin={0} vest />

      {/* QA bench: sample loaves on the check-weigher. */}
      <group position={[6.72, 0, -0.75]} rotation-y={FACE.nz}>
        <WorkTable size={[1.5, 0.7, 0.9]} upstand />
        <BenchScale position={[-0.35, 0.9, 0.02]} rotation-y={FACE.pz} />
        <DoughTub position={[0.36, 0.9, 0]} filled={false} />
      </group>
      <Worker position={[6.02, 0, -0.8]} rotation-y={FACE.px} pose="tablet" seed={47} skin={2} />
      <WasteBin position={[6.8, 0, 0.62]} rotation-y={FACE.nx} lid="blue" />
      <HandTruck position={[4.7, 0, -0.55]} rotation-y={2.6} />

      {/* Posts at the corners of the crossing to the steps. */}
      <Bollards points={[[3.98, 1.45], [7.12, 1.45], [3.98, 3.3], [7.12, 3.3]]} />
    </group>
  );
}

export function Dressing() {
  return (
    <group>
      <CoolingBay />
      <PrepBench />
      <Platform />
      <HygieneSide />
      <GoodsIn />
      <PackagingStore />
    </group>
  );
}

