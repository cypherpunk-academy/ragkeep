#!/usr/bin/env bash
# Führt rag:augment:summaries und rag:augment:quotes für die secondary-books
# (Zeilen 27–36) von Philo aus dem assistant-manifest aus.
#
# Verwendet:
#   yarn rp rag:augment:summaries <bookDir> --force
#   yarn rp rag:augment:quotes <bookDir> --force
#
# Ausführung: Von ragkeep-Root aus. Erwartet ragprep als Geschwisterverzeichnis.
# Option: --dry-run  Nur anzeigen, welche Befehle ausgeführt würden.

set -euo pipefail

DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGKEEP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)"
BOOKS_ROOT="$RAGKEEP_ROOT/books"

# secondary-books aus assistant-manifest Zeilen 27–36 (ohne Duplikate)
BOOKS=(
  Lawrence_Lessig#Code_Version_2_0#1
  Richard_M_Stallman#Free_Software_Free_Society#1
  Julian_Assange#Julian_Assange_in_his_own_words
  Julian_Assange#Various_Interviews_and_Articles#1
)

if [[ ! -d "$RAGPREP_ROOT" ]] || [[ ! -f "$RAGPREP_ROOT/package.json" ]]; then
  echo "Fehler: ragprep nicht gefunden: $RAGPREP_ROOT" >&2
  exit 1
fi

for book_id in "${BOOKS[@]}"; do
  book_dir="$BOOKS_ROOT/$book_id"
  if [[ ! -d "$book_dir" ]]; then
    echo "Warnung: Buchordner nicht gefunden: $book_dir" >&2
    continue
  fi

  echo "=== $book_id ==="
  if [[ -n "$DRY_RUN" ]]; then
    echo "  [dry-run] würde ausführen: yarn rp rag:augment:summaries $book_dir --force"
    echo "  [dry-run] würde ausführen: yarn rp rag:augment:quotes $book_dir --force"
  else
    (cd "$RAGPREP_ROOT" && yarn rp rag:augment:summaries "$book_dir" --force)
    (cd "$RAGPREP_ROOT" && yarn rp rag:augment:quotes "$book_dir" --force)
  fi
done

echo "Fertig."
