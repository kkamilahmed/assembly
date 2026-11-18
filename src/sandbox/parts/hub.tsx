// Close-up of the processing hub: scanner, quarantine, analysts.
import { Hub } from '@/scene/buildings/Hub';
import { Rails } from '@/scene/buildings/Rails';
import { Live } from '@/scene/Live';

export const view = { target: [-3.4, 0.8, -4.0] as [number, number, number], zoom: 90 };

export default function HubPart() {
  return (
    <group>
      <Rails />
      <Hub />
      <Live />
    </group>
  );
}
