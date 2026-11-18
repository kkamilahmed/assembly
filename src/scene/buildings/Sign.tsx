import { useCallback } from 'react';
import { Panel } from '../ui3d/Panel';
import { font } from '../ui3d/kit';

export interface SignProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
  text: string;
  sub?: string;
  color: string;
  ink?: string;
  /** Draws a mark at the left of the sign, in a box of `s` at (x, y). */
  mark?: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void;
}

/** A shop sign: a chunky rounded slab with a mark and a name on it. */
export function Sign({ position, rotation, width, height, text, sub, color, ink = '#ffffff', mark }: SignProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      const markS = mark ? h * 0.62 : 0;
      const nameSize = h * (sub ? 0.42 : 0.5);
      ctx.font = font(800, nameSize);
      const nameW = ctx.measureText(text).width;
      const gap = mark ? h * 0.16 : 0;
      const x = (w - (markS + gap + nameW)) / 2;
      if (mark) mark(ctx, x + markS / 2, h / 2, markS);
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x + markS + gap, sub ? h * 0.55 : h * 0.66);
      if (sub) {
        ctx.font = font(600, h * 0.2);
        ctx.globalAlpha = 0.85;
        ctx.fillText(sub, x + markS + gap + 2, h * 0.55 + h * 0.27);
        ctx.globalAlpha = 1;
      }
    },
    [color, ink, text, sub, mark],
  );
  return <Panel position={position} rotation={rotation} width={width} height={height} depth={0.12} radius={Math.min(0.18, height / 3)} standoff={0.04} color={color} lift={0.2} draw={draw} />;
}
