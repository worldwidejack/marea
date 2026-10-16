// Le «pelli» della Difesa (#358): tutta la grafica del banco viene da qui, così lo stesso gioco si veste in stili diversi (bottone STILE).
// Una pelle = fondale (con gli angoli del campo 5 × 9 sull'immagine, anche un po' in prospettiva), atlas di sprite (ognuno coi piedi e
// l'altezza in caselle), nomi delle cose, colori della UI. `segnaposto` è disegnata da codice (forme semplici) e serve finché lo stile vero
// non c'è; le altre si caricano da /assets/difesa/<id>/pelle.json (le prepara tools/difesa_sprite.py dalle immagini di Codex).
import type { DTipoNemico, DTipoUnita } from '@marea/content/difesa.ts';

export type Punto = [number, number];
/** Uno sprite dell'atlas: rettangolo, piedi (punto che poggia a terra, in px dello sprite), altezza in caselle. */
export type SpriteDef = { img: CanvasImageSource; x: number; y: number; w: number; h: number; px: number; py: number; alto: number };
export type ChiaveSprite = DTipoUnita | DTipoNemico | 'colpo' | 'colpoGelo' | 'moneta' | 'tosaerba' | 'armaturaCono' | 'armaturaSecchio' | 'minaSotto';
export type Tema = { pannello: string; bordo: string; testo: string; ombra: string; accento: string; carta: string; cartaBordo: string; barra: string; barraPiena: string; sfondo: string };
export type Pelle = {
  id: string; nome: string; pixel: boolean;
  fondale: CanvasImageSource; fondaleW: number; fondaleH: number;
  /** Angoli del campo sull'immagine del fondale: alto-sinistra, alto-destra, basso-sinistra, basso-destra. */
  campo: { tl: Punto; tr: Punto; bl: Punto; br: Punto };
  sprite: Partial<Record<ChiaveSprite, SpriteDef>>;
  /** Copie colorate per il lampo dei colpi (bianco) e il gelo (azzurro). */
  bianco: Partial<Record<ChiaveSprite, HTMLCanvasElement>>; azzurro: Partial<Record<ChiaveSprite, HTMLCanvasElement>>;
  nomi: Partial<Record<DTipoUnita | DTipoNemico, string>> & { valuta?: string; base?: string };
  tema: Tema;
};

export const PELLI = [{ id: 'segnaposto', nome: 'Segnaposto' }] as { id: string; nome: string }[];

const tela = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** Le copie bianca e azzurra di ogni sprite (lampo del colpo, gelo). */
function copieColorate(p: Pelle): void {
  for (const [k, sp] of Object.entries(p.sprite) as [ChiaveSprite, SpriteDef][]) {
    for (const [dove, colore, alfa] of [[p.bianco, '#ffffff', 1], [p.azzurro, '#7fd8ff', 0.55]] as const) {
      const c = tela(sp.w, sp.h), g = c.getContext('2d')!;
      g.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h, 0, 0, sp.w, sp.h);
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alfa; g.fillStyle = colore; g.fillRect(0, 0, sp.w, sp.h);
      dove[k] = c;
    }
  }
}

// ---------- la pelle segnaposto: forme semplici disegnate da codice ----------
function segnaposto(): Pelle {
  const T = 128, A = tela(T * 8, T * 2), g = A.getContext('2d')!;
  const sprite: Partial<Record<ChiaveSprite, SpriteDef>> = {};
  let i = 0;
  const cella = (k: ChiaveSprite, alto: number, disegna: (g: CanvasRenderingContext2D) => void, py = 120) => {
    const x = (i % 8) * T, y = Math.floor(i / 8) * T; i++;
    g.save(); g.translate(x, y); disegna(g); g.restore();
    sprite[k] = { img: A, x, y, w: T, h: T, px: T / 2, py, alto };
  };
  const tondo = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, f: string, s = '#1b1b1b') => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = f; g.fill(); g.lineWidth = 5; g.strokeStyle = s; g.stroke(); };
  const occhi = (g: CanvasRenderingContext2D, cx: number, cy: number, d = 1) => { for (const ox of [-11, 11]) { tondo(g, cx + ox * d, cy, 8, '#fff', '#1b1b1b'); g.beginPath(); g.arc(cx + ox * d + 3 * d, cy + 1, 3.5, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill(); } };
  const base = (g: CanvasRenderingContext2D, colore: string) => { g.beginPath(); g.ellipse(64, 116, 34, 9, 0, 0, Math.PI * 2); g.fillStyle = colore; g.fill(); };
  // difensori (guardano a destra)
  cella('sparatore', 0.9, (g) => { base(g, '#6b4a2a'); tondo(g, 58, 70, 34, '#7ccf4a'); g.fillStyle = '#5aa833'; g.fillRect(84, 60, 30, 20); g.strokeStyle = '#1b1b1b'; g.lineWidth = 5; g.strokeRect(84, 60, 30, 20); occhi(g, 56, 62); });
  cella('produttore', 0.9, (g) => { base(g, '#6b4a2a'); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; tondo(g, 64 + Math.cos(a) * 30, 60 + Math.sin(a) * 30, 13, '#ffd23f'); } tondo(g, 64, 60, 24, '#c9772b'); occhi(g, 64, 56, 0.8); });
  cella('bomba', 0.8, (g) => { base(g, '#6b4a2a'); tondo(g, 50, 78, 26, '#e23b3b'); tondo(g, 80, 74, 24, '#e23b3b'); g.strokeStyle = '#2d7a2d'; g.lineWidth = 6; g.beginPath(); g.moveTo(50, 52); g.quadraticCurveTo(66, 20, 82, 50); g.stroke(); occhi(g, 64, 74, 0.8); });
  cella('muro', 1.0, (g) => { base(g, '#6b4a2a'); g.beginPath(); g.ellipse(64, 66, 38, 50, 0, 0, Math.PI * 2); g.fillStyle = '#b0703a'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1b1b1b'; g.stroke(); occhi(g, 64, 52); });
  cella('mina', 0.6, (g) => { base(g, '#6b4a2a'); g.beginPath(); g.ellipse(64, 92, 34, 24, 0, 0, Math.PI * 2); g.fillStyle = '#c8a26a'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1b1b1b'; g.stroke(); tondo(g, 64, 64, 7, '#ff3b3b'); occhi(g, 64, 90, 0.7); }, 118);
  cella('minaSotto', 0.6, (g) => { g.beginPath(); g.ellipse(64, 108, 30, 12, 0, 0, Math.PI * 2); g.fillStyle = '#7a5a35'; g.fill(); tondo(g, 64, 98, 6, '#7a3030'); }, 118);
  cella('gelo', 0.9, (g) => { base(g, '#6b4a2a'); tondo(g, 58, 70, 34, '#7fd8ff'); g.fillStyle = '#4fb6e8'; g.fillRect(84, 60, 30, 20); g.strokeStyle = '#1b1b1b'; g.lineWidth = 5; g.strokeRect(84, 60, 30, 20); occhi(g, 56, 62); });
  cella('tosaerba', 0.55, (g) => { g.fillStyle = '#d33'; g.fillRect(30, 70, 62, 34); g.strokeStyle = '#1b1b1b'; g.lineWidth = 5; g.strokeRect(30, 70, 62, 34); tondo(g, 42, 106, 10, '#333'); tondo(g, 82, 106, 10, '#333'); g.beginPath(); g.moveTo(34, 70); g.lineTo(18, 40); g.stroke(); }, 118);
  // nemici (guardano a sinistra)
  const nemico = (g: CanvasRenderingContext2D, corpo: string) => { base(g, '#3a2d23'); g.beginPath(); g.ellipse(64, 74, 30, 40, 0, 0, Math.PI * 2); g.fillStyle = corpo; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1b1b1b'; g.stroke(); occhi(g, 56, 60, -1); g.fillStyle = '#1b1b1b'; g.fillRect(40, 84, 22, 5); };
  cella('base', 1.15, (g) => nemico(g, '#9b7fc8'));
  cella('bandiera', 1.15, (g) => { nemico(g, '#9b7fc8'); g.fillStyle = '#5a3a1e'; g.fillRect(90, 12, 6, 80); g.fillStyle = '#e23b3b'; g.fillRect(96, 12, 26, 18); });
  cella('cono', 1.15, (g) => { nemico(g, '#9b7fc8'); g.beginPath(); g.moveTo(44, 40); g.lineTo(84, 40); g.lineTo(64, 4); g.closePath(); g.fillStyle = '#ff8a2a'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1b1b1b'; g.stroke(); });
  cella('secchio', 1.15, (g) => { nemico(g, '#9b7fc8'); g.fillStyle = '#a8b0b8'; g.fillRect(40, 14, 48, 30); g.lineWidth = 5; g.strokeStyle = '#1b1b1b'; g.strokeRect(40, 14, 48, 30); });
  cella('saltatore', 1.2, (g) => { nemico(g, '#c86f6f'); g.strokeStyle = '#5a3a1e'; g.lineWidth = 6; g.beginPath(); g.moveTo(20, 30); g.lineTo(108, 104); g.stroke(); });
  cella('colpo', 0.22, (g) => tondo(g, 64, 64, 22, '#8ee05a'), 86);
  cella('colpoGelo', 0.22, (g) => tondo(g, 64, 64, 22, '#9fe8ff'), 86);
  cella('moneta', 0.5, (g) => { tondo(g, 64, 64, 34, '#ffd23f', '#a06a00'); g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(54, 54, 9, 0, Math.PI * 2); g.fill(); }, 98);
  // fondale: prato a scacchi con la casa a sinistra e la strada a destra
  const FW = 1536, FH = 1024, f = tela(FW, FH), h = f.getContext('2d')!;
  const tl: Punto = [300, 250], br: Punto = [1300, 900];
  h.fillStyle = '#4f8a3a'; h.fillRect(0, 0, FW, FH);
  h.fillStyle = '#6aa84f'; h.fillRect(0, 0, FW, 200);
  h.fillStyle = '#8c7a62'; h.fillRect(1330, 0, 206, FH);
  const cw = (br[0] - tl[0]) / 9, ch = (br[1] - tl[1]) / 5;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) { h.fillStyle = (r + c) % 2 ? '#7cc35a' : '#6db54d'; h.fillRect(tl[0] + c * cw, tl[1] + r * ch, cw + 1, ch + 1); }
  h.fillStyle = '#d9cbb0'; h.fillRect(60, 220, 170, 700); h.fillStyle = '#b84a3a'; h.beginPath(); h.moveTo(40, 230); h.lineTo(145, 120); h.lineTo(250, 230); h.fill();
  const p: Pelle = {
    id: 'segnaposto', nome: 'Segnaposto', pixel: false, fondale: f, fondaleW: FW, fondaleH: FH,
    campo: { tl, tr: [br[0], tl[1]], bl: [tl[0], br[1]], br },
    sprite, bianco: {}, azzurro: {},
    nomi: { sparatore: 'Sparatore', produttore: 'Produttore', bomba: 'Bomba', muro: 'Muro', mina: 'Mina', gelo: 'Gelo', base: 'Nemico', bandiera: 'Capobanda', cono: 'Col cono', secchio: 'Col secchio', saltatore: 'Saltatore', valuta: 'monete' },
    tema: { pannello: 'rgba(40,30,22,0.88)', bordo: '#c99a5b', testo: '#fff6e0', ombra: '#1b120c', accento: '#ffd23f', carta: '#f3e3c0', cartaBordo: '#8a5a2b', barra: '#3b2a1c', barraPiena: '#7fd35a', sfondo: '#2e4a24' },
  };
  copieColorate(p);
  return p;
}

const carica = (src: string) => new Promise<HTMLImageElement>((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error(`immagine non caricata: ${src}`)); im.src = src; });
type PelleJson = {
  id: string; nome: string; pixel?: boolean; fondale: string; campo: { tl: Punto; tr: Punto; bl: Punto; br: Punto };
  atlas: string; sprite: Partial<Record<ChiaveSprite, { x: number; y: number; w: number; h: number; px: number; py: number; alto: number }>>;
  nomi: Pelle['nomi']; tema: Tema;
};
/** La pelle `id` (segnaposto = da codice, le altre dai file in /assets/difesa/<id>/). */
export async function caricaPelle(id: string): Promise<Pelle> {
  if (id === 'segnaposto') return segnaposto();
  const dir = `/assets/difesa/${id}/`, j = (await (await fetch(dir + 'pelle.json')).json()) as PelleJson;
  const [fondale, atlas] = await Promise.all([carica(dir + j.fondale), carica(dir + j.atlas)]);
  const sprite: Pelle['sprite'] = {};
  for (const [k, d] of Object.entries(j.sprite) as [ChiaveSprite, PelleJson['sprite'][ChiaveSprite]][]) if (d) sprite[k] = { img: atlas, ...d };
  const ph = segnaposto();
  for (const k of Object.keys(ph.sprite) as ChiaveSprite[]) if (!sprite[k]) sprite[k] = ph.sprite[k];
  const p: Pelle = { id: j.id, nome: j.nome, pixel: !!j.pixel, fondale, fondaleW: fondale.naturalWidth, fondaleH: fondale.naturalHeight, campo: j.campo, sprite, bianco: {}, azzurro: {}, nomi: { ...ph.nomi, ...j.nomi }, tema: j.tema };
  copieColorate(p);
  return p;
}
