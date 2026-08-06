package com.hunkontech.revgraph.git

import com.hunkontech.revgraph.model.*
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.regex.Pattern

/**
 * Reads git history and performs branch/commit operations via the git CLI.
 * Mirrors vscode/src/gitData.ts and vs/Git/GitService.cs so all hosts feed the
 * same shape to the shared web renderer. Shared by all JetBrains flavors
 * (DevEco Studio, IntelliJ IDEA, Android Studio) — it is IDE-agnostic (pure git
 * CLI + Gson).
 *
 * Reword/undo of a non-HEAD commit are implemented with pure git plumbing
 * (`commit-tree` + `update-ref`) instead of the VS host's PowerShell-scripted
 * `rebase -i`, since these plugins run on Windows/macOS/Linux alike. See
 * [rewordCommit] / [undoCommit] for details.
 */
class GitService(private val repoRoot: String) {

    companion object {
        private const val FS = '\u001f' // field separator (ASCII unit separator)
        private const val RS = '\u001e' // record separator (ASCII record separator)
        private const val NUL = '\u0000'
        private const val MAX_DIFF_BYTES = 2L * 1024 * 1024

        @Volatile
        private var customGitExe: String? = null

        /** Override the git binary for all operations; null reverts to "git" on PATH. */
        fun setCustomGitPath(path: String?) {
            customGitExe = path?.trim()?.takeIf { it.isNotEmpty() }
        }

        private val gitExe: String
            get() = customGitExe ?: "git"

        /** Find the repository root containing [startDir], or null if not inside a work tree. */
        fun findRepoRoot(startDir: String?): String? {
            if (startDir.isNullOrEmpty() || !File(startDir).isDirectory) return null
            return try {
                val top = runCapture(startDir, listOf("rev-parse", "--show-toplevel")).stdout.trim()
                if (top.isEmpty()) null else top.replace('/', File.separatorChar)
            } catch (e: Exception) {
                null
            }
        }

        private class GitCapture(val exitCode: Int, val stdout: String, val stderr: String)

        private fun runCapture(
            cwd: String,
            args: List<String>,
            env: Map<String, String>? = null,
        ): GitCapture {
            val cmd = mutableListOf(gitExe)
            cmd.addAll(args)
            val pb = ProcessBuilder(cmd)
            pb.directory(File(cwd))
            if (env != null) pb.environment().putAll(env)
            val proc = pb.start()
            val stdout = proc.inputStream.readBytes().toString(StandardCharsets.UTF_8)
            val stderr = proc.errorStream.readBytes().toString(StandardCharsets.UTF_8)
            val exit = proc.waitFor()
            return GitCapture(exit, stdout, stderr)
        }

        /** Run git, returning stdout; throws on non-zero exit. */
        private fun run(cwd: String, args: List<String>, env: Map<String, String>? = null): String {
            val cap = runCapture(cwd, args, env)
            if (cap.exitCode != 0) {
                throw RuntimeException("git ${args.joinToString(" ")} failed: ${cap.stderr}")
            }
            return cap.stdout
        }

        private fun runSafe(cwd: String, args: List<String>): String =
            try { run(cwd, args) } catch (e: Exception) { "" }
    }

    private fun run(args: List<String>, env: Map<String, String>? = null) = run(repoRoot, args, env)
    private fun tryRun(vararg args: String): String =
        try { run(repoRoot, args.toList()) } catch (e: Exception) { "" }
    private fun capture(vararg args: String) = runCapture(repoRoot, args.toList())

    private fun splitLines(text: String): List<String> =
        text.split('\n').map { it.trim() }.filter { it.isNotEmpty() }

    // ------------------------------------------------------------------
    // Graph data
    // ------------------------------------------------------------------

    fun readGraphData(maxCommits: Int): GraphData {
        val logOut = run(
            listOf(
                "log", "--exclude=refs/stash", "--all", "--topo-order", "--max-count=$maxCommits",
                "--pretty=format:%H$FS%P$FS%s$FS%an$FS%ae$FS%aI$RS",
            )
        )
        val refsOut = run(
            listOf(
                "for-each-ref",
                "--format=%(refname)$FS%(objectname)$FS%(*objectname)$FS%(HEAD)",
                "refs/heads", "refs/remotes", "refs/tags",
            )
        )
        val head = runSafe(repoRoot, listOf("rev-parse", "HEAD")).trim()
        val stashes = readStashes()

        val data = GraphData()
        data.commits = parseCommits(logOut)
        data.refs = parseRefs(refsOut)
        data.head = head.ifEmpty { null }
        data.repoName = File(repoRoot).name
        data.stashes = stashes
        data.gitCommand = "git log --exclude=refs/stash --all --topo-order --max-count=$maxCommits"
        return data
    }

    /** Read the stash stack, each entry tied to the commit it came from. */
    fun readStashes(): List<StashEntry> {
        val out = tryRun("stash", "list", "--format=%gd$FS%H$FS%P$FS%gs$FS%cI")
        val stashPattern = Pattern.compile("""stash@\{(\d+)\}""")
        val result = mutableListOf<StashEntry>()
        for (raw in out.split('\n')) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            val f = line.split(FS)
            if (f.size < 2 || f[1].isEmpty()) continue
            val gd = f[0]
            val sha = f[1]
            val parents = if (f.size > 2) f[2] else ""
            val message = if (f.size > 3) f[3] else ""
            val date = if (f.size > 4) f[4] else ""
            val m = stashPattern.matcher(gd)
            val index = if (m.find()) m.group(1).toInt() else result.size
            val baseSha = parents.split(' ').firstOrNull { it.isNotEmpty() } ?: ""
            result.add(StashEntry(index, sha, message, baseSha, date))
        }
        return result
    }

    private fun parseCommits(output: String): List<GitCommit> {
        val commits = mutableListOf<GitCommit>()
        for (rec in output.split(RS)) {
            val line = rec.trimStart('\n', '\r')
            if (line.isBlank()) continue
            val f = line.split(FS)
            if (f.size < 6 || f[0].isEmpty()) continue
            commits.add(
                GitCommit(
                    sha = f[0],
                    parents = f[1].split(' ').filter { it.isNotEmpty() },
                    summary = f[2],
                    author = f[3],
                    authorEmail = f[4],
                    date = f[5],
                )
            )
        }
        return commits
    }

    private fun parseRefs(output: String): List<GitRef> {
        val refs = mutableListOf<GitRef>()
        for (raw in output.split('\n')) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            val f = line.split(FS)
            if (f.size < 2 || f[0].isEmpty() || f[1].isEmpty()) continue
            val refname = f[0]
            val objectname = f[1]
            val deref = if (f.size > 2) f[2] else ""
            val headMark = if (f.size > 3) f[3] else ""
            val targetSha = deref.ifEmpty { objectname }
            val isCurrent = headMark == "*"

            when {
                refname.startsWith("refs/heads/") -> refs.add(
                    GitRef(refname.removePrefix("refs/heads/"), "localBranch", targetSha, isCurrent = isCurrent)
                )
                refname.startsWith("refs/remotes/") -> {
                    val shortName = refname.removePrefix("refs/remotes/")
                    if (shortName.endsWith("/HEAD")) continue
                    refs.add(GitRef(shortName, "remoteBranch", targetSha, remote = shortName.substringBefore('/')))
                }
                refname.startsWith("refs/tags/") -> refs.add(
                    GitRef(refname.removePrefix("refs/tags/"), "tag", targetSha)
                )
            }
        }
        return refs
    }

    // ------------------------------------------------------------------
    // Branches
    // ------------------------------------------------------------------

    fun createBranch(name: String, sha: String, checkout: Boolean) {
        if (checkout) run(listOf("checkout", "-b", name, sha)) else run(listOf("branch", name, sha))
    }

    fun deleteBranch(name: String, force: Boolean) {
        run(listOf("branch", if (force) "-D" else "-d", name))
    }

    fun getCurrentBranch(): String =
        runSafe(repoRoot, listOf("symbolic-ref", "--quiet", "--short", "HEAD")).trim()

    private fun localBranchExists(name: String): Boolean =
        try { run(listOf("show-ref", "--verify", "--quiet", "refs/heads/$name")); true }
        catch (e: Exception) { false }

    /**
     * The repo's main branch name — the remote's default (origin/HEAD) if a
     * matching local branch exists, else local main, else local master.
     * Empty when none found. Mirrors resolveMainBranchCli in gitData.ts.
     */
    fun resolveMainBranch(): String {
        val sym = tryRun("symbolic-ref", "--short", "refs/remotes/origin/HEAD").trim()
        if (sym.isNotEmpty()) {
            val localName = sym.substringAfter('/', sym)
            if (localName.isNotEmpty() && localBranchExists(localName)) return localName
        }
        for (cand in listOf("main", "master")) {
            if (localBranchExists(cand)) return cand
        }
        return ""
    }

    /**
     * Where HEAD should land when the currently checked-out branch is about
     * to be deleted. Mirrors ResolveBranchBaseTargetAsync in vs/Git/GitService.cs.
     */
    fun resolveBranchBaseTarget(branch: String): String {
        val main = resolveMainBranch()
        val others = splitLines(tryRun("for-each-ref", "--format=%(refname:short)", "refs/heads"))
            .filter { it != branch }

        val revListArgs = mutableListOf("rev-list", branch)
        others.forEach { revListArgs.add("^$it") }
        val unique = splitLines(tryRun(*revListArgs.toTypedArray()))

        val forkSha = if (unique.isEmpty()) {
            tryRun("rev-parse", branch).trim()
        } else {
            tryRun("rev-parse", "${unique.last()}^").trim()
        }

        if (forkSha.isNotEmpty()) {
            val candidates = splitLines(
                tryRun("branch", "--contains", forkSha, "--format=%(refname:short)")
            ).filter { it != branch }
            if (main.isNotEmpty() && candidates.contains(main)) return main
            if (candidates.isNotEmpty()) return candidates[0]
        }

        if (main.isNotEmpty() && main != branch) return main
        return forkSha
    }

    /** Whether a commit is reachable from any remote branch — i.e. already pushed. */
    fun isCommitPushed(sha: String): Boolean {
        val out = tryRun("branch", "-r", "--contains", sha)
        return splitLines(out).any { !it.endsWith("/HEAD") }
    }

    fun getHeadSha(): String = runSafe(repoRoot, listOf("rev-parse", "HEAD")).trim()

    fun getCommitSummary(sha: String): String =
        runSafe(repoRoot, listOf("show", "-s", "--format=%s", sha)).trim()

    private fun isHeadCommit(sha: String): Boolean {
        val head = getHeadSha()
        return head.isNotEmpty() && (head == sha || head.startsWith(sha) || sha.startsWith(head))
    }

    private fun hasUncommittedChanges(): Boolean =
        tryRun("status", "--porcelain").isNotBlank()

    /**
     * Reword a local commit's message. HEAD uses a plain `--amend`. An older
     * commit is rewritten via pure git plumbing (no interactive rebase, no
     * external editor script — see the class doc): walk the child chain from
     * the target to HEAD and rebuild each commit with `commit-tree`, using
     * the new message only for the target, then move the branch ref.
     * Requires a clean working tree (mirrors the C# host's staged-changes
     * check, extended to unstaged too, since there is no --autostash here).
     */
    fun rewordCommit(sha: String, message: String) {
        if (isHeadCommit(sha)) {
            run(listOf("commit", "--amend", "-m", message))
            return
        }
        if (hasUncommittedChanges()) {
            throw RuntimeException(
                "There are uncommitted changes; commit or stash them before rewording an older commit."
            )
        }
        rebuildDescendants(sha, dropTarget = false, newMessage = message)
    }

    /**
     * Undo a local commit. HEAD uses `git reset --mixed HEAD~1` (changes
     * reappear unstaged). An older commit is dropped via the same plumbing
     * walk as [rewordCommit], simply omitting a replacement for the target.
     * Requires a clean working tree; unlike the VS host's rebase-based
     * version this can't leave a conflicted rebase in progress, so the
     * result is always Ok or a thrown error — never Conflict.
     */
    fun undoCommit(sha: String): OpOutcome {
        if (isHeadCommit(sha)) {
            run(listOf("reset", "--mixed", "HEAD~1"))
            return OpOutcome.OK
        }
        if (hasUncommittedChanges()) {
            throw RuntimeException(
                "There are uncommitted changes; commit or stash them before undoing an older commit."
            )
        }
        rebuildDescendants(sha, dropTarget = true, newMessage = null)
        return OpOutcome.OK
    }

    /**
     * Shared plumbing walk for [rewordCommit] and [undoCommit]: replays the
     * commits after [targetSha] (inclusive) on the current branch tip,
     * either giving the target a new message or omitting it entirely, using
     * `git commit-tree` so no working-tree checkout ever happens (hence no
     * conflicts are possible). Finishes with `update-ref` + a hard sync of
     * the working tree to match (safe: the working tree was required clean).
     */
    private fun rebuildDescendants(targetSha: String, dropTarget: Boolean, newMessage: String?) {
        val branch = getCurrentBranch()
        if (branch.isEmpty()) throw RuntimeException("HEAD is detached; check out a branch first.")

        val targetFull = tryRun("rev-parse", targetSha).trim()
        if (targetFull.isEmpty()) throw RuntimeException("Commit $targetSha not found.")

        val chain = splitLines(tryRun("rev-list", "--reverse", "$targetFull..HEAD"))
        val targetParent = tryRun("rev-parse", "$targetFull^").trim()

        var newParent = targetParent
        if (!dropTarget) {
            val tree = tryRun("show", "-s", "--format=%T", targetFull).trim()
            newParent = run(
                listOf("commit-tree", tree, "-p", targetParent, "-m", newMessage ?: "")
            ).trim()
        }

        for (childSha in chain) {
            val tree = tryRun("show", "-s", "--format=%T", childSha).trim()
            val origMessage = run(listOf("show", "-s", "--format=%B", childSha))
            newParent = run(
                listOf("commit-tree", tree, "-p", newParent, "-m", origMessage.trimEnd('\n'))
            ).trim()
        }

        run(listOf("update-ref", "refs/heads/$branch", newParent))
        run(listOf("reset", "--hard", newParent))
    }

    // ------------------------------------------------------------------
    // Stash
    // ------------------------------------------------------------------

    private fun hasUnmergedPaths(): Boolean = tryRun("ls-files", "-u").isNotBlank()

    fun stashApply(index: Int): OpOutcome = try {
        run(listOf("stash", "apply", "stash@{$index}"))
        OpOutcome.OK
    } catch (e: Exception) {
        if (hasUnmergedPaths()) OpOutcome.CONFLICT else throw e
    }

    fun stashPop(index: Int): OpOutcome = try {
        run(listOf("stash", "pop", "stash@{$index}"))
        OpOutcome.OK
    } catch (e: Exception) {
        if (hasUnmergedPaths()) OpOutcome.CONFLICT else throw e
    }

    fun stashDrop(index: Int) {
        run(listOf("stash", "drop", "stash@{$index}"))
    }

    // ------------------------------------------------------------------
    // Commit changes / file content / diff
    // ------------------------------------------------------------------

    private fun mapStatus(code: String): String = when (code.firstOrNull()) {
        'A' -> "added"
        'D' -> "deleted"
        'R', 'C' -> "renamed"
        else -> "modified"
    }

    /** Files a commit changed vs its first parent. Mirrors readCommitChanges in gitData.ts. */
    fun readCommitChanges(sha: String): List<CommitChangeFile> {
        val out = tryRun("show", "--first-parent", "-M", "-C", "--name-status", "--format=", "-z", sha)
        val files = mutableListOf<CommitChangeFile>()
        val parts = out.split(NUL)
        var i = 0
        while (i < parts.size) {
            val code = parts.getOrNull(i++)?.trim()
            if (code.isNullOrEmpty()) continue
            val status = mapStatus(code)
            if (status == "renamed") {
                val oldPath = parts.getOrNull(i++)
                val newPath = parts.getOrNull(i++)
                if (!newPath.isNullOrEmpty()) {
                    files.add(CommitChangeFile(newPath, oldPath?.ifEmpty { null }, status))
                }
            } else {
                val path = parts.getOrNull(i++)
                if (!path.isNullOrEmpty()) files.add(CommitChangeFile(path, status = status))
            }
        }
        return files
    }

    /** All file paths present in a commit's tree. Mirrors readCommitTree in gitData.ts. */
    fun readCommitTree(sha: String): List<String> =
        splitLines(tryRun("ls-tree", "-r", "--name-only", sha))

    private fun blobSize(rev: String, path: String): Long =
        tryRun("cat-file", "-s", "$rev:$path").trim().toLongOrNull() ?: -1

    private fun blobText(rev: String, path: String): String = tryRun("show", "$rev:$path")

    /** Raw content of one file at a commit. Mirrors readFileContent in gitData.ts. */
    fun readFileContent(sha: String, path: String): Triple<String, Boolean, Boolean> {
        val size = blobSize(sha, path)
        if (size > MAX_DIFF_BYTES) return Triple("", false, true)
        val text = blobText(sha, path)
        if (text.contains(NUL)) return Triple("", true, false)
        return Triple(text, false, false)
    }

    /** Before/after text of one changed file. Mirrors readFileDiff in gitData.ts. */
    fun readFileDiff(sha: String, path: String, status: String, oldPath: String?): FileDiff {
        val diff = FileDiff(sha, path, status)
        val parent = "$sha^"
        val beforePath = oldPath?.ifEmpty { null } ?: path
        val needOld = status != "added"
        val needNew = status != "deleted"

        val oldSize = if (needOld) blobSize(parent, beforePath) else 0
        val newSize = if (needNew) blobSize(sha, path) else 0
        if (oldSize > MAX_DIFF_BYTES || newSize > MAX_DIFF_BYTES) {
            diff.tooLarge = true
            return diff
        }

        val oldText = if (needOld) blobText(parent, beforePath) else ""
        val newText = if (needNew) blobText(sha, path) else ""
        if (oldText.contains(NUL) || newText.contains(NUL)) {
            diff.binary = true
            return diff
        }
        diff.oldText = oldText
        diff.newText = newText
        return diff
    }

    /** Current working-tree files available for a local commit. */
    fun readWorkingTreeChanges(): List<WorkingTreeFile> {
        val out = tryRun("status", "--porcelain=v1", "-z")
        val files = mutableListOf<WorkingTreeFile>()
        val parts = out.split(NUL)
        var i = 0
        while (i < parts.size) {
            val rec = parts.getOrNull(i++) ?: continue
            if (rec.length < 4) continue
            val x = rec[0]
            val y = rec[1]
            val path = rec.substring(3)
            if (path.isEmpty()) continue
            var oldPath: String? = null
            if (x == 'R' || x == 'C') oldPath = parts.getOrNull(i++)?.ifEmpty { null }
            files.add(WorkingTreeFile(path, oldPath, mapWorkingTreeStatus(x, y), (x != ' ' && x != '?').takeIf { it }))
        }
        return files.sortedBy { it.path.lowercase() }
    }

    private fun mapWorkingTreeStatus(x: Char, y: Char): String = when {
        x == 'R' || y == 'R' || x == 'C' || y == 'C' -> "renamed"
        x == 'D' || y == 'D' -> "deleted"
        x == 'A' || y == 'A' || x == '?' || y == '?' -> "added"
        else -> "modified"
    }

    private fun fileSize(path: String): Long = try {
        val f = File(path)
        if (f.isFile) f.length() else -1
    } catch (e: Exception) {
        -1
    }

    private fun fileText(path: String): String = try {
        File(path).readText(StandardCharsets.UTF_8)
    } catch (e: Exception) {
        ""
    }

    /** Before/after text of one working-tree file, comparing HEAD to disk. */
    fun readWorkingTreeFileDiff(path: String, status: String, oldPath: String?): FileDiff {
        val diff = FileDiff("", path, status)
        val beforePath = oldPath?.ifEmpty { null } ?: path
        val abs = File(repoRoot, path.replace('/', File.separatorChar)).path
        val needOld = status != "added"
        val needNew = status != "deleted"
        val oldSize = if (needOld) blobSize("HEAD", beforePath) else 0
        val newSize = if (needNew) fileSize(abs) else 0
        if (oldSize > MAX_DIFF_BYTES || newSize > MAX_DIFF_BYTES) {
            diff.tooLarge = true
            return diff
        }
        val oldText = if (needOld) blobText("HEAD", beforePath) else ""
        val newText = if (needNew) fileText(abs) else ""
        if (oldText.contains(NUL) || newText.contains(NUL)) {
            diff.binary = true
            return diff
        }
        diff.oldText = oldText
        diff.newText = newText
        return diff
    }

    /** Create a local commit from exactly the selected working-tree paths. */
    fun commitWorkingTreeChanges(message: String?, selectedPaths: List<String>?): String {
        val msg = message?.trim().orEmpty()
        if (msg.isEmpty()) throw RuntimeException("Commit message is required.")
        if (selectedPaths.isNullOrEmpty()) throw RuntimeException("Select at least one file to commit.")
        val selected = selectedPaths.toHashSet()
        val pathspecs = linkedSetOf<String>()
        for (f in readWorkingTreeChanges()) {
            if (!selected.contains(f.path)) continue
            pathspecs.add(f.path)
            if (!f.oldPath.isNullOrEmpty()) pathspecs.add(f.oldPath)
        }
        if (pathspecs.isEmpty()) throw RuntimeException("None of the selected files still have changes.")
        val existing = pathspecs.filter { File(repoRoot, it.replace('/', File.separatorChar)).isFile }
        if (existing.isNotEmpty()) {
            try { run(listOf("add", "-N", "--") + existing) } catch (e: Exception) { /* best effort */ }
        }
        run(listOf("commit", "-m", msg, "--only", "--") + pathspecs.toList())
        return run(listOf("rev-parse", "HEAD")).trim()
    }

    // ------------------------------------------------------------------
    // Checkout
    // ------------------------------------------------------------------

    fun checkout(treeish: String) = run(listOf("checkout", treeish))

    /**
     * Checkout a commit, preferring a branch over a detached HEAD. Mirrors
     * resolveCheckoutTarget/checkoutTrackingCli in vscode/src/gitData.ts.
     */
    fun smartCheckout(sha: String, preferredRef: String? = null) {
        if (!preferredRef.isNullOrEmpty()) {
            val localHit = tryRun("branch", "--list", preferredRef)
            if (localHit.isNotBlank()) {
                checkout(preferredRef)
                return
            }
            val remoteHit = tryRun("branch", "-r", "--list", preferredRef)
            if (remoteHit.isNotBlank()) {
                val slash = preferredRef.indexOf('/')
                if (slash in 0 until preferredRef.length - 1) {
                    val localName = preferredRef.substring(slash + 1)
                    try {
                        run(listOf("checkout", "-b", localName, "--track", preferredRef))
                    } catch (e: Exception) {
                        checkout(localName)
                    }
                    return
                }
            }
        }

        val locals = splitLines(tryRun("branch", "--points-at", sha, "--format=%(refname:short)"))
        if (locals.isNotEmpty()) {
            checkout(locals[0])
            return
        }

        val remotes = splitLines(tryRun("branch", "-r", "--points-at", sha, "--format=%(refname:lstrip=2)"))
        for (remoteRef in remotes) {
            if (remoteRef.endsWith("/HEAD")) continue
            val slash = remoteRef.indexOf('/')
            if (slash < 0 || slash == remoteRef.length - 1) continue
            val localName = remoteRef.substring(slash + 1)
            try {
                run(listOf("checkout", "-b", localName, "--track", remoteRef))
            } catch (e: Exception) {
                checkout(localName)
            }
            return
        }

        checkout(sha)
    }

    // ------------------------------------------------------------------
    // Remote ops
    // ------------------------------------------------------------------

    fun fetch() = run(listOf("fetch", "--all", "--prune"))
    fun pull() = run(listOf("pull"))
    fun push() = run(listOf("push"))
    fun pushBranch(branchName: String) = run(listOf("push", "--set-upstream", "origin", branchName))
    fun renameBranch(oldName: String, newName: String) = run(listOf("branch", "-m", oldName, newName))
    fun sync() { pull(); push() }

    // ------------------------------------------------------------------
    // Merge
    // ------------------------------------------------------------------

    private fun isAncestor(a: String, b: String): Boolean = capture("merge-base", "--is-ancestor", a, b).exitCode == 0

    private fun mapMergeStatus(code: String): String = when (code.firstOrNull()) {
        'A' -> "added"
        'D' -> "deleted"
        else -> "modified"
    }

    private fun parseNameStatusZ(out: String): MutableList<MergePreviewFile> {
        val files = mutableListOf<MergePreviewFile>()
        val parts = out.split(NUL)
        var i = 0
        while (i < parts.size) {
            val code = parts.getOrNull(i++)?.trim()
            if (code.isNullOrEmpty()) continue
            val path = parts.getOrNull(i++)
            if (!path.isNullOrEmpty()) files.add(MergePreviewFile(path, mapMergeStatus(code)))
        }
        return files
    }

    /**
     * Dry-run preview of merging [source] into the current branch via
     * `git merge-tree --write-tree`. Mirrors computeMergePreview in gitData.ts.
     */
    fun computeMergePreview(source: String): MergePreview {
        var target = getCurrentBranch()
        if (target.isEmpty()) target = "HEAD"
        val preview = MergePreview(source, target)
        preview.defaultMessage = "Merge branch '$source'" + if (target != "HEAD") " into $target" else ""
        preview.defaultSquashMessage = "Squashed changes from '$source'"

        val headTip = runSafe(repoRoot, listOf("rev-parse", "HEAD")).trim()
        val sourceTip = runSafe(repoRoot, listOf("rev-parse", source)).trim()
        if (headTip.isEmpty()) { preview.error = "No commit is checked out."; return preview }
        if (sourceTip.isEmpty()) { preview.error = "Branch \"$source\" was not found."; return preview }

        if (isAncestor(sourceTip, headTip)) {
            preview.upToDate = true
            return preview
        }
        preview.canFastForward = isAncestor(headTip, sourceTip)

        val mt = capture("merge-tree", "--write-tree", "--name-only", headTip, sourceTip)
        val mtLines = mt.stdout.replace("\r", "").split('\n')
        val resultTree = mtLines.firstOrNull()?.trim() ?: ""
        val looksLikeOid = Regex("^[0-9a-f]{7,64}$").matches(resultTree)

        if ((mt.exitCode == 0 || mt.exitCode == 1) && looksLikeOid) {
            val conflicts = mutableListOf<String>()
            for (i in 1 until mtLines.size) {
                val line = mtLines[i].trim()
                if (line.isEmpty()) break
                conflicts.add(line)
            }
            val diffOut = tryRun("diff", "--name-status", "-z", headTip, resultTree)
            val files = parseNameStatusZ(diffOut)
            val conflictSet = conflicts.toHashSet()
            files.forEach { if (conflictSet.contains(it.path)) it.status = "conflict" }
            val known = files.map { it.path }.toHashSet()
            conflicts.forEach { if (!known.contains(it)) files.add(MergePreviewFile(it, "conflict")) }
            files.sortBy { it.path }
            preview.files = files
            preview.conflicts = conflicts
            return preview
        }

        val mergeBase = runSafe(repoRoot, listOf("merge-base", headTip, sourceTip)).trim()
        val fromRef = mergeBase.ifEmpty { headTip }
        val fallbackOut = tryRun("diff", "--name-status", "-z", fromRef, sourceTip)
        val fallbackFiles = parseNameStatusZ(fallbackOut)
        fallbackFiles.sortBy { it.path }
        preview.files = fallbackFiles
        return preview
    }

    /** True when nothing is staged (the index matches HEAD). */
    private fun isIndexClean(): Boolean = capture("diff", "--cached", "--quiet").exitCode == 0

    /**
     * Squash-merge [source] into the current branch: `git merge --squash` stages the
     * merged result without committing (and without recording MERGE_HEAD), then one
     * ordinary `git commit` collapses the whole branch into a SINGLE commit. The source
     * branch's own commits therefore never enter the current branch's history — they
     * stay on their branch, which is left untouched.
     *
     * Guards, because the commit step is ours and not git's: a dirty index is refused
     * (the commit would sweep in unrelated staged changes), a conflict commits nothing
     * (the user resolves it and commits with the normal flow), and a merge that changes
     * nothing records nothing. Mirrors squashMergeCli in vscode/src/gitData.ts.
     */
    private fun squashMerge(source: String, message: String?): OpOutcome {
        if (!isIndexClean()) {
            throw RuntimeException(
                "A squash merge commits everything that is staged. Commit or unstage your staged changes first.",
            )
        }
        try {
            run(listOf("merge", "--squash", source))
        } catch (e: Exception) {
            if (hasUnmergedPaths()) return OpOutcome.CONFLICT else throw e
        }
        if (isIndexClean()) return OpOutcome.OK
        val msg = if (message.isNullOrBlank()) "Squashed changes from '$source'" else message.trim()
        run(listOf("commit", "-m", msg))
        return OpOutcome.OK
    }

    /**
     * Merge [source] into the current branch. Mirrors MergeAsync in vs/Git/GitService.cs.
     * With [squash] the branch collapses into one ordinary commit instead (see [squashMerge]).
     */
    fun merge(source: String, message: String?, noFastForward: Boolean, squash: Boolean = false): OpOutcome {
        if (squash) return squashMerge(source, message)
        val args = mutableListOf("merge")
        if (noFastForward) args.add("--no-ff")
        if (!message.isNullOrBlank()) { args.add("-m"); args.add(message.trim()) }
        args.add(source)
        return try {
            run(args)
            OpOutcome.OK
        } catch (e: Exception) {
            if (hasUnmergedPaths()) OpOutcome.CONFLICT else throw e
        }
    }

    /**
     * Before/after text of one file a merge of [source] would change.
     * Mirrors readMergeFileDiff in vscode/src/gitData.ts.
     */
    fun readMergeFileDiff(source: String, path: String, status: String): FileDiff {
        val diffStatus = when (status) { "added" -> "added"; "deleted" -> "deleted"; else -> "modified" }
        val diff = FileDiff("", path, diffStatus)

        val mt = capture("merge-tree", "--write-tree", "--name-only", "HEAD", source)
        val firstLine = mt.stdout.replace("\r", "").split('\n').firstOrNull()?.trim() ?: ""
        val looksLikeOid = Regex("^[0-9a-f]{7,64}$").matches(firstLine)
        val newRev = if ((mt.exitCode == 0 || mt.exitCode == 1) && looksLikeOid) firstLine else source

        val needOld = status != "added"
        val needNew = status != "deleted"

        val oldSize = if (needOld) blobSize("HEAD", path) else 0
        val newSize = if (needNew) blobSize(newRev, path) else 0
        if (oldSize > MAX_DIFF_BYTES || newSize > MAX_DIFF_BYTES) {
            diff.tooLarge = true
            return diff
        }

        val oldText = if (needOld) blobText("HEAD", path) else ""
        val newText = if (needNew) blobText(newRev, path) else ""
        if (oldText.contains(NUL) || newText.contains(NUL)) {
            diff.binary = true
            return diff
        }
        diff.oldText = oldText
        diff.newText = newText
        return diff
    }

    /** Outcome of an op that can leave conflicts for the IDE to resolve. */
    enum class OpOutcome { OK, CONFLICT }
}
