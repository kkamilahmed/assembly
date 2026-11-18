import * as THREE from 'three';
import { SHOULDER_Y } from './constants';

/** Cubic smoothstep, 0 at t≤0 and 1 at t≥1. Duration-based (not the
 *  asymptotic `damp`), so a gliding car / sweeping arm actually *settles*
 *  at the endpoint instead of forever chasing it. */
export function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export interface TwoBoneSolution {
  baseYaw: number;
  upperTilt: number;
  foreTilt: number;
}

/** Triangle (sine) envelope: 0 → 1 → 0 across `[startMs, startMs + durationMs]`,
 *  peaking at the midpoint, and exactly 0 outside the window. One beat of a
 *  station's choreography - a weld dart, a wheel mount, a paint sweep - is a
 *  sequence of these instead of one rigid per-event pulse, which is what
 *  lets the existing `animStyle` machinery extend to multi-beat sequences.
 *
 *  `elapsedMs` and `startMs` share one clock (wall or render - the caller's
 *  choice); the helper is unit-agnostic. Mirrors the previous inline
 *  `dab = sin(pulseT * PI)` math from RobotArm's useFrame, extracted so every
 *  station can reuse it. */
export function triangleEnvelope(elapsedMs: number, startMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const t = (elapsedMs - startMs) / durationMs;
  if (t < 0 || t > 1) return 0;
  return Math.sin(t * Math.PI);
}

/** Analytic 2-bone IK for the RobotArm kinematic chain. Convention (matches
 *  the authored rest poses in RobotArm.tsx): `baseYaw` rotates about Y to aim
 *  the arm horizontally at the target; the upper link and forearm then move
 *  in the single vertical plane between +Y (straight up) and +Z (forward,
 *  post-yaw) - the same assumption already baked into today's hand-tuned
 *  poses, so base yaw + two tilts fully describe the reach.
 *
 *  `targetLocal` is relative to the robot's ground origin (the outer group
 *  at `[ROBOT_X, 0, ROBOT_Z]`); `shoulderHeight` (default 0.7, matching the
 *  base-pivot group's `position={[0, 0.7, 0]}` in RobotArm.tsx) lifts the
 *  shoulder above that origin before solving. Reach distance is clamped to
 *  `0.98·(upper+fore)` so an unreachable target never yields `NaN` from
 *  `acos`, and floored at `|upper-fore|` so a target inside the linkage's
 *  inner dead zone still produces a sane folded pose. Elbow config is fixed
 *  to "elbow up" - the natural reaching pose for an industrial arm coming
 *  down onto a car (elbow high, forearm reaching forward/down to the target). */
export function solveTwoBoneIK(
  targetLocal: THREE.Vector3,
  upperLen: number,
  forearmLen: number,
  shoulderHeight = SHOULDER_Y,
): TwoBoneSolution {
  // Shoulder-relative target: lift off the ground origin by shoulderHeight.
  const sx = targetLocal.x;
  const sy = targetLocal.y - shoulderHeight;
  const sz = targetLocal.z;

  // Horizontal aim: the upper+fore plane is rotated about Y so the arm
  // faces the target. x = r·sin(yaw), z = r·cos(yaw) → yaw = atan2(x, z).
  const baseYaw = Math.atan2(sx, sz);
  const r = Math.hypot(sx, sz);
  const y = sy;

  const maxReach = 0.98 * (upperLen + forearmLen);
  const minReach = Math.max(Math.abs(upperLen - forearmLen) * 1.02, 1e-3);
  let D = Math.hypot(r, y);
  if (D > maxReach) D = maxReach;
  if (D < minReach) D = minReach;

  // Angle at the shoulder between shoulder→target and shoulder→elbow
  // (law of cosines on the shoulder-elbow-target triangle).
  const cosShoulderOffset = THREE.MathUtils.clamp(
    (upperLen * upperLen + D * D - forearmLen * forearmLen) / (2 * upperLen * D),
    -1,
    1,
  );
  const shoulderOffset = Math.acos(cosShoulderOffset);

  // Direction of shoulder→target from +Y (straight up), in the r/y plane.
  const reachAngle = Math.atan2(r, y);

  // Elbow up: the upper arm sits more vertical than the target line, so the
  // elbow rises above and the forearm reaches down/forward onto the target.
  const upperTilt = reachAngle - shoulderOffset;

  // Forearm absolute angle from +Y, then foreTilt is relative to upperTilt.
  const foreAngle = Math.atan2(
    r - upperLen * Math.sin(upperTilt),
    y - upperLen * Math.cos(upperTilt),
  );
  const foreTilt = foreAngle - upperTilt;

  return { baseYaw, upperTilt, foreTilt };
}