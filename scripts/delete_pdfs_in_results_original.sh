#!/usr/bin/env bash
# Löscht alle *.pdf-Dateien in books/**/results/original

set -euo pipefail

BOOKS_DIR="${1:-$(dirname "$0")/../books}"
cd "$(dirname "$0")/.."

count=0
while IFS= read -r -d '' file; do
  echo "Lösche: $file"
  rm -f "$file"
  ((count++)) || true
done < <(find "$BOOKS_DIR" -path "*/results/original/*" -name "*.pdf" -print0 2>/dev/null)

echo "Fertig: $count PDF-Datei(en) gelöscht."
