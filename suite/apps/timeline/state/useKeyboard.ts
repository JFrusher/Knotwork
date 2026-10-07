import { useEffect } from "react";
import { useKnotworkStore } from "@/lib/store/useKnotworkStore";
import { currentDoc, useStore } from "./store";

/** True while the user is typing into a field, where our shortcuts must not fire. */
function inTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** The whole shortcut policy, as a plain function so it can be tested directly. */
export function handleKey(event: KeyboardEvent): void {
  const state = useStore.getState();
  const mod = event.metaKey || event.ctrlKey;

  if (mod && event.key.toLowerCase() === "z") {
    // Undo works from a field too — it is what people reach for there as well.
    // The wedding's one history, which the header's buttons drive; a drag in
    // progress is dropped first, since it was a change to the day being undone.
    event.preventDefault();
    state.cancelPreview();
    const history = useKnotworkStore.getState();
    if (event.shiftKey) history.redo();
    else history.undo();
    return;
  }

  if (inTextEntry(event.target)) return;

  if (event.key === "Escape") {
    if (state.ui.presentation) state.setUi({ presentation: false });
    else if (state.preview) state.cancelPreview();
    else state.select(null);
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const doc = currentDoc();
    const current = doc.blocks.find((block) => block.id === state.selectedId);
    if (!current) return;
    const lane = doc.blocks.filter((block) => block.lane === current.lane);
    const at = lane.findIndex((block) => block.id === current.id);
    const next = lane[at + (event.key === "ArrowRight" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      state.select(next.id);
    }
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && state.selectedId) {
    event.preventDefault();
    state.deleteBlock(state.selectedId);
  }
}

export function useKeyboard(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
}
