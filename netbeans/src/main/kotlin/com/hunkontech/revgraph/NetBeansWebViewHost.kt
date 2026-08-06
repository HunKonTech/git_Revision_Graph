package com.hunkontech.revgraph

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.hunkontech.revgraph.git.GitService
import com.hunkontech.revgraph.model.WebviewMessage
import javafx.application.Platform
import javafx.concurrent.Worker
import javafx.embed.swing.JFXPanel
import javafx.scene.Scene
import javafx.scene.web.WebView
import netscape.javascript.JSObject
import org.openide.modules.Places
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.io.File
import java.io.FileOutputStream
import java.net.JarURLConnection
import java.util.Enumeration
import java.util.concurrent.Executors
import java.util.jar.JarFile
import java.util.zip.ZipEntry
import javax.swing.JComponent
import javax.swing.JFileChooser
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants
import javax.swing.SwingUtilities
import javax.swing.UIManager

/**
 * Hosts the shared web renderer (packages/graph-webview) inside a JavaFX
 * [WebView] embedded in a Swing [JFXPanel], and bridges messages to
 * [GitService]. This is the Apache NetBeans counterpart of
 * jetbrains/common/.../WebViewHostPanel.kt (JCEF), vs/WebViewHostControl.xaml.cs
 * (WebView2) and vscode/src/panel.ts.
 *
 * The message-dispatch, refresh and theme logic is a straight port of the
 * JetBrains host; only the platform primitives differ:
 *  - JCEF `JBCefBrowser`         -> JavaFX `WebView` in a `JFXPanel`
 *  - `JBCefJSQuery`              -> `JSObject.setMember` + a small bridge.js shim
 *  - IntelliJ `CopyPasteManager` -> AWT system clipboard
 *  - IntelliJ `FileChooser`      -> Swing `JFileChooser`
 *  - IntelliJ theme colors       -> Swing `UIManager` colors (platform-neutral)
 *
 * The actual git reading/writing is the SAME shared [GitService] the JetBrains
 * flavors compile (jetbrains/common/.../git/GitService.kt), pulled into this
 * module's compilation unchanged — so all hosts feed the renderer identical data.
 */
class NetBeansWebViewHost {

    private val gson: Gson = GsonBuilder().create()
    private val exec = Executors.newSingleThreadExecutor { r -> Thread(r, "revgraph-git").apply { isDaemon = true } }

    private var git: GitService? = null
    private var repoRoot: String? = null
    private var watcher: RepoWatcher? = null

    // JavaFX engine + readiness. `pending` buffers outbound messages posted
    // before the page finishes loading; flushed once `loaded` flips true.
    @Volatile private var engine: javafx.scene.web.WebEngine? = null
    @Volatile private var loaded = false
    private val pending = ArrayList<String>()

    private val bridge = Bridge()

    /** JS -> Kotlin callback object exposed to the page as `window.__revGraphBridge__`. */
    inner class Bridge {
        /** Called by bridge.js's `window.__ideHostPostMessage__`. */
        fun post(json: String) {
            exec.submit { handleWebviewMessage(json) }
        }
    }

    val component: JComponent = createComponent()

    private fun createComponent(): JComponent {
        val panel = JFXPanel()
        Platform.setImplicitExit(false)
        Platform.runLater { initFx(panel) }
        return panel
    }

    private fun initFx(panel: JFXPanel) {
        val webView = WebView()
        val eng = webView.engine
        engine = eng
        eng.isJavaScriptEnabled = true

        eng.loadWorker.stateProperty().addListener { _, _, newState ->
            if (newState == Worker.State.SUCCEEDED) onPageLoaded()
        }

        panel.scene = Scene(webView)

        val indexFile = ensureAssetsExtracted()
        if (indexFile != null) {
            eng.load(indexFile.toURI().toString())
        }
    }

    /** Runs on the JavaFX thread once the document has loaded. */
    private fun onPageLoaded() {
        val eng = engine ?: return
        try {
            val win = eng.executeScript("window") as JSObject
            // bridge.js already defined window.__ideHostPostMessage__ (before the
            // shared bundle ran, so host-bridge.ts picked the IDE transport); wire
            // the actual Java callback in now.
            win.setMember("__revGraphBridge__", bridge)
            defaultLangScript()?.let { eng.executeScript(it) }
            eng.executeScript(themeScript())
        } catch (e: Exception) {
            // Non-fatal: the graph still renders via window.postMessage.
        }
        loaded = true
        synchronized(pending) {
            for (json in pending) eng.executeScript("window.postMessage($json, '*');")
            pending.clear()
        }
        // The initial "ready" ping may have been dropped before the bridge was
        // attached; re-read git now that the page can receive it.
        refresh()
    }

    /**
     * The webview bundle ships as module resources under
     * `com/hunkontech/revgraph/webview/` (staged by scripts/copy-netbeans-assets.mjs).
     * JavaFX WebView needs real file:// URLs, so on first use it is extracted once
     * into the NetBeans user directory, keyed by plugin version (an update
     * invalidates the cache). Mirrors WebViewHostPanel.ensureAssetsExtracted().
     */
    private fun ensureAssetsExtracted(): File? {
        val loader = javaClass.classLoader
        val pluginVersion = loader.getResource("revgraph-version.txt")
            ?.readText()?.trim()?.ifEmpty { null } ?: "dev"

        val userDir = Places.getUserDirectory() ?: File(System.getProperty("java.io.tmpdir"))
        val destDir = File(userDir, "revgraph/webview/$pluginVersion")
        val indexFile = File(destDir, "index.html")
        if (indexFile.exists()) return indexFile

        val resourceUrl = loader.getResource("$RES_PREFIX" + "index.html") ?: return null
        destDir.mkdirs()

        if (resourceUrl.protocol == "jar") {
            val jarConnection = resourceUrl.openConnection() as JarURLConnection
            val jar: JarFile = jarConnection.jarFile
            val entries: Enumeration<out ZipEntry> = jar.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (!entry.name.startsWith(RES_PREFIX) || entry.isDirectory) continue
                val relative = entry.name.removePrefix(RES_PREFIX)
                val outFile = File(destDir, relative)
                outFile.parentFile?.mkdirs()
                jar.getInputStream(entry).use { input ->
                    FileOutputStream(outFile).use { output -> input.copyTo(output) }
                }
            }
        } else {
            // Exploded classpath (dev / Run Plugin task): resources sit on disk already.
            val sourceDir = File(resourceUrl.toURI()).parentFile
            sourceDir.copyRecursively(destDir, overwrite = true)
        }
        return if (indexFile.exists()) indexFile else null
    }

    /**
     * Per-host default UI language. This module ships no `revgraph/default-lang.txt`
     * (English default), matching the mainstream IntelliJ flavor; the hook is kept
     * so a future localized NetBeans build can drop one in. Injected before the
     * bundle's i18n module reads it (see i18n.ts hostDefaultLang).
     */
    private fun defaultLangScript(): String? {
        val lang = javaClass.classLoader.getResource("revgraph/default-lang.txt")
            ?.readText()?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return "window.__REV_GRAPH_DEFAULT_LANG__=${gson.toJson(lang)};"
    }

    // ------------------------------------------------------------------
    // Repository binding
    // ------------------------------------------------------------------

    /** Point the host at a repository; tries each candidate directory in order. */
    fun setRepository(startDirs: List<String>) {
        val root = startDirs.firstNotNullOfOrNull { GitService.findRepoRoot(it) }
        git = root?.let { GitService(it) }
        repoRoot = root
        watcher?.close()
        watcher = root?.let { RepoWatcher(it, ::scheduleRefresh).also(RepoWatcher::start) }
        refresh()
    }

    private fun scheduleRefresh() {
        refresh()
    }

    private fun refresh() {
        exec.submit {
            val g = git
            if (g == null) {
                postToWebview(mapOf("type" to "error", "message" to "No Git repository found for the current project."))
                return@submit
            }
            try {
                val data = g.readGraphData(1000)
                postToWebview(mapOf("type" to "setData", "data" to data))
            } catch (e: Exception) {
                postToWebview(mapOf("type" to "error", "message" to "Failed to read git history: ${e.message}"))
            }
        }
    }

    // ------------------------------------------------------------------
    // Message dispatch (ports WebViewHostPanel.dispatch / handlers)
    // ------------------------------------------------------------------

    private fun handleWebviewMessage(json: String) {
        val msg = try { gson.fromJson(json, WebviewMessage::class.java) } catch (e: Exception) { null } ?: return
        dispatch(msg)
    }

    private fun dispatch(msg: WebviewMessage) {
        try {
            when (msg.type) {
                "ready", "requestRefresh" -> refresh()
                "createBranch" -> {
                    val g = git ?: return
                    val sha = msg.sha ?: return
                    val name = msg.name
                    if (!name.isNullOrBlank()) {
                        g.createBranch(name.trim(), sha, msg.checkout ?: true)
                        postToWebview(mapOf("type" to "branchCreated", "name" to name.trim(), "sha" to sha))
                    }
                    refresh()
                }
                "deleteBranch" -> deleteBranch(msg.name)
                "renameBranch" -> refresh()
                "renameCommit" -> renameCommit(msg.sha)
                "undoCommit" -> undoCommit(msg.sha)
                "stashApply", "stashPop", "stashDrop" -> handleStash(msg.type!!, msg.index)
                "checkout" -> checkoutCommit(msg.sha, msg.ref)
                "copySha" -> msg.sha?.let { Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(it), null) }
                "requestCommitChanges" -> handleCommitChanges(msg.sha)
                "requestCommitTree" -> handleCommitTree(msg.sha)
                "requestFileDiff" -> handleFileDiff(msg.sha, msg.path, msg.status, msg.oldPath)
                "requestFileContent" -> handleFileContent(msg.sha, msg.path)
                "requestWorkingTreeChanges" -> handleWorkingTreeChanges()
                "requestWorkingTreeFileDiff" -> handleWorkingTreeFileDiff(msg.path, msg.status, msg.oldPath)
                "commitWorkingTreeChanges" -> commitWorkingTreeChanges(msg.message, msg.files)
                "requestMergePreview" -> handleMergePreview(msg.source)
                "requestMergeFileDiff" -> handleMergeFileDiff(msg.source, msg.path, msg.status)
                "merge" -> mergeBranch(msg.source, msg.message, msg.noFastForward ?: false, msg.squash ?: false)
                "fetch" -> runRemoteOp("Fetch") { it.fetch() }
                "pull" -> runRemoteOp("Pull") { it.pull() }
                "push" -> runRemoteOp("Push") { it.push() }
                "pushBranch" -> msg.name?.let { name -> runRemoteOp("Push \"$name\"") { it.pushBranch(name) } }
                "sync" -> runRemoteOp("Sync") { it.sync() }
                "setGitPath" -> GitService.setCustomGitPath(msg.gitPath)
                "browseGitPath" -> browseGitPath()
                "openExternal" -> msg.url?.let { org.openide.awt.HtmlBrowser.URLDisplayer.getDefault().showURL(java.net.URL(it)) }
            }
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to (e.message ?: e.toString())))
        }
    }

    private fun runRemoteOp(label: String, op: (GitService) -> Unit) {
        val g = git
        if (g == null) {
            postToWebview(mapOf("type" to "error", "message" to "No Git repository found for the current project."))
            return
        }
        try {
            op(g)
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "$label failed: ${e.message}"))
        }
        refresh()
    }

    private fun deleteBranch(name: String?) {
        val g = git ?: return
        if (name.isNullOrEmpty()) return
        try {
            val current = g.getCurrentBranch()
            if (current == name) {
                val target = g.resolveBranchBaseTarget(name)
                if (target.isEmpty() || target == name) {
                    postToWebview(mapOf("type" to "error", "message" to "Cannot delete \"$name\": it is checked out and no other branch to switch to was found."))
                    return
                }
                g.checkout(target)
            }
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Delete branch failed: ${e.message}"))
            return
        }
        try {
            g.deleteBranch(name, false)
        } catch (e: Exception) {
            try {
                g.deleteBranch(name, true)
            } catch (e2: Exception) {
                postToWebview(mapOf("type" to "error", "message" to "Delete branch failed: ${e2.message}"))
                return
            }
        }
        refresh()
    }

    private fun renameCommit(sha: String?) {
        val g = git ?: return
        if (sha.isNullOrEmpty()) return
        if (g.isCommitPushed(sha)) {
            postToWebview(mapOf("type" to "error", "message" to "This commit has already been pushed, so its message can't be rewritten safely."))
            return
        }
        // The new message is collected by a native prompt dialog (follow-up UI
        // work, mirroring the JetBrains host); rewordCommit is wired and ready.
        refresh()
    }

    private fun undoCommit(sha: String?) {
        val g = git ?: return
        if (sha.isNullOrEmpty()) return
        if (g.isCommitPushed(sha)) {
            postToWebview(mapOf("type" to "opResult", "op" to "undo", "result" to "error"))
            return
        }
        try {
            g.undoCommit(sha)
            postToWebview(mapOf("type" to "opResult", "op" to "undo", "result" to "ok"))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "opResult", "op" to "undo", "result" to "error", "detail" to e.message))
        }
        refresh()
    }

    private fun handleStash(op: String, index: Int?) {
        val g = git ?: return
        if (index == null) return
        try {
            val result = when (op) {
                "stashApply" -> if (g.stashApply(index) == GitService.OpOutcome.CONFLICT) "conflict" else "ok"
                "stashPop" -> if (g.stashPop(index) == GitService.OpOutcome.CONFLICT) "conflict" else "ok"
                else -> { g.stashDrop(index); "ok" }
            }
            postToWebview(mapOf("type" to "opResult", "op" to op, "result" to result))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "opResult", "op" to op, "result" to "error", "detail" to e.message))
        }
        refresh()
    }

    private fun handleCommitChanges(sha: String?) {
        val g = git ?: return
        if (sha.isNullOrEmpty()) return
        try {
            postToWebview(mapOf("type" to "commitChanges", "sha" to sha, "files" to g.readCommitChanges(sha)))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read commit changes: ${e.message}"))
        }
    }

    private fun handleCommitTree(sha: String?) {
        val g = git ?: return
        if (sha.isNullOrEmpty()) return
        try {
            postToWebview(mapOf("type" to "commitTree", "sha" to sha, "paths" to g.readCommitTree(sha)))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read commit tree: ${e.message}"))
        }
    }

    private fun handleFileContent(sha: String?, path: String?) {
        val g = git ?: return
        if (sha.isNullOrEmpty() || path.isNullOrEmpty()) return
        try {
            val (text, binary, tooLarge) = g.readFileContent(sha, path)
            postToWebview(
                mapOf(
                    "type" to "fileContent", "sha" to sha, "path" to path, "text" to text,
                    "binary" to (if (binary) true else null), "tooLarge" to (if (tooLarge) true else null),
                )
            )
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read file content: ${e.message}"))
        }
    }

    private fun handleFileDiff(sha: String?, path: String?, status: String?, oldPath: String?) {
        val g = git ?: return
        if (sha.isNullOrEmpty() || path.isNullOrEmpty()) return
        try {
            postToWebview(mapOf("type" to "fileDiff", "diff" to g.readFileDiff(sha, path, status ?: "modified", oldPath)))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read file diff: ${e.message}"))
        }
    }

    private fun handleWorkingTreeChanges() {
        val g = git ?: return
        try {
            postToWebview(mapOf("type" to "workingTreeChanges", "files" to g.readWorkingTreeChanges()))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read working tree changes: ${e.message}"))
        }
    }

    private fun handleWorkingTreeFileDiff(path: String?, status: String?, oldPath: String?) {
        val g = git ?: return
        if (path.isNullOrEmpty()) return
        try {
            postToWebview(mapOf("type" to "workingTreeFileDiff", "diff" to g.readWorkingTreeFileDiff(path, status ?: "modified", oldPath)))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read working tree diff: ${e.message}"))
        }
    }

    private fun commitWorkingTreeChanges(message: String?, files: List<String>?) {
        val g = git ?: return
        try {
            val sha = g.commitWorkingTreeChanges(message, files)
            val subject = message?.trim()?.lineSequence()?.firstOrNull().orEmpty()
            postToWebview(mapOf("type" to "commitCreated", "sha" to sha, "message" to subject))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Commit failed: ${e.message}"))
        }
        refresh()
    }

    private fun handleMergePreview(source: String?) {
        val g = git ?: return
        if (source.isNullOrEmpty()) return
        try {
            postToWebview(mapOf("type" to "mergePreview", "preview" to g.computeMergePreview(source)))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to preview merge: ${e.message}"))
        }
    }

    private fun handleMergeFileDiff(source: String?, path: String?, status: String?) {
        val g = git ?: return
        if (source.isNullOrEmpty() || path.isNullOrEmpty()) return
        try {
            postToWebview(mapOf("type" to "mergeFileDiff", "diff" to g.readMergeFileDiff(source, path, status ?: "modified")))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Failed to read merge diff: ${e.message}"))
        }
    }

    private fun mergeBranch(source: String?, message: String?, noFastForward: Boolean, squash: Boolean) {
        val g = git ?: return
        if (source.isNullOrEmpty()) return
        try {
            val outcome = g.merge(source, message, noFastForward, squash)
            postToWebview(mapOf("type" to "opResult", "op" to "merge", "result" to if (outcome == GitService.OpOutcome.CONFLICT) "conflict" else "ok"))
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "opResult", "op" to "merge", "result" to "error", "detail" to e.message))
        }
        refresh()
    }

    private fun checkoutCommit(sha: String?, ref: String?) {
        val g = git ?: return
        val treeish = sha ?: ref ?: return
        try {
            g.smartCheckout(treeish, ref)
            refresh()
        } catch (e: Exception) {
            postToWebview(mapOf("type" to "error", "message" to "Checkout failed: ${e.message}"))
        }
    }

    private fun browseGitPath() {
        SwingUtilities.invokeLater {
            val chooser = JFileChooser().apply {
                dialogTitle = "Select git executable"
                fileSelectionMode = JFileChooser.FILES_ONLY
            }
            if (chooser.showOpenDialog(component) == JFileChooser.APPROVE_OPTION) {
                val path = chooser.selectedFile?.path ?: return@invokeLater
                postToWebview(mapOf("type" to "gitPathSelected", "path" to path))
            }
        }
    }

    // ------------------------------------------------------------------
    // Theme (mirrors WebViewHostPanel.themeScript; Swing UIManager colors)
    // ------------------------------------------------------------------

    private fun hex(c: Color): String = "#%02X%02X%02X".format(c.red, c.green, c.blue)

    private fun uiColor(key: String, fallback: Color): Color = UIManager.getColor(key) ?: fallback

    private fun themeScript(): String {
        val bg = hex(uiColor("Panel.background", Color(0xF2, 0xF2, 0xF2)))
        val fg = hex(uiColor("Label.foreground", Color(0x1E, 0x1E, 0x1E)))
        val border = hex(uiColor("Separator.foreground", Color(0xD3, 0xD3, 0xD3)))
        val accent = hex(uiColor("Component.focusColor", uiColor("Tree.selectionBackground", Color(0x87, 0xAF, 0xDA))))

        val vars = linkedMapOf("--bg" to bg, "--fg" to fg, "--border" to border, "--accent" to accent)
        val sb = StringBuilder("(function(){var r=document.documentElement;")
        for ((k, v) in vars) sb.append("r.style.setProperty(").append(gson.toJson(k)).append(',').append(gson.toJson(v)).append(");")
        sb.append("})();")
        return sb.toString()
    }

    // ------------------------------------------------------------------
    // Outbound messages
    // ------------------------------------------------------------------

    private fun postToWebview(message: Any) {
        val json = gson.toJson(message)
        if (!loaded) {
            synchronized(pending) { if (!loaded) { pending.add(json); return } }
        }
        Platform.runLater {
            // The JSON text is valid JS object-literal syntax, so it can be
            // embedded as-is; host-bridge.ts already listens for "message".
            try { engine?.executeScript("window.postMessage($json, '*');") } catch (e: Exception) { /* page torn down */ }
        }
    }

    fun dispose() {
        watcher?.close()
        watcher = null
        exec.shutdownNow()
    }

    companion object {
        private const val RES_PREFIX = "com/hunkontech/revgraph/webview/"
    }
}
