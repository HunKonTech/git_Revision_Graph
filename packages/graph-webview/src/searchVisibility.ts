/** Persist the user's search UI visibility preference: toolbar button vs always-visible bar. */

const STORAGE_KEY = "revGraph.searchVisibility";
const DEFAULT_VISIBILITY: SearchVisibility = "toolbar";

type SearchVisibility = "toolbar" | "always-visible";

let current: SearchVisibility = load();
const listeners = new Set<() => void>();

function load(): SearchVisibility {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "toolbar" || v === "always-visible") return v;
  } catch {
    // Ignore localStorage unavailable / quota exceeded
  }
  return DEFAULT_VISIBILITY;
}

export function getSearchVisibility(): SearchVisibility {
  return current;
}

export function setSearchVisibility(visibility: SearchVisibility): void {
  if (visibility === current) return;
  current = visibility;
  try {
    localStorage.setItem(STORAGE_KEY, visibility);
  } catch {
    // Ignore localStorage error
  }
  listeners.forEach((l) => l());
}

export function onSearchVisibilityChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
