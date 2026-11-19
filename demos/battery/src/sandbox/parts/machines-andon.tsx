import { Andon } from '@/scene/machines/Andon';
import { ControlBox } from '@/scene/machines/ControlBox';
import { PALETTE } from '@/scene/style';

// oxlint-disable-next-line react/only-export-components
export const view = { target: [0, 0.4, 0] as [number, number, number], zoom: 520 };

/** The three stack-light states and the operator panel variants, close up. */
export default function MachinesAndon() {
  return (
    <group>
      <Andon severity="healthy" position={[-0.9, 0, 0.3]} />
      <Andon severity="warning" position={[-0.6, 0, 0.3]} />
      <Andon severity="critical" position={[-0.3, 0, 0.3]} />
      <ControlBox kind="hmi" position={[0.2, 0.4, 0]} />
      <ControlBox kind="vision" accent={PALETTE.blue} position={[0.8, 0.4, 0]} />
      <ControlBox kind="tester" position={[0.5, 0.4, -0.7]} />
      <ControlBox kind="laser" position={[1.1, 0.4, -0.7]} />
    </group>
  );
}
