import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts, type View } from '@/interactions/useKeyboardShortcuts';
import { SHOTS, type ShotId } from '@/scene/layout';
import { Scene } from '@/scene/Scene';
import { initEngine } from '@/state/engine';
import { ActionBar } from '@/ui/ActionBar';
import { EventFeed } from '@/ui/EventFeed';
import { FleetOverview } from '@/ui/FleetOverview';
import { LineOverlay } from '@/ui/LineOverlay';
import { OvenPanel } from '@/ui/OvenPanel';
import { ShortcutOverlay } from '@/ui/ShortcutOverlay';
import { TopBar } from '@/ui/TopBar';

/** Matches the .view-layer transition in index.css. */
const TRANSITION_MS = 550;

const params = new URLSearchParams(window.location.search);
/** `?still=1&shot=S02`: the scene alone, full window, no chrome. Used by the
 *  cook harness to render comparison stills. */
const STILL = params.get('still') === '1';
const STILL_SHOT = (params.get('shot') as ShotId | null) ?? 'S01';

export default function App() {
  if (STILL) return <StillView />;
  return <Demo />;
}

function StillView() {
  useEffect(() => {
    initEngine();
  }, []);
  return (
    <div className="h-full w-full">
      <Scene active shot={STILL_SHOT in SHOTS ? STILL_SHOT : 'S01'} interactive={false} />
    </div>
  );
}

function Demo() {
  const [view, setViewState] = useState<View>('plant');
  // Which views are still rendering frames. A view keeps rendering for the
  // length of the crossfade so it doesn't freeze mid-fade, then stops so the
  // hidden one costs no GPU time.
  const [rendering, setRendering] = useState<Record<View, boolean>>({ plant: true, machines: false });
  const settleTimer = useRef<number | undefined>(undefined);

  const setView = useCallback((next: View) => {
    setViewState(next);
    setRendering((r) => ({ ...r, [next]: true }));
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(
      () => setRendering({ plant: next === 'plant', machines: next === 'machines' }),
      TRANSITION_MS,
    );
  }, []);

  useEffect(() => {
    initEngine();
    return () => window.clearTimeout(settleTimer.current);
  }, []);

  useKeyboardShortcuts(view, setView);

  // Both views stay mounted for the whole session. The plant keeps running
  // while the presenter is on the machines screen, and coming back must not
  // replay the camera intro or reset the orbit they left it at.
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      <div className={`view-layer ${view === 'plant' ? '' : 'view-layer-out'}`} aria-hidden={view !== 'plant'}>
        <div className="relative flex h-full w-full flex-col bg-[var(--bg)]">
          <TopBar onSwitch={() => setView('machines')} />
          <div className="relative flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              <Scene active={rendering.plant} />
              <LineOverlay />
              <ActionBar />
            </div>
            <div className="scroll-thin flex w-80 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Oven
                </div>
                <OvenPanel />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Live events
                </div>
                <EventFeed />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`view-layer ${view === 'machines' ? '' : 'view-layer-out'}`} aria-hidden={view !== 'machines'}>
        <FleetOverview active={rendering.machines} onBack={() => setView('plant')} />
      </div>

      <ShortcutOverlay />
    </div>
  );
}
