import { Diorama } from './Diorama';
import { Dressing } from './Dressing';
import { SHOTS, SLAB, type ShotId } from './layout';
import { Line } from './Line';
import { Modules } from './Modules';
import { ShadowBudget } from './ShadowBudget';
import { ShadowFloor, Stage } from './Stage';
import { StaticBatch } from './StaticBatch';
import { Crew, Yard } from './Yard';

export function Scene({
  active,
  shot = 'S01',
  target,
  zoom,
  interactive = true,
}: {
  active: boolean;
  shot?: ShotId;
  /** Override the shot's framing. */
  target?: [number, number, number];
  zoom?: number;
  interactive?: boolean;
}) {
  const frame = SHOTS[shot];
  return (
    <Stage
      active={active}
      target={target ?? frame.target}
      zoom={zoom ?? frame.zoom}
      controls={interactive}
      onCreated={(gl, scene) => {
        if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene });
      }}
    >
      {/* The slab's top is y=0; the yard around it is the white floor,
          one slab-thickness lower. */}
      <ShadowFloor y={-SLAB.thickness} />
      <StaticBatch>
        <Diorama />
        <Crew />
        <Dressing />
        <Yard />
      </StaticBatch>
      <Line />
      <Modules />
      <ShadowBudget />
    </Stage>
  );
}
