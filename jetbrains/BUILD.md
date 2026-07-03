# Building the JetBrains-family plugin

> This project is authored cross-platform, but has not been compiled or run
> in this environment: doing so needs a JDK 17 + Gradle + the IntelliJ
> Platform Gradle plugin's dependency resolution (network access to the
> IntelliJ Platform Maven repositories), none of which are available in the
> sandbox this was written in. Review the Kotlin carefully; build and
> manually test it on a machine that has those installed — the same caveat
> `vs/BUILD.md` already carries for the Visual Studio VSIX on non-Windows
> machines.

## One codebase, one build

`jetbrains/` is a Gradle **multi-project** with a single plugin subproject
(`:intellij`) built against a broad, unbounded IntelliJ Platform build-number
range. Because Marketplace/IDE compatibility is matched by build number, not
by product name, this one build already installs into IntelliJ IDEA, Android
Studio, Huawei DevEco Studio, WebStorm, PyCharm, GoLand, and every other
IntelliJ Platform IDE — there is no need for separate per-product flavors or
listings.

```
jetbrains/
  settings.gradle.kts        # includes :intellij
  build.gradle.kts           # declares the IntelliJ Platform plugin (apply false)
  gradle.properties          # shared group + version (CI patches the version)
  common/                    # ← ALL the shared code lives here
    src/main/kotlin/...       #   GitService, WebViewHostPanel, Dtos, …
    src/main/resources/
      webview/index.html      #   (main.js/main.css/schematics staged by the build)
      icons/
  intellij/
    build.gradle.kts         # IC 2023.1.7 baseline, since 231, no untilBuild; Marketplace publish
    src/main/resources/META-INF/plugin.xml
```

`:intellij` compiles the Kotlin in `common/src/main/kotlin` (pulled in via
`sourceSets { main { java.srcDir("$rootDir/common/…") } }`) and bundles the
shared web renderer. It builds against IC 2023.1.7 — the oldest baseline that
keeps the plugin's declared build-number range (`sinceBuild = "231"`, no
`untilBuild`) broad enough to cover Android Studio and DevEco Studio releases
as well as current IntelliJ IDEA/JetBrains IDE builds.

## Prerequisites
- JDK 17.
- Gradle 8.9+ (or `jetbrains/gradlew` once generated — see below).
- Node.js 18+ (to build the shared web renderer).
- Git on `PATH`.
- DevEco Studio, Android Studio, and/or a JetBrains IDE (IntelliJ IDEA
  Community is enough for UI development) for manually installing/trying the
  built plugin.

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
   `vs/webview/index.html`). The `:intellij` build reads from this one location.

2. Generate the Gradle wrapper once (only `gradle/wrapper/gradle-wrapper.properties`
   is checked in; the wrapper jar/scripts are not, since they're binary):
   ```
   cd jetbrains
   gradle wrapper --gradle-version 8.9
   ```
   From then on use `./gradlew` (or `gradlew.bat` on Windows).

3. Build the plugin distribution ZIP:
   ```
   ./gradlew buildPlugin
   ```
   Output: `jetbrains/intellij/build/distributions/*.zip`.

4. To try it interactively instead of sideloading the ZIP, use the IntelliJ
   Platform Gradle plugin's run task:
   ```
   ./gradlew :intellij:runIde
   ```
   Launches a sandboxed IDE at the pinned platform version (IC 2023.1.7) with
   the plugin installed.

## Publishing to the JetBrains Marketplace
Neither DevEco Studio nor Android Studio has a separate plugin store of its
own; both are built on the IntelliJ Platform, so their own Settings > Plugins >
Marketplace panels are the same plugins.jetbrains.com Marketplace, just
filtered to plugins whose build-number range covers that IDE's platform build.
That means **one listing** (plugin id `com.hunkontech.revgraph`; see
`pluginGroup` in `jetbrains/gradle.properties`) already covers IntelliJ IDEA,
Android Studio, DevEco Studio, and the rest of the family — there's no need
for, and JetBrains Marketplace review will reject, separate per-product
listings built from the same code and build range.

Set these env vars and run `./gradlew :intellij:publishPlugin`:
- `PUBLISH_TOKEN` — a JetBrains Marketplace permanent token.
- `CERTIFICATE_CHAIN`, `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD` — for signing
  (see the IntelliJ Platform plugin-signing docs).

With no token set, `publishPlugin` is a no-op, so ordinary local/CI builds still
succeed and just produce the sideloadable ZIP.

### Automatic publishing from CI
The `Build & Publish Extensions` GitHub Actions workflow
(`.github/workflows/release.yml`) publishes to the Marketplace automatically on
every release, right after it uploads the ZIP to the GitHub Release. It only
does so when the **`JETBRAINS_MARKETPLACE_TOKEN`** repository secret is set
(the publish step is skipped otherwise). Optional signing is read from the
`JETBRAINS_CERTIFICATE_CHAIN`, `JETBRAINS_PRIVATE_KEY`, and
`JETBRAINS_PRIVATE_KEY_PASSWORD` secrets; if they are absent the Marketplace
signs the upload itself.

The Marketplace API can only push **updates** — the `com.hunkontech.revgraph`
listing must be created **once** by uploading its first build manually via
<https://plugins.jetbrains.com/> and passing moderation before CI can publish
subsequent versions.

The publish step in CI treats two specific Marketplace API errors as non-fatal
warnings instead of failing the job — the ZIP is already built and attached to
the GitHub Release regardless of what the Marketplace publish does:
- `Cannot find plugin` — the listing doesn't exist yet (the one-time bootstrap
  state above; expected until the manual first upload + moderation).
- `already contains version ... in channel` — this exact version was already
  published by an earlier attempt of the same job. This happens because the
  job is not naturally idempotent: GitHub Actions' "Re-run failed jobs" reuses
  the `release` job's already-computed version number rather than bumping it,
  so retrying `build-jetbrains-plugins` after a partial failure targets the
  same version again.

Every other publish error still fails the job.

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
