// Le «pelli» della Difesa (#358, #379): tutta la grafica del banco viene da qui, così lo stesso gioco si veste in stili diversi (bottone
// STILE). Una pelle = fondale (con gli angoli del campo 5 × 9 sull'immagine, anche un po' in prospettiva), sprite animati a fotogrammi
// (ognuno coi piedi, l'altezza in caselle e le sue clip: fermo, carica, spara, cammina, mangia…), nomi delle cose, colori della UI.
// `segnaposto` è disegnata da codice (forme semplici, un fotogramma per sprite); le altre si caricano da /assets/difesa/<id>/pelle.json:
// v1 = un rettangolo per sprite (tools/difesa_sprite.py), v2 = clip di fotogrammi su più pagine WebP (tools/difesa_pelle.py).
import type { DTipoNemico, DTipoUnita } from '@marea/content/difesa.ts';

export type Punto = [number, number];
export type NomeClip =
  | 'fermo' | 'chiusi' | 'carica' | 'spara' | 'manovella' | 'seme' | 'gonfia' | 'rovente' | 'rosicchiato' | 'mezzo'
  | 'sotto' | 'spunta' | 'lampo' | 'corre' | 'cammina' | 'mangia' | 'salta' | 'ko' | 'scoppia';
export type ChiaveSprite =
  | DTipoUnita | DTipoNemico | 'secchioNudo' | 'colpo' | 'colpoGelo' | 'moneta' | 'tosaerba'
  | 'armaturaCono' | 'armaturaSecchio' | 'minaSotto' | 'botto' | 'pala';
/** Un fotogramma: rettangolo sulla pagina dell'atlas e angolo in alto a sinistra (ox, oy) nello spazio dello sprite, dove stanno i piedi. */
export type Fotogramma = { img: CanvasImageSource; x: number; y: number; w: number; h: number; ox: number; oy: number; bianco?: HTMLCanvasElement; azzurro?: HTMLCanvasElement };
/** Una clip: i fotogrammi, quanti al secondo (`fps`) o quante caselle di strada per un giro intero (`giro`, per chi cammina). */
export type Clip = { f: Fotogramma[]; fps: number; giro: number };
/** Uno sprite: piedi (px, py) nel suo spazio, `alto` caselle = `altoPx` px di quello spazio, le clip (almeno `fermo`); `come` = da chi
 *  prende in prestito le clip che non ha (la lumaca con la ghianda prende il KO della lumaca). */
export type SpriteDef = { alto: number; altoPx: number; px: number; py: number; come?: ChiaveSprite; clip: Partial<Record<NomeClip, Clip>> & { fermo: Clip } };
/** Cosa disegnare: la chiave, la clip e il numero del fotogramma (si fa il modulo: le clip girano). */
export type Posa = { k: ChiaveSprite; clip: NomeClip; i: number };
export type Tema = { pannello: string; bordo: string; testo: string; ombra: string; accento: string; carta: string; cartaBordo: string; barra: string; barraPiena: string; sfondo: string; schegge?: string };
export type Pelle = {
  id: string; nome: string; pixel: boolean;
  fondale: CanvasImageSource; fondaleW: number; fondaleH: number;
  /** Angoli del campo sull'immagine del fondale: alto-sinistra, alto-destra, basso-sinistra, basso-destra. */
  campo: { tl: Punto; tr: Punto; bl: Punto; br: Punto };
  sprite: Partial<Record<ChiaveSprite, SpriteDef>>;
  nomi: Partial<Record<DTipoUnita | DTipoNemico, string>> & { valuta?: string; base?: string };
  tema: Tema;
  /** Altezza dei colpi in volo sopra la riga dei piedi, in caselle. */
  volo: number;
  /** Cartella dei file della pelle (suoni, immagini della UI) e i suoni per nome (uno o più file, a caso). */
  dir: string; suoni: Record<string, string[]>;
  /** Immagini della UI (es. il legno della barra), se la pelle le ha. */
  ui: Record<string, string>;
  /** Le frasi del tutorial e dei consigli coi nomi del cast della pelle (primo, semi, altro, produttore…, riprova). */
  consigli: Record<string, string>;
};

export const PELLI = [{ id: 'segnaposto', nome: 'Segnaposto' }, { id: 'orto', nome: "L'orto" }] as { id: string; nome: string }[];
export const PELLE_DI_SERIE = 'orto';

const tela = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** La clip `nome` della chiave `k` (o di chi le presta le clip), con lo sprite che la possiede; null se non c'è. */
export function clipDi(p: Pelle, k: ChiaveSprite, nome: NomeClip): { c: Clip; sp: SpriteDef } | null {
  const sp = p.sprite[k];
  if (!sp) return null;
  const c = sp.clip[nome];
  if (c) return { c, sp };
  if (sp.come) { const s2 = p.sprite[sp.come]; const c2 = s2?.clip[nome]; if (s2 && c2) return { c: c2, sp: s2 }; }
  return null;
}
/** Il corpo senza armatura: lo scarabeo senza vasetto se la pelle ce l'ha, altrimenti il nemico base. */
export function spoglio(p: Pelle, tipo: DTipoNemico): ChiaveSprite {
  if (tipo === 'secchio' && p.sprite.secchioNudo) return 'secchioNudo';
  return tipo === 'cono' || tipo === 'secchio' ? 'base' : tipo;
}
/** Il primo fotogramma di `fermo` (icone delle carte, menù, fantasma della casella). */
export function primo(p: Pelle, k: ChiaveSprite): Fotogramma | null { return p.sprite[k]?.clip.fermo.f[0] ?? null; }

/** La copia bianca (lampo del colpo) o azzurra (gelo) di un fotogramma: fatta la prima volta che serve. */
function tinta(f: Fotogramma, quale: 'bianco' | 'azzurro'): HTMLCanvasElement {
  const pronta = f[quale];
  if (pronta) return pronta;
  const c = tela(f.w, f.h), g = c.getContext('2d')!;
  g.drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = quale === 'bianco' ? 1 : 0.55;
  g.fillStyle = quale === 'bianco' ? '#ffffff' : '#7fd8ff';
  g.fillRect(0, 0, f.w, f.h);
  f[quale] = c;
  return c;
}
export type OpzioniFoto = { sx?: number; sy?: number; rot?: number; alfa?: number; bianco?: number; azzurro?: number; specchio?: boolean };
/** Disegna la posa coi piedi in (x, y) di schermo; `H` = altezza di una casella in px di schermo. Ritorna false se non c'è niente. */
export function disegnaFoto(g: CanvasRenderingContext2D, p: Pelle, posa: Posa, x: number, y: number, H: number, o: OpzioniFoto = {}): boolean {
  const trovata = clipDi(p, posa.k, posa.clip) ?? clipDi(p, posa.k, 'fermo');
  if (!trovata) return false;
  const { c, sp } = trovata, n = c.f.length, f = c.f[((posa.i % n) + n) % n]!;
  const k = (H * sp.alto) / sp.altoPx, sx = o.sx ?? 1, sy = o.sy ?? 1;
  g.save();
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  g.scale(o.specchio ? -sx : sx, sy);
  const a0 = o.alfa ?? 1;
  if (a0 !== 1) g.globalAlpha = a0;
  const dx = (f.ox - sp.px) * k, dy = (f.oy - sp.py) * k, w = f.w * k, h = f.h * k;
  g.drawImage(f.img, f.x, f.y, f.w, f.h, dx, dy, w, h);
  if (o.azzurro) { g.globalAlpha = a0 * o.azzurro; g.drawImage(tinta(f, 'azzurro'), dx, dy, w, h); }
  if (o.bianco) { g.globalAlpha = a0 * o.bianco; g.drawImage(tinta(f, 'bianco'), dx, dy, w, h); }
  g.restore();
  return true;
}

const uno = (img: CanvasImageSource, x: number, y: number, w: number, h: number, px: number, py: number, alto: number): SpriteDef =>
  ({ alto, altoPx: h, px, py, clip: { fermo: { f: [{ img, x, y, w, h, ox: 0, oy: 0 }], fps: 8, giro: 0 } } });

// ---------- la pelle segnaposto: forme semplici disegnate da codice ----------
function segnaposto(): Pelle {
  const T = 128, A = tela(T * 8, T * 2), g = A.getContext('2d')!;
  const sprite: Partial<Record<ChiaveSprite, SpriteDef>> = {};
  let i = 0;
  const cella = (k: ChiaveSprite, alto: number, disegna: (g: CanvasRenderingContext2D) => void, py = 120) => {
    const x = (i % 8) * T, y = Math.floor(i / 8) * T; i++;
    g.save(); g.translate(x, y); disegna(g); g.restore();
    sprite[k] = uno(A, x, y, T, T, T / 2, py, alto);
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
  return {
    id: 'segnaposto', nome: 'Segnaposto', pixel: false, fondale: f, fondaleW: FW, fondaleH: FH,
    campo: { tl, tr: [br[0], tl[1]], bl: [tl[0], br[1]], br },
    sprite, volo: 0.31, dir: '', suoni: {}, ui: {}, consigli: {},
    nomi: { sparatore: 'Sparatore', produttore: 'Produttore', bomba: 'Bomba', muro: 'Muro', mina: 'Mina', gelo: 'Gelo', base: 'Nemico', bandiera: 'Capobanda', cono: 'Col cono', secchio: 'Col secchio', saltatore: 'Saltatore', valuta: 'monete' },
    tema: { pannello: 'rgba(40,30,22,0.88)', bordo: '#c99a5b', testo: '#fff6e0', ombra: '#1b120c', accento: '#ffd23f', carta: '#f3e3c0', cartaBordo: '#8a5a2b', barra: '#3b2a1c', barraPiena: '#7fd35a', sfondo: '#2e4a24' },
  };
}

// onload e non decode(): decode() in certi browser (il pannello di Claude, telefoni in secondo piano) aspetta secondi senza motivo
const carica = (src: string) => new Promise<HTMLImageElement>((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error(`immagine non caricata: ${src}`)); im.src = src; });
type RigaFoto = [number, number, number, number, number, number, number];
type PelleJson = {
  versione?: number; id: string; nome: string; pixel?: boolean; fondale: string; campo: Pelle['campo']; nomi: Pelle['nomi']; tema: Tema;
  volo?: number; suoni?: Record<string, string | string[]>; ui?: Record<string, string>; consigli?: Record<string, string>;
  // v1: un atlas e un rettangolo per sprite
  atlas?: string; sprite: Record<string, { x: number; y: number; w: number; h: number; px: number; py: number; alto: number }
    // v2: pagine e clip di fotogrammi
    | { alto: number; altoPx: number; px: number; py: number; come?: ChiaveSprite; clip: Record<string, { fps: number; giro: number; f: RigaFoto[] }> }>;
  pagine?: string[];
};
/** La pelle `id` (segnaposto = da codice, le altre dai file in /assets/difesa/<id>/). `avanti(0..1)` dice a che punto è il caricamento. */
export async function caricaPelle(id: string, avanti: (frazione: number) => void = () => {}): Promise<Pelle> {
  const ph = segnaposto();
  if (id === 'segnaposto') return ph;
  const dir = `/assets/difesa/${id}/`;
  const r = await fetch(dir + 'pelle.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`pelle ${id}: ${r.status}`);
  const j = (await r.json()) as PelleJson;
  const file = [j.fondale, ...(j.pagine ?? (j.atlas ? [j.atlas] : []))];
  let fatti = 0;
  avanti(0.05);
  const immagini = await Promise.all(file.map(async (f) => { const im = await carica(dir + f); fatti++; avanti(0.05 + (0.95 * fatti) / file.length); return im; }));
  const [fondale, ...pagine] = immagini as [HTMLImageElement, ...HTMLImageElement[]];
  const sprite: Pelle['sprite'] = {};
  for (const [k, d] of Object.entries(j.sprite) as [ChiaveSprite, PelleJson['sprite'][string]][]) {
    if ('clip' in d) {
      const clip: Partial<Record<NomeClip, Clip>> = {};
      for (const [nome, c] of Object.entries(d.clip)) clip[nome as NomeClip] = { fps: c.fps, giro: c.giro, f: c.f.map(([pg, x, y, w, h, ox, oy]) => ({ img: pagine[pg]!, x, y, w, h, ox, oy })) };
      if (!clip.fermo) clip.fermo = Object.values(clip)[0]!;
      sprite[k] = { alto: d.alto, altoPx: d.altoPx, px: d.px, py: d.py, come: d.come, clip: clip as SpriteDef['clip'] };
    } else sprite[k] = uno(pagine[0]!, d.x, d.y, d.w, d.h, d.px, d.py, d.alto);
  }
  for (const k of Object.keys(ph.sprite) as ChiaveSprite[]) {
    if (sprite[k]) continue;
    if (k !== 'minaSotto' || !sprite.mina?.clip.sotto) console.warn(`[difesa] pelle ${id}: manca «${k}», uso il segnaposto`);
    sprite[k] = ph.sprite[k];
  }
  const suoni: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(j.suoni ?? {})) suoni[k] = Array.isArray(v) ? v : [v];
  return {
    id: j.id, nome: j.nome, pixel: !!j.pixel, fondale, fondaleW: fondale.naturalWidth, fondaleH: fondale.naturalHeight, campo: j.campo, sprite,
    nomi: { ...ph.nomi, ...j.nomi }, tema: j.tema, volo: j.volo ?? ph.volo, dir, suoni, ui: j.ui ?? {}, consigli: j.consigli ?? {},
  };
}
