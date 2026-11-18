// Street furniture: benches, planters, lamps and trees. Built life-size and
// scaled to the people (who are drawn a touch larger than life). Origins are
// at the footprint centre on the ground; benches face +x.
import type { ThreeElements } from '@react-three/fiber';
import { glow, matte, metal, PALETTE, plastic } from '@/scene/style';
import { cyl, mergedBoxes, rbox, sphere, type BoxSpec } from '@/scene/props/kit';
import { Part } from '@/scene/props/Part';
import { PERSON_SCALE } from '@/scene/props/personRig';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

/** Seat height of a bench, life size: a seated person's hips land here. */
export const BENCH_SEAT = 0.47;

function benchSlats() {
  return mergedBoxes('benchSlats', () => {
    const out: BoxSpec[] = [];
    for (let i = 0; i < 4; i++) out.push({ size: [0.1, 0.035, 1.5], pos: [-0.2 + i * 0.12, BENCH_SEAT - 0.02, 0], r: 0.012 });
    for (let i = 0; i < 3; i++) out.push({ size: [0.035, 0.09, 1.5], pos: [-0.3 - i * 0.02, BENCH_SEAT + 0.12 + i * 0.12, 0], rot: [0, 0, 0.18], r: 0.012 });
    return out;
  });
}

function benchFrame() {
  return mergedBoxes('benchFrame', () => {
    const out: BoxSpec[] = [];
    for (const z of [-0.62, 0.62]) {
      out.push({ size: [0.06, BENCH_SEAT - 0.04, 0.06], pos: [0.12, (BENCH_SEAT - 0.04) / 2, z], r: 0.015 });
      out.push({ size: [0.06, BENCH_SEAT + 0.38, 0.06], pos: [-0.3, (BENCH_SEAT + 0.38) / 2, z], rot: [0, 0, 0.1], r: 0.015 });
      out.push({ size: [0.5, 0.05, 0.06], pos: [-0.06, BENCH_SEAT - 0.06, z], r: 0.015 });
    }
    return out;
  });
}

/** Park bench, 1.5 long on z, seat facing +x. */
export function Bench(props: GroupProps) {
  return (
    <group {...props}>
      <group scale={PERSON_SCALE}>
        <Part g={benchSlats()} m={matte(PALETTE.palletWood, 0.6)} />
        <Part g={benchFrame()} m={plastic(PALETTE.graphite, 0.4)} />
      </group>
    </group>
  );
}

/** A tree: a tapering trunk and a cluster of soft foliage balls. */
export function Tree({ size = 1, seed = 1, ...props }: GroupProps & { size?: number; seed?: number }) {
  const lean = ((seed * 37) % 7) * 0.02 - 0.06;
  const leaf = matte(seed % 2 ? PALETTE.foliage : PALETTE.foliageDark, 0.7);
  const leafLight = matte(PALETTE.foliage, 0.7);
  return (
    <group {...props} scale={size}>
      <Part g={cyl(0.08, 0.13, 1.9, 12)} m={matte(PALETTE.bark, 0.8)} position-y={0.95} rotation-z={lean} />
      <Part g={sphere(0.85, 18, 12)} m={leaf} position={[0, 2.35, 0]} scale={[1, 0.88, 1]} />
      <Part g={sphere(0.6, 16, 10)} m={leafLight} position={[0.45, 2.05, 0.3]} />
      <Part g={sphere(0.55, 16, 10)} m={leaf} position={[-0.4, 2.1, -0.35]} />
      <Part g={sphere(0.5, 16, 10)} m={leafLight} position={[0.1, 2.85, -0.2]} />
    </group>
  );
}

/** Square planter box with a small tree in it. */
export function Planter({ seed = 1, ...props }: GroupProps & { seed?: number }) {
  return (
    <group {...props}>
      <Part g={rbox(1.0, 0.5, 1.0, 0.06, 3)} m={plastic(PALETTE.paving, 0.5)} position-y={0.25} />
      <Part g={rbox(0.88, 0.04, 0.88, 0.02, 2)} m={matte('#4a3a2c', 0.9)} position-y={0.5} castShadow={false} />
      <Tree position-y={0.48} size={0.72} seed={seed} />
    </group>
  );
}

/** Street lamp, about 3.4 tall, the head reaching toward +x. */
export function StreetLamp(props: GroupProps) {
  const pole = metal(PALETTE.graphite, 0.4);
  return (
    <group {...props}>
      <Part g={cyl(0.12, 0.15, 0.2, 16)} m={pole} position-y={0.1} />
      <Part g={cyl(0.045, 0.06, 3.3, 12)} m={pole} position-y={1.75} />
      <Part g={rbox(0.7, 0.06, 0.08, 0.025, 2)} m={pole} position={[0.3, 3.38, 0]} />
      <Part g={rbox(0.42, 0.1, 0.24, 0.04, 3)} m={plastic(PALETTE.graphite, 0.35)} position={[0.58, 3.34, 0]} />
      <mesh geometry={rbox(0.36, 0.02, 0.18, 0.008, 1)} material={glow('#fff4dc', 1.4)} position={[0.58, 3.285, 0]} />
    </group>
  );
}
