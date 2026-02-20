#!/usr/bin/env python3
"""
Erstellt eine YAML-Datei aus dem Rudolf-Steiner-Vortragsverzeichnis (ODS).

- Filtert Zeilen, bei denen Spalte E "Kein Material vorhanden" enthält (diese werden ausgelassen)
- Fügt eine Spalte "id" hinzu: YYYYMMDD mit optionalem Suffix a, b, c, ... für mehrere Vorträge am selben Tag

Verwendung:
  python scripts/ods_lectures_to_yaml.py [--output OUTPUT] [ODS_PATH]

  ODS_PATH: Pfad zur ODS-Datei (Default: lectures/Rudolf_Steiner_Vortragsverzeichnis_1888-1924.ods)
  --output: Ausgabepfad für YAML (Default: lectures/vortragsverzeichnis_mit_material.yaml)
"""

import argparse
import re
import sys
import zipfile
from pathlib import Path

import xml.etree.ElementTree as ET


def get_cell_text(cell: ET.Element) -> str:
    """Extrahiert den Text aus einer ODS-Tabellenzelle."""
    texts = []
    for elem in cell.iter():
        if elem.tag.endswith("}p"):
            if elem.text:
                texts.append(elem.text)
            for child in elem:
                if child.tail:
                    texts.append(child.tail)
    return " ".join(texts).strip() if texts else ""


def expand_cells(row: ET.Element, max_cols: int = 5) -> list[str]:
    """Expandiert Zellen mit number-columns-repeated zu einer flachen Liste."""
    ns = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
    table_ns = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
    result = []
    for cell in row.findall(f".//{ns}table-cell"):
        if len(result) >= max_cols:
            break
        repeat = int(cell.get(f"{table_ns}number-columns-repeated", 1))
        text = get_cell_text(cell)
        for _ in range(repeat):
            result.append(text)
            if len(result) >= max_cols:
                break
    return result[:max_cols]


def parse_date_to_yyyymmdd(date_str: str) -> str | None:
    """
    Parst Datum aus Spalte A zu YYYYMMDD.
    Unterstützt: DD.MM.YYYY, DD.MM.YYYY(?), YYYY
    """
    if not date_str or not date_str.strip():
        return None
    date_str = date_str.strip()
    # DD.MM.YYYY oder DD.MM.YYYY(?)
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", date_str)
    if m:
        day, month, year = m.groups()
        return f"{year}{month.zfill(2)}{day.zfill(2)}"
    # Nur Jahr
    m = re.match(r"(\d{4})", date_str)
    if m:
        return f"{m.group(1)}0101"
    return None


def parse_vortragstitel(raw: str) -> tuple[str, str, str]:
    """
    Parst 'titel / reihe / anlass' in drei Felder.
    - vortragstitel: Erster Teil; bei "Kein Titel" -> leer
    - reihe: Zwischen erstem und zweitem /; bei "Keine Reihe" -> leer
    - anlass: Hinter dem zweiten /; bei "Anlass unbekannt" oder "Kein Anlass" -> leer
    """
    parts = [p.strip() for p in raw.split(" / ", 2)]
    titel = (parts[0] if len(parts) > 0 else "") or ""
    reihe = (parts[1] if len(parts) > 1 else "") or ""
    anlass = (parts[2] if len(parts) > 2 else "") or ""

    if titel and titel.strip().lower() == "kein titel":
        titel = ""
    if reihe and reihe.strip().lower() == "keine reihe":
        reihe = ""
    if anlass and anlass.strip().lower() in ("anlass unbekannt", "kein anlass"):
        anlass = ""

    return titel, reihe, anlass


def assign_vortrag_x_for_kein_titel(
    rows_parsed: list[tuple[list[str], str, str, str, str]]
) -> list[tuple[list[str], str, str, str, str]]:
    """
    Bei leerem vortragstitel (Kein Titel) und vorhandener reihe:
    Fügt "Vortrag 1", "Vortrag 2", ... ein, in Reihenfolge der Vorträge mit gleichem Reihentitel.
    """
    from collections import defaultdict

    # Pro reihe: Zähler für "Kein Titel"-Vorträge
    reihe_count: dict[str, int] = defaultdict(int)
    result = []
    for cells, lid, titel, reihe, anlass in rows_parsed:
        if not titel and reihe:
            reihe_count[reihe] += 1
            titel = f"Vortrag {reihe_count[reihe]}"
        result.append((cells, lid, titel, reihe, anlass))
    return result


def generate_ids(rows_with_dates: list[tuple[list[str], str]]) -> list[tuple[list[str], str]]:
    """
    Generiert IDs: Bei mehreren Vorträgen am selben Tag YYYYMMDDa, YYYYMMDDb, ...
    (erster Vortrag = a, zweiter = b, etc.). Bei nur einem Vortrag: YYYYMMDD.
    """
    from collections import defaultdict

    # Erst: Anzahl Vorträge pro Tag zählen
    date_totals: dict[str, int] = defaultdict(int)
    for cells, _ in rows_with_dates:
        yyyymmdd = parse_date_to_yyyymmdd(cells[0] if cells else "")
        if yyyymmdd:
            date_totals[yyyymmdd] += 1

    # Dann: IDs vergeben
    date_counts: dict[str, int] = defaultdict(int)
    result = []
    for cells, _ in rows_with_dates:
        yyyymmdd = parse_date_to_yyyymmdd(cells[0] if cells else "")
        if not yyyymmdd:
            result.append((cells, "unknown"))
            continue
        idx = date_counts[yyyymmdd]
        date_counts[yyyymmdd] += 1
        if date_totals[yyyymmdd] > 1:
            id_val = f"{yyyymmdd}{chr(ord('a') + idx)}"
        else:
            id_val = yyyymmdd
        result.append((cells, id_val))
    return result


def read_ods_rows(ods_path: Path) -> list[list[str]]:
    """Liest alle Zeilen aus der ODS-Datei."""
    ns = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
    with zipfile.ZipFile(ods_path, "r") as zf:
        with zf.open("content.xml") as f:
            root = ET.parse(f).getroot()
    rows = list(root.iter(f"{ns}table-row"))
    return [expand_cells(row) for row in rows]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="ODS-Vortragsverzeichnis zu YAML konvertieren (nur Zeilen mit Material)"
    )
    parser.add_argument(
        "ods_path",
        nargs="?",
        default="lectures/Rudolf_Steiner_Vortragsverzeichnis_1888-1924.ods",
        help="Pfad zur ODS-Datei",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="lectures/vortragsverzeichnis_mit_material.yaml",
        help="Ausgabepfad für YAML",
    )
    args = parser.parse_args()

    ods_path = Path(args.ods_path)
    if not ods_path.exists():
        print(f"Fehler: Datei nicht gefunden: {ods_path}", file=sys.stderr)
        return 1

    rows = read_ods_rows(ods_path)
    if not rows:
        print("Fehler: Keine Zeilen in ODS gefunden.", file=sys.stderr)
        return 1

    # Header ist Zeile 0
    header = rows[0]
    # Spalte E = Index 4 (Abdruck in Gesamtausgabe)
    col_e_idx = 4
    exclude_text = "Kein Material vorhanden"

    # Filter: Zeilen wo Spalte E NICHT "Kein Material vorhanden" ist
    filtered = []
    for row in rows[1:]:
        if len(row) <= col_e_idx:
            continue
        col_e = (row[col_e_idx] or "").strip()
        if col_e == exclude_text:
            continue
        filtered.append(row)

    # IDs generieren (basierend auf Datum in Spalte A)
    rows_with_ids = generate_ids([(r, "") for r in filtered])

    # vortragstitel parsen: titel / reihe / anlass
    rows_parsed = []
    for cells, lid in rows_with_ids:
        raw_titel = (cells[3] if len(cells) > 3 else "") or ""
        titel, reihe, anlass = parse_vortragstitel(raw_titel)
        rows_parsed.append((cells, lid, titel, reihe, anlass))

    # Bei "Kein Titel" + reihe: "Vortrag 1", "Vortrag 2", ... einfügen
    rows_parsed = assign_vortrag_x_for_kein_titel(rows_parsed)

    # YAML schreiben
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# Rudolf Steiner Vortragsverzeichnis (nur Vorträge mit Material)\n")
        f.write("# Generiert aus ODS, gefiltert: Kein Material vorhanden ausgelassen\n\n")
        f.write("lectures:\n")
        for cells, lid, titel, reihe, anlass in rows_parsed:
            datum = (cells[0] if len(cells) > 0 else "") or ""
            jahr = (cells[1] if len(cells) > 1 else "") or ""
            ort = (cells[2] if len(cells) > 2 else "") or ""
            abdruck = (cells[4] if len(cells) > 4 else "") or ""
            f.write(f"  - id: {lid}\n")
            f.write(f"    datum: {repr(datum)}\n")
            f.write(f"    jahr: {repr(jahr)}\n")
            f.write(f"    ort: {repr(ort)}\n")
            f.write(f"    vortragstitel: {repr(titel)}\n")
            if reihe:
                f.write(f"    reihe: {repr(reihe)}\n")
            if anlass:
                f.write(f"    anlass: {repr(anlass)}\n")
            f.write(f"    abdruck: {repr(abdruck)}\n")

    print(f"Geschrieben: {out_path} ({len(rows_with_ids)} Einträge)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
