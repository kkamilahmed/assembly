import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/state/store';
import { CarShell } from './CarShell';

export function CarPool() {
  const carIds = useStore(useShallow((s) => s.activeCars.map((c) => c.carId)));
  return (
    <>
      {carIds.map((id) => (
        <CarShell key={id} carId={id} />
      ))}
    </>
  );
}
