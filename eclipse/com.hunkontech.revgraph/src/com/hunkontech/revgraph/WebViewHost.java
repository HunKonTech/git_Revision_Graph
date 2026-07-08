package com.hunkontech.revgraph;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.eclipse.core.resources.IResourceChangeEvent;
import org.eclipse.core.resources.IResourceChangeListener;
import org.eclipse.core.resources.IResourceDelta;
import org.eclipse.core.resources.IResourceDeltaVisitor;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IPath;
import org.eclipse.swt.SWT;
import org.eclipse.swt.browser.Browser;
import org.eclipse.swt.browser.BrowserFunction;
import org.eclipse.swt.browser.ProgressAdapter;
import org.eclipse.swt.browser.ProgressEvent;
import org.eclipse.swt.dnd.Clipboard;
import org.eclipse.swt.dnd.TextTransfer;
import org.eclipse.swt.dnd.Transfer;
import org.eclipse.swt.graphics.Color;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.FileDialog;
import org.osgi.framework.Bundle;

import com.hunkontech.revgraph.git.GitService;
import com.hunkontech.revgraph.git.GitService.FileContent;
import com.hunkontech.revgraph.git.GitService.OpOutcome;
import com.hunkontech.revgraph.model.Dtos.WebviewMessage;
import com.hunkontech.revgraph.util.Json;

/**
 * Hosts the shared web renderer (packages/graph-webview) inside an SWT
 * {@link Browser} widget and bridges messages to {@link GitService}. This is
 * the Eclipse counterpart of jetbrains/.../WebViewHostPanel.kt (JCEF),
 * vs/WebViewHostControl.xaml.cs (WebView2) and vscode/src/panel.ts.
 *
 * <p>Transport parity: the JS→host channel reuses the SAME
 * {@code window.__ideHostPostMessage__} hook the JetBrains/JCEF host defines
 * (see packages/graph-webview/src/host-bridge.ts) — here it is an SWT
 * {@link BrowserFunction} rather than a JCEF query, but the webview can't tell
 * the difference. The host→webview channel pushes events via
 * {@code window.postMessage}, exactly like the WebView2 and JCEF hosts.
 */
public final class WebViewHost {

    private final Browser browser;
    private final Display display;
    private final ExecutorService worker =
            Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "revgraph-git");
                t.setDaemon(true);
                return t;
            });

    @SuppressWarnings("unused")
    private final BrowserFunction bridge;

    private GitService git;
    private String repoRoot;
    private IResourceChangeListener resourceListener;
    private Runnable pendingRefresh;

    public WebViewHost(Composite parent) {
        this.display = parent.getDisplay();
        // Prefer the modern Edge (WebView2) engine on Windows; macOS/Linux
        // default to WebKit/WebKitGTK, both of which run the bundle fine.
        if ("win32".equals(SWT.getPlatform())) {
            System.setProperty("org.eclipse.swt.browser.DefaultType", "edge");
        }
        this.browser = new Browser(parent, SWT.NONE);

        // JS→host bridge. host-bridge.ts checks
        // `typeof window.__ideHostPostMessage__ === "function"` and routes every
        // WebviewToHost message through it as a JSON string.
        this.bridge = new BrowserFunction(browser, "__ideHostPostMessage__") {
            @Override
            public Object function(Object[] arguments) {
                if (arguments != null && arguments.length > 0 && arguments[0] instanceof String) {
                    handleWebviewMessage((String) arguments[0]);
                }
                return null;
            }
        };

        browser.addProgressListener(new ProgressAdapter() {
            @Override
            public void completed(ProgressEvent event) {
                pushTheme();
            }
        });

        File index = ensureAssetsExtracted();
        if (index != null) {
            browser.setUrl(index.toURI().toString());
        } else {
            browser.setText("<p style=\"font-family:sans-serif\">Revision Graph web assets could not be loaded.</p>");
        }
    }

    public void setFocus() {
        if (!browser.isDisposed()) {
            browser.setFocus();
        }
    }

    // ------------------------------------------------------------------
    // Asset extraction (SWT Browser needs a real file:// URL, like JCEF)
    // ------------------------------------------------------------------

    /**
     * The webview bundle ships as plugin resources under {@code webview/}. SWT's
     * {@link Browser} needs a real {@code file://} URL, so on first use we
     * extract it once into the bundle's per-user state location, keyed by plugin
     * version so an update invalidates the cache instead of serving a stale
     * bundle. Mirrors WebViewHostPanel.ensureAssetsExtracted (JCEF).
     */
    private File ensureAssetsExtracted() {
        Activator plugin = Activator.getDefault();
        if (plugin == null) {
            return null;
        }
        Bundle bundle = plugin.getBundle();
        String version = bundle.getVersion().toString();
        IPath destPath = plugin.getStateLocation().append("webview").append(version);
        File destDir = destPath.toFile();
        File index = new File(destDir, "index.html");
        if (index.exists()) {
            return index;
        }

        Enumeration<URL> entries = bundle.findEntries("webview", "*", true);
        if (entries == null) {
            return null;
        }
        destDir.mkdirs();
        while (entries.hasMoreElements()) {
            URL url = entries.nextElement();
            String path = url.getPath();
            int idx = path.indexOf("webview/");
            if (idx < 0) {
                continue;
            }
            String rel = path.substring(idx + "webview/".length());
            if (rel.isEmpty() || rel.endsWith("/")) {
                continue; // directory marker
            }
            File out = new File(destDir, rel);
            File parent = out.getParentFile();
            if (parent != null) {
                parent.mkdirs();
            }
            try (InputStream in = url.openStream(); OutputStream os = new FileOutputStream(out)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) {
                    os.write(buf, 0, n);
                }
            } catch (Exception e) {
                // Skip an unreadable entry; index.html presence is checked below.
            }
        }
        return index.exists() ? index : null;
    }

    // ------------------------------------------------------------------
    // Repository binding + auto-refresh
    // ------------------------------------------------------------------

    /** Point the host at a repository; tries each candidate directory in order. */
    public void setRepository(List<String> startDirs) {
        String root = null;
        for (String dir : startDirs) {
            root = GitService.findRepoRoot(dir);
            if (root != null) {
                break;
            }
        }
        this.repoRoot = root;
        this.git = root != null ? new GitService(root) : null;
        setupWatcher();
        refreshAsync();
    }

    private void setupWatcher() {
        if (resourceListener != null) {
            ResourcesPlugin.getWorkspace().removeResourceChangeListener(resourceListener);
            resourceListener = null;
        }
        if (repoRoot == null) {
            return;
        }
        resourceListener = event -> {
            IResourceDelta delta = event.getDelta();
            if (delta != null && touchesGit(delta)) {
                scheduleRefresh();
            }
        };
        ResourcesPlugin.getWorkspace().addResourceChangeListener(resourceListener, IResourceChangeEvent.POST_CHANGE);
    }

    /**
     * True when the change set touches a {@code .git} directory — the only
     * changes that alter git history. Best-effort: it fires only when {@code
     * .git} is visible in the Eclipse resource tree; otherwise auto-refresh
     * relies on the explicit refresh after each mutating op plus the webview's
     * manual refresh button.
     */
    private boolean touchesGit(IResourceDelta delta) {
        final boolean[] hit = { false };
        try {
            delta.accept(new IResourceDeltaVisitor() {
                @Override
                public boolean visit(IResourceDelta d) {
                    if (hit[0]) {
                        return false;
                    }
                    String name = d.getResource().getName();
                    if (".git".equals(name)) {
                        hit[0] = true;
                        return false;
                    }
                    return true;
                }
            });
        } catch (Exception e) {
            return false;
        }
        return hit[0];
    }

    /** Coalesce rapid .git changes into a single refresh (500ms, like the VS host). */
    private void scheduleRefresh() {
        if (display.isDisposed()) {
            return;
        }
        display.asyncExec(() -> {
            if (display.isDisposed()) {
                return;
            }
            if (pendingRefresh != null) {
                display.timerExec(-1, pendingRefresh);
            }
            pendingRefresh = this::refreshAsync;
            display.timerExec(500, pendingRefresh);
        });
    }

    private void refreshAsync() {
        worker.submit(this::doRefresh);
    }

    private void doRefresh() {
        GitService g = git;
        if (g == null) {
            postToWebview(errorMap("No Git repository found for the current selection."));
            return;
        }
        try {
            Object data = g.readGraphData(1000);
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "setData");
            msg.put("data", data);
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to read git history: " + e.getMessage()));
        }
    }

    // ------------------------------------------------------------------
    // Inbound message dispatch (mirrors WebViewHostPanel.dispatch)
    // ------------------------------------------------------------------

    private void handleWebviewMessage(String json) {
        WebviewMessage msg = WebviewMessage.fromJson(json);
        if (msg == null) {
            return;
        }
        // BrowserFunction runs on the UI thread; git ops must not — offload.
        worker.submit(() -> dispatch(msg));
    }

    private void dispatch(WebviewMessage msg) {
        try {
            String type = msg.type;
            if (type == null) {
                return;
            }
            switch (type) {
                case "ready":
                case "requestRefresh":
                    doRefresh();
                    break;
                case "createBranch": {
                    GitService g = git;
                    if (g == null || msg.sha == null) {
                        return;
                    }
                    String name = msg.name;
                    if (name != null && !name.trim().isEmpty()) {
                        g.createBranch(name.trim(), msg.sha, msg.checkout == null || msg.checkout);
                        Map<String, Object> ev = new LinkedHashMap<>();
                        ev.put("type", "branchCreated");
                        ev.put("name", name.trim());
                        ev.put("sha", msg.sha);
                        postToWebview(ev);
                    }
                    doRefresh();
                    break;
                }
                case "deleteBranch":
                    deleteBranch(msg.name);
                    break;
                case "renameBranch":
                    // The new name is expected to arrive already resolved from a
                    // future native prompt dialog (mirrors the JetBrains host).
                    doRefresh();
                    break;
                case "renameCommit":
                    renameCommit(msg.sha);
                    break;
                case "undoCommit":
                    undoCommit(msg.sha);
                    break;
                case "stashApply":
                case "stashPop":
                case "stashDrop":
                    handleStash(type, msg.index);
                    break;
                case "checkout":
                    checkoutCommit(msg.sha, msg.ref);
                    break;
                case "copySha":
                    if (msg.sha != null) {
                        copyToClipboard(msg.sha);
                    }
                    break;
                case "requestCommitChanges":
                    handleCommitChanges(msg.sha);
                    break;
                case "requestCommitTree":
                    handleCommitTree(msg.sha);
                    break;
                case "requestFileDiff":
                    handleFileDiff(msg.sha, msg.path, msg.status, msg.oldPath);
                    break;
                case "requestFileContent":
                    handleFileContent(msg.sha, msg.path);
                    break;
                case "requestMergePreview":
                    handleMergePreview(msg.source);
                    break;
                case "requestMergeFileDiff":
                    handleMergeFileDiff(msg.source, msg.path, msg.status);
                    break;
                case "merge":
                    mergeBranch(msg.source, msg.message, msg.noFastForward != null && msg.noFastForward);
                    break;
                case "fetch":
                    runRemoteOp("Fetch", GitService::fetch);
                    break;
                case "pull":
                    runRemoteOp("Pull", GitService::pull);
                    break;
                case "push":
                    runRemoteOp("Push", GitService::push);
                    break;
                case "pushBranch":
                    if (msg.name != null) {
                        final String branch = msg.name;
                        runRemoteOp("Push \"" + branch + "\"", g -> g.pushBranch(branch));
                    }
                    break;
                case "sync":
                    runRemoteOp("Sync", GitService::sync);
                    break;
                case "setGitPath":
                    GitService.setCustomGitPath(msg.gitPath);
                    break;
                case "browseGitPath":
                    browseGitPath();
                    break;
                case "openExternal":
                    if (msg.url != null) {
                        org.eclipse.swt.program.Program.launch(msg.url);
                    }
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            postToWebview(errorMap(e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }

    private interface RemoteOp {
        void run(GitService g) throws Exception;
    }

    private void runRemoteOp(String label, RemoteOp op) {
        GitService g = git;
        if (g == null) {
            postToWebview(errorMap("No Git repository found for the current selection."));
            return;
        }
        try {
            op.run(g);
        } catch (Exception e) {
            postToWebview(errorMap(label + " failed: " + e.getMessage()));
        }
        doRefresh();
    }

    private void deleteBranch(String name) {
        GitService g = git;
        if (g == null || name == null || name.isEmpty()) {
            return;
        }
        try {
            String current = g.getCurrentBranch();
            if (current.equals(name)) {
                String target = g.resolveBranchBaseTarget(name);
                if (target.isEmpty() || target.equals(name)) {
                    postToWebview(errorMap("Cannot delete \"" + name
                            + "\": it is checked out and no other branch to switch to was found."));
                    return;
                }
                g.checkout(target);
            }
        } catch (Exception e) {
            postToWebview(errorMap("Delete branch failed: " + e.getMessage()));
            return;
        }
        try {
            g.deleteBranch(name, false);
        } catch (Exception e) {
            try {
                g.deleteBranch(name, true);
            } catch (Exception e2) {
                postToWebview(errorMap("Delete branch failed: " + e2.getMessage()));
                return;
            }
        }
        doRefresh();
    }

    private void renameCommit(String sha) {
        GitService g = git;
        if (g == null || sha == null || sha.isEmpty()) {
            return;
        }
        if (g.isCommitPushed(sha)) {
            postToWebview(errorMap("This commit has already been pushed, so its message can't be rewritten safely."));
            return;
        }
        // The new message is collected by a native prompt dialog (follow-up UI
        // work, mirroring the JetBrains host); rewordCommit is wired and ready.
        doRefresh();
    }

    private void undoCommit(String sha) {
        GitService g = git;
        if (g == null || sha == null || sha.isEmpty()) {
            return;
        }
        if (g.isCommitPushed(sha)) {
            postToWebview(opResult("undo", "error", null));
            return;
        }
        try {
            g.undoCommit(sha);
            postToWebview(opResult("undo", "ok", null));
        } catch (Exception e) {
            postToWebview(opResult("undo", "error", e.getMessage()));
        }
        doRefresh();
    }

    private void handleStash(String op, Integer index) {
        GitService g = git;
        if (g == null || index == null) {
            return;
        }
        try {
            String result;
            if ("stashApply".equals(op)) {
                result = g.stashApply(index) == OpOutcome.CONFLICT ? "conflict" : "ok";
            } else if ("stashPop".equals(op)) {
                result = g.stashPop(index) == OpOutcome.CONFLICT ? "conflict" : "ok";
            } else {
                g.stashDrop(index);
                result = "ok";
            }
            postToWebview(opResult(op, result, null));
        } catch (Exception e) {
            postToWebview(opResult(op, "error", e.getMessage()));
        }
        doRefresh();
    }

    private void handleCommitChanges(String sha) {
        GitService g = git;
        if (g == null || sha == null || sha.isEmpty()) {
            return;
        }
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "commitChanges");
            msg.put("sha", sha);
            msg.put("files", g.readCommitChanges(sha));
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to read commit changes: " + e.getMessage()));
        }
    }

    private void handleCommitTree(String sha) {
        GitService g = git;
        if (g == null || sha == null || sha.isEmpty()) {
            return;
        }
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "commitTree");
            msg.put("sha", sha);
            msg.put("paths", g.readCommitTree(sha));
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to read commit tree: " + e.getMessage()));
        }
    }

    private void handleFileContent(String sha, String path) {
        GitService g = git;
        if (g == null || sha == null || sha.isEmpty() || path == null || path.isEmpty()) {
            return;
        }
        try {
            FileContent fc = g.readFileContent(sha, path);
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "fileContent");
            msg.put("sha", sha);
            msg.put("path", path);
            msg.put("text", fc.text);
            msg.put("binary", fc.binary ? Boolean.TRUE : null);
            msg.put("tooLarge", fc.tooLarge ? Boolean.TRUE : null);
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to read file content: " + e.getMessage()));
        }
    }

    private void handleFileDiff(String sha, String path, String status, String oldPath) {
        GitService g = git;
        if (g == null || sha == null || sha.isEmpty() || path == null || path.isEmpty()) {
            return;
        }
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "fileDiff");
            msg.put("diff", g.readFileDiff(sha, path, status != null ? status : "modified", oldPath));
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to read file diff: " + e.getMessage()));
        }
    }

    private void handleMergePreview(String source) {
        GitService g = git;
        if (g == null || source == null || source.isEmpty()) {
            return;
        }
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "mergePreview");
            msg.put("preview", g.computeMergePreview(source));
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to preview merge: " + e.getMessage()));
        }
    }

    private void handleMergeFileDiff(String source, String path, String status) {
        GitService g = git;
        if (g == null || source == null || source.isEmpty() || path == null || path.isEmpty()) {
            return;
        }
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "mergeFileDiff");
            msg.put("diff", g.readMergeFileDiff(source, path, status != null ? status : "modified"));
            postToWebview(msg);
        } catch (Exception e) {
            postToWebview(errorMap("Failed to read merge diff: " + e.getMessage()));
        }
    }

    private void mergeBranch(String source, String message, boolean noFastForward) {
        GitService g = git;
        if (g == null || source == null || source.isEmpty()) {
            return;
        }
        try {
            OpOutcome outcome = g.merge(source, message, noFastForward);
            postToWebview(opResult("merge", outcome == OpOutcome.CONFLICT ? "conflict" : "ok", null));
        } catch (Exception e) {
            postToWebview(opResult("merge", "error", e.getMessage()));
        }
        doRefresh();
    }

    private void checkoutCommit(String sha, String ref) {
        GitService g = git;
        String treeish = sha != null ? sha : ref;
        if (g == null || treeish == null) {
            return;
        }
        try {
            g.smartCheckout(treeish, ref);
            doRefresh();
        } catch (Exception e) {
            postToWebview(errorMap("Checkout failed: " + e.getMessage()));
        }
    }

    // ------------------------------------------------------------------
    // UI-thread helpers (clipboard, file picker, theme)
    // ------------------------------------------------------------------

    private void copyToClipboard(String text) {
        if (display.isDisposed()) {
            return;
        }
        display.asyncExec(() -> {
            if (display.isDisposed()) {
                return;
            }
            Clipboard clipboard = new Clipboard(display);
            try {
                clipboard.setContents(new Object[] { text }, new Transfer[] { TextTransfer.getInstance() });
            } finally {
                clipboard.dispose();
            }
        });
    }

    private void browseGitPath() {
        if (display.isDisposed()) {
            return;
        }
        display.asyncExec(() -> {
            if (browser.isDisposed()) {
                return;
            }
            FileDialog dialog = new FileDialog(browser.getShell(), SWT.OPEN);
            dialog.setText("Select git executable");
            String chosen = dialog.open();
            if (chosen != null) {
                Map<String, Object> msg = new LinkedHashMap<>();
                msg.put("type", "gitPathSelected");
                msg.put("path", chosen);
                postToWebview(msg);
            }
        });
    }

    private void pushTheme() {
        if (browser.isDisposed()) {
            return;
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("--bg", hex(display.getSystemColor(SWT.COLOR_LIST_BACKGROUND)));
        vars.put("--fg", hex(display.getSystemColor(SWT.COLOR_LIST_FOREGROUND)));
        vars.put("--border", hex(display.getSystemColor(SWT.COLOR_WIDGET_NORMAL_SHADOW)));
        vars.put("--accent", hex(display.getSystemColor(SWT.COLOR_LIST_SELECTION)));

        StringBuilder sb = new StringBuilder("(function(){var r=document.documentElement;");
        for (Map.Entry<String, String> e : vars.entrySet()) {
            sb.append("r.style.setProperty(")
                    .append(Json.stringify(e.getKey())).append(',')
                    .append(Json.stringify(e.getValue())).append(");");
        }
        sb.append("})();");
        browser.execute(sb.toString());
    }

    private static String hex(Color c) {
        return String.format("#%02X%02X%02X", c.getRed(), c.getGreen(), c.getBlue());
    }

    // ------------------------------------------------------------------
    // Outbound messages (host → webview)
    // ------------------------------------------------------------------

    /**
     * Push a message to the page. SWT's Browser, like JCEF, has no native
     * post-to-page channel, so we execute {@code window.postMessage} directly —
     * host-bridge.ts already listens for the "message" event. The serialized
     * JSON is valid JS object-literal syntax, so it embeds as-is.
     */
    private void postToWebview(Object message) {
        final String json = Json.stringify(message);
        if (display.isDisposed()) {
            return;
        }
        display.asyncExec(() -> {
            if (browser.isDisposed()) {
                return;
            }
            browser.execute("window.postMessage(" + json + ", '*');");
        });
    }

    private static Map<String, Object> errorMap(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", "error");
        m.put("message", message);
        return m;
    }

    private static Map<String, Object> opResult(String op, String result, String detail) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", "opResult");
        m.put("op", op);
        m.put("result", result);
        if (detail != null) {
            m.put("detail", detail);
        }
        return m;
    }

    // ------------------------------------------------------------------

    public void dispose() {
        if (resourceListener != null) {
            ResourcesPlugin.getWorkspace().removeResourceChangeListener(resourceListener);
            resourceListener = null;
        }
        worker.shutdownNow();
        if (!browser.isDisposed()) {
            browser.dispose();
        }
    }
}
