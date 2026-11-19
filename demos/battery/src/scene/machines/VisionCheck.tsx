import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { BELT_WIDTH, BELT_Y } from '../layout';
import { glass, glow, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { additive, Kit, spillTexture, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

const COL_Z = 0.84;
const BEAM_Y = 2.03;
const BAR_X = 0.17;
const BAR_Y = 1.82;

const BLUE = new THREE.Color(PALETTE.blue);

type Lit = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

/** A sheet of light from a bar down to the belt, bright at the bar. */
function curtainGeometry(sx: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const top = BAR_Y - 0.01;
  const bottom = BELT_Y + 0.015;
  const pos = [sx * BAR_X, top, -0.6, sx * BAR_X, top, 0.6, sx * 0.05, bottom, -BELT_WIDTH / 2, sx * 0.05, bottom, BELT_WIDTH / 2];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

/**
 * Weld check: an arch over the belt with three cameras that image every
 * busbar weld (seam width and penetration depth) to estimate its pull
 * strength, lit by two blue light bars. Local frame: origin on the floor
 * under the belt centreline, belt along +x at BELT_Y. The operator panel
 * hangs on the -z column and faces -z; place it so that side faces the
 * camera.
 *
 * `scanning` lights the bars and sweeps a scan line over the belt.
 */
export function VisionCheck({
  scanning = true,
  severity = 'healthy',
  ...props
}: { scanning?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const lensBarrel = metal(PALETTE.steelDark, 0.3);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.offWhite);
    const blue = plastic(PALETTE.blue);

    // Columns on bolted base plates.
    for (const sz of [1, -1]) {
      const z = sz * COL_Z;
      k.box(steel, [0.34, 0.03, 0.34], [0, 0.015, z], 0.01);
      for (const a of [1, -1]) for (const b of [1, -1]) k.bolt(bright, [a * 0.125, 0.036, z + b * 0.125], 'y');
      k.box(steel, [0.15, 1.9, 0.15], [0, 0.97, z], 0.035);
      k.box(steel, [0.24, 0.1, 0.24], [0, 0.09, z], 0.03);
      // Tinted side shrouds that keep stray light off the cameras.
      const zs = sz * (COL_Z - 0.1);
      k.add(glass(), new THREE.PlaneGeometry(0.44, 0.72), [0, 1.52, zs]);
      for (const sx of [1, -1]) k.box(steel, [0.025, 0.74, 0.025], [sx * 0.22, 1.52, zs], 0.008);
      k.box(steel, [0.465, 0.025, 0.025], [0, 1.15, zs], 0.008);
    }

    // Beam enclosure with a blue band, and its roof-top controller.
    k.box(white, [0.48, 0.3, COL_Z * 2 + 0.3], [0, BEAM_Y, 0], 0.07);
    k.box(blue, [0.488, 0.06, COL_Z * 2 + 0.12], [0, BEAM_Y - 0.04, 0], 0.02);
    k.box(steel, [0.3, 0.08, 0.5], [0, BEAM_Y + 0.185, 0.36], 0.025);
    for (let j = 0; j < 5; j++) k.box(dark, [0.2, 0.012, 0.025], [0, BEAM_Y + 0.226, 0.2 + j * 0.07], 0.004);
    k.tube(dark, [[0.1, BEAM_Y + 0.165, 0.12], [0.1, BEAM_Y + 0.165, -0.62]], 0.018);
    k.cyl(dark, 0.03, 0.03, [0.1, BEAM_Y + 0.165, -0.62], 'z', 0.008, 0.03, 10);

    // Light bars and the camera rail under the beam.
    for (const sx of [1, -1]) k.box(dark, [0.075, 0.07, 1.34], [sx * BAR_X, BAR_Y + 0.03, 0], 0.02);
    k.box(steel, [0.06, 0.04, 1.44], [0, BEAM_Y - 0.17, 0], 0.012);
    for (const z of [-0.34, 0, 0.34]) {
      k.cyl(steel, 0.02, 0.14, [0, 1.8, z], 'y', 0.004, 0.02, 10);
      k.box(dark, [0.16, 0.18, 0.16], [0, 1.65, z], 0.035);
      k.box(blue, [0.165, 0.03, 0.165], [0, 1.7, z], 0.012);
      k.cyl(lensBarrel, 0.058, 0.12, [0, 1.51, z], 'y', 0.012);
      k.cyl(bright, 0.064, 0.022, [0, 1.47, z], 'y', 0.008);
      k.cyl(glow(PALETTE.blue, 2), 0.04, 0.008, [0, 1.449, z], 'y', 0.002);
    }

    // Photo-eye just upstream that triggers the cameras, with its reflector.
    k.box(steel, [0.03, 0.34, 0.03], [-0.5, 0.97, -0.63], 0.01);
    k.box(blue, [0.075, 0.09, 0.07], [-0.5, 1.1, -0.61], 0.018);
    k.box(steel, [0.03, 0.34, 0.03], [-0.5, 0.97, 0.63], 0.01);
    k.box(plastic(PALETTE.amber), [0.06, 0.07, 0.02], [-0.5, 1.1, 0.61], 0.008);

    // Arm for the operator panel.
    k.box(steel, [0.06, 0.06, 0.12], [0, 1.32, -COL_Z - 0.12], 0.014);
    return k.build();
  }, []);
  useDispose(pieces);

  const fx = useMemo(
    () => ({
      curtains: [curtainGeometry(1), curtainGeometry(-1)],
      curtain: additive(BLUE, spillTexture()),
      pool: additive(BLUE, spillTexture()),
      line: additive(BLUE),
      bar: new THREE.MeshStandardMaterial({ color: PALETTE.blue, emissive: BLUE, emissiveIntensity: 3, roughness: 0.4, toneMapped: false }),
    }),
    [],
  );

  const level = useRef(scanning ? 1 : 0);
  const curtainRef = useRef<Lit>(null);
  const poolRef = useRef<Lit>(null);
  const lineRef = useRef<Lit>(null);
  const barRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, dt) => {
    level.current = THREE.MathUtils.damp(level.current, scanning ? 1 : 0, 6, Math.min(dt, 0.1));
    const v = level.current;
    const t = clock.elapsedTime;
    const pulse = 0.9 + 0.1 * Math.sin(t * 5);
    if (curtainRef.current) curtainRef.current.material.color.copy(BLUE).multiplyScalar(0.28 * v * pulse);
    if (poolRef.current) poolRef.current.material.color.copy(BLUE).multiplyScalar(0.5 * v * pulse);
    if (barRef.current) barRef.current.material.emissiveIntensity = 0.5 + 2.8 * v * pulse;
    if (lightRef.current) lightRef.current.intensity = 3 * v;
    if (lineRef.current) {
      lineRef.current.material.color.copy(BLUE).multiplyScalar(1.6 * v);
      lineRef.current.position.x = Math.sin(t * 3.2) * 0.2;
    }
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      {[1, -1].map((sx, i) => (
        <group key={sx}>
          <mesh ref={i === 0 ? barRef : undefined} material={fx.bar} position={[sx * BAR_X, BAR_Y - 0.008, 0]}>
            <boxGeometry args={[0.045, 0.012, 1.24]} />
          </mesh>
          <mesh ref={i === 0 ? curtainRef : undefined} geometry={fx.curtains[i]} material={fx.curtain} />
          {/* Pool of light on the belt, fading away from the scan zone. */}
          <mesh
            ref={i === 0 ? poolRef : undefined}
            material={fx.pool}
            position={[sx * 0.3, BELT_Y + 0.012, 0]}
            rotation={[-Math.PI / 2, 0, sx > 0 ? 0 : Math.PI]}
          >
            <planeGeometry args={[0.6, BELT_WIDTH - 0.02]} />
          </mesh>
        </group>
      ))}
      <mesh ref={lineRef} material={fx.line} position={[0, BELT_Y + 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.035, BELT_WIDTH - 0.04]} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1.4, 0]} color={PALETTE.blue} intensity={3} distance={2.6} decay={1.8} />
      <ControlBox kind="vision" accent={PALETTE.blue} width={0.52} height={0.5} position={[0, 1.32, -COL_Z - 0.26]} rotation={[0, Math.PI, 0]} />
      <Andon severity={severity} position={[0, BEAM_Y + 0.15, -COL_Z + 0.05]} />
    </group>
  );
}
