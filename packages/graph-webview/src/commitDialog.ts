import { t, onLangChange } from "./i18n.js";
import { getDiffMinimap, onDiffMinimapChange } from "./diffMinimap.js";
import { getCommitReviewBeforeCommit } from "./commitReviewSetting.js";
import { buildDiffView, attachMinimaps, buildChangeNav, MM_W } from "./diffView.js";
import type { FileDiff, WorkingTreeFile } from "@rev-graph/protocol";

export interface CommitDialogContext {
  onRequestChanges: () => void;
  onRequestDiff: (file: WorkingTreeFile) => void;
  onCommit: (message: string, files: string[]) => void;
}

const STATUS_MARK: Record<WorkingTreeFile["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
};

const STATUS_ORDER: WorkingTreeFile["status"][] = ["added", "modified", "renamed", "deleted"];

let openOverlay: HTMLElement | null = null;
let langUnsub: (() => void) | null = null;
let minimapUnsub: (() => void) | null = null;
let minimapCleanup: (() => void) | null = null;
let ctx: CommitDialogContext | null = null;
let files: WorkingTreeFile[] | null = null;
let selected: WorkingTreeFile | null = null;
let selectedPaths = new Set<string>();
let diff: FileDiff | null = null;
let messageValue = "";
let reviewStep = false;

let renderAll: (() => void) | null = null;
let renderListNow: (() => void) | null = null;
let renderDiffNow: (() => void) | null = null;

export function closeCommitDialog(): void {
  openOverlay?.remove();
  openOverlay = null;
  langUnsub?.();
  langUnsub = null;
  minimapUnsub?.();
  minimapUnsub = null;
  minimapCleanup?.();
  minimapCleanup = null;
  ctx = null;
  files = null;
  selected = null;
  selectedPaths = new Set();
  diff = null;
  messageValue = "";
  reviewStep = false;
  renderAll = null;
  renderListNow = null;
  renderDiffNow = null;
}

export function openCommitDialog(context: CommitDialogContext): void {
  closeCommitDialog();
  ctx = context;

  const overlay = el("div", "settings-overlay");
  const modal = el("div", "settings-modal commit-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  overlay.appendChild(modal);

  function render(): void {
    modal.innerHTML = "";

    const header = el("div", "settings-modal-header");
    header.appendChild(el("span", "settings-modal-title", t("commit.title")));
    const closeBtn = button("settings-close-x", "x", closeCommitDialog);
    closeBtn.setAttribute("aria-label", t("commit.close"));
    header.appendChild(closeBtn);
    modal.appendChild(header);

    if (reviewStep) renderReview(modal);
    else renderEditor(modal);
  }

  function renderEditor(modalEl: HTMLElement): void {
    const body = el("div", "commit-body");
    const listPane = el("div", "commit-list");

    const listToolbar = el("div", "commit-list-toolbar");
    const selectAll = button("settings-secondary", t("commit.selectAll"), () => {
      selectedPaths = new Set((files ?? []).map((f) => f.path));
      renderListNow?.();
      renderFooter();
    });
    const selectNone = button("settings-secondary", t("commit.selectNone"), () => {
      selectedPaths.clear();
      renderListNow?.();
      renderFooter();
    });
    listToolbar.append(selectAll, selectNone);
    listPane.appendChild(listToolbar);

    const listScroll = el("div", "commit-file-scroll");
    listPane.appendChild(listScroll);

    const diffPane = el("div", "changes-diff commit-diff");
    body.append(listPane, diffPane);
    modalEl.appendChild(body);

    const footer = el("div", "commit-footer");
    const msgWrap = el("label", "commit-message-wrap");
    msgWrap.appendChild(el("span", "commit-message-label", t("commit.message")));
    const msg = document.createElement("textarea");
    msg.className = "commit-message-input";
    msg.placeholder = t("commit.messagePlaceholder");
    msg.value = messageValue;
    msg.addEventListener("input", () => {
      messageValue = msg.value;
      renderFooter();
    });
    msgWrap.appendChild(msg);
    footer.appendChild(msgWrap);
    const footerActions = el("div", "commit-actions");
    footer.appendChild(footerActions);
    modalEl.appendChild(footer);

    function renderList(): void {
      listScroll.innerHTML = "";
      if (files === null) {
        listScroll.appendChild(el("div", "changes-empty", t("commit.loading")));
        return;
      }
      if (files.length === 0) {
        listScroll.appendChild(el("div", "changes-empty", t("commit.noChanges")));
        return;
      }
      for (const file of ordered(files)) {
        listScroll.appendChild(fileRow(file));
      }
    }

    function renderDiff(): void {
      diffPane.innerHTML = "";
      const scroll = el("div", "changes-diff-scroll");
      const empty = (key: Parameters<typeof t>[0]) => {
        scroll.appendChild(el("div", "changes-empty", t(key)));
        diffPane.appendChild(scroll);
      };
      if (!selected) return empty("commit.selectFile");
      if (!diff) return empty("changes.loading");
      if (diff.binary) return empty("changes.binary");
      if (diff.tooLarge) return empty("changes.tooLarge");
      const minimapOn = getDiffMinimap();
      const built = buildDiffView(diff, minimapOn);
      scroll.appendChild(built.view);
      diffPane.appendChild(scroll);
      minimapCleanup?.();
      minimapCleanup = minimapOn ? attachMinimaps(diffPane, scroll, built.minimaps) : null;
      if (built.blocks.length > 1) {
        diffPane.appendChild(buildChangeNav(scroll, built.blocks, minimapOn ? MM_W + 10 : 14));
      }
    }

    function renderFooter(): void {
      footerActions.innerHTML = "";
      const count = selectedPaths.size;
      footerActions.appendChild(el("span", "commit-selection-count", t("commit.selectedCount", { count })));
      const commitBtn = button("settings-done", getCommitReviewBeforeCommit() ? t("commit.review") : t("commit.commit"), () => {
        if (!canCommit()) return;
        if (getCommitReviewBeforeCommit()) {
          reviewStep = true;
          render();
        } else {
          submitCommit();
        }
      });
      commitBtn.disabled = !canCommit();
      footerActions.appendChild(commitBtn);
    }

    function fileRow(file: WorkingTreeFile): HTMLElement {
      const row = el("div", "commit-file");
      if (selected?.path === file.path) row.classList.add("selected");
      row.dataset.status = file.status;
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = selectedPaths.has(file.path);
      check.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFile(file.path, check.checked);
      });
      const mark = el("span", `changes-mark changes-mark-${file.status}`, STATUS_MARK[file.status]);
      const name = el("span", "commit-file-name", file.path);
      name.title = file.oldPath ? t("changes.renamedFrom", { path: file.oldPath }) : file.path;
      if (file.staged) row.appendChild(el("span", "commit-staged-dot", "*"));
      row.append(check, mark, name);
      row.addEventListener("click", () => selectFile(file));
      return row;
    }

    function toggleFile(path: string, checked: boolean): void {
      if (checked) selectedPaths.add(path);
      else selectedPaths.delete(path);
      renderList();
      renderFooter();
    }

    renderListNow = renderList;
    renderDiffNow = renderDiff;
    renderList();
    renderDiff();
    renderFooter();
  }

  function renderReview(modalEl: HTMLElement): void {
    const body = el("div", "commit-review-body");
    body.appendChild(el("div", "commit-review-title", t("commit.reviewTitle")));
    body.appendChild(el("div", "commit-review-summary", t("commit.reviewSummary", {
      count: selectedPaths.size,
      message: firstLine(messageValue),
    })));
    const list = el("div", "commit-review-files");
    for (const file of ordered(files ?? []).filter((f) => selectedPaths.has(f.path))) {
      list.appendChild(el("div", "commit-review-file", `${STATUS_MARK[file.status]}  ${file.path}`));
    }
    body.appendChild(list);
    modalEl.appendChild(body);

    const footer = el("div", "settings-modal-footer");
    footer.appendChild(button("settings-secondary", t("commit.back"), () => {
      reviewStep = false;
      render();
    }));
    footer.appendChild(button("settings-done", t("commit.commit"), submitCommit));
    modalEl.appendChild(footer);
  }

  function selectFile(file: WorkingTreeFile): void {
    selected = file;
    diff = null;
    renderListNow?.();
    renderDiffNow?.();
    ctx?.onRequestDiff(file);
  }

  function canCommit(): boolean {
    return selectedPaths.size > 0 && messageValue.trim().length > 0;
  }

  function submitCommit(): void {
    if (!ctx || !canCommit()) return;
    ctx.onCommit(messageValue.trim(), [...selectedPaths]);
  }

  renderAll = render;
  render();
  langUnsub = onLangChange(render);
  minimapUnsub = onDiffMinimapChange(() => renderDiffNow?.());

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeCommitDialog();
  });
  document.body.appendChild(overlay);
  openOverlay = overlay;
  context.onRequestChanges();
}

export function setWorkingTreeFiles(incoming: WorkingTreeFile[]): void {
  if (!ctx) return;
  files = incoming;
  selectedPaths = new Set(incoming.map((f) => f.path));
  selected = ordered(incoming)[0] ?? null;
  diff = null;
  renderAll?.();
  if (selected) ctx.onRequestDiff(selected);
}

export function setWorkingTreeFileDiff(incoming: FileDiff): void {
  if (!ctx || !selected || selected.path !== incoming.path) return;
  diff = incoming;
  renderDiffNow?.();
}

function ordered(list: WorkingTreeFile[]): WorkingTreeFile[] {
  return [...list].sort((a, b) => {
    const ao = STATUS_ORDER.indexOf(a.status);
    const bo = STATUS_ORDER.indexOf(b.status);
    if (ao !== bo) return ao - bo;
    return a.path.localeCompare(b.path);
  });
}

function firstLine(value: string): string {
  return value.trim().split(/\r?\n/)[0] ?? "";
}

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

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCommitDialog();
});
