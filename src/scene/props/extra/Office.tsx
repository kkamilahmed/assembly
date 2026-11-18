// The processing hub's office kit: analyst workstations and the big screens
// on the wall. Built life-size and scaled to the people. A workstation faces
// +x: the analyst sits at its origin looking along +x at the monitors.
import type { ThreeElements } from '@react-three/fiber';
import { screenMaterial, type ScreenKind } from '@/scene/buildings/kit';
import { matte, metal, PALETTE, plastic } from '@/scene/style';
import { cyl, mergedBoxes, rbox, type BoxSpec } from '@/scene/props/kit';
import { Part } from '@/scene/props/Part';
import { PERSON_SCALE } from '@/scene/props/personRig';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const TOP = 0.74;
const DESK = { l: 1.5, d: 0.72, front: 0.22 } as const;

function deskFrame() {
  return mergedBoxes('deskFrame', () => {
    const out: BoxSpec[] = [];
    const cx = DESK.front + DESK.d / 2;
    // Panel legs at the two ends leave the knee space open.
    for (const z of [-DESK.l / 2 + 0.04, DESK.l / 2 - 0.04]) out.push({ size: [DESK.d - 0.06, TOP - 0.03, 0.04], pos: [cx, (TOP - 0.03) / 2, z], r: 0.012 });
    out.push({ size: [0.03, 0.3, DESK.l - 0.1], pos: [cx + DESK.d / 2 - 0.06, TOP - 0.2, 0], r: 0.01 });
    return out;
  });
}

/** One monitor on its stand, screen facing -x (back toward the analyst). */
function Monitor({ z, kind, yaw = 0 }: { z: number; kind: ScreenKind; yaw?: number }) {
  const dark = plastic(PALETTE.tdzInk, 0.35);
  return (
    <group position={[DESK.front + DESK.d - 0.2, TOP, z]} rotation-y={yaw}>
      <Part g={rbox(0.16, 0.012, 0.2, 0.005, 1)} m={dark} position-y={0.006} />
      <Part g={cyl(0.018, 0.018, 0.2, 10)} m={metal(PALETTE.steelDark, 0.35)} position-y={0.11} />
      <Part g={rbox(0.035, 0.34, 0.56, 0.015, 2)} m={dark} position={[0, 0.36, 0]} />
      <mesh position={[-0.019, 0.36, 0]} rotation-y={-Math.PI / 2} material={screenMaterial(kind)}>
        <planeGeometry args={[0.52, 0.3]} />
      </mesh>
    </group>
  );
}

/** Desk, two monitors, keyboard and a desk chair. The analyst sits at the
 *  origin (place a seated Person there), facing +x. */
export function Desk({ screens = ['feed', 'chart'], ...props }: GroupProps & { screens?: [ScreenKind, ScreenKind] }) {
  const top = plastic('#f1f2f4', 0.4);
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={rbox(DESK.d, 0.035, DESK.l, 0.012, 2)} m={top} position={[DESK.front + DESK.d / 2, TOP - 0.0175, 0]} />
        <Part g={deskFrame()} m={plastic(PALETTE.graphite, 0.4)} />
        <Monitor z={-0.3} kind={screens[0]} yaw={0.12} />
        <Monitor z={0.3} kind={screens[1]} yaw={-0.12} />
        <Part g={rbox(0.16, 0.018, 0.44, 0.006, 1)} m={plastic('#d9dce1', 0.4)} position={[DESK.front + 0.17, TOP + 0.009, 0]} castShadow={false} />
        <Part g={rbox(0.1, 0.02, 0.06, 0.01, 1)} m={plastic('#d9dce1', 0.4)} position={[DESK.front + 0.2, TOP + 0.01, 0.34]} castShadow={false} />
        <Part g={cyl(0.04, 0.035, 0.1, 12)} m={plastic(PALETTE.orange, 0.4)} position={[DESK.front + 0.35, TOP + 0.05, -0.55]} />
        <DeskChair />
      </group>
    </group>
  );
}

/** Office chair at the origin, facing +x: seat 0.47 high. */
export function DeskChair(props: GroupProps) {
  const fabric = matte('#3c4553', 0.8);
  const frame = plastic(PALETTE.graphite, 0.4);
  return (
    <group {...props}>
      <Part g={rbox(0.46, 0.07, 0.46, 0.03, 2)} m={fabric} position={[-0.04, 0.435, 0]} />
      <Part g={rbox(0.06, 0.5, 0.42, 0.03, 2)} m={fabric} position={[-0.3, 0.74, 0]} rotation-z={0.08} />
      <Part g={cyl(0.03, 0.03, 0.3, 10)} m={frame} position={[-0.04, 0.24, 0]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <Part key={i} g={rbox(0.28, 0.03, 0.04, 0.012, 1)} m={frame} position={[-0.04 + Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14]} rotation-y={-a} />
        );
      })}
    </group>
  );
}

/** A big wall display: a dark bezel with a lit screen, facing +z. */
export function WallScreen({ size = [2.4, 1.35], kind, ...props }: GroupProps & { size?: [number, number]; kind: ScreenKind }) {
  const [w, h] = size;
  return (
    <group {...props}>
      <Part g={rbox(w + 0.12, h + 0.12, 0.08, 0.04, 2)} m={plastic(PALETTE.tdzInk, 0.3)} position-z={0.04} />
      <mesh position-z={0.085} material={screenMaterial(kind)}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}
