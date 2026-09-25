/**
 * Persist whether the changes dialog's file search also matches file *contents*
 * (methods, identifiers) — via cached diffs and a host-side `git grep` over the
 * commit's tree — or only file names.
 */

const STORAGE_KEY = "revGraph.changesContentSearch";

let current: boolean = load();
const listeners = new Set<() => void>();

function load(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "false") return false;
  } catch {
    // Ignore localStorage unavailable
  }
  return true;
}

export function getContentSearch(): boolean {
  return current;
}

export function setContentSearch(on: boolean): void {
  if (on === current) return;
  current = on;
  try {
    localStorage.setItem(STORAGE_KEY, String(on));
  } catch {
    // Ignore localStorage error
  }
  listeners.forEach((l) => l());
}

export function onContentSearchChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
