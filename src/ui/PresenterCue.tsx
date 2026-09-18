import { useStore } from '@/state/store';
import { ACTS } from '@/presenter/acts';
import { IS_DETERMINISTIC, SPEED } from '@/presenter/presenterConfig';
import { STATUS_HEX } from './colors';

/** The presenter's own corner of the screen: which act is running, the claim
 *  it exists to make, and what to do next.
 *
 *  Deliberately small and in the bottom-left, away from both the dashboard
 *  and the reveal banner. It is off until an act key is pressed, so the demo
 *  looks exactly as it did before for anyone who never uses presenter mode.
 */
export function PresenterCue() {
  const open = useStore((s) => s.presenterCueOpen);
  const actN = useStore((s) => s.presenterAct);
  const setOpen = useStore((s) => s.setPresenterCueOpen);

  if (!open) return null;
  const act = ACTS.find((a) => a.n === actN) ?? null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-50 w-80 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Presenter</span>
        <div className="ml-auto flex items-center gap-1">
          {ACTS.map((a) => (
            <span
              key={a.n}
              className="font-mono-ui flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold"
              style={{
                backgroundColor: a.n === actN ? 'var(--brand-orange)' : 'rgba(0,0,0,0.06)',
                color: a.n === actN ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {a.n}
            </span>
          ))}
          <button
            onClick={() => setOpen(false)}
            aria-label="Hide presenter cue card"
            className="ml-1 rounded px-1.5 text-xs text-[var(--text-secondary)] hover:bg-black/5"
          >
            &times;
          </button>
        </div>
      </div>

      {act ? (
        <>
          <div className="mt-1.5 text-sm font-semibold">
            Act {act.n}. {act.title}
          </div>
          <div className="mt-1 text-xs leading-snug text-[var(--text-secondary)]">{act.beat}</div>
          <div className="mt-2 rounded-md bg-black/[0.04] px-2 py-1.5 text-xs leading-snug">{act.cue}</div>
        </>
      ) : (
        <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
          Press <Key>1</Key>&ndash;<Key>4</Key> to stage an act.
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
        <span className="font-mono-ui">{SPEED === 1 ? '1x' : `${SPEED}x`} speed</span>
        <span
          className="font-mono-ui"
          style={{ color: IS_DETERMINISTIC ? STATUS_HEX.healthy : STATUS_HEX.warning }}
          title={
            IS_DETERMINISTIC
              ? 'Fixed seed: this run reproduces the rehearsal exactly.'
              : 'Random seed: numbers will differ from the rehearsal.'
          }
        >
          {IS_DETERMINISTIC ? 'seeded' : 'random'}
        </span>
        <span className="ml-auto">
          <Key>P</Key> hide
        </span>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="font-mono-ui rounded bg-black/10 px-1 py-0.5 text-[10px]">{children}</kbd>;
}
