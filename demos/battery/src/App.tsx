import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from '@/interactions/useKeyboardShortcuts';
import { SHOTS, type ShotId } from '@/scene/layout';
import { Scene } from '@/scene/Scene';
import { initEngine } from '@/state/engine';
import { ActionBar } from '@/ui/ActionBar';
import { DashboardScreen } from '@/ui/DashboardScreen';
import { FleetOverview } from '@/ui/FleetOverview';
import { LineOverlay } from '@/ui/LineOverlay';
import { ShortcutOverlay } from '@/ui/ShortcutOverlay';
import { TopBar } from '@/ui/TopBar';
import type { View } from '@/ui/views';

/** Matches the .view-layer transition in index.css. */
const TRANSITION_MS = 550;

const params = new URLSearchParams(window.location.search);
/** `?still=1&shot=S02`: the scene alone, full window, no chrome. Used by the
 *  cook harness to render comparison stills. */
const STILL = params.get('still') === '1';
const STILL_SHOT = (params.get('shot') as ShotId | null) ?? 'S01';
/** `&target=x,y,z&zoom=n` frames any detail instead of a named shot. */
const STILL_TARGET = params.get('target')?.split(',').map(Number) as [number, number, number] | undefined;
const STILL_ZOOM = Number(params.get('zoom')) || undefined;

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
      <Scene active shot={STILL_SHOT in SHOTS ? STILL_SHOT : 'S01'} target={STILL_TARGET} zoom={STILL_ZOOM} interactive={false} />
    </div>
  );
}

function Demo() {
  const [view, setViewState] = useState<View>('plant');
  // Which screens are still rendering 3D frames. A screen keeps rendering for
  // the length of the crossfade so it doesn't freeze mid-fade, then stops so
  // a hidden one costs no GPU time.
  const [rendering, setRendering] = useState<Record<View, boolean>>({ machines: false, plant: true, dashboard: false });
  const settleTimer = useRef<number | undefined>(undefined);

  const setView = useCallback((next: View) => {
    setViewState(next);
    setRendering((r) => ({ ...r, [next]: true }));
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(
      () => setRendering({ machines: next === 'machines', plant: next === 'plant', dashboard: next === 'dashboard' }),
      TRANSITION_MS,
    );
  }, []);

  useEffect(() => {
    initEngine();
    return () => window.clearTimeout(settleTimer.current);
  }, []);

  useKeyboardShortcuts(view, setView);

  const layer = (v: View) => `view-layer ${view === v ? '' : 'view-layer-out'}`;

  // All three screens stay mounted for the whole session. The plant keeps
  // running while the presenter is on another screen, and coming back must
  // not reset the view they left it at.
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      <div className={layer('machines')} aria-hidden={view !== 'machines'}>
        <FleetOverview active={rendering.machines} view={view} onNavigate={setView} />
      </div>

      <div className={layer('plant')} aria-hidden={view !== 'plant'}>
        <div className="relative flex h-full w-full flex-col bg-[var(--bg)]">
          <TopBar view={view} onNavigate={setView} />
          <div className="relative min-h-0 flex-1">
            <Scene active={rendering.plant} />
            <LineOverlay />
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
