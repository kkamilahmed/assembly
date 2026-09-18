import { useStore } from '@/state/store';

const SHORTCUTS: Array<[string, string]> = [
  ['1 – 4', 'Stage keynote act 1-4'],
  ['P', 'Presenter cue card'],
  ['C', 'Recalibrate WELD-01'],
  ['←', 'Back to fleet overview'],
  ['D', 'Inject the weld-drift fault now'],
  ['R', 'Reset the simulation'],
  ['Space', 'Pause / resume'],
  ['Q', 'Switch inspection mode (every weld / 1 in 7)'],
  ['I', 'Open incident replay'],
  ['Esc', 'Close this overlay'],
  ['?', 'Toggle this overlay'],
];

export function ShortcutOverlay() {
  const open = useStore((s) => s.shortcutOverlayOpen);
  const setOpen = useStore((s) => s.setShortcutOverlayOpen);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20" onClick={() => setOpen(false)}>
      <div className="animate-fade-in w-96 rounded-xl bg-[var(--surface)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
