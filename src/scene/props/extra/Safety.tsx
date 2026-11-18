// Floor safety kit: bollards, retractable belt barriers and work mats.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { matte, PALETTE, plastic } from '@/scene/style';
import { cyl, merged, rbox, sphere } from '@/scene/props/kit';
import { Instances, Part } from '@/scene/props/Part';
import { at } from '@/scene/props/stockLayout';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const BOLLARD = { r: 0.075, h: 0.82 } as const;

function bollardBody() {
  return merged('bollardBody', () => {
    const { r, h } = BOLLARD;
    const post = cyl(r, r, h, 20).clone().translate(0, h / 2, 0);
    const cap = sphere(r, 20, 10).clone().scale(1, 0.6, 1).translate(0, h, 0);
    return [post, cap];
  });
}

function bollardTrim() {
  return merged('bollardTrim', () => {
    const { r } = BOLLARD;
    return [
      cyl(r + 0.05, r + 0.06, 0.035, 20).clone().translate(0, 0.0175, 0),
      cyl(r + 0.004, r + 0.004, 0.08, 20).clone().translate(0, 0.52, 0),
      cyl(r + 0.004, r + 0.004, 0.08, 20).clone().translate(0, 0.7, 0),
    ];
  });
}

/** Safety-yellow bollards with black bands, one per (x, z) point. */
export function Bollards({ points, ...props }: GroupProps & { points: Array<[number, number]> }) {
  const matrices = useMemo(() => points.map(([x, z]) => at(x, 0, z)), [points]);
  return (
    <group {...props}>
      <Instances g={bollardBody()} m={plastic(PALETTE.amber, 0.4)} matrices={matrices} />
      <Instances g={bollardTrim()} m={matte(PALETTE.hazardDark, 0.6)} matrices={matrices} />
    </group>
  );
}

function stanchionGeometry() {
  return merged('stanchion', () => [
    cyl(0.16, 0.18, 0.04, 22).clone().translate(0, 0.02, 0),
    cyl(0.03, 0.03, 0.9, 14).clone().translate(0, 0.47, 0),
  ]);
}

/** Retractable belt barrier: posts at each point, a blue belt between
 *  neighbours. */
export function BarrierRun({ points, ...props }: GroupProps & { points: Array<[number, number]> }) {
  const { posts, heads, belts } = useMemo(() => {
    const posts = points.map(([x, z]) => at(x, 0, z));
    const heads = points.map(([x, z]) => at(x, 0.92, z));
    const belts: Array<{ pos: [number, number, number]; yaw: number; len: number }> = [];
    for (let i = 1; i < points.length; i++) {
      const [x0, z0] = points[i - 1];
      const [x1, z1] = points[i];
      belts.push({ pos: [(x0 + x1) / 2, 0.92, (z0 + z1) / 2], yaw: -Math.atan2(z1 - z0, x1 - x0), len: Math.round(Math.hypot(x1 - x0, z1 - z0) * 100) / 100 });
    }
    return { posts, heads, belts };
  }, [points]);
  return (
    <group {...props}>
      <Instances g={stanchionGeometry()} m={plastic(PALETTE.graphite, 0.4)} matrices={posts} />
      <Instances g={cyl(0.045, 0.045, 0.1, 16)} m={plastic(PALETTE.brand, 0.4)} matrices={heads} />
      {belts.map((b, i) => (
        <Part key={i} g={rbox(b.len, 0.055, 0.008, 0.003, 1)} m={matte(PALETTE.brand, 0.6)} position={b.pos} rotation-y={b.yaw} />
      ))}
    </group>
  );
}

/** Anti-fatigue mat with a bevelled yellow border. `size` is x by z. */
export function FloorMat({ size, color = PALETTE.blueDeep, ...props }: GroupProps & { size: [number, number]; color?: string }) {
  const [w, d] = size;
  return (
    <group {...props}>
      <Part g={rbox(w, 0.024, d, 0.01, 2)} m={matte(PALETTE.amber, 0.7)} position-y={0.012} castShadow={false} />
      <Part g={rbox(w - 0.09, 0.03, d - 0.09, 0.012, 2)} m={matte(color, 0.85)} position-y={0.015} castShadow={false} />
    </group>
  );
}

