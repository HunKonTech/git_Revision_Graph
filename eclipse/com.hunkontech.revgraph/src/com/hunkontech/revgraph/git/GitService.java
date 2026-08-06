package com.hunkontech.revgraph.git;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.hunkontech.revgraph.model.Dtos.CommitChangeFile;
import com.hunkontech.revgraph.model.Dtos.FileDiff;
import com.hunkontech.revgraph.model.Dtos.GitCommit;
import com.hunkontech.revgraph.model.Dtos.GitRef;
import com.hunkontech.revgraph.model.Dtos.GraphData;
import com.hunkontech.revgraph.model.Dtos.MergePreview;
import com.hunkontech.revgraph.model.Dtos.MergePreviewFile;
import com.hunkontech.revgraph.model.Dtos.StashEntry;
import com.hunkontech.revgraph.model.Dtos.WorkingTreeFile;

/**
 * Reads git history and performs branch/commit operations via the git CLI.
 * Mirrors jetbrains/.../git/GitService.kt (and, through it, vscode/src/gitData.ts
 * and vs/Git/GitService.cs) so all hosts feed the same shape to the shared web
 * renderer. It is IDE-agnostic (pure git CLI + {@link ProcessBuilder}).
 *
 * <p>Reword/undo of a non-HEAD commit are implemented with pure git plumbing
 * ({@code commit-tree} + {@code update-ref}) instead of the VS host's
 * PowerShell-scripted {@code rebase -i}, since this plugin runs on
 * Windows/macOS/Linux alike — exactly as the JetBrains host does. See
 * {@link #rewordCommit} / {@link #undoCommit}.
 */
public final class GitService {

    private static final char FS = '\u001F'; // field separator (ASCII unit separator)
    private static final char RS = '\u001E'; // record separator (ASCII record separator)
    private static final char NUL = '\u0000';
    private static final long MAX_DIFF_BYTES = 2L * 1024 * 1024;

    private static final Pattern OID = Pattern.compile("^[0-9a-f]{7,64}$");

    private static volatile String customGitExe = null;

    /** Override the git binary for all operations; null reverts to "git" on PATH. */
    public static void setCustomGitPath(String path) {
        String trimmed = path == null ? null : path.trim();
        customGitExe = (trimmed == null || trimmed.isEmpty()) ? null : trimmed;
    }

    private static String gitExe() {
        String custom = customGitExe;
        return custom != null ? custom : "git";
    }

    /** Find the repository root containing [startDir], or null if not inside a work tree. */
    public static String findRepoRoot(String startDir) {
        if (startDir == null || startDir.isEmpty() || !new File(startDir).isDirectory()) {
            return null;
        }
        try {
            String top = runCapture(startDir, Arrays.asList("rev-parse", "--show-toplevel"), null).stdout.trim();
            if (top.isEmpty()) {
                return null;
            }
            return top.replace('/', File.separatorChar);
        } catch (Exception e) {
            return null;
        }
    }

    private static final class GitCapture {
        final int exitCode;
        final String stdout;
        final String stderr;

        GitCapture(int exitCode, String stdout, String stderr) {
            this.exitCode = exitCode;
            this.stdout = stdout;
            this.stderr = stderr;
        }
    }

    private static GitCapture runCapture(String cwd, List<String> args, Map<String, String> env) {
        List<String> cmd = new ArrayList<>();
        cmd.add(gitExe());
        cmd.addAll(args);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(new File(cwd));
        if (env != null) {
            pb.environment().putAll(env);
        }
        try {
            Process proc = pb.start();
            // Drain stderr on a side thread so a large stdout never deadlocks
            // against a full stderr pipe buffer (or vice versa).
            final byte[][] errHolder = new byte[1][];
            Thread errReader = new Thread(() -> {
                try {
                    errHolder[0] = readAll(proc.getErrorStream());
                } catch (Exception ignored) {
                    errHolder[0] = new byte[0];
                }
            });
            errReader.setDaemon(true);
            errReader.start();
            byte[] out = readAll(proc.getInputStream());
            int exit = proc.waitFor();
            errReader.join();
            byte[] err = errHolder[0] != null ? errHolder[0] : new byte[0];
            return new GitCapture(exit,
                    new String(out, StandardCharsets.UTF_8),
                    new String(err, StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) {
            bos.write(buf, 0, n);
        }
        return bos.toByteArray();
    }

    /** Run git, returning stdout; throws on non-zero exit. */
    private static String run(String cwd, List<String> args, Map<String, String> env) {
        GitCapture cap = runCapture(cwd, args, env);
        if (cap.exitCode != 0) {
            throw new RuntimeException("git " + String.join(" ", args) + " failed: " + cap.stderr);
        }
        return cap.stdout;
    }

    private static String runSafe(String cwd, List<String> args) {
        try {
            return run(cwd, args, null);
        } catch (Exception e) {
            return "";
        }
    }

    // ------------------------------------------------------------------

    private final String repoRoot;

    public GitService(String repoRoot) {
        this.repoRoot = repoRoot;
    }

    private String run(List<String> args) {
        return run(repoRoot, args, null);
    }

    private String tryRun(String... args) {
        try {
            return run(repoRoot, Arrays.asList(args), null);
        } catch (Exception e) {
            return "";
        }
    }

    private GitCapture capture(String... args) {
        return runCapture(repoRoot, Arrays.asList(args), null);
    }

    private static List<String> splitLines(String text) {
        List<String> out = new ArrayList<>();
        for (String raw : text.split("\n")) {
            String t = raw.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Graph data
    // ------------------------------------------------------------------

    public GraphData readGraphData(int maxCommits) {
        String logOut = run(Arrays.asList(
                "log", "--exclude=refs/stash", "--all", "--topo-order", "--max-count=" + maxCommits,
                "--pretty=format:%H" + FS + "%P" + FS + "%s" + FS + "%an" + FS + "%ae" + FS + "%aI" + RS));
        String refsOut = run(Arrays.asList(
                "for-each-ref",
                "--format=%(refname)" + FS + "%(objectname)" + FS + "%(*objectname)" + FS + "%(HEAD)",
                "refs/heads", "refs/remotes", "refs/tags"));
        String head = runSafe(repoRoot, Arrays.asList("rev-parse", "HEAD")).trim();
        List<StashEntry> stashes = readStashes();

        GraphData data = new GraphData();
        data.commits = parseCommits(logOut);
        data.refs = parseRefs(refsOut);
        data.head = head.isEmpty() ? null : head;
        data.repoName = new File(repoRoot).getName();
        data.stashes = stashes;
        data.gitCommand = "git log --exclude=refs/stash --all --topo-order --max-count=" + maxCommits;
        return data;
    }

    /** Read the stash stack, each entry tied to the commit it came from. */
    public List<StashEntry> readStashes() {
        String out = tryRun("stash", "list", "--format=%gd" + FS + "%H" + FS + "%P" + FS + "%gs" + FS + "%cI");
        Pattern stashPattern = Pattern.compile("stash@\\{(\\d+)\\}");
        List<StashEntry> result = new ArrayList<>();
        for (String raw : out.split("\n")) {
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] f = line.split(String.valueOf(FS), -1);
            if (f.length < 2 || f[1].isEmpty()) {
                continue;
            }
            String gd = f[0];
            String sha = f[1];
            String parents = f.length > 2 ? f[2] : "";
            String message = f.length > 3 ? f[3] : "";
            String date = f.length > 4 ? f[4] : "";
            Matcher m = stashPattern.matcher(gd);
            int index = m.find() ? Integer.parseInt(m.group(1)) : result.size();
            String baseSha = "";
            for (String p : parents.split(" ")) {
                if (!p.isEmpty()) {
                    baseSha = p;
                    break;
                }
            }
            result.add(new StashEntry(index, sha, message, baseSha, date));
        }
        return result;
    }

    private List<GitCommit> parseCommits(String output) {
        List<GitCommit> commits = new ArrayList<>();
        for (String rec : output.split(String.valueOf(RS), -1)) {
            String line = trimStart(rec, '\n', '\r');
            if (line.trim().isEmpty()) {
                continue;
            }
            String[] f = line.split(String.valueOf(FS), -1);
            if (f.length < 6 || f[0].isEmpty()) {
                continue;
            }
            List<String> parents = new ArrayList<>();
            for (String p : f[1].split(" ")) {
                if (!p.isEmpty()) {
                    parents.add(p);
                }
            }
            commits.add(new GitCommit(f[0], parents, f[2], f[3], f[4], f[5]));
        }
        return commits;
    }

    private List<GitRef> parseRefs(String output) {
        List<GitRef> refs = new ArrayList<>();
        for (String raw : output.split("\n")) {
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] f = line.split(String.valueOf(FS), -1);
            if (f.length < 2 || f[0].isEmpty() || f[1].isEmpty()) {
                continue;
            }
            String refname = f[0];
            String objectname = f[1];
            String deref = f.length > 2 ? f[2] : "";
            String headMark = f.length > 3 ? f[3] : "";
            String targetSha = deref.isEmpty() ? objectname : deref;
            boolean isCurrent = "*".equals(headMark);

            if (refname.startsWith("refs/heads/")) {
                GitRef ref = new GitRef(refname.substring("refs/heads/".length()), "localBranch", targetSha);
                ref.isCurrent = isCurrent;
                refs.add(ref);
            } else if (refname.startsWith("refs/remotes/")) {
                String shortName = refname.substring("refs/remotes/".length());
                if (shortName.endsWith("/HEAD")) {
                    continue;
                }
                GitRef ref = new GitRef(shortName, "remoteBranch", targetSha);
                int slash = shortName.indexOf('/');
                ref.remote = slash >= 0 ? shortName.substring(0, slash) : shortName;
                refs.add(ref);
            } else if (refname.startsWith("refs/tags/")) {
                refs.add(new GitRef(refname.substring("refs/tags/".length()), "tag", targetSha));
            }
        }
        return refs;
    }

    // ------------------------------------------------------------------
    // Branches
    // ------------------------------------------------------------------

    public void createBranch(String name, String sha, boolean checkout) {
        if (checkout) {
            run(Arrays.asList("checkout", "-b", name, sha));
        } else {
            run(Arrays.asList("branch", name, sha));
        }
    }

    public void deleteBranch(String name, boolean force) {
        run(Arrays.asList("branch", force ? "-D" : "-d", name));
    }

    public String getCurrentBranch() {
        return runSafe(repoRoot, Arrays.asList("symbolic-ref", "--quiet", "--short", "HEAD")).trim();
    }

    private boolean localBranchExists(String name) {
        try {
            run(Arrays.asList("show-ref", "--verify", "--quiet", "refs/heads/" + name));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * The repo's main branch name — the remote's default (origin/HEAD) if a
     * matching local branch exists, else local main, else local master.
     * Empty when none found. Mirrors resolveMainBranchCli in gitData.ts.
     */
    public String resolveMainBranch() {
        String sym = tryRun("symbolic-ref", "--short", "refs/remotes/origin/HEAD").trim();
        if (!sym.isEmpty()) {
            int slash = sym.indexOf('/');
            String localName = slash >= 0 ? sym.substring(slash + 1) : sym;
            if (!localName.isEmpty() && localBranchExists(localName)) {
                return localName;
            }
        }
        for (String cand : Arrays.asList("main", "master")) {
            if (localBranchExists(cand)) {
                return cand;
            }
        }
        return "";
    }

    /**
     * Where HEAD should land when the currently checked-out branch is about
     * to be deleted. Mirrors ResolveBranchBaseTargetAsync in vs/Git/GitService.cs.
     */
    public String resolveBranchBaseTarget(String branch) {
        String main = resolveMainBranch();
        List<String> others = new ArrayList<>();
        for (String b : splitLines(tryRun("for-each-ref", "--format=%(refname:short)", "refs/heads"))) {
            if (!b.equals(branch)) {
                others.add(b);
            }
        }

        List<String> revListArgs = new ArrayList<>(Arrays.asList("rev-list", branch));
        for (String b : others) {
            revListArgs.add("^" + b);
        }
        List<String> unique = splitLines(tryRun(revListArgs.toArray(new String[0])));

        String forkSha;
        if (unique.isEmpty()) {
            forkSha = tryRun("rev-parse", branch).trim();
        } else {
            forkSha = tryRun("rev-parse", unique.get(unique.size() - 1) + "^").trim();
        }

        if (!forkSha.isEmpty()) {
            List<String> candidates = new ArrayList<>();
            for (String c : splitLines(tryRun("branch", "--contains", forkSha, "--format=%(refname:short)"))) {
                if (!c.equals(branch)) {
                    candidates.add(c);
                }
            }
            if (!main.isEmpty() && candidates.contains(main)) {
                return main;
            }
            if (!candidates.isEmpty()) {
                return candidates.get(0);
            }
        }

        if (!main.isEmpty() && !main.equals(branch)) {
            return main;
        }
        return forkSha;
    }

    /** Whether a commit is reachable from any remote branch — i.e. already pushed. */
    public boolean isCommitPushed(String sha) {
        String out = tryRun("branch", "-r", "--contains", sha);
        for (String line : splitLines(out)) {
            if (!line.endsWith("/HEAD")) {
                return true;
            }
        }
        return false;
    }

    public String getHeadSha() {
        return runSafe(repoRoot, Arrays.asList("rev-parse", "HEAD")).trim();
    }

    public String getCommitSummary(String sha) {
        return runSafe(repoRoot, Arrays.asList("show", "-s", "--format=%s", sha)).trim();
    }

    private boolean isHeadCommit(String sha) {
        String head = getHeadSha();
        return !head.isEmpty() && (head.equals(sha) || head.startsWith(sha) || sha.startsWith(head));
    }

    private boolean hasUncommittedChanges() {
        return !tryRun("status", "--porcelain").trim().isEmpty();
    }

    /**
     * Reword a local commit's message. HEAD uses a plain {@code --amend}; an
     * older commit is rewritten via pure git plumbing (see the class doc and
     * {@link #rebuildDescendants}). Requires a clean working tree.
     */
    public void rewordCommit(String sha, String message) {
        if (isHeadCommit(sha)) {
            run(Arrays.asList("commit", "--amend", "-m", message));
            return;
        }
        if (hasUncommittedChanges()) {
            throw new RuntimeException(
                    "There are uncommitted changes; commit or stash them before rewording an older commit.");
        }
        rebuildDescendants(sha, false, message);
    }

    /**
     * Undo a local commit. HEAD uses {@code git reset --mixed HEAD~1}; an older
     * commit is dropped via the same plumbing walk as {@link #rewordCommit}.
     * Requires a clean working tree; can never leave a conflicted rebase, so
     * the result is always Ok or a thrown error — never Conflict.
     */
    public OpOutcome undoCommit(String sha) {
        if (isHeadCommit(sha)) {
            run(Arrays.asList("reset", "--mixed", "HEAD~1"));
            return OpOutcome.OK;
        }
        if (hasUncommittedChanges()) {
            throw new RuntimeException(
                    "There are uncommitted changes; commit or stash them before undoing an older commit.");
        }
        rebuildDescendants(sha, true, null);
        return OpOutcome.OK;
    }

    /**
     * Shared plumbing walk for {@link #rewordCommit} and {@link #undoCommit}:
     * replays the commits after [targetSha] (inclusive) on the current branch
     * tip via {@code git commit-tree} so no working-tree checkout ever happens
     * (hence no conflicts). Finishes with {@code update-ref} + a hard sync.
     */
    private void rebuildDescendants(String targetSha, boolean dropTarget, String newMessage) {
        String branch = getCurrentBranch();
        if (branch.isEmpty()) {
            throw new RuntimeException("HEAD is detached; check out a branch first.");
        }

        String targetFull = tryRun("rev-parse", targetSha).trim();
        if (targetFull.isEmpty()) {
            throw new RuntimeException("Commit " + targetSha + " not found.");
        }

        List<String> chain = splitLines(tryRun("rev-list", "--reverse", targetFull + "..HEAD"));
        String targetParent = tryRun("rev-parse", targetFull + "^").trim();

        String newParent = targetParent;
        if (!dropTarget) {
            String tree = tryRun("show", "-s", "--format=%T", targetFull).trim();
            newParent = run(Arrays.asList(
                    "commit-tree", tree, "-p", targetParent, "-m", newMessage != null ? newMessage : "")).trim();
        }

        for (String childSha : chain) {
            String tree = tryRun("show", "-s", "--format=%T", childSha).trim();
            String origMessage = run(Arrays.asList("show", "-s", "--format=%B", childSha));
            newParent = run(Arrays.asList(
                    "commit-tree", tree, "-p", newParent, "-m", trimEnd(origMessage, '\n'))).trim();
        }

        run(Arrays.asList("update-ref", "refs/heads/" + branch, newParent));
        run(Arrays.asList("reset", "--hard", newParent));
    }

    // ------------------------------------------------------------------
    // Stash
    // ------------------------------------------------------------------

    private boolean hasUnmergedPaths() {
        return !tryRun("ls-files", "-u").trim().isEmpty();
    }

    public OpOutcome stashApply(int index) {
        try {
            run(Arrays.asList("stash", "apply", "stash@{" + index + "}"));
            return OpOutcome.OK;
        } catch (RuntimeException e) {
            if (hasUnmergedPaths()) {
                return OpOutcome.CONFLICT;
            }
            throw e;
        }
    }

    public OpOutcome stashPop(int index) {
        try {
            run(Arrays.asList("stash", "pop", "stash@{" + index + "}"));
            return OpOutcome.OK;
        } catch (RuntimeException e) {
            if (hasUnmergedPaths()) {
                return OpOutcome.CONFLICT;
            }
            throw e;
        }
    }

    public void stashDrop(int index) {
        run(Arrays.asList("stash", "drop", "stash@{" + index + "}"));
    }

    // ------------------------------------------------------------------
    // Commit changes / file content / diff
    // ------------------------------------------------------------------

    private static String mapStatus(String code) {
        char c = code.isEmpty() ? ' ' : code.charAt(0);
        switch (c) {
            case 'A':
                return "added";
            case 'D':
                return "deleted";
            case 'R':
            case 'C':
                return "renamed";
            default:
                return "modified";
        }
    }

    /** Files a commit changed vs its first parent. Mirrors readCommitChanges in gitData.ts. */
    public List<CommitChangeFile> readCommitChanges(String sha) {
        String out = tryRun("show", "--first-parent", "-M", "-C", "--name-status", "--format=", "-z", sha);
        List<CommitChangeFile> files = new ArrayList<>();
        String[] parts = out.split(String.valueOf(NUL), -1);
        int i = 0;
        while (i < parts.length) {
            String code = i < parts.length ? parts[i++].trim() : null;
            if (code == null || code.isEmpty()) {
                continue;
            }
            String status = mapStatus(code);
            if ("renamed".equals(status)) {
                String oldPath = i < parts.length ? parts[i++] : null;
                String newPath = i < parts.length ? parts[i++] : null;
                if (newPath != null && !newPath.isEmpty()) {
                    files.add(new CommitChangeFile(newPath, emptyToNull(oldPath), status));
                }
            } else {
                String path = i < parts.length ? parts[i++] : null;
                if (path != null && !path.isEmpty()) {
                    files.add(new CommitChangeFile(path, null, status));
                }
            }
        }
        return files;
    }

    /** All file paths present in a commit's tree. Mirrors readCommitTree in gitData.ts. */
    public List<String> readCommitTree(String sha) {
        return splitLines(tryRun("ls-tree", "-r", "--name-only", sha));
    }

    private long blobSize(String rev, String path) {
        String s = tryRun("cat-file", "-s", rev + ":" + path).trim();
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private String blobText(String rev, String path) {
        return tryRun("show", rev + ":" + path);
    }

    /** Raw content of one file at a commit. Mirrors readFileContent in gitData.ts. */
    public FileContent readFileContent(String sha, String path) {
        long size = blobSize(sha, path);
        if (size > MAX_DIFF_BYTES) {
            return new FileContent("", false, true);
        }
        String text = blobText(sha, path);
        if (text.indexOf(NUL) >= 0) {
            return new FileContent("", true, false);
        }
        return new FileContent(text, false, false);
    }

    /** Before/after text of one changed file. Mirrors readFileDiff in gitData.ts. */
    public FileDiff readFileDiff(String sha, String path, String status, String oldPath) {
        FileDiff diff = new FileDiff(sha, path, status);
        String parent = sha + "^";
        String beforePath = (oldPath != null && !oldPath.isEmpty()) ? oldPath : path;
        boolean needOld = !"added".equals(status);
        boolean needNew = !"deleted".equals(status);

        long oldSize = needOld ? blobSize(parent, beforePath) : 0;
        long newSize = needNew ? blobSize(sha, path) : 0;
        if (oldSize > MAX_DIFF_BYTES || newSize > MAX_DIFF_BYTES) {
            diff.tooLarge = Boolean.TRUE;
            return diff;
        }

        String oldText = needOld ? blobText(parent, beforePath) : "";
        String newText = needNew ? blobText(sha, path) : "";
        if (oldText.indexOf(NUL) >= 0 || newText.indexOf(NUL) >= 0) {
            diff.binary = Boolean.TRUE;
            return diff;
        }
        diff.oldText = oldText;
        diff.newText = newText;
        return diff;
    }

    /** Current working-tree files available for a local commit. */
    public List<WorkingTreeFile> readWorkingTreeChanges() {
        String out = tryRun("status", "--porcelain=v1", "-z");
        List<WorkingTreeFile> files = new ArrayList<>();
        String[] parts = out.split(String.valueOf(NUL), -1);
        int i = 0;
        while (i < parts.length) {
            String rec = i < parts.length ? parts[i++] : null;
            if (rec == null || rec.length() < 4) {
                continue;
            }
            char x = rec.charAt(0);
            char y = rec.charAt(1);
            String path = rec.substring(3);
            if (path.isEmpty()) {
                continue;
            }
            String oldPath = null;
            if (x == 'R' || x == 'C') {
                oldPath = i < parts.length ? emptyToNull(parts[i++]) : null;
            }
            files.add(new WorkingTreeFile(path, oldPath, mapWorkingTreeStatus(x, y), (x != ' ' && x != '?') ? Boolean.TRUE : null));
        }
        files.sort((a, b) -> a.path.compareToIgnoreCase(b.path));
        return files;
    }

    private static String mapWorkingTreeStatus(char x, char y) {
        if (x == 'R' || y == 'R' || x == 'C' || y == 'C') {
            return "renamed";
        }
        if (x == 'D' || y == 'D') {
            return "deleted";
        }
        if (x == 'A' || y == 'A' || x == '?' || y == '?') {
            return "added";
        }
        return "modified";
    }

    private static long fileSize(String path) {
        try {
            File f = new File(path);
            return f.isFile() ? f.length() : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private static String fileText(String path) {
        try {
            return new String(java.nio.file.Files.readAllBytes(new File(path).toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    /** Before/after text of one working-tree file, comparing HEAD to disk. */
    public FileDiff readWorkingTreeFileDiff(String path, String status, String oldPath) {
        FileDiff diff = new FileDiff("", path, status);
        String beforePath = oldPath != null && !oldPath.isEmpty() ? oldPath : path;
        String abs = new File(repoRoot, path.replace('/', File.separatorChar)).getPath();
        boolean needOld = !"added".equals(status);
        boolean needNew = !"deleted".equals(status);
        long oldSize = needOld ? blobSize("HEAD", beforePath) : 0;
        long newSize = needNew ? fileSize(abs) : 0;
        if (oldSize > MAX_DIFF_BYTES || newSize > MAX_DIFF_BYTES) {
            diff.tooLarge = Boolean.TRUE;
            return diff;
        }
        String oldText = needOld ? blobText("HEAD", beforePath) : "";
        String newText = needNew ? fileText(abs) : "";
        if (oldText.indexOf(NUL) >= 0 || newText.indexOf(NUL) >= 0) {
            diff.binary = Boolean.TRUE;
            return diff;
        }
        diff.oldText = oldText;
        diff.newText = newText;
        return diff;
    }

    /** Create a local commit from exactly the selected working-tree paths. */
    public String commitWorkingTreeChanges(String message, List<String> selectedPaths) {
        String msg = message == null ? "" : message.trim();
        if (msg.isEmpty()) {
            throw new RuntimeException("Commit message is required.");
        }
        if (selectedPaths == null || selectedPaths.isEmpty()) {
            throw new RuntimeException("Select at least one file to commit.");
        }
        Set<String> selected = new HashSet<>(selectedPaths);
        Set<String> pathspecs = new java.util.LinkedHashSet<>();
        for (WorkingTreeFile f : readWorkingTreeChanges()) {
            if (!selected.contains(f.path)) {
                continue;
            }
            pathspecs.add(f.path);
            if (f.oldPath != null && !f.oldPath.isEmpty()) {
                pathspecs.add(f.oldPath);
            }
        }
        if (pathspecs.isEmpty()) {
            throw new RuntimeException("None of the selected files still have changes.");
        }
        List<String> existing = new ArrayList<>();
        for (String p : pathspecs) {
            if (new File(repoRoot, p.replace('/', File.separatorChar)).isFile()) {
                existing.add(p);
            }
        }
        if (!existing.isEmpty()) {
            List<String> addArgs = new ArrayList<>();
            addArgs.add("add");
            addArgs.add("-N");
            addArgs.add("--");
            addArgs.addAll(existing);
            try {
                run(addArgs);
            } catch (Exception e) {
                // best effort
            }
        }
        List<String> commitArgs = new ArrayList<>();
        commitArgs.add("commit");
        commitArgs.add("-m");
        commitArgs.add(msg);
        commitArgs.add("--only");
        commitArgs.add("--");
        commitArgs.addAll(pathspecs);
        run(commitArgs);
        return run(Arrays.asList("rev-parse", "HEAD")).trim();
    }

    // ------------------------------------------------------------------
    // Checkout
    // ------------------------------------------------------------------

    public void checkout(String treeish) {
        run(Arrays.asList("checkout", treeish));
    }

    /**
     * Checkout a commit, preferring a branch over a detached HEAD. Mirrors
     * resolveCheckoutTarget/checkoutTrackingCli in vscode/src/gitData.ts.
     */
    public void smartCheckout(String sha, String preferredRef) {
        if (preferredRef != null && !preferredRef.isEmpty()) {
            String localHit = tryRun("branch", "--list", preferredRef);
            if (!localHit.trim().isEmpty()) {
                checkout(preferredRef);
                return;
            }
            String remoteHit = tryRun("branch", "-r", "--list", preferredRef);
            if (!remoteHit.trim().isEmpty()) {
                int slash = preferredRef.indexOf('/');
                if (slash >= 0 && slash < preferredRef.length() - 1) {
                    String localName = preferredRef.substring(slash + 1);
                    try {
                        run(Arrays.asList("checkout", "-b", localName, "--track", preferredRef));
                    } catch (Exception e) {
                        checkout(localName);
                    }
                    return;
                }
            }
        }

        List<String> locals = splitLines(tryRun("branch", "--points-at", sha, "--format=%(refname:short)"));
        if (!locals.isEmpty()) {
            checkout(locals.get(0));
            return;
        }

        List<String> remotes = splitLines(tryRun("branch", "-r", "--points-at", sha, "--format=%(refname:lstrip=2)"));
        for (String remoteRef : remotes) {
            if (remoteRef.endsWith("/HEAD")) {
                continue;
            }
            int slash = remoteRef.indexOf('/');
            if (slash < 0 || slash == remoteRef.length() - 1) {
                continue;
            }
            String localName = remoteRef.substring(slash + 1);
            try {
                run(Arrays.asList("checkout", "-b", localName, "--track", remoteRef));
            } catch (Exception e) {
                checkout(localName);
            }
            return;
        }

        checkout(sha);
    }

    // ------------------------------------------------------------------
    // Remote ops
    // ------------------------------------------------------------------

    public void fetch() {
        run(Arrays.asList("fetch", "--all", "--prune"));
    }

    public void pull() {
        run(Arrays.asList("pull"));
    }

    public void push() {
        run(Arrays.asList("push"));
    }

    public void pushBranch(String branchName) {
        run(Arrays.asList("push", "--set-upstream", "origin", branchName));
    }

    public void renameBranch(String oldName, String newName) {
        run(Arrays.asList("branch", "-m", oldName, newName));
    }

    public void sync() {
        pull();
        push();
    }

    // ------------------------------------------------------------------
    // Merge
    // ------------------------------------------------------------------

    private boolean isAncestor(String a, String b) {
        return capture("merge-base", "--is-ancestor", a, b).exitCode == 0;
    }

    private static String mapMergeStatus(String code) {
        char c = code.isEmpty() ? ' ' : code.charAt(0);
        switch (c) {
            case 'A':
                return "added";
            case 'D':
                return "deleted";
            default:
                return "modified";
        }
    }

    private List<MergePreviewFile> parseNameStatusZ(String out) {
        List<MergePreviewFile> files = new ArrayList<>();
        String[] parts = out.split(String.valueOf(NUL), -1);
        int i = 0;
        while (i < parts.length) {
            String code = i < parts.length ? parts[i++].trim() : null;
            if (code == null || code.isEmpty()) {
                continue;
            }
            String path = i < parts.length ? parts[i++] : null;
            if (path != null && !path.isEmpty()) {
                files.add(new MergePreviewFile(path, mapMergeStatus(code)));
            }
        }
        return files;
    }

    /**
     * Dry-run preview of merging [source] into the current branch via
     * {@code git merge-tree --write-tree}. Mirrors computeMergePreview in gitData.ts.
     */
    public MergePreview computeMergePreview(String source) {
        String target = getCurrentBranch();
        if (target.isEmpty()) {
            target = "HEAD";
        }
        MergePreview preview = new MergePreview(source, target);
        preview.defaultMessage = "Merge branch '" + source + "'" + (!"HEAD".equals(target) ? " into " + target : "");
        preview.defaultSquashMessage = "Squashed changes from '" + source + "'";

        String headTip = runSafe(repoRoot, Arrays.asList("rev-parse", "HEAD")).trim();
        String sourceTip = runSafe(repoRoot, Arrays.asList("rev-parse", source)).trim();
        if (headTip.isEmpty()) {
            preview.error = "No commit is checked out.";
            return preview;
        }
        if (sourceTip.isEmpty()) {
            preview.error = "Branch \"" + source + "\" was not found.";
            return preview;
        }

        if (isAncestor(sourceTip, headTip)) {
            preview.upToDate = true;
            return preview;
        }
        preview.canFastForward = isAncestor(headTip, sourceTip);

        GitCapture mt = capture("merge-tree", "--write-tree", "--name-only", headTip, sourceTip);
        String[] mtLines = mt.stdout.replace("\r", "").split("\n", -1);
        String resultTree = mtLines.length > 0 ? mtLines[0].trim() : "";
        boolean looksLikeOid = OID.matcher(resultTree).matches();

        if ((mt.exitCode == 0 || mt.exitCode == 1) && looksLikeOid) {
            List<String> conflicts = new ArrayList<>();
            for (int i = 1; i < mtLines.length; i++) {
                String line = mtLines[i].trim();
                if (line.isEmpty()) {
                    break;
                }
                conflicts.add(line);
            }
            String diffOut = tryRun("diff", "--name-status", "-z", headTip, resultTree);
            List<MergePreviewFile> files = parseNameStatusZ(diffOut);
            Set<String> conflictSet = new HashSet<>(conflicts);
            for (MergePreviewFile f : files) {
                if (conflictSet.contains(f.path)) {
                    f.status = "conflict";
                }
            }
            Set<String> known = new HashSet<>();
            for (MergePreviewFile f : files) {
                known.add(f.path);
            }
            for (String c : conflicts) {
                if (!known.contains(c)) {
                    files.add(new MergePreviewFile(c, "conflict"));
                }
            }
            files.sort((a, b) -> a.path.compareTo(b.path));
            preview.files = files;
            preview.conflicts = conflicts;
            return preview;
        }

        String mergeBase = runSafe(repoRoot, Arrays.asList("merge-base", headTip, sourceTip)).trim();
        String fromRef = mergeBase.isEmpty() ? headTip : mergeBase;
        String fallbackOut = tryRun("diff", "--name-status", "-z", fromRef, sourceTip);
        List<MergePreviewFile> fallbackFiles = parseNameStatusZ(fallbackOut);
        fallbackFiles.sort((a, b) -> a.path.compareTo(b.path));
        preview.files = fallbackFiles;
        return preview;
    }

    /** True when nothing is staged (the index matches HEAD). */
    private boolean isIndexClean() {
        return capture("diff", "--cached", "--quiet").exitCode == 0;
    }

    /**
     * Squash-merge {@code source} into the current branch: {@code git merge --squash}
     * stages the merged result without committing (and without recording MERGE_HEAD),
     * then one ordinary {@code git commit} collapses the whole branch into a SINGLE
     * commit. The source branch's own commits therefore never enter the current
     * branch's history — they stay on their branch, which is left untouched.
     *
     * <p>Guards, because the commit step is ours and not git's: a dirty index is
     * refused (the commit would sweep in unrelated staged changes), a conflict commits
     * nothing (the user resolves it and commits with the normal flow), and a merge that
     * changes nothing records nothing. Mirrors squashMergeCli in vscode/src/gitData.ts.
     */
    private OpOutcome squashMerge(String source, String message) {
        if (!isIndexClean()) {
            throw new RuntimeException(
                    "A squash merge commits everything that is staged. Commit or unstage your staged changes first.");
        }
        try {
            run(Arrays.asList("merge", "--squash", source));
        } catch (RuntimeException e) {
            if (hasUnmergedPaths()) {
                return OpOutcome.CONFLICT;
            }
            throw e;
        }
        if (isIndexClean()) {
            return OpOutcome.OK;
        }
        String msg = (message != null && !message.trim().isEmpty())
                ? message.trim()
                : "Squashed changes from '" + source + "'";
        run(Arrays.asList("commit", "-m", msg));
        return OpOutcome.OK;
    }

    /**
     * Merge [source] into the current branch. Mirrors MergeAsync in vs/Git/GitService.cs.
     * With {@code squash} the branch collapses into one ordinary commit instead
     * (see {@link #squashMerge}).
     */
    public OpOutcome merge(String source, String message, boolean noFastForward, boolean squash) {
        if (squash) {
            return squashMerge(source, message);
        }
        List<String> args = new ArrayList<>();
        args.add("merge");
        if (noFastForward) {
            args.add("--no-ff");
        }
        if (message != null && !message.trim().isEmpty()) {
            args.add("-m");
            args.add(message.trim());
        }
        args.add(source);
        try {
            run(args);
            return OpOutcome.OK;
        } catch (RuntimeException e) {
            if (hasUnmergedPaths()) {
                return OpOutcome.CONFLICT;
            }
            throw e;
        }
    }

    /**
     * Before/after text of one file a merge of [source] would change.
     * Mirrors readMergeFileDiff in vscode/src/gitData.ts.
     */
    public FileDiff readMergeFileDiff(String source, String path, String status) {
        String diffStatus;
        if ("added".equals(status)) {
            diffStatus = "added";
        } else if ("deleted".equals(status)) {
            diffStatus = "deleted";
        } else {
            diffStatus = "modified";
        }
        FileDiff diff = new FileDiff("", path, diffStatus);

        GitCapture mt = capture("merge-tree", "--write-tree", "--name-only", "HEAD", source);
        String[] lines = mt.stdout.replace("\r", "").split("\n", -1);
        String firstLine = lines.length > 0 ? lines[0].trim() : "";
        boolean looksLikeOid = OID.matcher(firstLine).matches();
        String newRev = ((mt.exitCode == 0 || mt.exitCode == 1) && looksLikeOid) ? firstLine : source;

        boolean needOld = !"added".equals(status);
        boolean needNew = !"deleted".equals(status);

        long oldSize = needOld ? blobSize("HEAD", path) : 0;
        long newSize = needNew ? blobSize(newRev, path) : 0;
        if (oldSize > MAX_DIFF_BYTES || newSize > MAX_DIFF_BYTES) {
            diff.tooLarge = Boolean.TRUE;
            return diff;
        }

        String oldText = needOld ? blobText("HEAD", path) : "";
        String newText = needNew ? blobText(newRev, path) : "";
        if (oldText.indexOf(NUL) >= 0 || newText.indexOf(NUL) >= 0) {
            diff.binary = Boolean.TRUE;
            return diff;
        }
        diff.oldText = oldText;
        diff.newText = newText;
        return diff;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    private static String trimStart(String s, char... chars) {
        int start = 0;
        outer:
        while (start < s.length()) {
            char c = s.charAt(start);
            for (char t : chars) {
                if (c == t) {
                    start++;
                    continue outer;
                }
            }
            break;
        }
        return s.substring(start);
    }

    private static String trimEnd(String s, char ch) {
        int end = s.length();
        while (end > 0 && s.charAt(end - 1) == ch) {
            end--;
        }
        return s.substring(0, end);
    }

    /** Raw content of a file plus its binary / too-large flags. */
    public static final class FileContent {
        public final String text;
        public final boolean binary;
        public final boolean tooLarge;

        FileContent(String text, boolean binary, boolean tooLarge) {
            this.text = text;
            this.binary = binary;
            this.tooLarge = tooLarge;
        }
    }

    /** Outcome of an op that can leave conflicts for the IDE to resolve. */
    public enum OpOutcome {
        OK, CONFLICT
    }
}
