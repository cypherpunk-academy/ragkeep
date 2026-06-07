# Embedder Benchmark Queries – Philo von Freisinn

**Bücher:** Die Philosophie der Freiheit (GA 4) · Die Kernpunkte der sozialen Frage (GA 23)
**Queries gesamt:** 37
**Scoring:** `expected` + optionale `alt` → MRR@10, P@1, P@3. Ohne `expected`: qualitative Sichtung.

**Query-Typen:**
- `keyword` — Einzelbegriff; kein P@1-Scoring, stattdessen Recall@10
- `user` — Reale Nutzerfrage, oft lang und kontextuell
- `detail` — Spezifische Begriffsfrage
- `complex` — Mehrschichtige Zusammenhänge
- `cross` — Buchübergreifend (beide Bücher relevant)
- `quote` — Zitat-Retrieval (testet Quote-Chunks)
- `unscored` — Kein `expected`, nur qualitative Auswertung

---

## 1. Einzelbegriffe (keyword)

### Q01
**query:** Moralische Intuition
**type:** keyword
**book:** PhilFreiheit
**note:** Kein P@1-Scoring — viele Chunks relevant

### Q02
**query:** Dreigliederung
**type:** keyword
**book:** Kernpunkte
**note:** Kein P@1-Scoring — Kernbegriff des gesamten Buches

### Q03
**query:** Wahrnehmung
**type:** keyword
**book:** PhilFreiheit
**note:** Kein P@1-Scoring — zieht sich durch mehrere Kapitel

### Q04
**query:** Assoziation
**type:** keyword
**book:** Kernpunkte
**note:** Kein P@1-Scoring — Wirtschaftliche Assoziation als Organisationsprinzip

### Q05
**query:** Freier Geist
**type:** keyword
**book:** PhilFreiheit
**note:** Kein P@1-Scoring — zentraler Begriff mehrerer Kapitel

---

## 2. Reale User-Fragen (user)

### Q06
**query:** Was ist der Unterschied zwischen Freiheit und Willkür?
**type:** user
**book:** PhilFreiheit
**expected:** ix-die-idee-der-freiheit
**alt:** i-das-bewusste-menschliche-handeln, xii-die-moralische-fantasie-darwinismus-und-sittlichkeit

### Q07
**query:** Ich lese gerade die Philosophie der Freiheit und verstehe nicht, wie Steiner Freiheit begründet – er sagt, wir seien frei, wenn wir aus Intuition handeln, aber ist das nicht einfach eine andere Art von Determination durch unsere Gedanken?
**type:** user
**book:** PhilFreiheit
**expected:** ix-die-idee-der-freiheit
**alt:** xii-die-moralische-fantasie-darwinismus-und-sittlichkeit, i-das-bewusste-menschliche-handeln

### Q08
**query:** Was meint Steiner mit moralischer Phantasie?
**type:** user
**book:** PhilFreiheit
**expected:** xii-die-moralische-fantasie-darwinismus-und-sittlichkeit

### Q09
**query:** Steiner kritisiert sowohl den Kapitalismus als auch den Sozialismus – aber was schlägt er konkret vor? Ich höre immer "Dreigliederung", aber ich verstehe nicht, wie das in der Praxis aussehen soll, vor allem beim Wirtschaftsleben.
**type:** user
**book:** Kernpunkte
**expected:** (unscored — zu breit, qualitative Sichtung)

### Q10
**query:** Wie soll das Wirtschaftsleben konkret organisiert werden?
**type:** user
**book:** Kernpunkte
**expected:** ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten
**alt:** iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit

### Q11
**query:** Was ist das Wesen des Denkens?
**type:** user
**book:** PhilFreiheit
**expected:** iii-das-denken-im-dienste-der-weltauffassung
**alt:** viii-die-faktoren-des-lebens

### Q12
**query:** Wie unterscheidet sich Steiners Freiheitsbegriff von dem Kants?
**type:** unscored
**book:** PhilFreiheit
**note:** Kant nicht im Corpus. Testet ob das Modell Steiners Freiheitsbegriff findet ohne direkte Benennung.

### Q13
**query:** Ich frage mich, ob Steiners Dreigliederung überhaupt realistisch ist – hat er selbst erklärt, wie der Übergang von unserem heutigen zu einem dreigliedrigen Organismus aussehen soll, oder bleibt das rein theoretisch?
**type:** unscored
**book:** Kernpunkte
**note:** Übergangsfrage — qualitative Sichtung ob relevante Passagen gefunden werden

---

## 3. Detailfragen (detail)

### Q14
**query:** Was ist der Unterschied zwischen Begriff und Wahrnehmung bei Steiner?
**type:** detail
**book:** PhilFreiheit
**expected:** v-das-erkennen-der-welt
**alt:** iv-die-welt-als-wahrnehmung

### Q15
**query:** Was versteht Steiner unter dem "reinen Denken" und wie unterscheidet es sich vom gewöhnlichen Alltagsdenken?
**type:** detail
**book:** PhilFreiheit
**expected:** iii-das-denken-im-dienste-der-weltauffassung

### Q16
**query:** Was versteht Steiner unter "Assoziationen" im Wirtschaftsleben?
**type:** detail
**book:** Kernpunkte
**expected:** iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit

### Q17
**query:** Wie definiert Steiner den "naiven Realisten"?
**type:** detail
**book:** PhilFreiheit
**expected:** vii-gibt-es-grenzen-des-erkennens
**alt:** x-freiheitsphilosophie-und-monismus

### Q18
**query:** Was ist der Unterschied zwischen Gehirnwissen und Wirtschaftswissen?
**type:** detail
**book:** Kernpunkte
**expected:** i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit

### Q19
**query:** Was sind die Motive menschlichen Handelns nach der Philosophie der Freiheit?
**type:** detail
**book:** PhilFreiheit
**expected:** ix-die-idee-der-freiheit
**alt:** viii-die-faktoren-des-lebens

### Q20
**query:** Wie trennt Steiner Rechtsleben und Geistesleben voneinander?
**type:** detail
**book:** Kernpunkte
**expected:** i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit
**alt:** ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten

### Q21
**query:** Was ist eine Assoziation im Wirtschaftsleben und wie unterscheidet sie sich von einem Unternehmen?
**type:** detail
**book:** Kernpunkte
**expected:** iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit

### Q22
**query:** Was denkt Steiner über Vererbung und Anlage als Bestimmungsgründe des Handelns?
**type:** detail
**book:** PhilFreiheit
**expected:** xiv-individualitat-und-gattung
**alt:** ix-die-idee-der-freiheit

---

## 4. Komplexe Zusammenhänge (complex)

### Q23
**query:** Wie hängen Denken, Fühlen und Wollen in der menschlichen Handlung zusammen?
**type:** complex
**book:** PhilFreiheit
**expected:** viii-die-faktoren-des-lebens
**alt:** ix-die-idee-der-freiheit

### Q24
**query:** Inwiefern ist der ethische Individualismus eine Überwindung des Materialismus?
**type:** complex
**book:** PhilFreiheit
**expected:** x-freiheitsphilosophie-und-monismus
**alt:** ix-die-idee-der-freiheit

### Q25
**query:** Wie begründet Steiner, dass Freiheit und Naturnotwendigkeit sich nicht widersprechen?
**type:** complex
**book:** PhilFreiheit
**expected:** i-das-bewusste-menschliche-handeln
**alt:** ix-die-idee-der-freiheit

### Q26
**query:** Welche Rolle spielt das Kapital im dreigliedrigen sozialen Organismus, und wie wird es zirkuliert?
**type:** complex
**book:** Kernpunkte
**expected:** iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit
**alt:** ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten

### Q27
**query:** Wie verhält sich das Geistesleben zum Wirtschaftsleben – sind sie voneinander abhängig oder unabhängig?
**type:** complex
**book:** Kernpunkte
**expected:** i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit
**alt:** ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten

---

## 5. Buchübergreifende Fragen (cross)

### Q28
**query:** Wie hängt die individuelle Freiheit in der Philosophie der Freiheit mit der sozialen Freiheit in den Kernpunkten zusammen?
**type:** cross
**expected:** (unscored — erfordert Treffer aus beiden Büchern)

### Q29
**query:** Welche Rolle spielt das freie Denken sowohl in der Erkenntnistheorie als auch in der sozialen Gestaltung?
**type:** cross
**expected:** (unscored — erfordert Treffer aus beiden Büchern)

### Q30
**query:** Inwiefern ist Steiners Konzept des freien Geistes die Grundlage für die Dreigliederung des sozialen Organismus?
**type:** cross
**expected:** ix-die-idee-der-freiheit
**alt:** (+ relevante Kernpunkte-Chunks — noch nicht annotiert)

### Q31
**query:** Wie verhält sich der Individualismus der Philosophie der Freiheit zur Gemeinschaftsidee in den Kernpunkten?
**type:** cross
**expected:** (unscored — erfordert Treffer aus beiden Büchern)

### Q32
**query:** Was verbindet Steiners Erkenntnislehre mit seiner Sozialphilosophie – gibt es ein gemeinsames Fundament?
**type:** cross
**expected:** (unscored — erfordert Treffer aus beiden Büchern)

---

## 6. Zitat-Retrieval (quote)

### Q33
**query:** Steiner schreibt irgendwo sinngemäß, dass der Mensch keiner fremden Norm gehorchen soll – in welchem Zusammenhang?
**type:** quote
**book:** PhilFreiheit
**expected:** (unscored — Ziel ist Quote-Chunk-Retrieval, kein Kapitel-Match)
**note:** Testet ob Quote-Chunks besser ranken als Book-Chunks für direkte Zitat-Suche

### Q34
**query:** Wo schreibt Steiner, dass der freie Mensch sittlich handelt weil er die Idee will, nicht weil er muss?
**type:** quote
**book:** PhilFreiheit
**expected:** (unscored — Ziel ist Quote-Chunk-Retrieval)
**note:** Testet ob semantisch nahe Zitate gefunden werden

---

## 7. Grenzfälle / Negativ-Tests (unscored)

### Q35
**query:** Was denkt Steiner über Demokratie als politisches Prinzip?
**type:** unscored
**book:** Kernpunkte
**note:** Demokratie wird in den Kernpunkten behandelt, aber nicht als Hauptthema. Testet Grenzbereich des Corpus.

### Q36
**query:** Warum scheitern alle bisherigen sozialen Bewegungen laut Steiner?
**type:** unscored
**book:** Kernpunkte
**note:** Breite Frage — qualitative Sichtung ob relevante Passagen über Proletariat/soziale Bewegung gefunden werden

### Q37
**query:** Was denkt Steiner über künstliche Intelligenz?
**type:** unscored
**note:** Echter Negativ-Test — kein relevanter Treffer im Corpus zu erwarten. Testet False-Positive-Verhalten.

---

## Scoring-Übersicht

| Typ | Anzahl | Automatisch scorbar | Nur qualitativ |
|-----|--------|---------------------|----------------|
| keyword | 5 | Recall@10 | P@1 nicht sinnvoll |
| user | 8 | 5 (Q06, Q07, Q08, Q10, Q11) | 3 (Q09, Q12, Q13) |
| detail | 9 | 9 (Q14–Q22) | 0 |
| complex | 5 | 5 (Q23–Q27) | 0 |
| cross | 5 | 1 (Q30 teilweise) | 4 |
| quote | 2 | 0 | 2 |
| unscored | 3 | 0 | 3 |
| **Gesamt** | **37** | **~20 voll scorbar** | **~17** |

**Hinweis zu `expected` für Kernpunkte:** Die Kapitel-Slugs der Kernpunkte sind hier noch nicht annotiert. Sie müssen nach dem ersten Index-Lauf aus Qdrant/Supabase nachgetragen werden.
