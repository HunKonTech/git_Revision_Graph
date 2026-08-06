/**
 * Persisted choice of *how a branch is merged* from the graph's context menu.
 *
 *  - "merge"  — an ordinary `git merge`: the source branch's commits become part
 *    of the current branch's history, joined by a merge commit (or fast-forwarded).
 *  - "squash" — `git merge --squash` + `git commit`: the whole branch collapses
 *    into ONE ordinary commit on the current branch. No merge commit, no second
 *    parent, so the source branch's individual commits never enter the current
 *    branch's history (they stay on their own branch, in their own lane).
 *
 * The choice lives in localStorage (like the language and display-mode settings)
 * so it survives reloads without involving the host. Defaults to the ordinary
 * merge — the behaviour every host had before squash merging existed.
 */

export type MergeMode = "merge" | "squash";

export const DEFAULT_MERGE_MODE: MergeMode = "merge";

const STORAGE_KEY = "revGraph.mergeMode";

function load(): MergeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "merge" || v === "squash") return v;
  } catch {
    /* localStorage may be unavailable; fall back to the default. */
  }
  return DEFAULT_MERGE_MODE;
}

let current: MergeMode = load();
const listeners = new Set<() => void>();

/** The merge style used by the Merge Branch dialog. */
export function getMergeMode(): MergeMode {
  return current;
}

/** Pick a merge style, persist it, and notify subscribers. */
export function setMergeMode(mode: MergeMode): void {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore persistence failures */
  }
  listeners.forEach((l) => l());
}

/** Subscribe to changes; returns an unsubscribe function. */
export function onMergeModeChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
