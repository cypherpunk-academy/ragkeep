#!/usr/bin/env bash
# Führt text:annotate (nur Seitenverweise, Schritt 4) für alle Bücher und Vorträge
# des Assistenten philo-von-freisinn neu aus.
#
# Strategie:
#   - annotate_references_results.json löschen → Step 4 wird immer neu berechnet
#   - --yes → vorhandene Zitate-Ergebnisse (annotate_quotes_results.json) wiederverwenden
#   - Bücher ohne Fusion-Daten: Step 4 wird automatisch übersprungen
#
# Ausführung: Von ragkeep-Root aus.
# Erwartet ragprep als Geschwisterverzeichnis oder RAGPREP_ROOT gesetzt.
#
# Optionen:
#   --assistant <name>   Assistant-Name (Default: philo-von-freisinn)
#   --only-primary       Nur primary-books/-lectures verarbeiten
#   --skip-lectures      Vorträge überspringen
#   --skip-books         Bücher überspringen
#   --dry-run            Nur anzeigen, keine Befehle ausführen

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument-Parsing
# ---------------------------------------------------------------------------
ASSISTANT="philo-von-freisinn"
ONLY_PRIMARY=""
SKIP_LECTURES=""
SKIP_BOOKS=""
DRY_RUN=""

for arg in "$@"; do
    case "$arg" in
        --only-primary)   ONLY_PRIMARY=1   ;;
        --skip-lectures)  SKIP_LECTURES=1  ;;
        --skip-books)     SKIP_BOOKS=1     ;;
        --dry-run)        DRY_RUN=1        ;;
        --assistant=*)   ASSISTANT="${arg#--assistant=}" ;;
        *)
            if [[ "${PREV_ARG:-}" == "--assistant" ]]; then
                ASSISTANT="$arg"
            fi
            ;;
    esac
    PREV_ARG="$arg"
done

# ---------------------------------------------------------------------------
# Pfade
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAGKEEP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -z "${RAGPREP_ROOT:-}" ]]; then
    # ragprep kann Geschwister von ragkeep sein (../ragprep) oder zwei Ebenen höher (../../ragprep)
    if [[ -f "$RAGKEEP_ROOT/../ragprep/package.json" ]]; then
        RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)"
    elif [[ -f "$RAGKEEP_ROOT/../../ragprep/package.json" ]]; then
        RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../../ragprep" && pwd)"
    else
        RAGPREP_ROOT="$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)"
    fi
fi
BOOKS_ROOT="$RAGKEEP_ROOT/books"
MANIFEST="$RAGKEEP_ROOT/assistants/$ASSISTANT/assistant-manifest.yaml"

if [[ ! -f "$MANIFEST" ]]; then
    echo "Fehler: Manifest nicht gefunden: $MANIFEST" >&2
    exit 1
fi
if [[ ! -d "$RAGPREP_ROOT" ]] || [[ ! -f "$RAGPREP_ROOT/package.json" ]]; then
    echo "Fehler: ragprep nicht gefunden: $RAGPREP_ROOT" >&2
    exit 1
fi

export RAGKEEP_PROJECT_ROOT="$RAGKEEP_ROOT"

# ---------------------------------------------------------------------------
# Werte aus Manifest lesen
# ---------------------------------------------------------------------------
read_manifest_field() {
    cd "$RAGKEEP_ROOT" && node -e "
const yaml=require('js-yaml'), fs=require('fs');
const m=yaml.load(fs.readFileSync('$MANIFEST','utf8'));
const arr=$1;
console.log((Array.isArray(arr)?arr:[]).map(String).join('\n'));
"
}

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------
run() {
    echo "  \$ $*"
    if [[ -z "$DRY_RUN" ]]; then
        "$@"
    fi
}

process_book() {
    local book_dir="$1"

    if [[ ! -d "$book_dir" ]]; then
        echo "  Warnung: Verzeichnis nicht gefunden, übersprungen: $book_dir" >&2
        return 0
    fi

    local refs_json="$book_dir/results/phase5/annotate_references_results.json"

    # Löschen erzwingt Neuberechnung von Step 4 (ohne --force, das auch Zitate neu berechnen würde)
    if [[ -f "$refs_json" ]]; then
        echo "  Lösche: $refs_json"
        if [[ -z "$DRY_RUN" ]]; then
            rm "$refs_json"
        fi
    fi

    run yarn --cwd "$RAGPREP_ROOT" rp text:annotate "$book_dir" --yes
}

# ---------------------------------------------------------------------------
# Buch-IDs aus dem Manifest einlesen
# ---------------------------------------------------------------------------
PRIMARY_BOOKS=()
while IFS= read -r b; do
    [[ -z "$b" ]] && continue
    PRIMARY_BOOKS+=("$b")
done < <(read_manifest_field "m['primary-books']||[]")

SECONDARY_BOOKS=()
while IFS= read -r b; do
    [[ -z "$b" ]] && continue
    SECONDARY_BOOKS+=("$b")
done < <(read_manifest_field "m['secondary-books']||[]")

if [[ -n "$ONLY_PRIMARY" ]]; then
    ALL_BOOKS=("${PRIMARY_BOOKS[@]}")
else
    ALL_BOOKS=()
    while IFS= read -r b; do
        [[ -z "$b" ]] && continue
        ALL_BOOKS+=("$b")
    done < <(
        printf '%s\n' "${PRIMARY_BOOKS[@]}" "${SECONDARY_BOOKS[@]}" \
            | awk '!seen[$0]++'
    )
fi

# ---------------------------------------------------------------------------
# Vortrags-Verzeichnisse über list-lecture-book-dirs.mjs auflösen
# ---------------------------------------------------------------------------
ALL_LECTURE_DIRS=()
if [[ -z "$SKIP_LECTURES" ]]; then
    if [[ -n "$ONLY_PRIMARY" ]]; then
        LECTURE_DIRS_RAW=$(RAGKEEP_PROJECT_ROOT="$RAGKEEP_ROOT" \
            node "$RAGPREP_ROOT/scripts/list-lecture-book-dirs.mjs" "$MANIFEST" --primary-only 2>/dev/null || true)
        [[ -z "$LECTURE_DIRS_RAW" ]] && \
            LECTURE_DIRS_RAW=$(RAGKEEP_PROJECT_ROOT="$RAGKEEP_ROOT" \
                node "$RAGPREP_ROOT/scripts/list-lecture-book-dirs.mjs" "$MANIFEST")
    else
        LECTURE_DIRS_RAW=$(RAGKEEP_PROJECT_ROOT="$RAGKEEP_ROOT" \
            node "$RAGPREP_ROOT/scripts/list-lecture-book-dirs.mjs" "$MANIFEST")
    fi
    while IFS= read -r d; do
        [[ -z "$d" ]] && continue
        ALL_LECTURE_DIRS+=("$d")
    done <<< "$LECTURE_DIRS_RAW"
fi

# ---------------------------------------------------------------------------
# Zusammenfassung
# ---------------------------------------------------------------------------
echo "=== annotate-philo-page-refs: $ASSISTANT ==="
echo "    Manifest   : $MANIFEST"
echo "    Bücher     : ${#ALL_BOOKS[@]}"
echo "    Vorträge   : ${#ALL_LECTURE_DIRS[@]}"
[[ -n "$DRY_RUN"      ]] && echo "    Modus      : dry-run"
[[ -n "$ONLY_PRIMARY" ]] && echo "    Modus      : --only-primary"
echo ""

# ---------------------------------------------------------------------------
# Bücher verarbeiten
# ---------------------------------------------------------------------------
if [[ -z "$SKIP_BOOKS" ]] && [[ ${#ALL_BOOKS[@]} -gt 0 ]]; then
    echo "=== Bücher (${#ALL_BOOKS[@]}) ==="
    BOOK_COUNT=0
    for BOOK_ID in "${ALL_BOOKS[@]}"; do
        [[ -z "$BOOK_ID" ]] && continue
        BOOK_DIR="$BOOKS_ROOT/$BOOK_ID"
        BOOK_COUNT=$((BOOK_COUNT + 1))
        echo ""
        echo "--- Buch [$BOOK_COUNT/${#ALL_BOOKS[@]}]: $BOOK_ID ---"
        process_book "$BOOK_DIR"
    done
fi

# ---------------------------------------------------------------------------
# Vorträge verarbeiten
# ---------------------------------------------------------------------------
if [[ -z "$SKIP_LECTURES" ]] && [[ ${#ALL_LECTURE_DIRS[@]} -gt 0 ]]; then
    echo ""
    echo "=== Vorträge (${#ALL_LECTURE_DIRS[@]}) ==="
    LECT_COUNT=0
    for LECT_DIR in "${ALL_LECTURE_DIRS[@]}"; do
        [[ -z "$LECT_DIR" ]] && continue
        LECT_COUNT=$((LECT_COUNT + 1))
        echo ""
        echo "--- Vortrag [$LECT_COUNT/${#ALL_LECTURE_DIRS[@]}]: $(basename "$LECT_DIR") ---"
        process_book "$LECT_DIR"
    done
fi

echo ""
echo "=== Fertig ==="
