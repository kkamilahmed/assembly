import type { TrendSample } from '@/state/store';

interface SparklineProps {
  data: TrendSample[];
  color: string;
  height?: number;
  max?: number;
}

export function Sparkline({ data, color, height = 32, max }: SparklineProps) {
  const width = 100;
  if (data.length < 2) {
    return <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" />;
  }
  const maxV = max ?? Math.max(...data.map((d) => d.v), 0.01);
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - Math.min(d.v / maxV, 1) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
