import { useStore } from '@/state/store';

const SHORTCUTS: Array<[string, string]> = [
  ['D', 'Slight deviation: oven zone 2 running hot'],
  ['E', 'Emergency: oven burner runaway'],
  ['S', 'Stop / start the line'],
  ['C', 'Recalibrate the oven'],
  ['A', 'Run on autopilot (press again to turn off)'],
  ['← / →', 'Move between Machines, Plant, Dashboard'],
  ['F', 'Fault injection panel (machines screen)'],
  ['R', 'Reset the demo'],
  ['Esc', 'Close the topmost overlay'],
  ['?', 'Toggle this overlay'],
];

export function ShortcutOverlay() {
  const open = useStore((s) => s.shortcutOverlayOpen);
  const setOpen = useStore((s) => s.setShortcutOverlayOpen);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setOpen(false)}>
      <div className="animate-fade-in w-[26rem] rounded-xl bg-[var(--surface)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-sm font-semibold">Keyboard shortcuts</div>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 text-xs">
              <dt className="font-mono-ui rounded bg-black/5 px-1.5 py-0.5">{key}</dt>
              <dd className="text-right text-[var(--text-secondary)]">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
