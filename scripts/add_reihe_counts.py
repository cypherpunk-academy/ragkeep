#!/usr/bin/env python3
"""
Fügt die Anzahlen der Vorkommnisse von "reihe" aus dem Vortragsverzeichnis
in die Reihe-YAML-Datei ein.

Verwendung:
  python scripts/add_reihe_counts.py
"""

import re
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
LECTURES_DIR = SCRIPT_DIR.parent / "lectures"
VERZEICHNIS_PATH = LECTURES_DIR / "rudolf-steiner-ga-vortrag-verzeichnis.yaml"
REIHE_PATH = LECTURES_DIR / "rudolf-steiner-ga-vortrag-reihe.yaml"

TITLE_RE = re.compile(r'^\s+-\s+title:\s*(.+)$')
COUNT_RE = re.compile(r'^(\s+count:)\s*$')


def get_count_for_title(title: str, counts: dict[str, int]) -> int:
    """Ermittelt die Anzahl für einen Titel (exakt oder über Teilmatches)."""
    title = title.strip()
    if title in counts:
        return counts[title]
    total = 0
    for verz_reihe, cnt in counts.items():
        if verz_reihe == title:
            total += cnt
        elif title in verz_reihe or verz_reihe in title:
            total += cnt
    return total


def main() -> None:
    with open(VERZEICHNIS_PATH, encoding="utf-8") as f:
        verzeichnis = yaml.safe_load(f)

    # Zähle Vorkommnisse von "reihe" im Verzeichnis
    counts: dict[str, int] = {}
    for lecture in verzeichnis.get("lectures", []):
        reihe = lecture.get("reihe")
        if reihe and isinstance(reihe, str):
            reihe = reihe.strip()
            counts[reihe] = counts.get(reihe, 0) + 1

    # Lese die Reihe-Datei und aktualisiere count-Zeilen
    with open(REIHE_PATH, encoding="utf-8") as f:
        lines = f.readlines()

    current_title: str | None = None
    new_lines: list[str] = []
    updated = 0

    for line in lines:
        if m := TITLE_RE.match(line):
            current_title = m.group(1).strip().strip('"\'')
            new_lines.append(line)
        elif m := COUNT_RE.match(line):
            indent = m.group(1)
            cnt = get_count_for_title(current_title or "", counts)
            new_lines.append(f"{indent} {cnt}\n")
            updated += 1
            current_title = None
        else:
            new_lines.append(line)

    with open(REIHE_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"✓ {updated} Reihen mit Count aktualisiert")


if __name__ == "__main__":
    main()
