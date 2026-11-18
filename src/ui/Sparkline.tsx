import type { TrendSample } from '@/state/store';
import { STATUS_HEX } from './colors';

/** A trend line is only readable against the limits it's being judged
 *  against. This used to be a bare polyline with a hardcoded `max` that
 *  didn't match any real threshold, so a trend could visibly climb without
 *  the shape telling you whether that mattered - or clip silently once it
 *  passed the ceiling. The bands are the reference frame. */
interface SparklineProps {
  data: TrendSample[];
  color: string;
  height?: number;
  warn: number;
  critical: number;
  /** Top of the scale. Defaults to a bit above the critical limit so a
   *  healthy line sits low in the frame with its headroom visible. */
  max?: number;
}

const W = 100;

export function Sparkline({ data, color, height = 40, warn, critical, max }: SparklineProps) {
  const maxV = Math.max(max ?? critical * 1.6, ...data.map((d) => d.v));
  const y = (v: number) => height - Math.min(v / maxV, 1) * height;

  const points =
    data.length < 2
      ? ''
      : data.map((d, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${y(d.v).toFixed(1)}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden>
      {/* warning band, then critical band above it */}
      <rect x={0} y={y(critical)} width={W} height={Math.max(0, y(warn) - y(critical))} fill={STATUS_HEX.warning} fillOpacity={0.1} />
      <rect x={0} y={0} width={W} height={Math.max(0, y(critical))} fill={STATUS_HEX.critical} fillOpacity={0.1} />
      <line x1={0} x2={W} y1={y(warn)} y2={y(warn)} stroke={STATUS_HEX.warning} strokeWidth={1} strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={W} y1={y(critical)} y2={y(critical)} stroke={STATUS_HEX.critical} strokeWidth={1} strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
