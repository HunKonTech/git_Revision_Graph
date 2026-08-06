package com.hunkontech.revgraph.model;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import com.hunkontech.revgraph.util.Json;

/**
 * Data classes mirroring packages/protocol/src/index.ts (the single source of
 * truth). Serialized to camelCase JSON by {@link Json} — the field names below
 * ARE the wire names — so the shared web renderer consumes them unchanged, the
 * same way it does across the VS Code, Visual Studio and JetBrains hosts.
 * Mirrors jetbrains/.../model/Dtos.kt and vs/Model/Dtos.cs.
 *
 * <p>Fields are public because {@link Json} serializes objects by reflecting
 * over their public fields (nulls omitted, matching Gson's default).
 */
public final class Dtos {

    private Dtos() {
    }

    public static final class GraphData {
        public List<GitCommit> commits = Collections.emptyList();
        public List<GitRef> refs = Collections.emptyList();
        public String head;
        public String repoName;
        /** Stash entries, drawn in their own column linked to their base commit. */
        public List<StashEntry> stashes = Collections.emptyList();
        /** The git log command that produced this data, shown in the status bar. */
        public String gitCommand;
    }

    /** A single git stash entry ({@code stash@{N}}). */
    public static final class StashEntry {
        /** Stack position N in {@code stash@{N}} (0 = most recent). */
        public final int index;
        public final String sha;
        public final String message;
        /** Sha of the commit the stash was created from (its first parent). */
        public final String baseSha;
        public final String date;

        public StashEntry(int index, String sha, String message, String baseSha, String date) {
            this.index = index;
            this.sha = sha;
            this.message = message;
            this.baseSha = baseSha;
            this.date = date;
        }
    }

    public static final class GitCommit {
        public final String sha;
        public final List<String> parents;
        public final String summary;
        public final String author;
        public final String authorEmail;
        public final String date;

        public GitCommit(String sha, List<String> parents, String summary,
                String author, String authorEmail, String date) {
            this.sha = sha;
            this.parents = parents;
            this.summary = summary;
            this.author = author;
            this.authorEmail = authorEmail;
            this.date = date;
        }
    }

    public static final class GitRef {
        public final String name;
        /** One of: localBranch | remoteBranch | tag | head. */
        public final String type;
        public final String targetSha;
        public String remote;
        public Boolean isCurrent;

        public GitRef(String name, String type, String targetSha) {
            this.name = name;
            this.type = type;
            this.targetSha = targetSha;
        }
    }

    /** One file changed by a commit (left pane of the changes dialog). */
    public static final class CommitChangeFile {
        /** Path as of this commit (the new path for renames). */
        public final String path;
        /** For renames: the path the file had in the parent. */
        public String oldPath;
        /** One of: added | modified | deleted | renamed. */
        public String status;

        public CommitChangeFile(String path, String oldPath, String status) {
            this.path = path;
            this.oldPath = oldPath;
            this.status = status;
        }
    }

    /** Before/after content of a changed file, for the side-by-side diff. */
    public static final class FileDiff {
        public final String sha;
        public final String path;
        public final String status;
        /** Content in the parent commit (empty for added files). */
        public String oldText = "";
        /** Content in this commit (empty for deleted files). */
        public String newText = "";
        /** True when git reports the file as binary. */
        public Boolean binary;
        /** True when the file exceeded the host's diff size cap. */
        public Boolean tooLarge;

        public FileDiff(String sha, String path, String status) {
            this.sha = sha;
            this.path = path;
            this.status = status;
        }
    }

    /** One file currently changed in the working tree. */
    public static final class WorkingTreeFile {
        public final String path;
        public String oldPath;
        /** One of: added | modified | deleted | renamed. */
        public String status;
        /** True when the file already has staged changes. */
        public Boolean staged;

        public WorkingTreeFile(String path, String oldPath, String status, Boolean staged) {
            this.path = path;
            this.oldPath = oldPath;
            this.status = status;
            this.staged = staged;
        }
    }

    /** One file a (hypothetical) merge would change. */
    public static final class MergePreviewFile {
        public final String path;
        /** One of: added | modified | deleted | conflict. */
        public String status;

        public MergePreviewFile(String path, String status) {
            this.path = path;
            this.status = status;
        }
    }

    /**
     * Dry-run preview of merging {@code source} into the current branch,
     * computed without touching the working tree. Mirrors MergePreview in the
     * TS protocol.
     */
    public static final class MergePreview {
        public final String source;
        public final String target;
        public boolean upToDate = false;
        public boolean canFastForward = false;
        public List<MergePreviewFile> files = Collections.emptyList();
        public List<String> conflicts = Collections.emptyList();
        public String defaultMessage;
        /** Default message for a squash merge (one collapsed commit). */
        public String defaultSquashMessage;
        /** Set when the preview couldn't be computed. */
        public String error;

        public MergePreview(String source, String target) {
            this.source = source;
            this.target = target;
        }
    }

    /** Incoming message from the webview (webview -&gt; host). */
    public static final class WebviewMessage {
        public String type;
        public String sha;
        public String ref;
        /** Branch to merge in, for requestMergePreview / merge. */
        public String source;
        /** Merge-commit message for the merge action. */
        public String message;
        /** Force a merge commit even when a fast-forward is possible. */
        public Boolean noFastForward;
        /** Collapse the merged branch into a single commit (git merge --squash). */
        public Boolean squash;
        /** Branch name for createBranch / deleteBranch / renameBranch / pushBranch. */
        public String name;
        /** Checkout-after-create choice from the SVN-style dialog. */
        public Boolean checkout;
        /** Stash stack index for stashApply / stashPop / stashDrop. */
        public Integer index;
        /** File path for requestFileDiff / requestFileContent / requestMergeFileDiff. */
        public String path;
        /** Parent-side path for requestFileDiff on a renamed file. */
        public String oldPath;
        /** File status for requestFileDiff / requestMergeFileDiff. */
        public String status;
        /** Custom git binary path for setGitPath; null means use the built-in git. */
        public String gitPath;
        /** Target URL for openExternal. */
        public String url;
        /** Selected file paths for commitWorkingTreeChanges. */
        public List<String> files = Collections.emptyList();

        /** Parse one webview-&gt;host JSON message, or return null if malformed. */
        public static WebviewMessage fromJson(String json) {
            Object parsed;
            try {
                parsed = Json.parse(json);
            } catch (RuntimeException e) {
                return null;
            }
            if (!(parsed instanceof Map)) {
                return null;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> m = (Map<String, Object>) parsed;
            WebviewMessage msg = new WebviewMessage();
            msg.type = str(m, "type");
            msg.sha = str(m, "sha");
            msg.ref = str(m, "ref");
            msg.source = str(m, "source");
            msg.message = str(m, "message");
            msg.noFastForward = bool(m, "noFastForward");
            msg.squash = bool(m, "squash");
            msg.name = str(m, "name");
            msg.checkout = bool(m, "checkout");
            msg.index = intVal(m, "index");
            msg.path = str(m, "path");
            msg.oldPath = str(m, "oldPath");
            msg.status = str(m, "status");
            msg.gitPath = str(m, "gitPath");
            msg.url = str(m, "url");
            msg.files = stringList(m, "files");
            return msg;
        }

        private static String str(Map<String, Object> m, String key) {
            Object v = m.get(key);
            return v instanceof String ? (String) v : null;
        }

        private static Boolean bool(Map<String, Object> m, String key) {
            Object v = m.get(key);
            return v instanceof Boolean ? (Boolean) v : null;
        }

        private static Integer intVal(Map<String, Object> m, String key) {
            Object v = m.get(key);
            return v instanceof Number ? Integer.valueOf(((Number) v).intValue()) : null;
        }

        private static List<String> stringList(Map<String, Object> m, String key) {
            Object v = m.get(key);
            if (!(v instanceof List)) {
                return Collections.emptyList();
            }
            List<String> out = new java.util.ArrayList<>();
            for (Object item : (List<?>) v) {
                if (item instanceof String) {
                    out.add((String) item);
                }
            }
            return out;
        }
    }
}
