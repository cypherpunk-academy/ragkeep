## Projektüberblick: `ragprep` + `ragkeep` + `ragrun` (RAGxxx)

### Worum es geht (in einem Satz)
RAGxxx ist ein zusammenhängendes Projekt, das Texte im Umfeld der **Geisteswissenschaft Rudolf Steiners (Anthroposophie)** – mit besonderem Fokus auf die **12 Weltanschauungen / Weltanschauungsstimmungen** – als **durchsuchbares, zitierfähiges Korpus** erschließt und darauf aufbauend eine **App** sowie eine **KI‑gestützte Lern- und Buchform** (u. a. zur *Philosophie der Freiheit* und zur *Dreigliederung*) ermöglicht.

### Inhaltlicher Fokus
Das Projekt will Steiners Werk erschließen und KI methodisch nutzbar machen, mit besonderem Fokus auf exaktem Quellenbezug und Vollständigkeit, unter Nutzung der aktuellen LLMs.

Die **12 Weltanschauungen** werden dabei als **Arbeitsraster** verstanden: als ein System von Perspektiven/Stimmungen, mit dem ein breiteres Spektrum von Nutzerfragen verstanden werden kann.

---

## Drei Bausteine – ein System

RAGxxx besteht aus drei klar getrennten Teilen, die zusammen einen nachvollziehbaren Workflow ergeben:

### 1) `ragprep` – Aufbereitung der Quellen (vom PDF/Scan zur strukturierten Textgrundlage)
`ragprep` ist die technische Werkstatt. Hier werden Bücher, PDFs und Scans **gelesen, per OCR erschlossen, strukturell analysiert und für die Weiterverarbeitung vorbereitet**.

Warum das wichtig ist: Gerade bei historischen Ausgaben entscheidet die Qualität der OCR und der Struktur (Seiten, Zeilen, Kapitel) darüber, ob spätere Such‑ und Vergleichsergebnisse belastbar sind.

Typische Aufgaben:
- OCR (z. B. Tesseract / PDF‑Textlayer) mit KI-Zusammenführung von verschiedenen OCR-Quellen
- strukturelle Normalisierung (Seiten/Abschnitte), damit später sauber zitiert und navigiert werden kann
- Annotationen (Zitate-Markierungen mit Autorangabe, Kursive, Fußnoten)
- reproduzierbare Verarbeitungsschritte für ein wachsendes Korpus (bis hin zum Gesamtwerk)

### 2) `ragkeep` – das kuratierte Archiv (Korpus, Provenienz, Korrekturen)
`ragkeep` ist der Ort, an dem die **aufbereiteten Texte dauerhaft gehalten** werden – inklusive Metadaten, Provenienz und Korrekturen.

Wichtig ist hier der Editions‑/Archivgedanke:
- klare Quellenordner und Manifeste
- nachvollziehbare Korrekturen (Errata)
- stabile Exportformate (z. B. Renderings/HTML, Indizes)

Kurz: `ragkeep` ist das **konsolidierte Textarchiv**, auf dem die Anwendung aufsetzt.

### 3) `ragrun` – die laufende Anwendung (Ingestion = Aufnahme in die KI-Matrix, Suche, Erklär-/Studienfunktionen)
`ragrun` ist die App‑Schicht: eine FastAPI‑Anwendung, die das Korpus aus `ragkeep` **indexiert** und **retrieval‑basiert zugänglich** macht.

Kernfunktionen (heute und perspektivisch):
- Eigene KI-Datenbank (Qdrant)
- Ingestion von Text‑„Chunks“ in eine Hybrid‑Suche (Vektor + Textindex/BM25)
- Inventar/Metadaten in einer relationalen DB (Quellen, Titel, IDs)
- Eigene Embedding-Engine (keine Zusatzkosten)
- Retrieval‑Endpunkte, u. a. „Concept Explain“: ein Begriff wird anhand einschlägiger Textstellen erklärt, inklusive Kontextfenster

`ragrun` ist damit die Oberfläche, die das Archiv **befragbar** und für Studienarbeit **praktisch nutzbar** macht.

---

## Warum diese Trennung sinnvoll ist
Ohne Trennung vermischen sich oft:
- **Editorik/OCR‑Qualität** (Fehler, Varianten, unklare Quellenketten)
- mit **Interpretation/Antwortgenerierung** (die dann auf wackliger Textbasis steht).

RAGxxx trennt deshalb:
- Textentstehung & Qualität (`ragprep`)
- Archivierung & Provenienz (`ragkeep`)
- Interaktion/Recherche‑Funktionen (`ragrun`)

So bleibt nachvollziehbar, *welche* Stelle verwendet wurde, *woher* sie kommt und *in welchem Kontext* sie steht.

---

## Geplantes Ziel: Steiners Gesamtwerk als Korpus + 5 KI‑Bücher

### Gesamtwerk Rudolf Steiners als Datenbasis + im Gesamtwerk erwähnte Werke
Langfristig ist geplant, Steiners Werk als **konsistentes, versionierbares Korpus** verfügbar zu machen – nicht als lose PDF‑Sammlung, sondern mit:
- stabilen IDs/Metadaten
- Zitierfähigkeit (Werk/Ort/Kontext)
- transparenten Qualitätsstufen (OCR/Revision)
- einem großen Korpus an KI-generierten Daten in 12 Weltanschauungen (Begriffserklärungen, Essays, Zusammenfassungen, Zitate (KI extrahiert))

### KI-Buch: *Philosophie der Freiheit und die drei Glieder des Sozialen Organismus*
Die App soll mehr können als „Suche“:
- **Erklärungsfunktion**: Buchstellen (Satz, Absatz, Kapitel) können von KI erklärt werden
- **Kommentarfunktion**: Buchstellen können kommentiert werden
- **Gedächtnisfunktion**: Die App merkt sich gelesene Passagen, Kommentare, Erklärungen. Der eigene Lernpfad wird sichtbar.
- **Studienmaterial**: Zu Begriffen, Absätzen, Zitaten und Kapiteln gibt es umfangreiches Studienmaterial zur Vertiefung
- **Kommunikationsfunktion**: Kommentare anderer Nutzer können (bei Freigabe) angeschaut und einbezogen werden
- **Weltanschauungen**: Mathematismus, Individualismus (Monadismus)

### Angedachte KI-Bücher
- Innere Entwicklung und Selbsteinweihung. Weltanschauungen: Psychismus und Phänomenalismus
- Die fünf Evangelien. Weltanschauungen: Pneumatismus, Sensualismus, Rationalismus, Dynamismus (Adler)
- Karma, Gnade und Freiheit: Weltanschauungen: Spiritualismus und Materialismus
- Die Geisteswissenschaft Rudolf Steiners: Idealismus und Realismus (Waage: Dynamismus/Phändmenalismus, Individualismus/Sensualismus, Mathematismus/Pneumatismus, Idealismus)
