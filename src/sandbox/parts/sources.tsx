// The four sources in a row, as the sources screen frames them.
import { SOURCE_IDS } from '@/streaming/networkConfig';
import { SourceModel } from '@/scene/SourceModel';

export const view = { target: [0, 1, 0] as [number, number, number], zoom: 70 };

export default function Sources() {
  return (
    <group>
      {SOURCE_IDS.map((id, i) => (
        <group key={id} position={[(i - 1.5) * 4.2, 0, -(i - 1.5) * 4.2]}>
          <SourceModel sourceId={id} />
        </group>
      ))}
    </group>
  );
}
