import { Diorama } from './Diorama';
import { Dressing } from './Dressing';
import { SHOTS, SLAB, type ShotId } from './layout';
import { Line } from './Line';
import { LiveDashboard } from './LiveDashboard';
import { Loaves } from './Loaves';
import { ShadowFloor, Stage } from './Stage';
import { Crew, Yard } from './Yard';

export function Scene({ active, shot = 'S01', interactive = true }: { active: boolean; shot?: ShotId; interactive?: boolean }) {
  const frame = SHOTS[shot];
  return (
    <Stage
      active={active}
      target={frame.target}
      zoom={frame.zoom}
      controls={interactive}
      onCreated={(gl) => {
        if (import.meta.env.DEV) Object.assign(window, { __gl: gl });
      }}
    >
      {/* The slab's top is y=0; the yard around it is the white floor,
          one slab-thickness lower. */}
      <ShadowFloor y={-SLAB.thickness} />
      <Diorama />
      <LiveDashboard />
      <Line />
      <Loaves />
      <Crew />
      <Dressing />
      <Yard />
    </Stage>
  );
}
