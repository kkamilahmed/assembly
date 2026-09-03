const JOINTS = ['J0', 'J1', 'J2', 'J3', 'J4', 'J5'];

interface SegmentedMeterProps {
  label: string;
  displayValue: string;
  /** 0..1 fill level across the segmented bar. */
  fraction: number;
  color: string;
}

/** A six-segment gauge (one per robot axis, J0-J5) reading a fraction of
 *  full scale — the fleet overview's stand-in for a real per-joint sensor
 *  readout. */
export function SegmentedMeter({ label, displayValue, fraction, color }: SegmentedMeterProps) {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * JOINTS.length);
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="font-mono-ui text-xs font-semibold" style={{ color }}>
          {displayValue}
        </span>
      </div>
      <div className="mt-1 flex gap-1">
        {JOINTS.map((joint, i) => (
          <div key={joint} className="h-1.5 flex-1 rounded-sm" style={{ backgroundColor: i < filled ? color : `${color}26` }} />
        ))}
      </div>
      <div className="mt-0.5 flex gap-1">
        {JOINTS.map((joint) => (
          <span key={joint} className="font-mono-ui flex-1 text-center text-[8px] text-[var(--text-secondary)]">
            {joint}
          </span>
        ))}
      </div>
    </div>
  );
}
