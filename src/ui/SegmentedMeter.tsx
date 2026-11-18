import type { ReactNode } from 'react';

const SEGMENTS = 12;

interface SegmentedMeterProps {
  label: string;
  displayValue: string;
  /** 0..1 fill level across the segmented bar. */
  fraction: number;
  color: string;
  /** Ends of the scale, so a reading means something against its range
   *  instead of being a bar filled to an unstated fraction of nothing. */
  rangeLabel: string;
  /** Optional marker beside the label - used to mark a channel a fault has
   *  been injected into, so a high reading is attributable rather than
   *  mysterious. */
  badge?: ReactNode;
}

/** A segmented bar gauge for one sensor channel.
 *
 *  Previously six segments labelled J0-J5, one per robot axis - which
 *  claimed the card was showing a per-joint breakdown of temperature,
 *  pressure and vibration. It wasn't: each meter is a single scalar
 *  reading, so twelve of those eighteen tiny labels were asserting
 *  structure that does not exist in the data. The segments are now just a
 *  bar's worth of resolution, and the range is stated instead. */
export function SegmentedMeter({ label, displayValue, fraction, color, rangeLabel, badge }: SegmentedMeterProps) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const filled = Math.round(clamped * SEGMENTS);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate">{label}</span>
          {badge}
        </span>
        <span className="font-mono-ui text-xs font-semibold" style={{ color }}>
          {displayValue}
        </span>
      </div>
      <div className="mt-1 flex gap-[2px]">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div key={i} className="h-2 flex-1 rounded-[1px]" style={{ backgroundColor: i < filled ? color : `${color}24` }} />
        ))}
      </div>
      <div className="font-mono-ui mt-0.5 text-[9px] text-[var(--text-secondary)]">{rangeLabel}</div>
    </div>
  );
}
