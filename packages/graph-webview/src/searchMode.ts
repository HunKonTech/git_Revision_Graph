/** Persist the user's search display mode: filter (hide non-matches) or highlight (show all, mark matches). */

const STORAGE_KEY = "revGraph.searchMode";
const DEFAULT_MODE: SearchMode = "highlight";

type SearchMode = "filter" | "highlight";

let current: SearchMode = load();
const listeners = new Set<() => void>();

function load(): SearchMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "filter" || v === "highlight") return v;
  } catch {
    // Ignore localStorage unavailable / quota exceeded
  }
  return DEFAULT_MODE;
}

export function getSearchMode(): SearchMode {
  return current;
}

export function setSearchMode(mode: SearchMode): void {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore localStorage error
  }
  listeners.forEach((l) => l());
}

export function onSearchModeChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
