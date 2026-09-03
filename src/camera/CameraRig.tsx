import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { LINE_END_X, LINE_START_X } from '@/scene/constants';
import { SHOTS, TOTAL_CINEMATIC_DURATION } from './waypoints';

const DAMP_SPEED = 0.9;

function smoothstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Plays the scripted intro once, then hands off to free orbit. Driven by
 * wall-clock delta (clamped) rather than tied to any simulation state, so
 * it can't hang or desync regardless of render performance. */
export function CameraRig() {
  const { camera } = useThree();
  const [cinematicDone, setCinematicDone] = useState(false);
  const elapsedRef = useRef(0);
  const currentPos = useRef(new THREE.Vector3().copy(SHOTS[0].startPos));
  const currentLookAt = useRef(new THREE.Vector3().copy(SHOTS[0].startLookAt));

  useFrame((_, rawDelta) => {
    if (cinematicDone) return;
    const delta = Math.min(rawDelta, 0.1);
    elapsedRef.current += delta;
    const t = elapsedRef.current;

    let acc = 0;
    let shot = SHOTS[SHOTS.length - 1];
    let localT = 1;
    for (let i = 0; i < SHOTS.length; i++) {
      const d = SHOTS[i].duration;
      if (t < acc + d || i === SHOTS.length - 1) {
        shot = SHOTS[i];
        localT = THREE.MathUtils.clamp((t - acc) / d, 0, 1);
        break;
      }
      acc += d;
    }

    const idealPos = new THREE.Vector3().lerpVectors(shot.startPos, shot.endPos, smoothstep(localT));
    const idealLookAt = new THREE.Vector3().lerpVectors(shot.startLookAt, shot.endLookAt, smoothstep(localT));

    const alpha = 1 - Math.exp(-delta * DAMP_SPEED * 3);
    currentPos.current.lerp(idealPos, alpha);
    currentLookAt.current.lerp(idealLookAt, alpha);
    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);

    if (t >= TOTAL_CINEMATIC_DURATION) setCinematicDone(true);
  });

  if (!cinematicDone) return null;
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      // Was 80 — back when the scene still had fog, that was miles past its
      // far distance (fully opaque from there on), so scrolling all the way
      // out washed the whole line into a blank fog-colored screen. Fog's
      // gone now (Scene.tsx), but 40 stays: past it the line is just a small
      // shape in the middle of a mostly-empty frame, no longer a useful
      // amount of zoom regardless of what's technically visible.
      maxDistance={40}
      maxPolarAngle={Math.PI / 2 - 0.02}
      target={[(LINE_START_X + LINE_END_X) / 2, 0.8, 0]}
    />
  );
}
