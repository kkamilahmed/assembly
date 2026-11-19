import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from '@/interactions/useKeyboardShortcuts';
import { Scene } from '@/scene/Scene';
import { initEngine } from '@/state/engine';
import { ActionBar } from '@/ui/ActionBar';
import { DashboardScreen } from '@/ui/DashboardScreen';
import { GlobeHud } from '@/ui/GlobeHud';
import { NetworkOverlay } from '@/ui/NetworkOverlay';
import { ShortcutOverlay } from '@/ui/ShortcutOverlay';
import { SourcesScreen } from '@/ui/SourcesScreen';
import { TopBar } from '@/ui/TopBar';
import type { View } from '@/ui/views';

/** Matches the .view-layer transition in index.css. */
const TRANSITION_MS = 550;

const params = new URLSearchParams(window.location.search);
/** `?still=1`: the globe alone, full window, no chrome. Used for stills. */
const STILL = params.get('still') === '1';

export default function App() {
  if (STILL) return <StillView />;
  return <Demo />;
}

function StillView() {
  useEffect(() => {
    initEngine();
  }, []);
  // The presenter keys work here too, so a close-up can be taken mid-story.
  useKeyboardShortcuts('network', () => {});
  return (
    <div className="h-full w-full">
      <Scene active interactive={false} />
    </div>
  );
}

function Demo() {
  const [view, setViewState] = useState<View>('network');
  // Which screens are still rendering 3D frames. A screen keeps rendering for
  // the length of the crossfade so it doesn't freeze mid-fade, then stops so
  // a hidden one costs no GPU time.
  const [rendering, setRendering] = useState<Record<View, boolean>>({ sources: false, network: true, dashboard: false });
  const settleTimer = useRef<number | undefined>(undefined);

  const setView = useCallback((next: View) => {
    setViewState(next);
    setRendering((r) => ({ ...r, [next]: true }));
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(
      () => setRendering({ sources: next === 'sources', network: next === 'network', dashboard: next === 'dashboard' }),
      TRANSITION_MS,
    );
  }, []);

  useEffect(() => {
    initEngine();
    return () => window.clearTimeout(settleTimer.current);
  }, []);

  useKeyboardShortcuts(view, setView);

  const layer = (v: View) => `view-layer ${view === v ? '' : 'view-layer-out'}`;

  // All three screens stay mounted for the whole session. The network keeps
  // running while the presenter is on another screen, and coming back must
  // not reset the view they left it at.
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      <div className={layer('sources')} aria-hidden={view !== 'sources'}>
        <SourcesScreen view={view} onNavigate={setView} />
      </div>

      <div className={layer('network')} aria-hidden={view !== 'network'}>
        <div className="relative flex h-full w-full flex-col bg-[var(--bg)]">
          <TopBar view={view} onNavigate={setView} />
          <div className="relative min-h-0 flex-1">
            <Scene active={rendering.network} />
            <GlobeHud />
            <NetworkOverlay />
            <ActionBar />
          </div>
        </div>
      </div>

      <div className={layer('dashboard')} aria-hidden={view !== 'dashboard'}>
        <DashboardScreen view={view} onNavigate={setView} />
      </div>

      <ShortcutOverlay />
    </div>
  );
}
