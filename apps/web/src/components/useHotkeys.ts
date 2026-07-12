import { useEffect, useRef } from 'react';
import { nextChord, type ChordState } from './commands';

type HotkeyHandlers = {
  /** Ctrl/Cmd+K — toggles the palette (works even while the palette is open). */
  onTogglePalette: () => void;
  /** `/` — opens the palette with the search input focused. */
  onOpenPalette: () => void;
  /** `?` — opens the shortcut cheat-sheet. */
  onOpenHelp: () => void;
  /** Completed `g`+letter chord → section key (caller applies role gating). */
  onGoto: (sectionKey: string) => void;
};

/** True when the event originates from a typing context (never steal those keys). */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  );
}

/** True while any Radix dialog/sheet is open (Escape and focus belong to it). */
function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
}

/**
 * Single global keydown listener for the app shell:
 * Ctrl/Cmd+K toggle, `/` open, `?` help, `g`+letter section chords.
 * Ignores typing contexts and open dialogs (except Ctrl/Cmd+K, which must be
 * able to toggle the palette closed); Escape is left to Radix.
 */
export function useHotkeys(handlers: HotkeyHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const chordRef = useRef<ChordState>({ armedAt: null });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd+K first: it works everywhere, including while a dialog is open.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handlersRef.current.onTogglePalette();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || isDialogOpen()) return;

      if (e.key === '/') {
        e.preventDefault();
        handlersRef.current.onOpenPalette();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        handlersRef.current.onOpenHelp();
        return;
      }
      const { state, goto } = nextChord(chordRef.current, e.key, e.timeStamp);
      chordRef.current = state;
      if (goto) handlersRef.current.onGoto(goto);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
