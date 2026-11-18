import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR_HEIGHT, CAR_LENGTH, CAR_WIDTH, COLORS, WHEEL_RADIUS } from './constants';

// The car on this line, built parametrically - same approach the robot arms
// already take (see RobotArm.tsx), and for the same reason: every part the
// choreography needs to address (the painted shell, the glass, each wheel
// hub) is something we name and position ourselves, instead of something we
// go looking for inside a mesh somebody else authored.
//
// It is deliberately a generic mass-market 5-door - the Corolla / Civic /
// Focus / Sentra silhouette. That is what a high-volume body shop welds.
// This demo previously used the Ferrari 458 from the three.js car example,
// which was wrong twice over: an exotic is not built on a walking-beam line
// at this cadence, and a 1.7MB DRACO mesh dragged in ~30 separate interior
// meshes plus a vendored decoder to render a car the camera never gets
// inside of.
//
// Everything here is authored directly in carFrame metres (see
// stationTargets.ts): +x is toward the rear, y rises from the wheel contact
// patch, z runs across the width with −z the near side facing the robots.
// That is the same frame the station targets are written in, so there is no
// fitting/normalising step and no scale factor to keep in sync - a vertex's
// own x *is* the position the paint sweep is measured against.

// ---- silhouette (metres) ----
// One coherent set, sized to the CAR_LENGTH / CAR_WIDTH / CAR_HEIGHT
// envelope the station targets are authored against. The profile touches
// both x extremes and the roof, so the finished body measures exactly the
// declared envelope rather than approximately it.
const HL = CAR_LENGTH / 2; // 2.30 - nose at −HL, tail at +HL
const SILL_Y = 0.42; // underside of the painted body; the wheels carry it
const BELT_Y = 1.01; // window sill / shoulder line
const ROOF_Y = CAR_HEIGHT;
const AXLE_Y = WHEEL_RADIUS;
const FRONT_AXLE_X = -1.45;
const REAR_AXLE_X = 1.45;
/** Wheel arch radius. Clearance over the tire, not a tight wrap - a real
 *  arch has gap, and a tight one reads as a wheel jammed into the panel. */
const ARCH_R = WHEEL_RADIUS + 0.13;
/** Half-track. Puts the tire's outer wall just inside the body side, so the
 *  wheels read as tucked under the arches rather than bolted onto them. */
const TRACK_HALF = CAR_WIDTH / 2 - 0.13;
const TIRE_WIDTH = 0.22;
/** Rounds the body's side edges. Without it an extruded profile reads as a
 *  flat cutout of a car rather than a car. */
const BEVEL = 0.035;

export const WHEEL_NAMES = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] as const;
export type WheelName = (typeof WHEEL_NAMES)[number];

/** Each wheel's carFrame hub offset. Stated, not measured: the arms reach
 *  for these exact points (stationTargets.ts) and the wheels are mounted at
 *  them, so one declaration drives both and they cannot drift apart. */
export const WHEEL_HUB_OFFSETS: Record<WheelName, THREE.Vector3> = {
  wheel_fl: new THREE.Vector3(FRONT_AXLE_X, AXLE_Y, -TRACK_HALF),
  wheel_fr: new THREE.Vector3(FRONT_AXLE_X, AXLE_Y, TRACK_HALF),
  wheel_rl: new THREE.Vector3(REAR_AXLE_X, AXLE_Y, -TRACK_HALF),
  wheel_rr: new THREE.Vector3(REAR_AXLE_X, AXLE_Y, TRACK_HALF),
};

/** Walk the sill rearward→forward, arching up over one wheel. The arch is
 *  part of the outline rather than a hole: it is a notch in the body's lower
 *  edge, which is what a wheel well actually is. */
function archOver(s: THREE.Shape, axleX: number) {
  const dy = SILL_Y - AXLE_Y;
  const dx = Math.sqrt(ARCH_R * ARCH_R - dy * dy);
  const a = Math.atan2(dy, dx);
  s.lineTo(axleX + dx, SILL_Y);
  // Counter-clockwise from the rear lip up over the apex to the front lip.
  s.absarc(axleX, AXLE_Y, ARCH_R, a, Math.PI - a, false);
}

/** The side profile, traced nose→roof→tail→sill. Extruding this across the
 *  width is what lets a single mesh be the whole painted shell. */
function bodyProfile(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-HL + 0.04, SILL_Y + 0.02);
  s.lineTo(-HL, 0.66); // bumper face
  s.lineTo(-HL + 0.08, 0.88); // over the headlight
  s.lineTo(-HL + 0.24, 0.95); // hood leading edge
  s.lineTo(-1.16, BELT_Y + 0.02); // cowl / base of the windshield
  s.lineTo(-0.4, ROOF_Y); // A-pillar rake
  s.lineTo(0.86, ROOF_Y); // roof
  s.lineTo(1.62, BELT_Y + 0.08); // C-pillar / rear glass rake
  s.lineTo(1.98, BELT_Y + 0.01); // hatch shoulder
  s.lineTo(HL - 0.04, 0.88);
  s.lineTo(HL, 0.62); // rear bumper face
  s.lineTo(HL - 0.04, SILL_Y + 0.02);
  archOver(s, REAR_AXLE_X);
  archOver(s, FRONT_AXLE_X);
  s.closePath();
  return s;
}

/** One geometry, shared by every car on the line. Only the body *material*
 *  is per-car (each carries its own palette colour and paint-sweep
 *  uniforms), so a car costs a handful of Mesh objects rather than a deep
 *  clone of a loaded scene graph. */
let bodyGeo: THREE.BufferGeometry | null = null;
export function carBodyGeometry(): THREE.BufferGeometry {
  if (bodyGeo) return bodyGeo;
  const g = new THREE.ExtrudeGeometry(bodyProfile(), {
    depth: CAR_WIDTH - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // ExtrudeGeometry builds from z=0 forward; centre it on the carFrame's z
  // axis. x is deliberately left alone - the paint-sweep shader reads each
  // vertex's own local x as its carFrame x, so shifting it here would
  // silently offset the spray front from the sweep the arm is performing.
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(0, 0, -(bb.min.z + bb.max.z) / 2);
  g.computeBoundingBox();
  bodyGeo = g;
  return g;
}

/** A flat pane in the XY plane, placed at a given z. Used for the side
 *  windows, whose opening is a face of the extrusion. */
function sidePane(pts: [number, number][], z: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape);
  g.translate(0, 0, z);
  return g;
}

/** A pane spanning a raked segment of the profile (windshield, rear glass),
 *  lifted clear of the body surface along that segment's own normal so it
 *  reads as glass set into an opening instead of z-fighting the panel. */
function rakedPane(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): THREE.BufferGeometry {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const g = new THREE.BoxGeometry(len, 0.016, width);
  g.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(dy, dx)));
  const lift = 0.014;
  g.translate((x1 + x2) / 2 - (dy / len) * lift, (y1 + y2) / 2 + (dx / len) * lift, 0);
  return g;
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

const GLASS_Z = CAR_WIDTH / 2 - 0.012;
const PANE_WIDTH = CAR_WIDTH - 0.18;

/** Windshield, rear glass, and a split side window per side - the B-pillar
 *  gap between the two is most of what reads a shape as a 5-door rather
 *  than a wedge. Merged into one mesh so the reveal at the Panel station is
 *  a handful of visibility flips, not thirty. */
let glassGeo: THREE.BufferGeometry | null = null;
export function carGlassGeometry(): THREE.BufferGeometry {
  if (glassGeo) return glassGeo;
  const frontSide: [number, number][] = [
    [-0.28, 1.06],
    [0.24, 1.06],
    [0.24, 1.34],
    [-0.06, 1.34],
  ];
  const rearSide: [number, number][] = [
    [0.36, 1.06],
    [1.08, 1.06],
    [0.8, 1.34],
    [0.36, 1.34],
  ];
  glassGeo = mergeGeometries([
    rakedPane(-1.16, BELT_Y + 0.02, -0.4, ROOF_Y, PANE_WIDTH), // windshield
    rakedPane(0.86, ROOF_Y, 1.62, BELT_Y + 0.08, PANE_WIDTH), // rear glass
    sidePane(frontSide, GLASS_Z),
    sidePane(frontSide, -GLASS_Z),
    sidePane(rearSide, GLASS_Z),
    sidePane(rearSide, -GLASS_Z),
  ]);
  return glassGeo;
}

let lightsGeo: THREE.BufferGeometry | null = null;
export function carLightsGeometry(): THREE.BufferGeometry {
  if (lightsGeo) return lightsGeo;
  lightsGeo = mergeGeometries([
    box(0.08, 0.14, 0.34, -HL + 0.1, 0.86, -0.6),
    box(0.08, 0.14, 0.34, -HL + 0.1, 0.86, 0.6),
    box(0.08, 0.2, 0.3, HL - 0.05, 0.86, -0.66),
    box(0.08, 0.2, 0.3, HL - 0.05, 0.86, 0.66),
  ]);
  return lightsGeo;
}

/** Door mirrors. Small, but they are the cheapest detail that stops a
 *  silhouette reading as a bar of soap. */
let trimGeo: THREE.BufferGeometry | null = null;
export function carTrimGeometry(): THREE.BufferGeometry {
  if (trimGeo) return trimGeo;
  const stalkZ = CAR_WIDTH / 2 + 0.03;
  const shellZ = CAR_WIDTH / 2 + 0.09;
  trimGeo = mergeGeometries([
    box(0.05, 0.05, 0.08, -0.5, 1.03, -stalkZ),
    box(0.05, 0.05, 0.08, -0.5, 1.03, stalkZ),
    box(0.11, 0.07, 0.07, -0.5, 1.05, -shellZ),
    box(0.11, 0.07, 0.07, -0.5, 1.05, shellZ),
  ]);
  return trimGeo;
}

/** The bare rolling platform: what a car *is* before the Panel station
 *  lowers a body onto it. Stays visible for the whole run and ends up
 *  entirely enclosed by the shell, so the Panel beat reads as a body being
 *  fitted to a chassis rather than a finished car blinking into existence -
 *  which is what the imported mesh could never do, since it arrived already
 *  built and the only "in progress" state available was hiding parts of it. */
let chassisGeo: THREE.BufferGeometry | null = null;
export function carChassisGeometry(): THREE.BufferGeometry {
  if (chassisGeo) return chassisGeo;
  chassisGeo = mergeGeometries([
    box(CAR_LENGTH - 0.5, 0.06, CAR_WIDTH - 0.3, 0, 0.46, 0), // floor pan
    box(CAR_LENGTH - 0.7, 0.1, 0.1, 0, 0.4, -0.62), // longitudinal rails
    box(CAR_LENGTH - 0.7, 0.1, 0.1, 0, 0.4, 0.62),
    box(0.1, 0.1, CAR_WIDTH - 0.36, FRONT_AXLE_X, 0.4, 0), // crossmembers
    box(0.1, 0.1, CAR_WIDTH - 0.36, REAR_AXLE_X, 0.4, 0),
    box(0.06, 0.32, CAR_WIDTH - 0.4, -1.1, 0.62, 0), // firewall
  ]);
  return chassisGeo;
}

// ---- materials ----
// Shared across every car: none of them carry per-car state. Only the body
// material is built per-car (CarShell.tsx), because it holds that car's
// palette colour and its own paint-sweep uniforms.

let glassMat: THREE.Material | null = null;
export function carGlassMaterial(): THREE.Material {
  if (glassMat) return glassMat;
  // DoubleSide because the side panes are single quads seen from both the
  // outside and (through the far window) the inside; `transmission` is
  // avoided throughout this scene because its offscreen backdrop pass comes
  // back empty under the postprocessing composer and renders glass solid
  // black. A Fresnel-weighted alpha gets the "transparent head-on, mirror at
  // a grazing angle" read without needing an extra pass.
  const m = new THREE.MeshPhysicalMaterial({
    color: COLORS.carGlass,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: 1.3,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseAlpha = { value: 0.46 };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBaseAlpha;')
      .replace(
        '#include <opaque_fragment>',
        '{ float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); diffuseColor.a = mix(uBaseAlpha, 1.0, fresnel); }\n#include <opaque_fragment>',
      );
  };
  glassMat = m;
  return m;
}

let lightsMat: THREE.Material | null = null;
export function carLightsMaterial(): THREE.Material {
  if (lightsMat) return lightsMat;
  lightsMat = new THREE.MeshPhysicalMaterial({
    color: '#eef5fb',
    metalness: 0,
    roughness: 0.08,
    clearcoat: 1,
    emissive: '#fff6e0',
    emissiveIntensity: 0.1,
    envMapIntensity: 1.4,
  });
  return lightsMat;
}

let trimMat: THREE.Material | null = null;
export function carTrimMaterial(): THREE.Material {
  if (trimMat) return trimMat;
  trimMat = new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.5, metalness: 0.2 });
  return trimMat;
}

let chassisMat: THREE.Material | null = null;
export function carChassisMaterial(): THREE.Material {
  if (chassisMat) return chassisMat;
  chassisMat = new THREE.MeshStandardMaterial({
    color: '#4b5057',
    roughness: 0.55,
    metalness: 0.75,
  });
  return chassisMat;
}

interface WheelParts {
  tireGeo: THREE.BufferGeometry;
  rimGeo: THREE.BufferGeometry;
  tireMat: THREE.Material;
  rimMat: THREE.Material;
}
let wheelParts: WheelParts | null = null;

/** Shared wheel geometry and materials, built once. The axle runs across
 *  the car (carFrame z), so a wheel's own z rotation is roll as the car
 *  travels along x. */
export function carWheelParts(): WheelParts {
  if (wheelParts) return wheelParts;
  // CylinderGeometry is authored along +y; lay it on its side.
  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, TIRE_WIDTH, 24, 1);
  tireGeo.rotateX(Math.PI / 2);
  // Slightly wider than the tire, so the rim face shows on both sides and
  // one wheel works at either end of an axle with no handedness.
  const rimGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, TIRE_WIDTH + 0.01, 16, 1);
  rimGeo.rotateX(Math.PI / 2);
  wheelParts = {
    tireGeo,
    rimGeo,
    tireMat: new THREE.MeshStandardMaterial({ color: COLORS.carWheel, roughness: 0.85, metalness: 0.05 }),
    rimMat: new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.3, metalness: 0.9, envMapIntensity: 1.2 }),
  };
  return wheelParts;
}

/** One freestanding wheel, for the Wheel station's rack and the wheel riding
 *  the gripper. Fresh group per call (an Object3D lives in one place in the
 *  graph at a time), shared geometry and materials underneath. */
export function buildWheel(): THREE.Group {
  const { tireGeo, rimGeo, tireMat, rimMat } = carWheelParts();
  const group = new THREE.Group();
  for (const m of [new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, rimMat)]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
