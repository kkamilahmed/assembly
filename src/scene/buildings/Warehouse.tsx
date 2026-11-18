// TechDealz Online: a dark little warehouse with the store's servers at
// the back (its payments start there), a packing bench, parcels waiting
// to go, and a roller door out to the delivery trucks.
import { RoundedBox } from '@react-three/drei';
import { CartonStack, Person } from '@/scene/props';
import { ServerRack, WorkTable } from '@/scene/props/extra';
import { drawTdzMark } from '@/scene/props/kit';
import { SOURCE_WALL, TDZ_BILLBOARD, WAREHOUSE } from '../layout';
import { metal, PALETTE, plastic } from '../style';
import { Shell } from './Shell';
import { Sign } from './Sign';

const PORT = 4.6;
/** The roller door in the +x wall. */
const DOOR = { z0: 4.95, z1: 6.85, h: 2.3 } as const;

function RollerDoor() {
  const x = WAREHOUSE.x1 - 0.06;
  const zc = (DOOR.z0 + DOOR.z1) / 2;
  const frame = plastic(PALETTE.tdzInk, 0.4);
  return (
    <group>
      {[DOOR.z0, DOOR.z1].map((z) => (
        <RoundedBox key={z} args={[0.16, DOOR.h, 0.14]} radius={0.03} smoothness={2} position={[x, DOOR.h / 2, z]} material={frame} castShadow />
      ))}
      {/* The door rolled up into its drum. */}
      <RoundedBox args={[0.36, 0.36, DOOR.z1 - DOOR.z0 + 0.14]} radius={0.14} smoothness={3} position={[x, DOOR.h + 0.12, zc]} material={plastic(PALETTE.tdzYellow, 0.45)} castShadow />
      <RoundedBox args={[0.08, 0.06, DOOR.z1 - DOOR.z0]} radius={0.02} smoothness={2} position={[x + 0.02, DOOR.h - 0.05, zc]} material={metal(PALETTE.steelDark, 0.35)} />
    </group>
  );
}

export function Warehouse({ people = true }: { people?: boolean }) {
  return (
    <group>
      <Shell
        {...WAREHOUSE}
        height={SOURCE_WALL}
        wall="#2b2e35"
        floor="#d9dce1"
        ports={[PORT]}
        right="none"
        door={[5.75, 6.95]}
      />
      {/* The +x wall: low either side of the roller door. */}
      <RoundedBox args={[0.16, 0.5, DOOR.z0 - WAREHOUSE.z0 - 0.2]} radius={0.04} smoothness={2} position={[WAREHOUSE.x1 - 0.06, 0.25, (WAREHOUSE.z0 + 0.2 + DOOR.z0) / 2]} material={plastic(PALETTE.paving, 0.45)} castShadow receiveShadow />
      <RoundedBox args={[0.16, 0.5, WAREHOUSE.z1 - DOOR.z1]} radius={0.04} smoothness={2} position={[WAREHOUSE.x1 - 0.06, 0.25, (DOOR.z1 + WAREHOUSE.z1) / 2]} material={plastic(PALETTE.paving, 0.45)} castShadow receiveShadow />
      <RollerDoor />

      {/* Billboard on posts above the back wall: TechDealz wants to be seen. */}
      {[TDZ_BILLBOARD.x - 1.3, TDZ_BILLBOARD.x + 1.3].map((x) => (
        <RoundedBox key={x} args={[0.1, 1.0, 0.1]} radius={0.03} smoothness={2} position={[x, SOURCE_WALL + 0.45, TDZ_BILLBOARD.z - 0.06]} material={metal(PALETTE.steelDark, 0.35)} castShadow />
      ))}
      <Sign
        position={[TDZ_BILLBOARD.x, TDZ_BILLBOARD.y + TDZ_BILLBOARD.h / 2, TDZ_BILLBOARD.z]}
        width={TDZ_BILLBOARD.w}
        height={TDZ_BILLBOARD.h}
        text="TechDealz"
        sub="ONLINE"
        color={PALETTE.tdzInk}
        ink={PALETTE.tdzYellow}
        mark={drawTdzMark}
      />

      {/* The store's servers either side of the port its payments leave by. */}
      {[3.05, 3.68, 5.52, 6.15].map((x) => (
        <ServerRack key={x} position={[x, 0, WAREHOUSE.z0 + 0.5]} rotation-y={-Math.PI / 2} />
      ))}

      <WorkTable position={[4.6, 0, 6.35]} size={[1.9, 0.85, 0.92]} />
      <CartonStack position={[4.25, 0.95, 6.35]} rows={1} cols={1} layers={1} pallet={false} size={[0.42, 0.3, 0.5]} seed={3} />
      <CartonStack position={[5.15, 0.95, 6.3]} rows={1} cols={1} layers={1} pallet={false} size={[0.36, 0.24, 0.4]} seed={4} />
      <CartonStack position={[2.85, 0, 5.3]} rotation-y={Math.PI / 2} rows={2} cols={2} layers={2} seed={6} />
      <CartonStack position={[2.85, 0, 6.55]} rotation-y={Math.PI / 2} rows={2} cols={2} layers={1} count={3} seed={8} />

      {people && <Person position={[4.6, 0, 5.55]} rotation-y={-Math.PI / 2} pose="inspect" outfit="packer" vest seed={71} skin={2} />}
    </group>
  );
}
