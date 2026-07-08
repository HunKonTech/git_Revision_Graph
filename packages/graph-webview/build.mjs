import * as esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

// Version shown in the footer. The committed root package.json holds a
// placeholder; the real current-release version lives in the repo's
// EXTENSION_VERSION variable, which the release CI never commits back. So an
// explicit APP_VERSION env var (set by the demo-deploy workflow from that
// variable) wins when present, and the package.json value is the local fallback.
const rootPkg = JSON.parse(await readFile(resolve(__dirname, "../../package.json"), "utf8"));
const appVersion = process.env.APP_VERSION?.trim() || rootPkg.version;

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [resolve(__dirname, "src/main.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: resolve(__dirname, "dist/main.js"),
  loader: { ".css": "css" },
  sourcemap: true,
  logLevel: "info",
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
};

// Emit standalone .svg files of the dialog/display schematics from the shared,
// DOM-free schematics module — the same source the settings UI inlines — so the
// pictures on disk always follow the code. Copied into both hosts by the build.
async function emitSchematics() {
  const tmp = resolve(__dirname, "dist/.schematics.node.mjs");
  await esbuild.build({
    entryPoints: [resolve(__dirname, "src/schematics.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    outfile: tmp,
    logLevel: "silent",
  });
  const mod = await import(pathToFileURL(tmp).href);
  const outDir = resolve(__dirname, "dist/schematics");
  await mkdir(outDir, { recursive: true });
  for (const { id, svg } of mod.ALL_SCHEMATICS) {
    await writeFile(resolve(outDir, `${id}.svg`), svg(), "utf8");
  }
  await rm(tmp, { force: true });
  console.log(`emitted ${mod.ALL_SCHEMATICS.length} schematic .svg files -> dist/schematics/`);
}

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await emitSchematics();
  console.log("watching graph-webview…");
} else {
  await esbuild.build(options);
  await emitSchematics();
}
