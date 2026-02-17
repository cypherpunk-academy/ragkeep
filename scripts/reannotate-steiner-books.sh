#!/usr/bin/env bash
# Re-annotate all Rudolf Steiner books from philo-von-freisinn assistant:
# 1. Delete phase5 .md file
# 2. Run yarn rp text:annotate <book-dir> --yes
#
# Run from ragkeep root. Expects ragprep as sibling directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGKEEP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)"
MANIFEST="$RAGKEEP_ROOT/assistants/philo-von-freisinn/assistant-manifest.yaml"
BOOKS_ROOT="$RAGKEEP_ROOT/books"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Fehler: Manifest nicht gefunden: $MANIFEST" >&2
  exit 1
fi

if [[ ! -d "$RAGPREP_ROOT" ]] || [[ ! -f "$RAGPREP_ROOT/package.json" ]]; then
  echo "Fehler: ragprep nicht gefunden: $RAGPREP_ROOT" >&2
  exit 1
fi

# Extract Rudolf Steiner books from primary-books and secondary-books via Node (ragkeep has js-yaml)
BOOKS=$(cd "$RAGKEEP_ROOT" && node -e "
const yaml = require('js-yaml');
const fs = require('fs');
const m = yaml.load(fs.readFileSync('$MANIFEST', 'utf8'));
const primary = m['primary-books'] || [];
const secondary = m['secondary-books'] || [];
const all = [...new Set([...primary, ...secondary])];
const steiner = all
  .filter(b => String(b).startsWith('Rudolf_Steiner'))
  .map(b => String(b).replace(/\\\\#/g, '#'));
console.log(steiner.join('\n'));
")

if [[ -z "$BOOKS" ]]; then
  echo "Keine Rudolf-Steiner-Bücher in primary-books/secondary-books gefunden." >&2
  exit 1
fi

echo "=== Rudolf-Steiner-Bücher aus philo-von-freisinn ==="
echo "$BOOKS"
echo ""

COUNT=0
for BOOK_ID in $BOOKS; do
  BOOK_DIR="$BOOKS_ROOT/$BOOK_ID"
  PHASE5_MD="$BOOK_DIR/results/phase5/$BOOK_ID.md"

  if [[ ! -d "$BOOK_DIR" ]]; then
    echo "⏭ Überspringe (Buchverzeichnis fehlt): $BOOK_ID"
    continue
  fi

  COUNT=$((COUNT + 1))
  echo "--- [$COUNT] $BOOK_ID ---"

  if [[ -f "$PHASE5_MD" ]]; then
    rm -f "$PHASE5_MD"
    echo "  phase5 gelöscht: $PHASE5_MD"
  else
    echo "  (kein phase5 .md vorhanden)"
  fi

  (cd "$RAGPREP_ROOT" && yarn rp text:annotate "$BOOK_DIR" --yes)
  echo ""
done

echo "=== Fertig: $COUNT Bücher verarbeitet ==="
