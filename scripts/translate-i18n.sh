#!/usr/bin/env bash
# Runs KO_language_translator/main.py against the shared webview i18n dictionary
# (packages/graph-webview/src/i18n.ts), filling in every language from English
# via Google Translate.
#
# English and Hungarian are hand-maintained and are ALWAYS excluded (en is also
# the translation source). Add more languages to skip with -x / --exclude.
#
# Usage:
#   scripts/translate-i18n.sh                # fill in only missing keys (--new-only)
#   scripts/translate-i18n.sh --force        # re-translate every non-en/hu key
#   scripts/translate-i18n.sh -x fr,de       # also leave French & German alone
#   scripts/translate-i18n.sh -j 8           # 8 parallel workers (default: 4)
#   scripts/translate-i18n.sh --force -x fr  # combine
#
# This is the same command the "Translate i18n" GitHub workflow runs; use it to
# translate locally before pushing, or when iterating on new UI strings.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/KO_language_translator/main.py"
I18N_FILE="$ROOT/packages/graph-webview/src/i18n.ts"

MODE="--new-only"
EXTRA_EXCLUDE=""
WORKERS="4"
while [ $# -gt 0 ]; do
  case "$1" in
    --force)          MODE="--force"; shift ;;
    --new-only)       MODE="--new-only"; shift ;;
    -x|--exclude)     EXTRA_EXCLUDE="${2:-}"; shift 2 ;;
    -j|--workers)     WORKERS="${2:-4}"; shift 2 ;;
    -h|--help)        sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# en + hu are never translated; append anything the caller asked to skip too.
EXCLUDE="hu,en"
[ -n "$EXTRA_EXCLUDE" ] && EXCLUDE="$EXCLUDE,$EXTRA_EXCLUDE"

# Pick an interpreter: prefer python3, fall back to python.
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Python 3 not found on PATH." >&2; exit 1; }

# Ensure the one dependency is importable; install it on demand.
if ! "$PY" -c "import deep_translator" >/dev/null 2>&1; then
  echo "==> Installing deep-translator"
  "$PY" -m pip install --upgrade deep-translator \
    || "$PY" -m pip install --upgrade --break-system-packages deep-translator
fi

echo "==> Translating $I18N_FILE"
echo "    mode: $MODE   excluded: $EXCLUDE   workers: $WORKERS"
"$PY" "$SCRIPT" "$MODE" --i18n-file "$I18N_FILE" --exclude-languages "$EXCLUDE" --workers "$WORKERS"

echo ""
echo "Done. Review the diff:  git diff -- packages/graph-webview/src/i18n.ts"
