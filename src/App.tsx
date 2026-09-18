import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from '@/interactions/useKeyboardShortcuts';
import { useStore } from '@/state/store';
import { Scene } from '@/scene/Scene';
import { initLineEngine } from '@/state/engine';
import { initStoryDirector } from '@/state/storyDirector';
import { EventFeed } from '@/ui/EventFeed';
import { FleetOverview } from '@/ui/FleetOverview';
import { IncidentReplay } from '@/ui/IncidentReplay';
import { RobotPanel } from '@/ui/RobotPanel';
import { PresenterCue } from '@/ui/PresenterCue';
import { ShortcutOverlay } from '@/ui/ShortcutOverlay';
import { TopBar } from '@/ui/TopBar';

type View = 'fleet' | 'line';

// How long the fleet <-> line crossfade takes — long enough to read as a
// deliberate hand-off, short enough not to feel like it's blocking input.
const TRANSITION_MS = 550;

export default function App() {
  const [view, setView] = useState<View>('fleet');

  // Both layers are kept mounted for the ~TRANSITION_MS window while one
  // fades/scales out and the other fades/scales in (see .view-layer in
  // index.css) — a plain view-swap was an instant cut, which read as
  // abrupt. `xxxShown` mounts a layer; `xxxOut` is the CSS state that
  // drives its transition, flipped a frame after mount so the browser
  // actually has a "from" state to animate away from.
  const [fleetShown, setFleetShown] = useState(true);
  const [lineShown, setLineShown] = useState(false);
  const [fleetOut, setFleetOut] = useState(false);
  const [lineOut, setLineOut] = useState(true);

  const lineEverEntered = useRef(false);
  const transitionTimer = useRef<number | undefined>(undefined);
  const isTransitioning = fleetShown && lineShown;

  useKeyboardShortcuts(view === 'line' && !isTransitioning);

  useEffect(() => {
    // The line sim (cars, welds, drift story) only starts the first time the
    // user actually enters it — the fleet overview shows idle machines with
    // nothing docked, not a scene that's already been running unseen.
    if (!lineShown || lineEverEntered.current) return;
    lineEverEntered.current = true;
    initLineEngine();
    initStoryDirector();
  }, [lineShown]);

  const goTo = useCallback(
    (next: View) => {
      if (view === next || isTransitioning) return;
      window.clearTimeout(transitionTimer.current);

      if (next === 'line') setLineShown(true);
      else setFleetShown(true);

      // Double rAF: let the just-mounted layer commit and paint at its
      // hidden ("out") style first, then flip both layers' target style on
      // the following frame so the opacity/transform change is a transition,
      // not an instant jump.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFleetOut(next === 'line');
          setLineOut(next === 'fleet');
        });
      });

      transitionTimer.current = window.setTimeout(() => {
        setView(next);
        if (next === 'line') setFleetShown(false);
        else setLineShown(false);
      }, TRANSITION_MS);
    },
    [view, isTransitioning],
  );

  const replayOpen = useStore((s) => s.replayOpen);
  const shortcutOverlayOpen = useStore((s) => s.shortcutOverlayOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never navigate out from under an open overlay — and never steal the
      // arrow keys from the replay's scrub slider, which is focusable and
      // arrow-driven by design.
      if (replayOpen || shortcutOverlayOpen) return;
      if (e.key === 'ArrowRight' && view === 'fleet') {
        e.preventDefault();
        goTo('line');
      } else if (e.key === 'ArrowLeft' && view === 'line') {
        e.preventDefault();
        goTo('fleet');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, goTo, replayOpen, shortcutOverlayOpen]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      {fleetShown && (
        <div className={`view-layer ${fleetOut ? 'view-layer-out' : ''}`}>
          <FleetOverview onEnter={() => goTo('line')} />
        </div>
      )}

      {lineShown && (
        <div className={`view-layer ${lineOut ? 'view-layer-out' : ''}`}>
          <div className="relative flex h-full w-full flex-col bg-[var(--bg)]">
            <TopBar />
            <div className="relative flex min-h-0 flex-1">
              <div className="relative min-w-0 flex-1">
                <Scene />
              </div>
              <div className="scroll-thin flex w-80 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Robots</div>
                  <RobotPanel />
                </div>
                {/* One feed, no tabs. The Rework tab duplicated what the
                    event feed already says ("pulled car X for rework") and
                    added a control that has to be explained on stage; the
                    full queue lives on the incident replay, where it is
                    actually being read. */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    What the operator was told
                  </div>
                  <EventFeed />
                </div>
              </div>
            </div>
            <IncidentReplay />
            <PresenterCue />
            <ShortcutOverlay />
          </div>
        </div>
      )}
    </div>
  );
}
