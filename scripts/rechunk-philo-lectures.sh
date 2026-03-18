#!/usr/bin/env bash
#
# Rechunk all lectures from the philo-von-freisinn assistant manifest.
# Run from ragprep directory. Requires RAGKEEP_PROJECT_ROOT or assumes
# ragkeep is a sibling of ragprep.
#
# Usage:
#   cd ragprep && ../ragkeep/scripts/rechunk-philo-lectures.sh
#   RAGKEEP_PROJECT_ROOT=/path/to/ragkeep cd ragprep && /path/to/rechunk-philo-lectures.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGKEEP_ROOT="${RAGKEEP_PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
RAGPREP_ROOT="${RAGPREP_ROOT:-$(cd "$RAGKEEP_ROOT/../ragprep" 2>/dev/null && pwd || echo "")}"

if [[ -z "$RAGPREP_ROOT" || ! -d "$RAGPREP_ROOT" ]]; then
    echo "Error: ragprep not found. Set RAGPREP_ROOT or ensure ragkeep/../ragprep exists." >&2
    exit 1
fi

MANIFEST="$RAGKEEP_ROOT/assistants/philo-von-freisinn/assistant-manifest.yaml"
if [[ ! -f "$MANIFEST" ]]; then
    echo "Error: Assistant manifest not found: $MANIFEST" >&2
    exit 1
fi

export RAGKEEP_PROJECT_ROOT="$RAGKEEP_ROOT"
cd "$RAGPREP_ROOT"

echo "Rechunking lectures from $MANIFEST"
echo "RAGKEEP_PROJECT_ROOT=$RAGKEEP_ROOT"
echo ""

BOOK_DIRS=$(node scripts/list-lecture-book-dirs.mjs "$MANIFEST")
COUNT=0

while IFS= read -r book_dir; do
    [[ -z "$book_dir" ]] && continue
    if [[ ! -d "$book_dir" ]]; then
        echo "Warning: Book directory not found, skipping: $book_dir" >&2
        continue
    fi
    COUNT=$((COUNT + 1))
    echo "[$COUNT] rag:chunk $book_dir"
    yarn rp rag:chunk "$book_dir" || {
        echo "Error: rag:chunk failed for $book_dir" >&2
        exit 1
    }
    echo ""
done <<< "$BOOK_DIRS"

echo "Done. Rechunked $COUNT lecture book(s)."
