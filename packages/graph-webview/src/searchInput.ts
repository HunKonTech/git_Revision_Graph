import { t } from "./i18n";
import { getSearchVisibility } from "./searchVisibility";

export type SearchInputCallback = (query: string, searchType: "message" | "author" | "hash" | "branch" | "auto") => void;

let container: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let onSearch: SearchInputCallback | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Render a search bar/modal with unified input and optional separated fields.
 * In toolbar mode, returns a button to open the modal.
 * In always-visible mode, appends the search bar to the document.
 */
export function renderSearchBar(callback: SearchInputCallback): HTMLElement {
  onSearch = callback;

  const visibility = getSearchVisibility();

  if (visibility === "toolbar") {
    return renderToolbarButton();
  } else {
    return renderAlwaysVisibleBar();
  }
}

function renderToolbarButton(): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "toolbar-icon search-button";
  btn.title = t("search.tooltip") || "Search";
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="14" y1="14" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
  </svg>`;
  btn.addEventListener("click", () => openSearchModal());
  return btn;
}

function renderAlwaysVisibleBar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "search-bar";

  input = document.createElement("input");
  input.type = "text";
  input.placeholder = t("search.placeholder") || "Search commits…";
  input.className = "search-input";
  input.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (onSearch) onSearch(query, "auto");
    }, 100); // Immediate (0-100ms)
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input!.value = "";
      input!.blur();
    } else if (e.key === "Enter") {
      const query = (e.target as HTMLInputElement).value;
      if (onSearch) onSearch(query, "auto");
    }
  });

  bar.appendChild(input);
  document.body.insertBefore(bar, document.body.firstChild);
  return bar;
}

function openSearchModal(): void {
  const modal = document.createElement("div");
  modal.className = "search-modal-overlay";

  const content = document.createElement("div");
  content.className = "search-modal";

  const header = document.createElement("div");
  header.className = "search-modal-header";
  header.innerHTML = `<h2>${t("search.title") || "Search"}</h2>`;

  const body = document.createElement("div");
  body.className = "search-modal-body";

  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.placeholder = t("search.placeholder") || "Search commits…";
  inputEl.className = "search-input";
  inputEl.focus();
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      modal.remove();
    } else if (e.key === "Enter") {
      const query = inputEl.value;
      if (onSearch) onSearch(query, "auto");
      modal.remove();
    }
  });

  body.appendChild(inputEl);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

export function closeSearchBar(): void {
  const modal = document.querySelector(".search-modal-overlay");
  if (modal) modal.remove();
}
