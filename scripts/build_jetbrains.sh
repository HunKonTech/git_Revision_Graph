#!/usr/bin/env bash
# Builds the JetBrains-family plugin (both flavors: DevEco Studio + IntelliJ
# IDEA/JetBrains IDEs) from the shared jetbrains/common/ Kotlin codebase and
# copies the resulting ZIPs into dist/installers/. Cross-platform counterpart
# of the JetBrains section in scripts/build-installers.ps1 (which is
# Windows/pwsh-only because it also builds the VS C# VSIX).
#
# Prerequisites: JDK 17, Gradle (either jetbrains/gradlew or a system `gradle`
# on PATH), Node.js 18+. See jetbrains/BUILD.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JETBRAINS_DIR="$ROOT/jetbrains"
OUT_DIR="$ROOT/dist/installers"

mkdir -p "$OUT_DIR"

echo "==> Building protocol + graph-core"
npx tsc -b "$ROOT/packages/protocol" "$ROOT/packages/graph-core"

echo "==> Building graph-webview"
npm run --prefix "$ROOT" build:webview

echo "==> Staging shared web renderer into jetbrains/common/"
npm run --prefix "$ROOT" build:jetbrains-assets

if [ -x "$JETBRAINS_DIR/gradlew" ]; then
  GRADLE_CMD="$JETBRAINS_DIR/gradlew"
elif command -v gradle >/dev/null 2>&1; then
  GRADLE_CMD="gradle"
else
  echo "error: neither jetbrains/gradlew nor a system 'gradle' was found on PATH." >&2
  echo "See jetbrains/BUILD.md: run 'gradle wrapper --gradle-version 8.9' inside jetbrains/ once." >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "error: no JDK found on PATH (JDK 17 required). See jetbrains/BUILD.md." >&2
  exit 1
fi

echo "==> Building both JetBrains plugin flavors (Gradle)"
(cd "$JETBRAINS_DIR" && "$GRADLE_CMD" buildPlugin --no-daemon)

copy_flavor_zip() {
  local flavor_dir="$1" dest_name="$2"
  local built_zip
  built_zip=$(ls -t "$JETBRAINS_DIR/$flavor_dir/build/distributions/"*.zip 2>/dev/null | head -n1 || true)
  if [ -z "$built_zip" ]; then
    echo "error: no build output found under $JETBRAINS_DIR/$flavor_dir/build/distributions/" >&2
    exit 1
  fi
  cp "$built_zip" "$OUT_DIR/$dest_name"
  echo "    JetBrains plugin ($flavor_dir): $OUT_DIR/$dest_name"
}

copy_flavor_zip "deveco" "RevisionGraph-deveco.zip"
copy_flavor_zip "intellij" "RevisionGraph-jetbrains.zip"

echo ""
echo "Done: $OUT_DIR/RevisionGraph-deveco.zip, $OUT_DIR/RevisionGraph-jetbrains.zip"
