import { useMemo } from 'react';
import * as THREE from 'three';
import { LAND_DOTS } from './landDots';
import { latLon } from './geo';

export const OCEAN = '#0d2346';

/** The ocean sphere: deep blue, with its edge brightened toward the light
 *  so the ball reads round against the white page. */
function Ocean() {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: OCEAN, roughness: 0.62, metalness: 0.08 });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rim = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += vec3(0.16, 0.32, 0.62) * pow(rim, 3.0) * 0.9;`,
      );
    };
    return m;
  }, []);
  return (
    <mesh material={material}>
      <sphereGeometry args={[1, 96, 64]} />
    </mesh>
  );
}

/** A soft blue haze just outside the limb. */
function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: { color: { value: new THREE.Color('#5d93e8') } },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 color;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float f = clamp(dot(-vNormal, vView), 0.0, 1.0);
            float a = pow(f, 2.6) * 0.7;
            gl_FragColor = vec4(color, a);
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} scale={1.12}>
      <sphereGeometry args={[1, 64, 48]} />
    </mesh>
  );
}

/** Land as a fine grid of lit dots, one instanced draw. */
function LandDots() {
  const mesh = useMemo(() => {
    const n = LAND_DOTS.length / 2;
    const geometry = new THREE.CircleGeometry(0.0043, 6);
    const material = new THREE.MeshBasicMaterial({ color: '#9dbcf0' });
    const m = new THREE.InstancedMesh(geometry, material, n);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const z = new THREE.Vector3(0, 0, 1);
    const one = new THREE.Vector3(1, 1, 1);
    const mat = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      latLon(LAND_DOTS[i * 2], LAND_DOTS[i * 2 + 1], 1.0015, p);
      q.setFromUnitVectors(z, p.clone().normalize());
      m.setMatrixAt(i, mat.compose(p, q, one));
    }
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, []);
  return <primitive object={mesh} />;
}

export function GlobeBody() {
  return (
    <group>
      <Ocean />
      <LandDots />
      <Atmosphere />
    </group>
  );
}
