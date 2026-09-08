/**
 * Persisted choice of *how the graph shows the commits a merge brought in*.
 *
 *  - "branchOnly" — the way the graph has always drawn it: the merged branch's
 *    commits stay in their own lane, and the merge shows up only as an edge.
 *  - "inTarget"   — the commits are ALSO drawn inside the branch the merge
 *    landed on, as a clearly marked second copy stacked under the merge commit,
 *    level with the original. `git log main` lists those commits, so the graph
 *    now says the same thing; the marking keeps it obvious that they were not
 *    written there.
 *
 * This is a pure rendering choice — it changes no git state and never reaches
 * the host. Squash merges are unaffected by construction: a squash writes one
 * ordinary single-parent commit, so the branch's own commits never become part
 * of the target's history and only that one commit is ever shown.
 *
 * The choice lives in localStorage (like the language and merge-style settings)
 * so it survives reloads without involving the host. Defaults to the classic
 * view — the behaviour every host had before this setting existed.
 */

export type MergedView = "branchOnly" | "inTarget";

export const DEFAULT_MERGED_VIEW: MergedView = "branchOnly";

const STORAGE_KEY = "revGraph.mergedView";

function load(): MergedView {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "branchOnly" || v === "inTarget") return v;
  } catch {
    /* localStorage may be unavailable; fall back to the default. */
  }
  return DEFAULT_MERGED_VIEW;
}

let current: MergedView = load();
const listeners = new Set<() => void>();

/** How merged-in commits are shown in the graph. */
export function getMergedView(): MergedView {
  return current;
}

/** True when merged-in commits are also drawn in the receiving branch's lane. */
export function showsMergedInTarget(): boolean {
  return current === "inTarget";
}

/** Pick a view, persist it, and notify subscribers. */
export function setMergedView(view: MergedView): void {
  if (view === current) return;
  current = view;
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    /* ignore persistence failures */
  }
  listeners.forEach((l) => l());
}

/** Subscribe to changes; returns an unsubscribe function. */
export function onMergedViewChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
