import { Effect } from 'postprocessing';
import * as THREE from 'three';

const fragment = /* glsl */ `
uniform float whitePoint;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(min(inputColor.rgb / whitePoint, vec3(1.0)), inputColor.a);
}
`;

/**
 * Levels for the whole frame, after tone mapping: whatever the tone curve
 * leaves at `whitePoint` (linear) becomes pure white. The references are
 * high-key product renders on true white, and every tone curve rolls a
 * white background off to light grey; lifting the background itself past
 * 1.0 instead pushes it over the bloom threshold and haloes everything.
 */
export class WhitePointEffect extends Effect {
  constructor(whitePoint = 0.92) {
    super('WhitePointEffect', fragment, {
      uniforms: new Map([['whitePoint', new THREE.Uniform(whitePoint)]]),
    });
  }
}
