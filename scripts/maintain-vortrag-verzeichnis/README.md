# Skripte zur Pflege des GA-Vortragsverzeichnisses

Diese Skripte unterstützen die Pflege von `lectures/rudolf-steiner-ga-vortrag-verzeichnis.yaml` – dem Verzeichnis der Vorträge Rudolf Steiners mit Zuordnung zu GA-Bänden.

## Voraussetzungen

- **Node.js** (ESM)
- **pdftotext** (poppler) – für die PDF-Text-Extraktion
- **GA-PDFs** im Verzeichnis `GA_PDF_DIR` (Standard: `~/GA 180dpi/GA-Acrobat/GA` oder `$GA_PDF_DIR`)

## Skripte

### add_ga_from_ga_pdf_inhaltsverzeichnis.mjs

Ergänzt fehlende GA-Nummern im Vortragsverzeichnis, indem es die Inhaltsverzeichnisse der GA-PDFs auswertet.

**Ablauf:**
1. Durchsucht GA-PDFs ab Band 051
2. Findet die Seite mit „Inhalt“ oder „Inhaltsverzeichnis“ (erste 15 Seiten)
3. Extrahiert Vortragsdaten (Format: „5. Mai 1919“) aus dem TOC
4. Prüft, ob im YAML ein Eintrag mit diesem Datum existiert
5. Ohne `--write`: Zeigt nur an, welche GA-Nummern eingefügt würden (hellgrün)
6. Mit `--write`: Schreibt die erkannten GA-Nummern in die YAML-Datei

**Optionen:**
- `--write` – Änderungen tatsächlich in die YAML schreiben (ohne: nur Vorschau)
- `--range <bereich>` – Nur bestimmte GA-Bände verarbeiten (z.B. `51,52,53` oder `332-337` oder `68a-68c`)

**Blacklist:** Einträge in `add_ga_from_ga_pdf_inhaltsverzeichnis.blacklist` (UUIDs) werden übersprungen.

---

### suggest_ga_for_missing.mjs

Schlägt GA-Bände für Einträge ohne GA-Nummer vor, indem es die ersten 60 Seiten aller GA-PDFs nach Datumsangaben durchsucht.

**Ablauf:**
1. Lädt alle YAML-Einträge ohne `ga`-Feld
2. Durchsucht die ersten 60 Seiten jeder GA-PDF nach Vortragsdaten (dd. Monat yyyy)
3. Zeigt für jeden Eintrag ohne GA passende GA-Vorschläge an (mit Kontextzeilen)
4. Bei fehlendem Treffer: Sucht nach „Vielleicht“-Treffern (Titel im Text)

**Optionen:**
- `--range <bereich>` – Nur bestimmte GA-Bände durchsuchen (z.B. `51,52,68a-68d`)

---

### add_missing_ga_to_ga_list.mjs

Ergänzt fehlende GA-Bände in `ragprep/config/ga_list.txt`.

**Ablauf:**
1. Findet GA-PDFs in `GA_PDF_DIR`, die noch nicht in `ga_list.txt` stehen
2. Extrahiert aus den ersten 5 Seiten den Buchtitel (meist Seite 3 unter „Rudolf Steiner“)
3. Nimmt nur den Titel, keine Vortragsanzahl oder Städte
4. Ohne `--write`: Zeigt nur an, welche Einträge hinzugefügt würden
5. Mit `--write`: Schreibt die neuen Einträge in `ga_list.txt` (sortiert)

**Optionen:**
- `--write` – Änderungen in `ga_list.txt` schreiben (ohne: nur Vorschau)
- `--range <bereich>` – Nur bestimmte GA-Bände verarbeiten (z.B. `355,356` oder `355-360`)

---

## Verwendung

```bash
# Vom ragkeep-Verzeichnis aus:
cd /pfad/zu/ragkeep

# GA-Vorschläge für Einträge ohne GA (Vorschau)
node scripts/maintain-vortrag-verzeichnis/suggest_ga_for_missing.mjs

# GA-Nummern aus Inhaltsverzeichnissen (nur Vorschau)
node scripts/maintain-vortrag-verzeichnis/add_ga_from_ga_pdf_inhaltsverzeichnis.mjs

# GA-Nummern tatsächlich eintragen
node scripts/maintain-vortrag-verzeichnis/add_ga_from_ga_pdf_inhaltsverzeichnis.mjs --write

# Nur bestimmte Bände verarbeiten
node scripts/maintain-vortrag-verzeichnis/add_ga_from_ga_pdf_inhaltsverzeichnis.mjs --range 68a-68c
node scripts/maintain-vortrag-verzeichnis/suggest_ga_for_missing.mjs --range 51,52,53

# Fehlende GAs in ga_list.txt ergänzen (Vorschau)
node scripts/maintain-vortrag-verzeichnis/add_missing_ga_to_ga_list.mjs

# Fehlende GAs tatsächlich in ga_list.txt eintragen
node scripts/maintain-vortrag-verzeichnis/add_missing_ga_to_ga_list.mjs --write
```

## Umgebungsvariablen

- `GA_PDF_DIR` – Pfad zum Verzeichnis mit den GA-PDFs (z.B. `GA 051.pdf`, `GA 068a.pdf`)
- `GA_LIST_PATH` – Pfad zu `ga_list.txt` (nur für `add_missing_ga_to_ga_list.mjs`, Standard: `../ragprep/config/ga_list.txt`)
