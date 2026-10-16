// Disegni della carta nautica (#360): minimappa e mappa grande rifatte sulla reference «C · Wind Waker» scelta da Jack il 16 ott 2026
// (assets/concept/minimappa/mm_3_wind_waker.png). Colori presi dalla reference; icone delle mete per categoria come nella sua legenda
// (Tu, Porto, Negozio, Minigioco, Missione, più Casa), pergamene col bordo frastagliato, rosa dei venti, icone dei 3 scatti di ZOOM.

/** Colori della reference (misurati sui pixel). */
export const COL = {
  mare: '#1068a0', mareMini: '#137bb9', bassa: '#1aa6d2', griglia: 'rgba(120,190,240,.34)', onda: 'rgba(214,236,252,.8)', rotta: 'rgba(238,246,255,.85)',
  perg: '#f0d098', pergScura: '#d6ac66', inchiostro: '#0d1a36', notte: '#0a1430', giallo: '#f8d04c', gialloChiaro: '#ffe25a',
  badge: '#16244a', crema: '#f4e6c4', rosso: '#d8323a', bottone: '#202848', bordoBottone: '#b8a47e', scelto: '#f8e010',
  sabbiaIcona: '#e8cf8a', verde: '#6cb04a',
} as const;

export type Cat = 'porto' | 'negozio' | 'gioco' | 'missione' | 'casa' | 'luogo';

const CAT_DI: Record<string, Cat> = {
  porto: 'porto', mercante: 'negozio', contrabbando: 'negozio', casa: 'casa',
  bacheca: 'missione', ingresso: 'missione', parla: 'missione',
  faro: 'luogo', record: 'luogo', libro: 'luogo', lanterna: 'luogo',
};
/** Categoria di una meta dalla sua icona (tutto il resto è un minigioco: Regata, Pesca, Consegne, Templari, Funivia…). */
export function categoria(id: string, icon: string | undefined): Cat {
  if (id === 'relitto_templare') return 'missione';
  return CAT_DI[icon ?? ''] ?? 'gioco';
}

/** Righe della legenda, due colonne come nella reference. */
export const LEGENDA: readonly { cat: Cat | 'tu'; nome: string }[] = [
  { cat: 'tu', nome: 'Tu' }, { cat: 'porto', nome: 'Porto' },
  { cat: 'negozio', nome: 'Negozio' }, { cat: 'casa', nome: 'Casa' },
  { cat: 'gioco', nome: 'Minigioco' }, { cat: 'missione', nome: 'Missione' },
];

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const rr = (g: G, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};
const disco = (g: G, x: number, y: number, r: number, col: string) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill(); };

/** Tessera blu col bordo crema e il filo scuro fuori (ancora, joypad, casa). */
function tessera(g: G, cx: number, cy: number, s: number): void {
  const h = s / 2;
  rr(g, cx - h, cy - h, s, s, s * 0.24); g.fillStyle = COL.notte; g.fill();
  const b = s * 0.08; rr(g, cx - h + b, cy - h + b, s - 2 * b, s - 2 * b, s * 0.19); g.fillStyle = COL.crema; g.fill();
  const c = s * 0.16; rr(g, cx - h + c, cy - h + c, s - 2 * c, s - 2 * c, s * 0.13); g.fillStyle = COL.badge; g.fill();
}

function ancora(g: G, cx: number, cy: number, s: number): void {
  const u = s * 0.3, lw = Math.max(1, s * 0.075);
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy - u * 0.82, u * 0.19, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - u * 0.62); g.lineTo(cx, cy + u * 0.86); g.stroke();
  g.beginPath(); g.moveTo(cx - u * 0.42, cy - u * 0.36); g.lineTo(cx + u * 0.42, cy - u * 0.36); g.stroke();
  const r = u * 0.74, my = cy + u * 0.12;
  g.beginPath(); g.arc(cx, my, r, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  for (const sx of [-1, 1]) { // le due punte delle marre
    const ax = cx + sx * r * Math.cos(Math.PI * 0.12), ay = my + r * Math.sin(Math.PI * 0.12);
    g.beginPath(); g.moveTo(ax + sx * u * 0.16, ay + u * 0.06); g.lineTo(ax - sx * u * 0.02, ay - u * 0.3); g.lineTo(ax - sx * u * 0.22, ay + u * 0.02); g.closePath(); g.fill();
  }
}

function joypad(g: G, cx: number, cy: number, s: number): void {
  const w = s * 0.62, h = s * 0.32;
  g.fillStyle = '#ffffff';
  rr(g, cx - w / 2, cy - h / 2 - s * 0.03, w, h, h * 0.45); g.fill();
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * w * 0.33, cy + h * 0.32, w * 0.15, h * 0.48, -sx * 0.35, 0, TAU); g.fill(); }
  g.fillStyle = COL.badge; const d = s * 0.055, px = cx - w * 0.27, py = cy - s * 0.03;
  g.fillRect(px - d * 1.6, py - d / 2, d * 3.2, d); g.fillRect(px - d / 2, py - d * 1.6, d, d * 3.2);
  disco(g, cx + w * 0.2, py - d * 0.7, d * 0.75, COL.badge); disco(g, cx + w * 0.34, py + d * 0.6, d * 0.75, COL.badge);
}

function casetta(g: G, cx: number, cy: number, s: number): void {
  const w = s * 0.5, top = cy - s * 0.26, base = cy + s * 0.27;
  g.fillStyle = COL.crema;
  g.beginPath(); g.moveTo(cx, top); g.lineTo(cx + w * 0.62, cy - s * 0.02); g.lineTo(cx + w * 0.44, cy - s * 0.02); g.lineTo(cx + w * 0.44, base); g.lineTo(cx - w * 0.44, base); g.lineTo(cx - w * 0.44, cy - s * 0.02); g.lineTo(cx - w * 0.62, cy - s * 0.02); g.closePath(); g.fill();
  g.fillStyle = COL.badge; g.fillRect(cx - s * 0.06, cy + s * 0.06, s * 0.12, base - cy - s * 0.06);
}

/** Bottega con la tenda a strisce rosse e bianche (senza tessera, come nella reference). */
function bottega(g: G, cx: number, cy: number, s: number): void {
  const w = s * 0.84, x = cx - w / 2, lw = Math.max(1, s * 0.07);
  const yT = cy - s * 0.38, yB = cy - s * 0.04, yF = cy + s * 0.4;
  g.lineJoin = 'round'; g.strokeStyle = COL.notte; g.lineWidth = lw * 2;
  // muro e porta
  g.fillStyle = COL.crema; g.beginPath(); g.rect(x + w * 0.08, yB, w * 0.84, yF - yB); g.stroke(); g.fill();
  g.fillStyle = COL.badge; g.fillRect(cx - w * 0.12, yB + (yF - yB) * 0.3, w * 0.24, (yF - yB) * 0.7);
  // tenda: festoni in basso
  const n = 4, sw = w / n;
  g.beginPath(); g.moveTo(x, yT); g.lineTo(x + w, yT); g.lineTo(x + w, yB);
  for (let i = n - 1; i >= 0; i--) g.arc(x + sw * (i + 0.5), yB, sw / 2, 0, Math.PI);
  g.closePath(); g.stroke();
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : COL.rosso;
    g.beginPath(); g.moveTo(x + sw * i, yT); g.lineTo(x + sw * (i + 1), yT); g.lineTo(x + sw * (i + 1), yB); g.arc(x + sw * (i + 0.5), yB, sw / 2, 0, Math.PI); g.closePath(); g.fill();
  }
}

function missione(g: G, cx: number, cy: number, s: number): void {
  const r = s * 0.46;
  disco(g, cx, cy, r, COL.notte); disco(g, cx, cy, r * 0.86, COL.giallo); disco(g, cx, cy, r * 0.64, COL.badge);
  g.fillStyle = COL.giallo; rr(g, cx - r * 0.11, cy - r * 0.44, r * 0.22, r * 0.52, r * 0.09); g.fill();
  disco(g, cx, cy + r * 0.29, r * 0.12, COL.giallo);
}

/** Icona di una meta, centrata in (cx, cy), lato `s` px. */
export function disegnaMeta(g: G, cat: Cat, cx: number, cy: number, s: number): void {
  g.save();
  switch (cat) {
    case 'porto': tessera(g, cx, cy, s); ancora(g, cx, cy, s); break;
    case 'gioco': tessera(g, cx, cy, s); joypad(g, cx, cy, s); break;
    case 'casa': tessera(g, cx, cy, s); casetta(g, cx, cy, s); break;
    case 'negozio': bottega(g, cx, cy, s); break;
    case 'missione': missione(g, cx, cy, s); break;
    case 'luogo': disco(g, cx, cy, s * 0.24, COL.notte); disco(g, cx, cy, s * 0.16, COL.crema); break;
  }
  g.restore();
}

/** Te: freccia gialla col contorno scuro, punta verso `a` (radianti, 0 = nord). */
export function freccia(g: G, cx: number, cy: number, a: number, s: number): void {
  g.save(); g.translate(cx, cy); g.rotate(a);
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.78, s * 0.8); g.lineTo(0, s * 0.36); g.lineTo(-s * 0.78, s * 0.8); g.closePath();
  g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, s * 0.3); g.strokeStyle = COL.notte; g.stroke();
  g.fillStyle = COL.gialloChiaro; g.fill();
  g.restore();
}

/** Segnalino del navigatore: goccia rossa con la punta in (x, y). */
export function segnalino(g: G, x: number, y: number, s: number): void {
  const r = s * 0.34, cy = y - s * 0.64;
  g.save();
  g.beginPath(); g.arc(x, cy, r, Math.PI * 0.78, Math.PI * 2.22); g.lineTo(x, y); g.closePath();
  g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, s * 0.12); g.strokeStyle = COL.notte; g.stroke();
  g.fillStyle = COL.rosso; g.fill();
  disco(g, x, cy, r * 0.4, '#ffffff');
  g.restore();
}

/** Un amico: tondo crema col bordo scuro. */
export function tondo(g: G, x: number, y: number, r: number): void { disco(g, x, y, r, COL.notte); disco(g, x, y, r * 0.66, COL.crema); }

/** Onda disegnata sul mare aperto (i due archetti della reference). */
export function onda(g: G, x: number, y: number, u: number): void {
  g.save(); g.strokeStyle = COL.onda; g.lineWidth = Math.max(1, u * 0.22); g.lineCap = 'round';
  for (const [dx, dy] of [[0, 0], [u * 1.3, u * 0.9]] as const) {
    g.beginPath(); g.moveTo(x + dx - u * 1.4, y + dy); g.quadraticCurveTo(x + dx - u * 0.7, y + dy - u * 0.9, x + dx, y + dy); g.quadraticCurveTo(x + dx + u * 0.7, y + dy - u * 0.9, x + dx + u * 1.4, y + dy); g.stroke();
  }
  g.restore();
}

/** Icona di una riga della legenda, come immagine (dataURL) di `px` CSS px. */
export function iconaLegenda(cat: Cat | 'tu', px: number): string {
  const dpr = 2, c = document.createElement('canvas'); c.width = c.height = px * dpr;
  const g = c.getContext('2d');
  if (!g) return '';
  const m = (px * dpr) / 2;
  if (cat === 'tu') freccia(g, m, m, Math.PI / 2, px * dpr * 0.34); else disegnaMeta(g, cat, m, m, px * dpr * 0.92);
  return c.toDataURL();
}

/** Pergamena col bordo frastagliato come sfondo CSS (si allunga su qualsiasi pannello). `seme` cambia i dentini. */
export function pergamena(seme: number): string {
  let h = seme >>> 0;
  const rnd = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h / 4294967296; };
  const pts: string[] = [];
  const lato = (x0: number, y0: number, x1: number, y1: number, n: number, nx: number, ny: number) => {
    for (let i = 0; i < n; i++) { const t = i / n, j = (rnd() - 0.5) * 2.2; pts.push(`${(x0 + (x1 - x0) * t + nx * j).toFixed(1)},${(y0 + (y1 - y0) * t + ny * j).toFixed(1)}`); }
  };
  lato(2, 2, 98, 2, 16, 0, 1); lato(98, 2, 98, 98, 12, 1, 0); lato(98, 98, 2, 98, 16, 0, 1); lato(2, 98, 2, 2, 12, 1, 0);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><polygon points='${pts.join(' ')}' fill='${COL.perg}' stroke='${COL.inchiostro}' stroke-width='3' stroke-linejoin='round' vector-effect='non-scaling-stroke'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Cartiglio del titolo: striscia di pergamena coi due rotoli sotto (il testo ci va sopra in HTML). */
export const CARTIGLIO_SVG = `<svg viewBox="0 0 220 70" aria-hidden="true">
<g stroke="${COL.inchiostro}" stroke-width="3" stroke-linejoin="round">
<path d="M4 24 L24 20 L24 60 L8 66 L14 46 Z" fill="${COL.pergScura}"/><path d="M216 24 L196 20 L196 60 L212 66 L206 46 Z" fill="${COL.pergScura}"/>
<path d="M16 8 L48 5 L52 9 L90 6 L128 8 L132 4 L170 7 L205 6 L203 22 L206 38 L204 56 L168 58 L164 54 L120 57 L80 55 L50 58 L16 56 L18 40 L15 24 Z" fill="${COL.perg}"/>
<ellipse cx="24" cy="58" rx="7" ry="3.5" fill="${COL.pergScura}"/><ellipse cx="196" cy="58" rx="7" ry="3.5" fill="${COL.pergScura}"/>
</g></svg>`;

/** Rosa dei venti: N nel riquadro di pergamena, stella a 4 punte blu sui quarti d'oro. */
export const ROSA_SVG = `<svg viewBox="0 0 100 124" aria-hidden="true">
<g stroke="${COL.inchiostro}" stroke-width="2.5" stroke-linejoin="round">
<rect x="34" y="2" width="32" height="28" rx="3" fill="${COL.perg}"/>
<circle cx="50" cy="78" r="26" fill="${COL.inchiostro}"/>
<path d="M50 78 L50 56 A22 22 0 0 1 72 78 Z M50 78 L72 78 A22 22 0 0 1 50 100 Z M50 78 L50 100 A22 22 0 0 1 28 78 Z M50 78 L28 78 A22 22 0 0 1 50 56 Z" fill="#f8d068" stroke-width="1.5"/>
<path d="M50 78 L71 57 M50 78 L71 99 M50 78 L29 99 M50 78 L29 57" stroke-width="3.5"/>
<path d="M50 34 L56 72 L50 78 Z M94 78 L56 84 L50 78 Z M50 122 L44 84 L50 78 Z M6 78 L44 72 L50 78 Z" fill="#2c4378"/>
<path d="M50 34 L44 72 L50 78 Z M94 78 L56 72 L50 78 Z M50 122 L56 84 L50 78 Z M6 78 L44 84 L50 78 Z" fill="${COL.inchiostro}"/>
</g>
<text x="50" y="25" text-anchor="middle" font-family="MzTitan, 'Arial Rounded MT Bold', sans-serif" font-size="23" fill="${COL.inchiostro}">N</text>
</svg>`;

const isolaSvg = (cx: number, cy: number, s: number) =>
  `<ellipse cx="${cx}" cy="${cy + s * 0.32}" rx="${s}" ry="${s * 0.34}" fill="${COL.sabbiaIcona}" stroke="${COL.inchiostro}" stroke-width="1.2"/>` +
  `<path d="M${cx - s * 0.78} ${cy + s * 0.3} Q${cx - s * 0.5} ${cy - s * 0.9} ${cx} ${cy - s * 0.95} Q${cx + s * 0.5} ${cy - s * 0.9} ${cx + s * 0.78} ${cy + s * 0.3} Z" fill="${COL.verde}" stroke="${COL.inchiostro}" stroke-width="1.2"/>`;

/** Icone dei 3 scatti di ZOOM: tutto l'arcipelago (mappamondo), la zona (tre isole), l'isola. */
export const ZOOM_ICONE = [
  `<svg viewBox="0 0 40 32" aria-hidden="true"><circle cx="20" cy="16" r="11" fill="${COL.crema}" stroke="${COL.inchiostro}" stroke-width="2"/><path d="M13 9 Q18 11 15 15 Q12 19 17 23 M25 6 Q22 11 26 14 Q30 17 26 25" fill="none" stroke="#1d4f8a" stroke-width="3.2" stroke-linecap="round"/></svg>`,
  `<svg viewBox="0 0 40 32" aria-hidden="true">${isolaSvg(20, 9, 4.6)}${isolaSvg(12, 22, 4.6)}${isolaSvg(28, 22, 4.6)}</svg>`,
  `<svg viewBox="0 0 40 32" aria-hidden="true">${isolaSvg(20, 19, 9)}<path d="M20 6 L23 12 L17 12 Z" fill="#8bd06a" stroke="${COL.inchiostro}" stroke-width="1"/></svg>`,
] as const;
