import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MAX_ORBIT_DISTANCE, SETTLE_LOOK_AT, SETTLE_POS, SHOTS, TOTAL_CINEMATIC_DURATION } from './waypoints';

const DAMP_SPEED = 0.9;

function smoothstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Plays the scripted intro once, then hands off to free orbit.
 *
 * Progress is read from the wall clock, NOT accumulated from per-frame
 * deltas. It used to sum `Math.min(rawDelta, 0.1)` each frame, which meant
 * the clamp silently turned into slow motion the moment the renderer
 * dropped below 10fps: on a software-GL machine, 14 seconds of wall clock
 * advanced an 11-second cinematic by about 1.4 seconds, so the intro was
 * still on its opening shot and never handed off to OrbitControls. On a
 * presenter's laptop driving an unfamiliar projector that is the difference
 * between an 11-second intro and a minute of the camera crawling while
 * nothing is interactive. Wall clock makes the intro take exactly as long
 * as it says it does, whatever the frame rate; a slow machine gets a
 * choppier version of the same move rather than a longer one. */
export function CameraRig() {
  const { camera } = useThree();
  const [cinematicDone, setCinematicDone] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const currentPos = useRef(new THREE.Vector3().copy(SHOTS[0].startPos));
  const currentLookAt = useRef(new THREE.Vector3().copy(SHOTS[0].startLookAt));

  useFrame((_, rawDelta) => {
    if (cinematicDone) return;
    if (startedAtRef.current === null) startedAtRef.current = performance.now();
    const t = (performance.now() - startedAtRef.current) / 1000;
    // Still clamped, but only for the damping term below — a single long
    // frame should not be allowed to snap the smoothing all the way to its
    // target, which would show up as a visible jolt.
    const delta = Math.min(rawDelta, 0.1);

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

    if (t >= TOTAL_CINEMATIC_DURATION) {
      // Land on the intended framing exactly, rather than wherever the
      // damping happened to have got to. The smoothing lags its target by
      // roughly velocity x its time constant, and that lag is never repaid
      // because control hands over immediately — on a slow renderer the
      // camera was stopping ~9m short of the settle shot, so the framing
      // OrbitControls inherited depended on the frame rate. Snapping here
      // costs nothing visually (the ideal is already within a frame or two
      // of this point at any usable frame rate) and makes the hand-off
      // deterministic.
      camera.position.copy(SETTLE_POS);
      camera.lookAt(SETTLE_LOOK_AT);
      setCinematicDone(true);
    }
  });

  if (!cinematicDone) return null;
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      // Derived from the settle shot rather than hardcoded, so the handoff
      // framing is always comfortably inside the orbit range with room to
      // pull back — a fixed 40 used to sit almost exactly on top of it.
      maxDistance={MAX_ORBIT_DISTANCE}
      maxPolarAngle={Math.PI / 2 - 0.02}
      // Same point the cinematic ends on, so taking over doesn't re-aim
      // the camera a metre sideways the instant control hands over.
      target={[SETTLE_LOOK_AT.x, SETTLE_LOOK_AT.y, SETTLE_LOOK_AT.z]}
    />
  );
}
