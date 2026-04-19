#!/usr/bin/env node
// generate_book_covers2.mjs
// Generates SVG book covers for all primary + secondary books of philo-von-freisinn.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'covers');
mkdirSync(OUT, { recursive: true });

const DARK  = '#2d2d2d';
const CREAM = '#f7f3ed';
const WHITE = '#ffffff';
const GRAY  = '#6b6b6b';
const LG    = '#c4b8a8';
const SW    = 0.55; // default diagram stroke-width

const CX = 200, CY = 90.72; // header center

// ---- Utilities ----
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function wrap(text, max = 40) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (t.length <= max) line = t;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
const r2d = d => d * Math.PI / 180;
const pt  = (cx, cy, r, deg) => [
  +(cx + r * Math.cos(r2d(deg))).toFixed(2),
  +(cy + r * Math.sin(r2d(deg))).toFixed(2),
];

// ---- SVG Primitives (all white, for dark header) ----
const circ = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${WHITE}" stroke-width="${SW}"/>`;
const ln = (x1, y1, x2, y2, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${WHITE}" stroke-width="${SW}" ${extra}/>`;
const dot  = (cx, cy, r = 2.2) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${WHITE}"/>`;
const pathd = (d, extra = '') =>
  `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${SW}" ${extra}/>`;

// ========================= DIAGRAMS =========================

// 1. Philosophie der Freiheit – concentric circles + 8 radial lines
function d_concentric_cross(cx, cy) {
  const parts = [circ(cx, cy, 25), circ(cx, cy, 50), circ(cx, cy, 75)];
  for (let i = 0; i < 8; i++) {
    const [x2, y2] = pt(cx, cy, 78, -90 + 45 * i);
    parts.push(ln(cx, cy, x2, y2));
  }
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 2. Rätsel der Philosophie – 6 satellite circles on a ring (riddles / questions)
function d_six_rings(cx, cy) {
  const parts = [circ(cx, cy, 55)];
  for (let i = 0; i < 6; i++) {
    const [x, y] = pt(cx, cy, 55, -90 + 60 * i);
    parts.push(circ(x, y, 21));
    parts.push(dot(x, y));
  }
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 3. Wahrheit und Wissenschaft – Vesica Piscis (truth ∩ science)
function d_vesica(cx, cy) {
  return [circ(cx - 30, cy, 52), circ(cx + 30, cy, 52), dot(cx, cy, 3.5)].join('\n  ');
}

// 4. Grundlinien Erkenntnistheorie – radial grid (knowledge radiating from center)
function d_radial_knowledge(cx, cy) {
  const parts = [];
  for (const r of [24, 48, 72]) parts.push(circ(cx, cy, r));
  for (let i = 0; i < 12; i++) {
    const a = -90 + 30 * i;
    const [x2, y2] = pt(cx, cy, 72, a);
    parts.push(ln(cx, cy, x2, y2));
    for (const r of [24, 48, 72]) {
      const [dx, dy] = pt(cx, cy, r, a);
      parts.push(dot(dx, dy, 1.8));
    }
  }
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 5. Goethes Weltanschauung – logarithmic spiral (Urpflanze / metamorphosis)
function d_spiral(cx, cy) {
  let d = `M ${cx} ${cy}`;
  for (let i = 1; i <= 180; i++) {
    const [x, y] = pt(cx, cy, (i / 180) * 72, (i / 180) * 720 - 90);
    d += ` L ${x} ${y}`;
  }
  return pathd(d) + '\n  ' + dot(cx, cy, 3.5);
}

// 6. Kernpunkte der sozialen Frage – 3 interlocking circles (threefold organism)
function d_three_circles(cx, cy) {
  const r = 42;
  const cr = (r * 1.15) / Math.sqrt(3);
  const parts = [0, 120, 240].map(a => circ(...pt(cx, cy, cr, a - 90), r));
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 7. Dreigliederung – equilateral triangle with medians
function d_triangle_medians(cx, cy) {
  const verts = [0, 120, 240].map(a => pt(cx, cy, 75, a - 90));
  const mids  = verts.map((_, i) => [
    ((verts[(i + 1) % 3][0] + verts[(i + 2) % 3][0]) / 2).toFixed(2),
    ((verts[(i + 1) % 3][1] + verts[(i + 2) % 3][1]) / 2).toFixed(2),
  ]);
  return [
    pathd(`M ${verts.map(p => p.join(' ')).join(' L ')} Z`),
    ...verts.map((v, i) => ln(...v, ...mids[i])),
    ...verts.map(v => dot(...v)),
    dot(cx, cy, 3.5),
  ].join('\n  ');
}

// 8. Methodische Grundlagen – ascending staircase (methodical ascent)
function d_steps(cx, cy) {
  const sw = 25, sh = 15, n = 5;
  const sx = cx - (n * sw) / 2;
  const sy = cy + (n * sh) / 2;
  let d = `M ${sx} ${sy}`;
  let x = sx, y = sy;
  for (let i = 0; i < n; i++) {
    d += ` L ${x + sw} ${y} L ${x + sw} ${y - sh}`;
    x += sw; y -= sh;
  }
  const parts = [
    pathd(d),
    ln(sx, sy, sx, sy - n * sh),
    ln(sx, sy - n * sh, x, sy - n * sh),
  ];
  for (let i = 0; i <= n; i++) parts.push(dot(sx + i * sw, sy - i * sh));
  return parts.join('\n  ');
}

// 9. Gesammelte Aufsätze Zeitgeschichte – historical wheel (12 spokes, 3 rings)
function d_wheel(cx, cy) {
  const parts = [circ(cx, cy, 75), circ(cx, cy, 45), circ(cx, cy, 15)];
  for (let i = 0; i < 12; i++) {
    const a = -90 + 30 * i;
    const [x1, y1] = pt(cx, cy, 15, a);
    const [x2, y2] = pt(cx, cy, 75, a);
    parts.push(ln(x1, y1, x2, y2));
    parts.push(dot(x2, y2, 1.8));
  }
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 10. Einleitungen Goethes Naturwissenschaft – organic sine wave
function d_sine(cx, cy) {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const x = +(cx - 70 + (140 * i) / 120).toFixed(2);
    const y = +(cy + 44 * Math.sin((i / 120) * 2.5 * 2 * Math.PI)).toFixed(2);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return pathd(d) + '\n  ' + dot(cx, cy, 3.5);
}

// 11. Lucifer-Gnosis – Star of Solomon (two interlaced triangles)
function d_star_of_solomon(cx, cy) {
  const tri1 = [0, 120, 240].map(a => pt(cx, cy, 72, a - 90));
  const tri2 = [60, 180, 300].map(a => pt(cx, cy, 72, a - 90));
  return [
    pathd(`M ${tri1.map(p => p.join(' ')).join(' L ')} Z`),
    pathd(`M ${tri2.map(p => p.join(' ')).join(' L ')} Z`),
    dot(cx, cy, 3.5),
  ].join('\n  ');
}

// 12. A brief history of Hackerdom – fully connected network graph (7 nodes)
function d_network(cx, cy, n = 7, r = 60) {
  const nodes = Array.from({ length: n }, (_, i) => pt(cx, cy, r, -90 + (360 / n) * i));
  const parts = [];
  nodes.forEach(nd => parts.push(ln(cx, cy, ...nd)));
  for (let i = 0; i < n; i++) parts.push(ln(...nodes[i], ...nodes[(i + 1) % n]));
  for (let i = 0; i < n; i++) parts.push(ln(...nodes[i], ...nodes[(i + 2) % n]));
  nodes.forEach(nd => parts.push(dot(...nd)));
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 13. How to become a hacker – key shape
function d_key(cx, cy) {
  return [
    circ(cx - 40, cy, 28),
    circ(cx - 40, cy, 14),
    dot(cx - 40, cy, 3.5),
    ln(cx - 12, cy, cx + 56, cy),
    ln(cx + 14, cy, cx + 14, cy + 18),
    ln(cx + 30, cy, cx + 30, cy + 14),
    ln(cx + 46, cy, cx + 46, cy + 18),
  ].join('\n  ');
}

// 14. Cathedral and the Bazaar – gothic arch (left) | open grid (right)
function d_arch_grid(cx, cy) {
  const parts = [];
  // Cathedral arch
  const ax = cx - 38, aw = 52, ah = 80;
  parts.push(ln(ax - aw / 2, cy + 40, ax - aw / 2, cy - ah / 3));
  parts.push(ln(ax + aw / 2, cy + 40, ax + aw / 2, cy - ah / 3));
  parts.push(pathd(`M ${ax - aw / 2} ${(cy - ah / 3).toFixed(2)} Q ${ax} ${cy - ah} ${ax + aw / 2} ${(cy - ah / 3).toFixed(2)}`));
  parts.push(ln(ax - aw / 2 - 6, cy + 40, ax + aw / 2 + 6, cy + 40));
  // Dashed divider
  parts.push(ln(cx + 2, cy - 80, cx + 2, cy + 48, 'stroke-dasharray="3,3"'));
  // Bazaar grid
  const gx = cx + 22, gs = 18, nc = 3, nr = 4;
  const gy = cy - (nr / 2) * gs;
  for (let row = 0; row <= nr; row++) parts.push(ln(gx, gy + row * gs, gx + nc * gs, gy + row * gs));
  for (let col = 0; col <= nc; col++) parts.push(ln(gx + col * gs, gy, gx + col * gs, gy + nr * gs));
  return parts.join('\n  ');
}

// 15. Rebel Code – 5-node rebel network (irregular hub)
function d_rebel_network(cx, cy) {
  return d_network(cx, cy, 5, 62);
}

// 16. Code Version 2.0 – regular mesh grid
function d_grid(cx, cy) {
  const parts = [];
  const sp = 22, cols = 5, rows = 5;
  const sx = cx - ((cols - 1) * sp) / 2;
  const sy = cy - ((rows - 1) * sp) / 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = sx + col * sp, y = sy + row * sp;
      if (col < cols - 1) parts.push(ln(x, y, x + sp, y));
      if (row < rows - 1) parts.push(ln(x, y, x, y + sp));
      parts.push(dot(x, y, 1.8));
    }
  }
  return parts.join('\n  ');
}

// 17. Free Software Free Society – three open C-arcs (openness / freedom)
function d_open_arcs(cx, cy) {
  const parts = [];
  for (const r of [25, 45, 65]) {
    const [x1, y1] = pt(cx, cy, r, 50);
    const [x2, y2] = pt(cx, cy, r, -50);
    // large-arc counterclockwise → 270° arc leaving a gap on the right
    parts.push(pathd(`M ${x1} ${y1} A ${r} ${r} 0 1 0 ${x2} ${y2}`));
  }
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 18. Cypherpunks – cipher wheel (2 concentric toothed rings)
function d_cipher(cx, cy) {
  const parts = [circ(cx, cy, 75), circ(cx, cy, 55), circ(cx, cy, 30)];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 360 - 90;
    parts.push(ln(...pt(cx, cy, 68, a), ...pt(cx, cy, 75, a)));
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 360 - 83; // rotated inner wheel
    parts.push(ln(...pt(cx, cy, 48, a), ...pt(cx, cy, 55, a)));
  }
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// 19. Julian Assange in his own words – stacked text lines (speech / testimony)
function d_text_lines(cx, cy) {
  const widths = [100, 140, 120, 90, 130, 80, 110];
  const y0 = cy - 58;
  return widths.map((w, i) => ln(cx - w / 2, y0 + i * 18, cx + w / 2, y0 + i * 18)).join('\n  ');
}

// 20. Various Interviews and Articles – three overlapping document pages
function d_pages(cx, cy) {
  const offsets = [[-22, 14], [0, -4], [22, -20]];
  return offsets.map(([dx, dy]) => {
    const px = cx + dx - 35, py = cy + dy - 48;
    return pathd(`M ${px} ${py} L ${px + 70} ${py} L ${px + 70} ${py + 96} L ${px} ${py + 96} Z`);
  }).join('\n  ');
}

// 21. Wahrheit als Gesamtumfang aller Weltansichten – dodecagon (12 worldviews)
function d_dodecagon(cx, cy) {
  const pts = Array.from({ length: 12 }, (_, i) => pt(cx, cy, 72, -90 + 30 * i));
  const parts = [pathd('M ' + pts.map(p => p.join(' ')).join(' L ') + ' Z')];
  pts.forEach(p => parts.push(ln(cx, cy, ...p)));
  parts.push(dot(cx, cy, 3.5));
  return parts.join('\n  ');
}

// ========================= COVER BUILDER =========================
function makeSVG({ titleLines, subtitle, author, diagram }) {
  const firstY = 227, lh = 26;
  const titleEndY = firstY + (titleLines.length - 1) * lh;

  const titleSvg =
    `<text text-anchor="middle" fill="${DARK}" font-family="Georgia, 'Times New Roman', serif" font-size="21" font-weight="500">` +
    titleLines.map((l, i) =>
      i === 0
        ? `<tspan x="200" y="${firstY}">${esc(l)}</tspan>`
        : `<tspan x="200" dy="${lh}">${esc(l)}</tspan>`
    ).join('') +
    `</text>`;

  const sepY = titleEndY + 38;
  let subtitleSvg = '';
  let diamondY;

  if (subtitle) {
    const lines = wrap(subtitle);
    const subFirstY = sepY + 16;
    const subLastY  = subFirstY + (lines.length - 1) * 14;
    diamondY = subLastY + 36;

    subtitleSvg =
      `<line x1="70" y1="${sepY}" x2="330" y2="${sepY}" stroke="${GRAY}" stroke-width="0.6" />\n  ` +
      `<text text-anchor="middle" fill="${GRAY}" font-family="Georgia, 'Times New Roman', serif" font-size="11.5">` +
      lines.map((l, i) =>
        i === 0
          ? `<tspan x="200" y="${subFirstY}">${esc(l)}</tspan>`
          : `<tspan x="200" dy="14">${esc(l)}</tspan>`
      ).join('') +
      `</text>`;
  } else {
    diamondY = titleEndY + 80;
  }

  const dy = diamondY;
  const diamondSvg =
    `<path d="M 200 ${dy} l 7 7 l -7 7 l -7 -7 Z" fill="none" stroke="${DARK}" stroke-width="1.1" />\n  ` +
    `<path d="M 200 ${dy + 3} l 4 4 l -4 4 l -4 -4 Z" fill="${DARK}" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="630" viewBox="0 0 400 630">
  <rect width="400" height="189" fill="${DARK}" />
  <rect y="189" width="400" height="378" fill="${CREAM}" />
  <rect y="567" width="400" height="63" fill="${DARK}" />
  <line x1="0" y1="189" x2="400" y2="189" stroke="${LG}" stroke-width="1" />
  <line x1="0" y1="191" x2="400" y2="191" stroke="${LG}" stroke-width="0.5" opacity="0.85" />

  ${diagram}

  ${titleSvg}
  ${subtitleSvg}
  ${diamondSvg}

  <text x="200" y="603.5" text-anchor="middle" fill="${WHITE}" font-family="Georgia, 'Times New Roman', serif" font-size="11.5" letter-spacing="0.12em">${esc(author.toUpperCase())}</text>
</svg>`;
}

// ========================= BOOK DATA =========================
const books = [
  // ---- Primary books ----
  {
    id: '4b8e4c2a-3f1b-4d2e-9c4a-8e4f4b2c3a1d',
    titleLines: ['Die Philosophie', 'der Freiheit'],
    subtitle: 'Grundzüge einer modernen Weltanschauung',
    author: 'Rudolf Steiner',
    diagram: d_concentric_cross(CX, CY),
  },
  {
    id: 'd64fa532-6040-4fc2-9c43-ed4e5368bb92',
    titleLines: ['Die Rätsel', 'der Philosophie'],
    subtitle: 'in ihrer Geschichte als Umriss dargestellt',
    author: 'Rudolf Steiner',
    diagram: d_six_rings(CX, CY),
  },
  {
    id: 'e58f6369-f7a7-4213-845f-c5b9bf82ffe5',
    titleLines: ['Wahrheit und', 'Wissenschaft'],
    subtitle: 'Vorspiel zu einer «Philosophie der Freiheit»',
    author: 'Rudolf Steiner',
    diagram: d_vesica(CX, CY),
  },
  {
    id: '44217040-65bf-4150-9fa8-bac9c57cd1b1',
    titleLines: ['Grundlinien einer', 'Erkenntnistheorie der', 'Goetheschen', 'Weltanschauung'],
    subtitle: 'mit besonderer Rücksicht auf Schiller',
    author: 'Rudolf Steiner',
    diagram: d_radial_knowledge(CX, CY),
  },
  {
    id: '64e881df-0501-4815-9b0c-6cf545c383b6',
    titleLines: ['Goethes', 'Weltanschauung'],
    subtitle: null,
    author: 'Rudolf Steiner',
    diagram: d_spiral(CX, CY),
  },
  {
    id: 'f8e6c475-a0e5-4081-b265-61a7536a183e',
    titleLines: ['Die Kernpunkte', 'der sozialen Frage'],
    subtitle: 'in den Lebensnotwendigkeiten der Gegenwart und Zukunft',
    author: 'Rudolf Steiner',
    diagram: d_three_circles(CX, CY),
  },
  {
    id: '3b38df84-e9bc-4e70-9032-d3fa65517cfd',
    titleLines: ['Aufsätze über die', 'Dreigliederung des', 'sozialen Organismus'],
    subtitle: null,
    author: 'Rudolf Steiner',
    diagram: d_triangle_medians(CX, CY),
  },
  // ---- Secondary books ----
  {
    id: 'c2a4e407-cdf7-4802-be84-010cc485ef00',
    titleLines: ['Methodische Grundlagen', 'der Anthroposophie'],
    subtitle: 'Gesammelte Aufsätze zur Philosophie, Naturwissenschaft, Ästhetik',
    author: 'Rudolf Steiner',
    diagram: d_steps(CX, CY),
  },
  {
    id: 'f287d43a-5108-4e0c-baa8-5e7d3badfef7',
    titleLines: ['Gesammelte Aufsätze', 'zur Kultur- und', 'Zeitgeschichte'],
    subtitle: null,
    author: 'Rudolf Steiner',
    diagram: d_wheel(CX, CY),
  },
  {
    id: '47b137d3-f414-406f-b142-ed72c7e8989c',
    titleLines: ['Einleitungen zu Goethes', 'Naturwissenschaftlichen', 'Schriften'],
    subtitle: null,
    author: 'Rudolf Steiner',
    diagram: d_sine(CX, CY),
  },
  {
    id: 'f78a79d5-8e8f-435e-bb58-ef6577312f57',
    titleLines: ['Lucifer-Gnosis'],
    subtitle: 'Grundlegende Aufsätze zur Anthroposophie',
    author: 'Rudolf Steiner',
    diagram: d_star_of_solomon(CX, CY),
  },
  {
    id: '7da60fa4-9281-4643-80e8-612f511e755d',
    titleLines: ['A Brief History', 'of Hackerdom'],
    subtitle: null,
    author: 'Eric S Raymond',
    diagram: d_network(CX, CY, 7, 60),
  },
  {
    id: '837193ab-505b-43b6-9ab7-bec8c3ed95dc',
    titleLines: ['How to Become', 'a Hacker'],
    subtitle: null,
    author: 'Eric S Raymond',
    diagram: d_key(CX, CY),
  },
  {
    id: 'a1fa8d65-911c-4adc-b11f-2c8a4e3866c7',
    titleLines: ['The Cathedral', 'and the Bazaar'],
    subtitle: null,
    author: 'Eric S Raymond',
    diagram: d_arch_grid(CX, CY),
  },
  {
    id: '123ef8cb-a442-4bbc-9570-e8681dd67f9f',
    titleLines: ['Rebel Code'],
    subtitle: null,
    author: 'Glyn Moody',
    diagram: d_rebel_network(CX, CY),
  },
  {
    id: '0c20163d-b14e-4750-988b-3b58c0fa3126',
    titleLines: ['Code', 'Version 2.0'],
    subtitle: null,
    author: 'Lawrence Lessig',
    diagram: d_grid(CX, CY),
  },
  {
    id: '4c09f3d5-3f5c-42b7-beba-f12fc46594bc',
    titleLines: ['Free Software,', 'Free Society'],
    subtitle: null,
    author: 'Richard M Stallman',
    diagram: d_open_arcs(CX, CY),
  },
  {
    id: 'f3b36ec2-031d-4715-ad66-dfc7f43cc491',
    titleLines: ['Cypherpunks'],
    subtitle: null,
    author: 'Julian Assange',
    diagram: d_cipher(CX, CY),
  },
  {
    id: '36371313-0400-4c90-9656-67d54052cf89',
    titleLines: ['Julian Assange', 'in his own Words'],
    subtitle: null,
    author: 'Julian Assange',
    diagram: d_text_lines(CX, CY),
  },
  {
    id: '7758c53c-72bd-41f1-ae51-843eb2a0f718',
    titleLines: ['Various Interviews', 'and Articles'],
    subtitle: null,
    author: 'Julian Assange',
    diagram: d_pages(CX, CY),
  },
  {
    id: '908fc041-096e-4440-8593-b3267b712bf5',
    titleLines: ['Die Wahrheit als', 'Gesamtumfang aller', 'Weltansichten'],
    subtitle: null,
    author: 'Sigismund von Gleich',
    diagram: d_dodecagon(CX, CY),
  },
];

// ========================= WRITE FILES =========================
for (const book of books) {
  const svg = makeSVG(book);
  writeFileSync(join(OUT, `${book.id}.svg`), svg, 'utf8');
  console.log(`✓  ${book.id}.svg  —  ${book.titleLines.join(' / ')}`);
}
console.log(`\nFertig! ${books.length} Cover in ${OUT}`);
