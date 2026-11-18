import { Atm } from './buildings/Atm';
import { Cafe } from './buildings/Cafe';
import { Hub } from './buildings/Hub';
import { Mall } from './buildings/Mall';
import { Rails } from './buildings/Rails';
import { Vault } from './buildings/Vault';
import { Warehouse } from './buildings/Warehouse';

/** Every building on the block and the lanes between them, with the people
 *  who work and shop in them. Static apart from the people, so it lives in
 *  the scene's batch; what changes with the stream is in Live. */
export function City() {
  return (
    <group>
      <Rails />
      <Hub />
      <Vault />
      <Cafe />
      <Atm />
      <Mall />
      <Warehouse />
    </group>
  );
}
