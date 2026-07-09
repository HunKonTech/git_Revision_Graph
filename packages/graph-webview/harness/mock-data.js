// Mock GraphData for the browser harness — a deliberately busy repo: a long main
// trunk, several feature branches that fork off and merge back, a couple of still-
// open branches, tags, stashes, and a long-lived `feature/payments` branch that
// repeatedly merges *different* main commits back into itself before it finally
// lands. This exercises the lane-assignment, phantom-node and merge-edge logic
// much harder than a two-branch toy graph.
//
// Ordering: newest-first (children before parents), as the layout requires. Every
// parent has an earlier date than its child, so a plain date-descending order is
// also a valid topological order.
window.__MOCK_GRAPH__ = {
  repoName: "demo-repo",
  gitCommand: "git log --exclude=refs/stash --all --topo-order --max-count=500",
  head: "m12aaaa",
  commits: [
    // ---- main trunk (newest first) ----
    { sha: "m12aaaa", parents: ["m11aaaa", "no2aaaa"], summary: "Merge feature/notifications", author: "Ben", authorEmail: "ben@example.com", date: "2026-03-20T10:00:00Z" },
    // feature/experimental — still open, forked off m11 (perf work).
    { sha: "ex2aaaa", parents: ["ex1aaaa"], summary: "Spike: benchmark harness", author: "Cara", authorEmail: "cara@example.com", date: "2026-03-18T16:00:00Z" },
    { sha: "ex1aaaa", parents: ["m11aaaa"], summary: "Spike: experiment with new renderer", author: "Cara", authorEmail: "cara@example.com", date: "2026-03-16T14:00:00Z" },
    { sha: "no2aaaa", parents: ["no1aaaa"], summary: "Notifications: toast UI", author: "Ana", authorEmail: "ana@example.com", date: "2026-03-16T11:00:00Z" },
    { sha: "m11aaaa", parents: ["m10aaaa"], summary: "Perf: cache query results", author: "Ben", authorEmail: "ben@example.com", date: "2026-03-14T09:00:00Z" },
    { sha: "m10aaaa", parents: ["m09aaaa", "pa5aaaa"], summary: "Merge feature/payments", author: "Ben", authorEmail: "ben@example.com", date: "2026-03-10T17:00:00Z" },
    { sha: "pa5aaaa", parents: ["pam3aaa"], summary: "Payments: refunds flow", author: "Dan", authorEmail: "dan@example.com", date: "2026-03-08T15:00:00Z" },
    { sha: "no1aaaa", parents: ["m09aaaa"], summary: "Notifications: websocket channel", author: "Ana", authorEmail: "ana@example.com", date: "2026-03-02T10:00:00Z" },
    // 3rd main→payments merge (release 1.0.0 pulled into the branch).
    { sha: "pam3aaa", parents: ["pa4aaaa", "m09aaaa"], summary: "Merge main into feature/payments", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-28T09:30:00Z" },
    { sha: "pa4aaaa", parents: ["pam2aaa"], summary: "Payments: receipts", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-27T13:00:00Z" },
    { sha: "m09aaaa", parents: ["m08aaaa"], summary: "Release 1.0.0", author: "Ana", authorEmail: "ana@example.com", date: "2026-02-25T18:00:00Z" },
    // bugfix/crash — still open, forked off the hotfix.
    { sha: "bf1aaaa", parents: ["m08aaaa"], summary: "Investigate crash logs", author: "Cara", authorEmail: "cara@example.com", date: "2026-02-20T12:00:00Z" },
    // 2nd main→payments merge (hotfix pulled into the branch).
    { sha: "pam2aaa", parents: ["pa3aaaa", "m08aaaa"], summary: "Merge main into feature/payments", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-19T09:30:00Z" },
    { sha: "m08aaaa", parents: ["m07aaaa"], summary: "Hotfix: null pointer in parser", author: "Ben", authorEmail: "ben@example.com", date: "2026-02-18T16:00:00Z" },
    { sha: "pa3aaaa", parents: ["pam1aaa"], summary: "Payments: server-side validation", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-16T11:00:00Z" },
    { sha: "m07aaaa", parents: ["m06aaaa", "se3aaaa"], summary: "Merge feature/search", author: "Ben", authorEmail: "ben@example.com", date: "2026-02-14T17:00:00Z" },
    { sha: "se3aaaa", parents: ["se2aaaa"], summary: "Search: debounce input", author: "Ana", authorEmail: "ana@example.com", date: "2026-02-12T10:00:00Z" },
    { sha: "se2aaaa", parents: ["se1aaaa"], summary: "Search: results UI", author: "Ana", authorEmail: "ana@example.com", date: "2026-02-08T14:00:00Z" },
    // 1st main→payments merge (contributor docs pulled into the branch).
    { sha: "pam1aaa", parents: ["pa2aaaa", "m06aaaa"], summary: "Merge main into feature/payments", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-07T09:30:00Z" },
    { sha: "pa2aaaa", parents: ["pa1aaaa"], summary: "Payments: card form", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-06T13:00:00Z" },
    { sha: "m06aaaa", parents: ["m05aaaa"], summary: "Update contributor docs", author: "Ana", authorEmail: "ana@example.com", date: "2026-02-05T09:00:00Z" },
    { sha: "se1aaaa", parents: ["m04aaaa"], summary: "Search: add index builder", author: "Ana", authorEmail: "ana@example.com", date: "2026-02-04T10:00:00Z" },
    { sha: "pa1aaaa", parents: ["m04aaaa"], summary: "Payments: gateway skeleton", author: "Dan", authorEmail: "dan@example.com", date: "2026-02-03T11:00:00Z" },
    { sha: "m05aaaa", parents: ["m04aaaa", "la2aaaa"], summary: "Merge feature/login", author: "Ben", authorEmail: "ben@example.com", date: "2026-02-02T16:00:00Z" },
    { sha: "la2aaaa", parents: ["la1aaaa"], summary: "Add login form validation", author: "Ben", authorEmail: "ben@example.com", date: "2026-01-28T15:00:00Z" },
    { sha: "la1aaaa", parents: ["m03aaaa"], summary: "Scaffold login page", author: "Ben", authorEmail: "ben@example.com", date: "2026-01-22T09:00:00Z" },
    { sha: "m04aaaa", parents: ["m03aaaa"], summary: "Release 0.1.0", author: "Ana", authorEmail: "ana@example.com", date: "2026-01-20T18:00:00Z" },
    { sha: "m03aaaa", parents: ["m02aaaa"], summary: "Set up CI pipeline", author: "Ben", authorEmail: "ben@example.com", date: "2026-01-12T12:00:00Z" },
    { sha: "m02aaaa", parents: ["m01aaaa"], summary: "Add build configuration", author: "Ana", authorEmail: "ana@example.com", date: "2026-01-08T10:00:00Z" },
    { sha: "m01aaaa", parents: [], summary: "Initial commit", author: "Ana", authorEmail: "ana@example.com", date: "2026-01-05T08:00:00Z" },
  ],
  refs: [
    { name: "main", type: "localBranch", targetSha: "m12aaaa", isCurrent: true },
    { name: "head", type: "head", targetSha: "m12aaaa" },
    // origin/main a couple of commits behind the local tip.
    { name: "origin/main", type: "remoteBranch", targetSha: "m11aaaa", remote: "origin" },

    // Merged feature branches (kept around after landing).
    { name: "feature/login", type: "localBranch", targetSha: "la2aaaa" },
    { name: "origin/feature/login", type: "remoteBranch", targetSha: "la2aaaa", remote: "origin" },
    { name: "feature/search", type: "localBranch", targetSha: "se3aaaa" },
    // The long-lived branch that repeatedly merged main into itself.
    { name: "feature/payments", type: "localBranch", targetSha: "pa5aaaa" },
    { name: "origin/feature/payments", type: "remoteBranch", targetSha: "pam3aaa", remote: "origin" },
    { name: "feature/notifications", type: "localBranch", targetSha: "no2aaaa" },

    // Still-open branches (no merge back into main yet).
    { name: "bugfix/crash", type: "localBranch", targetSha: "bf1aaaa" },
    { name: "feature/experimental", type: "localBranch", targetSha: "ex2aaaa" },

    // Tags & release lines.
    { name: "v0.1.0", type: "tag", targetSha: "m04aaaa" },
    { name: "v1.0.0", type: "tag", targetSha: "m09aaaa" },
    { name: "release/1.0", type: "localBranch", targetSha: "m09aaaa" },
    { name: "origin/release/1.0", type: "remoteBranch", targetSha: "m09aaaa", remote: "origin" },
  ],
  // Two stashes off different base commits — drawn in their own column.
  stashes: [
    { index: 0, sha: "st00000", baseSha: "m12aaaa", message: "WIP on main: tidy header", date: "2026-03-19T09:00:00Z" },
    { index: 1, sha: "st11111", baseSha: "m09aaaa", message: "WIP on release/1.0: hotfix", date: "2026-02-26T14:00:00Z" },
  ],
};

// Per-commit file changes for the "View changes…" dialog. The real hosts compute
// these from git; here they're hand-authored so the demo shows added / modified /
// deleted / renamed files and a side-by-side diff with no git backend.
window.__MOCK_CHANGES__ = {
  m01aaaa: [
    {
      path: "README.md",
      status: "added",
      oldText: "",
      newText: "# Demo Repo\n\nA tiny example.\n",
    },
    {
      path: "package.json",
      status: "added",
      oldText: "",
      newText: "{\n  \"name\": \"demo-repo\",\n  \"version\": \"0.1.0\"\n}\n",
    },
  ],
  la1aaaa: [
    {
      path: "src/login/LoginPage.tsx",
      status: "added",
      oldText: "",
      newText:
        "export function LoginPage() {\n" +
        "  return (\n" +
        "    <form>\n" +
        "      <input name=\"email\" />\n" +
        "      <input name=\"password\" type=\"password\" />\n" +
        "      <button>Sign in</button>\n" +
        "    </form>\n" +
        "  );\n" +
        "}\n",
    },
    {
      path: "src/routes.ts",
      status: "modified",
      oldText: "export const routes = [\n  { path: \"/\", page: \"Home\" },\n];\n",
      newText:
        "export const routes = [\n" +
        "  { path: \"/\", page: \"Home\" },\n" +
        "  { path: \"/login\", page: \"LoginPage\" },\n" +
        "];\n",
    },
  ],
  la2aaaa: [
    {
      path: "src/login/LoginPage.tsx",
      status: "modified",
      oldText:
        "export function LoginPage() {\n" +
        "  return (\n" +
        "    <form>\n" +
        "      <input name=\"email\" />\n" +
        "      <input name=\"password\" type=\"password\" />\n" +
        "      <button>Sign in</button>\n" +
        "    </form>\n" +
        "  );\n" +
        "}\n",
      newText:
        "export function LoginPage() {\n" +
        "  const [error, setError] = useState(\"\");\n" +
        "  function validate(email) {\n" +
        "    if (!email.includes(\"@\")) setError(\"Invalid email\");\n" +
        "  }\n" +
        "  return (\n" +
        "    <form>\n" +
        "      <input name=\"email\" onBlur={e => validate(e.target.value)} />\n" +
        "      <input name=\"password\" type=\"password\" />\n" +
        "      {error && <p className=\"err\">{error}</p>}\n" +
        "      <button>Sign in</button>\n" +
        "    </form>\n" +
        "  );\n" +
        "}\n",
    },
    {
      path: "src/login/validation.ts",
      status: "added",
      oldText: "",
      newText:
        "export function isEmail(v) {\n  return /^[^@]+@[^@]+$/.test(v);\n}\n",
    },
    {
      path: "src/login/legacy-auth.js",
      status: "deleted",
      oldText: "// old auth flow\nexport function authOld() {\n  return false;\n}\n",
      newText: "",
    },
  ],
  se1aaaa: [
    {
      path: "src/search/index.ts",
      status: "added",
      oldText: "",
      newText:
        "export function buildIndex(docs) {\n" +
        "  return docs.map((d, i) => ({ id: i, text: d.toLowerCase() }));\n" +
        "}\n",
    },
  ],
  pa2aaaa: [
    {
      path: "src/payments/CardForm.tsx",
      status: "added",
      oldText: "",
      newText:
        "export function CardForm() {\n" +
        "  return (\n" +
        "    <form>\n" +
        "      <input name=\"number\" inputMode=\"numeric\" />\n" +
        "      <input name=\"cvc\" maxLength={4} />\n" +
        "    </form>\n" +
        "  );\n" +
        "}\n",
    },
  ],
  pam2aaa: [
    {
      path: "src/parser.ts",
      status: "modified",
      oldText: "export function parse(s) {\n  return s.node.value;\n}\n",
      newText: "export function parse(s) {\n  return s?.node?.value ?? null;\n}\n",
    },
  ],
  m06aaaa: [
    {
      path: "docs/CONTRIBUTING.md",
      oldPath: "CONTRIBUTING.md",
      status: "renamed",
      oldText: "# Contributing\n\nOpen a PR.\n",
      newText: "# Contributing\n\nOpen a PR against `main`.\n\n## Style\n\nRun `npm run lint`.\n",
    },
  ],
  no2aaaa: [
    {
      path: "src/notifications/Toast.tsx",
      status: "added",
      oldText: "",
      newText:
        "export function Toast({ message }) {\n" +
        "  return <div className=\"toast\">{message}</div>;\n" +
        "}\n",
    },
  ],
  bf1aaaa: [
    {
      path: "docs/crash-notes.md",
      status: "added",
      oldText: "",
      newText: "# Crash notes\n\nHappens on startup when config is missing.\n",
    },
  ],
};
