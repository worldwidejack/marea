// Minimappa e mappa grande (#62, rifatte con #360). Un cerchio in alto a destra (telefono) o in basso a destra sopra il bottone A (PC)
// con l'arcipelago attorno a te e il nord sempre in alto: gira solo la freccia (te). Zoom a scatti: rotella sul cerchio, + e − da
// tastiera, bottoni + e −. Toccandolo o con M si apre la mappa intera: nord in alto, zoom a scatti (rotella sul punto, + e −, pizzico,
// bottoni), trascinando la sposti; ci sono te, gli amici, le mete con le loro icone (se due si coprono resta la più importante, l'altra
// compare avvicinando lo zoom) e i nomi delle isole. Quanti scatti, dove stanno i bottoni e com'è un'icona dipende dalla variante
// (ui/mappa_stile.ts: 1 di serie, 2 con ?mappa=2, da far scegliere a Jack).
// Le isole non ancora scoperte (ci passi vicino in barca; le scoperte restano su questo dispositivo, localStorage) e le isole a tema
// chiuse (#68: Tempesta, Ghiacci, Vulcano, Giardino, Adrenalina) non si vedono proprio: al loro posto il mare. Porto e la tua isola si
// vedono da subito. Disegno su <canvas> a pixel con la palette: la base ha un pixel per cella della mappa.
// Segnalino del navigatore (#144, ui/segno.ts): un tocco sulla mappa grande lo mette lì (sull'icona di una meta, si aggancia a lei), un tocco
// sul segnalino o TOGLI nella riga in fondo lo tolgono. In mappa una scia di puntini va da te al segnalino; nella minimappa sta sul bordo se è lontano.
import type { GridMap, Tile } from '@marea/sim';
import { drawPix, pixIcon } from './icons.ts';
import type { PixId } from './icons.ts';
import { DENSITA_MAX, GLIFO, MAPPA_CSS, TIPO_ORDINE, VARIANTI, freccia, punto, rotella, scattoVicino, scritta, scritte, sfoltisci, spriteMeta, tipoDi, zoomTasto } from './mappa_stile.ts';
import type { Disegnata, Variante } from './mappa_stile.ts';
import type { Segno } from './segno.ts';
import { PAL } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const P = PAL;
const STORE = 'marea:mappa';
/** Distanza (m) dal bordo di un'isola entro cui la scopri. */
const SCOPRI_M = 55;
/** Tocco sulla mappa grande (px CSS): entro questo raggio dal segnalino lo togli, dall'icona di una meta il segnalino si aggancia a lei. */
const TOCCO_SEGNO = 22, TOCCO_META = 18;
/** Oltre questi px CSS il dito o il mouse trascina la mappa invece di toccarla. */
const TRASCINA = 8;
/** Pizzico: ogni volta che la distanza tra le dita cambia di questo fattore, uno scatto. */
const PIZZICO = 1.35;
const MARE = P.acquaProfonda;
const TILE_COL: Record<Tile, string> = {
  '~': MARE, ',': P.acqua, B: P.acqua, '.': P.sabbia, P: P.sabbia, L: P.sabbia, g: P.erba, r: P.roccia, d: P.legno,
};

/** `chiusa`: letto ogni ½ s; true = non si vede anche se scoperta (isole a tema non ancora sbloccate). */
export type MappaPlace = { id: string; nome: string; x0: number; z0: number; w: number; h: number; sempre?: boolean; chiusa?(): boolean };
/** `group`: 'dungeon' per gli ingressi dei dungeon (colore e precedenza dell'icona, ui/mappa_stile.ts). */
export type MappaTarget = { id: string; label: string; x: number; z: number; icon?: PixId; show?(): boolean; group?: string };
export type Pose = { x: number; z: number; yaw: number };
export type Minimappa = { update(me: Pose, peers: readonly { nome?: string; x: number; z: number }[]): void; toggle(): void; close(): void; isOpen(): boolean;
  /** Uno scatto di zoom (+1 più vicino, −1 più lontano): la mappa grande se è aperta, se no la minimappa (tasti + e −). */
  zoom(passi: number): void;
  /** L'isola `id` (MappaPlace.id) è già stata scoperta (ci sei passato vicino)? La bussola mostra le isole a tema solo da scoperte. */
  vista(id: string): boolean;
  /** Bordo giallo che lampeggia sul cerchio (la guida «Primi passi» dice di toccarlo). */
  evidenzia(on: boolean): void };


type Saved = { viste?: string[]; raggio?: number; zoom?: number }; // zoom: a che punto degli scatti della mappa grande (0 = tutta, 1 = il più vicino)
const load = (): Saved => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const guard = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart', 'wheel']) e.addEventListener(ev, (x) => x.stopPropagation()); };
const dprOf = () => Math.max(1, Math.min(3, Math.round(devicePixelRatio || 1)));
let telefono: MediaQueryList | null = null;
/** Schermo stretto (telefono in verticale): icone e scritte un po' più piccole, la mappa grande si apre già a 2×. */
const stretto = () => (telefono ??= matchMedia('(max-width: 699px)')).matches;

export function createMinimappa(o: {
  root: HTMLElement; map: GridMap; places: MappaPlace[]; targets: MappaTarget[];
  /** Pannelli aperti, gara, dungeon: la mappa grande non si apre (e si chiude se era aperta). */
  hidden?(): boolean;
  /** Segnalino del navigatore (#144): senza, la mappa non si tocca. */
  segno?: Segno;
}): Minimappa {
  if (!document.getElementById('mz-mini-style')) { const st = document.createElement('style'); st.id = 'mz-mini-style'; st.textContent = MAPPA_CSS; document.head.appendChild(st); }
  const { map } = o, T = map.tile, W = map.w, H = map.h;
  const saved = load();
  let V: Variante = VARIANTI[new URLSearchParams(location.search).get('mappa') === '2' ? '2' : '1'];
  const viste = new Set(saved.viste ?? []);
  for (const p of o.places) if (p.sempre) viste.add(p.id);
  /** Scatti: `zm` nei raggi della minimappa (0 = il più vicino), `zg` nella mappa grande (0 = l'arcipelago intero; al telefono si apre a metà). */
  const scattoGrande = (t: number) => Math.round(Math.max(0, Math.min(1, t)) * (V.scatti - 1)), tGrande = () => zg / (V.scatti - 1);
  let zm = scattoVicino(V.raggi, saved.raggio ?? 100), zg = scattoGrande(saved.zoom ?? (stretto() ? 0.5 : 0));
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ viste: [...viste], raggio: V.raggi[zm], zoom: tGrande() })); } catch { /* storage bloccato: vale fino a fine sessione */ } };
  const coperta = (p: MappaPlace) => !viste.has(p.id), chiusa = (p: MappaPlace) => !!p.chiusa?.(), nascosta = (p: MappaPlace) => coperta(p) || chiusa(p);
  const firmaChiuse = () => o.places.filter(chiusa).map((p) => p.id).join(','); let chiuseFirma = firmaChiuse();
  /** Dove va il nome di un'isola (celle): in mezzo e subito sotto la sua terra, non sotto il mare del suo riquadro. */
  const nomeAt = new Map(o.places.map((p) => { let a = p.x0 + p.w, b = p.x0, z = p.z0; for (let cz = p.z0; cz < p.z0 + p.h; cz++) for (let cx = p.x0; cx < p.x0 + p.w; cx++) if (map.at(cx, cz) !== '~') { a = Math.min(a, cx); b = Math.max(b, cx); z = Math.max(z, cz); } return [p.id, { x: (a + b + 1) / 2, z: z + 1 }]; }));

  // ——— base: un pixel per cella; le isole nascoste diventano mare (ridisegnata quando ne scopri o ne apri una) ———
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bg = base.getContext('2d', { willReadFrequently: true })!;
  const rgb = new Map<string, [number, number, number]>();
  const c3 = (h: string) => { let v = rgb.get(h); if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; rgb.set(h, v); } return v; };
  const paintBase = () => {
    const img = bg.createImageData(W, H), via = new Uint8Array(W * H);
    for (const p of o.places) if (nascosta(p)) for (let cz = Math.max(0, p.z0); cz < Math.min(H, p.z0 + p.h); cz++) via.fill(1, cz * W + Math.max(0, p.x0), cz * W + Math.min(W, p.x0 + p.w));
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const j = cz * W + cx, [r, g, b] = c3(via[j] ? MARE : TILE_COL[map.at(cx, cz)] ?? MARE), i = j * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    bg.putImageData(img, 0, 0);
  };
  paintBase();
  const dentroNascosta = (x: number, z: number) => o.places.some((p) => nascosta(p) && x >= p.x0 * T && x <= (p.x0 + p.w) * T && z >= p.z0 * T && z <= (p.z0 + p.h) * T);
  const metaVisibile = (t: MappaTarget) => (t.show?.() ?? true) && !!t.icon && !dentroNascosta(t.x, t.z);
  const bottone = (z: '+' | '-', title: string) => { const b = document.createElement('button'); b.type = 'button'; b.dataset['zoom'] = z; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = GLIFO[z]; return b; };

  // ——— minimappa ———
  const mini = document.createElement('button'); mini.type = 'button'; mini.id = 'mzMini'; mini.className = 'mz'; mini.title = 'Mappa (M)'; mini.setAttribute('aria-label', 'Apri la mappa');
  const mc = document.createElement('canvas'), mg = mc.getContext('2d')!; mc.width = mc.height = 96;
  const nord = document.createElement('span'); nord.className = 'n'; nord.textContent = 'N';
  mini.append(mc, nord); guard(mini);
  mini.addEventListener('click', (e) => { e.preventDefault(); mini.blur(); toggle(); });
  const ruotaMini = rotella(); mini.addEventListener('wheel', (e) => { const p = ruotaMini(e); if (p) zoomMini(p); }, { passive: false });
  const mz = document.createElement('div'); mz.id = 'mzMiniZoom'; mz.className = 'mz';
  const mPiu = bottone('+', 'Avvicina la minimappa (+)'), mMeno = bottone('-', 'Allontana la minimappa (−)');
  mz.append(mPiu, mMeno); guard(mz);
  mPiu.addEventListener('click', () => zoomMini(1)); mMeno.addEventListener('click', () => zoomMini(-1));
  o.root.append(mini, mz);

  // ——— mappa grande ———
  const ov = document.createElement('div'); ov.id = 'mzMappa'; ov.className = 'mz'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Mappa dell\'arcipelago');
  const hd = document.createElement('div'); hd.className = 'hd';
  const tit = document.createElement('span'), q = document.createElement('span'); tit.textContent = 'MAPPA'; q.className = 'q'; q.textContent = 'le isole compaiono passandoci vicino in barca';
  const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'Chiudi (Esc, M)'; x.dataset['act'] = 'chiudi';
  hd.append(tit, q, x);
  const fr = document.createElement('div'); fr.className = 'fr';
  const bc = document.createElement('canvas'); bc.width = W; bc.height = H;
  const big = bc.getContext('2d', { willReadFrequently: true })!;
  const zb = document.createElement('div'); zb.className = 'zoom';
  const gPiu = bottone('+', 'Avvicina (+, rotella)'), gMeno = bottone('-', 'Allontana (−, rotella)');
  gPiu.addEventListener('click', () => zoomGrande(zg + 1)); gMeno.addEventListener('click', () => zoomGrande(zg - 1));
  fr.appendChild(bc);
  // riga in fondo: come si mette il segnalino, o dov'è e TOGLI
  const pie = document.createElement('div'); pie.className = 'pie';
  const pieIco = pixIcon('segno', 16), pieTxt = document.createElement('span');
  const togli = document.createElement('button'); togli.type = 'button'; togli.dataset['act'] = 'togli'; togli.textContent = 'TOGLI'; togli.title = 'Togli il segnalino';
  pie.append(pieIco, pieTxt, togli); if (!o.segno) pie.style.display = 'none';
  ov.append(hd, fr, pie); guard(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  x.addEventListener('click', () => close()); togli.addEventListener('click', () => { o.segno?.set(null); drawBig(); });
  o.root.appendChild(ov);
  /** Dove stanno i bottoni dello zoom: dipende dalla variante (si può cambiare da test, `mappaVariante`). */
  const piazzaBottoni = () => {
    mz.className = `mz ${V.bottoni}`; // A: + sopra e − sotto; B (in riga al contrario): − a sinistra e + a destra
    zb.replaceChildren(...(V.bottoni === 'sopra' ? [gMeno, gPiu] : [gPiu, gMeno]));
    if (V.bottoni === 'sopra') hd.insertBefore(zb, x); else fr.appendChild(zb);
  };
  piazzaBottoni();

  // ——— vista della mappa grande: centro (celle) e scatto; pixel della tela per cella = adatta × ingrandimento ———
  // f = il punto voluto al centro, senza i limiti dei bordi: all'apertura sei tu, poi quello che porti al centro trascinando o con rotella e
  // pizzico; + e − (tasti, bottoni) avvicinano verso di lui. v = il centro vero (dalla mappa intera, ferma al centro dell'arcipelago, si va su di te).
  let vx = W / 2, vz = H / 2, fx = vx, fz = vz;
  const adatta = () => Math.min(bc.width / W, bc.height / H);
  /** Pixel della tela per cella: dall'arcipelago intero (adatta) a DENSITA_MAX (almeno il doppio), ogni scatto moltiplica uguale. */
  const kk = () => { const a = adatta(), max = Math.max(2 * a, DENSITA_MAX * dprOf()); return a * Math.pow(max / a, tGrande()); };
  const tieniDentro = () => {
    const k = kk(), mw = bc.width / k, mh = bc.height / k;
    vx = mw >= W ? W / 2 : Math.min(W - mw / 2, Math.max(mw / 2, vx));
    vz = mh >= H ? H / 2 : Math.min(H - mh / 2, Math.max(mh / 2, vz));
  };
  /** Metri del mondo → pixel della tela della mappa grande, e ritorno. */
  const aSchermo = (wx: number, wz: number) => { const k = kk(); return { x: bc.width / 2 + (wx / T - vx) * k, y: bc.height / 2 + (wz / T - vz) * k }; };
  const aMondo = (sx: number, sy: number) => { const k = kk(); return { x: (vx + (sx - bc.width / 2) / k) * T, z: (vz + (sy - bc.height / 2) / k) * T }; };
  /** La tela segue la cornice (px CSS × densità dello schermo, intera: i pixel restano quadrati). */
  const misura = () => {
    const d = dprOf(), w = Math.max(1, Math.round(fr.clientWidth * d)), h = Math.max(1, Math.round(fr.clientHeight * d));
    if (bc.width !== w || bc.height !== h) { bc.width = w; bc.height = h; tieniDentro(); }
  };
  /** Uno scatto: con un punto della tela (rotella, pizzico) quel punto resta sotto il dito; senza (tasti, bottoni) si va verso il punto voluto. */
  function zoomGrande(i: number, ax?: number, ay?: number): void {
    const n = Math.max(0, Math.min(V.scatti - 1, i));
    if (n === zg) return;
    if (ax === undefined || ay === undefined) { zg = n; vx = fx; vz = fz; tieniDentro(); }
    else {
      const k0 = kk(), cx = vx + (ax - bc.width / 2) / k0, cz = vz + (ay - bc.height / 2) / k0;
      zg = n;
      const k1 = kk(); vx = cx - (ax - bc.width / 2) / k1; vz = cz - (ay - bc.height / 2) / k1;
      tieniDentro(); fx = vx; fz = vz;
    }
    save(); if (open) drawBig();
  }
  function zoomMini(passi: number): void {
    const n = Math.max(0, Math.min(V.raggi.length - 1, zm - passi));
    if (n === zm) return;
    zm = n; save(); drawMini(last);
  }
  const sposta = (dx: number, dy: number) => { const k = kk(); vx -= dx / k; vz -= dy / k; tieniDentro(); fx = vx; fz = vz; };

  // ——— tocchi sulla mappa grande: un dito trascina, due pizzicano, un tocco fermo mette il segnalino ———
  const dita = new Map<number, { x: number; y: number; x0: number; y0: number }>();
  let mosso = false, pizzicoRif = 0;
  const scala = () => bc.width / Math.max(1, bc.getBoundingClientRect().width); // px della tela per px CSS
  const distanza = () => { const [a, b] = [...dita.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  bc.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); try { bc.setPointerCapture(e.pointerId); } catch { /* puntatore sintetico */ }
    dita.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (dita.size === 1) mosso = false;
    else { mosso = true; pizzicoRif = distanza(); } // con due dita niente tocco
  });
  bc.addEventListener('pointermove', (e) => {
    const d = dita.get(e.pointerId);
    if (!d) return;
    const sc = scala(), dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    if (dita.size === 1) {
      if (!mosso && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > TRASCINA) { mosso = true; bc.classList.add('drag'); }
      if (mosso) { sposta(dx * sc, dy * sc); drawBig(); }
    } else if (dita.size === 2) {
      sposta((dx / 2) * sc, (dy / 2) * sc); // il punto in mezzo alle dita segue le dita
      const dd = distanza(), [a, b] = [...dita.values()], r = bc.getBoundingClientRect();
      const mx = ((a!.x + b!.x) / 2 - r.left) * sc, my = ((a!.y + b!.y) / 2 - r.top) * sc;
      if (pizzicoRif > 0 && dd / pizzicoRif > PIZZICO) { zoomGrande(zg + 1, mx, my); pizzicoRif = dd; }
      else if (pizzicoRif > 0 && pizzicoRif / dd > PIZZICO) { zoomGrande(zg - 1, mx, my); pizzicoRif = dd; }
      drawBig();
    }
  });
  const su = (e: PointerEvent) => {
    if (!dita.delete(e.pointerId)) return;
    if (e.type === 'pointerup' && !mosso && dita.size === 0) tocco(e.clientX, e.clientY);
    if (dita.size === 0) { mosso = false; bc.classList.remove('drag'); } else pizzicoRif = 0;
  };
  bc.addEventListener('pointerup', su); bc.addEventListener('pointercancel', su);
  const ruotaGrande = rotella();
  fr.addEventListener('wheel', (e) => {
    const p = ruotaGrande(e);
    if (!p) return;
    const r = bc.getBoundingClientRect(), sc = scala();
    zoomGrande(zg + p, (e.clientX - r.left) * sc, (e.clientY - r.top) * sc);
  }, { passive: false });

  /** Lato in pixel della tela di una cella delle icone delle mete e del segnalino, nella mappa grande. */
  const cellaIcona = () => Math.round((stretto() ? 2 : 3) * dprOf()), cellaSegno = () => Math.round((stretto() ? 3 : 4) * dprOf());
  /** Il segnalino agganciato a una meta sta sopra la sua icona (o il suo cartellino), libero con la punta sul punto. */
  const puntaSegno = (s: { x: number; z: number; su?: string }) => { const p = aSchermo(s.x, s.z); return { x: p.x, y: p.y - (s.su ? (V.icone === 'cartello' ? 14 : 5) * cellaIcona() : 0) }; };
  /** Le icone disegnate l'ultima volta nella mappa grande (le sole che si possono toccare) e nella minimappa. */
  let disegnate: Disegnata<MappaTarget>[] = [], disegnateMini: Disegnata<MappaTarget>[] = [];
  /** Tocco fermo sulla mappa (px CSS dello schermo): sul segnalino lo togli, sull'icona di una meta il segnalino si aggancia a lei, altrove lo metti lì. */
  function tocco(clientX: number, clientY: number): void {
    const sg = o.segno;
    if (!sg) return;
    const r = bc.getBoundingClientRect();
    if (!r.width) return;
    const sc = scala(), cx = (clientX - r.left) * sc, cy = (clientY - r.top) * sc;
    const cur = sg.get();
    if (cur) { const p = puntaSegno(cur); if (Math.hypot(cx - p.x, cy - (p.y - 4 * cellaSegno())) < TOCCO_SEGNO * sc) { sg.set(null); drawBig(); return; } }
    let meta: MappaTarget | null = null, best = TOCCO_META * sc, bestC = Infinity;
    for (const d of disegnate) { // distanza dalla scatola dell'icona (dentro = 0); a pari distanza vince il centro più vicino
      const dist = Math.hypot(cx - Math.max(d.x0, Math.min(d.x1, cx)), cy - Math.max(d.y0, Math.min(d.y1, cy))), dc = Math.hypot(cx - (d.x0 + d.x1) / 2, cy - (d.y0 + d.y1) / 2);
      if (dist < best || (dist === best && dc < bestC)) { best = dist; bestC = dc; meta = d.t; }
    }
    const w = aMondo(cx, cy);
    sg.set(meta ? { x: meta.x, z: meta.z, su: meta.id, nome: meta.label } : { x: Math.max(0, Math.min(W * T, w.x)), z: Math.max(0, Math.min(H * T, w.z)) });
    drawBig();
  }

  let open = false, last: Pose = { x: 0, z: 0, yaw: 0 }, lastPeers: readonly { nome?: string; x: number; z: number }[] = [];
  const PAN: Record<string, [number, number]> = { ArrowLeft: [1, 0], KeyA: [1, 0], ArrowRight: [-1, 0], KeyD: [-1, 0], ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1] };
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation(); // con la mappa aperta i tasti non arrivano al gioco
    if (e.altKey || e.ctrlKey || e.metaKey) return; // Cmd + e Cmd −: lo zoom del browser
    if (e.key === 'Escape' || e.code === 'KeyM') { e.preventDefault(); close(); return; }
    const z = zoomTasto(e);
    if (z) { e.preventDefault(); zoomGrande(zg + z); return; }
    const pan = PAN[e.code];
    if (pan) { e.preventDefault(); sposta((pan[0] * bc.width) / 4, (pan[1] * bc.height) / 4); drawBig(); }
  };
  function show(): void {
    if (open || o.hidden?.()) return;
    open = true; ov.classList.add('on'); addEventListener('keydown', onKey, true);
    misura(); vx = fx = last.x / T; vz = fz = last.z / T; tieniDentro(); // si apre centrata su di te (a zoom 1 si vede tutto)
    drawBig();
  }
  function close(): void { if (!open) return; open = false; ov.classList.remove('on'); removeEventListener('keydown', onKey, true); dita.clear(); bc.classList.remove('drag'); }
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
  const spento = (b: HTMLButtonElement, v: boolean) => { if (b.disabled !== v) b.disabled = v; };
  /** Ai due capi degli scatti il bottone si spegne. */
  const bottoniZoom = () => { spento(gPiu, zg >= V.scatti - 1); spento(gMeno, zg <= 0); spento(mPiu, zm <= 0); spento(mMeno, zm >= V.raggi.length - 1); };
  /** Mete visibili come icone (sprite e scatola sulla tela) attorno ai punti dati da `dove`; quelle fuori da `dentro` si scartano. */
  const candidate = (cella: number, cartello: boolean, dove: (t: MappaTarget) => { x: number; y: number } | null): Disegnata<MappaTarget>[] => {
    const out: Disegnata<MappaTarget>[] = [];
    for (const t of o.targets) {
      if (!metaVisibile(t)) continue;
      const p = dove(t);
      if (!p) continue;
      const tipo = tipoDi(t), sp = spriteMeta(t.icon!, cella, cartello, tipo), x0 = Math.round(p.x - sp.ax), y0 = Math.round(p.y - sp.ay);
      out.push({ t, tipo, sp, x0, y0, x1: x0 + sp.c.width, y1: y0 + sp.c.height });
    }
    return out;
  };

  function drawBig(): void {
    misura();
    const g = big, cw = bc.width, ch = bc.height, k = kk(), d = dprOf(), fs = Math.round((stretto() ? 11 : 13) * d);
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = P.abisso; g.fillRect(0, 0, cw, ch); // fuori dall'arcipelago
    g.drawImage(base, Math.round(cw / 2 - vx * k), Math.round(ch / 2 - vz * k), W * k, H * k);
    scritte(g, o.places.filter((p) => !nascosta(p) && p.nome).map((p) => { const at = nomeAt.get(p.id)!, c = aSchermo(at.x * T, at.z * T); return { t: p.nome, x: c.x, y: c.y + fs * 0.8 }; }), fs, cw, ch); // nomi delle isole che si vedono, sotto la terra
    const sg = o.segno?.get() ?? null, punta = sg ? puntaSegno(sg) : null, io = aSchermo(last.x, last.z);
    if (punta) { // scia di puntini da te al segnalino, in linea d'aria (sotto le icone)
      const passo = 16 * d, n = Math.floor(Math.hypot(punta.x - io.x, punta.y - io.y) / passo);
      for (let i = 2; i < n; i++) punto(g, io.x + ((punta.x - io.x) * i) / n, io.y + ((punta.y - io.y) * i) / n, Math.round(4 * d), P.giallo);
    }
    const cella = cellaIcona();
    const inVista = candidate(cella, V.icone === 'cartello', (t) => aSchermo(t.x, t.z)).filter((c) => c.x1 > 0 && c.x0 < cw && c.y1 > 0 && c.y0 < ch);
    disegnate = zg === V.scatti - 1 ? inVista.sort((a, b) => TIPO_ORDINE[b.tipo] - TIPO_ORDINE[a.tipo]) : sfoltisci(inVista, cella); // allo zoom più vicino tutte (le più importanti sopra)
    for (const c of disegnate) g.drawImage(c.sp.c, c.x0, c.y0);
    if (punta) { const s = cellaSegno(); drawPix(g, 'segno', Math.round(punta.x - 4 * s), Math.round(punta.y - 8 * s), s); }
    paintPie(); bottoniZoom();
    for (const p of lastPeers) { const s = aSchermo(p.x, p.z); punto(g, s.x, s.y, Math.round(8 * d), P.sabbiaChiara); if (p.nome) scritta(g, p.nome, s.x, s.y - fs, fs); }
    freccia(g, io.x, io.y, last.yaw, Math.round(10 * d));
  }

  function drawMini(me: Pose): void {
    const d = dprOf(), R = Math.max(16, Math.round(mc.clientWidth * d) || 96);
    if (mc.width !== R) mc.width = mc.height = R;
    const s = R / ((2 * V.raggi[zm]!) / T); // pixel per cella
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.imageSmoothingEnabled = false;
    mg.fillStyle = MARE; mg.fillRect(0, 0, R, R);
    mg.drawImage(base, Math.round(R / 2 - (me.x / T) * s), Math.round(R / 2 - (me.z / T) * s), W * s, H * s); // nord in alto: il mondo non gira
    const toMini = (wx: number, wz: number) => ({ x: R / 2 + ((wx - me.x) / T) * s, y: R / 2 + ((wz - me.z) / T) * s });
    const cella = Math.max(1, Math.round((stretto() ? 1.5 : 2) * d)), meta = 5 * cella;
    const sulBordo = (p: { x: number; y: number }) => { const dd = Math.hypot(p.x - R / 2, p.y - R / 2), maxD = R / 2 - meta - 1, k = dd > maxD ? maxD / dd : 1; return { x: R / 2 + (p.x - R / 2) * k, y: R / 2 + (p.y - R / 2) * k }; }; // fuori dal cerchio: sul bordo, verso la meta
    disegnateMini = sfoltisci(candidate(cella, false, (t) => sulBordo(toMini(t.x, t.z))), 0);
    for (const c of disegnateMini) mg.drawImage(c.sp.c, c.x0, c.y0);
    const sg = o.segno?.get();
    if (sg) { const p = sulBordo(toMini(sg.x, sg.z)); drawPix(mg, 'segno', Math.round(p.x - 4 * cella), Math.round(p.y - 8 * cella), cella); } // sopra le mete; lontano: sul bordo
    for (const pe of lastPeers) { const p = toMini(pe.x, pe.z); if (Math.hypot(p.x - R / 2, p.y - R / 2) < R / 2 - 3 * d) punto(mg, p.x, p.y, Math.round(3 * d), P.sabbiaChiara); }
    freccia(mg, R / 2, R / 2, me.yaw, Math.max(5, R * 0.055));
  }

  const nascosteIds = () => o.places.filter(nascosta).map((p) => p.id);
  let nextScopri = 0, nextMini = 0;
  registerStateProvider('mappa', () => ({
    open, viste: [...viste], coperte: o.places.filter(coperta).map((p) => p.id), chiuse: o.places.filter(chiusa).map((p) => p.id), nascoste: nascosteIds(),
    mini: mini.style.visibility !== 'hidden' && getComputedStyle(mini).visibility !== 'hidden', variante: V.id,
    nord: 0, freccia: last.yaw, // la minimappa non gira mai (nord in alto): gira solo la freccia, con te
    zoomMini: { i: zm, n: V.raggi.length, raggio: V.raggi[zm] }, zoomMappa: { i: zg, n: V.scatti, x: Math.round((kk() / adatta()) * 100) / 100, centro: { x: vx * T, z: vz * T } },
    icone: disegnate.map((c) => c.t.id), iconeMini: disegnateMini.map((c) => c.t.id),
  }));
  /** Test (#144): dove sta sullo schermo (px CSS) il punto (x, z) del mondo nella mappa grande aperta (per toccarlo), con lo zoom di adesso. */
  registerTestHook('mappaSchermo', (wx, wz) => { const r = bc.getBoundingClientRect(), sc = scala(), p = aSchermo(Number(wx), Number(wz)); return { x: r.left + p.x / sc, y: r.top + p.y / sc }; });
  registerTestHook('mappa', (v) => { if (v === 'apri') show(); else if (v === 'chiudi') close(); else toggle(); return open; });
  registerTestHook('mappaScopri', (id) => { if (typeof id === 'string') viste.add(id); else for (const p of o.places) viste.add(p.id); save(); paintBase(); if (open) drawBig(); });
  /** Test e foto A/B (#360): cambia variante senza ricaricare. */
  registerTestHook('mappaVariante', (v) => {
    const raggio = V.raggi[zm]!, t = tGrande();
    V = VARIANTI[String(v) === '2' ? '2' : '1']; zm = scattoVicino(V.raggi, raggio); zg = scattoGrande(t);
    piazzaBottoni(); vx = fx; vz = fz; tieniDentro(); drawMini(last); if (open) drawBig(); bottoniZoom();
    return V.id;
  });
  /** Test (#360): pixel di terra (non mare) dell'isola `id` nella base e, se la mappa grande è aperta, sulla sua tela. 0 = non si vede. */
  registerTestHook('mappaTerra', (id) => {
    const p = o.places.find((q) => q.id === id);
    if (!p) return null;
    const mare = new Set([MARE, P.abisso].map((h) => c3(h).join(',')));
    const conta = (dd: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < dd.length; i += 4) if (!mare.has(`${dd[i]},${dd[i + 1]},${dd[i + 2]}`)) n++; return n; };
    let grande: number | null = null;
    if (open) {
      drawBig();
      const a = aSchermo(p.x0 * T, p.z0 * T), b = aSchermo((p.x0 + p.w) * T, (p.z0 + p.h) * T);
      const x0 = Math.max(0, Math.ceil(a.x)), y0 = Math.max(0, Math.ceil(a.y)), x1 = Math.min(bc.width, Math.floor(b.x)), y1 = Math.min(bc.height, Math.floor(b.y));
      grande = x1 > x0 && y1 > y0 ? conta(big.getImageData(x0, y0, x1 - x0, y1 - y0).data) : 0;
    }
    return { base: conta(bg.getImageData(p.x0, p.z0, p.w, p.h).data), grande };
  });

  return {
    update(me, peers) {
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
      if (now >= nextMini) { nextMini = now + 66; drawMini(me); bottoniZoom(); if (open) drawBig(); } // 15 volte al secondo bastano
    },
    toggle, close, isOpen: () => open,
    zoom(passi) { if (open) zoomGrande(zg + passi); else zoomMini(passi); },
    vista: (id) => viste.has(id),
    evidenzia(on) { mini.classList.toggle('qui', on); },
  };
}
