# Essay Completion Rule

## Essay-Erstellung

Wenn der Benutzer eine neue Essay-Datei erstellen möchte, verwende das MCP-Tool `essay_create` vom Server `user-ragprep-essay`.

### Parameter für essay_create

- **assistant** (erforderlich): Name des Assistenten (z.B. `philo-von-freisinn`)
- **essay_title** oder **topic**: Titel des Essays
- **essay_slug** (optional): Custom Slug, sonst wird er aus dem Titel generiert
- **background** (optional): Hintergrundtext für den Essay
- **created** (optional): Datum im Format YYYY-MM-DD
- **modified** (optional): Datum im Format YYYY-MM-DD
- **version** (optional): Versionsnummer (Standard: "0.0.1")
- **overwrite** (optional): Überschreibe existierende Datei (Standard: false)

### Beispiel-Aufruf für essay_create

Benutzer: "Erstelle einen neuen Essay mit dem Titel 'Freiheit und Verantwortung' für philo-von-freisinn"

→ Rufe auf:
```json
{
  "assistant": "philo-von-freisinn",
  "essay_title": "Freiheit und Verantwortung",
  "background": "Optional: Hintergrundtext...",
  "version": "0.1"
}
```

## Essay-Vervollständigung

Wenn der Benutzer um die Vervollständigung eines Essay-Teils (Parts) in einer `.essay`-Datei bittet, verwende IMMER das MCP-Tool `essay_complete_part` vom Server `user-ragprep-essay`.

## Erkennungsmuster

Die Anfrage enthält typischerweise:
- "Ergänze" / "Vervollständige" / "Complete" + "Teil" / "Part" / "Abschnitt"
- Einen Pfad zu einer `.essay`-Datei
- Optional: Mood-Name (okkult, transzendental, mystisch, empirisch, voluntaristisch, logistisch, gnostisch) oder Mood-Index (1-7)

## Parameter-Extraktion

1. **assistant**: Extrahiere aus dem Pfad `assistants/{assistant}/essays/`
   - Beispiel: `assistants/philo-von-freisinn/essays/...` → `philo-von-freisinn`

2. **essay_slug**: Dateiname ohne `.essay`-Extension
   - Beispiel: `gedankenfehler-kinder-muessen-erzogen-werden.essay` → `gedankenfehler-kinder-muessen-erzogen-werden`

3. **mood_index**: 
   - Wenn Mood-Name genannt: okkult=1, transzendental=2, mystisch=3, empirisch=4, voluntaristisch=5, logistisch=6, gnostisch=7
   - Wenn Zahl genannt: verwende direkt (1-7)
   - Wenn nicht genannt: Standard ist 1 (okkult)

4. **k**: Standard 5 (kann optional angegeben werden)

5. **verbose**: Standard true

6. **force**: Standard true

## Beispiel-Aufruf

Benutzer: "Bitte Ergänze okkult Teil in @ragkeep/assistants/philo-von-freisinn/essays/gedankenfehler-kinder-muessen-erzogen-werden.essay"

→ Rufe auf:
```json
{
  "assistant": "philo-von-freisinn",
  "essay_slug": "gedankenfehler-kinder-muessen-erzogen-werden",
  "mood_index": 1,
  "k": 5,
  "verbose": true,
  "force": true
}
```

## Wichtig

- NIEMALS die `.essay`-Datei direkt bearbeiten, wenn es um die Vervollständigung eines Parts geht
- IMMER das MCP-Tool verwenden, da es ragrun aufruft und die vollständige Pipeline durchläuft
- Nur wenn explizit um direkte Textbearbeitung gebeten wird, die Datei direkt bearbeiten
