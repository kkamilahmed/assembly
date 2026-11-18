import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/state/store';
import { EXIT_STATION_INDEX, reworkBaySlot, ROBOT_IDS } from '@/streaming/lineConfig';
import {
  carBodyGeometry,
  carChassisGeometry,
  carChassisMaterial,
  carGlassGeometry,
  carGlassMaterial,
  carLightsGeometry,
  carLightsMaterial,
  carTrimGeometry,
  carTrimMaterial,
  carWheelParts,
  WHEEL_HUB_OFFSETS,
  WHEEL_NAMES,
} from './carModel';
import { COLORS, CONVEYOR_Y, DESPAWN_X, LINE_START_X, REWORK_BAY_Z, reworkBayX, ROBOT_X, SNAP_TRANSITION_MS, WHEEL_RADIUS } from './constants';
import { CarTag } from './CarTag';
import {
  isWheelMounted,
  PAINT_SWEEP_FRONT,
  PAINT_SWEEP_REAR,
  panelPhase,
  paintSweepProgress,
  wheelMountPhase,
} from './stationTargets';

// Body paint colours: ordinary mass-market colours, saturated enough to read
// against the light floor and the dark belt.
const CAR_PALETTE = ['#33507e', '#7a3b3b', '#d7dbe0', '#2f323a', '#4a6b52', '#b0773a'];

function paletteColorFor(carId: string): string {
  let hash = 0;
  for (let i = 0; i < carId.length; i++) hash = (hash * 31 + carId.charCodeAt(i)) | 0;
  return CAR_PALETTE[Math.abs(hash) % CAR_PALETTE.length];
}

/** World (x, z) a car sits at for a given walking-beam `stationIndex`. */
function targetFor(stationIndex: number): [number, number] {
  const bay = reworkBaySlot(stationIndex);
  if (bay !== null) return [reworkBayX(bay), REWORK_BAY_Z];
  if (stationIndex === EXIT_STATION_INDEX) return [DESPAWN_X, 0];
  return [ROBOT_X[ROBOT_IDS[stationIndex]], 0];
}

const PANEL_STATION = ROBOT_IDS.indexOf('PANEL-01');
const PAINT_STATION = ROBOT_IDS.indexOf('PAINT-01');
const WHEEL_STATION = ROBOT_IDS.indexOf('WHEEL-01');

interface PaintUniforms {
  uPaintX: { value: number };
  uPaintWidth: { value: number };
  uPrimerColor: { value: THREE.Color };
  uFinalColor: { value: THREE.Color };
  uDefect: { value: number };
  uDefectColor: { value: THREE.Color };
}

/**
 * The painted body shell's material. Every car starts as bare primer; a
 * literal spray front travels down the body as the paint station's sweep
 * passes over. The body geometry is authored directly in carFrame metres
 * (carModel.ts), so a vertex's own x is the coordinate the sweep is measured
 * in - no fit transform to reproduce.
 *
 * A rejected car glows red along its lower body, where the weld seams are,
 * so the rework bay reads as a row of defective cars from the back of the
 * room and not just as parked ones.
 */
function bodyMaterial(finalColor: string): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: COLORS.primer,
    metalness: 0.45,
    roughness: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.1,
  });
  const uniforms: PaintUniforms = {
    uPaintX: { value: -1000 },
    uPaintWidth: { value: 0.55 },
    uPrimerColor: { value: new THREE.Color(COLORS.primer) },
    uFinalColor: { value: new THREE.Color(finalColor) },
    uDefect: { value: 0 },
    uDefectColor: { value: new THREE.Color(COLORS.critical) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCarPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vCarPos;\nuniform float uPaintX;\nuniform float uPaintWidth;\nuniform vec3 uPrimerColor;\nuniform vec3 uFinalColor;\nuniform float uDefect;\nuniform vec3 uDefectColor;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n{ float painted = 1.0 - smoothstep(uPaintX - uPaintWidth, uPaintX + uPaintWidth, vCarPos.x); diffuseColor.rgb = mix(uPrimerColor, uFinalColor, painted); }',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ float seam = 1.0 - smoothstep(0.55, 1.05, vCarPos.y); totalEmissiveRadiance += uDefectColor * seam * uDefect; diffuseColor.rgb = mix(diffuseColor.rgb, uDefectColor, seam * uDefect * 0.55); }',
      );
  };
  material.userData.paint = uniforms;
  return material;
}

const BODY_CENTER = (() => {
  const c = new THREE.Vector3();
  carBodyGeometry().boundingBox!.getCenter(c);
  return c;
})();
const BODY_CENTER_NEG = BODY_CENTER.clone().multiplyScalar(-1);

export function CarShell({ carId }: { carId: string }) {
  const car = useStore((s) => s.activeCars.find((c) => c.carId === carId));
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const fromPos = useRef(new THREE.Vector3(LINE_START_X, CONVEYOR_Y, 0));
  const toPos = useRef(new THREE.Vector3(LINE_START_X, CONVEYOR_Y, 0));
  const prevDockedAt = useRef<number | null>(null);

  // This car's own body material; everything else (geometry, glass,
  // chassis, wheels) is shared across the whole line. Its paint uniforms
  // ride on the material's userData and are reached through the mesh ref
  // each frame.
  const bodyRef = useRef<THREE.Mesh>(null);
  const body = useMemo(() => bodyMaterial(paletteColorFor(carId)), [carId]);
  useEffect(() => () => body.dispose(), [body]);

  const wheel = carWheelParts();

  // The car is assembled down the line: a bare chassis arrives, the Panel
  // station fits the body shell (scaled up around its own centre), Paint
  // sprays it, Wheel mounts the wheels.
  useFrame(() => {
    const group = groupRef.current;
    const shell = shellRef.current;
    const uniforms = (bodyRef.current?.material as THREE.Material | undefined)?.userData.paint as PaintUniforms | undefined;
    if (!car || !group || !shell || !uniforms) return;
    if (useStore.getState().paused) return;
    const wheels = wheelRefs.current.filter((w): w is THREE.Group => w !== null);
    const elapsed = Date.now() - car.dockedAt;

    // ---- X/Z glide between slots ----
    if (car.dockedAt !== prevDockedAt.current) {
      fromPos.current.copy(group.position);
      const [tx, tz] = targetFor(car.stationIndex);
      toPos.current.set(tx, 0, tz);
      prevDockedAt.current = car.dockedAt;
    }
    const gt = THREE.MathUtils.clamp(elapsed / SNAP_TRANSITION_MS, 0, 1);
    const smoothT = gt * gt * (3 - 2 * gt);
    const nx = THREE.MathUtils.lerp(fromPos.current.x, toPos.current.x, smoothT);
    const nz = THREE.MathUtils.lerp(fromPos.current.z, toPos.current.z, smoothT);
    const dx = nx - group.position.x;
    group.position.set(nx, CONVEYOR_Y, nz);
    // Rolling forward along +x turns a wheel clockwise seen from +z.
    if (dx !== 0) for (const w of wheels) if (w.visible) w.rotation.z -= dx / WHEEL_RADIUS;

    const station = car.stationIndex;
    const inBay = reworkBaySlot(station) !== null;

    // Panel: fit the body shell on the reveal beat.
    if (station === PANEL_STATION) {
      const reveal = panelPhase(elapsed).reveal;
      shell.scale.setScalar(Math.max(reveal, 0.0001));
      shell.visible = reveal > 0.001;
    } else if (station > PANEL_STATION || inBay) {
      shell.scale.setScalar(1);
      shell.visible = true;
    } else {
      shell.visible = false;
    }

    // Paint: a spray front travels front to rear with the sweep.
    if (station === PAINT_STATION) {
      uniforms.uPaintX.value = THREE.MathUtils.lerp(PAINT_SWEEP_FRONT.x, PAINT_SWEEP_REAR.x, paintSweepProgress(elapsed));
    } else if (station > PAINT_STATION) {
      uniforms.uPaintX.value = PAINT_SWEEP_REAR.x + 2;
    } else {
      // Not painted yet, or pulled before reaching paint.
      uniforms.uPaintX.value = PAINT_SWEEP_FRONT.x - 2;
    }

    // A rejected car shows its bad seam, pulsing, once it is in the bay.
    uniforms.uDefect.value = inBay && car.verdict === 'fail' ? 0.55 + 0.25 * Math.sin(Date.now() / 260) : 0;

    // Wheels: all four land on the same mount pulse; finished cars keep them.
    if (station === WHEEL_STATION) {
      if (isWheelMounted(wheelMountPhase(elapsed))) for (const w of wheels) w.visible = true;
    } else {
      const mounted = station === EXIT_STATION_INDEX;
      for (const w of wheels) w.visible = mounted;
    }
  });

  const inBay = reworkBaySlot(car?.stationIndex ?? 0) !== null;
  return (
    <group ref={groupRef} position={[LINE_START_X, CONVEYOR_Y, 0]}>
      <mesh geometry={carChassisGeometry()} material={carChassisMaterial()} castShadow receiveShadow />
      <group ref={shellRef} position={BODY_CENTER}>
        <group position={BODY_CENTER_NEG}>
          <mesh ref={bodyRef} geometry={carBodyGeometry()} material={body} castShadow receiveShadow />
          <mesh geometry={carGlassGeometry()} material={carGlassMaterial()} />
          <mesh geometry={carLightsGeometry()} material={carLightsMaterial()} castShadow />
          <mesh geometry={carTrimGeometry()} material={carTrimMaterial()} castShadow />
        </group>
      </group>
      {WHEEL_NAMES.map((name, i) => (
        <group
          key={name}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={WHEEL_HUB_OFFSETS[name]}
        >
          <mesh geometry={wheel.tireGeo} material={wheel.tireMat} castShadow receiveShadow />
          <mesh geometry={wheel.rimGeo} material={wheel.rimMat} castShadow />
        </group>
      ))}
      <CarTag verdict={car?.verdict ?? 'none'} deviationMm={car?.deviationMm ?? null} y={1.75} inBay={inBay} />
    </group>
  );
}
