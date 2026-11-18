import { useStore } from '@/state/store';
import { STATUS_HEX } from './colors';

const TONE_COLOR: Record<string, string> = {
  info: '#9aa0a8',
  warning: STATUS_HEX.warning,
  critical: STATUS_HEX.critical,
  success: STATUS_HEX.healthy,
};

export function EventFeed() {
  const feed = useStore((s) => s.feed);

  return (
    <ul
      className="scroll-thin flex max-h-64 flex-col gap-1 overflow-y-auto pb-1"
      // Rows are one or two lines depending on the message, so no fixed
      // max-height lands on a row boundary - the last visible row was
      // always sliced through its own text. The mask fades whatever is
      // clipped instead of chopping it, which also reads as "scrolls".
      style={{
        maskImage: 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)',
      }}
    >
      {feed.length === 0 && <li className="text-xs text-[var(--text-secondary)]">No events yet.</li>}
      {feed.map((item) => (
        <li key={item.id} className="animate-feed-row-in shrink-0 rounded-md bg-black/[0.03] px-2.5 py-1.5 text-xs leading-snug">
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ backgroundColor: TONE_COLOR[item.tone] }}
          />
          {item.text}
        </li>
      ))}
    </ul>
  );
}
