# Building the JetBrains-family plugins

> This project is authored cross-platform, but has not been compiled or run
> in this environment: doing so needs a JDK 17 + Gradle + the IntelliJ
> Platform Gradle plugin's dependency resolution (network access to the
> IntelliJ Platform Maven repositories), none of which are available in the
> sandbox this was written in. Review the Kotlin carefully; build and
> manually test it on a machine that has those installed — the same caveat
> `vs/BUILD.md` already carries for the Visual Studio VSIX on non-Windows
> machines.

## One codebase, two builds

`jetbrains/` is a Gradle **multi-project** that produces **two** plugin
distributions from a single shared codebase:

| Subproject | Targets | Distribution |
|------------|---------|--------------|
| `:deveco`   | Huawei DevEco Studio (built on IntelliJ IDEA Community) | sideloaded ZIP |
| `:intellij` | Mainstream JetBrains IDEs — IntelliJ IDEA, WebStorm, PyCharm, GoLand, … | sideloaded ZIP + JetBrains Marketplace |

```
jetbrains/
  settings.gradle.kts        # includes :deveco and :intellij
  build.gradle.kts           # declares the IntelliJ Platform plugin (apply false)
  gradle.properties          # shared group + version (CI patches the version)
  common/                    # ← ALL the shared code lives here
    src/main/kotlin/...       #   GitService, WebViewHostPanel, Dtos, …
    src/main/resources/
      webview/index.html      #   (main.js/main.css/schematics staged by the build)
      icons/
  deveco/
    build.gradle.kts         # IC 2023.1.7, since 231; DevEco branding
    src/main/resources/META-INF/plugin.xml
  intellij/
    build.gradle.kts         # IC 2024.1, since 231; JetBrains branding + Marketplace publish
    src/main/resources/META-INF/plugin.xml
```

Both flavors compile the **exact same** Kotlin in `common/src/main/kotlin`
(pulled in via `sourceSets { main { java.srcDir("$rootDir/common/…") } }`) and
bundle the **exact same** shared web renderer. They differ only in the IntelliJ
Platform version they build against and their `plugin.xml` branding — the DevEco
Studio flavor stays on the older platform to keep its build-number range broad;
the IntelliJ flavor builds against a current release and is wired for Marketplace
publishing.

## Prerequisites
- JDK 17.
- Gradle 8.9+ (or `jetbrains/gradlew` once generated — see below).
- Node.js 18+ (to build the shared web renderer).
- Git on `PATH`.
- DevEco Studio and/or a JetBrains IDE (IntelliJ IDEA Community is enough for
  UI development) for manually installing/trying the built plugins.

## Steps
1. Build the shared web renderer and stage it into the **shared** module:
   ```
   npm install
   npm run build:core
   npm run build:webview
   npm run build:jetbrains-assets
   ```
   This produces `jetbrains/common/src/main/resources/webview/main.js` and
   `main.css` (`index.html` is checked in as a static file, like
   `vs/webview/index.html`). Both flavors read from this one location.

2. Generate the Gradle wrapper once (only `gradle/wrapper/gradle-wrapper.properties`
   is checked in; the wrapper jar/scripts are not, since they're binary):
   ```
   cd jetbrains
   gradle wrapper --gradle-version 8.9
   ```
   From then on use `./gradlew` (or `gradlew.bat` on Windows).

3. Build **both** plugin distribution ZIPs (one `buildPlugin` aggregates across
   both subprojects):
   ```
   ./gradlew buildPlugin
   ```
   Outputs:
   - `jetbrains/deveco/build/distributions/*.zip`   (DevEco Studio flavor)
   - `jetbrains/intellij/build/distributions/*.zip` (IntelliJ / JetBrains flavor)

   To build just one flavor: `./gradlew :deveco:buildPlugin` or
   `./gradlew :intellij:buildPlugin`.

4. To try a flavor interactively instead of sideloading its ZIP, use the
   IntelliJ Platform Gradle plugin's run task:
   ```
   ./gradlew :deveco:runIde      # DevEco-Studio-compatible IDE (IC 2023.1)
   ./gradlew :intellij:runIde    # mainstream IntelliJ IDEA (IC 2024.1)
   ```
   Each launches a sandboxed IDE at that flavor's pinned platform version with
   the plugin installed.

## Publishing the IntelliJ flavor to the JetBrains Marketplace
Only the `:intellij` flavor is Marketplace-ready. Set these env vars and run
`./gradlew :intellij:publishPlugin`:
- `PUBLISH_TOKEN` — a JetBrains Marketplace permanent token.
- `CERTIFICATE_CHAIN`, `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD` — for signing
  (see the IntelliJ Platform plugin-signing docs).

With no token set, `publishPlugin` is a no-op, so ordinary local/CI builds still
succeed and just produce the sideloadable ZIPs.

### Automatic publishing from CI
The `Build & Publish Extensions` GitHub Actions workflow
(`.github/workflows/release.yml`) publishes the `:intellij` flavor to the
Marketplace automatically on every release, right after it uploads the ZIPs to
the GitHub Release. It only does so when the **`JETBRAINS_MARKETPLACE_TOKEN`**
repository secret is set (the step is skipped otherwise). Optional signing is
read from the `JETBRAINS_CERTIFICATE_CHAIN`, `JETBRAINS_PRIVATE_KEY`, and
`JETBRAINS_PRIVATE_KEY_PASSWORD` secrets; if they are absent the Marketplace
signs the upload itself.

The Marketplace API can only push **updates** — the plugin listing (id
`com.hunkontech.revgraph`) must be created once by uploading the first build
manually via <https://plugins.jetbrains.com/> and passing moderation before CI
can publish subsequent versions.

## Trying it
- Open a project that is inside a Git repo.
- **View → Tool Windows → Revision Graph** opens the tool window.
- The graph shows commits, local & remote branches, tags, and stashes as
  connected boxes, matching the VS Code and Visual Studio hosts pixel-for-
  pixel (same shared renderer).
- Right-click a box for the same context menu as the other hosts: create
  branch, checkout, merge, rename/undo a local commit, copy SHA, etc.

## Notes / known differences from the other hosts
- **Reword/undo of a non-HEAD commit** is implemented with pure git plumbing
  (`commit-tree` + `update-ref`) rather than the Visual Studio host's
  PowerShell-scripted `git rebase -i`, since these plugins run on
  Windows/macOS/Linux alike. See the doc comments on
  `GitService.rewordCommit` / `undoCommit` for the exact algorithm. A
  side-effect: these two ops require a **clean working tree** first (no
  `--autostash` equivalent) and can never report a mid-op conflict — they
  either succeed or throw.
- Renaming a branch and rewording a commit currently expect their new-name
  prompt to come from a future native dialog (mirroring
  `vs/NewBranchDialog.xaml`/`vs/PromptDialog.cs`); the plumbing is wired but
  the dialogs themselves are a small follow-up.
- The webview bundle loads from a `file://` URL under the IDE's per-user
  system directory (`PathManager.getSystemPath()/revgraph/webview/<version>`),
  since JCEF can't load resources straight out of the plugin JAR. It's
  extracted once per plugin version and cached there, so installing an
  update automatically re-extracts instead of serving a stale bundle.
