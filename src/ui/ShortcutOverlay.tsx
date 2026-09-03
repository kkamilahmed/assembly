import { useStore } from '@/state/store';

const SHORTCUTS: Array<[string, string]> = [
  ['←', 'Back to fleet overview'],
  ['D', 'Trigger the weld-drift scenario'],
  ['R', 'Reset the simulation'],
  ['Space', 'Pause / resume'],
  ['Q', 'Toggle live vision QC'],
  ['Esc', 'Close this overlay'],
  ['?', 'Toggle this overlay'],
];

export function ShortcutOverlay() {
  const open = useStore((s) => s.shortcutOverlayOpen);
  const setOpen = useStore((s) => s.setShortcutOverlayOpen);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20" onClick={() => setOpen(false)}>
      <div className="animate-fade-in w-80 rounded-xl bg-[var(--surface)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-sm font-semibold">Keyboard shortcuts</div>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <dt className="font-mono-ui rounded bg-black/5 px-1.5 py-0.5">{key}</dt>
              <dd className="text-[var(--text-secondary)]">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
