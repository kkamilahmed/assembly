// Containers for the plant floor: stacking totes, wheeled component bins
// and wheelie waste bins. Origins are at the footprint centre on the ground.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, PALETTE, plastic } from '@/scene/style';
import { cyl, mergedBoxes, rbox, rng, studioWhite } from '@/scene/props/kit';
import { cellTrayGeometry, moduleMaterial } from '@/scene/props/module';
import { Instances, Part } from '@/scene/props/Part';
import { at } from '@/scene/props/stockLayout';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const HALF = Math.PI / 2;
const WHITE = studioWhite(PALETTE.white, 0.68);

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
  /** What the top tote shows: a lid, its empty inside, or a tray of cells. */
  top?: 'lid' | 'open' | 'cells';
}

/** A cell tray shrunk to sit inside a tote. */
const TRAY_IN_TOTE = new THREE.Matrix4().makeScale(0.74, 0.8, 0.7);

const TOTE_COLOR = { blue: PALETTE.blue, white: WHITE, orange: PALETTE.orange } as const;

/** Any number of stacks of euro totes, instanced per colour. */
export function ToteStacks({ stacks, seed = 1, ...props }: GroupProps & { stacks: ToteStackSpec[]; seed?: number }) {
  const layout = useMemo(() => {
    const rand = rng(seed * 31 + 7);
    const bodies: Record<'blue' | 'white' | 'orange', THREE.Matrix4[]> = { blue: [], white: [], orange: [] };
    const lids: Record<'blue' | 'white' | 'orange', THREE.Matrix4[]> = { blue: [], white: [], orange: [] };
    const hollow: THREE.Matrix4[] = [];
    const cells: THREE.Matrix4[] = [];
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
      else cells.push(at(s.at[0], topY - 0.15, s.at[1], yaw).multiply(TRAY_IN_TOTE));
    }
    return { bodies, lids, hollow, cells };
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
      <Instances g={cellTrayGeometry()} m={moduleMaterial()} matrices={layout.cells} shadows={false} />
    </group>
  );
}

// ------------------------------------------------------- component bins

/** White wheeled bin for busbars and fasteners, with a sloped coloured lid,
 *  0.56 x 0.74 and 0.86 tall. The lid hinge is at -x, the hatch faces +x. */
export function ComponentBin({ lid = 'blue', ...props }: GroupProps & { lid?: 'blue' | 'orange' }) {
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
