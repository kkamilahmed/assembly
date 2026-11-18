import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { injectDeviation, recalibrate, resetDemo, toggleAutopilot, toggleLine } from '@/state/storyDirector';

export type View = 'plant' | 'machines';

/**
 * Every presenter key, in one place, live on both screens - the story moves
 * between the plant and the machines and the keys have to work from either.
 */
export function useKeyboardShortcuts(view: View, setView: (v: View) => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Never steal keys from a focused control, e.g. the fault panel's
      // intensity slider.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const store = useStore.getState();
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      switch (key) {
        case 'd':
          injectDeviation('slight');
          return;
        case 'e':
          injectDeviation('emergency');
          return;
        case 's':
          toggleLine();
          return;
        case 'c':
          recalibrate('operator');
          return;
        case 'a':
          toggleAutopilot();
          return;
        case 'r':
          resetDemo();
          return;
        case 'm':
          setView(view === 'plant' ? 'machines' : 'plant');
          return;
        case 'ArrowRight':
          e.preventDefault();
          setView('machines');
          return;
        case 'ArrowLeft':
          e.preventDefault();
          setView('plant');
          return;
        case 'f':
          if (view === 'machines') store.setFaultPanelOpen(!store.faultPanelOpen);
          return;
        case '?':
          store.setShortcutOverlayOpen(!store.shortcutOverlayOpen);
          return;
        case 'Escape':
          if (store.shortcutOverlayOpen) store.setShortcutOverlayOpen(false);
          else if (store.faultPanelOpen) store.setFaultPanelOpen(false);
          else if (store.autopilotCatch) store.dismissAutopilotCatch();
          return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, setView]);
}
