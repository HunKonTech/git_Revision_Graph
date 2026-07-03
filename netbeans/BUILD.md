# Building the Apache NetBeans plugin

The NetBeans host is the sixth host of the Git Revision Graph (alongside VS Code,
Visual Studio, the JetBrains family, Eclipse, and the browser demo). It is a
**NetBeans module** written in **Kotlin**, packaged as a `.nbm` by
`nbm-maven-plugin`, and it embeds the shared web renderer in a **JavaFX
`WebView`** (inside a Swing `JFXPanel`).

## Maximal code reuse

This module deliberately re-implements as little as possible. The git-reading /
git-writing layer and the protocol DTOs are **not** duplicated here — the
`kotlin-maven-plugin` `compile` execution in [`pom.xml`](pom.xml) adds two extra
source roots pointing straight at the JetBrains host's shared, IDE-agnostic
Kotlin:

```
../jetbrains/common/src/main/kotlin/com/hunkontech/revgraph/git    (GitService.kt)
../jetbrains/common/src/main/kotlin/com/hunkontech/revgraph/model  (Dtos.kt)
```

Both files have **zero IntelliJ Platform imports** (pure JVM Kotlin: git CLI +
Gson), so they compile unchanged in this module. The sibling IntelliJ-coupled
files in `common/` (`WebViewHostPanel.kt`, the file-editor classes, …) are
deliberately kept **off** the source path.

Only the NetBeans platform glue lives in `src/main/kotlin/com/hunkontech/revgraph/`:

| File | Role | JetBrains counterpart |
|------|------|-----------------------|
| `NetBeansWebViewHost.kt` | JavaFX WebView host + message dispatcher | `WebViewHostPanel.kt` (JCEF) |
| `RevisionGraphTopComponent.kt` | editor-area window | `RevisionGraphFileEditor.kt` |
| `OpenRevisionGraphAction.kt` | Tools-menu action | `OpenRevisionGraphAction.kt` |
| `NetBeansRepoResolver.kt` | resolve candidate repo dirs | `RepoResolver.kt` |
| `RepoWatcher.kt` | `.git` change watcher | IntelliJ VFS listener |

The JS↔host bridge reuses the existing `window.__ideHostPostMessage__` transport
that `packages/graph-webview/src/host-bridge.ts` already detects (the same hook
the JetBrains/JCEF and Eclipse/SWT hosts use). `webview/bridge.js` defines it
before the shared bundle loads; `NetBeansWebViewHost.kt` attaches the actual
Java callback (`window.__revGraphBridge__`) via a JavaFX `JSObject` once the page
has loaded.

## Prerequisites

- **JDK 17** (Temurin or any distribution).
- **Apache Maven 3.9+**.
- Network access to Maven Central (for the `org.netbeans.api`, OpenJFX, Kotlin
  and Gson artifacts).

NetBeans (JDK 17) ships **no JavaFX**, so the WebView runtime is bundled: the
`org.openjfx:javafx-web` / `javafx-swing` dependencies pull the correct
host-platform native jars automatically (OpenJFX's POMs select them via
OS-activated profiles).

## Build

From the repo root, first stage the shared renderer bundle, then build the module:

```bash
npm run build:core
npm run build:webview
npm run build:netbeans-assets   # copies the bundle into src/main/resources/.../webview/
mvn -f netbeans/pom.xml -DskipTests clean package
```

or simply:

```bash
npm run package:netbeans
```

The output is `netbeans/target/netbeans-<version>.nbm` (a signed-if-configured,
sideloadable NetBeans module). `scripts/build-installers.ps1` and the
`build-netbeans-plugin` CI job copy it to `dist/installers/RevisionGraph-netbeans.nbm`.

> The shared bundle (`webview/main.js`, `main.css`, `schematics/`) is generated,
> not checked in (see `.gitignore`); only `webview/index.html` and
> `webview/bridge.js` are committed. Always run `build:netbeans-assets` before a
> Maven build in a clean checkout.

## Install (sideload) into NetBeans

1. In NetBeans: **Tools ▸ Plugins ▸ Downloaded ▸ Add Plugins…**
2. Select `RevisionGraph-netbeans.nbm`, click **Install**, and follow the wizard
   (accept the self-signed / unsigned-plugin prompt).
3. Restart NetBeans when prompted.
4. Open a project under Git version control, then **Tools ▸ Revision Graph** — the
   graph opens as a center editor tab.

## Publishing to the Apache NetBeans Plugin Portal

Unlike the JetBrains Marketplace, the **Plugin Portal has no token-based push
API**, so CI does **not** publish automatically (and needs no new secret). The
portal only lists plugins **hosted on Maven Central** and requires a **one-time
manual registration** that is then cleared by **two Plugin Portal verifiers**:

1. Deploy the module artifact to Maven Central under `com.hunkontech.revgraph`
   (a separate, opt-in step — not wired into the release workflow).
2. Sign in at <https://plugins.netbeans.apache.org/>, click **Add Plugin**, and
   provide the `groupId` / `artifactId`. Metadata (name, license, description) is
   read from the POM.
3. Mark the compatible NetBeans versions and submit; once two verifiers approve
   and none reject, it is published on the Plugin Portal Update Center.

Until then, distribution is via the `.nbm` attached to each GitHub Release.

## Known limitation — JavaFX native libraries

The bundled JavaFX natives are **platform-specific**: a `.nbm` built on Linux
carries the Linux WebKit natives, etc. The CI `build-netbeans-plugin` job runs on
`ubuntu-latest`, so the released `.nbm` targets Linux. Producing a single
multi-platform `.nbm` (bundling all OpenJFX native classifiers) is a documented
follow-up; for other platforms, build the `.nbm` locally on that OS for now.
