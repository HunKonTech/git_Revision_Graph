import { computeLayout } from "@rev-graph/graph-core";
import type { PositionedCommit, GraphLayout, LayoutEdge } from "@rev-graph/graph-core";
import type { GraphData, GitRef, ThemeTokens } from "@rev-graph/protocol";
import type { DisplayMode } from "./displayMode.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** An edge's DOM element plus its endpoint node ids and flags, for highlighting. */
type EdgeRecord = { el: SVGPathElement; fromId: string; toId: string; stash: boolean; merge: boolean };

/** Pixel geometry of the grid. Tuned to resemble the TortoiseSVN graph. */
const LANE_W = 210;
const BOX_W = 170;
/** Height of the fixed text area (sha / summary / author / date). */
const CONTENT_H = 68;
/** Extra height added at the top of the content area when a branch header is shown. */
const BRANCH_HEADER_H = 18;
/** Height of one ref pill listed inside a box. */
const REF_ROW_H = 17;
/** Padding above the first ref pill inside a box. */
const REF_PAD = 6;
/** Vertical gap between a box's bottom and the next box's top. */
const ROW_GAP = 26;
const MARGIN = 28;
/**
 * How far a merge (dashed) edge attaches to the *side* of a box's centre, toward
 * the lane it travels to. A merge commit's first parent drops straight from the
 * box's centre as a solid line; shifting the merge edge (and its arrowheads) off
 * that centre keeps the two from piling onto the same point — otherwise the merge
 * arrow lands right on the solid trunk and the join is unreadable.
 */
const MERGE_END_DX = 16;

/** Distinct hues per ref kind, echoing the SVN graph (grey trunk, green branch, yellow tag). */
type NodeKind = "head" | "localBranch" | "remoteBranch" | "tag" | "commit" | "stash";

export interface RenderCallbacks {
  onNodeContextMenu(commit: PositionedCommit, clientX: number, clientY: number): void;
  onNodeDblClick(commit: PositionedCommit): void;
  onNodeClick(commit: PositionedCommit): void;
  /** Right-click on empty canvas (not on a node) → background context menu. */
  onCanvasContextMenu(clientX: number, clientY: number): void;
}

/** Renders a git DAG as connected boxes inside an SVG, with zoom & pan. */
export class GraphView {
  /** Scrolling wrapper around the SVG — owns the scrollbars in classic mode. */
  private readonly scrollEl: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly viewport: SVGGElement;
  private layout: GraphLayout | null = null;
  /**
   * Display style. "modern" = free pan/zoom canvas; "classic" = fixed-scale,
   * scroll-only canvas with the trunk pinned left (SVN revision graph style).
   */
  private mode: DisplayMode = "modern";
  /** Pixel height of each row = tallest box on it, indexed by row (level). */
  private rowHeights: number[] = [];
  /** Own pixel height of each box, by nodeId (grows with its ref count). */
  private readonly ownHeight = new Map<string, number>();
  /** Top Y of each row, indexed by row (cumulative — rows vary in height). */
  private rowTops: number[] = [];
  /** Sha of the currently checked-out commit (HEAD), if known. */
  private head: string | null = null;
  /** Whether any ref in the current layout is flagged as the current branch. */
  private hasCurrentRef = false;
  /** First-parent-and-beyond adjacency (sha → parent shas present in the graph). */
  private adjacency = new Map<string, string[]>();
  /** Edge DOM elements with their endpoint node ids, for path highlighting. */
  private edgeRecords: EdgeRecord[] = [];
  /** Node DOM elements with their node id, for path highlighting. */
  private nodeRecords: Array<{ el: SVGGElement; id: string }> = [];
  /** Every positioned node by its unique nodeId (real, phantom and stash). */
  private nodeById = new Map<string, PositionedCommit>();
  /** The non-phantom node id carrying each sha (phantoms are label duplicates). */
  private realNodeId = new Map<string, string>();
  /** Node id whose line is currently highlighted, if any. */
  private selectedNodeId: string | null = null;
  /** Commit nodes matching the current toolbar search. */
  private searchMatchIds = new Set<string>();
  /** The currently focused search result. */
  private activeSearchNodeId: string | null = null;
  /**
   * For branch/stash connectors that attach to a commit box's *right side*: this
   * edge's slot among all such connectors on the same box, so several branches or
   * stashes forked from one commit fan out to distinct heights instead of piling
   * onto a single point. Keyed by the edge object.
   */
  private rightAttach = new Map<LayoutEdge, { index: number; count: number }>();
  /**
   * For cross-lane edges (merge connectors and side-branch parent edges) that
   * share a routing gutter: this edge's fan slot and how many slots the gutter
   * uses, so several merges into the same lane run as distinct parallel lines
   * instead of piling onto one shared vertical corridor. Keyed by the edge object.
   */
  private gutterFan = new Map<LayoutEdge, { slot: number; count: number }>();
  /** Bottom Y of each box, keyed by `"row:lane"` — for routing around boxes. */
  private boxBottom = new Map<string, number>();

  // pan/zoom state
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private panning = false;
  private panStartX = 0;
  private panStartY = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly cb: RenderCallbacks,
  ) {
    this.scrollEl = document.createElement("div");
    this.scrollEl.className = "graph-scroll";

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("rev-graph-svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    // Prevent accidental text selection when clicking/dragging in the graph.
    (this.svg.style as CSSStyleDeclaration & { userSelect: string }).userSelect = "none";
    this.viewport = document.createElementNS(SVG_NS, "g");
    this.svg.appendChild(this.viewport);
    this.scrollEl.appendChild(this.svg);
    this.container.appendChild(this.scrollEl);
    this.installPanZoom();

    // Clicking empty canvas clears any highlighted ancestry path.
    this.scrollEl.addEventListener("mousedown", (e) => {
      if (!(e.target as Element).closest(".node")) this.selectPath(null);
    });

    // Right-clicking empty canvas opens the background context menu. Nodes carry
    // their own contextmenu handler, so skip the event when it came from a node.
    this.scrollEl.addEventListener("contextmenu", (e) => {
      if ((e.target as Element).closest(".node")) return;
      e.preventDefault();
      this.cb.onCanvasContextMenu(e.clientX, e.clientY);
    });
  }

  /** Switch between the modern (free pan/zoom) and classic (scroll-only) modes. */
  setMode(mode: DisplayMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyMode();
  }

  /** Apply the current mode to the DOM: sizing, transform and scroll behaviour. */
  private applyMode(): void {
    if (this.mode === "classic") {
      this.scrollEl.classList.add("classic");
      // No zoom/pan transform: 1 SVG unit == 1 CSS pixel, navigation is scroll.
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.viewport.removeAttribute("transform");
      this.sizeSvgToContent();
      this.scrollEl.scrollLeft = 0;
      this.scrollEl.scrollTop = 0;
    } else {
      this.scrollEl.classList.remove("classic");
      // Back to a viewport-filling canvas driven by the pan/zoom transform.
      this.svg.setAttribute("width", "100%");
      this.svg.setAttribute("height", "100%");
      this.applyTransform();
    }
    this.updateScrollbarGutter();
  }

  /**
   * Expose the classic-mode vertical scrollbar's width as `--sb-w` on the
   * container, so overlay UI (the legend) can keep clear of the scrollbar gutter
   * instead of being drawn underneath it. Zero in modern mode (no scrollbars).
   */
  private updateScrollbarGutter(): void {
    const w =
      this.mode === "classic" ? Math.max(0, this.scrollEl.offsetWidth - this.scrollEl.clientWidth) : 0;
    this.container.style.setProperty("--sb-w", `${w}px`);
  }

  /** Size the SVG to the graph's full pixel extent so the wrapper can scroll it. */
  private sizeSvgToContent(): void {
    if (!this.layout) return;
    const w = MARGIN + Math.max(0, this.layout.laneCount - 1) * LANE_W + BOX_W + MARGIN;
    const lastTop = this.rowTops[this.rowTops.length - 1] ?? MARGIN;
    const lastH = this.rowHeights[this.rowHeights.length - 1] ?? CONTENT_H;
    const h = lastTop + lastH + MARGIN;
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(h));
  }

  setTheme(theme: ThemeTokens): void {
    const root = this.container.style;
    root.setProperty("--bg", theme.background);
    root.setProperty("--fg", theme.foreground);
    root.setProperty("--accent", theme.accent);
    root.setProperty("--border", theme.border);
    this.container.dataset.theme = theme.kind;
  }

  setData(data: GraphData, mainBranch?: string): void {
    this.layout = computeLayout(data, { mainBranch });
    this.head = data.head ?? null;
    this.selectedNodeId = null;
    this.searchMatchIds.clear();
    this.activeSearchNodeId = null;
    // Parent adjacency for line highlighting — real commits only (skip stash
    // nodes), keyed by sha so phantom duplicates collapse onto the same entry.
    // realNodeId resolves a sha back to the box that actually draws the commit
    // (phantoms are extra label boxes sharing a sha and must not light up).
    this.adjacency = new Map();
    this.nodeById = new Map();
    this.realNodeId = new Map();
    for (const c of this.layout.commits) {
      this.nodeById.set(c.nodeId, c);
      if (c.stash) continue;
      this.adjacency.set(c.sha, c.parents);
      if (!c.phantom) this.realNodeId.set(c.sha, c.nodeId);
    }
    // Rows are structural levels and several commits may share a row, so a row's
    // height is the tallest box on it (each box is sized to list all its refs).
    this.rowHeights = new Array(this.layout.rowCount).fill(CONTENT_H);
    this.ownHeight.clear();
    this.hasCurrentRef = this.layout.commits.some((c) => c.refs.some((r) => r.isCurrent));
    for (const c of this.layout.commits) {
      const h = boxHeight(c);
      this.ownHeight.set(c.nodeId, h);
      if (h > (this.rowHeights[c.row] ?? 0)) this.rowHeights[c.row] = h;
    }
    this.rowTops = [];
    let y = MARGIN;
    for (let r = 0; r < this.rowHeights.length; r++) {
      this.rowTops[r] = y;
      y += this.rowHeights[r]! + ROW_GAP;
    }
    this.draw();
    // In classic mode the SVG carries its full pixel size so the wrapper scrolls.
    if (this.mode === "classic") {
      this.sizeSvgToContent();
      this.updateScrollbarGutter();
    }
  }

  getPositionedCommit(sha: string): PositionedCommit | undefined {
    return this.layout?.commits.find((c) => c.sha === sha);
  }

  findCommitMessages(query: string): PositionedCommit[] {
    const q = query.trim().toLocaleLowerCase();
    if (!q || !this.layout) return [];
    return this.layout.commits.filter(
      (c) => !c.stash && !c.phantom && c.summary.toLocaleLowerCase().includes(q),
    );
  }

  setSearchMatches(nodeIds: string[], activeNodeId: string | null): void {
    this.searchMatchIds = new Set(nodeIds);
    this.activeSearchNodeId = activeNodeId;
    this.updateSearchClasses();
  }

  jumpToNode(nodeId: string): boolean {
    const node = this.nodeById.get(nodeId);
    if (!node) return false;
    const cx = this.boxX(node.lane) + BOX_W / 2;
    const h = this.ownHeight.get(node.nodeId) ?? CONTENT_H;
    const cy = this.boxY(node.row) + h / 2;
    if (this.mode === "classic") {
      const vw = this.scrollEl.clientWidth;
      const vh = this.scrollEl.clientHeight;
      this.scrollEl.scrollLeft = Math.max(0, cx - vw / 2);
      this.scrollEl.scrollTop = Math.max(0, cy - vh / 2);
    } else {
      const rect = this.svg.getBoundingClientRect();
      this.tx = rect.width / 2 - this.scale * cx;
      this.ty = rect.height / 2 - this.scale * cy;
      this.applyTransform();
    }
    this.selectedNodeId = null;
    this.selectPath(nodeId);
    return true;
  }

  /**
   * Highlight the line of a commit: its first-parent chain down to the root,
   * dimming everything else. Side branches that were merged in along the way
   * (reachable only through a merge's second parent) stay dimmed, so selecting
   * a branch shows the branch itself and the trunk it forked from — not every
   * historical branch that was ever merged below it. Merges that landed *on the
   * selected branch itself* (e.g. main refreshed into it) do light up their
   * merge edge, so incoming merges stay visible. When the selected commit itself
   * was merged into another branch, only that outgoing merge connector lights up;
   * the target branch's history stays dimmed. Pass null (or the already selected
   * node) to clear. Walks first-parent edges once (O(V)) and only toggles a CSS
   * class per element — no DOM rebuild — so it stays cheap on large graphs.
   */
  selectPath(nodeId: string | null): void {
    if (nodeId === null || nodeId === this.selectedNodeId || !this.nodeById.has(nodeId)) {
      this.selectedNodeId = null;
      this.viewport.classList.remove("has-selection");
      for (const r of this.edgeRecords) r.el.classList.remove("edge-path");
      for (const r of this.nodeRecords) r.el.classList.remove("node-path");
      return;
    }

    this.selectedNodeId = nodeId;
    const visited = this.lineOf(nodeId);
    const ownSegment = this.ownSegmentOf(nodeId);
    this.viewport.classList.add("has-selection");

    // A merge edge "lands on" the selected branch when it flows from the branch's
    // own segment down into a *more central* lane — i.e. a trunk (e.g. a refreshed
    // main) that was merged *into* the selected branch. A feature branch absorbed
    // the other way (merged into this branch from a lane further right) does NOT
    // land on it and stays dim: that's old history the selection means to hide.
    const landsOnSelection = (r: EdgeRecord): boolean =>
      r.merge &&
      !r.stash &&
      ownSegment.has(r.fromId) &&
      (this.nodeById.get(r.toId)?.lane ?? 0) < (this.nodeById.get(r.fromId)?.lane ?? 0);

    // Everything highlighted: the selected first-parent line, plus — for every
    // merge that landed on it — the *whole history* of the commit that was merged
    // in (that commit AND its first-parent ancestry, via lineOf). Highlighting
    // only the merge's tip left the merged-in trunk lit at each merge point but
    // dim in between; pulling in its ancestry makes it a continuous lit line.
    const lit = new Set(visited);
    const selectedMergeSources = this.mergeSourceIdsFor(nodeId);
    const mergedTips = new Set<string>();
    for (const r of this.edgeRecords) {
      if (landsOnSelection(r)) mergedTips.add(r.toId);
    }
    for (const tip of mergedTips) {
      for (const id of this.lineOf(tip)) lit.add(id);
    }

    for (const r of this.edgeRecords) {
      // Merge edges light only when they landed on the selected branch (above);
      // or when the selected commit is the source being merged into another
      // branch. That second case lights the connector and its arrows only, not
      // the target branch's first-parent line.
      // solid first-parent edges light whenever both ends are lit — which now
      // covers the merged-in trunk's own internal line, not just the selection's.
      const leavesSelection = r.merge && !r.stash && selectedMergeSources.has(r.toId);
      const on =
        landsOnSelection(r) || leavesSelection || (!r.merge && !r.stash && lit.has(r.fromId) && lit.has(r.toId));
      r.el.classList.toggle("edge-path", on);
    }
    for (const r of this.nodeRecords) {
      r.el.classList.toggle("node-path", lit.has(r.id));
    }
  }

  /**
   * Node ids on the first-parent line of `nodeId` (inclusive): follow parents[0]
   * links down to the root. Second parents of merges are deliberately skipped so
   * previously merged side branches don't light up with the selection, and only
   * the real box of each commit is included — a phantom sibling (another branch
   * label sitting on the same sha) stays dimmed. Selecting the phantom itself
   * includes both it and the commit box it labels.
   */
  private lineOf(nodeId: string): Set<string> {
    const visited = new Set<string>([nodeId]);
    const start = this.nodeById.get(nodeId);
    if (!start || start.stash) return visited;
    const seen = new Set<string>();
    let sha: string | undefined = start.sha;
    while (sha !== undefined && !seen.has(sha)) {
      seen.add(sha);
      const realId = this.realNodeId.get(sha);
      if (realId !== undefined) visited.add(realId);
      sha = this.adjacency.get(sha)?.[0];
    }
    return visited;
  }

  /**
   * The selected branch's *own* segment of the line: the contiguous run of real
   * commits from the selection downward that still sit in the selection's lane.
   * It ends at the fork point, where the line hops to the base branch's lane.
   * A phantom occupies a lane of its own with no commits, so its segment holds
   * no real commits — a merge sitting at or under a brand-new branch's start is
   * the base branch's history, not the new branch's.
   */
  private ownSegmentOf(nodeId: string): Set<string> {
    const segment = new Set<string>();
    const start = this.nodeById.get(nodeId);
    if (!start || start.stash) return segment;
    const seen = new Set<string>();
    let sha: string | undefined = start.sha;
    while (sha !== undefined && !seen.has(sha)) {
      seen.add(sha);
      const realId = this.realNodeId.get(sha);
      const node = realId !== undefined ? this.nodeById.get(realId) : undefined;
      if (!node || node.lane !== start.lane) break;
      segment.add(node.nodeId);
      sha = this.adjacency.get(sha)?.[0];
    }
    return segment;
  }

  /**
   * Node ids that represent the selected commit as a merge source. A phantom can
   * share a sha with a real commit, so include both the clicked label node and
   * the real node for that sha; merge edges point to the real source commit.
   */
  private mergeSourceIdsFor(nodeId: string): Set<string> {
    const ids = new Set<string>([nodeId]);
    const node = this.nodeById.get(nodeId);
    if (!node || node.stash) return ids;
    const realId = this.realNodeId.get(node.sha);
    if (realId !== undefined) ids.add(realId);
    return ids;
  }

  /** Reset the view to the top-left of the graph (the trunk). */
  resetView(): void {
    if (this.mode === "classic") {
      // No zoom in classic mode — just scroll back to the trunk at top-left.
      this.scrollEl.scrollLeft = 0;
      this.scrollEl.scrollTop = 0;
      return;
    }
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.applyTransform();
  }

  /**
   * The node representing the current checkout (HEAD). Prefers the node carrying
   * the current branch ref; when the checkout is detached, falls back to any node
   * whose sha is HEAD. Returns null if HEAD isn't present in the graph.
   */
  private headNode(): PositionedCommit | null {
    if (!this.layout || this.head == null) return null;
    const matches = this.layout.commits.filter((c) => c.sha === this.head && !c.stash);
    if (matches.length === 0) return null;
    return matches.find((c) => c.refs.some((r) => r.isCurrent)) ?? matches[0]!;
  }

  /**
   * Bring the current checkout (HEAD) into view and highlight its ancestry.
   * Centres it in modern mode, scrolls it into the middle in classic mode.
   * Returns false when HEAD isn't in the graph (nothing to jump to).
   */
  jumpToHead(): boolean {
    const node = this.headNode();
    if (!node) return false;
    const cx = this.boxX(node.lane) + BOX_W / 2;
    const h = this.ownHeight.get(node.nodeId) ?? CONTENT_H;
    const cy = this.boxY(node.row) + h / 2;
    if (this.mode === "classic") {
      const vw = this.scrollEl.clientWidth;
      const vh = this.scrollEl.clientHeight;
      this.scrollEl.scrollLeft = Math.max(0, cx - vw / 2);
      this.scrollEl.scrollTop = Math.max(0, cy - vh / 2);
    } else {
      const rect = this.svg.getBoundingClientRect();
      this.tx = rect.width / 2 - this.scale * cx;
      this.ty = rect.height / 2 - this.scale * cy;
      this.applyTransform();
    }
    this.selectedNodeId = null; // force selectPath to apply (it no-ops on re-select)
    this.selectPath(node.nodeId);
    return true;
  }

  private draw(): void {
    while (this.viewport.firstChild) this.viewport.removeChild(this.viewport.firstChild);
    this.viewport.classList.remove("has-selection");
    this.edgeRecords = [];
    this.nodeRecords = [];
    if (!this.layout) return;

    // No viewBox: 1 SVG unit == 1 CSS pixel, so nodes always render at their
    // native size regardless of how many commits there are. Navigation is done
    // via the pan/zoom transform, not by squeezing the whole graph to fit.

    // Branch/stash connectors attach to the right side of the commit they fork
    // from. Group them by that commit so multiple forks off one box get distinct
    // attachment heights (see rightAttachY) rather than overlapping at its centre.
    this.rightAttach.clear();
    const byParent = new Map<string, LayoutEdge[]>();
    for (const e of this.layout.edges) {
      if (!e.isBranch && !e.isStash) continue;
      const list = byParent.get(e.toId);
      if (list) list.push(e);
      else byParent.set(e.toId, [e]);
    }
    for (const list of byParent.values()) {
      // Order by the fork's lane (nearest first) so the fan-out never crosses:
      // the closest branch/stash sits highest, farther ones lower.
      list.sort((a, b) => a.fromRow - b.fromRow || a.fromLane - b.fromLane);
      list.forEach((e, index) => this.rightAttach.set(e, { index, count: list.length }));
    }

    // Fan out cross-lane edges (merge connectors, dangling side-branch parents)
    // that share a routing gutter. Without this, every merge into a given lane
    // draws its vertical run at the same x, so two branches merged into the trunk
    // at different points collapse onto one corridor and read as a single line.
    // We give each such edge its own x offset within the gutter: edges whose
    // vertical spans overlap (or sit within a row of each other) get distinct
    // slots via greedy interval colouring, so merges that would otherwise pile up
    // become distinct parallel lines, while merges far apart reuse the centre.
    this.gutterFan.clear();
    const vSpan = (e: LayoutEdge): [number, number] => {
      const a = this.rowBottom(e.fromRow) + ROW_GAP / 2;
      const b = this.boxY(e.toRow) - ROW_GAP / 2;
      return a <= b ? [a, b] : [b, a];
    };
    const byGutter = new Map<number, LayoutEdge[]>();
    for (const e of this.layout.edges) {
      if (e.isStash || e.isBranch || e.fromLane === e.toLane) continue;
      const gutter = Math.max(e.fromLane, e.toLane);
      const list = byGutter.get(gutter);
      if (list) list.push(e);
      else byGutter.set(gutter, [e]);
    }
    // Two edges in a gutter are treated as colliding when their vertical spans
    // come within one box-row of each other, so near-collinear merges separate.
    const FAN_PAD = CONTENT_H + ROW_GAP;
    for (const list of byGutter.values()) {
      if (list.length < 2) continue;
      const spans = new Map(list.map((e) => [e, vSpan(e)] as const));
      list.sort((a, b) => spans.get(a)![0] - spans.get(b)![0] || spans.get(a)![1] - spans.get(b)![1]);
      const colorEnd: number[] = []; // bottom Y currently reserved by each colour
      const slotOf = new Map<LayoutEdge, number>();
      for (const e of list) {
        const [top, bottom] = spans.get(e)!;
        let slot = colorEnd.findIndex((end) => end + FAN_PAD <= top);
        if (slot === -1) slot = colorEnd.length;
        colorEnd[slot] = bottom;
        slotOf.set(e, slot);
      }
      const count = colorEnd.length;
      if (count < 2) continue; // all edges fit one column — no fan needed
      for (const e of list) this.gutterFan.set(e, { slot: slotOf.get(e)!, count });
    }

    // Bottom Y of every box keyed by "row:lane", so a horizontal branch/stash
    // connector can be dropped just below any box that sits between it and its
    // fork commit (keeping a clean straight line instead of crossing the box).
    this.boxBottom.clear();
    for (const c of this.layout.commits) {
      const bottom = this.boxY(c.row) + (this.ownHeight.get(c.nodeId) ?? CONTENT_H);
      this.boxBottom.set(`${c.row}:${c.lane}`, bottom);
    }

    // Edges first so nodes paint on top.
    const edgeLayer = document.createElementNS(SVG_NS, "g");
    edgeLayer.classList.add("edges");
    for (const e of this.layout.edges) {
      const el = this.edgePath(e);
      edgeLayer.appendChild(el);
      this.edgeRecords.push({
        el,
        fromId: e.fromId,
        toId: e.toId,
        stash: e.isStash === true,
        merge: e.isMerge === true,
      });
      // Merge edges carry arrowheads (start, middle, end of the line) pointing
      // at the commit that received the merge, so the direction of the merge is
      // readable anywhere along the line. Each arrow is its own element sharing
      // the edge's record flags, so selection highlighting and dimming apply to
      // the line and its arrows in lockstep.
      if (e.isMerge && !e.isStash) {
        for (const arrow of this.mergeArrows(e)) {
          edgeLayer.appendChild(arrow);
          this.edgeRecords.push({ el: arrow, fromId: e.fromId, toId: e.toId, stash: false, merge: true });
        }
      }
    }
    this.viewport.appendChild(edgeLayer);

    const nodeLayer = document.createElementNS(SVG_NS, "g");
    nodeLayer.classList.add("nodes");
    for (const c of this.layout.commits) {
      const el = this.nodeBox(c);
      nodeLayer.appendChild(el);
      this.nodeRecords.push({ el, id: c.nodeId });
    }
    this.viewport.appendChild(nodeLayer);
    this.updateSearchClasses();
  }

  private updateSearchClasses(): void {
    for (const r of this.nodeRecords) {
      r.el.classList.toggle("node-search-match", this.searchMatchIds.has(r.id));
      r.el.classList.toggle("node-search-active", r.id === this.activeSearchNodeId);
    }
  }

  /**
   * Horizontal offset applied to *both* ends of a merge edge so it peels away
   * from the box centre (where the solid first-parent line sits) toward the lane
   * it travels to. Non-merge edges get no shift. A same-lane merge (no clear
   * direction) defaults to the right so it still clears the centred trunk.
   */
  private mergeShift(e: LayoutEdge): number {
    if (!e.isMerge) return 0;
    return (Math.sign(e.toLane - e.fromLane) || 1) * MERGE_END_DX;
  }

  private boxX(lane: number): number {
    return MARGIN + lane * LANE_W;
  }
  private boxY(row: number): number {
    return this.rowTops[row] ?? MARGIN;
  }
  /** Bottom Y of a row = its top plus the row's height (tallest box on it). */
  private rowBottom(row: number): number {
    return (this.rowTops[row] ?? MARGIN) + (this.rowHeights[row] ?? CONTENT_H);
  }

  /**
   * Y where a branch/stash connector meets the right side of the box it forks
   * from. A single fork attaches at the box's vertical centre; several forks off
   * the same box spread evenly across `spanH` so their lines never coincide.
   * `spanH` is the fork box's own height for branches, or the smaller of the base
   * and stash heights for stashes (so a horizontal run stays inside both boxes).
   */
  private rightAttachY(e: LayoutEdge, top: number, spanH: number): number {
    const slot = this.rightAttach.get(e);
    const frac = slot ? (slot.index + 1) / (slot.count + 1) : 0.5;
    return top + spanH * frac;
  }

  private edgePath(e: LayoutEdge): SVGPathElement {
    const cx = this.boxX(e.fromLane) + BOX_W / 2;
    // Child bottom uses the child's own box height (rows can hold several boxes).
    const cy = this.boxY(e.fromRow) + (this.ownHeight.get(e.fromId) ?? CONTENT_H);
    const px = this.boxX(e.toLane) + BOX_W / 2;
    const py = this.boxY(e.toRow); // parent top
    const path = document.createElementNS(SVG_NS, "path");
    path.classList.add("edge");
    if (e.isMerge) path.classList.add("edge-merge");

    if (e.isStash || e.isBranch) {
      // New branch (phantom) or stash → fork commit. Both sit on the *same row*
      // as the commit they came from, one or more lanes to the right, so the
      // connector sprouts straight out of the fork commit's *right side* into the
      // target box's *left side* — the clearest possible link, never mistakable
      // for a parent edge. Several forks off one commit fan out to distinct
      // heights (rightAttachY). When a box sits between the two on the same row
      // (e.g. a branch between a commit and its stash), the line drops just below
      // that box so it stays a clean straight run rather than crossing it; if
      // there is no room within both end boxes, it routes through the row gap.
      path.classList.add(e.isStash ? "edge-stash" : "edge-branch");
      const forkRight = this.boxX(e.toLane) + BOX_W;
      const forkH = this.ownHeight.get(e.toId) ?? CONTENT_H;
      const boxLeft = this.boxX(e.fromLane);
      const boxH = this.ownHeight.get(e.fromId) ?? CONTENT_H;
      const top = this.boxY(e.toRow); // fork commit and its branch/stash share this row
      let y = this.rightAttachY(e, top, Math.min(forkH, boxH));

      // Tallest box strictly between the two lanes on this row, if any.
      const lo = Math.min(e.fromLane, e.toLane) + 1;
      const hi = Math.max(e.fromLane, e.toLane) - 1;
      let blockBottom = 0;
      for (let lane = lo; lane <= hi; lane++) {
        const b = this.boxBottom.get(`${e.toRow}:${lane}`);
        if (b !== undefined && b > blockBottom) blockBottom = b;
      }

      const bottomLimit = top + Math.min(forkH, boxH); // lowest both boxes still cover
      if (blockBottom > 0 && blockBottom + 6 <= bottomLimit - 4) {
        // Room below the blocking box within both end boxes → keep it straight.
        y = Math.min(bottomLimit - 4, Math.max(y, blockBottom + 6));
        path.setAttribute("d", roundedPath([[forkRight, y], [boxLeft, y]], 8));
      } else if (blockBottom > 0) {
        // No room for a straight line → dip through the box-free row gap below.
        // Stagger the vertical run and the gap height by fan-out slot so several
        // gap-routed forks off one commit don't draw over each other.
        const idx = this.rightAttach.get(e)?.index ?? 0;
        const gutterX = forkRight + 8 + idx * 7;
        const gapY = this.rowBottom(e.toRow) + ROW_GAP / 2 + idx * 5;
        const targetCx = this.boxX(e.fromLane) + BOX_W / 2;
        const targetBottom = top + boxH;
        const pts: Array<[number, number]> = [
          [forkRight, y],
          [gutterX, y],
          [gutterX, gapY],
          [targetCx, gapY],
          [targetCx, targetBottom],
        ];
        path.setAttribute("d", roundedPath(pts, 8));
      } else {
        // Clear path → straight horizontal line.
        path.setAttribute("d", roundedPath([[forkRight, y], [boxLeft, y]], 8));
      }
      return path;
    }

    if (e.fromLane === e.toLane) {
      // Same column: a straight drop with a gentle S-curve. A column reserves its
      // whole row span, so nothing else sits between the two boxes — it can never
      // pass under another box. A same-lane *merge* is shifted sideways so its
      // dashed line runs parallel to (not on top of) the solid first-parent trunk.
      const s = this.mergeShift(e);
      const scx = cx + s;
      const spx = px + s;
      const midY = (cy + py) / 2;
      path.setAttribute("d", `M ${scx} ${cy} C ${scx} ${midY}, ${spx} ${midY}, ${spx} ${py}`);
      return path;
    }

    // Cross-lane: route orthogonally through the empty corridors so the line
    // never crosses a box (see parentEdgePoints). Corners are rounded for a
    // softer look.
    path.setAttribute("d", roundedPath(this.parentEdgePoints(e), 8));
    return path;
  }

  /**
   * Waypoints of a cross-lane parent edge, child end first. Horizontal runs stay
   * in the row gaps (the box-free bands between rows); the vertical run stays in
   * a gutter (the box-free strip between two box columns).
   */
  private parentEdgePoints(e: LayoutEdge): Array<[number, number]> {
    // Merge edges attach off-centre (toward their travel direction) so they clear
    // the solid first-parent trunk that drops from the same box's centre.
    const s = this.mergeShift(e);
    const cx = this.boxX(e.fromLane) + BOX_W / 2 + s;
    const cy = this.boxY(e.fromRow) + (this.ownHeight.get(e.fromId) ?? CONTENT_H);
    const px = this.boxX(e.toLane) + BOX_W / 2 + s;
    const py = this.boxY(e.toRow); // parent top
    const y1 = this.rowBottom(e.fromRow) + ROW_GAP / 2; // gap just below the child's row
    const y2 = this.boxY(e.toRow) - ROW_GAP / 2; // gap just above the parent's row
    const rightLane = Math.max(e.fromLane, e.toLane);
    // Gutter left of the right column, nudged by this edge's fan slot so several
    // merges sharing the gutter run as distinct parallel lines. The whole fan is
    // centred on the gutter midpoint and kept clear of the boxes on either side.
    const fan = this.gutterFan.get(e);
    let fanOffset = 0;
    if (fan) {
      // Spread the fan across at most ~30px (centred), so it always stays inside
      // the box-free gutter; each extra line costs up to 14px until that budget
      // forces them closer together.
      const step = Math.min(14, 30 / (fan.count - 1));
      fanOffset = (fan.slot - (fan.count - 1) / 2) * step;
    }
    const xCorr = this.boxX(rightLane) - (LANE_W - BOX_W) / 2 + fanOffset; // gutter left of the right column

    return [
      [cx, cy],
      [cx, y1],
      [xCorr, y1],
      [xCorr, y2],
      [px, y2],
      [px, py],
    ];
  }

  /**
   * Solid arrowheads for a merge edge, all pointing along the merge's flow —
   * from the second parent *into* the merge commit: one where the line leaves
   * the source commit, one on the line's longest run (its visual middle), and
   * one where it enters the merge commit. Drawn as plain paths, not SVG
   * markers, which render inconsistently across the embedded browser engines.
   */
  private mergeArrows(e: LayoutEdge): SVGPathElement[] {
    // Same off-centre shift as the merge line itself (see mergeShift), so the end
    // arrowheads sit on the dashed line and clear the solid first-parent trunk.
    const s = this.mergeShift(e);
    const cx = this.boxX(e.fromLane) + BOX_W / 2 + s;
    const cy = this.boxY(e.fromRow) + (this.ownHeight.get(e.fromId) ?? CONTENT_H);
    const px = this.boxX(e.toLane) + BOX_W / 2 + s;
    const py = this.boxY(e.toRow);
    const arrows = [
      this.arrowAt(cx, cy + 5, 0, -1), // entering the merge commit (line end)
      this.arrowAt(px, py - 7, 0, -1), // leaving the source commit (line start)
    ];
    // Mid-line arrow on the route's longest run. Both ends leave their boxes
    // vertically, so the polyline is walked child-first and the flow direction
    // at any segment is simply "toward the child end".
    const pts: Array<[number, number]> =
      e.fromLane === e.toLane ? [[cx, cy], [px, py]] : this.parentEdgePoints(e);
    let best = 0;
    let bi = -1;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (len > best) {
        best = len;
        bi = i;
      }
    }
    // Skip the third arrow on very short runs — the two end arrows already
    // cover the whole line there.
    if (bi > 0 && best > 34) {
      const [x2, y2] = pts[bi]; // parent-side end of the run
      const [x1, y1] = pts[bi - 1]; // child-side end of the run
      arrows.push(this.arrowAt((x1 + x2) / 2, (y1 + y2) / 2, Math.sign(x1 - x2), Math.sign(y1 - y2)));
    }
    return arrows;
  }

  /** One filled triangle centred on (x, y), pointing along the axis-aligned unit direction (dx, dy). */
  private arrowAt(x: number, y: number, dx: number, dy: number): SVGPathElement {
    const tipX = x + dx * 5;
    const tipY = y + dy * 5;
    const bx = x - dx * 4; // base centre
    const by = y - dy * 4;
    const nx = -dy; // perpendicular to the flow
    const ny = dx;
    const arrow = document.createElementNS(SVG_NS, "path");
    arrow.classList.add("edge", "edge-merge", "edge-arrow");
    arrow.setAttribute(
      "d",
      `M ${tipX} ${tipY} L ${bx + nx * 5} ${by + ny * 5} L ${bx - nx * 5} ${by - ny * 5} Z`,
    );
    return arrow;
  }

  private nodeBox(c: PositionedCommit): SVGGElement {
    const x = this.boxX(c.lane);
    const y = this.boxY(c.row);
    const h = boxHeight(c); // this box's own height (a row may hold taller boxes)
    const kind = nodeKind(c);
    // The HEAD marker belongs on the node carrying the current branch; when the
    // checkout is detached (no current ref anywhere) it falls back to the commit
    // whose sha is HEAD. This keeps it off the real commit when a freshly created
    // current branch has been split into its own phantom node.
    const isHead =
      this.head != null &&
      c.sha === this.head &&
      (c.refs.some((r) => r.isCurrent) || !this.hasCurrentRef);

    if (c.phantom) return this.phantomBox(c, x, y, h, kind, isHead);

    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("node", `node-${kind}`);
    if (isHead) g.classList.add("node-current");
    // Fetched-but-not-pulled commits: stay in their lane, flagged by colour.
    if (c.remoteOnly) g.classList.add("node-remote-only");
    g.dataset.sha = c.sha;
    g.setAttribute("transform", `translate(${x} ${y})`);

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("width", String(BOX_W));
    rect.setAttribute("height", String(h));
    rect.setAttribute("rx", "6");
    rect.classList.add("node-rect");
    g.appendChild(rect);

    // Mark the commit the working tree is currently on (HEAD), even when it is
    // detached and no branch chip points at it.
    if (isHead) {
      const bar = document.createElementNS(SVG_NS, "rect");
      bar.setAttribute("x", "-7");
      bar.setAttribute("y", "0");
      bar.setAttribute("width", "4");
      bar.setAttribute("height", String(h));
      bar.setAttribute("rx", "2");
      bar.classList.add("current-head-bar");
      g.appendChild(bar);

      const marker = document.createElementNS(SVG_NS, "text");
      marker.setAttribute("x", "-12");
      marker.setAttribute("y", String(h / 2 + 4));
      marker.setAttribute("text-anchor", "end");
      marker.classList.add("current-head-marker");
      marker.textContent = "▶";
      const mTitle = document.createElementNS(SVG_NS, "title");
      mTitle.textContent = "HEAD — current checkout";
      marker.appendChild(mTitle);
      g.appendChild(marker);
    }

    // branch name header (top of box, only when a branch ref points here)
    const branch = primaryBranch(c);
    const dy = branch ? BRANCH_HEADER_H : 0;
    if (branch) {
      const branchEl = document.createElementNS(SVG_NS, "text");
      branchEl.setAttribute("x", "10");
      branchEl.setAttribute("y", "13");
      branchEl.classList.add("node-branch");
      branchEl.textContent = truncate(branch, 24);
      g.appendChild(branchEl);

      const sep = document.createElementNS(SVG_NS, "line");
      sep.setAttribute("x1", "0");
      sep.setAttribute("y1", String(dy));
      sep.setAttribute("x2", String(BOX_W));
      sep.setAttribute("y2", String(dy));
      sep.classList.add("node-branch-sep");
      g.appendChild(sep);
    }

    // short sha (top-left)
    const sha = document.createElementNS(SVG_NS, "text");
    sha.setAttribute("x", "10");
    sha.setAttribute("y", String(14 + dy));
    sha.classList.add("node-sha");
    sha.textContent = c.sha.slice(0, 7);
    g.appendChild(sha);

    // summary (clipped)
    const summary = document.createElementNS(SVG_NS, "text");
    summary.setAttribute("x", "10");
    summary.setAttribute("y", String(28 + dy));
    summary.classList.add("node-summary");
    summary.textContent = truncate(c.summary, 24);
    g.appendChild(summary);

    // author
    const author = document.createElementNS(SVG_NS, "text");
    author.setAttribute("x", "10");
    author.setAttribute("y", String(44 + dy));
    author.classList.add("node-author");
    author.textContent = truncate(c.author, 22);
    g.appendChild(author);

    // commit date
    const dateEl = document.createElementNS(SVG_NS, "text");
    dateEl.setAttribute("x", "10");
    dateEl.setAttribute("y", String(60 + dy));
    dateEl.classList.add("node-date");
    dateEl.textContent = formatDate(c.date);
    g.appendChild(dateEl);

    // ref labels listed inside the box, one per row, so all stay visible and
    // none hang off the edge.
    c.refs.forEach((ref, i) => g.appendChild(this.refRow(ref, i, CONTENT_H + dy)));

    // tooltip
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${c.sha}\n${c.summary}\n${c.author} <${c.authorEmail}>\n${c.date}`;
    g.appendChild(title);

    this.wireNodeEvents(g, c);
    return g;
  }

  /**
   * Compact box for a phantom node: a branch with no commits of its own, drawn
   * one lane right of (and branching up from) the commit it shares. Shows just
   * the branch header and its ref chip(s) — no sha/summary/author/date, since
   * those belong to the real commit it points at.
   */
  private phantomBox(
    c: PositionedCommit,
    x: number,
    y: number,
    h: number,
    kind: NodeKind,
    isHead: boolean,
  ): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("node", "node-phantom", `node-${kind}`);
    if (isHead) g.classList.add("node-current");
    g.dataset.sha = c.sha;
    g.setAttribute("transform", `translate(${x} ${y})`);

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("width", String(BOX_W));
    rect.setAttribute("height", String(h));
    rect.setAttribute("rx", "6");
    rect.classList.add("node-rect");
    g.appendChild(rect);

    if (c.branch) {
      const branchEl = document.createElementNS(SVG_NS, "text");
      branchEl.setAttribute("x", "10");
      branchEl.setAttribute("y", "13");
      branchEl.classList.add("node-branch");
      branchEl.textContent = truncate(c.branch, 24);
      g.appendChild(branchEl);
    }

    c.refs.forEach((ref, i) => g.appendChild(this.refRow(ref, i, BRANCH_HEADER_H)));

    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${c.branch ?? ""}\n${c.sha}`;
    g.appendChild(title);

    this.wireNodeEvents(g, c);
    return g;
  }

  /** Attach the shared context-menu / click / double-click handlers to a node. */
  private wireNodeEvents(g: SVGGElement, c: PositionedCommit): void {
    g.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      this.cb.onNodeContextMenu(c, ev.clientX, ev.clientY);
    });
    g.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.cb.onNodeClick(c);
    });
    // Stash nodes aren't checkout targets — only real commits respond to dblclick.
    g.addEventListener("dblclick", () => {
      if (!c.stash) this.cb.onNodeDblClick(c);
    });
  }

  private refRow(ref: GitRef, index: number, baseY: number): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("ref-chip", `ref-${ref.type}`);
    const label = ref.type === "head" ? "HEAD" : ref.name;

    // Pills sit inside the box; width is clamped so the pill never overflows the
    // box, and the label is truncated to whatever fits that width.
    const sideMargin = 10;
    const maxW = BOX_W - sideMargin * 2;
    const innerChars = Math.max(3, Math.floor((maxW - 12) / 6.2));
    const text = truncate(label, innerChars);
    const w = Math.min(maxW, 12 + text.length * 6.2);
    const yTop = baseY + REF_PAD + index * REF_ROW_H;
    g.setAttribute("transform", `translate(${sideMargin} ${yTop})`);

    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("width", String(w));
    r.setAttribute("height", "14");
    r.setAttribute("rx", "7");
    r.classList.add("chip-rect");
    if (ref.isCurrent) r.classList.add("chip-current");
    g.appendChild(r);

    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", "6");
    t.setAttribute("y", "11");
    t.classList.add("chip-text");
    t.textContent = text;
    g.appendChild(t);

    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = label;
    g.appendChild(title);
    return g;
  }

  /* ----------------------------- pan & zoom ----------------------------- */

  private installPanZoom(): void {
    this.svg.addEventListener("wheel", (e) => {
      // Classic mode has no zoom; let the wrapper scroll natively.
      if (this.mode === "classic") return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = clamp(this.scale * factor, 0.05, 4);
      // zoom toward cursor
      const rect = this.svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.tx = mx - (mx - this.tx) * (next / this.scale);
      this.ty = my - (my - this.ty) * (next / this.scale);
      this.scale = next;
      this.applyTransform();
    });

    this.svg.addEventListener("mousedown", (e) => {
      if (this.mode === "classic") return; // scroll-only navigation, no drag-pan
      if (e.button !== 0) return;
      if ((e.target as Element).closest(".node")) return; // let nodes handle their own clicks
      this.panning = true;
      this.panStartX = e.clientX - this.tx;
      this.panStartY = e.clientY - this.ty;
      this.svg.classList.add("panning");
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.panning) return;
      this.tx = e.clientX - this.panStartX;
      this.ty = e.clientY - this.panStartY;
      this.applyTransform();
    });
    window.addEventListener("mouseup", () => {
      this.panning = false;
      this.svg.classList.remove("panning");
    });
  }

  private applyTransform(): void {
    this.viewport.setAttribute(
      "transform",
      `translate(${this.tx} ${this.ty}) scale(${this.scale})`,
    );
  }
}

/**
 * Branch name shown at the top of the box. Comes from the layout (the branch
 * owning the commit's column), so it appears on *every* commit in the column,
 * not only at the tip where a ref points.
 */
function primaryBranch(c: PositionedCommit): string | null {
  return c.branch;
}

/** Box height = branch header (if any) + fixed text area + one row per ref. */
function boxHeight(c: PositionedCommit): number {
  const refsH = c.refs.length > 0 ? REF_PAD + c.refs.length * REF_ROW_H : 0;
  // Phantom nodes carry only a header + chips; no commit text area.
  if (c.phantom) return BRANCH_HEADER_H + refsH + REF_PAD;
  const dy = primaryBranch(c) ? BRANCH_HEADER_H : 0;
  return CONTENT_H + dy + refsH;
}

function nodeKind(c: PositionedCommit): NodeKind {
  if (c.stash) return "stash";
  if (c.refs.some((r) => r.type === "head" || r.isCurrent)) return "head";
  if (c.refs.some((r) => r.type === "localBranch")) return "localBranch";
  if (c.refs.some((r) => r.type === "remoteBranch")) return "remoteBranch";
  if (c.refs.some((r) => r.type === "tag")) return "tag";
  return "commit";
}

function formatDate(isoDate: string): string {
  // "2026-06-26T10:30:00+02:00" → "2026-06-26 10:30:00"
  return isoDate ? isoDate.slice(0, 19).replace("T", " ") : "";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Build an SVG path through `pts` (an orthogonal polyline) with corners rounded
 * by up to radius `r`. Consecutive duplicate points are dropped so collapsed
 * corners (zero-length segments, e.g. when two routing rows coincide) don't
 * emit stray arcs.
 */
function roundedPath(pts: Array<[number, number]>, r: number): string {
  const p: Array<[number, number]> = [];
  for (const q of pts) {
    const last = p[p.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) p.push(q);
  }
  if (p.length < 2) return "";
  let d = `M ${p[0]![0]} ${p[0]![1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [x0, y0] = p[i - 1]!;
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[i + 1]!;
    const inLen = Math.hypot(x1 - x0, y1 - y0) || 1;
    const outLen = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ri = Math.min(r, inLen / 2, outLen / 2);
    const ax = x1 - ((x1 - x0) / inLen) * ri;
    const ay = y1 - ((y1 - y0) / inLen) * ri;
    const bx = x1 + ((x2 - x1) / outLen) * ri;
    const by = y1 + ((y2 - y1) / outLen) * ri;
    d += ` L ${ax} ${ay} Q ${x1} ${y1}, ${bx} ${by}`;
  }
  const end = p[p.length - 1]!;
  d += ` L ${end[0]} ${end[1]}`;
  return d;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
