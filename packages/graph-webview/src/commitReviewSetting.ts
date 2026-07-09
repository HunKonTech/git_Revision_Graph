const KEY = "revGraph.commitReviewBeforeCommit";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Whether the commit dialog pauses on a review step before creating a commit. */
export function getCommitReviewBeforeCommit(): boolean {
  const raw = localStorage.getItem(KEY);
  return raw == null ? true : raw === "1";
}

export function setCommitReviewBeforeCommit(value: boolean): void {
  localStorage.setItem(KEY, value ? "1" : "0");
  listeners.forEach((l) => l());
}

export function onCommitReviewBeforeCommitChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
