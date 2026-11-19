// The bare globe: ocean, land dots and atmosphere, resting on the Americas.
import { DEG, REST_VIEW } from '@/scene/globe/geo';
import { GlobeBody } from '@/scene/globe/GlobeBody';

export default function Body() {
  return (
    <group rotation-x={REST_VIEW.tilt * DEG}>
      <group rotation-y={-REST_VIEW.lon * DEG}>
        <GlobeBody />
      </group>
    </group>
  );
}
