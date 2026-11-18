// Everything that makes the clean room look worked in: the in-process hold
// of tray trolleys, the IPC benches where tablets are weighed, the
// compression suite's operators, material staging and goods-in, the
// packaging store along the yard side, the airlock, and the people doing
// those jobs. Rendered at world origin on the slab top.
//
// Clearances: nothing here comes within 0.9 of the conveyor centreline,
// nothing a mover carries passes within a body width of anything else, and
// everything on the yard side of the inspection leg stays low enough not to
// hide the belt from the camera.
import { CartonStack, Cone, DrumPallet, PalletJack, PALLET_JACK_OPERATOR_X, Trolley, Worker, WORKER_PUSH_GRIP, WORKER_WALK_SPEED } from '@/scene/props';
import { Mover } from './Mover';
import {
  BarrierRun,
  BenchScale,
  Bollards,
  Drum,
  DRUM_CART_OPERATOR_X,
  DrumCart,
  FilmRollPallet,
  FlatCartonPallet,
  FloorMat,
  FloorScale,
  HandwashStation,
  IngredientBin,
  PalletStack,
  SampleTray,
  ToteStacks,
  WasteBin,
  WorkTable,
  type ToteStackSpec,
} from '@/scene/props/extra';

/** Yaw that turns a +x-facing prop toward each floor direction. */
const FACE = { px: 0, nx: Math.PI, pz: -Math.PI / 2, nz: Math.PI / 2 } as const;

// ------------------------------------------------------ in-process hold

const HOLD_COLS = [-1.3, -0.4, 0.5, 1.4];
const HOLD_ROWS = [-0.1, 0.95];
const HOLD_BARRIER: Array<[number, number]> = [[-1.92, -0.5], [-1.92, 0.45], [-1.92, 1.4]];

/** Two rows of tray trolleys holding tablets until their in-process checks
 *  clear, one slot open, and an operator wheeling the next trolley in. */
function InProcessHold() {
  const trolleyHalf = 0.37;
  return (
    <group>
      {HOLD_ROWS.flatMap((z, r) =>
        HOLD_COLS.map((x, c) => {
          const i = r * HOLD_COLS.length + c;
          if (r === 1 && c === 3) return null;
          return <Trolley key={i} position={[x, 0, z]} rotation-y={((i * 37) % 7) * 0.012 - 0.04} fill={i % 3 === 1 ? 0.67 : 1} seed={20 + i} />;
        }),
      )}
      {/* Wheeling a full trolley up to the empty slot and back out for the
          next one. */}
      <Mover path={[[1.4, 3.55], [1.4, 1.95]]} speed={WORKER_WALK_SPEED * 0.75} offset={2} turn={false}>
        <Trolley fill={1} seed={31} />
        <Worker position={[-(WORKER_PUSH_GRIP.x + trolleyHalf + 0.02), 0, 0]} pose="walkPush" seed={23} skin={3} />
      </Mover>
      {/* Belt barrier between the walkway and the trolley traffic. */}
      <BarrierRun points={HOLD_BARRIER} />
    </group>
  );
}

// -------------------------------------------------------- the IPC bench

const IPC_TOTES: ToteStackSpec[] = [
  { at: [0.02, 4.42], count: 4, color: 'blue', top: 'lid' },
  { at: [0.7, 4.45], yaw: 0.06, count: 3, color: 'blue', top: 'open' },
  { at: [0.04, 3.96], yaw: -0.04, count: 2, color: 'white', top: 'powder' },
  { at: [0.72, 3.98], count: 5, color: 'white', top: 'lid' },
];

/** In-process control bench in the room: a QC tech weighing sample
 *  tablets pulled off the line, next to the trays waiting their turn. */
function IpcBench() {
  return (
    <group>
      <FloorMat position={[-1.62, 0, 3.4]} size={[0.75, 1.7]} />
      <group position={[-0.9, 0, 3.4]} rotation-y={FACE.nz}>
        <WorkTable size={[1.9, 0.78, 0.9]} />
        <SampleTray position={[-0.55, 0.9, 0.02]} rotation-y={FACE.nz} />
        <BenchScale position={[0.08, 0.9, 0.02]} rotation-y={FACE.nz} />
        <SampleTray position={[0.62, 0.9, 0.02]} rotation-y={FACE.nz + 0.06} />
        <SampleTray position={[-0.3, 0.258, 0]} />
      </group>
      <Worker position={[-1.62, 0, 3.3]} rotation-y={FACE.px} pose="inspect" seed={27} skin={1} />
      <ToteStacks stacks={IPC_TOTES} seed={3} />
    </group>
  );
}

// ---------------------------------------------------- material staging

/** Dispensed raw material staged for the next blend: drums of active
 *  ingredient and excipients, checked off against the batch record. */
function MaterialStaging() {
  return (
    <group>
      <DrumPallet position={[-5.7, 0, 0.3]} seed={4} />
      <DrumPallet position={[-5.7, 0, 1.45]} count={3} seed={7} />
      <IngredientBin position={[-4.25, 0, 0.05]} rotation-y={FACE.px} lid="blue" />
      <Worker position={[-4.5, 0, 1.2]} rotation-y={FACE.nx} pose="tablet" clipboard seed={33} skin={2} />
      <Bollards points={[[-3.3, -0.45], [-6.5, -0.45]]} />
    </group>
  );
}

// --------------------------------------------------- compression suite

/** Inside the glass: the press operator at the HMI, the blender operator
 *  with the batch record, and the IPC station where a tech weighs tablets
 *  straight off the press. */
function CompressionSuite() {
  return (
    <group>
      <FloorMat position={[-7.55, 0, 6.5]} size={[0.75, 1.1]} />
      <Worker position={[-7.55, 0, 6.5]} rotation-y={FACE.nx} pose="tablet" seed={2} skin={0} />
      <Worker position={[-7.5, 0, 4.3]} rotation-y={FACE.px + 0.5} pose="tablet" clipboard seed={9} skin={3} />

      <group position={[-11.05, 0, 4.7]} rotation-y={FACE.nz}>
        <WorkTable size={[1.4, 0.7, 0.9]} upstand />
        <BenchScale position={[-0.3, 0.9, 0.04]} rotation-y={FACE.pz} />
        <SampleTray position={[0.3, 0.9, 0.04]} rotation-y={FACE.nz} />
      </group>
      <Worker position={[-10.35, 0, 4.7]} rotation-y={FACE.nx} pose="inspect" seed={36} skin={0} />
      <IngredientBin position={[-10.95, 0, 6.7]} rotation-y={FACE.px} lid="blue" />
    </group>
  );
}

// ------------------------------------------- outside the suite's door

const CART_TOTE: ToteStackSpec[] = [{ at: [0.02, 0], y: 0.275, count: 1, color: 'blue', top: 'lid' }];

function SuiteDoor() {
  return (
    <group>
      {/* Handwash on the way into the suite. */}
      <HandwashStation position={[-4.16, 0, 3.9]} />
      <FloorMat position={[-3.5, 0, 3.9]} size={[0.7, 1.0]} />
      <Worker position={[-3.5, 0, 3.9]} rotation-y={FACE.nx} pose="inspect" seed={37} skin={2} />
      {/* A cart of drums on its way in for the next blend. */}
      <Mover path={[[-1.2, 5.55], [-3.55, 5.55]]} speed={WORKER_WALK_SPEED * 0.7} offset={1} turn={false}>
        <DrumCart drums={4} />
        <Worker position={[DRUM_CART_OPERATOR_X, 0, 0]} pose="walkPush" seed={41} skin={1} />
      </Mover>
      {/* Waste by the coater infeed, guard posts along the line. */}
      <WasteBin position={[-7.3, 0, -2.8]} rotation-y={FACE.pz} lid="green" />
      <WasteBin position={[-6.66, 0, -2.82]} rotation-y={FACE.pz} lid="blue" />
      <Bollards points={[[-7.95, -0.55], [-7.95, 0.33], [-7.95, 1.2]]} />
      {/* Utility cart with samples for the lab. */}
      <group position={[-5.6, 0, -2.85]} rotation-y={0.06}>
        <WorkTable size={[1.0, 0.58, 0.86]} castors />
        <SampleTray position={[-0.18, 0.86, 0]} rotation-y={FACE.nz} />
        <ToteStacks stacks={CART_TOTE} />
      </group>
    </group>
  );
}

// ------------------------------------------------------ goods-in strip

/** Drums arriving along the front glass, on their way to the suite. */
function GoodsIn() {
  return (
    <group>
      <DrumPallet position={[-3.85, 0, 6.72]} rotation-y={FACE.nz} seed={3} />
      <Mover path={[[-1.0, 6.7], [-2.65, 6.7]]} speed={WORKER_WALK_SPEED * 0.75} offset={5} turn={false}>
        <PalletJack load="drums" seed={8} />
        <Worker position={[PALLET_JACK_OPERATOR_X, 0, 0]} pose="walkPush" seed={39} skin={1} />
      </Mover>
      <PalletStack position={[1.45, 0, 6.7]} count={6} seed={2} />
      <Cone position={[2.45, 0, 6.0]} />
      <FloorScale position={[0.9, 0, 5.4]} rotation-y={FACE.pz} />
      <Drum position={[0.9, 0.088, 5.4]} rotation-y={0.4} />
    </group>
  );
}

// ------------------------------------------------------ packaging store

const STORE_TOTES: ToteStackSpec[] = [
  { at: [4.5, -5.95], yaw: Math.PI / 2, count: 3, color: 'blue', top: 'lid' },
  { at: [4.5, -5.3], yaw: Math.PI / 2, count: 2, color: 'blue', top: 'open' },
  { at: [4.5, -4.65], yaw: Math.PI / 2, count: 3, color: 'white', top: 'lid' },
  { at: [4.5, -4.0], yaw: Math.PI / 2, count: 1, color: 'white', top: 'open' },
];

/** The yard side of the inspection leg: blister and carton materials on
 *  pallets, the QA bench with retained samples, the operators at
 *  inspection and the blister packer, and the walkway to the airlock. */
function PackagingStore() {
  return (
    <group>
      <FlatCartonPallet position={[6.65, 0, -5.6]} rotation-y={FACE.nz} flats={[13, 9]} seed={2} />
      <FilmRollPallet position={[6.65, 0, -4.2]} rotation-y={FACE.nz} top={3} />
      <CartonStack position={[6.65, 0, -2.8]} rotation-y={FACE.nz} rows={2} cols={2} layers={2} count={7} seed={12} />
      <ToteStacks stacks={STORE_TOTES} seed={11} />
      <Mover path={[[5.6, -5.6], [5.6, -2.4]]} offset={2.5}>
        <Worker pose="walkCarry" carrying="box" seed={44} skin={0} />
      </Mover>

      {/* Checking tablets at the inspection station's screen. */}
      <Worker position={[4.55, 0, -2.75]} rotation-y={FACE.nx} pose="inspect" seed={8} skin={3} />

      {/* QA bench: retained samples on the check-weigher. */}
      <group position={[6.72, 0, -0.75]} rotation-y={FACE.nz}>
        <WorkTable size={[1.5, 0.7, 0.9]} upstand />
        <BenchScale position={[-0.35, 0.9, 0.02]} rotation-y={FACE.pz} />
        <SampleTray position={[0.36, 0.9, 0]} rotation-y={FACE.nz} />
      </group>
      <Worker position={[6.02, 0, -0.8]} rotation-y={FACE.px} pose="inspect" seed={47} skin={2} />
      <WasteBin position={[6.8, 0, 0.62]} rotation-y={FACE.nx} lid="blue" />

      {/* The blister packer's operator, at its HMI. */}
      <Worker position={[4.6, 0, 1.45]} rotation-y={FACE.nx} pose="tablet" seed={14} skin={1} />
      {/* Gowning up in the airlock. */}
      <Worker position={[6.6, 0, 2.88]} rotation-y={FACE.pz} pose="inspect" seed={17} skin={0} />
      <Bollards points={[[5.82, 1.12], [5.82, 3.68]]} />

      {/* The cartoner's operator. */}
      <Worker position={[5.7, 0, 6.75]} rotation-y={FACE.nz} pose="tablet" seed={52} skin={3} />
    </group>
  );
}

export function Dressing() {
  return (
    <group>
      <InProcessHold />
      <IpcBench />
      <MaterialStaging />
      <CompressionSuite />
      <SuiteDoor />
      <GoodsIn />
      <PackagingStore />
    </group>
  );
}
