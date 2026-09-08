import { t } from "./i18n.js";

/**
 * Ctrl/Cmd+F "find in this diff", shared by every dialog that shows a diff
 * (View changes, Commit, Merge preview).
 *
 * Pressing Ctrl/Cmd+F while a diff pane is on screen opens a small search box
 * pinned to the TOP-RIGHT corner of the pane. What the user types is echoed
 * there, every occurrence in the rendered code is marked, and the current hit is
 * highlighted and scrolled into view. Enter / Shift+Enter (or the ▲/▼ buttons)
 * step through the hits, Escape closes the box without closing the dialog.
 *
 * The search runs over the already-rendered DOM (text nodes only, so
 * highlight.js's syntax spans stay intact) — the same technique changesDialog
 * uses for its file-list search highlight.
 */

/** Stop marking after this many hits so a huge file can't freeze the webview. */
const MAX_HITS = 5000;

interface Finder {
  pane: HTMLElement;
  scroll: HTMLElement;
  bar: HTMLElement;
  input: HTMLInputElement;
  counter: HTMLElement;
  /** The <mark> elements of the current query, in document order. */
  hits: HTMLElement[];
  /** Index of the focused hit, -1 when there is none. */
  index: number;
  debounce?: ReturnType<typeof setTimeout>;
}

/** The diff pane currently accepting the shortcut (only one dialog is open at a time). */
let active: Finder | null = null;
/** Query/open state kept across re-renders of the diff pane (file switch, minimap toggle). */
let lastQuery = "";
let lastOpen = false;
let keysBound = false;

/**
 * Forget the find state. Called when a dialog closes so the next one starts
 * with a closed, empty search box.
 */
export function resetDiffFind(): void {
  lastQuery = "";
  lastOpen = false;
}

/**
 * Attach the find box to a freshly rendered diff pane. `rightPx` keeps it clear
 * of the minimap gutter, exactly like the change navigator. Returns a cleanup
 * that removes the box and its marks.
 */
export function attachDiffFind(pane: HTMLElement, scroll: HTMLElement, rightPx: number): () => void {
  bindKeys();

  const bar = el("div", "diff-find");
  bar.style.right = `${rightPx}px`;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "diff-find-input";
  input.placeholder = t("find.placeholder");
  input.setAttribute("aria-label", t("find.placeholder"));
  input.spellcheck = false;
  const counter = el("span", "diff-find-count");

  const prev = button("diff-find-btn", "▲", () => step(-1));
  prev.title = t("find.prev");
  prev.setAttribute("aria-label", t("find.prev"));
  const next = button("diff-find-btn", "▼", () => step(1));
  next.title = t("find.next");
  next.setAttribute("aria-label", t("find.next"));
  const close = button("diff-find-btn diff-find-close", "×", () => closeBar());
  close.title = t("find.close");
  close.setAttribute("aria-label", t("find.close"));

  bar.append(input, counter, prev, next, close);
  pane.appendChild(bar);

  const finder: Finder = { pane, scroll, bar, input, counter, hits: [], index: -1 };
  active = finder;

  input.addEventListener("input", () => {
    lastQuery = input.value;
    clearTimeout(finder.debounce);
    finder.debounce = setTimeout(() => search(finder, input.value), 90);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
  });

  // Re-open with the previous query when the pane was re-rendered while the
  // box was open (e.g. the user picked another file).
  if (lastOpen) {
    showBar(finder, false);
    input.value = lastQuery;
    search(finder, lastQuery);
  } else {
    bar.hidden = true;
  }

  return () => {
    clearTimeout(finder.debounce);
    clearHits(finder);
    bar.remove();
    pane.classList.remove("diff-find-open");
    if (active === finder) active = null;
  };
}

/** Open (or re-focus) the find box of the active diff pane. */
function openFind(): void {
  if (!active) return;
  showBar(active, true);
  if (active.input.value !== "") search(active, active.input.value);
}

function showBar(f: Finder, focus: boolean): void {
  f.bar.hidden = false;
  f.pane.classList.add("diff-find-open");
  lastOpen = true;
  if (focus) {
    f.input.focus();
    f.input.select();
  }
}

function closeBar(): void {
  if (!active) return;
  clearHits(active);
  active.bar.hidden = true;
  active.pane.classList.remove("diff-find-open");
  active.counter.textContent = "";
  lastOpen = false;
}

/** Run the search and focus the first hit. */
function search(f: Finder, raw: string): void {
  clearHits(f);
  const q = raw.trim();
  if (q === "") {
    f.counter.textContent = "";
    f.input.classList.remove("diff-find-empty");
    return;
  }
  f.hits = markHits(f.scroll, q);
  f.index = f.hits.length > 0 ? 0 : -1;
  f.input.classList.toggle("diff-find-empty", f.hits.length === 0);
  focusHit(f, true);
}

/** Move to the next (+1) / previous (-1) hit, wrapping around. */
function step(delta: number): void {
  const f = active;
  if (!f || f.hits.length === 0) return;
  f.index = (f.index + delta + f.hits.length) % f.hits.length;
  focusHit(f, true);
}

function focusHit(f: Finder, scrollIntoView: boolean): void {
  for (const hit of f.hits) hit.classList.remove("diff-find-hit-current");
  const hit = f.index >= 0 ? f.hits[f.index] : undefined;
  if (hit) {
    hit.classList.add("diff-find-hit-current");
    if (scrollIntoView) hit.scrollIntoView({ block: "center", inline: "nearest" });
  }
  f.counter.textContent =
    f.hits.length === 0 ? t("find.noResults") : `${f.index + 1} / ${f.hits.length}`;
}

/** Unwrap every <mark> we added and glue the split text back together. */
function clearHits(f: Finder): void {
  const parents = new Set<Node>();
  for (const hit of f.hits) {
    const parent = hit.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(hit.textContent ?? ""), hit);
    parents.add(parent);
  }
  parents.forEach((parent) => (parent as Element).normalize());
  f.hits = [];
  f.index = -1;
}

/**
 * Wrap every case-insensitive occurrence of `query` in the diff's code cells with
 * a <mark class="diff-find-hit">, returning them in document order. Text nodes
 * only, so highlight.js's spans are untouched.
 */
function markHits(root: HTMLElement, query: string): HTMLElement[] {
  const q = query.toLowerCase();
  const hits: HTMLElement[] = [];
  const cells = root.querySelectorAll<HTMLElement>(".diff-code");
  for (let c = 0; c < cells.length && hits.length < MAX_HITS; c++) {
    const cell = cells[c]!;
    // Collect the text nodes up front — we mutate the tree as we go.
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) textNodes.push(node as Text);
    for (const textNode of textNodes) {
      const text = textNode.nodeValue ?? "";
      const lower = text.toLowerCase();
      if (!lower.includes(q)) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      let idx = lower.indexOf(q);
      while (idx >= 0 && hits.length < MAX_HITS) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.className = "diff-find-hit";
        mark.textContent = text.slice(idx, idx + q.length);
        hits.push(mark);
        frag.appendChild(mark);
        last = idx + q.length;
        idx = lower.indexOf(q, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode?.replaceChild(frag, textNode);
    }
  }
  return hits;
}

/**
 * Global shortcuts, bound once in the capture phase so Escape closes the find
 * box instead of the dialog underneath it (each dialog listens for Escape on
 * document too).
 */
function bindKeys(): void {
  if (keysBound) return;
  keysBound = true;
  document.addEventListener(
    "keydown",
    (e) => {
      if (!active || !active.pane.isConnected) return;
      const findKey = (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "f" || e.key === "F");
      if (findKey) {
        e.preventDefault();
        e.stopPropagation();
        openFind();
        return;
      }
      if (active.bar.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeBar();
        return;
      }
      // F3 / Cmd+G repeat the search from anywhere in the dialog.
      if (e.key === "F3" || ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G"))) {
        e.preventDefault();
        e.stopPropagation();
        step(e.shiftKey ? -1 : 1);
      }
    },
    true,
  );
}

/* small DOM helpers (mirroring diffView.ts) */
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
