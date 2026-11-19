import { VIEWS, type View } from './views';
import { Kbd } from './Kbd';

const LABELS: Record<View, string> = { sources: 'Sources', network: 'Network', dashboard: 'Dashboard' };

/** The three screens in the order the arrow keys walk them, shown in every
 *  screen's header so the presenter (and the room) can see where they are. */
export function ViewNav({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const i = VIEWS.indexOf(view);
  return (
    <div className="flex items-center gap-2">
      <Kbd>&larr;</Kbd>
      <div className="flex rounded-lg bg-black/[0.05] p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-pressed={v === view}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              v === view ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {LABELS[v]}
          </button>
        ))}
      </div>
      <Kbd>&rarr;</Kbd>
      <span className="sr-only">
        Screen {i + 1} of {VIEWS.length}
      </span>
    </div>
  );
}
