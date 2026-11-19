import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo } from 'react';
import { WhitePointEffect } from './WhitePoint';

/** Studio finish for the illustration look: ambient occlusion that pools in
 *  every corner and under every prop (the single biggest cue in the
 *  references), a tight bloom that only catches self-lit surfaces like the
 *  laser flashes, SMAA for crisp bevels, and Khronos PBR Neutral tone mapping, which is
 *  made for product renders: the seamless white background stays white
 *  (AgX and ACES both pull it down to grey) and colours keep their hue. */
export function PostFX() {
  // Background 1.3 lands at about 0.926 after Neutral tone mapping.
  const whitePoint = useMemo(() => new WhitePointEffect(0.925), []);
  // No separate normal pass: N8AO reconstructs normals from depth, and a
  // normal pass re-renders the whole scene a second time.
  return (
    <EffectComposer multisampling={0}>
      <N8AO quality="high" aoRadius={1.5} intensity={3.2} distanceFalloff={0.6} denoiseSamples={8} color="black" />
      <Bloom luminanceThreshold={1.6} luminanceSmoothing={0.25} intensity={0.7} mipmapBlur />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <primitive object={whitePoint} />
    </EffectComposer>
  );
}
