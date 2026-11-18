import { LINE_END_X, LINE_START_X } from './constants';

/** Cool, bright industrial-overhead lighting - a real body-shop floor is lit
 *  by banks of neutral/cool-white high-bay fixtures, not a warm tungsten
 *  key, so the key light here is near-neutral with a faint cool cast rather
 *  than amber. The HDRI Environment in Scene.tsx carries the ambient/
 *  reflection load, so this rig doesn't need a flat ambient wash on top of
 *  it (that was the old source of "everything is the same brightness"
 *  flatness) - just a strong raking key for grounded, defined shadows, a
 *  cool sky/neutral-ground hemisphere for fill, and a low cool rim from the
 *  opposite side so the shadow side of the robots/cars doesn't go dead
 *  flat. The shadow camera is sized to cover the whole line at real-world
 *  (metre) scale. */
export function Lighting() {
  const midX = (LINE_START_X + LINE_END_X) / 2;
  return (
    <>
      <hemisphereLight args={['#eef3ff', '#5a5e64', 0.22]} />
      <directionalLight
        position={[midX, 15, 9]}
        intensity={1.4}
        color="#f4f8ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
        shadow-normalBias={0.04}
        shadow-radius={3}
      >
        <orthographicCamera attach="shadow-camera" args={[-18, 18, 14, -14, 0.1, 40]} />
      </directionalLight>
      <directionalLight position={[midX - 12, 7, -11]} intensity={0.35} color="#bcd4ff" />
    </>
  );
}
