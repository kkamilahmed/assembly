import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE, plastic } from '@/scene/style';
import { drawIcon, formatValue, rr, TONE_COLOR } from './draw';
import type { IconName } from './draw';
import { font, INK, measure, slabGeometry } from './kit';
import type { Tone } from './kit';
import { Panel } from './Panel';

const H = 1.0;
const BADGE = 64;
const PAD = 18;
const TAIL = 0.26;

const DEFAULT_ICON: Record<Tone, IconName> = { healthy: 'check', warning: 'alert', critical: 'alert', neutral: 'box' };
const FACING = { z: 0, x: Math.PI / 2, camera: Math.PI / 4 } as const;

let tailGeo: THREE.BufferGeometry | null = null;
function tailGeometry(): THREE.BufferGeometry {
  if (!tailGeo) {
    const s = new THREE.Shape();
    s.moveTo(-0.2, 0.06);
    s.lineTo(0.2, 0.06);
    s.lineTo(0.03, -TAIL + 0.02);
    s.quadraticCurveTo(0, -TAIL, -0.03, -TAIL + 0.02);
    s.closePath();
    tailGeo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false });
  }
  return tailGeo;
}

export interface StatusTagProps {
  /** The point the tag's tail points at, e.g. just above a building. */
  position: [number, number, number];
  label: string;
  value: number | string;
  tone?: Tone;
  icon?: IconName;
  /** Which way the face points. 'z' and 'x' sit square to the diorama. */
  facing?: keyof typeof FACING;
  scale?: number;
}

/**
 * A floating tag pinned above a building: a white rounded slab with a tone
 * coloured rim and icon badge, a short label and a value.
 */
export function StatusTag({ position, label, value, tone = 'neutral', icon, facing = 'z', scale = 1 }: StatusTagProps) {
  const color = TONE_COLOR[tone];
  const text = formatValue(value);
  const glyph = icon ?? DEFAULT_ICON[tone];
  const width = useMemo(() => {
    const textW = Math.max(measure(label, font(600, 21)), measure(text, font(700, 40)));
    return Math.ceil((PAD + BADGE + 15 + textW + PAD + 6) / 10) / 10;
  }, [label, text]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(0, 0, w, h);
      rr(ctx, PAD, (h - BADGE) / 2, BADGE, BADGE, 18);
      ctx.fillStyle = color;
      ctx.fill();
      drawIcon(ctx, glyph, PAD + BADGE / 2, h / 2, 38, '#ffffff');
      const tx = PAD + BADGE + 15;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = font(600, 21);
      ctx.fillStyle = INK.sub;
      ctx.fillText(label, tx, h / 2 - 13);
      ctx.font = font(700, 40);
      ctx.fillStyle = INK.ink;
      ctx.fillText(text, tx - 1, h / 2 + 29);
    },
    [label, text, color, glyph],
  );

  const rim = 0.045;
  return (
    <group position={position} rotation-y={FACING[facing]} scale={scale}>
      {/* Coloured backplate, showing as a rim around the white card. */}
      <mesh
        position={[0, TAIL + H / 2, -0.07]}
        geometry={slabGeometry(width + rim * 2, H + rim * 2, 0.08, 0.26 + rim, 0.02)}
        material={plastic(color)}
        castShadow
      />
      <mesh position={[0, TAIL, -0.07]} geometry={tailGeometry()} material={plastic(color)} castShadow />
      <Panel position={[0, TAIL + H / 2, 0]} width={width} height={H} depth={0.07} radius={0.26} standoff={0} lift={0.3} draw={draw} />
    </group>
  );
}
