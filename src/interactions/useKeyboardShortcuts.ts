import { useEffect } from 'react';
import { presenterRecalibrate, runAct } from '@/presenter/acts';
import { resetLine } from '@/state/engine';
import { useStore } from '@/state/store';
import { initStoryDirector, stopStoryDirector, triggerDriftCycle } from '@/state/storyDirector';

export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const store = useStore.getState();

      // Presenter acts. Each stages its own preconditions deterministically
      // (see presenter/acts.ts) so a beat can be re-run mid-talk without
      // reassembling it by hand.
      if (e.key >= '1' && e.key <= '4') {
        runAct(Number(e.key));
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        store.setPresenterCueOpen(!store.presenterCueOpen);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        presenterRecalibrate();
        return;
      }
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
      if (e.key === 'i' || e.key === 'I') {
        store.setReplayOpen(!store.replayOpen);
        return;
      }
      if (e.key === 'Escape') {
        if (store.shortcutOverlayOpen) store.setShortcutOverlayOpen(false);
        else if (store.replayOpen) store.setReplayOpen(false);
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
