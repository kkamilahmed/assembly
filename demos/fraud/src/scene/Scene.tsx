import { Globe } from './globe/Globe';
import { GlobeStage } from './globe/GlobeStage';

/** The network screen's 3D view: the globe, its flights and its places. */
export function Scene({ active, interactive = true }: { active: boolean; interactive?: boolean }) {
  return (
    <GlobeStage active={active}>
      <Globe interactive={interactive} />
    </GlobeStage>
  );
}
