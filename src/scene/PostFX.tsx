import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/** Clean studio finish: soft contact AO for grounding, a hair of vignette to
 *  draw the eye to the line, SMAA for crisp edges, and ACES tone mapping last
 *  so the whole image rolls off into believable highlights. No bloom, no
 *  noise — the weld spark reads through its own emissive material + point
 *  light, kept clean. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      {/* No `halfRes`, a smaller `aoRadius`, and more `denoiseSamples` than
          this started with. On the long, dark, low-detail conveyor belt
          viewed down its length at a shallow angle, the half-res AO buffer's
          upsample step plus a radius (1.4) that sampled far outside the
          belt's local depth variation produced a visible blocky, jagged
          patch of "un-occluded" pixels sitting on the belt — worse the
          further down the line it was. Full res + a tighter radius that
          actually matches the scale of nearby geometry (car panel gaps,
          robot pedestals) + more denoise samples to compensate is what
          actually got rid of it while keeping the contact-shadow grounding. */}
      <N8AO
        quality="medium"
        aoRadius={0.7}
        intensity={1.6}
        distanceFalloff={0.6}
        denoiseSamples={8}
        color="black"
      />
      <Vignette offset={0.4} darkness={0.28} />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
