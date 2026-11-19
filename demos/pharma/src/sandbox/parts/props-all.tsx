// A small yard: both trucks, a forklift bringing a pallet, stocked racks,
// loose stock and five workers, to judge the props together.
import {
  CartonStack,
  Cone,
  DrumPallet,
  Forklift,
  HandTruck,
  Pallet,
  PalletJack,
  PALLET_JACK_OPERATOR_X,
  Rack,
  Trolley,
  Truck,
  Worker,
} from '@/scene/props';
import { PALETTE } from '@/scene/style';

export const view = { target: [0.4, 1.7, -0.9] as [number, number, number], zoom: 56 };

export default function PropsAll() {
  return (
    <group>
      <Rack bays={2} levels={3} color="blue" seed={3} position={[-5.5, 0, -7]} />
      <Rack bays={2} levels={3} color="orange" seed={8} position={[1.2, 0, -8.2]} />

      <Truck position={[5.2, 0, 5.6]} rotation-y={0.1} />
      <Truck cabColor={PALETTE.white} position={[7.4, 0, 0.6]} rotation-y={0.1} />

      <Forklift load="cartons" seed={5} position={[-4.2, 0, -1.8]} rotation-y={-Math.PI / 2 - 0.3} />
      <Cone position={[-1.9, 0, -3.3]} />
      <Cone position={[-1.2, 0, -1.9]} />
      <Cone position={[-0.5, 0, -0.5]} />

      <CartonStack position={[-8, 0, 0.2]} seed={2} rotation-y={0.05} />
      <CartonStack position={[-8.1, 0, 1.7]} seed={6} count={7} rotation-y={-0.04} />
      <DrumPallet position={[-9.6, 0, -2.4]} seed={4} />
      <DrumPallet position={[-9.7, 0, -3.9]} seed={5} count={3} />
      <Pallet position={[-6.2, 0, 3.4]} rotation-y={0.5} />
      <Pallet position={[-6.15, 0.144, 3.45]} rotation-y={0.42} />

      <group position={[-2.6, 0, 3]} rotation-y={0.5}>
        <PalletJack load="drums" seed={9} />
        <Worker pose="push" skin={2} seed={4} vest position={[PALLET_JACK_OPERATOR_X, 0, 0]} />
      </group>
      <HandTruck cartons={2} position={[0.2, 0, 6.6]} rotation-y={-0.7} />
      <Trolley position={[-0.2, 0, 1.6]} rotation-y={0.3} />

      <Worker pose="tablet" skin={0} seed={2} position={[-7.0, 0, -5.0]} rotation-y={-0.6} />
      <Worker pose="carry" skin={3} seed={7} position={[-1.6, 0, 7.4]} rotation-y={0.5} />
      <Worker pose="carry" carrying="tray" skin={1} seed={3} position={[-0.9, 0, 0.9]} rotation-y={Math.PI + 0.3} />
      <Worker pose="walk" skin={1} seed={11} vest position={[-3.2, 0, 6.2]} rotation-y={-0.6} />
      <Worker pose="stand" skin={2} seed={12} position={[3.6, 0, 8.4]} rotation-y={-0.9} />
    </group>
  );
}
