// Stage the shared web renderer bundle into the Apache NetBeans plugin module
// (netbeans/src/main/resources/com/hunkontech/revgraph/webview/). Run after
// build:webview. Mirrors scripts/copy-jetbrains-assets.mjs — the NetBeans host
// embeds the SAME bundle in a JavaFX WebView (see NetBeansWebViewHost.kt).
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "packages/graph-webview/dist");
const dst = resolve(root, "netbeans/src/main/resources/com/hunkontech/revgraph/webview");

// index.html is a static file checked into the module itself (like
// jetbrains/common/.../webview/index.html) — only the built bundle is copied here.
await mkdir(dst, { recursive: true });
for (const f of ["main.js", "main.css"]) {
  await cp(resolve(src, f), resolve(dst, f));
}
await cp(resolve(src, "schematics"), resolve(dst, "schematics"), { recursive: true });
console.log("copied webview bundle -> netbeans/src/main/resources/com/hunkontech/revgraph/webview/");
