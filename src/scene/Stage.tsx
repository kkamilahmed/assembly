import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, MapControls, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ISO_DIR } from './layout';
import { PostFX } from './PostFX';


/**
 * The studio every part of the block is rendered in: seamless white, a true
 * isometric orthographic camera, a soft key light with long contact shadows,
 * and a code-built light rig for reflections (no HDRI fetched at runtime).
 *
 * `target` and `zoom` frame the shot; `shadowSize` is the half-extent of the
 * key light's shadow box in world units.
 */
export function Stage({
  children,
  target = [0, 0, 0],
  zoom = 40,
  shadowSize = 22,
  active = true,
  controls = false,
  onCreated,
}: {
  children: ReactNode;
  target?: [number, number, number];
  zoom?: number;
  shadowSize?: number;
  active?: boolean;
  /** Pan and zoom, never rotate: the isometric angle is the look. */
  controls?: boolean;
  onCreated?: (gl: THREE.WebGLRenderer, scene: THREE.Scene) => void;
}) {
  const [tx, ty, tz] = target;
  const t = useMemo(() => new THREE.Vector3(tx, ty, tz), [tx, ty, tz]);
  const camPos = useMemo(() => t.clone().addScaledVector(ISO_DIR, 60), [t]);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      shadows={{ type: THREE.PCFShadowMap }}
      // Capped at 1.5: on a retina laptop 2x quadruples the pixels every
      // post-processing pass has to touch, for a difference nobody can see
      // on a projector.
      dpr={[1, 1.5]}
      gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }}
      onCreated={({ gl, scene }) => onCreated?.(gl, scene)}
    >
      {/* Slightly over 1.0 in linear light: tone mapping rolls a plain
          white off to light grey. PostFX's white point finishes the job;
          this stays under the bloom threshold so it never haloes. */}
      <color attach="background" args={[1.3, 1.3, 1.3]} />
      <FitZoom zoom={zoom} />
      <ThrottledShadows />
      <OrthographicCamera
        makeDefault
        position={camPos.toArray()}
        zoom={zoom}
        near={1}
        far={200}
        onUpdate={(c) => c.lookAt(t)}
      />

      <hemisphereLight args={['#ffffff', '#b9bdc6', 0.42]} />
      {/* Key: high and from the camera's left, so shadows fall to the
          lower right like the references. */}
      <directionalLight
        position={[t.x - 14, t.y + 30, t.z + 10]}
        intensity={3.1}
        color="#fffaf3"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        shadow-radius={3.5}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-shadowSize, shadowSize, shadowSize, -shadowSize, 1, 90]}
        />
      </directionalLight>
      {/* Cool fill from the other side so shadow sides never go dead. */}
      <directionalLight position={[t.x + 18, t.y + 10, t.z - 12]} intensity={0.45} color="#dfe8ff" />

      <Environment resolution={256} background={false} environmentIntensity={0.9}>
        {/* A light studio cyc all round, so stainless reflects a bright
            room rather than a black void. */}
        <color attach="background" args={['#8d939c']} />
        <Lightformer form="rect" intensity={3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        {/* Long thin strips: the streaked highlights that read as brushed
            stainless instead of flat grey paint. */}
        <Lightformer form="rect" intensity={4} position={[0, 6, -10]} scale={[30, 0.6, 1]} />
        <Lightformer form="rect" intensity={4} position={[-10, 6, 0]} rotation-y={Math.PI / 2} scale={[30, 0.6, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[0, 2.5, -10]} scale={[30, 0.3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-10, 4, 6]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[10, 4, -6]} rotation-y={-Math.PI / 2} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffd9b0" position={[0, 3, 12]} scale={[16, 4, 1]} />
      </Environment>

      {controls && (
        <MapControls
          makeDefault
          target={t}
          enableRotate={false}
          enableDamping
          dampingFactor={0.12}
          minZoom={zoom * 0.7}
          maxZoom={zoom * 3.5}
          screenSpacePanning
        />
      )}
      {children}
      <PostFX />
    </Canvas>
  );
}

/** Shots are composed at this canvas height; a smaller canvas (the network
 *  view beside the sidebar) scales the zoom down so it shows the same
 *  framing instead of a tighter crop. */
const DESIGN_HEIGHT = 990;

/** Re-render the shadow map every other frame instead of every frame. Almost
 *  everything on the block is static and what moves (packets, people) moves
 *  slowly, so the difference is invisible while the shadow pass, a full
 *  redraw of the scene, costs half as much. */
function ThrottledShadows() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    get().gl.shadowMap.autoUpdate = false;
    get().gl.shadowMap.needsUpdate = true;
  }, [get]);
  const flip = useRef(false);
  useFrame(() => {
    flip.current = !flip.current;
    if (flip.current) get().gl.shadowMap.needsUpdate = true;
  });
  return null;
}

function FitZoom({ zoom }: { zoom: number }) {
  const get = useThree((s) => s.get);
  const height = useThree((s) => s.size.height);
  const controls = useThree((s) => s.controls);
  useEffect(() => {
    const { camera } = get();
    camera.zoom = (zoom * height) / DESIGN_HEIGHT;
    camera.updateProjectionMatrix();
  }, [get, zoom, height, controls]);
  return null;
}

/** The white yard floor every off-slab prop stands on: invisible itself,
 *  it only catches shadows, so the seamless white background stays
 *  seamless. */
export function ShadowFloor({ size = 120, y = 0 }: { size?: number; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y + 0.001, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <shadowMaterial transparent opacity={0.3} />
    </mesh>
  );
}
