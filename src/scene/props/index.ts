// Props and people for the bakery plant. Everything has its origin at the
// footprint centre on the ground and faces +x unless its comment says so.
export { Worker, type WorkerPose, type WorkerProps } from './Worker';
export { WORKER_PUSH_GRIP, WORKER_SCALE, WORKER_WALK_SPEED } from './workerRig';
export { Carton, CartonInstances, CartonStack, FlourSackStack, Pallet, PalletInstances, SackInstances } from './Stock';
export { at, CARTON_SIZE, cartonStackMatrices, PALLET, RACK, SACK, sackStackMatrices } from './stockLayout';
export { Rack, type RackProps } from './Rack';
export { Cone, Forklift, HandTruck, PALLET_JACK_OPERATOR_X, PalletJack, Trolley, type ForkliftProps, type PalletLoad, type TrolleyProps } from './Handling';
export { Truck, type TruckProps } from './Truck';
