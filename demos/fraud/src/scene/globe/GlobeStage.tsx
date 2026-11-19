import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo } from 'react';
import * as THREE from 'three';
import { WhitePointEffect } from '../WhitePoint';

/** The studio the globe is shown in: seamless white, a soft key light from
 *  the upper left, and the same finish as the rest of the app (Neutral tone
 *  mapping, a white point, a tight bloom that only catches the lit flight
 *  heads and pins). */
export function GlobeStage({ children, active = true }: { children: ReactNode; active?: boolean }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
      camera={{ fov: 30, position: [0, 0.05, 5.6], near: 0.1, far: 50 }}
      onCreated={({ gl, scene }) => {
        if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene });
      }}
    >
      <color attach="background" args={[1.3, 1.3, 1.3]} />
      <hemisphereLight args={['#ffffff', '#9fb0cc', 0.9]} />
      <directionalLight position={[-4, 3, 5]} intensity={2.4} color="#fffaf3" />
      <directionalLight position={[5, -2, -3]} intensity={0.5} color="#cfe0ff" />
      {children}
      <Finish />
    </Canvas>
  );
}

function Finish() {
  const whitePoint = useMemo(() => new WhitePointEffect(0.925), []);
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={1.5} luminanceSmoothing={0.2} intensity={0.9} mipmapBlur />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <primitive object={whitePoint} />
    </EffectComposer>
  );
}
