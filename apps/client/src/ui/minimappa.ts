// Minimappa e mappa grande (#62, rifatte con #360 sulla reference «C · Wind Waker» scelta da Jack il 16 ott 2026, disegni in ui/carta.ts).
// Minimappa: cerchio con l'anello giallo in alto a destra (telefono) o in basso a destra sopra il bottone A (PC), col nord sempre in alto e + / −
// a 3 scatti. Toccandolo o premendo M si apre la carta nautica: mare a griglia con le onde, rotte tratteggiate dal Porto, icone delle mete per
// categoria (legenda), rosa dei venti, ZOOM a 3 scatti (tutto l'arcipelago, la zona, l'isola; anche rotella e + / −), da ingrandita si trascina.
// Le isole non ancora scoperte e quelle a tema chiuse (#68) non si disegnano proprio (VISIONE §1: niente nebbia): ci passi vicino in barca e
// compaiono (Porto e la tua isola da subito). Scoperte e scatti dello zoom restano su questo dispositivo (localStorage).
// Segnalino del navigatore (#144, ui/segno.ts): un tocco sulla carta lo mette lì (sull'icona di una meta si aggancia a lei), un tocco sul
// segnalino o TOGLI nella riga in fondo lo tolgono. Sulla carta una scia di puntini va da te al segnalino; nella minimappa sta sul bordo se è lontano.
import type { GridMap, Tile } from '@marea/sim';
import type { PixId } from './icons.ts';
import type { Segno } from './segno.ts';
import { PAL } from './style.ts';
import { COL, CARTIGLIO_SVG, LEGENDA, ROSA_SVG, ZOOM_ICONE, categoria, disegnaMeta, freccia, iconaLegenda, onda, pergamena, segnalino, tondo } from './carta.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const P = PAL;
const STORE = 'marea:mappa';
/** Distanza (m) dal bordo di un'isola entro cui la scopri. */
const SCOPRI_M = 55;
/** Raggio (m) della minimappa ai 3 scatti (0 = più lontano). */
const RAGGI = [140, 80, 45] as const;
/** Ingrandimento della carta ai 3 scatti di ZOOM: tutto l'arcipelago, la zona, l'isola. */
const SCATTI = [1, 2.2, 4.5] as const;
/** Celle per quadretto della griglia del mare. */
const GRIGLIA = 30;
/** Tocco sulla carta (px sullo schermo): entro questo raggio dal segnalino lo togli, dall'icona di una meta il segnalino si aggancia a lei;
 *  oltre TRASCINA il dito sposta la carta ingrandita invece di toccare. */
const TOCCO_SEGNO = 22, TOCCO_META = 18, TRASCINA = 7;
/** null = mare aperto (trasparente: sotto c'è il mare con la griglia). */
const TILE_COL: Record<Tile, string | null> = {
  '~': null, ',': COL.bassa, B: COL.bassa, '.': P.sabbia, P: P.sabbia, L: P.sabbia, g: P.erba, r: P.roccia, d: P.legno,
};

/** `chiusa`: letto ogni ½ s; true = l'isola non si disegna anche se scoperta (isole a tema non ancora sbloccate). */
export type MappaPlace = { id: string; nome: string; x0: number; z0: number; w: number; h: number; sempre?: boolean; chiusa?(): boolean };
export type MappaTarget = { id: string; label: string; x: number; z: number; icon?: PixId; show?(): boolean };
export type Pose = { x: number; z: number; yaw: number };
export type Minimappa = { update(me: Pose, cameraYaw: number, peers: readonly { nome?: string; x: number; z: number }[]): void; toggle(): void; close(): void; isOpen(): boolean;
  /** L'isola `id` (MappaPlace.id) è già stata scoperta (ci sei passato vicino)? La bussola mostra le isole a tema solo da scoperte. */
  vista(id: string): boolean;
  /** Bordo che lampeggia sul cerchio (la guida «Primi passi» dice di toccarlo). */
  evidenzia(on: boolean): void };

const TITAN = `'MzTitan', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif`;
const CSS = `
@font-face { font-family: 'MzTitan'; src: url('/assets/fonts/titan-one-latin.woff2') format('woff2'); font-display: swap; }
#mzMini { position: absolute; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 136px); /* sopra il bottone A (84 px a 36 px dal fondo) */ display: flex; align-items: flex-start; gap: 6px; z-index: 13; }
#mzMini .cerchio { position: relative; width: 148px; height: 148px; padding: 0; border: 6px solid ${COL.giallo}; border-radius: 50%; background: ${COL.notte}; box-shadow: 0 0 0 3px ${COL.notte}, 0 4px 0 3px rgba(10,20,48,.35); box-sizing: border-box; cursor: pointer; }
#mzMini canvas { width: 100%; height: 100%; display: block; border-radius: 50%; border: 2px solid ${COL.notte}; box-sizing: border-box; background: ${COL.mareMini}; }
#mzMini .n { position: absolute; left: 50%; top: -6px; transform: translate(-50%, -50%); font: 18px ${TITAN}; color: ${COL.gialloChiaro}; pointer-events: none;
  text-shadow: 2px 0 0 ${COL.notte}, -2px 0 0 ${COL.notte}, 0 2px 0 ${COL.notte}, 0 -2px 0 ${COL.notte}, 1.5px 1.5px 0 ${COL.notte}, -1.5px 1.5px 0 ${COL.notte}, 1.5px -1.5px 0 ${COL.notte}, -1.5px -1.5px 0 ${COL.notte}; }
#mzMini .zoom { display: flex; flex-direction: column; gap: 6px; }
#mzMini .zoom button { width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; background: #f8d474; border: 3px solid ${COL.notte}; border-radius: 8px; box-shadow: inset 0 -3px 0 #d8a84a, 0 2px 0 ${COL.notte}; color: ${COL.notte}; font: 24px/1 ${TITAN}; cursor: pointer; }
#mzMini .zoom button:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #d8a84a; }
#mzMini .zoom button:disabled { opacity: .45; cursor: default; }
#mzMini :focus { outline: none; } #mzMini .cerchio:focus-visible { border-color: #ffffff; }
#mzMini.qui .cerchio { animation: mzMiniQui 1s steps(2, jump-none) infinite; }
@keyframes mzMiniQui { from { border-color: ${COL.giallo}; } to { border-color: #ffffff; } }
@media (max-width: 699px) {
  #mzMini { bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 58px); gap: 4px; }
  #mzMini .cerchio { width: 92px; height: 92px; border-width: 4px; box-shadow: 0 0 0 2px ${COL.notte}, 0 3px 0 2px rgba(10,20,48,.35); }
  #mzMini .n { font-size: 14px; top: -4px; }
  #mzMini .zoom { gap: 4px; } #mzMini .zoom button { width: 30px; height: 30px; font-size: 20px; border-width: 2px; border-radius: 6px; }
}
#mzMappa { position: absolute; inset: 0; z-index: 30; display: none; box-sizing: border-box; padding: 12px 14px; background: rgba(8,16,40,.95); color: ${COL.inchiostro}; font-family: ${TITAN};
  grid-template-columns: 1fr auto 1fr; grid-template-rows: auto auto 1fr auto; grid-template-areas: "banner fr hd" "rosa fr zoom" "leg fr ." ". pie ."; gap: 10px 18px; align-content: center; }
#mzMappa.on { display: grid; }
#mzMappa .fr { grid-area: fr; position: relative; aspect-ratio: var(--ar); height: min(calc(100dvh - 92px), calc((100vw - 500px) / var(--ar))); box-sizing: border-box; border: 6px solid ${COL.giallo}; background: ${COL.mare}; box-shadow: 0 0 0 4px ${COL.notte}, 0 6px 0 4px rgba(0,0,0,.3); }
#mzMappa .fr::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 0 3px ${COL.notte}; pointer-events: none; }
#mzMappa canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; touch-action: none; } /* assoluta: la tela non allarga la griglia */
#mzMappa > * { min-width: 0; }
#mzMappa .banner { grid-area: banner; justify-self: end; position: relative; width: 210px; height: 66px; }
#mzMappa .banner svg { position: absolute; inset: 0; width: 100%; height: 100%; }
#mzMappa .banner b { position: absolute; left: 0; right: 0; top: 9px; text-align: center; font: 36px/1.1 ${TITAN}; font-weight: normal; letter-spacing: 1px; }
#mzMappa .rosa { grid-area: rosa; justify-self: end; width: 84px; margin-right: 60px; }
#mzMappa .rosa svg { width: 100%; display: block; }
#mzMappa .leg { grid-area: leg; justify-self: end; align-self: end; display: grid; grid-template-columns: auto; gap: 8px 18px; padding: 16px 22px; background: ${pergamena(7)} center / 100% 100% no-repeat; font-size: 17px; }
#mzMappa .leg span { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
#mzMappa .leg img { width: 28px; height: 28px; }
#mzMappa .hd { grid-area: hd; justify-self: start; }
#mzMappa .hd button { width: 48px; height: 48px; border: none; padding: 0; background: ${pergamena(11)} center / 100% 100% no-repeat; color: ${COL.inchiostro}; font: 30px/1 ${TITAN}; cursor: pointer; }
#mzMappa .zoom { grid-area: zoom; justify-self: start; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 14px 16px; background: ${pergamena(3)} center / 100% 100% no-repeat; }
#mzMappa .zoom b { font: 20px/1 ${TITAN}; font-weight: normal; letter-spacing: 1px; }
#mzMappa .zoom div { display: flex; flex-direction: column; gap: 8px; }
#mzMappa .zoom button { width: 66px; height: 54px; padding: 4px; background: ${COL.bottone}; border: 3px solid ${COL.bordoBottone}; border-radius: 6px; box-shadow: 0 0 0 2px ${COL.notte}; cursor: pointer; }
#mzMappa .zoom button.on { border-color: ${COL.scelto}; box-shadow: 0 0 0 3px ${COL.notte}; }
#mzMappa .zoom button svg { width: 100%; height: 100%; display: block; }
#mzMappa .pie { grid-area: pie; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; padding: 4px 18px; box-sizing: border-box; background: ${pergamena(5)} center / 100% 100% no-repeat; font-size: 15px; text-align: center; }
#mzMappa .pie img { width: 20px; height: 24px; }
#mzMappa .pie button { min-height: 36px; padding: 0 14px; background: ${COL.bottone}; border: 2px solid ${COL.notte}; border-radius: 6px; color: ${COL.crema}; font: 15px ${TITAN}; cursor: pointer; }
#mzMappa button:active { transform: translateY(2px); }
@media (min-aspect-ratio: 1/1) and (max-height: 560px) { /* telefono in orizzontale: tutto più piccolo, la rosa sparisce */
  #mzMappa { padding: 8px 10px; gap: 6px 10px; }
  #mzMappa .fr { height: min(calc(100dvh - 70px), calc((100vw - 380px) / var(--ar))); border-width: 4px; box-shadow: 0 0 0 3px ${COL.notte}; }
  #mzMappa .banner { width: 140px; height: 44px; } #mzMappa .banner b { font-size: 24px; top: 6px; }
  #mzMappa .rosa { display: none; }
  #mzMappa .leg { font-size: 12px; padding: 8px 12px; gap: 3px; } #mzMappa .leg img { width: 18px; height: 18px; }
  #mzMappa .hd button { width: 40px; height: 40px; font-size: 24px; }
  #mzMappa .zoom { padding: 6px 8px 10px; gap: 4px; } #mzMappa .zoom b { font-size: 13px; } #mzMappa .zoom div { gap: 4px; } #mzMappa .zoom button { width: 46px; height: 36px; }
  #mzMappa .pie { min-height: 34px; font-size: 12px; } #mzMappa .pie button { min-height: 28px; font-size: 12px; }
}
@media (max-aspect-ratio: 1/1) {
  #mzMappa { grid-template-columns: 1fr auto auto; grid-template-rows: auto auto auto auto; grid-template-areas: "banner rosa hd" "fr fr fr" "leg zoom zoom" "pie pie pie"; gap: 10px; padding: 10px 12px; }
  #mzMappa .fr { width: min(calc(100vw - 24px), calc((100dvh - 330px) * var(--ar))); height: auto; justify-self: center; border-width: 4px; box-shadow: 0 0 0 3px ${COL.notte}; }
  #mzMappa .banner { justify-self: start; width: 150px; height: 48px; } #mzMappa .banner b { font-size: 26px; top: 6px; }
  #mzMappa .rosa { width: 46px; margin: 0; align-self: center; }
  #mzMappa .hd { justify-self: end; align-self: center; } #mzMappa .hd button { width: 44px; height: 44px; font-size: 26px; }
  #mzMappa .leg { justify-self: stretch; align-self: start; grid-template-columns: auto auto; font-size: 13px; padding: 10px 12px; gap: 6px 10px; } #mzMappa .leg img { width: 22px; height: 22px; }
  #mzMappa .zoom { align-self: start; padding: 8px 10px 12px; gap: 6px; } #mzMappa .zoom b { font-size: 15px; }
  #mzMappa .zoom div { flex-direction: row; gap: 6px; } #mzMappa .zoom button { width: 46px; height: 42px; }
  #mzMappa .pie { font-size: 13px; }
}
#ui.mz-racing #mzMini, body.mz-sotto #mzMini, body.mz-casa #mzMini { visibility: hidden; } /* mz-casa: in casa e in giardino (#265) */
`;

type Saved = { viste?: string[]; zoom?: number; zoomMini?: number };
const load = (): Saved => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const guard = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };
const scatto = (v: unknown, def: number) => (typeof v === 'number' && v >= 0 && v <= 2 ? Math.round(v) : def);
const dprDi = () => Math.min(2, window.devicePixelRatio || 1);

export function createMinimappa(o: {
  root: HTMLElement; map: GridMap; places: MappaPlace[]; targets: MappaTarget[];
  /** Pannelli aperti, gara, dungeon: la mappa grande non si apre (e si chiude se era aperta). */
  hidden?(): boolean;
  /** Segnalino del navigatore (#144): senza, la mappa non si tocca. */
  segno?: Segno;
}): Minimappa {
  if (!document.getElementById('mz-mini-style')) { const st = document.createElement('style'); st.id = 'mz-mini-style'; st.textContent = CSS; document.head.appendChild(st); }
  const { map } = o, T = map.tile, W = map.w, H = map.h;
  const salvato = load();
  const viste = new Set(salvato.viste ?? []);
  let zm = scatto(salvato.zoomMini, 1), zb = scatto(salvato.zoom, 0);
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ viste: [...viste], zoom: zb, zoomMini: zm })); } catch { /* storage bloccato: vale fino a fine sessione */ } };
  for (const p of o.places) if (p.sempre) viste.add(p.id);
  const coperta = (p: MappaPlace) => !viste.has(p.id);
  const chiusa = (p: MappaPlace) => !!p.chiusa?.();
  const nascosta = (p: MappaPlace) => coperta(p) || chiusa(p);
  const firmaChiuse = () => o.places.filter(chiusa).map((p) => p.id).join(',');
  let chiuseFirma = firmaChiuse();

  // ——— base: un pixel per cella, mare aperto trasparente; le isole nascoste non si disegnano (ridisegnata quando ne scopri una) ———
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bg = base.getContext('2d')!;
  const paintBase = () => {
    const img = bg.createImageData(W, H), rgb = new Map<string, [number, number, number]>();
    const c3 = (h: string) => { let v = rgb.get(h); if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; rgb.set(h, v); } return v; };
    const via = o.places.filter(nascosta);
    const dentro = (cx: number, cz: number, p: MappaPlace, m: number) => cx >= p.x0 - m && cx < p.x0 + p.w + m && cz >= p.z0 - m && cz < p.z0 + p.h + m;
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const t = map.at(cx, cz), col = TILE_COL[t];
      if (!col) continue;
      // dentro l'isola nascosta niente; attorno (4 celle) via anche l'acqua bassa, che ne disegnerebbe la sagoma
      if (via.some((p) => dentro(cx, cz, p, 0) || ((t === ',' || t === 'B') && dentro(cx, cz, p, 4)))) continue;
      const [r, g, b] = c3(col), i = (cz * W + cx) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    bg.putImageData(img, 0, 0);
  };
  paintBase();
  /** Centro di un'isola in metri. */
  const centro = (p: MappaPlace) => ({ x: (p.x0 + p.w / 2) * T, z: (p.z0 + p.h / 2) * T });
  const dentroCoperta = (x: number, z: number) => o.places.some((p) => nascosta(p) && x >= p.x0 * T && x <= (p.x0 + p.w) * T && z >= p.z0 * T && z <= (p.z0 + p.h) * T);
  const porto = o.places.find((p) => p.id.startsWith('porto')) ?? null;
  /** Onde sul mare aperto: posti fissi (stesso seme per tutti), solo dove attorno è tutto mare. */
  const onde: { x: number; z: number }[] = [];
  {
    let h = 0x9e3779b9;
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    const mare = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && map.at(x, z) === '~';
    for (let i = 0; i < 400 && onde.length < 22; i++) {
      const x = Math.floor(rnd() * W), z = Math.floor(rnd() * H);
      if ([[0, 0], [8, 0], [-8, 0], [0, 6], [0, -6], [6, 5], [-6, -5]].every(([dx, dz]) => mare(x + dx!, z + dz!)) && onde.every((q) => Math.abs(q.x - x) + Math.abs(q.z - z) > 40)) onde.push({ x, z });
    }
  }
  /** Importanza delle categorie: dove le icone si toccano si disegna la più importante (le altre compaiono avvicinando lo zoom). */
  const PRIMA: Record<string, number> = { porto: 0, negozio: 1, missione: 2, gioco: 3, casa: 4, luogo: 5 };
  const inOrdine = [...o.targets].sort((a, b) => PRIMA[categoria(a.id, a.icon)]! - PRIMA[categoria(b.id, b.icon)]!);
  /** Disegna le mete visibili senza sovrapporle: `pos` dà il punto sullo schermo (null = fuori), `d` la distanza minima tra due icone. */
  const disegnaMete = (g: CanvasRenderingContext2D, pos: (t: MappaTarget) => { x: number; y: number; s: number } | null, d: number) => {
    const fatte: { x: number; y: number }[] = [];
    for (const t of inOrdine) {
      if (!metaVisibile(t)) continue;
      const p = pos(t);
      if (!p || fatte.some((q) => Math.abs(q.x - p.x) < d && Math.abs(q.y - p.y) < d)) continue;
      fatte.push(p); disegnaMeta(g, categoria(t.id, t.icon), p.x, p.y, p.s);
    }
  };
  const metaVisibile = (t: MappaTarget) => (t.show?.() ?? true) && !!t.icon && !t.id.startsWith('tema:') && !dentroCoperta(t.x, t.z);

  // ——— minimappa: cerchio + / − ———
  const mini = document.createElement('div'); mini.id = 'mzMini'; mini.className = 'mz';
  const cerchio = document.createElement('button'); cerchio.type = 'button'; cerchio.className = 'cerchio'; cerchio.title = 'Mappa (M)'; cerchio.setAttribute('aria-label', 'Apri la mappa');
  const mc = document.createElement('canvas'); mc.width = mc.height = 96;
  const mg = mc.getContext('2d')!;
  const nord = document.createElement('span'); nord.className = 'n'; nord.textContent = 'N';
  cerchio.append(mc, nord);
  const zMini = document.createElement('div'); zMini.className = 'zoom';
  const piu = document.createElement('button'), meno = document.createElement('button');
  piu.type = meno.type = 'button'; piu.textContent = '+'; meno.textContent = '−'; piu.dataset['z'] = '+'; meno.dataset['z'] = '-';
  piu.title = 'Avvicina'; meno.title = 'Allontana';
  zMini.append(piu, meno);
  mini.append(cerchio, zMini); guard(mini);
  const zoomMini = (n: number) => { zm = Math.max(0, Math.min(2, n)); piu.disabled = zm === 2; meno.disabled = zm === 0; save(); drawMini(last); };
  cerchio.addEventListener('click', (e) => { e.preventDefault(); cerchio.blur(); toggle(); });
  piu.addEventListener('click', (e) => { e.preventDefault(); piu.blur(); zoomMini(zm + 1); });
  meno.addEventListener('click', (e) => { e.preventDefault(); meno.blur(); zoomMini(zm - 1); });
  o.root.appendChild(mini);

  // ——— carta nautica ———
  const ov = document.createElement('div'); ov.id = 'mzMappa'; ov.className = 'mz'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Mappa dell\'arcipelago');
  ov.style.setProperty('--ar', String(W / H));
  const banner = document.createElement('div'); banner.className = 'banner'; banner.innerHTML = `${CARTIGLIO_SVG}<b>MAPPA</b>`;
  const rosa = document.createElement('div'); rosa.className = 'rosa'; rosa.innerHTML = ROSA_SVG;
  const leg = document.createElement('div'); leg.className = 'leg';
  for (const r of LEGENDA) { const s = document.createElement('span'), im = document.createElement('img'); im.alt = ''; im.src = iconaLegenda(r.cat, 28); s.append(im, r.nome); leg.appendChild(s); }
  const hd = document.createElement('div'); hd.className = 'hd';
  const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'Chiudi (Esc, M)';
  hd.appendChild(x);
  const zBox = document.createElement('div'); zBox.className = 'zoom';
  const zTit = document.createElement('b'); zTit.textContent = 'ZOOM';
  const zRow = document.createElement('div');
  const zBtn = ZOOM_ICONE.map((svg, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset['z'] = String(i); b.innerHTML = svg; b.title = ['Tutto l\'arcipelago', 'La zona', 'L\'isola'][i]!; b.addEventListener('click', () => zoomCarta(i)); zRow.appendChild(b); return b; });
  zBox.append(zTit, zRow);
  const fr = document.createElement('div'); fr.className = 'fr';
  const bc = document.createElement('canvas'); bc.width = W * 2; bc.height = H * 2;
  const big = bc.getContext('2d')!;
  fr.appendChild(bc);
  // riga in fondo: come si mette il segnalino, o dov'è e TOGLI
  const pie = document.createElement('div'); pie.className = 'pie';
  const pieIco = document.createElement('img'); pieIco.alt = '';
  { const c = document.createElement('canvas'); c.width = 40; c.height = 48; const g = c.getContext('2d'); if (g) { segnalino(g, 20, 46, 42); pieIco.src = c.toDataURL(); } }
  const pieTxt = document.createElement('span');
  const togli = document.createElement('button'); togli.type = 'button'; togli.dataset['act'] = 'togli'; togli.textContent = 'TOGLI'; togli.title = 'Togli il segnalino';
  pie.append(pieIco, pieTxt, togli);
  if (!o.segno) pie.style.display = 'none';
  ov.append(fr, banner, rosa, leg, hd, zBox, pie); guard(ov); // la tela per prima: i test la trovano con `#mzMappa canvas`
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  x.addEventListener('click', () => close());
  togli.addEventListener('click', () => { o.segno?.set(null); drawBig(); });
  o.root.appendChild(ov);

  /** Celle al centro della carta (si sposta trascinando da ingrandita). */
  const vc = { x: W / 2, z: H / 2 };
  /** Finestra della carta in celle allo scatto attuale. */
  const vista = () => {
    const f = SCATTI[zb]!, vw = W / f, vh = H / f;
    vc.x = Math.max(vw / 2, Math.min(W - vw / 2, vc.x)); vc.z = Math.max(vh / 2, Math.min(H - vh / 2, vc.z));
    return { x0: vc.x - vw / 2, z0: vc.z - vh / 2, vw, vh };
  };
  /** Metri del mondo → px CSS sulla tela (dal suo angolo in alto a sinistra). */
  const aSchermo = (wx: number, wz: number, r: { width: number; height: number }) => { const v = vista(); return { x: (wx / T - v.x0) * (r.width / v.vw), y: (wz / T - v.z0) * (r.height / v.vh) }; };
  const latoMeta = () => (zb === 0 ? 22 : 26);
  /** Il segnalino agganciato a una meta sta sopra la sua icona (la punta sul bordo alto), libero con la punta sul punto. */
  const puntaSegno = (s: { x: number; z: number; su?: string }, r: { width: number; height: number }) => { const p = aSchermo(s.x, s.z, r); return { x: p.x, y: p.y - (s.su ? latoMeta() / 2 : 0) }; };

  function zoomCarta(n: number): void {
    n = Math.max(0, Math.min(2, n));
    if (n > 0 && zb === 0) { vc.x = last.x / T; vc.z = last.z / T; } // da tutto l'arcipelago si entra dove sei
    zb = n; for (const [i, b] of zBtn.entries()) b.classList.toggle('on', i === zb);
    save(); if (open) drawBig();
  }
  // tocco sulla carta: sul segnalino lo togli, sull'icona di una meta il segnalino si aggancia a lei, altrove lo metti lì; trascinando si sposta
  let giu: { x: number; y: number; cx: number; cz: number; id: number } | null = null, trascinato = false;
  bc.addEventListener('pointerdown', (e) => { giu = { x: e.clientX, y: e.clientY, cx: vc.x, cz: vc.z, id: e.pointerId }; trascinato = false; });
  bc.addEventListener('pointermove', (e) => {
    if (!giu || e.pointerId !== giu.id || zb === 0) return;
    const dx = e.clientX - giu.x, dy = e.clientY - giu.y;
    if (!trascinato && Math.hypot(dx, dy) < TRASCINA) return;
    if (!trascinato) { trascinato = true; try { bc.setPointerCapture(e.pointerId); } catch { /* già rilasciato */ } }
    const r = bc.getBoundingClientRect(), v = vista();
    if (!r.width) return;
    vc.x = giu.cx - (dx * v.vw) / r.width; vc.z = giu.cz - (dy * v.vh) / r.height; drawBig();
  });
  const su = () => { giu = null; };
  bc.addEventListener('pointerup', su); bc.addEventListener('pointercancel', su);
  bc.addEventListener('wheel', (e) => { e.preventDefault(); zoomCarta(zb + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
  bc.addEventListener('click', (e) => {
    if (trascinato) { trascinato = false; return; }
    const sg = o.segno;
    if (!sg) return;
    const r = bc.getBoundingClientRect();
    if (!r.width) return;
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const cur = sg.get();
    if (cur) { const p = puntaSegno(cur, r); if (Math.hypot(cx - p.x, cy - (p.y - 16)) < TOCCO_SEGNO) { sg.set(null); drawBig(); return; } }
    let meta: MappaTarget | null = null, best = TOCCO_META;
    for (const t of o.targets) {
      if (!metaVisibile(t)) continue;
      const p = aSchermo(t.x, t.z, r), d = Math.hypot(cx - p.x, cy - p.y);
      if (d < best) { best = d; meta = t; }
    }
    const v = vista();
    sg.set(meta ? { x: meta.x, z: meta.z, su: meta.id, nome: meta.label } : { x: (v.x0 + (cx * v.vw) / r.width) * T, z: (v.z0 + (cy * v.vh) / r.height) * T });
    drawBig();
  });
  let open = false, last: Pose = { x: 0, z: 0, yaw: 0 }, lastPeers: readonly { nome?: string; x: number; z: number }[] = [];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.code === 'KeyM') { e.preventDefault(); close(); }
    else if (e.key === '+' || e.key === '=') zoomCarta(zb + 1);
    else if (e.key === '-' || e.key === '_') zoomCarta(zb - 1);
    e.stopPropagation(); // con la mappa aperta i tasti non arrivano al gioco
  };
  function show(): void {
    if (open || o.hidden?.()) return;
    open = true; ov.classList.add('on'); addEventListener('keydown', onKey, true);
    if (zb > 0) { vc.x = last.x / T; vc.z = last.z / T; }
    drawBig();
  }
  function close(): void { if (!open) return; open = false; ov.classList.remove('on'); removeEventListener('keydown', onKey, true); }
  function toggle(): void { if (open) close(); else show(); }

  let pieFor = '';
  /** Riga in fondo: senza segnalino come si mette, con il segnalino nome, distanza e TOGLI. */
  const paintPie = () => {
    const sg = o.segno?.get() ?? null;
    const t = sg ? `${sg.nome ?? 'Segnalino'} · ${Math.round(Math.hypot(sg.x - last.x, sg.z - last.z))} m` : 'Tocca la mappa: il navigatore ti ci porta';
    if (t === pieFor) return;
    pieFor = t; pieTxt.textContent = t;
    pieIco.style.display = togli.style.display = sg ? '' : 'none';
  };

  function drawBig(): void {
    const r = bc.getBoundingClientRect();
    if (!r.width) return;
    const dpr = dprDi(), cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (bc.width !== cw || bc.height !== ch) { bc.width = cw; bc.height = ch; }
    const v = vista(), kx = cw / v.vw, ky = ch / v.vh, g = big;
    const at = (wx: number, wz: number) => ({ x: (wx / T - v.x0) * kx, y: (wz / T - v.z0) * ky });
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = COL.mare; g.fillRect(0, 0, cw, ch);
    // griglia del mare
    g.strokeStyle = COL.griglia; g.lineWidth = Math.max(1, dpr * 1.2); g.beginPath();
    for (let gx = Math.ceil(v.x0 / GRIGLIA) * GRIGLIA; gx < v.x0 + v.vw; gx += GRIGLIA) { const X = Math.round((gx - v.x0) * kx) + 0.5; g.moveTo(X, 0); g.lineTo(X, ch); }
    for (let gz = Math.ceil(v.z0 / GRIGLIA) * GRIGLIA; gz < v.z0 + v.vh; gz += GRIGLIA) { const Y = Math.round((gz - v.z0) * ky) + 0.5; g.moveTo(0, Y); g.lineTo(cw, Y); }
    g.stroke();
    const u = 6 * dpr * (zb === 0 ? 1 : 1.3);
    for (const w of onde) { const p = { x: (w.x - v.x0) * kx, y: (w.z - v.z0) * ky }; if (p.x > -30 && p.y > -30 && p.x < cw + 30 && p.y < ch + 30) onda(g, p.x, p.y, u); }
    // rotte tratteggiate dal Porto alle isole che conosci (sotto le isole)
    if (porto) {
      const a = at(centro(porto).x, centro(porto).z);
      g.save(); g.setLineDash([7 * dpr, 7 * dpr]); g.strokeStyle = COL.rotta; g.lineWidth = 2.2 * dpr; g.lineCap = 'round';
      for (const p of o.places) { if (p === porto || nascosta(p)) continue; const b = at(centro(p).x, centro(p).z); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      g.restore();
    }
    g.drawImage(base, v.x0, v.z0, v.vw, v.vh, 0, 0, cw, ch);
    // nomi delle isole che conosci, sotto l'isola
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round';
    const fs = Math.round((zb === 0 ? 11 : 14) * dpr);
    g.font = `${fs}px ${TITAN}`; g.lineWidth = fs * 0.32; g.strokeStyle = COL.notte; g.fillStyle = COL.crema;
    for (const p of o.places) {
      if (nascosta(p) || !p.nome) continue;
      const c = at(centro(p).x, (p.z0 + p.h) * T);
      if (c.x < -80 || c.x > cw + 80 || c.y < -20 || c.y > ch + 20) continue;
      g.strokeText(p.nome, c.x, c.y + 2 * dpr); g.fillText(p.nome, c.x, c.y + 2 * dpr);
    }
    const lato = latoMeta() * dpr, sg = o.segno?.get() ?? null;
    const punta = sg ? (() => { const p = at(sg.x, sg.z); return { x: p.x, y: p.y - (sg.su ? lato / 2 : 0) }; })() : null;
    const me = at(last.x, last.z);
    if (punta) { // scia di puntini da te al segnalino, in linea d'aria (sotto le icone)
      const n = Math.floor(Math.hypot(punta.x - me.x, punta.y - me.y) / (14 * dpr));
      for (let i = 2; i < n; i++) tondo(g, me.x + ((punta.x - me.x) * i) / n, me.y + ((punta.y - me.y) * i) / n, 3.2 * dpr);
    }
    disegnaMete(g, (t) => { const p = at(t.x, t.z); return p.x < -lato || p.y < -lato || p.x > cw + lato || p.y > ch + lato ? null : { ...p, s: lato }; }, lato * 0.85);
    if (punta) segnalino(g, punta.x, punta.y, 30 * dpr);
    paintPie();
    g.font = `${Math.round(12 * dpr)}px ${TITAN}`; g.textBaseline = 'bottom'; g.lineWidth = 4 * dpr;
    for (const pe of lastPeers) { const p = at(pe.x, pe.z); tondo(g, p.x, p.y, 6 * dpr); if (pe.nome) { g.strokeText(pe.nome, p.x, p.y - 8 * dpr); g.fillText(pe.nome, p.x, p.y - 8 * dpr); } }
    freccia(g, me.x, me.y, last.yaw, 13 * dpr);
  }

  function drawMini(me: Pose): void {
    const css = mc.clientWidth;
    if (!css) return;
    const dpr = dprDi(), R = Math.round(css * dpr);
    if (mc.width !== R) { mc.width = mc.height = R; }
    const s = R / ((RAGGI[zm]! * 2) / T), g = mg; // pixel per cella; nord sempre in alto
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = COL.mareMini; g.fillRect(0, 0, R, R);
    g.setTransform(s, 0, 0, s, R / 2 - (me.x / T) * s, R / 2 - (me.z / T) * s);
    g.drawImage(base, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toMini = (wx: number, wz: number) => ({ x: R / 2 + ((wx - me.x) / T) * s, y: R / 2 + ((wz - me.z) / T) * s });
    const b = Math.max(11 * dpr, R * 0.13), maxD = R / 2 - b * 0.62;
    const sulBordo = (p: { x: number; y: number }) => { const d = Math.hypot(p.x - R / 2, p.y - R / 2), k = d > maxD ? maxD / d : 1; return { x: R / 2 + (p.x - R / 2) * k, y: R / 2 + (p.y - R / 2) * k, fuori: k < 1 }; };
    disegnaMete(g, (t) => { const p = sulBordo(toMini(t.x, t.z)); return { x: p.x, y: p.y, s: p.fuori ? b * 0.8 : b }; }, b * 0.8);
    const sg = o.segno?.get();
    if (sg) { const p = sulBordo(toMini(sg.x, sg.z)); segnalino(g, p.x, p.y + b * 0.4, b * 1.1); } // sopra le mete; lontano: sul bordo
    for (const pe of lastPeers) { const p = toMini(pe.x, pe.z); if (Math.hypot(p.x - R / 2, p.y - R / 2) < R / 2 - 4 * dpr) tondo(g, p.x, p.y, 3.5 * dpr); }
    freccia(g, R / 2, R / 2, me.yaw, Math.max(7 * dpr, R * 0.07));
  }

  let nextScopri = 0, nextMini = 0;
  zoomMini(zm); zoomCarta(zb);
  registerStateProvider('mappa', () => ({ open, viste: [...viste], coperte: o.places.filter(coperta).map((p) => p.id), chiuse: o.places.filter(chiusa).map((p) => p.id), mini: mini.style.visibility !== 'hidden' && getComputedStyle(mini).visibility !== 'hidden', zoom: zb, zoomMini: zm }));
  /** Test (#144): dove sta sullo schermo il punto (x, z) del mondo nella mappa grande aperta (per toccarlo). */
  registerTestHook('mappaSchermo', (wx, wz) => { const r = bc.getBoundingClientRect(), p = aSchermo(Number(wx), Number(wz), r); return { x: r.left + p.x, y: r.top + p.y }; });
  registerTestHook('mappa', (v) => { if (v === 'apri') show(); else if (v === 'chiudi') close(); else toggle(); return open; });
  registerTestHook('mappaZoom', (v, mini2) => { if (mini2) zoomMini(Number(v)); else zoomCarta(Number(v)); return { zoom: zb, zoomMini: zm }; });
  registerTestHook('mappaScopri', (id) => { if (typeof id === 'string') viste.add(id); else for (const p of o.places) viste.add(p.id); save(); paintBase(); if (open) drawBig(); });

  return {
    update(me, _cameraYaw, peers) { // nord sempre in alto: la camera non gira più la minimappa (VISIONE §1)
      last = me; lastPeers = peers;
      const now = performance.now();
      if (now >= nextScopri) { // ogni ½ s: isole vicine scoperte
        nextScopri = now + 500;
        let nuove = false;
        for (const p of o.places) {
          if (!coperta(p)) continue;
          const dx = Math.max(p.x0 * T - me.x, 0, me.x - (p.x0 + p.w) * T), dz = Math.max(p.z0 * T - me.z, 0, me.z - (p.z0 + p.h) * T);
          if (Math.hypot(dx, dz) < SCOPRI_M) { viste.add(p.id); nuove = true; }
        }
        if (nuove) save();
        const f = firmaChiuse(); // un'isola a tema appena sbloccata: compare
        if (nuove || f !== chiuseFirma) { chiuseFirma = f; paintBase(); }
      }
      if (open && o.hidden?.()) close();
      if (now >= nextMini) { nextMini = now + 66; drawMini(me); if (open) drawBig(); } // 15 volte al secondo bastano
    },
    toggle, close, isOpen: () => open,
    vista: (id) => viste.has(id),
    evidenzia(on) { mini.classList.toggle('qui', on); },
  };
}
