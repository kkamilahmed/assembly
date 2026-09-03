import { useEffect } from 'react';
import { resetLine } from '@/state/engine';
import { useStore } from '@/state/store';
import { initStoryDirector, stopStoryDirector, triggerDriftCycle } from '@/state/storyDirector';

export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const store = useStore.getState();

      if (e.key === 'd' || e.key === 'D') {
        triggerDriftCycle();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        stopStoryDirector();
        resetLine();
        initStoryDirector();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        store.togglePause();
        return;
      }
      if (e.key === 'q' || e.key === 'Q') {
        store.toggleLiveVisionQC();
        return;
      }
      if (e.key === 'Escape') {
        if (store.shortcutOverlayOpen) store.setShortcutOverlayOpen(false);
        else store.setSelectedRobot(null);
        return;
      }
      if (e.key === '?') {
        store.setShortcutOverlayOpen(!store.shortcutOverlayOpen);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
