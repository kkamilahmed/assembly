// The globe and everything on it, turned by a slow drift that rests on the
// Americas and the Atlantic, and by the presenter's mouse.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Flights } from './Flights';
import { DEG, REST_VIEW } from './geo';
import { GlobeBody } from './GlobeBody';
import { Markers } from './Markers';

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** After a drag, how long the globe waits before drifting home. */
const SETTLE_AFTER_MS = 3500;

export function Globe({ interactive = true }: { interactive?: boolean }) {
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const view = useRef<{ lon: number; tilt: number; touchedAt: number }>({ lon: REST_VIEW.lon - 30, tilt: REST_VIEW.tilt, touchedAt: -Infinity });
  const get = useThree((s) => s.get);

  // Drag to turn: left-right turns the world, up-down tilts it.
  useEffect(() => {
    if (!interactive) return;
    const dom = get().gl.domElement;
    let drag: { x: number; y: number; lon: number; tilt: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, lon: view.current.lon, tilt: view.current.tilt };
      dom.setPointerCapture(e.pointerId);
      dom.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      view.current.lon = drag.lon - (e.clientX - drag.x) * 0.25;
      view.current.tilt = THREE.MathUtils.clamp(drag.tilt + (e.clientY - drag.y) * 0.2, -40, 70);
      view.current.touchedAt = performance.now();
    };
    const up = () => {
      drag = null;
      dom.style.cursor = 'grab';
    };
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', move);
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    return () => {
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', move);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('pointercancel', up);
    };
  }, [get, interactive]);

  useFrame(({ clock }, delta) => {
    const v = view.current;
    const idle = performance.now() - v.touchedAt > SETTLE_AFTER_MS;
    if (idle) {
      // Drift gently around the resting view; ease back to it after a drag.
      const target = REDUCED ? REST_VIEW.lon : REST_VIEW.lon + 9 * Math.sin(clock.elapsedTime / 14);
      const k = REDUCED ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 0.6);
      v.lon += (target - v.lon) * k;
      v.tilt += (REST_VIEW.tilt - v.tilt) * k;
    }
    if (tiltRef.current) tiltRef.current.rotation.x = v.tilt * DEG;
    if (spinRef.current) spinRef.current.rotation.y = -v.lon * DEG;
  });

  return (
    <group ref={tiltRef}>
      <group ref={spinRef}>
        <GlobeBody />
        <Flights />
        <Markers />
      </group>
    </group>
  );
}
