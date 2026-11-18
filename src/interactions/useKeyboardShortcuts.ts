import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { injectDeviation, recalibrate, resetDemo, toggleAutopilot, toggleLine } from '@/state/storyDirector';
import { stepView, type View } from '@/ui/views';


/**
 * Every presenter key, in one place, live on every screen: the story moves
 * between the plant, the dashboard and the machines, and the keys have to
 * work from all three.
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
        case 'ArrowRight':
          e.preventDefault();
          setView(stepView(view, 1));
          return;
        case 'ArrowLeft':
          e.preventDefault();
          setView(stepView(view, -1));
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
