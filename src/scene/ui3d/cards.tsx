// The dashboard cards. Each is a Panel whose face is redrawn only when the
// data it shows changes, so they are cheap to drive from live values.
import { useCallback } from 'react';
import { PALETTE } from '@/scene/style';
import { alpha, drawIcon, formatValue, niceTicks, rr, TONE_COLOR } from './draw';
import type { IconName } from './draw';
import { font, INK } from './kit';
import type { Tone } from './kit';
import { Panel } from './Panel';

const PAD = 24;

interface Placement {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
}

function fillBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(0, 0, w, h);
}

function title(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 20) {
  ctx.font = font(600, size);
  ctx.fillStyle = INK.sub;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export interface KpiCardProps extends Placement {
  title: string;
  value: number | string;
  unit?: string;
  /** Change against the previous period, in percent. */
  delta?: number;
  tone?: Tone;
  icon?: IconName;
}

/** One big number with an icon badge and an optional change pill. */
export function KpiCard({ title: label, value, unit, delta, tone = 'neutral', icon = 'gauge', width = 3.1, height = 1.5, ...place }: KpiCardProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      fillBackground(ctx, w, h);
      const c = TONE_COLOR[tone];
      const badge = 42;
      rr(ctx, PAD, PAD, badge, badge, 12);
      ctx.fillStyle = c;
      ctx.fill();
      drawIcon(ctx, icon, PAD + badge / 2, PAD + badge / 2, 25, '#ffffff');
      title(ctx, label, PAD + badge + 13, PAD + badge / 2 + 1);

      const text = formatValue(value);
      ctx.font = font(700, 64);
      ctx.fillStyle = INK.ink;
      ctx.textBaseline = 'alphabetic';
      const baseline = h - PAD - 3;
      ctx.fillText(text, PAD - 2, baseline);
      const tw = ctx.measureText(text).width;
      if (unit) {
        ctx.font = font(500, 26);
        ctx.fillStyle = INK.muted;
        ctx.fillText(unit, PAD + tw + 8, baseline);
      }
      if (delta !== undefined) {
        const s = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
        ctx.font = font(600, 19);
        const pw = ctx.measureText(s).width + 24;
        const ph = 32;
        rr(ctx, w - PAD - pw, baseline - ph + 3, pw, ph, ph / 2);
        ctx.fillStyle = alpha(c, 0.14);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s, w - PAD - pw / 2, baseline - ph / 2 + 4);
      }
    },
    [label, value, unit, delta, tone, icon],
  );
  return <Panel width={width} height={height} draw={draw} {...place} />;
}

export interface LineChartCardProps extends Placement {
  title: string;
  series: number[];
  /** Optional second line, e.g. the setpoint or yesterday. */
  compare?: number[];
  seriesLabel?: string;
  compareLabel?: string;
  limitWarn?: number;
  limitCrit?: number;
  unit?: string;
  color?: string;
  compareColor?: string;
}

/** A line chart with a soft grid, optional comparison line and limits. */
export function LineChartCard({
  title: label,
  series,
  compare,
  seriesLabel = 'Actual',
  compareLabel = 'Setpoint',
  limitWarn,
  limitCrit,
  unit = '',
  color = PALETTE.orange,
  compareColor = PALETTE.blue,
  width = 6.4,
  height = 2.9,
  ...place
}: LineChartCardProps) {
  const sig = `${series.join(',')}|${compare?.join(',') ?? ''}`;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      fillBackground(ctx, w, h);
      title(ctx, label, PAD, PAD + 16, 22);

      // Latest value, top right, turning to the limit colour it has crossed.
      const last = series.at(-1) ?? 0;
      const lastColor =
        limitCrit !== undefined && last >= limitCrit ? PALETTE.critical : limitWarn !== undefined && last >= limitWarn ? PALETTE.warning : INK.ink;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.font = font(500, 20);
      ctx.fillStyle = INK.muted;
      ctx.fillText(unit, w - PAD, PAD + 19);
      const uw = unit ? ctx.measureText(unit).width + 7 : 0;
      ctx.font = font(700, 38);
      ctx.fillStyle = lastColor;
      const valueText = formatValue(last);
      ctx.fillText(valueText, w - PAD - uw, PAD + 15);
      let lx = w - PAD - uw - ctx.measureText(valueText).width - 28;

      // Legend, to the left of the value.
      const legend: Array<[string, string]> = compare ? [[compareLabel, compareColor], [seriesLabel, color]] : [];
      ctx.font = font(500, 17);
      for (const [name, c] of legend) {
        ctx.fillStyle = INK.sub;
        ctx.textAlign = 'right';
        ctx.fillText(name, lx, PAD + 17);
        lx -= ctx.measureText(name).width + 10;
        ctx.beginPath();
        ctx.arc(lx - 5, PAD + 16, 6, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
        lx -= 30;
      }

      // Plot area and value range.
      const x0 = PAD + 44;
      const x1 = w - PAD - 6;
      const y0 = 82;
      const y1 = h - PAD - 6;
      const all = [...series, ...(compare ?? [])];
      if (limitWarn !== undefined) all.push(limitWarn);
      if (limitCrit !== undefined) all.push(limitCrit);
      let lo = Math.min(...all);
      let hi = Math.max(...all);
      const padV = Math.max((hi - lo) * 0.14, 1e-3);
      lo -= padV;
      hi += padV;
      const px = (i: number, n: number) => x0 + ((x1 - x0) * i) / Math.max(n - 1, 1);
      const py = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.font = font(500, 15);
      ctx.textAlign = 'right';
      for (const t of niceTicks(lo, hi, 4)) {
        const y = py(t);
        ctx.strokeStyle = INK.grid;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        ctx.fillStyle = INK.muted;
        ctx.fillText(formatValue(t), x0 - 14, y + 1);
      }

      const limit = (v: number | undefined, c: string) => {
        if (v === undefined) return;
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([3, 9]);
        ctx.beginPath();
        ctx.moveTo(x0, py(v));
        ctx.lineTo(x1, py(v));
        ctx.stroke();
        ctx.setLineDash([]);
      };
      limit(limitWarn, PALETTE.warning);
      limit(limitCrit, PALETTE.critical);

      const trace = (data: number[]) => {
        ctx.beginPath();
        data.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i, data.length), py(v)) : ctx.lineTo(px(i, data.length), py(v))));
      };
      const markers = (data: number[], c: string) => {
        if (data.length > 18) return;
        data.forEach((v, i) => {
          ctx.beginPath();
          ctx.arc(px(i, data.length), py(v), 6, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.white;
          ctx.fill();
          ctx.strokeStyle = c;
          ctx.lineWidth = 3;
          ctx.stroke();
        });
      };

      if (compare && compare.length > 1) {
        trace(compare);
        ctx.strokeStyle = compareColor;
        ctx.lineWidth = 3.5;
        ctx.stroke();
        markers(compare, compareColor);
      }
      if (series.length > 1) {
        trace(series);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x0, y1);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, alpha(color, 0.28));
        g.addColorStop(1, alpha(color, 0));
        ctx.fillStyle = g;
        ctx.fill();
        trace(series);
        ctx.strokeStyle = color;
        ctx.lineWidth = 7;
        ctx.stroke();
        markers(series, color);
        // The live end of the line.
        ctx.beginPath();
        ctx.arc(x1, py(last), 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = PALETTE.white;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    },
    // The arrays are compared by content through `sig`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [label, sig, seriesLabel, compareLabel, limitWarn, limitCrit, unit, color, compareColor],
  );
  return <Panel width={width} height={height} draw={draw} {...place} />;
}

export interface DonutCardProps extends Placement {
  title: string;
  /** 0..1 */
  fraction: number;
  label?: string;
  color?: string;
}

/** A ring gauge with the percentage and a caption beside it. */
export function DonutCard({ title: heading, fraction, label, color = PALETTE.orange, width = 3.5, height = 1.5, ...place }: DonutCardProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      fillBackground(ctx, w, h);
      const f = Math.min(Math.max(fraction, 0), 1);
      const r = h / 2 - PAD - 9;
      const cx = PAD + r + 9;
      const cy = h / 2;
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK.track;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.blue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(f + 0.07, 1));
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
      ctx.stroke();

      const tx = cx + r + 32;
      title(ctx, heading, tx, PAD + 14);
      ctx.font = font(700, 52);
      ctx.fillStyle = INK.ink;
      ctx.textBaseline = 'alphabetic';
      const pct = `${(f * 100).toFixed(f >= 0.995 ? 0 : 1)}`;
      const base = label ? h - PAD - 28 : h - PAD - 6;
      ctx.fillText(pct, tx - 2, base);
      const pw = ctx.measureText(pct).width;
      ctx.font = font(500, 26);
      ctx.fillStyle = INK.muted;
      ctx.fillText('%', tx + pw + 4, base);
      if (label) {
        ctx.font = font(500, 17);
        ctx.fillText(label, tx, h - PAD);
      }
    },
    [heading, fraction, label, color],
  );
  return <Panel width={width} height={height} draw={draw} {...place} />;
}

export interface BarCardProps extends Placement {
  title: string;
  values: number[];
  labels?: string[];
  /** Index drawn in the accent colour. Defaults to the last bar. */
  highlight?: number;
  value?: number | string;
  unit?: string;
  color?: string;
  accent?: string;
}

/** A bar chart with rounded bars and one accented bar. */
export function BarCard({
  title: heading,
  values,
  labels,
  highlight,
  value,
  unit,
  color = PALETTE.blue,
  accent = PALETTE.orange,
  width = 3.5,
  height = 2.9,
  ...place
}: BarCardProps) {
  const sig = `${values.join(',')}|${labels?.join(',') ?? ''}`;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      fillBackground(ctx, w, h);
      title(ctx, heading, PAD, PAD + 16, 22);
      let top = 74;
      if (value !== undefined) {
        const text = formatValue(value);
        ctx.font = font(700, 46);
        ctx.fillStyle = INK.ink;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, PAD - 1, 104);
        if (unit) {
          const tw = ctx.measureText(text).width;
          ctx.font = font(500, 21);
          ctx.fillStyle = INK.muted;
          ctx.fillText(unit, PAD + tw + 8, 104);
        }
        top = 132;
      }
      const x0 = PAD;
      const x1 = w - PAD;
      const y1 = h - PAD - (labels ? 26 : 4);
      const max = Math.max(...values, 1e-6) * 1.08;
      ctx.strokeStyle = INK.grid;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i <= 2; i++) {
        const y = top + ((y1 - top) * i) / 3;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
      const n = values.length;
      const slot = (x1 - x0) / n;
      const bw = slot * 0.58;
      const hi = highlight ?? n - 1;
      values.forEach((v, i) => {
        const bh = Math.max(((y1 - top) * v) / max, bw / 2);
        const x = x0 + slot * i + (slot - bw) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y1 - bh, bw, bh, [bw / 2.6, bw / 2.6, 3, 3]);
        ctx.fillStyle = i === hi ? accent : color;
        ctx.fill();
        if (labels?.[i]) {
          ctx.font = font(500, 14);
          ctx.fillStyle = INK.muted;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labels[i], x + bw / 2, y1 + 17);
        }
      });
      ctx.textAlign = 'left';
    },
    // The arrays are compared by content through `sig`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [heading, sig, highlight, value, unit, color, accent],
  );
  return <Panel width={width} height={height} draw={draw} {...place} />;
}
