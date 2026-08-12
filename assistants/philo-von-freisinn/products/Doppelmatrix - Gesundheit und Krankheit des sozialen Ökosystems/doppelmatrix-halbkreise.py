#!/usr/bin/env python3
"""
Doppelmatrix — DIN-A2-Hochformat mit zwei Dreiecken untereinander.

  Obere Haelfte:  Krankheit
  Untere Haelfte: Gesundheit

Zusammenhang mit doppelmatrix-gesund-und-krank.yaml
-----------------------------------------
Die YAML ist die inhaltliche Quelle (9 Richtungsfelder x gesund/krank,
je 7 Aspekte mit schlagwort + schlagsatz bei den 6 Kantenfeldern;
Medianfelder 07–09 nur Titel/Label).

Halbkreis-Index (LABELS/RADIAL/BLOCKS)  <->  YAML
  Gesund / Krank:
    7  Geist -> Recht                dm-01g / dm-01k
    4  Geist -> Wirtschaft           dm-02g / dm-02k
    6  Recht -> Geist                dm-03g / dm-03k
    0  Recht -> Wirtschaft           dm-04g / dm-04k
    1  Wirtschaft -> Recht           dm-05g / dm-05k
    3  Wirtschaft -> Geist           dm-06g / dm-06k
    8  Geist + Recht -> Wirtschaft   dm-07g / dm-07k  (nur Label)
    5  Geist + Wirtschaft -> Recht   dm-08g / dm-08k  (nur Label)
    2  Recht + Wirtschaft -> Geist   dm-09g / dm-09k  (nur Label)

RADIAL und BLOCKS hier manuell spiegeln — kein YAML-Import.
Bei inhaltlichen Aenderungen zuerst die YAML, dann hier nachziehen,
danach dieses Script ausfuehren (schreibt doppelmatrix-halbkreise.svg).
"""
import math

# ---------------------------------------------------------------- Seite (DIN A2 Hochformat)
# 1 SVG-Einheit = 0.1 mm  →  A2 = 420×594 mm = 4200×5940 Einheiten
PAGE_W = 4200.0
PAGE_H = 5940.0
PAGE_MARGIN = 80.0
HALF_GAP = 60.0              # Abstand zwischen Krankheits- und Gesundheits-Haelfte

MAIN_TITLE = "Gesundheit und Krankheit des Sozialen"
MAIN_TITLE_WIDTH_FRAC = 0.90  # Anteil der Seitenbreite

# ---------------------------------------------------------------- Dreiecks-Parameter
SIDE   = 1400.0              # Seitenlaenge (gleichseitig)
R      = 87.5                # Radius der Halbkreise
OFFSET = 240.0               # Aussenversatz der Eck-Halbkreise
MEDIAN_OFFSET = 340.0        # Aussenversatz der mittleren (Median-)Halbkreise
CORNER_T = 0.155             # Kantenanteil Eck-Halbkreise (kleiner = naeher an Ecke)
ROTATE_LABELS = False
LABEL_ARC_PAD = 10.0

BG         = "#f4f1ea"
TRI_FILL   = "#9b9b9b"
TRI_STROKE = "#6f6f6f"
ARC_COLOR  = "#2b2b2b"
TXT_COLOR  = "#2b2b2b"
FONT       = "Georgia, 'Times New Roman', serif"
FONT_SIZE  = 18
LINE_H     = 22
BLOCK_FONT = 24
BLOCK_LH   = 34
BLOCK_PAD  = 60
RAD_FONT   = 22
RAD_GAP    = 14
V_FONT_SIZE = 46
V_GAP      = 85
SECTION_FONT = 56            # "Krankheit" / "Gesundheit"

BLOCK_NUDGE = {
    0: (0, -150),
    6: (0, -150),
}

# Beschriftung in der Reihenfolge:
# links oben / links unten / links Mitte(Median),
# unten links / unten rechts / unten Mitte,
# rechts oben / rechts unten / rechts Mitte
LABELS = [
    ["Recht \u2192", "Wirtschaft:",
     "Das Gesetz", "sichert den", "fairen Rahmen"],
    ["Wirtschaft \u2192", "Recht:",
     "Die Wirtschaft", "tr\u00e4gt den Staat"],
    ["Recht +", "Wirtschaft", "\u2192 Geist:",
     "Schutz und", "Versorgung", "befreien", "den Geist"],
    ["Wirtschaft \u2192", "Geist:",
     "Die Wirtschaft", "versorgt", "den Geist"],
    ["Geist \u2192", "Wirtschaft:",
     "F\u00e4higkeiten", "befruchten die", "Wirtschaft"],
    ["Geist +", "Wirtschaft", "\u2192 Recht:",
     "Einsicht und", "Mittel tragen", "den Staat"],
    ["Recht \u2192 Geist:",
     "Der Staat", "bewahrt die", "Freiheit des", "Einzelnen"],
    ["Geist \u2192 Recht:",
     "Sachkenntnis", "pr\u00e4gt das", "Recht"],
    ["Geist + Recht", "\u2192 Wirtschaft:",
     "Bildung und", "Rahmen", "erm\u00f6glichen", "das Wirtschaften"],
]

RADIAL = {
    7: ["Entfaltung", "Erfahrung", "Miturteil", "Verst\u00e4ndlichkeit",
        "Mitwirken", "Zutrauen", "Rechtssinn"],
    4: ["Bed\u00fcrfnisse", "Ideen", "Kapital", "Materialisierung",
        "\u00dcberblick", "Aufgaben", "Korrektur"],
    6: ["Freiheit", "Zugang", "Chancen", "Schenkung",
        "Offenheit", "Richten", "Mitreden"],
    0: ["Arbeit", "Boden", "Eigentum", "Vertrag",
        "Haftung", "Grenze", "Einspruch"],
    1: ["Ertrag", "Durchsetzung", "Sicherung", "Versorgung",
        "Lieferung", "Freistellung", "Enthaltung"],
    3: ["Unterhalt", "Werk- und Wirkungst\u00e4tten", "Verl\u00e4sslichkeit",
        "Gabe", "Verzicht", "Fr\u00fcchte", "Br\u00fcderlichkeit"],
}
RADIAL_REVERSE = False

LABEL_NUDGE = {
    6: (28, -88),
    4: (40, 40),
    3: (-40, 40),
}

BLOCKS = [
    (7, "right", [
        ("Entfaltung", "Jeder kann das werden, was in ihm steckt."),
        ("Erfahrung", "Gesetze aus Erfahrung \u2014 nicht aus Mehrheiten."),
        ("Miturteil", "Pr\u00fcfen, bevor es gilt."),
        ("Verst\u00e4ndlichkeit",
         "Gesetze muss jeder m\u00fcndige B\u00fcrger verstehen k\u00f6nnen."),
        ("Mitwirken", "Einsprechen, nachdem es gilt."),
        ("Zutrauen", "Richter aus Zutrauen \u2014 gew\u00e4hlt auf Zeit."),
        ("Rechtssinn", "Wer einsieht, braucht keinen Zwang."),
    ]),
    (4, "right", [
        ("Bed\u00fcrfnisse",
         "Das Bed\u00fcrfnis ist der Anfang \u2014 und kommt nicht aus der Wirtschaft."),
        ("Ideen", "Die Idee befeuert die Produktion \u2014 nicht Gewinn, nicht Zwang."),
        ("Kapital", "Kapital ist geronnener Geist."),
        ("Materialisierung",
         "Der Gedanke vermehrt sich beim Teilen \u2014 das Brot nicht."),
        ("\u00dcberblick", "Wer das Ganze \u00fcbersieht, arbeitet f\u00fcr andere."),
        ("Aufgaben",
         "F\u00e4higkeit trifft Aufgabe \u2014 besetzt nach K\u00f6nnen, "
         "nicht nach Rang oder Ausbildung."),
        ("Korrektur", "Pull Request statt Beschwerde \u2014 Kritik als Gabe."),
    ]),
    (6, "right", [
        ("Freiheit", "Niemand greift dir ins Denken."),
        ("Zugang", "Wissen ist Anspruch, nicht Gnade."),
        ("Chancen", "Gleicher Boden f\u00fcr jede Gabe."),
        ("Schenkung", "Die Wirtschaft gibt, ohne zu diktieren."),
        ("Offenheit", "Quelloffen, nicht blo\u00df auditierbar."),
        ("Richten", "Richten ohne Vorgabe."),
        ("Mitreden", "Kein Einwand geht verloren."),
    ]),
    (0, "left", [
        ("Arbeit", "Deine Arbeitskraft ist keine Ware."),
        ("Boden", "Die Trennlinie im Boden."),
        ("Eigentum", "Nutzen auf Zeit statt Besitz f\u00fcr immer."),
        ("Vertrag", "Das Recht bindet, ohne zu bestimmen."),
        ("Haftung", "Wer verursacht, tr\u00e4gt die Folgen."),
        ("Grenze", "Nicht alles ist k\u00e4uflich."),
        ("Einspruch", "Kein Missstand bleibt verborgen."),
    ]),
    (1, "left", [
        ("Ertrag", "Ohne Ertrag kein Rechtsstaat."),
        ("Durchsetzung", "Geltung braucht Werkzeuge."),
        ("Sicherung", "Die Wirtschaft f\u00fcllt, das Recht verteilt."),
        ("Versorgung", "Geld weist an \u2014 Brot tr\u00e4gt."),
        ("Lieferung", "Das Recht bestellt, die Wirtschaft liefert."),
        ("Freistellung", "Zeit ist die knappste Gabe."),
        ("Enthaltung", "Wer zahlt, bestimmt nicht."),
    ]),
    (3, "left", [
        ("Unterhalt", "Wer lehrt, muss essen."),
        ("Werk- und Wirkungst\u00e4tten",
         "Der Geist braucht Dach und Werkzeug."),
        ("Verl\u00e4sslichkeit",
         "Getragen wird in Jahren, nicht in Stunden."),
        ("Gabe", "Geben, ohne zu bestellen."),
        ("Verzicht", "Wer bestellt, bekommt nur Bestelltes."),
        ("Fr\u00fcchte", "Die Ernte \u00fcbertrifft die Bestellung."),
        ("Br\u00fcderlichkeit", "Wer versteht, braucht keine Rechnung."),
    ]),
]

# ---------------------------------------------------------------- Krankheit (dm-…k)
# Index = gleiche Halbkreis-Position wie Gesund.
LABELS_KRANK = {
    0: ["Recht \u2192", "Wirtschaft:",
        "Die Gewalt", "setzt den", "Preis"],
    1: ["Wirtschaft \u2192", "Recht:",
        "Das Geld", "kauft das", "Recht"],
    2: ["Recht +", "Wirtschaft", "\u2192 Geist:",
        "Macht und", "Geld formen", "den Geist"],
    3: ["Wirtschaft \u2192", "Geist:",
        "Der Profit", "kauft die", "Wahrheit"],
    4: ["Geist \u2192", "Wirtschaft:",
        "Das Dogma", "diktiert die", "Produktion"],
    5: ["Geist +", "Wirtschaft", "\u2192 Recht:",
        "Lehre und", "Kapital schreiben", "das Gesetz"],
    6: ["Recht \u2192 Geist:",
        "Die Macht", "beherrscht", "den Geist"],
    7: ["Geist \u2192 Recht:",
        "Ideologie", "macht sich", "zum Gesetz"],
    8: ["Geist + Recht", "\u2192 Wirtschaft:",
        "Idee und Staat", "befehlen der", "Produktion"],
}
RADIAL_KRANK = {
    7: ["Vorschrift", "Machtgesetz", "Scheinpr\u00fcfung", "Verklausulierung",
        "Abweisung", "Expertokratie", "Desinformation"],      # Geist -> Recht
    4: ["Verf\u00fchrung", "Dogma", "Erz\u00e4hlung", "Entgrenzung",
        "Kennzahl", "Vermarktung", "Verk\u00fcmmerung"],       # Geist -> Wirtschaft
    6: ["Verordnung", "Vorenthaltung", "Vermessung", "Zuteilung",
        "Verriegelung", "Zulassung", "Dienstweg"],            # Recht -> Geist
    0: ["Konzession", "Spekulation", "Papiermacht", "Vorrechte",
        "Zwangsabgabe", "Zollwaffe", "Verschleierung"],       # Recht -> Wirtschaft
    1: ["Erpressung", "L\u00e4hmung", "Schutzabbau", "Bestechung",
        "Privatjustiz", "Dreht\u00fcr", "Lobbykauf"],          # Wirtschaft -> Recht
    3: ["Zulieferung", "Dunkelkammer", "Kalk\u00fcl", "R\u00fcckkauf",
        "Bestellung", "Einz\u00e4unung", "Berechnung"],       # Wirtschaft -> Geist
}
BLOCKS_KRANK = [
    (7, "right", [
        ("Vorschrift", "Jeder soll denken, was ihm vorgedacht wird."),
        ("Machtgesetz", "Gesetze aus Macht \u2014 nicht aus Sachkenntnis."),
        ("Scheinpr\u00fcfung", "Gepr\u00fcft wird nur, was bestehen soll."),
        ("Verklausulierung",
         "Gesetze, die keiner versteht, geh\u00f6ren ihren Auslegern."),
        ("Abweisung", "Der Einwand kostet \u2014 die Korrektur entf\u00e4llt."),
        ("Expertokratie", "Experten entscheiden \u2014 B\u00fcrger schauen zu."),
        ("Desinformation", "Macht, als Wahrheit verkleidet."),
    ]),
    (4, "right", [
        ("Verf\u00fchrung",
         "Das Bed\u00fcrfnis wird gemacht \u2014 von dem, der es f\u00fcllt."),
        ("Dogma", "Das Dogma diktiert \u2014 die Sache schweigt."),
        ("Erz\u00e4hlung", "Kapital ist geronnener Glaube."),
        ("Entgrenzung",
         "Gerechnet wird, als vermehrte sich das Brot."),
        ("Kennzahl",
         "Wer die Zahl sieht, sieht die Sache nicht mehr."),
        ("Vermarktung", "Besetzt wird nach Auftritt, nicht nach K\u00f6nnen."),
        ("Verk\u00fcmmerung",
         "Wer Bed\u00fcrfnisse macht, erkennt keine mehr."),
    ]),
    (6, "right", [
        ("Verordnung", "Der Plan greift dir ins Denken."),
        ("Vorenthaltung", "Wissen ist Entgegenkommen \u2014 kein Anspruch."),
        ("Vermessung", "Gleiche Raster f\u00fcr verschiedene Menschen."),
        ("Zuteilung", "Wer zahlt, bestimmt."),
        ("Verriegelung",
         "Der Einzelne wird gl\u00e4sern \u2014 der Apparat bleibt zu."),
        ("Zulassung", "Die Akte entscheidet \u2014 nicht der Mensch."),
        ("Dienstweg", "Jeder Einwand versandet."),
    ]),
    (0, "left", [
        ("Konzession", "Arbeiten darf, wem es erlaubt wird."),
        ("Spekulation",
         "Wer wohnen muss, zahlt, was der Hortende verlangt."),
        ("Papiermacht", "Papier verf\u00fcgt \u2014 K\u00f6nnen geht leer aus."),
        ("Vorrechte", "Das Recht bestimmt, wer gewinnt."),
        ("Zwangsabgabe",
         "Bezahlt wird, was festgesetzt ist \u2014 nicht, was geschieht."),
        ("Zollwaffe", "Der Handel wird zur Geisel."),
        ("Verschleierung",
         "Vor Gericht steht eine Konstruktion \u2014 kein Mensch."),
    ]),
    (1, "left", [
        ("Erpressung", "Das Fundament droht dem Haus."),
        ("L\u00e4hmung", "Zu gro\u00df, um belangt zu werden."),
        ("Schutzabbau",
         "Der Schutz f\u00e4llt, damit die Rendite steht."),
        ("Bestechung", "Die Lieferung wird zur Anweisung."),
        ("Privatjustiz",
         "Die Wirtschaft liefert das Urteil gleich mit."),
        ("Dreht\u00fcr",
         "Die Zeit ist frei \u2014 das Urteil ist es nicht."),
        ("Lobbykauf", "Wer zahlt, bestimmt doch."),
    ]),
    (3, "left", [
        ("Zulieferung", "Wer lehrt, muss liefern."),
        ("Dunkelkammer", "Das Dach wird zum Deckel."),
        ("Kalk\u00fcl",
         "Gerechnet wird in Quartalen, nicht in Jahren."),
        ("R\u00fcckkauf", "Aus der Gabe wird eine Rechnung."),
        ("Bestellung",
         "Bestellt wird die Frage \u2014 und die Antwort dazu."),
        ("Einz\u00e4unung",
         "Wer den Zaun besitzt, hat den Baum nicht gepflanzt."),
        ("Berechnung",
         "Gerechnet wird mit dem Menschen, nicht f\u00fcr ihn."),
    ]),
]
LABEL_NUDGE_KRANK = {
    6: (28, -88),
    4: (40, 40),
    3: (-40, 40),
}
BLOCK_NUDGE_KRANK = {
    0: (0, -150),
    6: (0, -150),
}

VERTEX_LABELS = ["Recht", "Wirtschaft", "Kultur/Geist"]

# ---------------------------------------------------------------- Geometrie-Helfer
def sub(p, q):  return (p[0] - q[0], p[1] - q[1])
def add(p, q):  return (p[0] + q[0], p[1] + q[1])
def mul(p, s):  return (p[0] * s, p[1] * s)
def norm(p):
    l = math.hypot(*p)
    return (p[0] / l, p[1] / l)
def cross(p, q): return p[0] * q[1] - p[1] * q[0]


def triangle_vertices(apex, side):
    h = side * math.sqrt(3) / 2
    a = apex
    b = (apex[0] - side / 2, apex[1] + h)
    c = (apex[0] + side / 2, apex[1] + h)
    centroid = ((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3)
    return a, b, c, centroid


def build_arcs(a, b, c, centroid):
    """9 Halbkreise: (center, chord, bulge, outward_n, offset)."""
    arcs = []
    for P0, P1 in ((a, b), (b, c), (a, c)):
        u = norm(sub(P1, P0))
        M = add(P0, mul(u, SIDE / 2))
        n = (u[1], -u[0])
        if (sub(M, centroid)[0] * n[0] + sub(M, centroid)[1] * n[1]) < 0:
            n = (-n[0], -n[1])
        arcs.append((add(P0, mul(u, SIDE * CORNER_T)), n, mul(u, -1), n, OFFSET))
        arcs.append((add(P0, mul(u, SIDE * (1.0 - CORNER_T))), n, u, n, OFFSET))
        arcs.append((M, u, n, n, MEDIAN_OFFSET))
    return arcs


def arc_path(center, chord, bulge, offset, n):
    c = add(center, mul(n, offset))
    start = add(c, mul(chord, R))
    end = sub(c, mul(chord, R))
    sweep = 1 if cross(chord, bulge) > 0 else 0
    return (f"M {start[0]:.2f} {start[1]:.2f} "
            f"A {R:.2f} {R:.2f} 0 0 {sweep} {end[0]:.2f} {end[1]:.2f}")


def arc_points(center, chord, bulge, offset, n, steps=48):
    c = add(center, mul(n, offset))
    pts = []
    for i in range(steps + 1):
        t = math.pi * i / steps
        d = add(mul(chord, math.cos(t)), mul(bulge, math.sin(t)))
        pts.append(add(c, mul(d, R)))
    return pts


def text_w(t, size, bold=False):
    return (0.58 if bold else 0.52) * size * len(t)


def label_pos(center, chord, bulge, offset, n, lines, centroid):
    if isinstance(lines, str):
        lines = [lines]
    nlines = len(lines)
    c = add(center, mul(n, offset))

    if ROTATE_LABELS:
        ang = math.degrees(math.atan2(chord[1], chord[0]))
        if ang > 90 or ang <= -90:
            ang += 180
        a = math.radians(ang)
        local_x = (math.cos(a), math.sin(a))
        local_y = (-local_x[1], local_x[0])
        depth = (R - (nlines - 1) * LINE_H) / 2
        step = 1 if (local_y[0] * bulge[0] + local_y[1] * bulge[1]) > 0 else -1
        if step < 0:
            depth += (nlines - 1) * LINE_H
        return add(c, mul(bulge, depth)), ang

    ang = 0.0
    half_h = (nlines - 1) * LINE_H / 2.0 + FONT_SIZE * 0.35
    half_w = max((text_w(t, FONT_SIZE, bold=True) for t in lines), default=20) / 2.0
    limit = R - LABEL_ARC_PAD

    def hits_arc(mid):
        for sx in (-half_w, 0.0, half_w):
            for sy in (-half_h, 0.0, half_h):
                p = (mid[0] + sx, mid[1] + sy)
                v = sub(p, c)
                if v[0] * bulge[0] + v[1] * bulge[1] < -1e-6:
                    continue
                if math.hypot(v[0], v[1]) > limit:
                    return True
        return False

    toward = norm(add(norm(sub(centroid, c)), mul(bulge, -0.35)))
    mid = c
    if hits_arc(mid):
        lo, hi = 0.0, R + half_w + half_h
        for _ in range(24):
            mid_shift = (lo + hi) / 2
            cand = add(c, mul(toward, mid_shift))
            if hits_arc(cand):
                lo = mid_shift
            else:
                hi = mid_shift
        mid = add(c, mul(toward, hi))

    first = (mid[0], mid[1] - (nlines - 1) * LINE_H / 2.0)
    return first, ang


def radial_items(center, chord, bulge, offset, n, words):
    c = add(center, mul(n, offset))
    items = []
    k = len(words)
    seq = list(reversed(words)) if RADIAL_REVERSE else list(words)
    for i, w in enumerate(seq):
        t = math.pi * i / (k - 1)
        d = norm(add(mul(chord, math.cos(t)), mul(bulge, math.sin(t))))
        anchor_pt = add(c, mul(d, R + RAD_GAP))
        ang = math.degrees(math.atan2(d[1], d[0]))
        if -90 < ang <= 90:
            items.append((anchor_pt, ang, "start", w, d))
        else:
            items.append((anchor_pt, ang + 180, "end", w, d))
    return items


def line_w(word, satz):
    return (text_w(word + ": ", BLOCK_FONT)
            + text_w(satz, BLOCK_FONT, bold=True))


def vertex_items(a, b, c, centroid):
    items = []
    for V, txt in zip((a, b, c), VERTEX_LABELS):
        d = norm(sub(V, centroid))
        items.append((add(V, mul(d, V_GAP)), txt))
    return items


def panel_extent(arcs, radial_by_arc, block_items, verts, a, b, c):
    xs, ys = [a[0], b[0], c[0]], [a[1], b[1], c[1]]
    for bx, by, w_, t_ in block_items:
        xs += [bx, bx + line_w(w_, t_)]
        ys += [by - BLOCK_FONT, by + BLOCK_FONT]
    for items in radial_by_arc.values():
        for (px, py), _a, _an, word, d in items:
            wlen = text_w(word, RAD_FONT, bold=True)
            end = add((px, py), mul(d, wlen))
            xs += [px, end[0]]
            ys += [py - RAD_FONT, py + RAD_FONT, end[1] - RAD_FONT, end[1] + RAD_FONT]
    for (px, py), txt in verts:
        hw = 0.30 * V_FONT_SIZE * len(txt)
        xs += [px - hw, px + hw]
        ys += [py - V_FONT_SIZE * 0.7, py + V_FONT_SIZE * 0.7]
    for arc in arcs:
        center, chord, bulge, n, off = arc
        for p in arc_points(center, chord, bulge, off, n):
            xs.append(p[0]); ys.append(p[1])
    return min(xs), max(xs), min(ys), max(ys)


def translate_point(p, dx, dy):
    return (p[0] + dx, p[1] + dy)


def translate_arc(arc, dx, dy):
    center, chord, bulge, n, off = arc
    return (translate_point(center, dx, dy), chord, bulge, n, off)


# ---------------------------------------------------------------- Panel bauen
def build_panel_content(arcs, centroid, labels, radial, blocks,
                        label_nudge=None, block_nudge=None):
    """Labels, Strahlen, Bloecke fuer eine Haelfte.

    labels: Liste (alle 9) oder Dict {idx: lines}.
    """
    label_nudge = label_nudge or {}
    block_nudge = block_nudge or {}

    radial_by_arc = {}
    radial_all = []
    for idx, words in radial.items():
        center, chord, bulge, n, off = arcs[idx]
        items = radial_items(center, chord, bulge, off, n, words)
        radial_by_arc[idx] = items
        radial_all.extend(items)

    def arc_extent(idx):
        center, chord, bulge, n, off = arcs[idx]
        ex, ey = [], []
        for pt in arc_points(center, chord, bulge, off, n):
            ex.append(pt[0]); ey.append(pt[1])
        for (px, py), _a, _an, word, d in radial_by_arc.get(idx, []):
            e = add((px, py), mul(d, text_w(word, RAD_FONT, bold=True)))
            ex += [px, e[0]]; ey += [py - RAD_FONT, py + RAD_FONT,
                                     e[1] - RAD_FONT, e[1] + RAD_FONT]
        return min(ex), max(ex), min(ey), max(ey)

    block_placements = {}
    for idx, side, items in blocks:
        center, chord, bulge, n, off = arcs[idx]
        c = add(center, mul(n, off))
        x0, x1, y0, y1 = arc_extent(idx)
        widths = [line_w(w, t) for w, t in items]
        if side == "right":
            bx = x1 + BLOCK_PAD
            by = c[1] - (len(items) - 1) * BLOCK_LH / 2
        elif side == "left":
            bx = x0 - BLOCK_PAD - max(widths)
            by = c[1] - (len(items) - 1) * BLOCK_LH / 2
        else:
            bx = x0
            by = y1 + BLOCK_PAD
        ndx, ndy = block_nudge.get(idx, (0.0, 0.0))
        block_placements[idx] = (bx + ndx, by + ndy, items)

    block_items = []
    for idx, (bx, by, items) in block_placements.items():
        for i, (w, t) in enumerate(items):
            block_items.append((bx, by + i * BLOCK_LH, w, t))

    if isinstance(labels, dict):
        label_iter = sorted(labels.items())
    else:
        label_iter = list(enumerate(labels))

    label_items = []
    for idx, lines in label_iter:
        if isinstance(lines, str):
            lines = [lines]
        center, chord, bulge, n, off = arcs[idx]
        (px, py), ang = label_pos(center, chord, bulge, off, n, lines, centroid)
        dx, dy = label_nudge.get(idx, (0.0, 0.0))
        label_items.append((px + dx, py + dy, ang, lines))

    return label_items, radial_all, radial_by_arc, block_items


def render_panel(out, gid, a, b, c, arcs, verts,
                 label_items=None, radial_all=None, block_items=None,
                 section_title=None, section_pos=None):
    out.append(f'  <g id="{gid}">')
    if section_title and section_pos:
        sx, sy = section_pos
        out.append(f'    <text x="{sx:.2f}" y="{sy:.2f}" '
                   f'font-family="{FONT}" font-size="{SECTION_FONT}" '
                   f'font-weight="bold" fill="{TXT_COLOR}" text-anchor="middle" '
                   f'dominant-baseline="central" letter-spacing="3">'
                   f'{section_title}</text>')

    out.append(f'    <polygon points="{a[0]:.2f},{a[1]:.2f} {b[0]:.2f},{b[1]:.2f} '
               f'{c[0]:.2f},{c[1]:.2f}" fill="{TRI_FILL}" stroke="{TRI_STROKE}" '
               f'stroke-width="3"/>')

    out.append(f'    <g fill="none" stroke="{ARC_COLOR}" stroke-width="5" '
               f'stroke-linecap="round">')
    for arc in arcs:
        center, chord, bulge, n, off = arc
        out.append(f'      <path d="{arc_path(center, chord, bulge, off, n)}"/>')
    out.append('    </g>')

    if label_items:
        out.append(f'    <g font-family="{FONT}" font-size="{FONT_SIZE}" '
                   f'font-weight="bold" fill="{TXT_COLOR}" text-anchor="middle" '
                   f'dominant-baseline="central">')
        for px, py, ang, lines in label_items:
            spans = "".join(
                f'<tspan x="0" dy="{0 if i == 0 else LINE_H}">{t}</tspan>'
                for i, t in enumerate(lines))
            out.append(f'      <text x="0" y="0" '
                       f'transform="translate({px:.2f},{py:.2f}) '
                       f'rotate({ang:.2f})">{spans}</text>')
        out.append('    </g>')

    if radial_all:
        out.append(f'    <g font-family="{FONT}" font-size="{RAD_FONT}" '
                   f'font-weight="bold" fill="{TXT_COLOR}" '
                   f'dominant-baseline="central">')
        for (px, py), ang, anch, word, _d in radial_all:
            out.append(f'      <text x="0" y="0" text-anchor="{anch}" '
                       f'transform="translate({px:.2f},{py:.2f}) '
                       f'rotate({ang:.2f})">{word}</text>')
        out.append('    </g>')

    if block_items:
        out.append(f'    <g font-family="{FONT}" font-size="{BLOCK_FONT}" '
                   f'fill="{TXT_COLOR}" dominant-baseline="central">')
        for bx, by, w_, t_ in block_items:
            out.append(f'      <text x="{bx:.2f}" y="{by:.2f}">{w_}: '
                       f'<tspan font-weight="bold">{t_}</tspan></text>')
        out.append('    </g>')

    out.append(f'    <g font-family="{FONT}" font-size="{V_FONT_SIZE}" '
               f'fill="{TXT_COLOR}" text-anchor="middle" '
               f'dominant-baseline="central" letter-spacing="2">')
    for (px, py), txt in verts:
        out.append(f'      <text x="{px:.2f}" y="{py:.2f}">{txt}</text>')
    out.append('    </g>')
    out.append('  </g>')


# ---------------------------------------------------------------- Layout: zwei Haelften auf A2
# Lokales Dreieck mit Spitze bei (0, 0) — wird spaeter verschoben.
LOCAL_APEX = (0.0, 0.0)
la, lb, lc, lcentroid = triangle_vertices(LOCAL_APEX, SIDE)
local_arcs = build_arcs(la, lb, lc, lcentroid)
local_verts = vertex_items(la, lb, lc, lcentroid)

# Gesundheits-Inhalt in lokalen Koordinaten
ges_labels, ges_radial, ges_radial_by_arc, ges_blocks = build_panel_content(
    local_arcs, lcentroid, LABELS, RADIAL, BLOCKS, LABEL_NUDGE, BLOCK_NUDGE)

# Krankheits-Inhalt (dm-01k … dm-09k)
kra_labels, kra_radial, kra_radial_by_arc, kra_blocks = build_panel_content(
    local_arcs, lcentroid, LABELS_KRANK, RADIAL_KRANK, BLOCKS_KRANK,
    LABEL_NUDGE_KRANK, BLOCK_NUDGE_KRANK)

# Ausdehnung der Haelften
gx0, gx1, gy0, gy1 = panel_extent(
    local_arcs, ges_radial_by_arc, ges_blocks, local_verts, la, lb, lc)
kx0, kx1, ky0, ky1 = panel_extent(
    local_arcs, kra_radial_by_arc, kra_blocks, local_verts, la, lb, lc)

# Beides in die jeweilige A2-Haelfte einpassen (Breite + Hoehe)
# Hauptueberschrift oben: Schriftgroesse so, dass Text ≈ 90% der Seitenbreite.
MAIN_TITLE_FONT = (MAIN_TITLE_WIDTH_FRAC * PAGE_W) / (0.52 * len(MAIN_TITLE))
MAIN_TITLE_BAND = MAIN_TITLE_FONT * 1.35 + PAGE_MARGIN * 0.5

half_h = (PAGE_H - PAGE_MARGIN - MAIN_TITLE_BAND - HALF_GAP - PAGE_MARGIN) / 2
usable_w = PAGE_W - 2 * PAGE_MARGIN

# Breite beider Panele (Gesundheit ist breiter wegen Textbloecken)
content_w = max(gx1 - gx0, kx1 - kx0)
content_h_ges = gy1 - gy0
content_h_kra = ky1 - ky0
# Gemeinsamer Massstab: beide Haelften gleich skalieren
scale = min(usable_w / content_w,
            half_h / content_h_ges,
            half_h / content_h_kra)

def place_panel(x0, x1, y0, y1, half_top):
    """dx, dy so, dass lokales Panel zentriert in der Haelfte landet."""
    cx = PAGE_MARGIN + usable_w / 2
    cy = half_top + half_h / 2
    mid_x = (x0 + x1) / 2
    mid_y = (y0 + y1) / 2
    dx = cx - mid_x * scale
    dy = cy - mid_y * scale
    return dx, dy

# Obere Haelfte = Krankheit (unter der Hauptueberschrift), untere = Gesundheit
kra_top = MAIN_TITLE_BAND
ges_top = MAIN_TITLE_BAND + half_h + HALF_GAP

kra_dx, kra_dy = place_panel(kx0, kx1, ky0, ky1, kra_top)
ges_dx, ges_dy = place_panel(gx0, gx1, gy0, gy1, ges_top)


def xform_pt(p, dx, dy):
    return (p[0] * scale + dx, p[1] * scale + dy)


def xform_arcs(arcs, dx, dy):
    out = []
    for center, chord, bulge, n, off in arcs:
        out.append((xform_pt(center, dx, dy), chord, bulge, n, off * scale))
    return out


def xform_verts(verts, dx, dy):
    return [(xform_pt(p, dx, dy), t) for p, t in verts]


# Radius und Abstaende skalieren mit — R wird in arc_path global genutzt.
# Deshalb temporaer R/Offsets skalieren, indem wir R anpassen und
# die Offsets schon in xform_arcs skaliert haben.
R_ORIG = R
R = R * scale
FONT_SIZE_S = FONT_SIZE * scale
LINE_H_S = LINE_H * scale
BLOCK_FONT_S = BLOCK_FONT * scale
BLOCK_LH_S = BLOCK_LH * scale
RAD_FONT_S = RAD_FONT * scale
RAD_GAP_S = RAD_GAP * scale
V_FONT_SIZE_S = V_FONT_SIZE * scale
SECTION_FONT_S = SECTION_FONT * scale

# Font-Globals fuer Rendering anpassen
FONT_SIZE = FONT_SIZE_S
LINE_H = LINE_H_S
BLOCK_FONT = BLOCK_FONT_S
BLOCK_LH = BLOCK_LH_S
RAD_FONT = RAD_FONT_S
RAD_GAP = RAD_GAP_S
V_FONT_SIZE = V_FONT_SIZE_S
SECTION_FONT = SECTION_FONT_S
V_GAP_S = V_GAP * scale

# Vertices mit skaliertem V_GAP neu setzen
def scaled_verts(a, b, c, centroid, dx, dy):
    items = []
    for V, txt in zip((a, b, c), VERTEX_LABELS):
        d = norm(sub(V, centroid))
        local = add(V, mul(d, V_GAP))  # V_GAP schon unskaliert in local space
        items.append((xform_pt(local, dx, dy), txt))
    return items


# Krankheit
kra_a = xform_pt(la, kra_dx, kra_dy)
kra_b = xform_pt(lb, kra_dx, kra_dy)
kra_c = xform_pt(lc, kra_dx, kra_dy)
kra_arcs = xform_arcs(local_arcs, kra_dx, kra_dy)
kra_verts = scaled_verts(la, lb, lc, lcentroid, kra_dx, kra_dy)
kra_title_y = kra_top + SECTION_FONT * 0.6

kra_labels_t = [
    (px * scale + kra_dx, py * scale + kra_dy, ang, lines)
    for px, py, ang, lines in kra_labels
]
kra_radial_t = [
    (xform_pt((px, py), kra_dx, kra_dy), ang, anch, word, d)
    for (px, py), ang, anch, word, d in kra_radial
]
kra_blocks_t = [
    (bx * scale + kra_dx, by * scale + kra_dy, w, t)
    for bx, by, w, t in kra_blocks
]

# Gesundheit (mit Inhalt)
ges_a = xform_pt(la, ges_dx, ges_dy)
ges_b = xform_pt(lb, ges_dx, ges_dy)
ges_c = xform_pt(lc, ges_dx, ges_dy)
ges_arcs = xform_arcs(local_arcs, ges_dx, ges_dy)
ges_verts = scaled_verts(la, lb, lc, lcentroid, ges_dx, ges_dy)

ges_labels_t = [
    (px * scale + ges_dx, py * scale + ges_dy, ang, lines)
    for px, py, ang, lines in ges_labels
]
ges_radial_t = [
    (xform_pt((px, py), ges_dx, ges_dy), ang, anch, word, d)
    for (px, py), ang, anch, word, d in ges_radial
]
ges_blocks_t = [
    (bx * scale + ges_dx, by * scale + ges_dy, w, t)
    for bx, by, w, t in ges_blocks
]
ges_title_y = ges_top + SECTION_FONT * 0.6

# ---------------------------------------------------------------- SVG schreiben
out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
           f'viewBox="0 0 {PAGE_W:.2f} {PAGE_H:.2f}" '
           f'width="{PAGE_W:.0f}" height="{PAGE_H:.0f}">')
out.append(f'  <rect x="0" y="0" width="{PAGE_W:.2f}" height="{PAGE_H:.2f}" '
           f'fill="{BG}"/>')

# Hauptueberschrift ueber dem oberen Dreieck (~90% der Seitenbreite)
main_title_y = PAGE_MARGIN + MAIN_TITLE_FONT * 0.55
out.append(f'  <text x="{PAGE_W / 2:.2f}" y="{main_title_y:.2f}" '
           f'font-family="{FONT}" font-size="{MAIN_TITLE_FONT:.2f}" '
           f'font-weight="bold" fill="{TXT_COLOR}" text-anchor="middle" '
           f'dominant-baseline="central" letter-spacing="2">'
           f'{MAIN_TITLE}</text>')

# Krankheit oben
render_panel(
    out, "krankheit", kra_a, kra_b, kra_c, kra_arcs, kra_verts,
    label_items=kra_labels_t, radial_all=kra_radial_t, block_items=kra_blocks_t,
    section_title="Krankheit",
    section_pos=(PAGE_W / 2, kra_title_y),
)

# Gesundheit unten — mit Inhalt
render_panel(
    out, "gesundheit", ges_a, ges_b, ges_c, ges_arcs, ges_verts,
    label_items=ges_labels_t, radial_all=ges_radial_t, block_items=ges_blocks_t,
    section_title="Gesundheit",
    section_pos=(PAGE_W / 2, ges_title_y),
)

out.append('</svg>')

svg = "\n".join(out)
_out_path = __file__.replace("doppelmatrix-halbkreise.py", "doppelmatrix-halbkreise.svg")
with open(_out_path, "w") as f:
    f.write(svg)
print(f"DIN A2 Portrait  {PAGE_W:.0f}\u00d7{PAGE_H:.0f}  (1 unit = 0.1 mm)")
print(f"scale={scale:.4f}  OFFSET={OFFSET}  MEDIAN_OFFSET={MEDIAN_OFFSET}")
print(f"wrote {_out_path}")
