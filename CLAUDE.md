# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Always commit

After finishing a change, always `git commit` every file you modified — do not leave edits sitting uncommitted. Exception: skip committing a file that was already modified by someone/something else (another agent, or the user) before you touched it, since that's in-progress work that isn't yours to commit.

## Quad-host parity (MUST READ)

**Every feature must ship for ALL FOUR hosts: the VS Code extension, the Visual Studio 2022/2026 VSIX, the JetBrains-family plugin, and the browser demo.** Never finish a feature in only some hosts — a feature that exists in only some hosts is incomplete.

The JetBrains host is **one shared Kotlin codebase that ships as two build flavors** — a Huawei DevEco Studio ZIP and a mainstream IntelliJ IDEA / JetBrains-IDE ZIP — so it counts as a single host for parity purposes (update it once, both flavors get the change).

The renderer/protocol live in shared `packages/` (graph-core, graph-webview, protocol) and are consumed by all hosts automatically. But each host has its own data/message layer that must be updated in parallel:

- **VS Code** (`vscode/`, TypeScript): `vscode/src/gitData.ts` (git ops), `vscode/src/panel.ts` (message handling).
- **Visual Studio** (`vs/`, C#): `vs/Git/GitService.cs` (git ops), `vs/WebViewHostControl.xaml.cs` (message handling), `vs/Model/Dtos.cs` (hand-mirrored protocol types).
- **JetBrains** (`jetbrains/`, Kotlin — IntelliJ Platform plugin). All the code is shared in `jetbrains/common/`: `jetbrains/common/src/main/kotlin/.../git/GitService.kt` (git ops), `jetbrains/common/.../WebViewHostPanel.kt` (message handling, JCEF host), `jetbrains/common/.../model/Dtos.kt` (hand-mirrored protocol types). Two thin flavor subprojects — `jetbrains/deveco/` (DevEco Studio) and `jetbrains/intellij/` (IntelliJ IDEA / other JetBrains IDEs) — compile that shared code against their own platform version and add only their own `META-INF/plugin.xml` branding.
- **Browser demo** (`packages/graph-webview/harness/demo-host.js`): simulates git ops in-browser with mock data; the `handlers` object must mirror every `WebviewToHost` message type handled by the real hosts.
- Any protocol change in `packages/protocol/src/index.ts` **must be mirrored by hand** into `vs/Model/Dtos.cs` AND `jetbrains/common/.../model/Dtos.kt` AND handled in `demo-host.js`.
- The shared webview bundle is copied into each IDE host by the build (`vscode/media/`, `vs/webview/`, `jetbrains/common/src/main/resources/webview/` — one location shared by both JetBrains flavors).

The VS C# VSIX is a legacy .NET Framework 4.7.2 + VS SDK project and can only be **compiled on Windows** (see [vs/BUILD.md](vs/BUILD.md)). On non-Windows machines, review the C# carefully but it cannot be built/run there.

The JetBrains plugins need a JDK 17 + Gradle + IntelliJ Platform Gradle plugin toolchain (see [jetbrains/BUILD.md](jetbrains/BUILD.md)); one `buildPlugin` in `jetbrains/` produces both flavor ZIPs. Both flavors are additionally wired for JetBrains Marketplace publishing (opt-in, needs `PUBLISH_TOKEN`) — DevEco Studio has no separate Huawei plugin store; it's an IntelliJ Platform IDE, so its own Marketplace tab is the same JetBrains Marketplace, just under a distinct plugin id (`pluginGroup` vs `pluginGroupDeveco` in `jetbrains/gradle.properties`). Their git-plumbing-based reword/undo of non-HEAD commits intentionally diverges from the VS host's PowerShell-scripted `rebase -i` (these plugins are cross-platform); see the doc comments on `GitService.kt`'s `rewordCommit`/`undoCommit`.

## Commands

```bash
npm install          # install all workspace dependencies
npm test             # run all unit tests (vitest, graph-core only)
npm run build        # build everything: protocol → graph-core → webview → vscode extension → VS assets → JetBrains assets
npm run harness      # browser dev harness with mock data at http://localhost:5599
```

Run a single test file:
```bash
npx vitest run packages/graph-core/src/layout.test.ts
```

Build individual packages in dependency order:
```bash
npm run build:core      # compiles packages/protocol + packages/graph-core (tsc -b)
npm run build:webview   # bundles packages/graph-webview (esbuild via build.mjs)
npm run build:vscode    # compiles vscode/ extension (esbuild)
npm run build:vs-assets # copies webview bundle into vs/ (node scripts/copy-vs-assets.mjs)
npm run build:jetbrains-assets # copies webview bundle into jetbrains/common/ (node scripts/copy-jetbrains-assets.mjs)
```

Package for distribution:
```bash
npm run package:vscode                    # → dist/installers/*.vsix (cross-platform)
pwsh scripts/build-installers.ps1         # all installers: VS Code, VS 2022/2026, both JetBrains ZIPs (Windows only)
```

**VS Code extension dev loop:** `npm run build` then press **F5** in VS Code (Extension Development Host). No watch mode is wired to F5 — rebuild manually after changes.

## Architecture

This is a monorepo with one shared web renderer embedded by three thin IDE hosts:

```
packages/protocol/     — shared TypeScript types: GitCommit, GitRef, GraphData, WebviewToHost, HostToWebview
packages/graph-core/   — pure DAG layout algorithm (no DOM, fully unit-tested)
packages/graph-webview/ — SVG renderer + context menus + i18n (builds to one JS bundle)
vscode/src/            — VS Code extension: git data layer, webview panel, git CLI wrappers
vs/                    — Visual Studio C# extension (WebView2 host, mirrors the TS protocol by hand)
jetbrains/             — JetBrains-family plugin (Kotlin, IntelliJ Platform, JCEF host, mirrors the TS protocol by hand).
                         Multi-project: shared code in jetbrains/common/, two flavor subprojects
                         jetbrains/deveco/ (DevEco Studio) and jetbrains/intellij/ (IntelliJ IDEA / JetBrains IDEs)
```

### Data flow

1. **Host reads git** (`vscode/src/gitData.ts: readGraphData`) — calls `git log` and `git for-each-ref`, parses output into `GraphData` (`commits[]` + `refs[]` + `head`).
2. **Host → webview** via `panel.ts: GraphPanel.post({ type: "setData", data })`.
3. **Webview layout** (`packages/graph-core/src/layout.ts: computeLayout`) — assigns each commit a `(row, lane)` using a TortoiseSVN-style branch-column algorithm. Input commits must be newest-first (`git log --date-order`). Output: `PositionedCommit[]` + `LayoutEdge[]`.
4. **Webview render** (`packages/graph-webview/src/render.ts: GraphView`) — draws the layout as SVG boxes and edges. Supports two display modes ("modern" free canvas, "classic" scroll-only with trunk pinned left), stored in `localStorage`.
5. **User actions** (context menu, double-click) → `WebviewToHost` message → `panel.ts: onMessage` → git CLI calls in `gitData.ts`.

### Protocol (single source of truth)

`packages/protocol/src/index.ts` defines all message shapes. The C# Visual Studio host mirrors these by hand — **any change here must be reflected in `vs/` too**.

Key message types:
- `HostToWebview`: `setData` | `setTheme` | `branchCreated` | `error`
- `WebviewToHost`: `ready` | `requestRefresh` | `createBranch` | `deleteBranch` | `renameCommit` | `checkout` | `copySha` | `fetch` | `pull` | `push` | `sync`

### Webview internals

`packages/graph-webview/src/`:
- `main.ts` — entry point; wires `GraphView` callbacks to bridge messages; owns the toolbar and settings panel
- `render.ts: GraphView` — SVG rendering class; `setData(layout, head)` redraws everything
- `i18n.ts` — two-language (EN/HU) dict with `t(key, params?)` helper; `localStorage`-persisted; subscribe via `onLangChange(cb)`
- `contextMenu.ts` — lightweight DOM context menu (`showContextMenu`, `MenuItem[]`)
- `host-bridge.ts` — abstracts `vscode.postMessage` / `window.__REV_GRAPH_HARNESS__` (for the browser harness)
- `settings.ts`, `displayMode.ts`, `mainBranch.ts` — each owns one `localStorage`-backed setting + change-listeners

### VS Code extension internals

`vscode/src/`:
- `extension.ts` — registers `revGraph.show` and `revGraph.refresh` commands
- `panel.ts: GraphPanel` — singleton webview panel; handles all `WebviewToHost` messages; calls git functions; auto-refreshes on repo state changes
- `gitData.ts` — all git operations via `execFile` (never shell); uses `\x1f`/`\x1e` field/record separators to parse `git log` output safely
- `branch.ts: createBranchFromCommit` — branch creation; tries `vscode.git` API first, falls back to CLI
- `repo.ts` — resolves the active `Repository` from the `vscode.git` extension API

### Layout algorithm key invariants

- Input must be **newest-first** (children before parents).
- `lane 0` = main branch (configurable, defaults to `main`/`master`/HEAD).
- Branches share a lane when their row intervals don't overlap (interval scheduling).
- **Phantom nodes**: a branch tip that points at the same commit as another branch gets a synthetic node (same `sha`, unique `nodeId`) so each branch always has its own box.
- `remoteOnly`: a commit reachable only from remote-tracking refs is flagged; the renderer colors it distinctly without moving it off its branch's lane.

### Adding a new user-facing action

1. Add a new variant to `WebviewToHost` in `packages/protocol/src/index.ts`.
2. Add i18n keys to both `en` and `hu` dicts in `packages/graph-webview/src/i18n.ts`.
3. Add the menu item in `packages/graph-webview/src/main.ts` (`onNodeContextMenu`).
4. Handle the message in `vscode/src/panel.ts: onMessage`.
5. Implement the git operation in `vscode/src/gitData.ts`.
6. Mirror the protocol change in `vs/` (C# side): `vs/WebViewHostControl.xaml.cs` + `vs/Git/GitService.cs` + `vs/Model/Dtos.cs`.
7. Mirror the protocol change in `jetbrains/` (Kotlin side, shared by both flavors): `jetbrains/common/.../WebViewHostPanel.kt` + `jetbrains/common/.../git/GitService.kt` + `jetbrains/common/.../model/Dtos.kt`.
8. Add a simulated handler in `packages/graph-webview/harness/demo-host.js` (`handlers` object) — the demo runs entirely in the browser with no real git, so every action needs its own mock implementation.

### Git operations pattern

All git calls go through the private `git(cwd, args[])` helper in `gitData.ts`, which wraps `execFile` (no shell injection risk). Errors propagate as thrown `Error` objects; callers wrap them in `try/catch` and post `{ type: "error", message }` back to the webview.

The git binary path is set by `setGitPath()` from the VS Code built-in Git extension (so users never need a separate git install).
