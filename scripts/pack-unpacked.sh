#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/click-scrape-unpacked.zip"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to pack the Load-unpacked archive" >&2
  exit 1
fi

rm -f "$OUT"
(
  cd "$ROOT"
  zip -r "$OUT" \
    manifest.json \
    README.md \
    demo.html \
    demo-page-2.html \
    src \
    icons \
    -x "*.DS_Store" \
    -x "*__MACOSX*"
)

echo "Wrote $OUT"
unzip -l "$OUT"
