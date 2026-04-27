#!/usr/bin/env bash
# Chunked alle Bücher und Vorträge des Assistenten philo-von-freisinn.
#
# Pipeline pro Buch / Vortrag:
#   1. rag:chunk --assistant <name>
#   2. rag:augment:summaries --assistant <name>   (nur bei augmentation-types: summaries)
#   3. rag:augment:quotes                         (nur bei augmentation-types: quotes)
#
# Mit --jsonl werden statt der rag:augment:*-Kommandos die vorhandenen
# results/rag-chunks/*-chunks.jsonl direkt nach ragrun (POST /rag/store-chunks)
# hochgeladen. Nützlich, wenn die Artefakte bereits existieren, aber ragrun
# neu befüllt werden soll (z.B. nach einem DB-Reset).
#
# Ausführung: Von ragkeep-Root aus.
# Erwartet ragprep als Geschwisterverzeichnis oder RAGPREP_ROOT gesetzt.
#
# Optionen:
#   --assistant <name>   Assistant-Name (Default: philo-von-freisinn)
#   --only-primary       Nur primary-books/-lectures verarbeiten
#   --skip-lectures      Vorträge überspringen
#   --skip-books         Bücher überspringen
#   --skip-augment       rag:augment:* überspringen (nur rag:chunk)
#   --skip-assistant     assistant:chunk (Talks, assistant-Quotes) überspringen
#   --only-assistant     Nur assistant-globale Chunks (Talks, Quotes, Concepts, Typologies);
#                        entspricht --skip-books --skip-lectures
#   --jsonl              Vorhandene *-chunks.jsonl direkt hochladen statt rag:augment:*
#   --force              rag:augment:* mit --force ausführen (Neuberechnung)
#   --dry-run            Nur anzeigen, keine Befehle ausführen

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument-Parsing
# ---------------------------------------------------------------------------
ASSISTANT="philo-von-freisinn"
ONLY_PRIMARY=""
SKIP_LECTURES=""
SKIP_BOOKS=""
SKIP_AUGMENT=""
SKIP_ASSISTANT=""
USE_JSONL=""
FORCE=""
DRY_RUN=""

for arg in "$@"; do
    case "$arg" in
        --only-primary)   ONLY_PRIMARY=1   ;;
        --skip-lectures)  SKIP_LECTURES=1  ;;
        --skip-books)     SKIP_BOOKS=1     ;;
        --skip-augment)   SKIP_AUGMENT=1   ;;
        --skip-assistant)  SKIP_ASSISTANT=1               ;;
        --only-assistant)  SKIP_BOOKS=1; SKIP_LECTURES=1  ;;
        --jsonl)          USE_JSONL=1      ;;
        --force)          FORCE=1          ;;
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
RAGPREP_ROOT="${RAGPREP_ROOT:-$(cd "$RAGKEEP_ROOT/../ragprep" && pwd)}"
BOOKS_ROOT="$RAGKEEP_ROOT/books"
MANIFEST="$RAGKEEP_ROOT/assistants/$ASSISTANT/assistant-manifest.yaml"
RAGRUN_BASE_URL="${RAGRUN_BASE_URL:-http://localhost:8000/api/v1}"

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
# Werte aus Manifest lesen (Node, da ragkeep js-yaml nutzt)
# ---------------------------------------------------------------------------
read_manifest_field() {
    # $1 = JS-Ausdruck der ein Array zurückgibt, z.B. "m['primary-books']||[]"
    cd "$RAGKEEP_ROOT" && node -e "
const yaml=require('js-yaml'), fs=require('fs');
const m=yaml.load(fs.readFileSync('$MANIFEST','utf8'));
const arr=$1;
console.log((Array.isArray(arr)?arr:[]).map(String).join('\n'));
"
}

COLLECTION=$(cd "$RAGKEEP_ROOT" && node -e "
const yaml=require('js-yaml'),fs=require('fs');
const m=yaml.load(fs.readFileSync('$MANIFEST','utf8'));
console.log(String(m['rag-collection']||''));
")

AUGMENT_TYPES=$(cd "$RAGKEEP_ROOT" && node -e "
const yaml=require('js-yaml'),fs=require('fs');
const m=yaml.load(fs.readFileSync('$MANIFEST','utf8'));
const types=m['augmentation-types']||[];
console.log((Array.isArray(types)?types:[]).join(','));
")

DO_SUMMARIES=""
DO_QUOTES=""
[[ "$AUGMENT_TYPES" == *"summaries"* ]] && DO_SUMMARIES=1
[[ "$AUGMENT_TYPES" == *"quotes"* ]]    && DO_QUOTES=1

# Manifest-Flags für assistant-globale Augmentation
DO_CONCEPTS=$(cd "$RAGKEEP_ROOT" && node -e "
const yaml=require('js-yaml'),fs=require('fs');
const m=yaml.load(fs.readFileSync('$MANIFEST','utf8'));
const c=m['concepts']||[];
console.log(Array.isArray(c)&&c.length>0?'1':'');
")
DO_TYPOLOGIES=$(cd "$RAGKEEP_ROOT" && node -e "
const yaml=require('js-yaml'),fs=require('fs');
const m=yaml.load(fs.readFileSync('$MANIFEST','utf8'));
const t=m['typologies']||[];
console.log(Array.isArray(t)&&t.length>0?'1':'');
")
# Talks: Source of Truth ist rag_talks.publishing_status='published', nicht das Manifest.
# assistant:chunk --type talks fragt die DB ab – das Flag steuert nur ob der Schritt läuft.
DO_TALKS=1

FORCE_FLAG=""
[[ -n "$FORCE" ]] && FORCE_FLAG="--force"

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------
run() {
    echo "  \$ $*"
    if [[ -z "$DRY_RUN" ]]; then
        "$@"
    fi
}

# Lädt eine einzelne *-chunks.jsonl direkt nach ragrun hoch.
# Bestimmt die rag_partition anhand des chunk_type des ersten Eintrags:
#   book / secondary_book  →  __shared__
#   alles andere           →  $COLLECTION
upload_jsonl() {
    local jsonl_file="$1"
    if [[ ! -f "$jsonl_file" ]]; then
        echo "  [jsonl] Datei nicht gefunden, übersprungen: $jsonl_file" >&2
        return 0
    fi
    echo "  [jsonl] Upload: $(basename "$jsonl_file")"
    if [[ -n "$DRY_RUN" ]]; then
        echo "  [jsonl dry-run] würde POST ${RAGRUN_BASE_URL}/rag/store-chunks"
        return 0
    fi
    python3 - "$jsonl_file" "$COLLECTION" "$RAGRUN_BASE_URL" <<'PYEOF'
import sys, json, urllib.request, urllib.error

LANG_NORM = {'german': 'de', 'english': 'en', 'french': 'fr', 'spanish': 'es'}

def normalize_chunk(obj):
    """Normalize fields that ragprep usually fixes before upload (e.g. language)."""
    md = obj.get('metadata')
    if isinstance(md, dict):
        lang = md.get('language', '')
        if isinstance(lang, str):
            md['language'] = LANG_NORM.get(lang.lower(), lang)
    return obj

jsonl_file, collection, base_url = sys.argv[1], sys.argv[2], sys.argv[3]

with open(jsonl_file) as f:
    raw_lines = [l for l in f.read().splitlines() if l.strip()]

# Parse, normalize, re-serialize
chunks = []
for line in raw_lines:
    try:
        chunks.append(normalize_chunk(json.loads(line)))
    except json.JSONDecodeError as e:
        print(f'  Warnung: Zeile übersprungen ({e})', file=sys.stderr)

if not chunks:
    print('  Keine gültigen Chunks gefunden.', file=sys.stderr)
    sys.exit(1)

# Partition aus erstem Eintrag ableiten
chunk_type = chunks[0].get('metadata', {}).get('chunk_type', '')
partition = '__shared__' if chunk_type in ('book', 'secondary_book') else collection

content = '\n'.join(json.dumps(c) for c in chunks)
body = json.dumps({
    'chunks_jsonl_content': content,
    'collection_name': partition,
}).encode()

req = urllib.request.Request(
    f'{base_url}/rag/store-chunks',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST',
)
try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    stored = result.get('stored', '?')
    coll   = result.get('collection', '?')
    print(f'  → {stored} Chunks gespeichert  (collection={coll})')
except urllib.error.HTTPError as e:
    body_txt = e.read().decode('utf-8', errors='replace')
    print(f'  HTTP {e.code}: {body_txt}', file=sys.stderr)
    sys.exit(1)
PYEOF
}

# Führt die vollständige Pipeline für ein Buch-/Vortrag-Verzeichnis aus.
# $1 = book_dir   $2 = "book" | "lecture"
process_book() {
    local book_dir="$1"
    local entity_type="${2:-book}"

    if [[ ! -d "$book_dir" ]]; then
        echo "  Warnung: Verzeichnis nicht gefunden, übersprungen: $book_dir" >&2
        return 0
    fi

    local rag_chunks_dir="$book_dir/results/rag-chunks"

    # --- Schritt 1: rag:chunk ------------------------------------------
    run yarn --cwd "$RAGPREP_ROOT" rp rag:chunk "$book_dir" --assistant "$ASSISTANT"

    # --- Schritt 2+3: Augmentierung ------------------------------------
    if [[ -z "$SKIP_AUGMENT" ]]; then
        if [[ -n "$USE_JSONL" ]]; then
            # JSONL-Modus: vorhandene Augment-Artefakte direkt hochladen
            [[ -n "$DO_SUMMARIES" ]] && upload_jsonl "$rag_chunks_dir/summaries-chunks.jsonl"
            [[ -n "$DO_QUOTES"    ]] && upload_jsonl "$rag_chunks_dir/quotes-chunks.jsonl"
        else
            # Normal-Modus: rag:augment:* ausführen
            if [[ -n "$DO_SUMMARIES" ]]; then
                run yarn --cwd "$RAGPREP_ROOT" rp rag:augment:summaries "$book_dir" \
                    --assistant "$ASSISTANT" $FORCE_FLAG
            fi
            if [[ -n "$DO_QUOTES" ]]; then
                run yarn --cwd "$RAGPREP_ROOT" rp rag:augment:quotes "$book_dir" $FORCE_FLAG
            fi
        fi
    fi
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
    # Dedupliziert: primary zuerst, dann secondary (via awk für bash 3-Kompatibilität)
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
        # Fallback: list-lecture-book-dirs kennt kein --primary-only → alle
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
echo "=== chunk-philo-all: $ASSISTANT ==="
echo "    Manifest       : $MANIFEST"
echo "    rag-collection : $COLLECTION"
echo "    augment-types  : ${AUGMENT_TYPES:-–}"
echo "    concepts       : ${DO_CONCEPTS:+ja}"
echo "    typologies     : ${DO_TYPOLOGIES:+ja}"
echo "    talks          : aus rag_talks (published)"
echo "    Bücher         : ${#ALL_BOOKS[@]}"
echo "    Vorträge       : ${#ALL_LECTURE_DIRS[@]}"
[[ -n "$DRY_RUN"       ]] && echo "    Modus          : dry-run"
[[ -n "$USE_JSONL"     ]] && echo "    Modus          : --jsonl (Augment-JSONL direkt hochladen)"
[[ -n "$FORCE"         ]] && echo "    Modus          : --force"
[[ -n "$SKIP_AUGMENT"  ]] && echo "    Modus          : --skip-augment"
[[ -n "$SKIP_ASSISTANT" ]] && echo "    Modus          : --skip-assistant"
[[ -n "$ONLY_PRIMARY"  ]] && echo "    Modus          : --only-primary"
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
        process_book "$BOOK_DIR" "book"
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
        process_book "$LECT_DIR" "lecture"
    done
fi


# ---------------------------------------------------------------------------
# Assistant-globale Chunks (Talks, assistant-Quotes, Concepts, Typologies)
# ---------------------------------------------------------------------------
if [[ -z "$SKIP_AUGMENT" ]] && [[ -z "$SKIP_ASSISTANT" ]]; then

    # --- assistant:chunk (Talks + assistant-eigene Quotes) ------------------
    if [[ -n "$DO_TALKS" ]]; then
        echo ""
        echo "=== assistant:chunk – Talks ==="
        run yarn --cwd "$RAGPREP_ROOT" rp assistant:chunk "$ASSISTANT" --type talks
    fi

    # assistant:chunk quotes (assistant-eigene Quotes, unabhängig von rag:augment:quotes)
    # Nur wenn quotes/ im Assistenten-Verzeichnis vorhanden sind
    ASSISTANT_QUOTES_DIR="$RAGKEEP_ROOT/assistants/$ASSISTANT/quotes"
    if [[ -d "$ASSISTANT_QUOTES_DIR" ]]; then
        echo ""
        echo "=== assistant:chunk – assistant-Quotes ==="
        run yarn --cwd "$RAGPREP_ROOT" rp assistant:chunk "$ASSISTANT" --type quotes
    fi

    # --- Concepts -----------------------------------------------------------
    if [[ -n "$DO_CONCEPTS" ]]; then
        echo ""
        CONCEPTS_JSONL="$RAGKEEP_ROOT/assistants/$ASSISTANT/concepts/chunks/concepts.jsonl"
        if [[ -n "$USE_JSONL" ]]; then
            echo "=== concepts – JSONL-Upload ==="
            upload_jsonl "$CONCEPTS_JSONL"
        else
            echo "=== rag:augment:concepts ==="
            run yarn --cwd "$RAGPREP_ROOT" rp rag:augment:concepts "$ASSISTANT" $FORCE_FLAG
        fi
    fi

    # --- Typologies ---------------------------------------------------------
    if [[ -n "$DO_TYPOLOGIES" ]]; then
        echo ""
        TYPOLOGIES_JSONL="$RAGKEEP_ROOT/assistants/$ASSISTANT/typologies/chunks/typologies.jsonl"
        if [[ -n "$USE_JSONL" ]]; then
            echo "=== typologies – JSONL-Upload ==="
            upload_jsonl "$TYPOLOGIES_JSONL"
        else
            echo "=== rag:augment:typologies:explain ==="
            run yarn --cwd "$RAGPREP_ROOT" rp rag:augment:typologies:explain "$ASSISTANT" $FORCE_FLAG
        fi
    fi
fi

echo ""
echo "=== Fertig ==="
