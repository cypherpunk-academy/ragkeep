# Embedder Benchmark – philo-von-freisinn

**Datum:** 2026-05-31  
**Scorable Queries:** 20 / 37  
**Top-N:** 10

## Ergebnisse

| Embedder | Modus | MRR@10 | P@1 | P@3 | n |
|----------|-------|---------|-----|-----|---|
| e5 | dense | 0.469 | 0.300 | 0.283 | 20 |
| e5 | sparse | 0.297 | 0.150 | 0.117 | 20 |
| e5 | hybrid | 0.361 | 0.150 | 0.200 | 20 |
| bge | dense | 0.573 | 0.450 | 0.383 | 20 |
| bge | sparse | 0.297 | 0.150 | 0.117 | 20 |
| bge | hybrid | 0.477 | 0.300 | 0.250 | 20 |
| cross | dense | 0.557 | 0.300 | 0.417 | 20 |
| cross | sparse | 0.297 | 0.150 | 0.117 | 20 |
| cross | hybrid | 0.448 | 0.200 | 0.283 | 20 |
| bm25 | sparse | 0.297 | 0.150 | 0.117 | 20 |

## Query-Details

### Q01: Moralische Intuition

**Typ:** keyword *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `xiv-individualitat-und-gattung` | 0.8546 |
| e5 | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 12.7973 |
| e5 | hybrid | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| bge | dense | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.7262 |
| bge | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 12.7973 |
| bge | hybrid | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| cross | dense | — | `x-freiheitsphilosophie-und-monismus` | 0.3680 |
| cross | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 12.7973 |
| cross | hybrid | — | `x-freiheitsphilosophie-und-monismus` | 0.5000 |
| bm25 | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 12.7973 |

### Q02: Dreigliederung

**Typ:** keyword *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.8206 |
| e5 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 15.1634 |
| e5 | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bge | dense | — | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.7358 |
| bge | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 15.1634 |
| bge | hybrid | — | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5000 |
| cross | dense | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.4238 |
| cross | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 15.1634 |
| cross | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bm25 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 15.1634 |

### Q03: Wahrnehmung

**Typ:** keyword *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `die-konsequenzen-des-monismus` | 0.8585 |
| e5 | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 4.4288 |
| e5 | hybrid | — | `die-konsequenzen-des-monismus` | 0.5000 |
| bge | dense | — | `iv-die-welt-als-wahrnehmung` | 0.7701 |
| bge | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 4.4288 |
| bge | hybrid | — | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| cross | dense | — | `vii-gibt-es-grenzen-des-erkennens` | 0.4020 |
| cross | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 4.4288 |
| cross | hybrid | — | `vii-gibt-es-grenzen-des-erkennens` | 0.5000 |
| bm25 | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 4.4288 |

### Q04: Assoziation

**Typ:** keyword *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.8211 |
| e5 | sparse | — | `i-das-bewusste-menschliche-handeln` | 23.8607 |
| e5 | hybrid | — | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bge | dense | — | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.6892 |
| bge | sparse | — | `i-das-bewusste-menschliche-handeln` | 23.8607 |
| bge | hybrid | — | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.5000 |
| cross | dense | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.2302 |
| cross | sparse | — | `i-das-bewusste-menschliche-handeln` | 23.8607 |
| cross | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bm25 | sparse | — | `i-das-bewusste-menschliche-handeln` | 23.8607 |

### Q05: Freier Geist

**Typ:** keyword *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `ix-die-idee-der-freiheit` | 0.8324 |
| e5 | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 14.5208 |
| e5 | hybrid | — | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bge | dense | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.6884 |
| bge | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 14.5208 |
| bge | hybrid | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| cross | dense | — | `ix-die-idee-der-freiheit` | 0.4082 |
| cross | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 14.5208 |
| cross | hybrid | — | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bm25 | sparse | — | `iii-das-denken-im-dienste-der-weltauffassung` | 14.5208 |

### Q06: Was ist der Unterschied zwischen Freiheit und Willkür?

**Erwartet:** `ix-die-idee-der-freiheit`, `i-das-bewusste-menschliche-handeln`, `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 1 ✓ | `i-das-bewusste-menschliche-handeln` | 0.8335 |
| e5 | sparse | 3 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 30.7121 |
| e5 | hybrid | 2 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| bge | dense | 1 ✓ | `ix-die-idee-der-freiheit` | 0.7368 |
| bge | sparse | 3 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 30.7121 |
| bge | hybrid | 1 ✓ | `ix-die-idee-der-freiheit` | 0.5000 |
| cross | dense | 1 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5016 |
| cross | sparse | 3 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 30.7121 |
| cross | hybrid | 2 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| bm25 | sparse | 3 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 30.7121 |

### Q07: Ich lese gerade die Philosophie der Freiheit und verstehe nicht, wie Steiner Fre…

**Erwartet:** `ix-die-idee-der-freiheit`, `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit`, `i-das-bewusste-menschliche-handeln`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 1 ✓ | `i-das-bewusste-menschliche-handeln` | 0.8872 |
| e5 | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 30.9774 |
| e5 | hybrid | 2 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bge | dense | 1 ✓ | `ix-die-idee-der-freiheit` | 0.8507 |
| bge | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 30.9774 |
| bge | hybrid | 1 ✓ | `ix-die-idee-der-freiheit` | 0.5000 |
| cross | dense | 2 ✓ | `v-das-erkennen-der-welt` | 0.4714 |
| cross | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 30.9774 |
| cross | hybrid | 3 ✓ | `v-das-erkennen-der-welt` | 0.5000 |
| bm25 | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 30.9774 |

### Q08: Was meint Steiner mit moralischer Phantasie?

**Erwartet:** `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 2 ✓ | `vorrede-zur-neuausgabe` | 0.8242 |
| e5 | sparse | ✗ (>10) | `vi-die-menschliche-individualitat` | 23.2729 |
| e5 | hybrid | 5 ✓ | `vi-die-menschliche-individualitat` | 0.5000 |
| bge | dense | 1 ✓ | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.7619 |
| bge | sparse | ✗ (>10) | `vi-die-menschliche-individualitat` | 23.2729 |
| bge | hybrid | 1 ✓ | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| cross | dense | 3 ✓ | `x-freiheitsphilosophie-und-monismus` | 0.3673 |
| cross | sparse | ✗ (>10) | `vi-die-menschliche-individualitat` | 23.2729 |
| cross | hybrid | 6 ✓ | `x-freiheitsphilosophie-und-monismus` | 0.5000 |
| bm25 | sparse | ✗ (>10) | `vi-die-menschliche-individualitat` | 23.2729 |

### Q09: Steiner kritisiert sowohl den Kapitalismus als auch den Sozialismus – aber was s…

**Typ:** user *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `chapter-5` | 0.8819 |
| e5 | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 36.4155 |
| e5 | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bge | dense | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.8134 |
| bge | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 36.4155 |
| bge | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| cross | dense | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.4259 |
| cross | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 36.4155 |
| cross | hybrid | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.5000 |
| bm25 | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 36.4155 |

### Q10: Wie soll das Wirtschaftsleben konkret organisiert werden?

**Erwartet:** `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten`, `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 3 ✓ | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.8517 |
| e5 | sparse | ✗ (>10) | `erster-anhang` | 24.4836 |
| e5 | hybrid | 6 ✓ | `erster-anhang` | 0.5000 |
| bge | dense | 1 ✓ | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.7839 |
| bge | sparse | ✗ (>10) | `erster-anhang` | 24.4836 |
| bge | hybrid | 2 ✓ | `erster-anhang` | 0.5000 |
| cross | dense | 1 ✓ | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.3699 |
| cross | sparse | ✗ (>10) | `erster-anhang` | 24.4836 |
| cross | hybrid | 1 ✓ | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bm25 | sparse | ✗ (>10) | `erster-anhang` | 24.4836 |

### Q11: Was ist das Wesen des Denkens?

**Erwartet:** `iii-das-denken-im-dienste-der-weltauffassung`, `viii-die-faktoren-des-lebens`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 2 ✓ | `i-das-bewusste-menschliche-handeln` | 0.8548 |
| e5 | sparse | 4 ✓ | `v-das-erkennen-der-welt` | 6.4042 |
| e5 | hybrid | 4 ✓ | `v-das-erkennen-der-welt` | 0.5000 |
| bge | dense | 1 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.7981 |
| bge | sparse | 4 ✓ | `v-das-erkennen-der-welt` | 6.4042 |
| bge | hybrid | 2 ✓ | `v-das-erkennen-der-welt` | 0.5000 |
| cross | dense | 3 ✓ | `i-das-bewusste-menschliche-handeln` | 0.3675 |
| cross | sparse | 4 ✓ | `v-das-erkennen-der-welt` | 6.4042 |
| cross | hybrid | 3 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bm25 | sparse | 4 ✓ | `v-das-erkennen-der-welt` | 6.4042 |

### Q12: Wie unterscheidet sich Steiners Freiheitsbegriff von dem Kants?

**Typ:** unscored *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `ix-die-idee-der-freiheit` | 0.8253 |
| e5 | sparse | — | `v-das-erkennen-der-welt` | 19.7626 |
| e5 | hybrid | — | `ix-die-idee-der-freiheit` | 0.5000 |
| bge | dense | — | `ix-die-idee-der-freiheit` | 0.7271 |
| bge | sparse | — | `v-das-erkennen-der-welt` | 19.7626 |
| bge | hybrid | — | `v-das-erkennen-der-welt` | 0.5000 |
| cross | dense | — | `i-das-bewusste-menschliche-handeln` | 0.4183 |
| cross | sparse | — | `v-das-erkennen-der-welt` | 19.7626 |
| cross | hybrid | — | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bm25 | sparse | — | `v-das-erkennen-der-welt` | 19.7626 |

### Q13: Ich frage mich, ob Steiners Dreigliederung überhaupt realistisch ist – hat er se…

**Typ:** unscored *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `erster-anhang` | 0.8537 |
| e5 | sparse | — | `viii-die-faktoren-des-lebens` | 34.5425 |
| e5 | hybrid | — | `erster-anhang` | 0.5000 |
| bge | dense | — | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.7852 |
| bge | sparse | — | `viii-die-faktoren-des-lebens` | 34.5425 |
| bge | hybrid | — | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5000 |
| cross | dense | — | `erster-anhang` | 0.3433 |
| cross | sparse | — | `viii-die-faktoren-des-lebens` | 34.5425 |
| cross | hybrid | — | `erster-anhang` | 0.5000 |
| bm25 | sparse | — | `viii-die-faktoren-des-lebens` | 34.5425 |

### Q14: Was ist der Unterschied zwischen Begriff und Wahrnehmung bei Steiner?

**Erwartet:** `v-das-erkennen-der-welt`, `iv-die-welt-als-wahrnehmung`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 4 ✓ | `erster-anhang` | 0.8434 |
| e5 | sparse | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| e5 | hybrid | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bge | dense | 4 ✓ | `vii-gibt-es-grenzen-des-erkennens` | 0.7583 |
| bge | sparse | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| bge | hybrid | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| cross | dense | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 0.3589 |
| cross | sparse | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| cross | hybrid | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | 1 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |

### Q15: Was versteht Steiner unter dem "reinen Denken" und wie unterscheidet es sich vom…

**Erwartet:** `iii-das-denken-im-dienste-der-weltauffassung`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 1 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.8541 |
| e5 | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 22.2118 |
| e5 | hybrid | 1 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bge | dense | 3 ✓ | `v-das-erkennen-der-welt` | 0.7741 |
| bge | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 22.2118 |
| bge | hybrid | 5 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| cross | dense | 1 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.4070 |
| cross | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 22.2118 |
| cross | hybrid | 2 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 22.2118 |

### Q16: Was versteht Steiner unter "Assoziationen" im Wirtschaftsleben?

**Erwartet:** `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | ✗ (>10) | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.8477 |
| e5 | sparse | 4 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| e5 | hybrid | 8 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bge | dense | ✗ (>10) | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.7643 |
| bge | sparse | 4 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| bge | hybrid | 7 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| cross | dense | 2 ✓ | `iv-die-welt-als-wahrnehmung` | 0.3436 |
| cross | sparse | 4 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| cross | hybrid | 4 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | 4 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |

### Q17: Wie definiert Steiner den "naiven Realisten"?

**Erwartet:** `vii-gibt-es-grenzen-des-erkennens`, `x-freiheitsphilosophie-und-monismus`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 2 ✓ | `erster-anhang` | 0.8300 |
| e5 | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| e5 | hybrid | 4 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bge | dense | 1 ✓ | `vii-gibt-es-grenzen-des-erkennens` | 0.7677 |
| bge | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| bge | hybrid | 2 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| cross | dense | 1 ✓ | `vii-gibt-es-grenzen-des-erkennens` | 0.3968 |
| cross | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| cross | hybrid | 1 ✓ | `vii-gibt-es-grenzen-des-erkennens` | 0.5000 |
| bm25 | sparse | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 19.4834 |

### Q18: Was ist der Unterschied zwischen Gehirnwissen und Wirtschaftswissen?

**Erwartet:** `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 0.8190 |
| e5 | sparse | 10 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 18.7096 |
| e5 | hybrid | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bge | dense | 6 ✓ | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.7309 |
| bge | sparse | 10 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 18.7096 |
| bge | hybrid | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| cross | dense | 2 ✓ | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.2945 |
| cross | sparse | 10 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 18.7096 |
| cross | hybrid | 3 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bm25 | sparse | 10 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 18.7096 |

### Q19: Was sind die Motive menschlichen Handelns nach der Philosophie der Freiheit?

**Erwartet:** `ix-die-idee-der-freiheit`, `viii-die-faktoren-des-lebens`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 4 ✓ | `i-das-bewusste-menschliche-handeln` | 0.8519 |
| e5 | sparse | 2 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |
| e5 | hybrid | 3 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bge | dense | 1 ✓ | `ix-die-idee-der-freiheit` | 0.8032 |
| bge | sparse | 2 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |
| bge | hybrid | 1 ✓ | `ix-die-idee-der-freiheit` | 0.5000 |
| cross | dense | 4 ✓ | `i-das-bewusste-menschliche-handeln` | 0.3780 |
| cross | sparse | 2 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |
| cross | hybrid | 3 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| bm25 | sparse | 2 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |

### Q20: Wie trennt Steiner Rechtsleben und Geistesleben voneinander?

**Erwartet:** `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit`, `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 3 ✓ | `erster-anhang` | 0.8351 |
| e5 | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| e5 | hybrid | 5 ✓ | `erster-anhang` | 0.5769 |
| bge | dense | ✗ (>10) | `ix-die-idee-der-freiheit` | 0.7489 |
| bge | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| bge | hybrid | ✗ (>10) | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| cross | dense | 2 ✓ | `i-das-bewusste-menschliche-handeln` | 0.3445 |
| cross | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |
| cross | hybrid | 3 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | 6 ✓ | `iv-die-welt-als-wahrnehmung` | 19.4834 |

### Q21: Was ist eine Assoziation im Wirtschaftsleben und wie unterscheidet sie sich von …

**Erwartet:** `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | ✗ (>10) | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.8486 |
| e5 | sparse | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 23.8607 |
| e5 | hybrid | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bge | dense | ✗ (>10) | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.7877 |
| bge | sparse | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 23.8607 |
| bge | hybrid | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| cross | dense | 4 ✓ | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.4107 |
| cross | sparse | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 23.8607 |
| cross | hybrid | 7 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bm25 | sparse | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 23.8607 |

### Q22: Was denkt Steiner über Vererbung und Anlage als Bestimmungsgründe des Handelns?

**Erwartet:** `xiv-individualitat-und-gattung`, `ix-die-idee-der-freiheit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 4 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.8079 |
| e5 | sparse | 1 ✓ | `xiv-individualitat-und-gattung` | 25.4475 |
| e5 | hybrid | 2 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5000 |
| bge | dense | 2 ✓ | `i-das-bewusste-menschliche-handeln` | 0.7490 |
| bge | sparse | 1 ✓ | `xiv-individualitat-und-gattung` | 25.4475 |
| bge | hybrid | 2 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| cross | dense | 5 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.3763 |
| cross | sparse | 1 ✓ | `xiv-individualitat-und-gattung` | 25.4475 |
| cross | hybrid | 1 ✓ | `xiv-individualitat-und-gattung` | 0.5000 |
| bm25 | sparse | 1 ✓ | `xiv-individualitat-und-gattung` | 25.4475 |

### Q23: Wie hängen Denken, Fühlen und Wollen in der menschlichen Handlung zusammen?

**Erwartet:** `viii-die-faktoren-des-lebens`, `ix-die-idee-der-freiheit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 1 ✓ | `ix-die-idee-der-freiheit` | 0.8556 |
| e5 | sparse | 4 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 21.8065 |
| e5 | hybrid | 2 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.5000 |
| bge | dense | 2 ✓ | `i-das-bewusste-menschliche-handeln` | 0.8064 |
| bge | sparse | 4 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 21.8065 |
| bge | hybrid | 3 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| cross | dense | 3 ✓ | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5178 |
| cross | sparse | 4 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 21.8065 |
| cross | hybrid | 5 ✓ | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| bm25 | sparse | 4 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 21.8065 |

### Q24: Inwiefern ist der ethische Individualismus eine Überwindung des Materialismus?

**Erwartet:** `x-freiheitsphilosophie-und-monismus`, `ix-die-idee-der-freiheit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 8 ✓ | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.8801 |
| e5 | sparse | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |
| e5 | hybrid | ✗ (>10) | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| bge | dense | 5 ✓ | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.7733 |
| bge | sparse | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |
| bge | hybrid | 9 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| cross | dense | 10 ✓ | `i-das-bewusste-menschliche-handeln` | 0.4493 |
| cross | sparse | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |
| cross | hybrid | ✗ (>10) | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bm25 | sparse | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |

### Q25: Wie begründet Steiner, dass Freiheit und Naturnotwendigkeit sich nicht widerspre…

**Erwartet:** `i-das-bewusste-menschliche-handeln`, `ix-die-idee-der-freiheit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 1 ✓ | `i-das-bewusste-menschliche-handeln` | 0.8375 |
| e5 | sparse | 1 ✓ | `ix-die-idee-der-freiheit` | 22.9429 |
| e5 | hybrid | 1 ✓ | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bge | dense | 1 ✓ | `ix-die-idee-der-freiheit` | 0.7603 |
| bge | sparse | 1 ✓ | `ix-die-idee-der-freiheit` | 22.9429 |
| bge | hybrid | 1 ✓ | `ix-die-idee-der-freiheit` | 0.5000 |
| cross | dense | 2 ✓ | `iv-die-welt-als-wahrnehmung` | 0.4423 |
| cross | sparse | 1 ✓ | `ix-die-idee-der-freiheit` | 22.9429 |
| cross | hybrid | 2 ✓ | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | 1 ✓ | `ix-die-idee-der-freiheit` | 22.9429 |

### Q26: Welche Rolle spielt das Kapital im dreigliedrigen sozialen Organismus, und wie w…

**Erwartet:** `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit`, `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 1 ✓ | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.8578 |
| e5 | sparse | 2 ✓ | `vorrede-zur-neuausgabe` | 28.1089 |
| e5 | hybrid | 2 ✓ | `vorrede-zur-neuausgabe` | 0.5000 |
| bge | dense | 1 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.8182 |
| bge | sparse | 2 ✓ | `vorrede-zur-neuausgabe` | 28.1089 |
| bge | hybrid | 2 ✓ | `vorrede-zur-neuausgabe` | 0.5000 |
| cross | dense | 2 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.3740 |
| cross | sparse | 2 ✓ | `vorrede-zur-neuausgabe` | 28.1089 |
| cross | hybrid | 3 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.5000 |
| bm25 | sparse | 2 ✓ | `vorrede-zur-neuausgabe` | 28.1089 |

### Q27: Wie verhält sich das Geistesleben zum Wirtschaftsleben – sind sie voneinander ab…

**Erwartet:** `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit`, `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | 3 ✓ | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.8697 |
| e5 | sparse | 4 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 20.7276 |
| e5 | hybrid | 5 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5000 |
| bge | dense | 2 ✓ | `vorrede-und-einleitung-zum-41-bis-80-tausend-dieser-schrift` | 0.7946 |
| bge | sparse | 4 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 20.7276 |
| bge | hybrid | 4 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5476 |
| cross | dense | 1 ✓ | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.4028 |
| cross | sparse | 4 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 20.7276 |
| cross | hybrid | 2 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5000 |
| bm25 | sparse | 4 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 20.7276 |

### Q28: Wie hängt die individuelle Freiheit in der Philosophie der Freiheit mit der sozi…

**Typ:** cross *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.8419 |
| e5 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 32.8662 |
| e5 | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bge | dense | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.7662 |
| bge | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 32.8662 |
| bge | hybrid | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| cross | dense | — | `i-das-bewusste-menschliche-handeln` | 0.4136 |
| cross | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 32.8662 |
| cross | hybrid | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| bm25 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 32.8662 |

### Q29: Welche Rolle spielt das freie Denken sowohl in der Erkenntnistheorie als auch in…

**Typ:** cross *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `i-das-bewusste-menschliche-handeln` | 0.8341 |
| e5 | sparse | — | `vorrede-zur-neuausgabe` | 28.1089 |
| e5 | hybrid | — | `vorrede-zur-neuausgabe` | 0.5000 |
| bge | dense | — | `i-das-bewusste-menschliche-handeln` | 0.7662 |
| bge | sparse | — | `vorrede-zur-neuausgabe` | 28.1089 |
| bge | hybrid | — | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| cross | dense | — | `i-das-bewusste-menschliche-handeln` | 0.3497 |
| cross | sparse | — | `vorrede-zur-neuausgabe` | 28.1089 |
| cross | hybrid | — | `vorrede-zur-neuausgabe` | 0.5000 |
| bm25 | sparse | — | `vorrede-zur-neuausgabe` | 28.1089 |

### Q30: Inwiefern ist Steiners Konzept des freien Geistes die Grundlage für die Dreiglie…

**Erwartet:** `ix-die-idee-der-freiheit`

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | ✗ (>10) | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.8612 |
| e5 | sparse | 6 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |
| e5 | hybrid | ✗ (>10) | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bge | dense | ✗ (>10) | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.8236 |
| bge | sparse | 6 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |
| bge | hybrid | ✗ (>10) | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.5000 |
| cross | dense | 3 ✓ | `iii-kapitalismus-und-soziale-ideen-kapital-menschenarbeit` | 0.3966 |
| cross | sparse | 6 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |
| cross | hybrid | 5 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 0.5000 |
| bm25 | sparse | 6 ✓ | `iii-das-denken-im-dienste-der-weltauffassung` | 22.0906 |

### Q31: Wie verhält sich der Individualismus der Philosophie der Freiheit zur Gemeinscha…

**Typ:** cross *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `xiv-individualitat-und-gattung` | 0.8383 |
| e5 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |
| e5 | hybrid | — | `xiv-individualitat-und-gattung` | 0.5000 |
| bge | dense | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.7617 |
| bge | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |
| bge | hybrid | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| cross | dense | — | `i-das-bewusste-menschliche-handeln` | 0.3758 |
| cross | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |
| cross | hybrid | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| bm25 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.1362 |

### Q32: Was verbindet Steiners Erkenntnislehre mit seiner Sozialphilosophie – gibt es ei…

**Typ:** cross *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.8303 |
| e5 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.3528 |
| e5 | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bge | dense | — | `iv-internationale-beziehungen-der-sozialen-organismen` | 0.7636 |
| bge | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.3528 |
| bge | hybrid | — | `iv-internationale-beziehungen-der-sozialen-organismen` | 0.5000 |
| cross | dense | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.2960 |
| cross | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.3528 |
| cross | hybrid | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 0.5000 |
| bm25 | sparse | — | `xiii-der-wert-des-lebens-pessimismus-und-optimismus` | 22.3528 |

### Q33: Steiner schreibt irgendwo sinngemäß, dass der Mensch keiner fremden Norm gehorch…

**Typ:** quote *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `erster-anhang` | 0.8387 |
| e5 | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 44.6239 |
| e5 | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bge | dense | — | `ix-die-idee-der-freiheit` | 0.7783 |
| bge | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 44.6239 |
| bge | hybrid | — | `ix-die-idee-der-freiheit` | 0.5000 |
| cross | dense | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.4175 |
| cross | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 44.6239 |
| cross | hybrid | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 0.5000 |
| bm25 | sparse | — | `ii-die-vom-leben-geforderten-wirklichkeitsgemassen-losungsversuche-fur-die-sozialen-fragen-und-notwendigkeiten` | 44.6239 |

### Q34: Wo schreibt Steiner, dass der freie Mensch sittlich handelt weil er die Idee wil…

**Typ:** quote *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `i-das-bewusste-menschliche-handeln` | 0.8414 |
| e5 | sparse | — | `x-freiheitsphilosophie-und-monismus` | 24.8949 |
| e5 | hybrid | — | `x-freiheitsphilosophie-und-monismus` | 0.5000 |
| bge | dense | — | `ix-die-idee-der-freiheit` | 0.8131 |
| bge | sparse | — | `x-freiheitsphilosophie-und-monismus` | 24.8949 |
| bge | hybrid | — | `x-freiheitsphilosophie-und-monismus` | 0.5000 |
| cross | dense | — | `i-das-bewusste-menschliche-handeln` | 0.4314 |
| cross | sparse | — | `x-freiheitsphilosophie-und-monismus` | 24.8949 |
| cross | hybrid | — | `i-das-bewusste-menschliche-handeln` | 0.5000 |
| bm25 | sparse | — | `x-freiheitsphilosophie-und-monismus` | 24.8949 |

### Q35: Was denkt Steiner über Demokratie als politisches Prinzip?

**Typ:** unscored *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `v-anhang-i-an-das-deutsche-volk-und-an-die-kulturwelt-i` | 0.8094 |
| e5 | sparse | — | `die-konsequenzen-des-monismus` | 30.4607 |
| e5 | hybrid | — | `die-konsequenzen-des-monismus` | 0.5000 |
| bge | dense | — | `x-freiheitsphilosophie-und-monismus` | 0.6995 |
| bge | sparse | — | `die-konsequenzen-des-monismus` | 30.4607 |
| bge | hybrid | — | `die-konsequenzen-des-monismus` | 0.5000 |
| cross | dense | — | `iv-die-welt-als-wahrnehmung` | 0.2567 |
| cross | sparse | — | `die-konsequenzen-des-monismus` | 30.4607 |
| cross | hybrid | — | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | — | `die-konsequenzen-des-monismus` | 30.4607 |

### Q36: Warum scheitern alle bisherigen sozialen Bewegungen laut Steiner?

**Typ:** unscored *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.8233 |
| e5 | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 23.9913 |
| e5 | hybrid | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.5000 |
| bge | dense | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.7009 |
| bge | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 23.9913 |
| bge | hybrid | — | `i-die-wahre-gestalt-der-sozialen-frage-erfasst-aus-dem-leben-der-modernen-menschheit` | 0.5000 |
| cross | dense | — | `iv-die-welt-als-wahrnehmung` | 0.4716 |
| cross | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 23.9913 |
| cross | hybrid | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 0.5000 |
| bm25 | sparse | — | `xii-die-moralische-fantasie-darwinismus-und-sittlichkeit` | 23.9913 |

### Q37: Was denkt Steiner über künstliche Intelligenz?

**Typ:** unscored *(unscored)*

| Embedder | Modus | Rang | Top-1 segment_id | score |
|----------|-------|-----:|-----------------|------:|
| e5 | dense | — | `erster-anhang` | 0.8188 |
| e5 | sparse | — | `v-das-erkennen-der-welt` | 22.8479 |
| e5 | hybrid | — | `v-das-erkennen-der-welt` | 0.5000 |
| bge | dense | — | `die-konsequenzen-des-monismus` | 0.7100 |
| bge | sparse | — | `v-das-erkennen-der-welt` | 22.8479 |
| bge | hybrid | — | `die-konsequenzen-des-monismus` | 0.5000 |
| cross | dense | — | `iv-die-welt-als-wahrnehmung` | 0.2981 |
| cross | sparse | — | `v-das-erkennen-der-welt` | 22.8479 |
| cross | hybrid | — | `iv-die-welt-als-wahrnehmung` | 0.5000 |
| bm25 | sparse | — | `v-das-erkennen-der-welt` | 22.8479 |
