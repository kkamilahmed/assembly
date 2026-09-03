import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/state/store';
import { EXIT_STATION_INDEX, ROBOT_IDS, SIDING_STATION_INDEX } from '@/streaming/lineConfig';
import { CAR_LENGTH, COLORS, CONVEYOR_Y, DESPAWN_X, LINE_START_X, REWORK_SIDING_Z, REWORK_STOP_X, ROBOT_X, SNAP_TRANSITION_MS, WHEEL_RADIUS } from './constants';
import {
  isWheelMounted,
  PAINT_SWEEP_FRONT,
  PAINT_SWEEP_REAR,
  panelPhase,
  paintSweepProgress,
  wheelMountPhase,
  WHEEL_ORDER,
} from './stationTargets';
import { fitObject3D, useFerrariModel } from './models';

interface PaintUniforms {
  uPaintX: { value: number };
  uPaintWidth: { value: number };
  uPrimerColor: { value: THREE.Color };
  uFinalColor: { value: THREE.Color };
  uFitScale: { value: number };
  uFitPosX: { value: number };
}

// Actual body-paint colours — saturated enough to read clearly against the
// light floor and dark belt, unlike a "realistic" primer gray.
const CAR_PALETTE = ['#33507e', '#7a3b3b', '#d7dbe0', '#2f323a', '#4a6b52', '#8a2f2f'];

function paletteColorFor(carId: string): string {
  let hash = 0;
  for (let i = 0; i < carId.length; i++) hash = (hash * 31 + carId.charCodeAt(i)) | 0;
  return CAR_PALETTE[Math.abs(hash) % CAR_PALETTE.length];
}

/** World (x, z) a car sits at for a given walking-beam `stationIndex`. */
function targetFor(stationIndex: number): [number, number] {
  if (stationIndex === SIDING_STATION_INDEX) return [REWORK_STOP_X, REWORK_SIDING_Z];
  if (stationIndex === EXIT_STATION_INDEX) return [DESPAWN_X, 0];
  return [ROBOT_X[ROBOT_IDS[stationIndex]], 0];
}

const PANEL_STATION = ROBOT_IDS.indexOf('PANEL-01');
const PAINT_STATION = ROBOT_IDS.indexOf('PAINT-01');
const WHEEL_STATION = ROBOT_IDS.indexOf('WHEEL-01');

export function CarShell({ carId }: { carId: string }) {
  const car = useStore((s) => s.activeCars.find((c) => c.carId === carId));
  const gltf = useFerrariModel();
  const groupRef = useRef<THREE.Group>(null);
  const fromPos = useRef(new THREE.Vector3(LINE_START_X, CONVEYOR_Y, 0));
  const toPos = useRef(new THREE.Vector3(LINE_START_X, CONVEYOR_Y, 0));
  const prevDockedAt = useRef<number | null>(null);

  const paletteColor = useMemo(() => paletteColorFor(carId), [carId]);
  // The Ferrari model is authored with its length along Z (its wheels spin
  // around X). Rotate it so the body runs along the conveyor's X direction,
  // normalise to ~4.6 m, sit its wheels on the belt, and clone the body/glass
  // materials so per-car palette colour doesn't leak across instances.
  const { body, shell, wheels, trim, paintUniforms } = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.rotation.y = -Math.PI / 2;
    // Centered, not pinned: every target in stationTargets.ts (weld seams,
    // paint sweep, panel placement, wheel hubs) is authored in a carFrame
    // that assumes the body spans [-CAR_LENGTH/2, CAR_LENGTH/2] around this
    // group's own origin — pinning the leading edge to 0 here would leave
    // every station reaching at a point offset by half a car length from
    // where the car actually renders.
    const fit = fitObject3D(root, { axis: 'x', size: CAR_LENGTH });
    root.scale.setScalar(fit.scale);
    root.position.set(fit.position[0], fit.position[1], fit.position[2]);

    const shellMesh = root.getObjectByName('body') as THREE.Mesh | undefined;
    let mat: THREE.MeshPhysicalMaterial | null = null;
    let paintUniforms: PaintUniforms | null = null;
    if (shellMesh) {
      // Every car starts as bare primer grey. A literal spray front (not a
      // uniform whole-body colour fade) travels down the body as the Paint
      // station's sweep passes over — see the onBeforeCompile injection
      // below and paintUniforms.uPaintX in useFrame.
      mat = new THREE.MeshPhysicalMaterial({
        color: COLORS.primer,
        metalness: 0.6,
        roughness: 0.35,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.2,
      });
      paintUniforms = {
        uPaintX: { value: -1000 },
        uPaintWidth: { value: 0.55 },
        uPrimerColor: { value: new THREE.Color(COLORS.primer) },
        uFinalColor: { value: new THREE.Color(paletteColor) },
        // The mesh's own local Z is the model's original length axis (it's
        // authored with length along Z, rotated -90° about Y above to run
        // along our world X); this reproduces that same transform per-vertex
        // in the shader so the paint front lines up with carFrame X — the
        // same coordinate space paintSweepProgress/PAINT_SWEEP_FRONT use.
        uFitScale: { value: fit.scale },
        uFitPosX: { value: fit.position[0] },
      };
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, paintUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vPaintX;\nuniform float uFitScale;\nuniform float uFitPosX;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintX = -position.z * uFitScale + uFitPosX;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vPaintX;\nuniform float uPaintX;\nuniform float uPaintWidth;\nuniform vec3 uPrimerColor;\nuniform vec3 uFinalColor;')
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n{ float painted = 1.0 - smoothstep(uPaintX - uPaintWidth, uPaintX + uPaintWidth, vPaintX); diffuseColor.rgb = mix(uPrimerColor, uFinalColor, painted); }',
          );
      };
      shellMesh.material = mat;
    }
    // Glass (windshield + headlight lens below): `transmission` is
    // deliberately avoided here. Three.js's built-in transmission relies on
    // an internal offscreen "render what's behind this object" pass baked
    // into WebGLRenderer.render(), and that pass comes back empty once
    // PostFX's <EffectComposer> (postprocessing) is redirecting the main
    // render into its own offscreen buffer — the well-known
    // transmission-vs-postprocessing conflict. The visible symptom was
    // every "glass" material rendering solid black regardless of its
    // tint, everywhere except where a direct specular highlight hit it.
    //
    // A flat `opacity` value doesn't read as "glass" either, even once it's
    // not black — real glass isn't uniformly see-through, it's Fresnel:
    // nearly transparent straight-on, nearly a mirror at grazing angles.
    // A constant alpha blend skips that entirely and just looks like a
    // pale, flat smear regardless of the number chosen. Fake the Fresnel
    // response per-fragment instead (same onBeforeCompile technique as the
    // paint-sweep shader above) — cheap, and unlike real transmission or
    // drei's MeshTransmissionMaterial it needs no extra render pass, which
    // matters here since every car on the line has two of these.
    function fresnelGlassMaterial(color: string, baseAlpha: number, extra: THREE.MeshPhysicalMaterialParameters = {}) {
      const mat = new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        envMapIntensity: 1.2,
        ...extra,
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uBaseAlpha = { value: baseAlpha };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uBaseAlpha;')
          .replace(
            '#include <opaque_fragment>',
            `{ float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); diffuseColor.a = mix(uBaseAlpha, 1.0, fresnel); }\n#include <opaque_fragment>`,
          );
      };
      return mat;
    }
    const glass = root.getObjectByName('glass') as THREE.Mesh | undefined;
    if (glass) {
      glass.material = fresnelGlassMaterial('#bcd6e0', 0.08);
    }
    // Headlight lens: the `lights` mesh *is* the lens surface itself
    // (material `Projector_Glass`) — there's no separate reflector-bowl
    // geometry behind it, so an opaque material here (even a glossy one)
    // just reads as a solid grey/black disc under the studio HDRI. Same
    // Fresnel glass recipe as the windshield above. An earlier pass at
    // the emissive "bulb glow" (0.5 intensity on a near-white base) blew
    // this out to flat opaque white instead of reading as glass — dropped
    // to a restrained hint.
    const lights = root.getObjectByName('lights') as THREE.Mesh | undefined;
    if (lights) {
      lights.material = fresnelGlassMaterial('#eef5fb', 0.1, {
        emissive: '#fff6e0',
        emissiveIntensity: 0.12,
      });
    }
    // Interior: every material in this GLB shares identical PBR factors
    // (metalness 0.2, roughness 0.8 — a generic placeholder, not authored
    // per-material) and several are literally flat, zero-saturation grey
    // (Interior_light, Carpet, Carbon_Fiber) — the textures that presumably
    // carried the real leather grain / carbon weave / chrome look were
    // stripped when this GLB was compressed. Replace each by name (not by
    // node — several nodes share one material) with something that actually
    // reads as its material, matching the treatment already given to the
    // body/glass/headlight.
    const INTERIOR_MATERIALS: Record<string, () => THREE.Material> = {
      Leather: () => new THREE.MeshStandardMaterial({ color: '#171310', roughness: 0.55, metalness: 0 }),
      Leather_red: () => new THREE.MeshStandardMaterial({ color: '#7a1f1f', roughness: 0.5, metalness: 0 }),
      Interior_dark: () => new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.45, metalness: 0.05 }),
      Interior_light: () => new THREE.MeshStandardMaterial({ color: '#3a3a3d', roughness: 0.5, metalness: 0.25 }),
      Carpet: () => new THREE.MeshStandardMaterial({ color: '#242426', roughness: 0.95, metalness: 0 }),
      Carbon_Fiber: () => new THREE.MeshPhysicalMaterial({
        color: '#15161a', roughness: 0.35, metalness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25,
      }),
      metal_chrome: () => new THREE.MeshStandardMaterial({ color: '#e8eaec', roughness: 0.08, metalness: 1, envMapIntensity: 1.6 }),
    };
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const factory = mesh.material && INTERIOR_MATERIALS[mesh.material.name];
      if (factory) mesh.material = factory();
    });
    const wheelObjs = WHEEL_ORDER.map((n) => root.getObjectByName(n)).filter(
      (o): o is THREE.Object3D => !!o,
    );
    // Wheels stay hidden until the Wheel station mounts each one.
    for (const w of wheelObjs) w.visible = false;

    // The GLB's body shell is one mesh, but everything it normally conceals —
    // interior, glass, chrome trim, wipers, lights — is ~30 separate meshes
    // that stay visible on their own. Hiding only `body` left a naked
    // dashboard/seats/windshield floating with no car around it (reads as
    // wreckage, not "chassis in progress"). Fold every non-body, non-wheel
    // mesh into the same reveal so a pre-Panel car reads as a bare rolling
    // chassis, and the whole dressed car appears together at the Panel beat.
    const trimMeshes: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (o === shellMesh || !(o as THREE.Mesh).isMesh) return;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) {
        if ((WHEEL_ORDER as readonly string[]).includes(p.name)) return;
      }
      trimMeshes.push(o);
    });
    for (const m of trimMeshes) m.visible = false;

    // Reveal the shell by scaling a wrapper pivoted at its own visual
    // centre — scaling shellMesh directly pivots around the GLB node's
    // authored origin (not the body's geometric centre), which made a
    // mid-reveal car look like it was imploding toward one corner instead
    // of growing cleanly into place.
    let shellPivot: THREE.Group | null = null;
    if (shellMesh) {
      shellMesh.geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      shellMesh.geometry.boundingBox!.getCenter(center);
      shellPivot = new THREE.Group();
      shellPivot.position.copy(center);
      shellMesh.parent!.add(shellPivot);
      shellPivot.add(shellMesh);
      shellMesh.position.sub(center);
      // Hidden until the Panel station installs it — scaled up from 0 at
      // the reveal beat (see useFrame).
      shellPivot.scale.setScalar(0);
    }

    return { body: root, shell: shellPivot, wheels: wheelObjs, trim: trimMeshes, paintUniforms };
  }, [gltf, paletteColor]);

  useFrame(() => {
    if (!car || !groupRef.current) return;
    if (useStore.getState().paused) return;
    const elapsed = Date.now() - car.dockedAt;

    // ---- X/Z glide between slots ----
    if (car.dockedAt !== prevDockedAt.current) {
      fromPos.current.copy(groupRef.current.position);
      const [tx, tz] = targetFor(car.stationIndex);
      toPos.current.set(tx, 0, tz);
      prevDockedAt.current = car.dockedAt;
    }
    const gt = THREE.MathUtils.clamp(elapsed / SNAP_TRANSITION_MS, 0, 1);
    const smoothT = gt * gt * (3 - 2 * gt);
    const nx = THREE.MathUtils.lerp(fromPos.current.x, toPos.current.x, smoothT);
    const nz = THREE.MathUtils.lerp(fromPos.current.z, toPos.current.z, smoothT);

    const moved = Math.hypot(nx - groupRef.current.position.x, nz - groupRef.current.position.z);
    groupRef.current.position.set(nx, CONVEYOR_Y, nz);
    if (moved > 0) {
      const roll = moved / WHEEL_RADIUS;
      for (const w of wheels) if (w.visible) w.rotation.x += roll;
    }

    // ---- per-station visual state, keyed to the same phase clocks the
    //      matching RobotArm reads (stationTargets.ts) so the two stay in sync. ----
    const station = car.stationIndex;

    // Panel: reveal the body shell (and the whole trimmed-out interior/glass
    // it normally conceals) together on the reveal beat.
    if (station === PANEL_STATION) {
      const ph = panelPhase(elapsed);
      const revealed = ph.reveal > 0.001;
      if (shell) {
        const s = ph.reveal > 0 ? ph.reveal : 0;
        shell.scale.setScalar(s);
        shell.visible = revealed;
      }
      for (const m of trim) m.visible = revealed;
    } else if (station >= 0 && station <= EXIT_STATION_INDEX) {
      // Past the panel station: body is fully revealed.
      for (const m of trim) m.visible = true;
      if (shell) {
        shell.scale.setScalar(1);
        shell.visible = true;
      }
    }

    // Paint: a literal spray front travels front→rear as the sweep passes
    // over, rather than the whole body fading colour uniformly — the shader
    // injected in the useMemo above mixes primer/final colour per-fragment
    // against this X threshold, in the same carFrame the sweep is authored in.
    if (paintUniforms) {
      if (station === PAINT_STATION) {
        const p = paintSweepProgress(elapsed);
        paintUniforms.uPaintX.value = THREE.MathUtils.lerp(PAINT_SWEEP_FRONT.x, PAINT_SWEEP_REAR.x, p);
      } else if (station === PANEL_STATION || station < 0) {
        // Not yet painted: front parked well before the car, all primer.
        paintUniforms.uPaintX.value = PAINT_SWEEP_FRONT.x - 2;
      } else {
        // Past paint: front parked well past the car, fully painted.
        paintUniforms.uPaintX.value = PAINT_SWEEP_REAR.x + 2;
      }
    }

    // Wheel: two machines mount their own axle pair each (see
    // stationTargets.ts's WHEEL_GROUPS), both pairs landing on the same
    // mount pulse — flip all 4 wheels visible together at that instant.
    if (station === WHEEL_STATION) {
      const ph = wheelMountPhase(elapsed);
      if (isWheelMounted(ph)) {
        for (const w of wheels) w.visible = true;
      }
    } else if (station === EXIT_STATION_INDEX) {
      // Off the line, riding on its own wheels.
      for (const w of wheels) w.visible = true;
    } else {
      // Pre-wheel stations: wheels not yet mounted.
      for (const w of wheels) w.visible = false;
    }
  });

  return (
    <group ref={groupRef} position={[LINE_START_X, CONVEYOR_Y, 0]}>
      <primitive object={body} />
      {car?.flaggedRobotId && (
        <mesh position={[0.3, 1.5, 0]}>
          <coneGeometry args={[0.2, 0.45, 4]} />
          <meshStandardMaterial color={COLORS.critical} emissive={COLORS.critical} emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}