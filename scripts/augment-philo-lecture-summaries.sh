#!/usr/bin/env bash
# Regeneriert alle Zusammenfassungen der primary- und secondary-lectures von Philo.
# Verwendet: yarn rp rag:augment:summaries <bookDir> --force
#
# Ausführung: Von ragkeep-Root aus. Erwartet ragprep als Geschwisterverzeichnis.
# Option: --dry-run  Nur anzeigen, welche Bücher verarbeitet würden.

set -euo pipefail
shopt -s nullglob 2>/dev/null || true

DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGKEEP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)"
MANIFEST="$RAGKEEP_ROOT/assistants/philo-von-freisinn/assistant-manifest.yaml"
BOOKS_ROOT="$RAGKEEP_ROOT/books"

# Zyklus -> GA (aus rudolf-steiner-ga-vortrag-verzeichnis.yaml)
zyklus_to_ga() {
  case "$1" in
    33) echo 151 ;;
    *) echo "" ;;
  esac
}

if [[ ! -f "$MANIFEST" ]]; then
  echo "Fehler: Manifest nicht gefunden: $MANIFEST" >&2
  exit 1
fi

if [[ ! -d "$RAGPREP_ROOT" ]] || [[ ! -f "$RAGPREP_ROOT/package.json" ]]; then
  echo "Fehler: ragprep nicht gefunden: $RAGPREP_ROOT" >&2
  exit 1
fi

# Sammle GA-Nummern aus primary-lectures und secondary-lectures
GAS=()
while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  if [[ "$line" =~ ^Zyklus[[:space:]]*([0-9]+)$ ]]; then
    z="${BASH_REMATCH[1]}"
    ga=$(zyklus_to_ga "$z")
    [[ -n "$ga" ]] && GAS+=("$ga")
  elif [[ "$line" =~ ^GA[[:space:]]+([0-9]+[a-zA-Z]?)$ ]]; then
    GAS+=("$(echo "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')")
  fi
done < <(
  sed -n '/^primary-lectures:/,/^[a-z]/p' "$MANIFEST" | grep -E "^\s+-\s+" | sed 's/^[[:space:]]*-[[:space:]]*//'
  sed -n '/^secondary-lectures:/,/^[a-z]/p' "$MANIFEST" | grep -E "^\s+-\s+" | sed 's/^[[:space:]]*-[[:space:]]*//'
)

# Finde Buchordner pro GA und führe augment:summaries aus
for ga in "${GAS[@]}"; do
  # Suche Ordner, dessen Name mit #GA endet (case-insensitive)
  found=""
  for d in "$BOOKS_ROOT"/*; do
    [[ -d "$d" ]] || continue
    base=$(basename "$d")
    if [[ "$base" =~ \#([0-9]+[a-zA-Z]?)$ ]]; then
      ga_suffix=$(echo "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')
      if [[ "$ga_suffix" == "$ga" ]]; then
        found="$d"
        break
      fi
    fi
  done
  if [[ -z "$found" ]]; then
    echo "Warnung: Kein Buchordner für GA $ga gefunden, überspringe." >&2
    continue
  fi
  book_dir=$(basename "$found")
  echo "=== GA $ga: $book_dir ==="
  if [[ -n "$DRY_RUN" ]]; then
    echo "  [dry-run] würde ausführen: yarn rp rag:augment:summaries $found --force"
  else
    (cd "$RAGPREP_ROOT" && yarn rp rag:augment:summaries "$found" --force)
  fi
done

echo "Fertig."
