// Everything that makes the factory floor look worked in: the dry room's
// cell carts, the test bay inside the line's U, the finished-module bay and
// the AGVs that serve it, the supervisor's platform, the parts store along
// the yard side and the technicians doing those jobs. Rendered at world
// origin on the slab top.
//
// Clearances: nothing here comes within 0.9 of the conveyor centreline, no
// two movers' routes come within reach of each other, and everything on the
// yard side of the casing and test leg stays low enough not to hide the belt
// from the camera.
import { Agv, CartonStack, CellCart, HandTruck, ModuleStack, Worker, WORKER_PUSH_GRIP, WORKER_WALK_SPEED } from '@/scene/props';
import { moduleCaseGeometry, moduleMaterial } from '@/scene/props/module';
import { Part } from '@/scene/props/Part';
import { AGV_DOCK_Z } from './machines/TransferStation';
import { MACHINE_POS } from './layout';
import { Mover } from './Mover';
import {
  BarrierRun,
  BenchScale,
  Bollards,
  ComponentBin,
  CyclerCabinet,
  FilmRollPallet,
  FlatCartonPallet,
  FloorMat,
  FloorScale,
  PalletStack,
  SupervisorPlatform,
  ToteStacks,
  WasteBin,
  WorkTable,
  type ToteStackSpec,
} from '@/scene/props/extra';

/** Yaw that turns a +x-facing prop toward each floor direction. */
const FACE = { px: 0, nx: Math.PI, pz: -Math.PI / 2, nz: Math.PI / 2 } as const;

/** AGV cruising speed: a brisk walk. */
const AGV_SPEED = 1.05;

// -------------------------------------------------------------- dry room

const DRY_TOTES: ToteStackSpec[] = [
  { at: [-11.05, 6.55], yaw: Math.PI / 2, count: 3, color: 'blue', top: 'cells' },
  { at: [-11.05, 5.95], yaw: Math.PI / 2, count: 2, color: 'blue', top: 'lid' },
  { at: [-10.45, 6.55], yaw: Math.PI / 2, count: 4, color: 'white', top: 'lid' },
];

/** Cell carts waiting to feed the sorter, and a technician wheeling the next
 *  one in from the door. */
function DryRoom() {
  const cartHalf = 0.37;
  return (
    <group>
      <CellCart position={[-10.95, 0, 2.35]} rotation-y={FACE.pz + 0.04} seed={3} />
      <CellCart position={[-10.95, 0, 3.3]} rotation-y={FACE.pz - 0.03} fill={0.67} seed={5} />
      <CellCart position={[-10.95, 0, 4.25]} rotation-y={FACE.pz + 0.02} fill={0.33} seed={7} />
      <ToteStacks stacks={DRY_TOTES} seed={4} />
      {/* Loading cells into the sorter's magazines from the far side. */}
      <Worker position={[-10.2, 0, 5.2]} rotation-y={FACE.pz + 0.5} pose="inspect" seed={51} skin={2} />
      <Mover path={[[-7.25, 2.9], [-7.25, 4.6]]} speed={WORKER_WALK_SPEED * 0.75} offset={1.5} turn={false}>
        <CellCart fill={1} seed={9} />
        <Worker position={[-(WORKER_PUSH_GRIP.x + cartHalf + 0.02), 0, 0]} pose="walkPush" seed={53} skin={0} />
      </Mover>
    </group>
  );
}

// ------------------------------------------------------------ robot cells

/** Barriers round the two robots' reach, and the people at their panels. */
function RobotGuards() {
  return (
    <group>
      <BarrierRun points={[[-11.5, -1.75], [-9.95, -1.75]]} />
      <Worker position={[-10.9, 0, 1.28]} rotation-y={FACE.nz} pose="tablet" seed={55} skin={1} />
      <BarrierRun points={[[3.95, -1.45], [5.15, -1.45]]} />
    </group>
  );
}

// ------------------------------------------------------------ welder side

/** The laser welder's operator at its panel, and the weld check's inspector. */
function WelderCrew() {
  return (
    <group>
      <FloorMat position={[-5.75, 0, -3.3]} size={[0.9, 0.7]} />
      <Worker position={[-5.75, 0, -3.3]} rotation-y={FACE.nz} pose="inspect" seed={61} skin={0} />
      <Worker position={[0.15, 0, -3.45]} rotation-y={FACE.nz + 0.4} pose="tablet" seed={63} skin={2} />
      <ComponentBin position={[-2.05, 0, -3.25]} rotation-y={FACE.pz} lid="orange" />
      <WasteBin position={[-2.75, 0, -3.25]} rotation-y={FACE.pz} lid="blue" />
    </group>
  );
}

// --------------------------------------------------------------- test bay

const BAY_TOTES: ToteStackSpec[] = [
  { at: [-1.45, 1.35], count: 2, color: 'white', top: 'lid' },
  { at: [-1.45, 1.95], yaw: 0.05, count: 3, color: 'blue', top: 'lid' },
];

/** Cycler cabinets testing sample modules, and AGV 2 bringing them in. */
function TestBay() {
  return (
    <group>
      <CyclerCabinet position={[-0.95, 0, -0.35]} rotation-y={FACE.pz} filled={6} />
      <CyclerCabinet position={[0.45, 0, -0.35]} rotation-y={FACE.pz} filled={4} />
      <Worker position={[-0.25, 0, 0.55]} rotation-y={FACE.nz} pose="tablet" seed={65} skin={1} />
      <ToteStacks stacks={BAY_TOTES} seed={8} />
      <Mover path={[[1.1, 4.45], [1.1, 1.35]]} speed={AGV_SPEED} offset={2} turn={false}>
        <Agv />
      </Mover>
    </group>
  );
}

// --------------------------------------------------- supervisor platform

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
      <Bollards
        points={[
          [PLATFORM.x + PLATFORM.l / 2 + 0.22, PLATFORM.z - PLATFORM.d / 2 - 0.2],
          [PLATFORM.x - PLATFORM.l / 2 - 0.2, PLATFORM.z - PLATFORM.d / 2 - 0.2],
          [PLATFORM.x + PLATFORM.l / 2 + 0.22, PLATFORM.z + PLATFORM.d / 2 + 1.6],
        ]}
      />
      {/* Carrying a tray of cells from the dry-room door toward the stacker. */}
      <Mover path={[[-5.6, -1.42], [0.4, -1.42]]} offset={4}>
        <Worker pose="walkCarry" carrying="tray" seed={17} skin={0} />
      </Mover>
      <Mover path={[[-2.49, 4.3], [-2.49, -0.3]]} offset={1}>
        <Worker pose="walk" seed={67} skin={3} />
      </Mover>
    </group>
  );
}

// -------------------------------------------------- finished-module bay

/** Where AGV 1 delivers: a drop stand, pallets of finished modules waiting
 *  for the forklift, and someone scanning them out. AGV 1 runs the aisle in
 *  front of the line from the transfer station's dock. */
function ModuleBay() {
  // The AGV backs up to the dock stand's -x end to collect.
  const dockX = MACHINE_POS.transfer.x - 1.15;
  const dockZ = MACHINE_POS.transfer.z + AGV_DOCK_Z;
  return (
    <group>
      <Mover path={[[dockX, dockZ], [-0.75, dockZ]]} speed={AGV_SPEED} offset={0} turn={false}>
        <Agv />
      </Mover>
      {/* Drop stand at the aisle's end. */}
      <group position={[-1.95, 0, dockZ]}>
        <WorkTable size={[0.8, 0.7, 0.52]} shelf={false} />
        <Part g={moduleCaseGeometry()} m={moduleMaterial()} position-y={0.53} />
      </group>
      <ModuleStack position={[-3.3, 0, 6.62]} layers={3} seed={2} />
      <ModuleStack position={[-4.65, 0, 6.62]} layers={2} count={7} seed={4} />
      <PalletStack position={[-5.95, 0, 6.66]} count={5} seed={2} />
      <Worker position={[-3.95, 0, 5.75]} rotation-y={FACE.pz + 0.4} pose="tablet" seed={69} skin={0} />
      <FloorScale position={[-1.25, 0, 5.1]} rotation-y={FACE.pz} />
    </group>
  );
}

// ----------------------------------------------------------- parts store

const STORE_TOTES: ToteStackSpec[] = [
  { at: [4.5, -6.25], yaw: Math.PI / 2, count: 3, color: 'blue', top: 'lid' },
  { at: [4.5, -5.6], yaw: Math.PI / 2, count: 2, color: 'blue', top: 'cells' },
  { at: [4.5, -4.95], yaw: Math.PI / 2, count: 3, color: 'white', top: 'lid' },
];

/** The yard side of the casing and test leg: cell cartons, case stock and
 *  packaging on pallets, a QA bench where a module is pulled for a teardown,
 *  and the walkway to the steps. */
function PartsStore() {
  return (
    <group>
      <FlatCartonPallet position={[6.65, 0, -5.6]} rotation-y={FACE.nz} flats={[13, 9]} seed={2} />
      <FilmRollPallet position={[6.65, 0, -4.2]} rotation-y={FACE.nz} top={3} />
      <CartonStack position={[6.65, 0, -2.8]} rotation-y={FACE.nz} rows={2} cols={2} layers={2} count={7} seed={12} />
      <ToteStacks stacks={STORE_TOTES} seed={11} />
      <Mover path={[[5.6, -5.6], [5.6, -2.4]]} offset={2.5}>
        <Worker pose="walkCarry" carrying="box" seed={44} skin={0} vest />
      </Mover>

      {/* QA bench: a module pulled from the line on the check-weigher. */}
      <group position={[6.72, 0, -0.75]} rotation-y={FACE.nz}>
        <WorkTable size={[1.5, 0.7, 0.9]} upstand />
        <BenchScale position={[-0.4, 0.9, 0.02]} rotation-y={FACE.pz} />
        <Part g={moduleCaseGeometry()} m={moduleMaterial()} position={[0.32, 0.9, 0]} rotation-y={0.1} />
      </group>
      <Worker position={[6.02, 0, -0.8]} rotation-y={FACE.px} pose="inspect" seed={47} skin={2} />
      <HandTruck position={[7.35, 0, 0.75]} rotation-y={2.6} />
      {/* Checking the scrap cage. */}
      <Worker position={[5.55, 0, 0.85]} rotation-y={FACE.nx} pose="tablet" seed={71} skin={1} vest />

      {/* Posts at the corners of the crossing to the steps. */}
      <Bollards points={[[3.98, 1.45], [7.12, 1.45], [3.98, 3.3], [7.12, 3.3]]} />
    </group>
  );
}

export function Dressing() {
  return (
    <group>
      <DryRoom />
      <RobotGuards />
      <WelderCrew />
      <TestBay />
      <Platform />
      <ModuleBay />
      <PartsStore />
    </group>
  );
}
