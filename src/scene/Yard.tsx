import { useStore } from '@/state/store';
import { SLAB } from './layout';
import { Mover } from './Mover';
import {
  CartonStack,
  Cone,
  Forklift,
  HandTruck,
  ModuleStack,
  Pallet,
  PALLET_JACK_OPERATOR_X,
  PalletJack,
  Rack,
  Truck,
  Worker,
  WORKER_WALK_SPEED,
} from './props';

/** Passed modules per module shipped to the dispatch pallet: the line runs
 *  far more than the yard can show, so the pallet fills at a readable pace. */
const MODULES_PER_SLOT = 6;
/** The dispatch pallet's capacity: 2 x 2 per layer, 3 layers. */
const DISPATCH_CAPACITY = 12;

/** The dispatch pallet by the dock fills one module at a time as modules
 *  pass, then starts again as if a full one was taken away. */
function DispatchPallet() {
  const passed = useStore((s) => s.modulesPassed);
  const slots = Math.floor(passed / MODULES_PER_SLOT);
  const count = slots === 0 ? 0 : ((slots - 1) % DISPATCH_CAPACITY) + 1;
  return <ModuleStack position={[9.7, 0, 5.2]} layers={3} count={count} seed={3} />;
}

/** Everything outside, on the white floor one slab-thickness down: racked
 *  cell cartons and finished modules, the dispatch pallet, a forklift,
 *  pallet jacks and the trucks backed up to the dock. */
export function Yard() {
  return (
    <group position-y={-SLAB.thickness}>
      {/* Cell and finished-module store, screen upper right. */}
      <Rack position={[11.9, 0, -6.4]} bays={2} levels={3} color="blue" seed={4} />
      <Rack position={[11.9, 0, -3.4]} bays={2} levels={3} color="orange" seed={9} />
      <ModuleStack position={[9.6, 0, -6.8]} layers={3} seed={2} />
      <ModuleStack position={[9.6, 0, -5.4]} layers={2} seed={5} />
      <Pallet position={[9.6, 0, -3.9]} />

      {/* Forklift taking finished modules to the racks. */}
      <Forklift position={[10.7, 0, -0.4]} rotation-y={Math.PI * 0.85} load="modules" lift={0.25} seed={2} />
      <Cone position={[10.2, 0, 1.4]} />
      <Cone position={[11.0, 0, 1.0]} />

      {/* Dispatch. */}
      <DispatchPallet />
      <CartonStack position={[11.6, 0, 4.2]} rows={2} cols={2} layers={3} seed={8} />
      {/* Modules going out to the trucks. */}
      <Mover path={[[9.2, 11.2], [12.4, 11.2]]} speed={WORKER_WALK_SPEED * 0.8} offset={3} turn={false}>
        <PalletJack load="modules" seed={4} />
        <Worker position={[PALLET_JACK_OPERATOR_X, 0, 0]} pose="walkPush" seed={6} skin={2} vest />
      </Mover>
      <HandTruck position={[9.4, 0, 8.4]} rotation-y={-0.4} cartons={3} />
      <Worker position={[9.7, 0, 7.2]} rotation-y={Math.PI * 0.5} pose="tablet" seed={11} skin={1} vest />

      {/* Trucks backed toward the dock (roller door at -x). */}
      <Truck position={[12.9, 0, 8.4]} />
      <Truck position={[16.6, 0, 4.2]} cabColor="#f4f5f7" />
      <Mover path={[[10.2, 2.0], [12.6, 2.0]]}>
        <Worker pose="walkCarry" carrying="box" seed={21} skin={3} vest />
      </Mover>

      {/* Foreground spill off the front of the slab, so the diorama does
          not float as a clean rectangle and the lower left of the frame
          has something in it. */}
      <CartonStack position={[-3.4, 0, 9.9]} rows={2} cols={2} layers={2} seed={12} />
      <CartonStack position={[-1.6, 0, 10.6]} rows={1} cols={2} layers={1} seed={13} />
      <HandTruck position={[-0.2, 0, 10.0]} rotation-y={-0.9} cartons={2} />
      <Mover path={[[2.6, 9.5], [0.7, 9.5]]} offset={1.5}>
        <Worker pose="walkCarry" carrying="box" seed={31} skin={1} vest />
      </Mover>
      <Cone position={[-5.4, 0, 9.4]} />
      <Cone position={[-4.8, 0, 10.4]} />
    </group>
  );
}

/** People on the factory floor itself (slab top, y=0) who belong to no
 *  one station: the line walkers. */
export function Crew() {
  return (
    <group>
      <Worker position={[-7.75, 0, -0.5]} rotation-y={FACE_NX} pose="inspect" seed={5} skin={1} />
    </group>
  );
}

const FACE_NX = Math.PI;
