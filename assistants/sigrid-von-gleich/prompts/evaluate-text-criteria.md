## Kriterienauswertung (Format-Hinweise)

Du prüfst die Kriterien **schrittweise** und begründest jedes Urteil mit mindestens **einem konkreten Textsignal**
(kurzes Zitat oder klare Textreferenz).

WICHTIG: **Deine Ausgabe muss ausschließlich gültiges JSON sein** (kein Markdown, keine Codeblöcke, kein Fließtext).
Halte dich an das JSON-Schema, das dir im Prompt explizit vorgegeben wird.

### Anforderungen pro Kriterium

- `name`: exakter Kriterienname (genau wie vorgegeben)
- `prediction`: Zahl 0..10
- `reason`: **nicht leer**, 1–2 Sätze auf Deutsch, mit Textsignal

### Failsafe

Wenn du **keine ausreichende Evidenz** findest, gib dennoch gültiges JSON zurück:
- setze `prediction` niedrig (z. B. 0–2)
- schreibe als `reason` kurz, dass im Abschnitt keine klaren Textsignale dafür vorkommen
