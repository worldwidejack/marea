// Prima persona: la mappa del dungeon con la nebbia (docs/PRIMA_PERSONA.md §7). In alto a sinistra una minimappa piccola (nord in alto, gira
// solo la freccia che sei tu) o, a scelta, un pulsante; un tocco (o M) apre la mappa grande, che da soli ferma la partita, e lì si decide
// cosa lasciare sullo schermo da chiusa: la minimappa o il solo pulsante (la scelta resta su questo dispositivo). La nebbia: si scopre solo
// quello che si vede, a 360° fino a VISTA celle e fermato dai muri; il resto resta buio. Quello che vedi adesso è più chiaro di quello che
// ricordi; scala e lanterne compaiono solo dopo averle viste, i nemici solo se li vedi ora, i compagni sempre. A ogni discesa si riparte
// dal buio. Disegno a pixel su <canvas>, solo colori di palette.
import type { DMap } from '@marea/sim/dungeon/map.ts';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { CORNICE_LIBRO, FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';
import { PAL, el } from '../ui/style.ts';
import { registraFinestra } from './panels.ts';

/** Fin dove vedi, e quindi scopri (celle); raggi lanciati attorno a te; celle in larghezza della minimappa; dove si ricorda la scelta. */
const VISTA = 8, RAGGI = 180, N_MINI = 15, STORE = 'marea:dungeon:mappa';
type Modo = 'mini' | 'pulsante';
/** Per ogni tipo di cella [ricordata, in vista]. La nebbia è il buio; `vuoto` = dove non si cammina e non si vede un muro (roccia, buchi, bracieri). */
const COL = { nebbia: PAL.neroCaldo, pavimento: [PAL.sabbia, PAL.sabbiaChiara], muro: [PAL.legnoScuro, PAL.legno], vuoto: [PAL.neroCaldo, PAL.ombraCalda] } as const;
const SEGNI = { scala: PAL.giallo, lanterna: PAL.acquaBassa, accesa: PAL.arancio, amico: PAL.viola, nemico: PAL.rosso, tu: PAL.erbaScura } as const;
/** Il pulsante: una mappa piegata in tre, col sentiero e la croce (K contorno, P carta, S carta in ombra, B sentiero, R croce). */
const ICONA = ['KKKKKKKKKKKKKKKK', 'KPPPPKSSSSKPPPPK', 'KPPBPKSSBSKPRPRK', 'KPPPBKSBSSKPPRPK', 'KPPPPBBSSSKPRPRK', 'KPPPPKSSSSKPPPPK', 'KPPPPKSSSSKPPPPK', 'KKKKKKKKKKKKKKKK'];
const ICONA_COL: Record<string, string> = { K: L.inchiostro, P: L.cartaChiara, S: L.cartaScura, B: L.acquaScura, R: L.rosso };
const ICONA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8" width="32" height="16" shape-rendering="crispEdges" style="display:block">${
  ICONA.map((r, y) => [...r].map((c, x) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${ICONA_COL[c]}"/>`).join('')).join('')}</svg>`;
const CSS = `
.mz-fp-mini, .mz-fp-pul { position: absolute; left: max(8px, env(safe-area-inset-left, 0px)); top: max(8px, env(safe-area-inset-top)); z-index: 13; margin: 0; padding: 0; display: none;
  background: ${L.cartaChiara}; cursor: pointer; touch-action: none; -webkit-tap-highlight-color: transparent; ${CORNICE_LIBRO(2)} }
.mz-fp-mini.on { display: block; } .mz-fp-pul.on { display: flex; align-items: center; justify-content: center; width: 48px; height: 44px; }
.mz-fp-mini:active, .mz-fp-pul:active { transform: translateY(2px); }
.mz-fp-mini canvas { display: block; image-rendering: pixelated; }
.mz-fp-mini i { position: absolute; right: 3px; bottom: 1px; font: 700 11px ${FONT_LIBRO}; font-style: normal; color: ${L.cartaChiara}; text-shadow: 1px 1px 0 ${L.inchiostro}, -1px 1px 0 ${L.inchiostro}; pointer-events: none; }
.mz-fp-mapp { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(720px, calc(100% - 24px)); height: min(calc(100% - 24px), 440px); display: none; box-sizing: border-box;
  background: ${L.carta}; color: ${L.inchiostro}; font: 600 15px ${FONT_LIBRO}; ${CORNICE_LIBRO(3)} z-index: 30; }
.mz-fp-mapp.on { display: flex; }
.mz-fp-mapp .tela { flex: 1; min-width: 0; margin: 6px; background: ${PAL.neroCaldo}; box-shadow: 0 0 0 2px ${L.inchiostro}; }
.mz-fp-mapp canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.mz-fp-mapp .lato { flex: none; width: 168px; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 6px 8px 8px 2px; }
.mz-fp-mapp .testa { display: flex; align-items: center; justify-content: space-between; } .mz-fp-mapp .testa b { font-size: 21px; color: ${L.rossoScuro}; }
.mz-fp-mapp button { min-height: 44px; border: 0; padding: 0 8px; font: 700 15px ${FONT_LIBRO}; color: ${L.inchiostro}; background: ${L.cartaChiara}; cursor: pointer; ${CORNICE_LIBRO(2)} }
.mz-fp-mapp button:focus-visible { outline: 3px solid ${L.acqua}; outline-offset: 2px; }
.mz-fp-mapp .x { min-width: 44px; font-size: 22px; line-height: 1; }
.mz-fp-mapp .leg { display: flex; flex-direction: column; gap: 3px; font-size: 14px; color: ${L.inchiostro2}; }
.mz-fp-mapp .leg span::before { content: ''; display: inline-block; width: 10px; height: 10px; margin-right: 7px; background: var(--c); box-shadow: 0 0 0 1px ${L.inchiostro}; }
.mz-fp-mapp .scelta { margin-top: auto; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: ${L.inchiostro2}; }
.mz-fp-mapp .scelta button.sel { background: ${L.oroChiaro}; }
@media (max-width: 560px) { .mz-fp-mapp .lato { width: 132px; } .mz-fp-mapp .leg { font-size: 12px; } }
`;

const leggi = (): Modo => { try { return localStorage.getItem(STORE) === 'pulsante' ? 'pulsante' : 'mini'; } catch { return 'mini'; } };
const scrivi = (m: Modo) => { try { localStorage.setItem(STORE, m); } catch { /* storage bloccato: vale fino a fine discesa */ } };
const dprOf = () => Math.max(1, Math.min(3, Math.round(devicePixelRatio || 1)));
const blocca = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); }; // il joystick e la visuale nascono sul canvas

export function creaMappaFp(o: { root: HTMLElement; map: DMap; tocco: boolean; attivo(): boolean }): { update(v: DungeonView, yaw: number): void; readonly aperta: boolean; dispose(): void } {
  if (!document.getElementById('mz-fp-mappa')) { const st = document.createElement('style'); st.id = 'mz-fp-mappa'; st.textContent = CSS; document.head.appendChild(st); }
  const { map } = o, W = map.w, H = map.h, T = map.tile, cella = o.tocco ? 6 : 8;
  const visto = new Uint8Array(W * H), ora = new Uint8Array(W * H);
  let modo = leggi(), aperta = false, tx = 0, tz = 0, yaw = 0, rivelato = -1e9, ultima: DungeonView | null = null;
  const dentro = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < W && cz < H;
  const cellaDi = (x: number, z: number) => Math.floor(z / T) * W + Math.floor(x / T);

  // ——— la mappa di base: un pixel per cella, nebbia dove non hai visto ———
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bg = base.getContext('2d')!, img = bg.createImageData(W, H);
  const rgb = new Map<string, [number, number, number]>();
  const c3 = (h: string) => { let v = rgb.get(h); if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; rgb.set(h, v); } return v; };
  const paintBase = () => {
    for (let i = 0; i < W * H; i++) {
      const k = ora[i] ? 1 : 0, hex = !visto[i] ? COL.nebbia : map.opaque[i] ? COL.muro[k] : map.solid[i] ? COL.vuoto[k] : COL.pavimento[k], [r, g, b] = c3(hex), j = i * 4;
      img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b; img.data[j + 3] = 255;
    }
    bg.putImageData(img, 0, 0);
  };
  /** Cosa vedi da (x, z): raggi tutto attorno, ognuno si ferma sul primo muro (che si vede anche lui). */
  const rivela = (x: number, z: number) => {
    ora.fill(0);
    const hx = x / T, hz = z / T, cx0 = Math.floor(hx), cz0 = Math.floor(hz);
    if (dentro(cx0, cz0)) ora[cz0 * W + cx0] = visto[cz0 * W + cx0] = 1;
    for (let n = 0; n < RAGGI; n++) {
      const a = (n * 2 * Math.PI) / RAGGI, dx = Math.cos(a), dz = Math.sin(a), sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const ax = dx !== 0 ? Math.abs(1 / dx) : Infinity, az = dz !== 0 ? Math.abs(1 / dz) : Infinity;
      let cx = cx0, cz = cz0, mx = dx !== 0 ? (sx > 0 ? cx + 1 - hx : hx - cx) * ax : Infinity, mz = dz !== 0 ? (sz > 0 ? cz + 1 - hz : hz - cz) * az : Infinity;
      for (;;) {
        if (mx < mz) { if (mx > VISTA) break; cx += sx; mx += ax; } else { if (mz > VISTA) break; cz += sz; mz += az; }
        if (!dentro(cx, cz)) break;
        const i = cz * W + cx;
        ora[i] = visto[i] = 1;
        if (map.opaque[i]) break;
      }
    }
    paintBase();
  };

  // ——— il disegno, uguale per la minimappa e per la mappa grande: `k` px per cella, `ox, oy` = dove cade la cella (0, 0) ———
  const quadro = (g: CanvasRenderingContext2D, x: number, y: number, n: number, s: number, col: string) => {
    const w = n * s, x0 = Math.round(x - w / 2), y0 = Math.round(y - w / 2);
    g.fillStyle = PAL.neroCaldo; g.fillRect(x0 - s, y0 - s, w + 2 * s, w + 2 * s);
    g.fillStyle = col; g.fillRect(x0, y0, w, w);
  };
  /** Sei tu: un triangolo a pixel che punta dove guardi, col contorno. */
  const freccia = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), px = -fz, pz = fx; // dove guardi sulla mappa (x a destra, z in giù) e il suo perpendicolare
    const P = [[fx * 4.4, fz * 4.4], [-fx * 2.6 + px * 3, -fz * 2.6 + pz * 3], [-fx * 2.6 - px * 3, -fz * 2.6 - pz * 3]] as const;
    const lato = (a: readonly number[], b: readonly number[], i: number, j: number) => (b[0]! - a[0]!) * (j - a[1]!) - (b[1]! - a[1]!) * (i - a[0]!);
    const pieno: [number, number][] = [];
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const d0 = lato(P[0], P[1], i, j), d1 = lato(P[1], P[2], i, j), d2 = lato(P[2], P[0], i, j);
      if ((d0 >= 0 && d1 >= 0 && d2 >= 0) || (d0 <= 0 && d1 <= 0 && d2 <= 0)) pieno.push([i, j]);
    }
    const x0 = Math.round(x - s / 2), y0 = Math.round(y - s / 2);
    g.fillStyle = PAL.neroCaldo;
    for (const [i, j] of pieno) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) g.fillRect(x0 + (i + a) * s, y0 + (j + b) * s, s, s);
    g.fillStyle = SEGNI.tu;
    for (const [i, j] of pieno) g.fillRect(x0 + i * s, y0 + j * s, s, s);
  };
  const disegna = (g: CanvasRenderingContext2D, ox: number, oy: number, k: number, cw: number, ch: number) => {
    const s = Math.max(2, Math.floor(k / 3)), v = ultima;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = COL.nebbia; g.fillRect(0, 0, cw, ch);
    g.drawImage(base, ox, oy, W * k, H * k);
    const dove = (x: number, z: number) => ({ x: ox + (x / T) * k, y: oy + (z / T) * k });
    if (v) {
      if (visto[cellaDi(v.uscita.x, v.uscita.z)]) { const p = dove(v.uscita.x, v.uscita.z); quadro(g, p.x, p.y, 3, s, SEGNI.scala); }
      for (const a of v.altari) if (visto[cellaDi(a.x, a.z)]) { const p = dove(a.x, a.z); quadro(g, p.x, p.y, 2, s, a.attivo ? SEGNI.accesa : SEGNI.lanterna); }
      for (const c of v.compagni) if (!c.done) { const p = dove(c.x, c.z); quadro(g, p.x, p.y, 2, s, SEGNI.amico); }
      for (const e of v.nemici) {
        if (e.alleato || e.anim === 'morto' || e.invisibile || !ora[cellaDi(e.x, e.z)]) continue;
        const p = dove(e.x, e.z); quadro(g, p.x, p.y, e.capo ? 3 : 2, s, SEGNI.nemico);
      }
    }
    const io = dove(tx, tz); freccia(g, io.x, io.y, s);
  };

  // ——— la minimappa e il pulsante ———
  const R = N_MINI * cella;
  const mini = el('button', 'mz mz-fp-mini'), cm = document.createElement('canvas'), gm = cm.getContext('2d')!; cm.width = cm.height = R;
  mini.type = 'button'; mini.dataset['act'] = 'mappa'; mini.title = o.tocco ? 'Mappa' : 'Mappa (M)'; mini.setAttribute('aria-label', 'Apri la mappa');
  mini.appendChild(cm); if (!o.tocco) mini.appendChild(el('i', '', 'M'));
  const pul = el('button', 'mz mz-fp-pul'); pul.type = 'button'; pul.dataset['act'] = 'mappa'; pul.title = o.tocco ? 'Mappa' : 'Mappa (M)'; pul.setAttribute('aria-label', 'Apri la mappa'); pul.innerHTML = ICONA_SVG; // SVG statico
  const disegnaMini = () => disegna(gm, Math.round(R / 2 - (tx / T) * cella), Math.round(R / 2 - (tz / T) * cella), cella, R, R);

  // ——— la mappa grande ———
  const ov = el('div', 'mz mz-fp-mapp'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Mappa del dungeon');
  const tela = el('div', 'tela'), cb = document.createElement('canvas'), gb = cb.getContext('2d')!; tela.appendChild(cb);
  const lato = el('div', 'lato'), testa = el('div', 'testa'), x = el('button', 'x', '×'); x.type = 'button'; x.title = 'Chiudi'; x.dataset['padBack'] = '';
  testa.append(el('b', '', 'Mappa'), x);
  const leg = el('div', 'leg');
  for (const [nome, col] of [['Tu', SEGNI.tu], ['Scala', SEGNI.scala], ['Lanterna', SEGNI.lanterna], ['Compagno', SEGNI.amico], ['Nemico', SEGNI.nemico]] as const) { const s = el('span', '', nome); s.style.setProperty('--c', col); leg.appendChild(s); }
  const scelta = el('div', 'scelta'), bMini = el('button', '', 'Minimappa'), bPul = el('button', '', 'Pulsante');
  bMini.type = bPul.type = 'button'; bMini.dataset['modo'] = 'mini'; bPul.dataset['modo'] = 'pulsante';
  scelta.append(el('span', '', 'Da chiusa lascia:'), bMini, bPul);
  lato.append(testa, leg, scelta); ov.append(tela, lato);
  o.root.append(mini, pul, ov);
  for (const e of [mini, pul, ov]) blocca(e);

  const mostra = () => {
    mini.classList.toggle('on', modo === 'mini' && !aperta); pul.classList.toggle('on', modo === 'pulsante' && !aperta);
    bMini.classList.toggle('sel', modo === 'mini'); bPul.classList.toggle('sel', modo === 'pulsante');
    bMini.setAttribute('aria-pressed', String(modo === 'mini')); bPul.setAttribute('aria-pressed', String(modo === 'pulsante'));
  };
  const disegnaGrande = () => {
    const d = dprOf(), cw = Math.max(1, Math.round(tela.clientWidth * d)), ch = Math.max(1, Math.round(tela.clientHeight * d));
    if (cb.width !== cw || cb.height !== ch) { cb.width = cw; cb.height = ch; }
    const k = Math.max(1, Math.floor(Math.min(cw / W, ch / H)));
    disegna(gb, Math.floor((cw - W * k) / 2), Math.floor((ch - H * k) / 2), k, cw, ch);
  };
  const apri = () => { if (aperta) return; aperta = true; ov.classList.add('on'); mostra(); disegnaGrande(); };
  const chiudi = () => { if (!aperta) return; aperta = false; ov.classList.remove('on'); mostra(); };
  const scegli = (m: Modo) => { modo = m; scrivi(m); chiudi(); };
  const togli = registraFinestra(() => aperta);
  const dalGioco = () => { if (o.attivo()) apri(); };
  mini.addEventListener('click', dalGioco); pul.addEventListener('click', dalGioco);
  x.addEventListener('click', chiudi); bMini.addEventListener('click', () => scegli('mini')); bPul.addEventListener('click', () => scegli('pulsante'));
  /** M apre e chiude; Esc chiude. Con la mappa aperta i tasti sono tutti suoi (la partita è ferma). */
  const tasti = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'Escape' && aperta) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) chiudi(); return; }
    if (e.code !== 'KeyM') return;
    if (aperta) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) chiudi(); } else if (o.attivo()) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) apri(); }
  };
  addEventListener('keydown', tasti, true);
  mostra();

  const togliStato = registerStateProvider('mappaFp', () => ({
    modo, aperta, minimappa: mini.classList.contains('on'), pulsante: pul.classList.contains('on'), viste: map.floor.filter((i) => visto[i]).length, pavimento: map.floor.length,
    ora: ora.reduce((n, c) => n + c, 0), uscitaVista: visto[cellaDi(map.exit.x, map.exit.z)] === 1,
  }));
  registerTestHook('dungeonMappa', (cosa) => {
    if (cosa === 'apri') apri(); else if (cosa === 'chiudi') chiudi(); else if (cosa === 'mini' || cosa === 'pulsante') scegli(cosa);
    else if (cosa === 'tutto') { visto.fill(1); paintBase(); }
    return { aperta, modo };
  });

  return {
    get aperta() { return aperta; },
    update(v, ya) {
      ultima = v; yaw = ya; tx = v.hero.x; tz = v.hero.z;
      const now = performance.now();
      if (now - rivelato >= 100) { rivelato = now; rivela(tx, tz); }
      if (aperta) disegnaGrande(); else if (modo === 'mini') disegnaMini();
    },
    dispose() {
      removeEventListener('keydown', tasti, true); togli(); togliStato();
      for (const e of [mini, pul, ov]) e.remove();
    },
  };
}
