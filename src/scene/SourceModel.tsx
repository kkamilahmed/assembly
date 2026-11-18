import type { SourceId } from '@/streaming/networkConfig';
import { Atm } from './buildings/Atm';
import { Cafe } from './buildings/Cafe';
import { Mall } from './buildings/Mall';
import { Warehouse } from './buildings/Warehouse';
import { ATM, CAFE, MALL, WAREHOUSE } from './layout';

/** Footprint centre and fit of each source, for framing it alone. */
const FRAME: Record<SourceId, { x: number; z: number; scale: number }> = {
  'CAFE-01': { x: (CAFE.x0 + CAFE.x1) / 2, z: (CAFE.z0 + CAFE.z1) / 2, scale: 0.78 },
  'ATM-07': { x: ATM.x, z: ATM.z + 0.3, scale: 1.25 },
  'MALL-03': { x: (MALL.x0 + MALL.x1) / 2, z: (MALL.z0 + MALL.z1) / 2, scale: 0.6 },
  'TDZ-WEB': { x: (WAREHOUSE.x0 + WAREHOUSE.x1) / 2, z: (WAREHOUSE.z0 + WAREHOUSE.z1) / 2, scale: 0.6 },
};

/** One source on its own, centred on the origin, for the sources screen's
 *  preview cards. Same buildings as the network, without the people, so a
 *  card and the network view show the same place. */
export function SourceModel({ sourceId }: { sourceId: SourceId }) {
  const f = FRAME[sourceId];
  return (
    <group scale={f.scale}>
      <group position={[-f.x, 0, -f.z]}>
        {sourceId === 'CAFE-01' && <Cafe people={false} />}
        {sourceId === 'ATM-07' && <Atm people={false} />}
        {sourceId === 'MALL-03' && <Mall people={false} />}
        {sourceId === 'TDZ-WEB' && <Warehouse people={false} />}
      </group>
    </group>
  );
}
