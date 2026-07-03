// Stage the shared web renderer bundle into the Eclipse plugin
// (eclipse/com.hunkontech.revgraph/webview/). Run after build:webview.
// Mirrors scripts/copy-jetbrains-assets.mjs and scripts/copy-vs-assets.mjs.
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "packages/graph-webview/dist");
const dst = resolve(root, "eclipse/com.hunkontech.revgraph/webview");

// index.html is a static file checked into the plugin itself (like
// vs/webview/index.html and jetbrains/common/.../webview/index.html) — only the
// built bundle is copied here.
await mkdir(dst, { recursive: true });
for (const f of ["main.js", "main.css"]) {
  await cp(resolve(src, f), resolve(dst, f));
}
await cp(resolve(src, "schematics"), resolve(dst, "schematics"), { recursive: true });
console.log("copied webview bundle -> eclipse/com.hunkontech.revgraph/webview/");
