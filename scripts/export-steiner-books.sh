#!/usr/bin/env bash
# Export all Rudolf Steiner books of an assistant via ragprep text:export.
# Usage: ./export-steiner-books.sh [assistant-name] [--release]
#   assistant-name defaults to philo-von-freisinn
#   --release: zusätzlich _released.md im Buchordner erstellen
#
# Run from ragkeep root. Expects ragprep as sibling directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGKEEP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)"

# Parse args: first non-flag = assistant, rest = extra args for text:export (e.g. --release)
EXTRA_ARGS=()
ASSISTANT="philo-von-freisinn"
for arg in "$@"; do
  if [[ "$arg" == --* ]]; then
    EXTRA_ARGS+=("$arg")
  elif [[ -z "${ASSISTANT_SET:-}" ]]; then
    ASSISTANT="$arg"
    ASSISTANT_SET=1
  else
    EXTRA_ARGS+=("$arg")
  fi
done
MANIFEST="$RAGKEEP_ROOT/assistants/$ASSISTANT/assistant-manifest.yaml"
BOOKS_ROOT="$RAGKEEP_ROOT/books"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Fehler: Manifest nicht gefunden: $MANIFEST" >&2
  echo "Verwendung: $0 [assistant-name]" >&2
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

echo "=== Export Rudolf-Steiner-Bücher (Assistant: $ASSISTANT) ==="
echo "$BOOKS"
echo ""

COUNT=0
for BOOK_ID in $BOOKS; do
  BOOK_DIR="$BOOKS_ROOT/$BOOK_ID"

  if [[ ! -d "$BOOK_DIR" ]]; then
    echo "⏭ Überspringe (Buchverzeichnis fehlt): $BOOK_ID"
    continue
  fi

  COUNT=$((COUNT + 1))
  echo "--- [$COUNT] $BOOK_ID ---"

  if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
    (cd "$RAGPREP_ROOT" && yarn rp text:export "$BOOK_DIR" "${EXTRA_ARGS[@]}")
  else
    (cd "$RAGPREP_ROOT" && yarn rp text:export "$BOOK_DIR")
  fi
  echo ""
done

echo "=== Fertig: $COUNT Bücher exportiert ==="
