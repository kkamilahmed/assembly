import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { MODULE_INTERVAL_MS } from '@/streaming/lineConfig';
import { BELT_WIDTH, BELT_Y, MACHINE_POS } from '../layout';
import { matte, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { ControlBox } from './ControlBox';
import { additive, haloTexture, Kit, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces } from './Pieces';

const DEFAULT_LENGTH = MACHINE_POS.welderStart.distanceTo(MACHINE_POS.welderEnd);
/** Half-depth of the enclosure across the belt. */
const HZ = 0.95;
const H = 2.25;
/** Top of the solid lower skirt; glass above. */
const SKIRT = 0.72;
const POST = 0.085;
/** Gantry rail height and the weld height (top of an open module). */
const RAIL_Y = 1.92;
const WELD_Y = BELT_Y + 0.33;
/** Tip of the head's nozzle. */
const NOZZLE_Y = RAIL_Y + 0.06 - 0.61;
/** The head's travel per module, along the belt. */
const STROKE = 0.5;

const HOT = new THREE.Color('#d8ecff');
const WEAK = new THREE.Color('#ff9a3c');
const _c = new THREE.Color();

/** Laser-safety glazing: a faint green tint, so it reads as a guard rather
 *  than an opening. */
let guardGlass: THREE.MeshPhysicalMaterial | undefined;
function laserGlass(): THREE.MeshPhysicalMaterial {
  guardGlass ??= new THREE.MeshPhysicalMaterial({
    color: '#9fd0bb',
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return guardGlass;
}

type Lit = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

/**
 * Laser welder, the hero machine: a glazed safety cell with orange posts
 * around a gantry-mounted fibre-laser head that welds the busbars onto each
 * module as it passes. Local frame: origin on the floor at the centre of the
 * cell, belt running through along +x at BELT_Y, operator side (control
 * panel) on +z. The conveyor is not part of the welder.
 *
 * `power` is the delivered laser power as a share of its setpoint: 1 is a
 * clean weld, a bright blue-white flash; as it falls the flash dims, warms
 * toward orange and stutters. `running` moves the head and fires the laser.
 * `severity` drives the stack light.
 */
export function LaserWelder({
  length = DEFAULT_LENGTH,
  power = 1,
  severity = 'healthy',
  running = true,
  ...props
}: {
  length?: number;
  power?: number;
  severity?: Severity;
  running?: boolean;
} & ThreeElements['group']) {
  const L = length;

  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const orange = plastic(PALETTE.orange, 0.3);
    const amber = plastic(PALETTE.amber);
    const pane = laserGlass();

    // Plinth.
    k.box(dark, [L, 0.08, HZ * 2], [0, 0.04, 0], 0.02);
    // Posts: corners and one mid bay on each long side.
    const xs = [-L / 2, 0, L / 2];
    for (const x of xs) {
      for (const sz of [1, -1]) {
        k.box(orange, [POST, H - 0.08, POST], [x, 0.08 + (H - 0.08) / 2, sz * HZ], 0.02);
        k.box(steel, [0.18, 0.02, 0.18], [x, 0.09, sz * HZ], 0.006);
      }
    }
    // Top frame.
    for (const sz of [1, -1]) k.box(orange, [L + POST, POST, POST], [0, H, sz * HZ], 0.02);
    for (const x of xs) k.box(orange, [POST, POST, HZ * 2], [x, H, 0], 0.02);
    // Mid rail where the skirt meets the glass.
    for (const sz of [1, -1]) k.box(orange, [L, 0.05, 0.05], [0, SKIRT, sz * HZ], 0.012);

    // Solid skirts on the long sides, glass above. The ends are glazed too,
    // with a tunnel cut for the belt.
    for (const sz of [1, -1]) {
      for (const sx of [1, -1]) {
        const cx = (sx * L) / 4;
        const w = L / 2 - POST;
        k.box(white, [w, SKIRT - 0.12, 0.03], [cx, 0.08 + (SKIRT - 0.12) / 2 + 0.02, sz * HZ], 0.012);
        k.add(pane, new THREE.PlaneGeometry(w, H - SKIRT - 0.08), [cx, (SKIRT + H) / 2, sz * HZ]);
      }
    }
    // Laser warning plates on the operator side.
    for (const sx of [1, -1]) {
      k.box(amber, [0.24, 0.2, 0.012], [(sx * L) / 4, SKIRT - 0.26, HZ + 0.02], 0.01);
      k.box(dark, [0.16, 0.035, 0.014], [(sx * L) / 4, SKIRT - 0.26, HZ + 0.024], 0.006);
    }
    const tunnelTop = BELT_Y + 0.55;
    const tunnelHalf = BELT_WIDTH / 2 + 0.12;
    for (const sx of [1, -1]) {
      const x = (sx * L) / 2;
      const side = HZ - tunnelHalf;
      for (const sz of [1, -1]) {
        k.box(white, [0.03, tunnelTop - 0.08, side], [x, 0.08 + (tunnelTop - 0.08) / 2, sz * (tunnelHalf + side / 2)], 0.01);
      }
      k.add(pane, new THREE.PlaneGeometry(HZ * 2 - POST, H - tunnelTop - 0.05), [x, (tunnelTop + H) / 2, 0], [0, Math.PI / 2, 0]);
      // Tunnel frame and the dark brush curtain over the belt.
      k.box(orange, [0.06, 0.05, tunnelHalf * 2 + 0.06], [x, tunnelTop, 0], 0.012);
      for (const sz of [1, -1]) k.box(orange, [0.06, tunnelTop - 0.08, 0.05], [x, 0.08 + (tunnelTop - 0.08) / 2, sz * tunnelHalf], 0.012);
      k.box(matte(PALETTE.rubber), [0.02, 0.16, tunnelHalf * 2 - 0.04], [x, tunnelTop - 0.1, 0], 0.006);
    }
    // Roof: glazed, with the fume extraction hood over the weld point.
    k.add(pane, new THREE.PlaneGeometry(L - POST, HZ * 2 - POST), [0, H + 0.03, 0], [-Math.PI / 2, 0, 0]);
    k.box(steel, [0.9, 0.18, 0.7], [0, H + 0.13, -0.15], 0.05);
    k.cyl(steel, 0.17, 0.75, [0, H + 0.58, -0.15], 'y', 0.02, 0.17, 24);
    k.cyl(bright, 0.19, 0.04, [0, H + 0.24, -0.15], 'y', 0.01);
    k.tube(steel, [[0, H + 0.95, -0.15], [0, H + 1.15, -0.15], [0, H + 1.15, -2.2]], 0.15, 0.3);

    // Gantry rails along the belt, on brackets off the posts.
    for (const sz of [1, -1]) {
      k.box(dark, [L - 0.2, 0.08, 0.1], [0, RAIL_Y, sz * 0.62], 0.02);
      k.box(bright, [L - 0.25, 0.02, 0.04], [0, RAIL_Y + 0.05, sz * 0.62], 0.006);
      for (const x of xs) k.box(steel, [0.12, 0.06, HZ - 0.62], [x * 0.96, RAIL_Y, sz * (0.62 + (HZ - 0.62) / 2)], 0.012);
    }

    // Fibre laser source and chiller behind the cell, against the wall.
    const backZ = -HZ - 0.55;
    k.box(white, [1.1, 1.55, 0.7], [-L / 2 + 0.75, 0.78, backZ], 0.06);
    k.box(orange, [1.108, 0.08, 0.708], [-L / 2 + 0.75, 1.42, backZ], 0.02);
    k.box(dark, [0.7, 0.28, 0.02], [-L / 2 + 0.75, 1.12, backZ + 0.36], 0.012);
    for (let j = 0; j < 6; j++) k.box(dark, [0.8, 0.02, 0.012], [-L / 2 + 0.75, 0.3 + j * 0.07, backZ + 0.355], 0.005);
    k.box(white, [0.9, 1.1, 0.7], [-L / 2 + 1.95, 0.55, backZ], 0.06);
    for (const sx of [1, -1]) {
      k.cyl(dark, 0.17, 0.02, [-L / 2 + 1.95 + sx * 0.22, 1.11, backZ], 'y', 0.004);
      k.add(bright, new THREE.TorusGeometry(0.15, 0.01, 6, 24), [-L / 2 + 1.95 + sx * 0.22, 1.125, backZ], [Math.PI / 2, 0, 0]);
    }
    // Fibre and coolant lines over to the cell roof.
    k.tube(orange, [[-L / 2 + 0.5, 1.55, backZ], [-L / 2 + 0.5, H + 0.35, backZ], [-L / 2 + 0.5, H + 0.35, -0.3], [-0.3, H + 0.35, -0.3]], 0.03, 0.12);
    k.tube(plastic(PALETTE.blue), [[-L / 2 + 1.8, 1.1, backZ], [-L / 2 + 1.8, H + 0.25, backZ], [-L / 2 + 1.8, H + 0.25, -0.45], [-0.5, H + 0.25, -0.45]], 0.025, 0.12);
    return k.build();
  }, [L]);
  useDispose(pieces);

  // The moving bridge, carriage and head. Its own pieces so it can travel.
  const bridge = useMemo(() => {
    const k = new Kit();
    const white = plastic(PALETTE.white);
    const orange = plastic(PALETTE.orange, 0.3);
    k.box(white, [0.22, 0.14, 1.42], [0, RAIL_Y + 0.13, 0], 0.04);
    k.box(orange, [0.228, 0.035, 1.3], [0, RAIL_Y + 0.12, 0], 0.012);
    for (const sz of [1, -1]) k.box(plastic(PALETTE.graphite), [0.26, 0.1, 0.16], [0, RAIL_Y + 0.08, sz * 0.62], 0.025);
    return k.build();
  }, []);
  useDispose(bridge);
  const head = useMemo(() => {
    const k = new Kit();
    const white = plastic(PALETTE.white);
    const dark = plastic(PALETTE.graphite);
    const bright = metal(PALETTE.offWhite, 0.18);
    const top = RAIL_Y + 0.06;
    // Carriage, the scanner head under it, then the focusing optic and the
    // nozzle, which stops well clear of the weld.
    k.box(dark, [0.3, 0.12, 0.26], [0, top, 0], 0.03);
    k.box(white, [0.24, 0.3, 0.22], [0, top - 0.21, 0], 0.05);
    k.box(plastic(PALETTE.orange, 0.3), [0.248, 0.045, 0.228], [0, top - 0.12, 0], 0.015);
    k.cyl(dark, 0.07, 0.16, [0, top - 0.44, 0], 'y', 0.02);
    k.cyl(bright, 0.055, 0.09, [0, top - 0.565, 0], 'y', 0.015, 0.03, 18);
    // Fibre into the top of the head.
    k.tube(plastic(PALETTE.orange, 0.3), [[0.04, top + 0.06, 0], [0.04, top + 0.24, 0], [-0.3, top + 0.24, 0]], 0.022, 0.08);
    return k.build();
  }, []);
  useDispose(head);

  const fx = useMemo(
    () => ({
      flash: new THREE.MeshStandardMaterial({ color: '#000000', emissive: HOT.clone(), emissiveIntensity: 4, toneMapped: false }),
      beam: additive(HOT.clone()),
      pool: additive(HOT.clone(), haloTexture()),
    }),
    [],
  );

  const level = useRef(power);
  const clock = useRef(0);
  const bridgeRef = useRef<THREE.Group>(null);
  const carriageRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const poolRef = useRef<Lit>(null);
  const beamRef = useRef<Lit>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const period = MODULE_INTERVAL_MS / 1000;

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    if (running) clock.current += step;
    level.current = THREE.MathUtils.damp(level.current, power, 3, step);
    const p = THREE.MathUtils.clamp(level.current, 0, 1);
    // 0 at the setpoint, 1 at about 18% short: the drift is small in
    // percent but large in what reaches the weld, so it is drawn large.
    const loss = THREE.MathUtils.clamp((1 - p) / 0.18, 0, 1);

    // One stroke per module: ride along with it, weld across its rows,
    // then hop back for the next.
    const u = (clock.current / period) % 1;
    const firing = running && u < 0.78;
    const x = firing ? -STROKE / 2 + (STROKE * u) / 0.78 : STROKE / 2 - (STROKE * (u - 0.78)) / 0.22;
    const row = Math.floor((u / 0.78) * 12) % 4;
    const z = firing ? (row - 1.5) * 0.098 : 0;
    if (bridgeRef.current) bridgeRef.current.position.x = x;
    if (carriageRef.current) carriageRef.current.position.z = z;

    // Pulsed: a few hundred pulses a second, drawn as a fast flicker. A weak
    // laser also misses pulses, so the flash visibly stutters.
    const t = clock.current;
    const flicker = 0.75 + 0.25 * Math.sin(t * 91) * Math.sin(t * 37);
    const miss = loss > 0.2 && Math.sin(t * 13.7) + Math.sin(t * 5.3) > 1.6 - loss;
    const on = firing && !miss ? 1 : 0;
    const bright = on * flicker * (1 - 0.72 * loss);
    _c.copy(HOT).lerp(WEAK, loss);
    if (flashRef.current) {
      flashRef.current.visible = bright > 0.02;
      const m = flashRef.current.material as THREE.MeshStandardMaterial;
      m.emissive.copy(_c);
      m.emissiveIntensity = 3 + 5 * bright;
    }
    if (haloRef.current) haloRef.current.material.color.copy(_c).multiplyScalar(2.2 * bright);
    if (poolRef.current) poolRef.current.material.color.copy(_c).multiplyScalar(0.9 * bright);
    if (beamRef.current) beamRef.current.material.color.copy(_c).multiplyScalar(1.6 * bright);
    if (lightRef.current) {
      lightRef.current.color.copy(_c);
      lightRef.current.intensity = 22 * bright;
    }
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={bridgeRef}>
        <Pieces pieces={bridge} />
        <group ref={carriageRef}>
          <Pieces pieces={head} />
          {/* The weld spot: a hot core, a camera-facing halo and the light
              it throws on the module and the belt. */}
          <mesh ref={flashRef} material={fx.flash} position={[0, WELD_Y + 0.012, 0]}>
            <sphereGeometry args={[0.028, 12, 8]} />
          </mesh>
          {/* Drawn over the module's own top so the whole glow reads. */}
          <sprite ref={haloRef} position={[0, WELD_Y + 0.03, 0]} scale={[0.7, 0.7, 1]} renderOrder={2}>
            <spriteMaterial map={haloTexture()} color={HOT} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} transparent toneMapped={false} />
          </sprite>
          {/* The beam itself, stylised: invisible in life, but it is what
              says "laser" from across the room. */}
          <mesh ref={beamRef} material={fx.beam} position={[0, (WELD_Y + NOZZLE_Y) / 2, 0]}>
            <cylinderGeometry args={[0.014, 0.024, NOZZLE_Y - WELD_Y, 8, 1, true]} />
          </mesh>
          <mesh ref={poolRef} material={fx.pool} position={[0, WELD_Y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.8, 1.8]} />
          </mesh>
          <pointLight ref={lightRef} position={[0, WELD_Y + 0.2, 0.1]} color={HOT} intensity={22} distance={4.5} decay={1.4} />
        </group>
      </group>
      <ControlBox kind="laser" accent={PALETTE.orange} width={0.58} height={0.56} position={[-L / 2 + 0.55, 1.36, HZ + 0.14]} />
      <Andon severity={severity} position={[L / 2, H + 0.04, HZ]} scale={1.25} />
    </group>
  );
}
