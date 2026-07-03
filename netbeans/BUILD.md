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

## Auto-update via the NetBeans Update Center (no token)

The **Plugin Portal has no token-based push API**, so — exactly like the Eclipse
host with its p2 update site — end-user auto-update is delivered the
NetBeans-native way, through an **Autoupdate Center**: a small `updates.xml`
catalog that lists the module and points at the `.nbm`.

- The `nbm-maven-plugin` `autoupdate` goal (bound to the `package` phase in
  [`pom.xml`](pom.xml)) generates the catalog into `target/netbeans_site/`
  (`updates.xml` + a copy of the `.nbm`). `distBase` is deliberately left unset,
  so the catalog uses **relative** nbm URLs and is therefore location-independent.
- The `build-netbeans-plugin` CI job deploys `target/netbeans_site/` to **GitHub
  Pages** under `/netbeans-update-center` (via `peaceiris/actions-gh-pages`,
  `keep_files: true`, mirroring the Eclipse update-site deploy). It uses only the
  existing `GITHUB_TOKEN` — **no new secret**.

A user subscribes once and then gets updates automatically:

1. **Tools ▸ Plugins ▸ Settings ▸ Add**.
2. Name it e.g. *Revision Graph*, URL:
   `https://hunkontech.github.io/git_Revision_Graph/netbeans-update-center/updates.xml`.
3. Back on the **Available Plugins** tab, install/update Revision Graph; future
   releases show up under **Check for Updates** automatically.

## Publishing to the Apache NetBeans Plugin Portal (optional listing)

The Plugin Portal (<https://plugins.netbeans.apache.org/>) is a **separate**,
optional discoverability surface (the auto-update above does not need it). It has
**no direct `.nbm` upload and no push token of its own** — it only lists plugins
**hosted on Maven Central**. So getting onto the Portal is a two-part process:
**(A)** deploy the signed artifact to Maven Central (now wired into CI, opt-in),
and **(B)** a one-time manual registration on the Portal cleared by two verifiers.

### A. Deploy to Maven Central — opt-in CI step (`central-deploy` profile)

The `build-netbeans-plugin` job runs `mvn -Pcentral-deploy … deploy` **only when
the `MAVENCENTRAL_USERNAME` secret is set** (otherwise skipped — credential-less
builds still succeed). The `central-deploy` profile in [`pom.xml`](pom.xml) adds
the sources/javadoc jars, GPG-signs everything, and uploads via the Sonatype
`central-publishing-maven-plugin` (left at `autoPublish=false` → the release sits
**validated** in the Central UI for a manual **Publish** click the first times).

One-time setup you must do outside this repo:

1. **Sonatype Central account + namespace.** Sign in at
   <https://central.sonatype.com> (GitHub login is easiest) and register the
   **`io.github.benkoncsik`** namespace. Central verifies it via GitHub — it
   names a temporary code; create a **public repo with that name under
   `github.com/benkoncsik`**, click **Verify**, then you can delete the repo. No
   domain / DNS is involved. (This GitHub-verified namespace is why the POM
   `groupId` is `io.github.benkoncsik`, giving module code-name base
   `io.github.benkoncsik.netbeans`.)
2. **Central user token** → repo secrets `MAVENCENTRAL_USERNAME` /
   `MAVENCENTRAL_PASSWORD` (Central ▸ Account ▸ *Generate User Token*).
3. **GPG key** → `gpg --gen-key`, publish the public key to a keyserver, then
   export the private key (`gpg --armor --export-secret-keys <id>`) into repo
   secret `MAVEN_GPG_PRIVATE_KEY`, and the passphrase into `MAVEN_GPG_PASSPHRASE`.

Once those four secrets exist, each release deploys `io.github.benkoncsik:netbeans`
automatically; you click **Publish** in the Central UI (until you flip
`autoPublish` to `true`).

### B. Register on the Plugin Portal (manual, one-time)

1. Sign in at <https://plugins.netbeans.apache.org/> with Google/GitHub, click
   **Add Plugin**, and provide `groupId = io.github.benkoncsik`,
   `artifactId = netbeans` — metadata (name, license, homepage, description)
   auto-populates from the POM. (The Portal reads
   `.../io/github/benkoncsik/netbeans/maven-metadata.xml` from Maven Central, so
   this only works **after** step A has deployed *and* you clicked Publish.)
2. Categorize it, mark the compatible NetBeans versions, and **Request
   verification**; once two verifiers approve and none reject, it is published on
   the Plugin Portal Update Center.

> **Two caveats to check first.** The Portal requires the plugin to be **signed**
> (self-signed is fine, but the module jar/nbm itself must carry a certificate —
> separate from the GPG signing of the Maven artifacts). And the plugin ships
> under the **Business Source License 1.1**, which is **not OSI-approved**; the
> Portal's Quality Criteria and its human verifiers may reject a non-open license,
> so confirm acceptance before relying on this listing.

Regardless of the Portal, distribution/auto-update is already served by the GitHub
Pages Update Center above, plus the `.nbm` attached to each GitHub Release.

## Known limitation — JavaFX native libraries

The bundled JavaFX natives are **platform-specific**: a `.nbm` built on Linux
carries the Linux WebKit natives, etc. The CI `build-netbeans-plugin` job runs on
`ubuntu-latest`, so the released `.nbm` targets Linux. Producing a single
multi-platform `.nbm` (bundling all OpenJFX native classifiers) is a documented
follow-up; for other platforms, build the `.nbm` locally on that OS for now.
