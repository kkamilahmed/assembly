// Containers for the tablet plant: stacking totes, wheeled ingredient bins,
// wheelie waste bins, fibre drums of powder and the carts they travel on,
// and sample trays of tablets. Origins are at the footprint centre on the
// ground.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, metal, PALETTE, plastic, tabletColor } from '@/scene/style';
import { cyl, mergedBoxes, rbox, rng, studioWhite, torus } from '@/scene/props/kit';
import { Instances, Part } from '@/scene/props/Part';
import { at } from '@/scene/props/stockLayout';
import { trayParts } from '@/scene/props/tablet';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const HALF = Math.PI / 2;
const WHITE = studioWhite(PALETTE.white, 0.68);
const POWDER = `#${tabletColor(0).multiplyScalar(0.86).getHexString()}`;

// ---------------------------------------------------------------- totes

const TOTE = { l: 0.6, w: 0.4, h: 0.3 } as const;

function toteGeometry() {
  return mergedBoxes('tote', () => [
    { size: [TOTE.l - 0.03, TOTE.h, TOTE.w - 0.03], pos: [0, TOTE.h / 2, 0], r: 0.03 },
    // Rolled rim and the two hand-grip bars under it.
    { size: [TOTE.l, 0.05, TOTE.w], pos: [0, TOTE.h - 0.03, 0], r: 0.018 },
    { size: [0.022, 0.035, 0.2], pos: [TOTE.l / 2 - 0.006, TOTE.h - 0.11, 0], r: 0.01 },
    { size: [0.022, 0.035, 0.2], pos: [-TOTE.l / 2 + 0.006, TOTE.h - 0.11, 0], r: 0.01 },
  ]);
}

export interface ToteStackSpec {
  /** Position of the stack on the floor (x, z) and its yaw. */
  at: [number, number];
  yaw?: number;
  /** Height the stack starts at (for totes on a table or scale). */
  y?: number;
  count: number;
  color?: 'blue' | 'white' | 'orange';
  /** What the top tote shows: a lid, its empty inside, or powder. */
  top?: 'lid' | 'open' | 'powder';
}

const TOTE_COLOR = { blue: PALETTE.blue, white: WHITE, orange: PALETTE.orange } as const;

/** Any number of stacks of euro totes, instanced per colour. */
export function ToteStacks({ stacks, seed = 1, ...props }: GroupProps & { stacks: ToteStackSpec[]; seed?: number }) {
  const layout = useMemo(() => {
    const rand = rng(seed * 31 + 7);
    const bodies: Record<'blue' | 'white' | 'orange', THREE.Matrix4[]> = { blue: [], white: [], orange: [] };
    const lids: Record<'blue' | 'white' | 'orange', THREE.Matrix4[]> = { blue: [], white: [], orange: [] };
    const hollow: THREE.Matrix4[] = [];
    const powder: THREE.Matrix4[] = [];
    for (const s of stacks) {
      const color = s.color ?? 'blue';
      const y0 = s.y ?? 0;
      let yaw = s.yaw ?? 0;
      for (let i = 0; i < s.count; i++) {
        yaw += (rand() - 0.5) * 0.07;
        bodies[color].push(at(s.at[0], y0 + i * (TOTE.h - 0.012), s.at[1], yaw));
      }
      const topY = y0 + (s.count - 1) * (TOTE.h - 0.012) + TOTE.h;
      const top = s.top ?? 'lid';
      if (top === 'lid') lids[color].push(at(s.at[0], topY - 0.004, s.at[1], yaw));
      else if (top === 'open') hollow.push(at(s.at[0], topY - 0.012, s.at[1], yaw));
      else powder.push(at(s.at[0], topY - 0.04, s.at[1], yaw));
    }
    return { bodies, lids, hollow, powder };
  }, [stacks, seed]);

  const lidGeo = rbox(TOTE.l + 0.012, 0.035, TOTE.w + 0.012, 0.014, 2);
  return (
    <group {...props}>
      {(['blue', 'white', 'orange'] as const).map((c) => (
        <group key={c}>
          <Instances g={toteGeometry()} m={plastic(TOTE_COLOR[c], 0.38)} matrices={layout.bodies[c]} />
          <Instances g={lidGeo} m={plastic(TOTE_COLOR[c], 0.38)} matrices={layout.lids[c]} />
        </group>
      ))}
      {/* A dark plate just under the rim reads as the empty inside. */}
      <Instances g={rbox(TOTE.l - 0.07, 0.02, TOTE.w - 0.07, 0.008, 1)} m={matte(PALETTE.graphite, 0.7)} matrices={layout.hollow} shadows={false} />
      <Instances g={moundGeometry(TOTE.l - 0.08, TOTE.w - 0.08, 0.07)} m={matte(POWDER, 0.85)} matrices={layout.powder} shadows={false} />
    </group>
  );
}

/** A soft mound filling a rectangular container. */
function moundGeometry(l: number, w: number, h: number) {
  return rbox(l, h, w, Math.min(h / 2, 0.035), 4);
}

// ------------------------------------------------------ ingredient bins

/** White wheeled ingredient bin with a sloped coloured lid, 0.56 x 0.74 and
 *  0.86 tall. The lid hinge is at -x, the scoop hatch faces +x. */
export function IngredientBin({ lid = 'blue', ...props }: GroupProps & { lid?: 'blue' | 'orange' }) {
  const accent = plastic(lid === 'blue' ? PALETTE.blue : PALETTE.orange, 0.36);
  const wheels = useMemo(() => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(HALF, 0, 0));
    const one = new THREE.Vector3(1, 1, 1);
    const out: THREE.Matrix4[] = [];
    for (const x of [-0.19, 0.19]) for (const z of [-0.27, 0.27]) out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.05, z), q, one));
    return out;
  }, []);
  return (
    <group {...props}>
      <Part g={rbox(0.54, 0.6, 0.72, 0.07, 4)} m={plastic(WHITE, 0.4)} position-y={0.42} />
      <Part g={rbox(0.5, 0.05, 0.68, 0.02, 2)} m={matte(PALETTE.graphite, 0.6)} position-y={0.115} />
      <group position={[0, 0.75, 0]} rotation-z={-0.16}>
        <Part g={rbox(0.6, 0.07, 0.76, 0.03, 3)} m={accent} />
        <Part g={rbox(0.05, 0.035, 0.3, 0.015, 2)} m={accent} position={[0.27, 0.045, 0]} />
      </group>
      {/* Label plate on the front. */}
      <Part g={rbox(0.012, 0.16, 0.3, 0.005, 1)} m={accent} position={[0.272, 0.45, 0]} castShadow={false} />
      <Instances g={cyl(0.05, 0.05, 0.036, 16)} m={matte(PALETTE.rubber, 0.7)} matrices={wheels} />
    </group>
  );
}

// ------------------------------------------------------------ waste bin

/** Wheelie bin, 0.5 x 0.56 and 0.95 tall, dark body with a coloured lid. */
export function WasteBin({ lid = 'orange', ...props }: GroupProps & { lid?: 'blue' | 'orange' | 'green' }) {
  const lidColor = lid === 'blue' ? PALETTE.blue : lid === 'green' ? PALETTE.healthy : PALETTE.orange;
  const body = plastic(PALETTE.graphite, 0.5);
  return (
    <group {...props}>
      <Part g={rbox(0.46, 0.8, 0.5, 0.06, 3)} m={body} position-y={0.47} />
      <Part g={rbox(0.5, 0.05, 0.54, 0.02, 2)} m={body} position-y={0.84} />
      <group position={[0, 0.89, 0]} rotation-z={-0.05}>
        <Part g={rbox(0.54, 0.06, 0.56, 0.028, 3)} m={plastic(lidColor, 0.4)} />
        <Part g={rbox(0.05, 0.03, 0.34, 0.012, 2)} m={plastic(lidColor, 0.4)} position={[0.25, 0.03, 0]} />
      </group>
      {/* Axle wheels at the back and the tow handle above them. */}
      {[1, -1].map((s) => (
        <Part key={s} g={cyl(0.085, 0.085, 0.05, 18)} m={matte(PALETTE.rubber, 0.7)} position={[-0.2, 0.085, s * 0.24]} rotation-x={HALF} />
      ))}
      <Part g={rbox(0.04, 0.04, 0.42, 0.018, 2)} m={body} position={[-0.27, 0.86, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------- drums

const DRUM = { r: 0.23, h: 0.62 } as const;

/** Blue fibre drum of powder with a steel lock ring and a white batch
 *  label on the side facing +x. 0.46 across, 0.66 tall. */
export function Drum({ color = PALETTE.drum, ...props }: GroupProps & { color?: string }) {
  return (
    <group {...props}>
      <Part g={cyl(DRUM.r, DRUM.r * 0.97, DRUM.h, 22)} m={plastic(color, 0.45)} position-y={DRUM.h / 2} />
      <Part g={cyl(DRUM.r + 0.012, DRUM.r + 0.012, 0.035, 22)} m={plastic(color, 0.4)} position-y={DRUM.h + 0.015} />
      <Part g={torus(DRUM.r + 0.01, 0.014, 22)} m={metal(PALETTE.steel, 0.3)} position-y={DRUM.h + 0.004} rotation-x={HALF} />
      <Part g={rbox(0.04, 0.03, 0.06, 0.01, 1)} m={metal(PALETTE.steelDark, 0.3)} position={[DRUM.r + 0.02, DRUM.h, 0]} castShadow={false} />
      <Part g={rbox(0.01, 0.2, 0.2, 0.004, 1)} m={plastic(WHITE, 0.6)} position={[DRUM.r * 0.98, DRUM.h * 0.55, 0]} castShadow={false} />
    </group>
  );
}

/** Low steel platform cart carrying `drums` drums (up to four), push
 *  handle at -x. 1.05 x 0.62. A 'push' worker grips the handle from
 *  DRUM_CART_OPERATOR_X. */
export const DRUM_CART_OPERATOR_X = -0.98;
export function DrumCart({ drums = 4, ...props }: GroupProps & { drums?: number }) {
  const steel = metal(PALETTE.steel, 0.3);
  const spots: Array<[number, number]> = [
    [0.22, 0.15],
    [0.22, -0.15],
    [-0.2, 0.15],
    [-0.2, -0.15],
  ];
  return (
    <group {...props}>
      <Part g={rbox(1.0, 0.04, 0.6, 0.015, 2)} m={steel} position-y={0.17} />
      <Part g={rbox(0.96, 0.03, 0.56, 0.01, 1)} m={matte(PALETTE.graphite, 0.7)} position-y={0.2} castShadow={false} />
      {[1, -1].map((s) => (
        <group key={s}>
          <Part g={rbox(0.04, 0.82, 0.04, 0.015, 2)} m={steel} position={[-0.5, 0.58, s * 0.24]} rotation-z={0.12} />
          <Part g={cyl(0.06, 0.06, 0.04, 14)} m={matte(PALETTE.rubber, 0.7)} position={[0.4, 0.075, s * 0.24]} rotation-x={HALF} />
          <Part g={cyl(0.06, 0.06, 0.04, 14)} m={matte(PALETTE.rubber, 0.7)} position={[-0.4, 0.075, s * 0.24]} rotation-x={HALF} />
        </group>
      ))}
      <Part g={rbox(0.04, 0.04, 0.52, 0.018, 2)} m={plastic(PALETTE.blue, 0.4)} position={[-0.55, 0.98, 0]} />
      {spots.slice(0, Math.min(drums, 4)).map(([x, z], i) => (
        <Drum key={i} position={[x, 0.215, z]} scale={0.62} rotation-y={i * 0.7} />
      ))}
    </group>
  );
}

// --------------------------------------------------------- sample tray

/** A tray of 24 tablets, as on the line, for benches and scales. */
export function SampleTray(props: GroupProps) {
  return (
    <group {...props}>
      {trayParts().map((p, i) => (
        <Part key={i} g={p.g} m={p.m} castShadow={i === 0} />
      ))}
    </group>
  );
}
