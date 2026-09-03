import { useStore } from '@/state/store';

function timeAgo(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export function ReworkList() {
  const reworkQueue = useStore((s) => s.reworkQueue);

  if (reworkQueue.length === 0) {
    return <div className="text-xs text-[var(--text-secondary)]">No cars in rework.</div>;
  }

  return (
    <ul className="scroll-thin flex max-h-48 flex-col gap-1 overflow-y-auto">
      {reworkQueue.map((item) => (
        <li
          key={item.id}
          className="animate-feed-row-in flex items-center justify-between gap-2 rounded-md bg-black/[0.03] px-2.5 py-1.5 text-xs"
        >
          <span className="font-mono-ui">{item.carId.slice(0, 6)}</span>
          <span className="text-[var(--text-secondary)]">{item.robotId}</span>
          <span className="font-mono-ui" style={{ color: 'var(--status-critical)' }}>
            {item.deviationMm > 0 ? '+' : ''}
            {item.deviationMm.toFixed(2)}mm
          </span>
          <span className="text-[var(--text-secondary)]">{timeAgo(item.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}
