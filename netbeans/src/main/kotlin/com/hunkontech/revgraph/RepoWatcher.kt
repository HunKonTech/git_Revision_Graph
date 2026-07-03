package com.hunkontech.revgraph

import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Lightweight `.git` change watcher. NetBeans has no direct equivalent of the
 * IntelliJ VFS message bus the JetBrains host subscribes to, so this polls a
 * handful of key `.git` entries on a daemon thread and fires [onChange] when
 * their combined signature changes, debounced ~500 ms (matching the VS host's
 * debounce and WebViewHostPanel.scheduleRefresh).
 *
 * Deliberately modest: it watches HEAD, index, packed-refs, the logs, and the
 * refs/heads + refs/remotes trees — enough to catch commits, checkouts, and
 * branch create/delete. Local actions triggered from the graph refresh
 * themselves anyway (see the handlers in NetBeansWebViewHost), so this exists
 * mainly to reflect *external* git changes.
 */
class RepoWatcher(repoRoot: String, private val onChange: () -> Unit) {

    private val gitDir = File(repoRoot, ".git")
    private val running = AtomicBoolean(false)
    private var thread: Thread? = null

    fun start() {
        if (!gitDir.isDirectory) return // worktrees/submodules use a .git *file*; skip.
        if (!running.compareAndSet(false, true)) return
        thread = Thread({ loop() }, "revgraph-repo-watch").apply {
            isDaemon = true
            start()
        }
    }

    private fun loop() {
        var last = signature()
        while (running.get()) {
            try {
                Thread.sleep(POLL_MS)
            } catch (e: InterruptedException) {
                return
            }
            val now = signature()
            if (now != last) {
                last = now
                // Coalesce a burst (e.g. a multi-step rebase) into one refresh.
                try { Thread.sleep(DEBOUNCE_MS) } catch (e: InterruptedException) { return }
                last = signature()
                try { onChange() } catch (e: Exception) { /* ignore, keep watching */ }
            }
        }
    }

    /** A cheap fingerprint of the watched entries' last-modified times + sizes. */
    private fun signature(): Long {
        var sig = 0L
        for (name in TOP_FILES) sig = mix(sig, File(gitDir, name))
        sig = mixTree(sig, File(gitDir, "refs/heads"))
        sig = mixTree(sig, File(gitDir, "refs/remotes"))
        sig = mixTree(sig, File(gitDir, "logs"))
        return sig
    }

    private fun mix(acc: Long, f: File): Long {
        if (!f.exists()) return acc * 31 + 1
        return acc * 31 + f.lastModified() + f.length() * 7
    }

    private fun mixTree(acc: Long, dir: File): Long {
        if (!dir.isDirectory) return acc * 31 + 2
        var sig = acc
        val files = dir.walkTopDown().maxDepth(6)
        for (f in files) if (f.isFile) sig = mix(sig, f)
        return sig
    }

    fun close() {
        running.set(false)
        thread?.interrupt()
        thread = null
    }

    companion object {
        private const val POLL_MS = 700L
        private const val DEBOUNCE_MS = 400L
        private val TOP_FILES = listOf("HEAD", "index", "packed-refs", "MERGE_HEAD", "ORIG_HEAD")
    }
}
