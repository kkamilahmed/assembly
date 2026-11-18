import { useCallback } from 'react';
import { PALETTE } from '@/scene/style';
import { font } from './kit';
import { Panel } from './Panel';

/** The Northgate mark: two payment cards fanned out, drawn white in a box
 *  of `s` at (x, y). */
function drawCardsMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, bg: string) {
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.scale(s / 100, s / 100);
  const card = (angle: number, dx: number, dy: number, fill: string) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(angle);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(-38, -24, 76, 48, 8);
    ctx.fill();
    ctx.restore();
  };
  card(-0.32, -8, -8, 'rgba(255,255,255,0.55)');
  card(0, 6, 8, '#ffffff');
  ctx.fillStyle = bg;
  ctx.fillRect(-32 + 6, -6 + 8, 76, 9);
  ctx.beginPath();
  ctx.roundRect(-20 + 6, 12 + 8, 16, 7, 2);
  ctx.fill();
  ctx.restore();
}

export interface BrandSignProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  name?: string;
  tagline?: string;
}

/** The big orange brand sign: a thick rounded slab with a white wordmark. */
export function BrandSign({ position, rotation, width = 7, height = 2.1, name = 'Northgate', tagline = 'Payments' }: BrandSignProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = PALETTE.orange;
      ctx.fillRect(0, 0, w, h);
      const mark = h * 0.62;
      const nameSize = h * 0.5;
      const tagSize = h * 0.2;
      ctx.font = font(800, nameSize);
      const nameW = ctx.measureText(name).width;
      const gap = h * 0.13;
      const x = (w - (mark + gap + nameW)) / 2;
      drawCardsMark(ctx, x, (h - mark) / 2, mark, PALETTE.orange);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(name, x + mark + gap, h * 0.56);
      ctx.font = font(600, tagSize);
      ctx.globalAlpha = 0.92;
      ctx.fillText(tagline, x + mark + gap + nameSize * 0.04, h * 0.56 + tagSize * 1.25);
      ctx.globalAlpha = 1;
    },
    [name, tagline],
  );
  return (
    <Panel
      position={position}
      rotation={rotation}
      width={width}
      height={height}
      depth={0.34}
      radius={0.36}
      standoff={0.1}
      color={PALETTE.orange}
      rimColor={PALETTE.orangeDeep}
      lift={0.12}
      draw={draw}
    />
  );
}
