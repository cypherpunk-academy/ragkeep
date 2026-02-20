#!/usr/bin/env python3
"""
Fügt bei mehreren Vorträgen am selben Tag Suffixe a, b, c, ... zu den IDs hinzu.
Ändert vortragsverzeichnis.yaml direkt (in-place).
"""
import re
from collections import defaultdict
from pathlib import Path


def datum_to_yyyymmdd(datum: str) -> str | None:
    """'DD.MM.YYYY' -> 'YYYYMMDD'"""
    m = re.match(r"'?(\d{1,2})\.(\d{1,2})\.(\d{4})'?", datum.strip())
    if m:
        d, mo, y = m.groups()
        return f"{y}{mo.zfill(2)}{d.zfill(2)}"
    return None


def main() -> None:
    yaml_path = Path(__file__).parent.parent / "lectures" / "vortragsverzeichnis.yaml"
    content = yaml_path.read_text(encoding="utf-8")

    # Parse: id und datum pro Vortrag (Reihenfolge beibehalten)
    # Pattern: "  - id: XXXXXXXX" gefolgt von "    datum: 'DD.MM.YYYY'"
    pattern = re.compile(
        r"^  - id: (\d{8}(?:[a-z])?)\s*\n    datum: ('[^']+')",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(content))

    # Pro datum: Liste der (start, end, old_id, base_yyyymmdd)
    # base aus Datum (DD.MM.YYYY) oder aus erster 8-stelliger ID
    by_datum: dict[str, list[tuple[int, int, str, str]]] = defaultdict(list)
    for m in matches:
        old_id = m.group(1)
        datum_str = m.group(2)
        base = datum_to_yyyymmdd(datum_str)
        if not base:
            # z.B. '1903 Sommer': Basis aus ID (erste 8 Ziffern)
            base_match = re.match(r"(\d{8})", old_id)
            base = base_match.group(1) if base_match else None
        if base:
            by_datum[datum_str].append((m.start(), m.end(), old_id, base))

    # Nur Tage mit mehreren Vorträgen
    replacements: list[tuple[int, int, str, str]] = []
    for datum_str, items in by_datum.items():
        if len(items) <= 1:
            continue
        for idx, (start, end, old_id, base) in enumerate(items):
            suffix = chr(ord("a") + idx)
            new_id = f"{base}{suffix}"
            replacements.append((start, end, content[start:end], new_id))

    # Sortiert nach Position (rückwärts), damit Ersetzungen von hinten nach vorne
    # die Positionen nicht verschieben
    replacements.sort(key=lambda x: x[0], reverse=True)

    # Ersetze: id: XXXXXXXX -> id: XXXXXXXXa (nur die id-Zeile anpassen)
    for start, end, orig, new_id in replacements:
        # In orig steht "  - id: 18930220\n    datum: '20.02.1893'"
        new_block = re.sub(r"id: \S+", f"id: {new_id}", orig, count=1)
        content = content[:start] + new_block + content[end:]

    yaml_path.write_text(content, encoding="utf-8")
    print(f"Geändert: {len(replacements)} IDs in {yaml_path}")


if __name__ == "__main__":
    main()
