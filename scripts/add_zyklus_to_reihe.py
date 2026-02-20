#!/usr/bin/env python3
"""
Fügt zyklus-Nummern zu den Reihen in rudolf-steiner-ga-vortrag-reihe.yaml hinzu,
basierend auf den Vorträgen im Verzeichnis, die sowohl reihe als auch zyklus haben.

Verwendung:
  python scripts/add_zyklus_to_reihe.py
"""

from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
LECTURES_DIR = SCRIPT_DIR.parent / "lectures"
VERZEICHNIS_PATH = LECTURES_DIR / "rudolf-steiner-ga-vortrag-verzeichnis.yaml"
REIHE_PATH = LECTURES_DIR / "rudolf-steiner-ga-vortrag-reihe.yaml"


def normalize(s: str) -> str:
    """Normalisiert einen String für den Vergleich."""
    return " ".join(s.split()).strip() if s else ""


def find_zyklus_for_titel(titel: str, reihe_to_zyklus: dict[str, int]) -> int | None:
    """Ermittelt die Zyklus-Nummer für einen Titel (nur exakter Match)."""
    titel_n = normalize(titel)
    return reihe_to_zyklus.get(titel_n)


def main() -> None:
    with open(VERZEICHNIS_PATH, encoding="utf-8") as f:
        verzeichnis = yaml.safe_load(f)

    # Sammle reihe -> zyklus (jede Reihe hat typischerweise eine Zyklus-Nummer)
    reihe_to_zyklus: dict[str, int] = {}
    for lecture in verzeichnis.get("lectures", []):
        reihe = lecture.get("reihe")
        zyklus = lecture.get("zyklus")
        if reihe and zyklus is not None and isinstance(reihe, str):
            reihe = reihe.strip()
            if isinstance(zyklus, int):
                reihe_to_zyklus[reihe] = zyklus

    with open(REIHE_PATH, encoding="utf-8") as f:
        reihe_data = yaml.safe_load(f)

    added = 0
    for entry in reihe_data.get("reihen", []):
        titel = entry.get("titel") or entry.get("title")
        if not titel:
            continue
        zyklus = find_zyklus_for_titel(titel, reihe_to_zyklus)
        if zyklus is not None:
            entry["zyklus"] = zyklus
            added += 1

    with open(REIHE_PATH, "w", encoding="utf-8") as f:
        yaml.dump(reihe_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"✓ {added} Reihen mit zyklus ergänzt")


if __name__ == "__main__":
    main()
