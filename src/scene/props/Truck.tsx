// TechDealz delivery truck: a cab-over box truck about 7.1 long. Origin at
// the ground under its centre, length along x, cab at +x, roller door at -x.
import type { ThreeElements } from '@react-three/fiber';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { cyl, decal, mergedBoxes, quad, rbox, studioWhite, torus, wordmarkTexture, type BoxSpec } from './kit';
import { Part } from './Part';
import { Wheel } from './Wheel';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const HALF = Math.PI / 2;

// Box body.
const BOX = { x0: -3.52, x1: 1.82, w: 2.4, y0: 1.08, h: 2.42 } as const;
// Cab.
const CAB = { x0: 1.96, x1: 3.5, w: 2.3, y0: 1.04, h: 1.74 } as const;
const WHEEL_R = 0.5;
const FRONT_AXLE = 2.62;
const REAR_AXLES = [-1.62, -2.72];

function doorGeometry() {
  return mergedBoxes('truckDoor', () => {
    const out: BoxSpec[] = [];
    const n = 15;
    const h = 2.08 / n;
    for (let i = 0; i < n; i++) out.push({ size: [0.04, h - 0.012, 2.02], pos: [0, 0.14 + h / 2 + i * h, 0], r: 0.014 });
    return out;
  });
}

function grilleGeometry() {
  return mergedBoxes('truckGrille', () => {
    const out: BoxSpec[] = [];
    for (let i = 0; i < 5; i++) out.push({ size: [0.03, 0.035, 1.5], pos: [0, -0.2 + i * 0.1, 0], r: 0.012 });
    return out;
  });
}

export interface TruckProps extends GroupProps {
  /** Cab paint. Defaults to the TechDealz yellow; white gives the second
   *  truck from the reference. */
  cabColor?: string;
}

export function Truck({ cabColor = PALETTE.tdzYellow, ...props }: TruckProps) {
  const paint = plastic(studioWhite(cabColor, 0.5), 0.4);
  const white = plastic(PALETTE.offWhite, 0.36);
  const dark = plastic(PALETTE.graphite, 0.45);
  const black = plastic('#1d1e22', 0.4);
  const glassDark = plastic('#1a222d', 0.06);
  const alu = metal(PALETTE.steel, 0.32);
  const lamp = glow('#fff6e0', 1.3);
  const boxLen = BOX.x1 - BOX.x0;
  const boxCx = (BOX.x0 + BOX.x1) / 2;
  const cabLen = CAB.x1 - CAB.x0;
  const cabCx = (CAB.x0 + CAB.x1) / 2;
  const cabCy = CAB.y0 + CAB.h / 2;
  const cabTop = CAB.y0 + CAB.h;
  const sideZ = CAB.w / 2;
  const logo = decal('wordmark', wordmarkTexture, 0.4);

  return (
    <group {...props}>
      {/* ---- chassis ---- */}
      <Part g={rbox(6.5, 0.22, 0.86, 0.04, 2)} m={dark} position={[-0.1, 0.78, 0]} />
      {[FRONT_AXLE, ...REAR_AXLES].map((x) => (
        <Part key={x} g={cyl(0.07, 0.07, 2.0, 12)} m={dark} position={[x, WHEEL_R, 0]} rotation-x={HALF} />
      ))}
      {[1, -1].map((s) => (
        <group key={s}>
          <Wheel r={WHEEL_R} w={0.32} nuts position={[FRONT_AXLE, WHEEL_R, s * 0.98]} />
          {REAR_AXLES.map((x) => (
            <Wheel key={x} r={WHEEL_R} w={0.52} nuts position={[x, WHEEL_R, s * 0.92]} />
          ))}
          {/* Front mudguard arching over the tyre. */}
          <Part g={torus(WHEEL_R + 0.1, 0.06, 20, Math.PI)} m={dark} position={[FRONT_AXLE, WHEEL_R, s * 0.98]} scale={[1, 1, 3]} />
          {/* Rear mudguard strip and flap. */}
          <Part g={rbox(2.36, 0.05, 0.56, 0.02, 2)} m={dark} position={[-2.17, 1.045, s * 0.92]} />
          <Part g={rbox(0.03, 0.5, 0.52, 0.012, 1)} m={matte(PALETTE.rubber, 0.7)} position={[-3.36, 0.72, s * 0.92]} />
          {/* Fuel tank and side underrun guard between the axles. */}
          <Part g={cyl(0.27, 0.27, 0.95, 20)} m={alu} position={[0.95, 0.68, s * 0.84]} rotation-z={HALF} />
          {[0.72, 1.18].map((x) => (
            <Part key={x} g={torus(0.275, 0.018, 20)} m={dark} position={[x, 0.68, s * 0.84]} rotation-y={HALF} />
          ))}
          {[0.58, 0.82].map((y) => (
            <Part key={y} g={rbox(1.5, 0.08, 0.035, 0.014, 2)} m={alu} position={[-0.42, y, s * 1.14]} />
          ))}
          {[-1.0, 0.2].map((x) => (
            <Part key={x} g={rbox(0.05, 0.5, 0.03, 0.012, 1)} m={dark} position={[x, 0.76, s * 1.12]} />
          ))}
        </group>
      ))}
      {/* Rear underrun bar and lamps. */}
      <Part g={rbox(0.1, 0.16, 2.36, 0.03, 2)} m={dark} position={[-3.5, 0.66, 0]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={rbox(0.03, 0.1, 0.3, 0.012, 2)} material={glow(PALETTE.critical, 1.3)} position={[-3.555, 0.66, s * 0.92]} />
          <mesh geometry={rbox(0.03, 0.1, 0.12, 0.012, 2)} material={glow(PALETTE.amber, 1.2)} position={[-3.555, 0.66, s * 0.66]} />
        </group>
      ))}

      {/* ---- box body ---- */}
      <Part g={rbox(boxLen, BOX.h, BOX.w, 0.05, 4)} m={white} position={[boxCx, BOX.y0 + BOX.h / 2, 0]} />
      {/* Aluminium frame: bottom rail, roof rail, corner posts. */}
      <Part g={rbox(boxLen + 0.03, 0.12, BOX.w + 0.03, 0.03, 2)} m={alu} position={[boxCx, BOX.y0 + 0.04, 0]} />
      <Part g={rbox(boxLen + 0.03, 0.07, BOX.w + 0.03, 0.03, 2)} m={alu} position={[boxCx, BOX.y0 + BOX.h - 0.02, 0]} />
      {[BOX.x0, BOX.x1].map((x) =>
        [1, -1].map((s) => (
          <Part key={`${x}${s}`} g={rbox(0.09, BOX.h, 0.09, 0.03, 2)} m={alu} position={[x + (x < 0 ? 0.03 : -0.03), BOX.y0 + BOX.h / 2, s * (BOX.w / 2 - 0.03)]} />
        )),
      )}
      {/* Wordmark on both sides, reading left to right on each. */}
      <Part g={quad(4.5, 1.125)} m={logo} position={[boxCx, BOX.y0 + BOX.h * 0.53, BOX.w / 2 + 0.004]} castShadow={false} />
      <Part g={quad(4.5, 1.125)} m={logo} position={[boxCx, BOX.y0 + BOX.h * 0.53, -BOX.w / 2 - 0.004]} rotation-y={Math.PI} castShadow={false} />
      {/* Rear roller door in its frame, with handle and lock. */}
      <group position={[BOX.x0 - 0.012, BOX.y0, 0]}>
        <Part g={doorGeometry()} m={plastic(PALETTE.steel, 0.4)} />
        <Part g={rbox(0.06, 0.1, 2.16, 0.02, 2)} m={alu} position={[0, 0.09, 0]} />
        <Part g={rbox(0.06, 0.1, 2.16, 0.02, 2)} m={alu} position={[0, 2.29, 0]} />
        <Part g={rbox(0.05, 0.05, 0.3, 0.016, 2)} m={black} position={[-0.035, 0.3, 0]} />
        <Part g={rbox(0.04, 0.12, 0.08, 0.014, 2)} m={black} position={[-0.03, 0.18, 0.7]} />
      </group>

      {/* ---- cab ---- */}
      <Part g={rbox(cabLen, CAB.h, CAB.w, 0.16, 6)} m={paint} position={[cabCx, cabCy, 0]} />
      {/* Nose below the windscreen, ahead of the wheel arch. */}
      <Part g={rbox(0.36, 0.52, CAB.w, 0.1, 4)} m={paint} position={[CAB.x1 - 0.18, 0.86, 0]} />
      {/* Bumper with headlamps and indicators. */}
      <Part g={rbox(0.32, 0.3, CAB.w + 0.04, 0.09, 4)} m={dark} position={[CAB.x1 - 0.1, 0.56, 0]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={rbox(0.05, 0.13, 0.36, 0.03, 3)} material={lamp} position={[CAB.x1 + 0.045, 0.6, s * 0.8]} />
          <mesh geometry={rbox(0.05, 0.13, 0.11, 0.03, 3)} material={glow(PALETTE.amber, 1.3)} position={[CAB.x1 + 0.04, 0.6, s * 1.04]} />
        </group>
      ))}
      {/* Grille. */}
      <Part g={rbox(0.05, 0.62, 1.72, 0.05, 3)} m={black} position={[CAB.x1 + 0.005, 1.12, 0]} />
      <Part g={grilleGeometry()} m={alu} position={[CAB.x1 + 0.03, 1.12, 0]} />
      {/* Windscreen, side windows, visor. */}
      <Part g={rbox(0.06, 0.82, CAB.w - 0.26, 0.06, 4)} m={glassDark} position={[CAB.x1 + 0.002, 2.1, 0]} />
      <Part g={rbox(0.36, 0.09, CAB.w - 0.08, 0.035, 3)} m={dark} position={[CAB.x1 + 0.1, 2.6, 0]} rotation-z={-0.2} />
      {[-0.5, 0.5].map((z) => (
        <Part key={z} g={rbox(0.014, 0.014, 0.6, 0.005, 1)} m={black} position={[CAB.x1 + 0.036, 1.76, z]} rotation-x={0.12 * Math.sign(z)} castShadow={false} />
      ))}
      {[1, -1].map((s) => (
        <group key={s}>
          <Part g={rbox(0.74, 0.7, 0.05, 0.05, 3)} m={glassDark} position={[CAB.x1 - 0.56, 2.14, s * (sideZ - 0.02)]} />
          {/* Door seams, handle and step. */}
          <Part g={rbox(0.014, 1.5, 0.012, 0.004, 1)} m={dark} position={[CAB.x1 - 1.02, 1.86, s * (sideZ + 0.001)]} castShadow={false} />
          <Part g={rbox(0.014, 0.66, 0.012, 0.004, 1)} m={dark} position={[CAB.x1 - 0.14, 1.44, s * (sideZ + 0.001)]} castShadow={false} />
          <Part g={rbox(0.16, 0.045, 0.035, 0.014, 2)} m={black} position={[CAB.x1 - 0.86, 1.62, s * (sideZ + 0.012)]} />
          <Part g={rbox(0.4, 0.05, 0.16, 0.02, 2)} m={alu} position={[CAB.x1 - 0.2, 0.76, s * (sideZ - 0.03)]} />
          {/* Mirror on its arm. */}
          <Part g={rbox(0.05, 0.05, 0.3, 0.02, 2)} m={black} position={[CAB.x1 - 0.08, 2.42, s * (sideZ + 0.12)]} />
          <Part g={rbox(0.05, 0.05, 0.3, 0.02, 2)} m={black} position={[CAB.x1 - 0.08, 1.86, s * (sideZ + 0.12)]} />
          <Part g={rbox(0.1, 0.64, 0.2, 0.045, 3)} m={black} position={[CAB.x1 - 0.06, 2.14, s * (sideZ + 0.29)]} />
          {/* Roof marker lamps. */}
          <mesh geometry={rbox(0.06, 0.035, 0.12, 0.014, 2)} material={glow(PALETTE.amber, 1.2)} position={[CAB.x1 - 0.2, cabTop + 0.01, s * 0.72]} />
        </group>
      ))}
      {/* Roof air deflector closing the gap up to the box. */}
      <Part g={rbox(1.1, 0.5, CAB.w - 0.3, 0.2, 5)} m={paint} position={[cabCx - 0.16, cabTop + 0.14, 0]} rotation-z={0.2} />
      {/* Cab back wall equipment: exhaust stack. */}
      <Part g={cyl(0.06, 0.06, 1.5, 12)} m={alu} position={[CAB.x0 - 0.07, 1.9, -0.86]} />
    </group>
  );
}
