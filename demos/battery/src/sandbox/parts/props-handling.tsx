// Handling equipment and stock up close.
import { Agv, Carton, CartonStack, Cone, Forklift, ModuleStack, HandTruck, Pallet, PalletJack, PALLET_JACK_OPERATOR_X, CellCart, Worker } from '@/scene/props';

export const view = { target: [0.3, 0.9, 0] as [number, number, number], zoom: 105 };

export default function PropsHandling() {
  return (
    <group>
      <Forklift load="cartons" position={[-3.6, 0, -1.2]} rotation-y={-0.5} />
      <Forklift position={[-3.2, 0, 3.2]} rotation-y={0.35} />
      <group position={[0.6, 0, 2.4]} rotation-y={0.2}>
        <PalletJack load="modules" />
        <Worker pose="push" skin={2} seed={4} vest position={[PALLET_JACK_OPERATOR_X, 0, 0]} />
      </group>
      <PalletJack position={[3.9, 0, 1.6]} rotation-y={-0.6} />
      <HandTruck cartons={2} position={[1.7, 0, 4.2]} rotation-y={-0.5} />
      <HandTruck position={[3, 0, 3.6]} rotation-y={0.9} />
      <Cone position={[-1.3, 0, 1.4]} />
      <Cone position={[-0.6, 0, 3.6]} />
      <CellCart position={[0.2, 0, -0.6]} rotation-y={0.2} />
      <CellCart fill={0.5} position={[1.3, 0, -1.1]} rotation-y={Math.PI / 2 - 0.1} />
      <CartonStack position={[3.1, 0, -1.4]} count={10} seed={3} />
      <ModuleStack position={[4.3, 0, -3.2]} seed={2} />
      <Agv position={[-1.2, 0, -2.6]} rotation-y={0.3} load />
      <Agv position={[-0.4, 0, -4]} rotation-y={0.3} load={false} />
      <Pallet position={[5.2, 0, -0.4]} rotation-y={0.3} />
      <Carton position={[5.6, 0, 1.6]} rotation-y={0.4} />
      <Carton position={[5.5, 0.362, 1.62]} rotation-y={0.2} />
    </group>
  );
}
