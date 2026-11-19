import { useCallback } from 'react';
import { PALETTE } from '@/scene/style';
import { drawCapsuleMark } from '@/scene/props/kit';
import { font } from './kit';
import { Panel } from './Panel';

export interface BrandSignProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  name?: string;
  tagline?: string;
}

/** The big brand sign: a thick rounded blue slab with a white wordmark. */
export function BrandSign({ position, rotation, width = 7, height = 2.1, name = 'Meridian', tagline = 'Pharma' }: BrandSignProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = PALETTE.brand;
      ctx.fillRect(0, 0, w, h);
      const mark = h * 0.62;
      const nameSize = h * 0.5;
      const tagSize = h * 0.2;
      ctx.font = font(800, nameSize);
      const nameW = ctx.measureText(name).width;
      const gap = h * 0.13;
      const x = (w - (mark + gap + nameW)) / 2;
      drawCapsuleMark(ctx, x + mark / 2, h / 2, mark * 1.1, '#ffffff', PALETTE.brand);
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
      color={PALETTE.brand}
      rimColor={PALETTE.brandDeep}
      lift={0.12}
      draw={draw}
    />
  );
}
