# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Always commit

After finishing a change, always `git commit` every file you modified — do not leave edits sitting uncommitted. Exception: skip committing a file that was already modified by someone/something else (another agent, or the user) before you touched it, since that's in-progress work that isn't yours to commit.

## Multi-host parity (MUST READ)

**Every feature must ship for EVERY host: the VS Code extension, the Visual Studio 2022/2026 VSIX, the JetBrains-family plugin, the Eclipse plugin, the Apache NetBeans plugin, and the browser demo.** Never finish a feature in only some hosts — a feature that exists in only some hosts is incomplete. **For every change, one of the first things to check is whether it affects the Eclipse host (`eclipse/`) and the NetBeans host (`netbeans/`) — if so, update them in the same change**, exactly as you would for VS Code, Visual Studio, and JetBrains.

The JetBrains host is **one shared Kotlin codebase that ships as a single build** — one plugin, one Marketplace listing, installable across the whole IntelliJ Platform family (IntelliJ IDEA, Android Studio, Huawei DevEco Studio, WebStorm, PyCharm, GoLand, etc.) via an unbounded build-number range, since Marketplace/IDE compatibility is matched by build number rather than product name.

**Keep this file in sync:** whenever a change touches the code or structure this file describes (a new host or build flavor, a moved/renamed data-layer file, a new build/publish step, a changed command), update the relevant part of CLAUDE.md in the same change — don't leave it describing the old layout.

The renderer/protocol live in shared `packages/` (graph-core, graph-webview, protocol) and are consumed by all hosts automatically. But each host has its own data/message layer that must be updated in parallel:

- **VS Code** (`vscode/`, TypeScript): `vscode/src/gitData.ts` (git ops), `vscode/src/panel.ts` (message handling).
- **Visual Studio** (`vs/`, C#): `vs/Git/GitService.cs` (git ops), `vs/WebViewHostControl.xaml.cs` (message handling), `vs/Model/Dtos.cs` (hand-mirrored protocol types).
- **JetBrains** (`jetbrains/`, Kotlin — IntelliJ Platform plugin). All the code is shared in `jetbrains/common/`: `jetbrains/common/src/main/kotlin/.../git/GitService.kt` (git ops), `jetbrains/common/.../WebViewHostPanel.kt` (message handling, JCEF host), `jetbrains/common/.../model/Dtos.kt` (hand-mirrored protocol types). One thin subproject, `jetbrains/intellij/`, compiles that shared code against a broad IntelliJ Platform baseline and adds only its own `META-INF/plugin.xml`.
- **Eclipse** (`eclipse/`, Java — PDE/OSGi plugin, hosted by the SWT `Browser` widget). Data/message layer under `eclipse/com.hunkontech.revgraph/src/com/hunkontech/revgraph/`: `git/GitService.java` (git ops, git CLI via `ProcessBuilder`), `WebViewHost.java` (message handling; JS→host is an SWT `BrowserFunction` reusing the same `window.__ideHostPostMessage__` hook the JetBrains/JCEF host uses), `model/Dtos.java` (hand-mirrored protocol types), plus `util/Json.java` (a tiny dependency-free JSON codec so the bundle needs no Gson). The plugin is built with Eclipse Tycho into a p2 update site (feature + repository subprojects).
- **NetBeans** (`netbeans/`, Kotlin — NetBeans module / nbm-maven-plugin, hosted by a JavaFX `WebView` embedded in a Swing `JFXPanel`). This host **maximizes shared code**: it does NOT re-implement the git/DTO layer — its `netbeans/pom.xml` compiles the JetBrains host's **shared, IDE-agnostic Kotlin directly** (`jetbrains/common/.../git/GitService.kt` + `.../model/Dtos.kt`, both 0-IntelliJ-import), so there is nothing to hand-mirror there. Only the NetBeans platform glue is its own, under `netbeans/src/main/kotlin/com/hunkontech/revgraph/`: `NetBeansWebViewHost.kt` (message handling; JS→host is a JavaFX `JSObject` bridge reusing the same `window.__ideHostPostMessage__` hook the JetBrains/JCEF and Eclipse/SWT hosts use — see `webview/bridge.js`), `RevisionGraphTopComponent.kt` (the editor-area window), `OpenRevisionGraphAction.kt` (Tools-menu action), `NetBeansRepoResolver.kt`, `RepoWatcher.kt`.
- **Browser demo** (`packages/graph-webview/harness/demo-host.js`): simulates git ops in-browser with mock data; the `handlers` object must mirror every `WebviewToHost` message type handled by the real hosts.
- Any protocol change in `packages/protocol/src/index.ts` **must be mirrored by hand** into `vs/Model/Dtos.cs` AND `jetbrains/common/.../model/Dtos.kt` AND `eclipse/com.hunkontech.revgraph/src/com/hunkontech/revgraph/model/Dtos.java` AND handled in `demo-host.js`. The NetBeans host needs **no separate mirror** — it compiles `jetbrains/common/.../model/Dtos.kt`, so the JetBrains edit already covers it (just extend `NetBeansWebViewHost.kt`'s dispatcher if a new message type needs handling).
- The shared webview bundle is copied into each IDE host by the build (`vscode/media/`, `vs/webview/`, `jetbrains/common/src/main/resources/webview/`, `eclipse/com.hunkontech.revgraph/webview/`, `netbeans/src/main/resources/com/hunkontech/revgraph/webview/`).

The VS C# VSIX is a legacy .NET Framework 4.7.2 + VS SDK project and can only be **compiled on Windows** (see [vs/BUILD.md](vs/BUILD.md)). On non-Windows machines, review the C# carefully but it cannot be built/run there.

The JetBrains plugin needs a JDK 17 + Gradle + IntelliJ Platform Gradle plugin toolchain (see [jetbrains/BUILD.md](jetbrains/BUILD.md)); one `buildPlugin` in `jetbrains/` produces the plugin ZIP. It's additionally wired for JetBrains Marketplace publishing (opt-in, needs `PUBLISH_TOKEN`) as a single listing (`pluginGroup` in `jetbrains/gradle.properties`) — neither DevEco Studio nor Android Studio has a separate plugin store; both are IntelliJ Platform IDEs, so their Marketplace tabs are the same JetBrains Marketplace, and the one listing's build-number range already covers them. Its git-plumbing-based reword/undo of non-HEAD commits intentionally diverges from the VS host's PowerShell-scripted `rebase -i` (the plugin is cross-platform); see the doc comments on `GitService.kt`'s `rewordCommit`/`undoCommit`.

The Eclipse plugin needs a JDK 17 + Maven + Eclipse Tycho toolchain with network access to the Eclipse p2 repositories (see [eclipse/BUILD.md](eclipse/BUILD.md)); one `mvn -f eclipse/pom.xml package` produces the OSGi plugin, an installable feature, and a p2 update site (+ zip). Its Java data layer is a faithful hand-port of the JetBrains Kotlin one (same git-plumbing reword/undo, hence the same clean-working-tree requirement). Unlike the other marketplaces, the **Eclipse Marketplace hosts no artifact** — a listing just references a p2 update-site URL, so "publishing" means deploying that update site (CI attaches the zipped site to the GitHub Release and pushes the live site to GitHub Pages). Like the VS VSIX and JetBrains plugins, the Eclipse plugin is authored cross-platform but is **not built in this sandbox** (Tycho needs the network target platform).

The NetBeans plugin needs a JDK 17 + Maven + `nbm-maven-plugin` toolchain plus the bundled JavaFX WebView runtime (see [netbeans/BUILD.md](netbeans/BUILD.md)); one `mvn -f netbeans/pom.xml package` produces the sideloadable `.nbm`. It is a **Kotlin** module that reuses the JetBrains host's shared `GitService.kt` + `Dtos.kt` verbatim (the `kotlin-maven-plugin` adds `jetbrains/common/.../git` and `.../model` as extra source roots — the sibling IntelliJ-coupled files are deliberately kept off the source path), and registers its Tools-menu action via the NetBeans annotation processors run through Kotlin **kapt**. Unlike the JetBrains Marketplace, the **Apache NetBeans Plugin Portal has no token-based push API** — it only lists plugins hosted on Maven Central and requires a one-time manual "Add Plugin" registration cleared by two verifiers, so there is **no token to publish with**. End-user **auto-update** is instead delivered the NetBeans-native way (mirroring the Eclipse p2 update site): the `nbm-maven-plugin` `autoupdate` goal — bound to the `package` phase in `netbeans/pom.xml`, `distBase` left unset so nbm URLs stay **relative/location-independent** — emits an `updates.xml` Autoupdate Center into `netbeans/target/netbeans_site/`, which the `build-netbeans-plugin` CI job deploys to **GitHub Pages under `/netbeans-update-center`** (via `peaceiris/actions-gh-pages`, `keep_files: true`, using only the existing `GITHUB_TOKEN` — **no new secret**). CI "publishing" therefore means (a) attaching the `.nbm` to the GitHub Release and (b) deploying that Update Center. Getting onto the optional **Plugin Portal** listing is a two-parter: the `build-netbeans-plugin` job also runs an **opt-in `-Pcentral-deploy` Maven Central deploy** (the `central-deploy` profile in `netbeans/pom.xml` adds sources/javadoc + GPG signing + Sonatype's `central-publishing-maven-plugin`), gated on the `MAVENCENTRAL_USERNAME` secret (skipped otherwise; also needs `MAVENCENTRAL_PASSWORD` + `MAVEN_GPG_PRIVATE_KEY` + `MAVEN_GPG_PASSPHRASE`, plus the GitHub-verified Sonatype namespace `io.github.benkoncsik` — so the Maven `groupId` is `io.github.benkoncsik`, module code-name base `io.github.benkoncsik.netbeans`, even though the source packages/JetBrains pluginGroup/Eclipse bundle ids stay `com.hunkontech.revgraph`) — then the actual Portal "Add Plugin" (`io.github.benkoncsik` / `netbeans`) + two-verifier approval stays a documented one-time manual step (watch two caveats: the module must be certificate-signed, and BSL-1.1 is non-OSI so verifiers may reject it). See [netbeans/BUILD.md](netbeans/BUILD.md). **Known limitation:** NetBeans ships no JavaFX, so the WebView runtime is bundled and the CI `.nbm` is built for the runner's platform — full multi-platform native bundling is a documented follow-up. Like the other JVM hosts, the NetBeans plugin is authored cross-platform but is **not built in this sandbox** (needs Maven + JDK 17 + JavaFX).

## Commands

```bash
npm install          # install all workspace dependencies
npm test             # run all unit tests (vitest, graph-core only)
npm run build        # build everything: protocol → graph-core → webview → vscode extension → VS assets → JetBrains assets → Eclipse assets → NetBeans assets
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
npm run build:eclipse-assets # copies webview bundle into eclipse/ (node scripts/copy-eclipse-assets.mjs)
npm run build:netbeans-assets # copies webview bundle into netbeans/ (node scripts/copy-netbeans-assets.mjs)
```

Package for distribution:
```bash
npm run package:vscode                    # → dist/installers/*.vsix (cross-platform)
npm run package:eclipse                   # → eclipse p2 update site + zip (mvn/Tycho; needs JDK 17 + network)
npm run package:netbeans                  # → netbeans/target/*.nbm (mvn + nbm-maven-plugin; needs JDK 17 + JavaFX)
pwsh scripts/build-installers.ps1         # all installers: VS Code, VS 2022/2026, all three JetBrains ZIPs, NetBeans .nbm (Windows only)
```

**VS Code extension dev loop:** `npm run build` then press **F5** in VS Code (Extension Development Host). No watch mode is wired to F5 — rebuild manually after changes.

## Architecture

This is a monorepo with one shared web renderer embedded by several thin IDE hosts:

```
packages/protocol/     — shared TypeScript types: GitCommit, GitRef, GraphData, WebviewToHost, HostToWebview
packages/graph-core/   — pure DAG layout algorithm (no DOM, fully unit-tested)
packages/graph-webview/ — SVG renderer + context menus + i18n (builds to one JS bundle)
vscode/src/            — VS Code extension: git data layer, webview panel, git CLI wrappers
vs/                    — Visual Studio C# extension (WebView2 host, mirrors the TS protocol by hand)
jetbrains/             — JetBrains-family plugin (Kotlin, IntelliJ Platform, JCEF host, mirrors the TS protocol by hand).
                         Multi-project: shared code in jetbrains/common/, one plugin subproject
                         jetbrains/intellij/ (installable across IntelliJ IDEA, Android Studio, DevEco Studio, etc.)
eclipse/               — Eclipse plugin (Java, PDE/OSGi, SWT Browser host, mirrors the TS protocol by hand).
                         Tycho reactor: com.hunkontech.revgraph (plugin), .feature, .repository (p2 update site)
netbeans/              — Apache NetBeans plugin (Kotlin, NetBeans module, JavaFX WebView host).
                         REUSES the JetBrains host's shared git/DTO Kotlin (jetbrains/common/.../git + model);
                         only the platform glue is its own. Built with Maven + nbm-maven-plugin → .nbm
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
7. Mirror the protocol change in `jetbrains/` (Kotlin side): `jetbrains/common/.../WebViewHostPanel.kt` + `jetbrains/common/.../git/GitService.kt` + `jetbrains/common/.../model/Dtos.kt`.
8. Mirror the protocol change in `eclipse/` (Java side): `eclipse/com.hunkontech.revgraph/src/com/hunkontech/revgraph/WebViewHost.java` + `.../git/GitService.java` + `.../model/Dtos.java` (new `WebviewMessage` fields go in `Dtos.java`'s `fromJson`).
9. For `netbeans/` (Kotlin side): the git op and DTO change are **already covered** — steps 5 & 7 edit the shared `jetbrains/common/.../git/GitService.kt` + `.../model/Dtos.kt` that the NetBeans module compiles. Only extend `netbeans/src/main/kotlin/.../NetBeansWebViewHost.kt`'s `dispatch()` to handle the new message type.
10. Add a simulated handler in `packages/graph-webview/harness/demo-host.js` (`handlers` object) — the demo runs entirely in the browser with no real git, so every action needs its own mock implementation.

### Git operations pattern

All git calls go through the private `git(cwd, args[])` helper in `gitData.ts`, which wraps `execFile` (no shell injection risk). Errors propagate as thrown `Error` objects; callers wrap them in `try/catch` and post `{ type: "error", message }` back to the webview.

The git binary path is set by `setGitPath()` from the VS Code built-in Git extension (so users never need a separate git install).
