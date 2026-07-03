# Building the Eclipse plugin

> This project is authored cross-platform but has **not** been compiled or run
> in the environment it was written in: Eclipse Tycho needs network access to
> resolve the Eclipse Platform target (`https://download.eclipse.org/...`),
> which isn't available in that sandbox. Review the Java carefully; build and
> manually test it on a machine with a JDK 17 + Maven + network — the same
> caveat `vs/BUILD.md` (Windows-only VSIX) and `jetbrains/BUILD.md` (JDK +
> IntelliJ Platform) already carry.

## What this is

The Eclipse host is the **fifth** host of the project, alongside the VS Code
extension, the Visual Studio VSIX, the JetBrains-family plugin, and the browser
demo. Like every host, it embeds the **same shared web renderer**
(`packages/graph-webview`) and speaks the **same protocol**
(`packages/protocol`). Only the thin data/message layer is host-specific, and
here it is a hand-port to Java that mirrors `jetbrains/.../GitService.kt` /
`Dtos.kt` / `WebViewHostPanel.kt` almost line-for-line:

| Concern | File |
|---------|------|
| Git operations (git CLI via `ProcessBuilder`) | `src/.../git/GitService.java` |
| Protocol DTOs (hand-mirrored from `packages/protocol`) | `src/.../model/Dtos.java` |
| Message host (SWT `Browser` + `BrowserFunction` bridge) | `src/.../WebViewHost.java` |
| Dependency-free JSON codec (so the bundle needs no Gson) | `src/.../util/Json.java` |
| The Eclipse view | `src/.../RevisionGraphView.java` |
| Open command handler | `src/.../OpenRevisionGraphHandler.java` |

The SWT `Browser` widget hosts the bundle exactly the way the JetBrains JCEF
host does: the JS→host channel reuses the very same
`window.__ideHostPostMessage__` hook (here it's an SWT `BrowserFunction`), and
the host→webview channel pushes events with `window.postMessage`. So
`packages/graph-webview/src/host-bridge.ts` needs **no** Eclipse-specific
branch — the existing JCEF branch already covers it.

## Layout

```
eclipse/
  pom.xml                              # Tycho parent (target platform, modules)
  com.hunkontech.revgraph/             # the OSGi plugin
    META-INF/MANIFEST.MF               # OSGi bundle manifest (deps, version)
    plugin.xml                         # view + command + menu/toolbar contributions
    build.properties                   # PDE: what goes into the jar (incl. webview/)
    pom.xml                            # packaging: eclipse-plugin
    src/com/hunkontech/revgraph/...    # the Java host (see table above)
    webview/index.html                 # static; main.js/main.css/schematics staged by build
    icons/
  com.hunkontech.revgraph.feature/     # installable feature (wraps the plugin)
    feature.xml, build.properties, pom.xml
  com.hunkontech.revgraph.repository/   # p2 update site (eclipse-repository)
    category.xml, pom.xml
```

## Prerequisites
- JDK 17.
- Maven 3.9+.
- Node.js 18+ (to build the shared web renderer).
- Git on `PATH`.
- Network access to the Eclipse p2 repositories (target platform resolution).
- An Eclipse IDE (2024-06 or later recommended, for its modern SWT Browser
  engine) to install and try the built plugin.

## Steps

1. Build the shared web renderer and stage it into the plugin's `webview/`
   folder (`index.html` is already checked in; this adds `main.js`, `main.css`,
   `schematics/`):
   ```
   npm install
   npm run build:core
   npm run build:webview
   npm run build:eclipse-assets
   ```

2. Build the plugin, feature and update site with Tycho:
   ```
   mvn -f eclipse/pom.xml clean package
   ```
   Outputs:
   - `eclipse/com.hunkontech.revgraph/target/com.hunkontech.revgraph-*.jar` — the plugin.
   - `eclipse/com.hunkontech.revgraph.repository/target/repository/` — a p2
     update site directory.
   - `eclipse/com.hunkontech.revgraph.repository/target/*.zip` — the same site
     zipped, for attaching to a GitHub Release.

3. Install into Eclipse: **Help → Install New Software… → Add… → Local…**,
   point it at the `target/repository/` directory (or the zip via *Archive…*),
   select **Git Tools → Revision Graph for Git**, finish, restart.

## Trying it
- Open a project that is inside a Git repository.
- Open the graph via the top-level **Revision Graph** menu, the toolbar button,
  or **Window → Show View → Other… → Git → Revision Graph**.
- The graph shows commits, local & remote branches, tags and stashes as
  connected boxes — the same shared renderer as the VS Code, Visual Studio and
  JetBrains hosts, pixel-for-pixel. Right-click a box for the same context
  menu: create branch, checkout, merge, rename/undo a local commit, copy SHA…

## Publishing to the Eclipse Marketplace
Unlike the VS Code / Visual Studio / JetBrains marketplaces, the Eclipse
Marketplace does **not** host the artifact. A Marketplace listing is just a
record that points at a **p2 update site URL**. So publishing means:

1. Build the update site (step 2 above).
2. Deploy `target/repository/` to a stable URL — this repo publishes it to
   GitHub Pages and also attaches the zipped site to each GitHub Release (see
   the `build-eclipse-plugin` job in `.github/workflows/release.yml`).
3. Create/refresh the Marketplace listing once at
   <https://marketplace.eclipse.org/> so it points at that update-site URL (a
   one-time manual step, comparable to the one-time first upload the JetBrains
   Marketplace needs). The "Install" / drag-to-install button then pulls from
   the published site.

Because the Marketplace pulls from the site URL, updating the plugin is just a
matter of the release workflow republishing the site — no per-release
Marketplace API upload is required (there isn't one).

## Notes / known differences from the other hosts
- **Reword/undo of a non-HEAD commit** uses pure git plumbing (`commit-tree` +
  `update-ref`), identical to the JetBrains host and unlike the Visual Studio
  host's PowerShell-scripted `git rebase -i`. It therefore requires a clean
  working tree and can never report a mid-op conflict. See the doc comments on
  `GitService.rewordCommit` / `undoCommit`.
- Renaming a branch and rewording a commit expect their new-name/new-message
  prompt to come from a future native dialog (same follow-up the JetBrains host
  notes); the git plumbing is wired and ready.
- The webview bundle loads from a `file://` URL under the bundle's per-user
  state location (`Platform.getStateLocation(bundle)/webview/<version>`), since
  SWT's `Browser` (like JCEF) can't load resources straight out of the plugin
  JAR. It's extracted once per plugin version and cached there, so an update
  re-extracts instead of serving a stale bundle.
- Auto-refresh watches the Eclipse resource tree for changes under `.git`. When
  `.git` isn't part of the workspace resource tree, the graph still refreshes
  after every mutating operation and via the webview's manual refresh button.
