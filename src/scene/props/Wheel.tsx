// A wheel with a real tyre profile, a dished rim and a hub cap. The axle is
// along z; the origin is the wheel centre.
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, metal, PALETTE } from '@/scene/style';
import { cyl, torus, tyre } from './kit';
import { Part } from './Part';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

export function Wheel({
  r,
  w,
  rim,
  nuts = false,
  ...props
}: GroupProps & { r: number; w: number; rim?: THREE.Material; nuts?: boolean }) {
  const rimMat = rim ?? metal(PALETTE.steel, 0.3);
  const dark = matte(PALETTE.graphite, 0.6);
  const half = Math.PI / 2;
  return (
    <group {...props}>
      <Part g={tyre(r, w)} m={matte(PALETTE.rubber, 0.72)} />
      {/* Rim dish, set back from the tyre wall on both sides. */}
      <Part g={cyl(r * 0.6, r * 0.6, w * 0.78, 28)} m={rimMat} rotation-x={half} />
      {[1, -1].map((s) => (
        <group key={s} position-z={s * w * 0.39} rotation-y={s === 1 ? 0 : Math.PI}>
          <Part g={torus(r * 0.53, r * 0.05, 32)} m={rimMat} />
          <Part g={cyl(r * 0.2, r * 0.27, w * 0.2, 20)} m={rimMat} rotation-x={half} position-z={w * 0.08} />
          <Part g={cyl(r * 0.1, r * 0.1, w * 0.26, 14)} m={dark} rotation-x={half} position-z={w * 0.1} />
          {nuts &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <Part
                  key={i}
                  g={cyl(r * 0.04, r * 0.04, w * 0.08, 8)}
                  m={dark}
                  rotation-x={half}
                  position={[Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, w * 0.02]}
                  castShadow={false}
                />
              );
            })}
        </group>
      ))}
    </group>
  );
}
