import { City } from './City';
import { Diorama } from './Diorama';
import { SHOTS, SLAB, type ShotId } from './layout';
import { Live } from './Live';
import { Packets } from './Packets';
import { ShadowBudget } from './ShadowBudget';
import { ShadowFloor, Stage } from './Stage';
import { StaticBatch } from './StaticBatch';
import { Street } from './Street';

export function Scene({
  active,
  shot = 'S01',
  target,
  zoom,
  interactive = true,
}: {
  active: boolean;
  shot?: ShotId;
  /** Overrides the shot's framing, for close-up stills. */
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
      {/* The slab's top is y=0; the street around it is the white floor,
          one slab-thickness lower. */}
      <ShadowFloor y={-SLAB.thickness} />
      <StaticBatch>
        <Diorama />
        <City />
        <Street />
      </StaticBatch>
      <Live />
      <Packets />
      <ShadowBudget />
    </Stage>
  );
}
