import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/** Studio finish for the illustration look: ambient occlusion that pools in
 *  every corner and under every prop (the single biggest cue in the
 *  references), a tight bloom that only catches self-lit surfaces like the
 *  oven mouths, SMAA for crisp bevels, and Khronos PBR Neutral tone mapping, which is
 *  made for product renders: the seamless white background stays white
 *  (AgX and ACES both pull it down to grey) and colours keep their hue. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <N8AO quality="high" aoRadius={1.5} intensity={3.2} distanceFalloff={0.6} denoiseSamples={8} color="black" />
      <Bloom luminanceThreshold={1.6} luminanceSmoothing={0.25} intensity={0.7} mipmapBlur />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
