import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { BELT_WIDTH, BELT_Y, MACHINE_POS } from '../layout';
import { metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { additive, archShape, extrudeAlongX, haloTexture, Kit, spillTexture, useDispose, windowTexture } from './kit';
import type { Severity } from './kit';
import { Pieces, Screen } from './Pieces';

const DEFAULT_LENGTH = MACHINE_POS.ovenStart.distanceTo(MACHINE_POS.ovenEnd);

/** Outer half-width of the body. */
const HW = 0.95;
/** Top of the base cabinet, where the tunnel hood starts. */
const BODY_TOP = 0.56;
const TOP = 1.78;
const ARCH_R = 0.26;
/** Tunnel cavity: half-width and ceiling. */
const IHW = 0.67;
const IH = 1.36;
const GAP = 0.016;

const GLOW = new THREE.Color(PALETTE.orangeGlow);
const HOT = new THREE.Color(PALETTE.amber).lerp(new THREE.Color(PALETTE.white), 0.5);
const _halo = new THREE.Color();
const _c = new THREE.Color();

type Glow = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type Spill = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

/**
 * Tunnel oven, the hero machine. Local frame: origin on the floor at the
 * centre of the oven, belt running through along +x at BELT_Y, operator
 * side (windows, burners, control cabinet) on +z. The conveyor itself is
 * not part of the oven; the tunnel is hollow so it passes through.
 *
 * `heat` 1 is a normal bake; toward 2.5 the glow goes hotter, whiter and
 * spills further. `running` spins the roof fans and makes the fire
 * flicker. `severity` drives the stack light.
 */
export function TunnelOven({
  length = DEFAULT_LENGTH,
  heat = 1,
  severity = 'healthy',
  running = true,
  ...props
}: {
  length?: number;
  heat?: number;
  severity?: Severity;
  running?: boolean;
} & ThreeElements['group']) {
  const L = length;
  const cabX = L / 2 - 1.25;
  const cabZ = HW + 0.52;
  const fanX = L * 0.2;

  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const base = metal(PALETTE.steelDark, 0.34);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const orange = plastic(PALETTE.orange);
    const blue = plastic(PALETTE.blue);

    const n = Math.max(2, Math.round(L / 0.85));
    const seg = L / n;
    const bodyH = BODY_TOP - 0.1;
    const bodyY = 0.1 + bodyH / 2;

    // Plinth and the dark core that shows in the panel seams.
    k.box(dark, [L - 0.14, 0.1, HW * 2 - 0.14], [0, 0.05, 0], 0.02);
    k.box(dark, [L - 0.05, bodyH - 0.02, HW * 2 - 0.04], [0, bodyY, 0], 0.02);
    k.add(dark, extrudeAlongX(archShape(HW - 0.02, BODY_TOP, TOP - 0.02, ARCH_R - 0.01, IHW + 0.02, IH + 0.02, 0.08), L - 0.05, 0.004));

    // Insulated panel segments.
    const hood = extrudeAlongX(archShape(HW, BODY_TOP + 0.008, TOP, ARCH_R, IHW, IH, 0.08), seg - GAP, 0.016);
    // Stiffening hoops over the roof, two per panel.
    const hoop = extrudeAlongX(archShape(HW + 0.014, 1.52, TOP + 0.014, ARCH_R + 0.007, HW - 0.03, TOP - 0.03, ARCH_R - 0.02), 0.04, 0.009);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + seg * (i + 0.5);
      const behindCabinet = Math.abs(x - cabX) < seg * 0.5 + 0.2;
      k.add(steel, hood.clone(), [x, 0, 0]);
      k.box(base, [seg - GAP, bodyH - 0.008, HW * 2], [x, bodyY, 0], 0.028);
      // Raised skins on the roof and both sides.
      for (const o of [-0.25, 0.25]) k.add(bright, hoop.clone(), [x + o * seg, 0, 0]);
      for (const sz of [1, -1]) k.box(steel, [seg - 0.2, 0.74, 0.018], [x, 1.09, sz * (HW + 0.005)], 0.008);
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) k.bolt(bright, [x + sx * (seg / 2 - 0.15), 1.09 + sy * 0.32, HW + 0.018], 'z');
      }

      // Inspection window with a grab rail under it.
      if (!behindCabinet) {
        k.box(dark, [0.58, 0.36, 0.035], [x, 1.14, HW + 0.02], 0.03);
        k.box(dark, [0.018, 0.3, 0.03], [x, 1.14, HW + 0.03], 0.006);
        for (const sx of [1, -1]) for (const sy of [1, -1]) k.bolt(bright, [x + sx * 0.265, 1.14 + sy * 0.155, HW + 0.04], 'z', 0.011);
        k.box(bright, [0.36, 0.028, 0.028], [x, 0.9, HW + 0.05], 0.012);
        for (const sx of [1, -1]) k.box(bright, [0.028, 0.028, 0.045], [x + sx * 0.15, 0.9, HW + 0.03], 0.01);
      }

      // Base cabinet front: burner units alternate with service doors.
      if (i % 2 === 0) {
        k.box(orange, [0.32, 0.26, 0.17], [x, 0.36, HW + 0.08], 0.045);
        k.cyl(bright, 0.075, 0.05, [x, 0.38, HW + 0.18], 'z', 0.012);
        k.cyl(blue, 0.045, 0.035, [x, 0.38, HW + 0.215], 'z', 0.01, 0.045, 14);
        k.cyl(bright, 0.022, 0.1, [x, 0.19, HW + 0.1], 'y', 0.004, 0.022, 10);
      } else {
        k.box(base, [seg - 0.2, 0.34, 0.018], [x, 0.36, HW + 0.005], 0.008);
        k.box(dark, [0.03, 0.17, 0.035], [x + seg / 2 - 0.17, 0.36, HW + 0.03], 0.012);
        for (let j = 0; j < 4; j++) k.box(dark, [0.24, 0.02, 0.012], [x - 0.12, 0.29 + j * 0.045, HW + 0.012], 0.005);
      }
    }
    hood.dispose();
    hoop.dispose();

    // Gas header along the burners.
    k.cyl(bright, 0.03, L - 0.5, [0, 0.15, HW + 0.1], 'x', 0.01, 0.03, 12);
    for (let i = 1; i < n; i++) k.box(dark, [0.05, 0.1, 0.1], [-L / 2 + seg * i, 0.15, HW + 0.07], 0.015);

    // Polished collars around both mouths, with a dark throat inside.
    for (const sx of [1, -1]) {
      k.add(bright, extrudeAlongX(archShape(HW + 0.04, BODY_TOP + 0.008, TOP + 0.04, ARCH_R + 0.02, IHW - 0.035, IH - 0.035, 0.07), 0.18, 0.022), [sx * (L / 2 - 0.05), 0, 0]);
      k.add(dark, extrudeAlongX(archShape(IHW - 0.004, BODY_TOP + 0.008, IH - 0.004, 0.075, IHW - 0.03, IH - 0.03, 0.06), 0.34, 0.004), [sx * (L / 2 - 0.2), 0, 0]);
      // End face of the base cabinet: vents and a badge over the mouth.
      for (let j = 0; j < 4; j++) k.box(dark, [0.012, 0.022, 0.5], [sx * (L / 2 + 0.002), 0.25 + j * 0.05, 0.4], 0.005);
      k.box(orange, [0.02, 0.09, 0.42], [sx * (L / 2 + 0.04), 1.58, 0], 0.008);
    }

    // Roof: exhaust plenum with two stacks.
    const ductZ = -0.42;
    k.box(steel, [L - 1.8, 0.24, 0.42], [0, TOP + 0.13, ductZ], 0.05);
    const flanges = Math.max(2, Math.round((L - 1.8) / 1.1));
    for (let i = 0; i <= flanges; i++) k.box(bright, [0.035, 0.28, 0.46], [-(L - 1.8) / 2 + ((L - 1.8) * i) / flanges, TOP + 0.13, ductZ], 0.012);
    for (const sx of [1, -1]) {
      const x = sx * (L / 2 - 1.45);
      const base = TOP + 0.25;
      k.cyl(bright, 0.21, 0.05, [x, base + 0.025, ductZ], 'y', 0.012);
      k.cyl(steel, 0.165, 0.62, [x, base + 0.31, ductZ], 'y', 0.02, 0.165, 24);
      k.cyl(bright, 0.18, 0.04, [x, base + 0.36, ductZ], 'y', 0.012);
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI * 2;
        k.cyl(steel, 0.012, 0.12, [x + Math.cos(a) * 0.14, base + 0.66, ductZ + Math.sin(a) * 0.14], 'y', 0.003, 0.012, 6);
      }
      k.cyl(steel, 0.25, 0.11, [x, base + 0.76, ductZ], 'y', 0.02, 0.05, 24);
    }

    // Roof: circulation fans with their motors, and a cable tray.
    for (const sx of [1, -1]) {
      const x = sx * fanX;
      k.cyl(steel, 0.27, 0.1, [x, TOP + 0.05, 0.4], 'y', 0.025, 0.25, 28);
      k.cyl(dark, 0.215, 0.02, [x, TOP + 0.095, 0.4], 'y', 0.004, 0.215, 28);
      k.add(bright, new THREE.TorusGeometry(0.215, 0.012, 6, 32), [x, TOP + 0.12, 0.4], [Math.PI / 2, 0, 0]);
      k.add(bright, new THREE.TorusGeometry(0.11, 0.009, 6, 24), [x, TOP + 0.12, 0.4], [Math.PI / 2, 0, 0]);
      k.box(bright, [0.44, 0.012, 0.018], [x, TOP + 0.12, 0.4], 0.005);
      k.box(dark, [0.2, 0.07, 0.14], [x - 0.33, TOP + 0.045, 0.4], 0.02);
      k.cyl(blue, 0.085, 0.24, [x - 0.52, TOP + 0.1, 0.4], 'x', 0.025);
      k.cyl(dark, 0.092, 0.05, [x - 0.66, TOP + 0.1, 0.4], 'x', 0.018);
    }
    k.box(dark, [L - 0.9, 0.035, 0.17], [0, TOP + 0.03, -0.06], 0.012);
    k.cyl(orange, 0.02, L - 1.0, [0, TOP + 0.065, -0.1], 'x', 0.008, 0.02, 8);
    k.cyl(blue, 0.02, L - 1.0, [0, TOP + 0.065, -0.05], 'x', 0.008, 0.02, 8);
    k.cyl(dark, 0.02, L - 1.0, [0, TOP + 0.065, 0], 'x', 0.008, 0.02, 8);
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) k.add(bright, new THREE.TorusGeometry(0.045, 0.014, 6, 16), [sx * (L / 2 - 0.32), TOP + 0.04, sz * 0.6]);
    }

    // Free-standing control cabinet on the operator side.
    const zf = cabZ + 0.2;
    k.box(dark, [0.74, 0.08, 0.36], [cabX, 0.04, cabZ], 0.02);
    k.box(white, [0.8, 1.5, 0.4], [cabX, 0.83, cabZ], 0.05);
    k.box(orange, [0.808, 0.09, 0.408], [cabX, 1.46, cabZ], 0.03);
    k.box(dark, [0.62, 0.42, 0.03], [cabX, 1.13, zf + 0.004], 0.02);
    // Burner gauges.
    for (let i = 0; i < 3; i++) {
      const x = cabX - 0.21 + i * 0.21;
      k.cyl(bright, 0.082, 0.03, [x, 0.77, zf + 0.012], 'z', 0.012);
      k.cyl(white, 0.066, 0.012, [x, 0.77, zf + 0.026], 'z', 0.003);
      k.box(orange, [0.012, 0.058, 0.006], [x + [-0.012, 0.004, 0.016][i], 0.785, zf + 0.035], 0.002, [0, 0, [0.7, -0.2, -0.9][i]]);
      k.cyl(dark, 0.013, 0.012, [x, 0.77, zf + 0.036], 'z', 0.003, 0.013, 10);
    }
    [PALETTE.healthy, PALETTE.amber, PALETTE.blue].forEach((c, i) => {
      k.cyl(bright, 0.034, 0.012, [cabX - 0.24 + i * 0.1, 0.58, zf + 0.004], 'z', 0.004, 0.034, 12);
      k.cyl(plastic(c), 0.025, 0.035, [cabX - 0.24 + i * 0.1, 0.58, zf + 0.014], 'z', 0.008, 0.025, 12);
    });
    k.cyl(plastic(PALETTE.amber), 0.055, 0.018, [cabX + 0.22, 0.58, zf + 0.006], 'z', 0.005);
    k.cyl(plastic(PALETTE.critical), 0.04, 0.05, [cabX + 0.22, 0.58, zf + 0.035], 'z', 0.015);
    // Lower door with vents and a handle.
    k.box(white, [0.7, 0.36, 0.014], [cabX, 0.3, zf + 0.003], 0.01);
    for (let j = 0; j < 4; j++) k.box(dark, [0.3, 0.02, 0.012], [cabX - 0.12, 0.22 + j * 0.045, zf + 0.008], 0.005);
    k.box(dark, [0.03, 0.16, 0.035], [cabX + 0.27, 0.3, zf + 0.022], 0.012);
    // Conduit from the cabinet over to the roof.
    k.tube(dark, [[cabX - 0.25, 1.56, cabZ], [cabX - 0.25, 2.0, cabZ], [cabX - 0.25, 2.0, 0.62], [cabX - 0.25, TOP, 0.62]], 0.032, 0.12);
    k.cyl(bright, 0.05, 0.04, [cabX - 0.25, 1.6, cabZ], 'y', 0.01, 0.05, 12);
    k.cyl(bright, 0.05, 0.04, [cabX - 0.25, TOP + 0.02, 0.62], 'y', 0.01, 0.05, 12);
    return k.build();
  }, [L, cabX, cabZ, fanX]);
  useDispose(pieces);

  // Self-lit parts. One material per oven, so two ovens can run at
  // different heats.
  const lit = useMemo(() => {
    const n = Math.max(2, Math.round(L / 0.85));
    const seg = L / n;
    const k = new Kit();
    const pane = new THREE.MeshStandardMaterial({ color: '#000000', emissive: GLOW, emissiveMap: windowTexture(), emissiveIntensity: 2.2, roughness: 0.15, toneMapped: false });
    const halo = additive(GLOW, haloTexture());
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + seg * (i + 0.5);
      if (Math.abs(x - cabX) < seg * 0.5 + 0.2) continue;
      k.add(pane, new THREE.PlaneGeometry(0.5, 0.28), [x, 1.14, HW + 0.039]);
      k.add(halo, new THREE.PlaneGeometry(1.1, 0.95), [x, 1.12, HW + 0.06]);
    }
    // Heat haze around the exit and entry mouths.
    for (const sx of [1, -1]) k.add(halo, new THREE.PlaneGeometry(1.8, 1.5), [sx * (L / 2 + 0.07), 1.0, 0], [0, (sx * Math.PI) / 2, 0]);
    const panes = k.build();
    const liner = new THREE.MeshStandardMaterial({ color: '#000000', emissive: GLOW, emissiveIntensity: 1.7, roughness: 0.6, side: THREE.BackSide, toneMapped: false });
    const linerGeo = new THREE.BoxGeometry(L - 0.44, IH - BODY_TOP - 0.02, (IHW - 0.012) * 2);
    const rotor = new Kit();
    rotor.box(metal(PALETTE.steelDark, 0.35), [0.4, 0.012, 0.075], [0, 0, 0], 0.005, [0.35, 0, 0]);
    rotor.box(metal(PALETTE.steelDark, 0.35), [0.075, 0.012, 0.4], [0, 0, 0], 0.005, [0, 0, 0.35]);
    rotor.cyl(metal(PALETTE.offWhite, 0.18), 0.05, 0.04, [0, 0, 0], 'y', 0.012, 0.05, 12);
    return { panes, pane, liner, linerGeo, spill: additive(GLOW, spillTexture()), floorSpill: additive(GLOW, haloTexture()), rotor: rotor.build() };
  }, [L, cabX]);
  useDispose(lit.panes);
  useDispose(lit.rotor);

  const level = useRef(heat);
  const linerRef = useRef<Glow>(null);
  const paneRef = useRef<Glow>(null);
  const haloRef = useRef<Spill>(null);
  const spillRefs = useRef<Array<Spill | null>>([]);
  const lightRefs = useRef<Array<THREE.PointLight | null>>([]);
  const fanRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.1);
    level.current = THREE.MathUtils.damp(level.current, heat, 2.5, step);
    const v = level.current;
    const over = THREE.MathUtils.clamp((v - 1) / 1.5, 0, 1);
    const t = clock.elapsedTime;
    const flicker = running ? 1 + 0.04 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 23.7) : 1;
    // Past a normal bake the fire gets much brighter rather than paler: the
    // tone mapper and bloom turn that into a white-hot core with an orange rim.
    const power = (v <= 1 ? Math.max(v, 0.12) : 1 + (v - 1) * 1.5) * flicker;
    _c.copy(GLOW).lerp(HOT, over * 0.7);

    if (linerRef.current) {
      linerRef.current.material.emissive.copy(_c);
      linerRef.current.material.emissiveIntensity = 1.7 * power;
    }
    if (paneRef.current) {
      paneRef.current.material.emissive.copy(_c);
      paneRef.current.material.emissiveIntensity = 2.2 * power;
    }
    // The halos are faint at a normal bake and flare when it runs hot.
    if (haloRef.current) haloRef.current.material.color.copy(_halo.copy(GLOW).multiplyScalar((0.1 + 0.55 * over) * power));
    spillRefs.current.forEach((m, i) => {
      if (!m) return;
      // 0 and 1 lie on the belt, 2 and 3 on the floor.
      m.material.color.copy(_c).multiplyScalar((i < 2 ? 0.85 : 0.3) * power);
    });
    for (const light of lightRefs.current) {
      if (!light) continue;
      light.color.copy(_c);
      light.intensity = 11 * power;
    }
    if (running) for (const fan of fanRefs.current) if (fan) fan.rotation.y += step * 9;
  });

  const mouth = L / 2;
  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <mesh ref={linerRef} geometry={lit.linerGeo} material={lit.liner} position={[0, (BODY_TOP + IH) / 2, 0]} />
      {lit.panes.map((p, i) => (
        <mesh key={i} ref={p.material === lit.pane ? paneRef : haloRef} geometry={p.geometry} material={p.material} />
      ))}
      {[1, -1].map((sx, i) => (
        <group key={sx}>
          {/* Fire light falling out of the mouth onto the belt and floor. */}
          <mesh
            ref={(m: Spill | null) => {
              spillRefs.current[i] = m;
            }}
            material={lit.spill}
            position={[sx * (mouth + 0.3), BELT_Y + 0.012, 0]}
            rotation={[-Math.PI / 2, 0, sx > 0 ? 0 : Math.PI]}
          >
            <planeGeometry args={[1.9, BELT_WIDTH - 0.02]} />
          </mesh>
          <mesh
            ref={(m: Spill | null) => {
              spillRefs.current[2 + i] = m;
            }}
            material={lit.floorSpill}
            position={[sx * (mouth + 0.35), 0.012, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[3.6, 3.6]} />
          </mesh>
          <pointLight
            ref={(l) => {
              lightRefs.current[i] = l;
            }}
            position={[sx * (mouth - 0.2), 1.18, 0]}
            color={PALETTE.orangeGlow}
            intensity={11}
            distance={6.5}
            decay={1.6}
          />
          <group
            ref={(g) => {
              fanRefs.current[i] = g;
            }}
            position={[sx * fanX, TOP + 0.1, 0.4]}
          >
            <Pieces pieces={lit.rotor} />
          </group>
        </group>
      ))}
      <Screen kind="trend" size={[0.56, 0.36]} position={[cabX, 1.13, cabZ + 0.2 + 0.021]} />
      <Andon severity={severity} position={[mouth - 0.34, TOP + 0.02, 0.36]} scale={1.25} />
    </group>
  );
}
