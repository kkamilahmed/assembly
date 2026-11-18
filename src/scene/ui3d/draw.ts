// 2D drawing helpers for card faces. Everything is in design pixels.
import { PALETTE } from '@/scene/style';
import type { Tone } from './kit';

export type IconName = 'check' | 'alert' | 'thermo' | 'box' | 'eye' | 'battery' | 'gauge' | 'bolt';

export const TONE_COLOR: Record<Tone, string> = {
  healthy: PALETTE.healthy,
  warning: PALETTE.warning,
  critical: PALETTE.critical,
  neutral: PALETTE.blue,
};

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** `color` with an alpha, for tints. Accepts #rrggbb. */
export function alpha(color: string, a: number): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function formatValue(v: number | string): string {
  if (typeof v === 'string') return v;
  const abs = Math.abs(v);
  if (abs >= 100 || Number.isInteger(v)) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: abs >= 10 ? 1 : 2 });
}

/** Round tick values covering lo..hi, about `count` of them. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = Math.max(hi - lo, 1e-6);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-6; t += step) ticks.push(Math.round(t / step) * step);
  return ticks;
}

/** A line icon centred on (cx, cy), fitting a box of `size`. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, cx: number, cy: number, size: number, color: string) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (name) {
    case 'check':
      ctx.lineWidth = 3.2;
      ctx.moveTo(5, 12.5);
      ctx.lineTo(10, 17.5);
      ctx.lineTo(19.5, 7);
      ctx.stroke();
      break;
    case 'alert':
      ctx.moveTo(12, 3.5);
      ctx.lineTo(21.5, 20);
      ctx.lineTo(2.5, 20);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, 9.5);
      ctx.lineTo(12, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 17, 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'thermo':
      ctx.moveTo(9.5, 14.2);
      ctx.lineTo(9.5, 5);
      ctx.arc(12, 5, 2.5, Math.PI, 0);
      ctx.lineTo(14.5, 14.2);
      ctx.arc(12, 17, 3.8, -Math.PI / 4, Math.PI * 1.25);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 17, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(12, 15);
      ctx.lineTo(12, 9);
      ctx.stroke();
      break;
    case 'box':
      ctx.moveTo(12, 2.8);
      ctx.lineTo(20.5, 7.4);
      ctx.lineTo(20.5, 16.6);
      ctx.lineTo(12, 21.2);
      ctx.lineTo(3.5, 16.6);
      ctx.lineTo(3.5, 7.4);
      ctx.closePath();
      ctx.moveTo(3.5, 7.4);
      ctx.lineTo(12, 12);
      ctx.lineTo(20.5, 7.4);
      ctx.moveTo(12, 12);
      ctx.lineTo(12, 21.2);
      ctx.stroke();
      break;
    case 'eye':
      ctx.moveTo(2, 12);
      ctx.quadraticCurveTo(12, 0.5, 22, 12);
      ctx.quadraticCurveTo(12, 23.5, 2, 12);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 12, 3.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'battery':
      rr(ctx, 4, 6, 16, 15, 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(9, 3.5);
      ctx.lineTo(15, 3.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12.8, 8.5);
      ctx.lineTo(9.5, 13.8);
      ctx.lineTo(14.5, 13.8);
      ctx.lineTo(11.2, 19);
      ctx.stroke();
      break;
    case 'gauge':
      ctx.arc(12, 14, 9, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, 14);
      ctx.lineTo(16.5, 8.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, 14, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4, 19);
      ctx.lineTo(20, 19);
      ctx.stroke();
      break;
    case 'bolt':
      ctx.moveTo(13.5, 2.5);
      ctx.lineTo(5, 13.5);
      ctx.lineTo(11.5, 13.5);
      ctx.lineTo(10.5, 21.5);
      ctx.lineTo(19, 10.5);
      ctx.lineTo(12.5, 10.5);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}
