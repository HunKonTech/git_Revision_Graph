// Stage the shared web renderer bundle into the JetBrains-family plugin's
// SHARED module (jetbrains/common/src/main/resources/webview/), so the
// :intellij build (installable across the whole IntelliJ Platform family)
// picks it up. Run after build:webview. Mirrors scripts/copy-vs-assets.mjs.
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "packages/graph-webview/dist");
const dst = resolve(root, "jetbrains/common/src/main/resources/webview");

// index.html is a static file checked into jetbrains/common/ itself (like
// vs/webview/index.html) — only the built bundle is copied here.
await mkdir(dst, { recursive: true });
for (const f of ["main.js", "main.css"]) {
  await cp(resolve(src, f), resolve(dst, f));
}
await cp(resolve(src, "schematics"), resolve(dst, "schematics"), { recursive: true });
console.log("copied webview bundle -> jetbrains/common/src/main/resources/webview/");
