// Minimappa (#62): un cerchio in alto a destra (telefono) o in basso a destra sopra il bottone A (PC) con l'arcipelago attorno a te, girato come la
// camera; toccandolo o premendo M si apre la mappa intera, con te, gli amici, le mete della bussola e i nomi delle isole.
// Le isole non ancora visitate stanno sotto la nebbia (Porto e la tua isola si vedono da subito): ci passi vicino in barca e
// si scoprono. Le scoperte restano su questo dispositivo (localStorage). Un'isola a tema chiusa (#68: Tempesta, Ghiacci, Vulcano,
// Giardino) resta nella nebbia col lucchetto finché non la sblocchi, anche se ci sei passato vicino. Disegno su <canvas> a pixel con la palette: un pixel per cella della mappa.
// Segnalino del navigatore (#144, ui/segno.ts): un tocco sulla mappa grande lo mette lì (sull'icona di una meta, si aggancia a lei), un tocco
// sul segnalino o TOGLI nella riga in fondo lo tolgono. In mappa una scia di puntini va da te al segnalino; nella minimappa sta sul bordo se è lontano.
import type { GridMap, Tile } from '@marea/sim';
import { drawPix, pixIcon } from './icons.ts';
import type { PixId } from './icons.ts';
import type { Segno } from './segno.ts';
import { PAL } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const P = PAL;
const STORE = 'marea:mappa';
/** Raggio (m) della minimappa e distanza (m) dal bordo di un'isola entro cui la scopri. */
const RAGGIO_MINI = 100, SCOPRI_M = 55;
/** Pixel della tela della mappa grande per cella. */
const K = 3;
/** Tocco sulla mappa grande (px sullo schermo): entro questo raggio dal segnalino lo togli, dall'icona di una meta il segnalino si aggancia a lei. */
const TOCCO_SEGNO = 22, TOCCO_META = 18;
const TILE_COL: Record<Tile, string> = {
  '~': P.acquaProfonda, ',': P.acqua, B: P.acqua, '.': P.sabbia, P: P.sabbia, L: P.sabbia, g: P.erba, r: P.roccia, d: P.legno,
};
const NEBBIA = [P.pietraChiara, P.pietra];

/** `chiusa`: letto ogni ½ s; true = nebbia e lucchetto anche se scoperta (isole a tema non ancora sbloccate). */
export type MappaPlace = { id: string; nome: string; x0: number; z0: number; w: number; h: number; sempre?: boolean; chiusa?(): boolean };
export type MappaTarget = { id: string; label: string; x: number; z: number; icon?: PixId; show?(): boolean };
export type Pose = { x: number; z: number; yaw: number };
export type Minimappa = { update(me: Pose, cameraYaw: number, peers: readonly { nome?: string; x: number; z: number }[]): void; toggle(): void; close(): void; isOpen(): boolean;
  /** L'isola `id` (MappaPlace.id) è già stata scoperta (ci sei passato vicino)? La bussola mostra le isole a tema solo da scoperte. */
  vista(id: string): boolean;
  /** Bordo giallo che lampeggia sul cerchio (la guida «Primi passi» dice di toccarlo). */
  evidenzia(on: boolean): void };

const CSS = `
#mzMini { position: absolute; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 136px); /* sopra il bottone A (84 px a 36 px dal fondo) */ width: 148px; height: 148px; z-index: 13; cursor: pointer; padding: 0; border: none; background: none; }
#mzMini canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; border-radius: 50%; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; box-sizing: border-box; background: ${P.abisso}; }
#mzMini .n { position: absolute; left: 50%; top: 0; transform: translate(-50%, -50%); font: bold 11px ui-monospace, Menlo, monospace; color: ${P.giallo}; text-shadow: 0 1px 0 ${P.neroCaldo}, 1px 0 0 ${P.neroCaldo}, -1px 0 0 ${P.neroCaldo}; pointer-events: none; }
#mzMini:focus { outline: none; } #mzMini:focus-visible canvas { border-color: ${P.giallo}; }
#mzMini.qui canvas { animation: mzMiniQui 1s steps(2, jump-none) infinite; }
@keyframes mzMiniQui { from { border-color: ${P.giallo}; } to { border-color: ${P.legnoChiaro}; } }
@media (max-width: 699px) { #mzMini { width: 92px; height: 92px; bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 58px); } }
#mzMappa { position: absolute; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 8px; background: rgba(22,63,115,.9); padding: 12px; box-sizing: border-box; }
#mzMappa.on { display: flex; }
#mzMappa .fr { position: relative; max-width: 100%; max-height: calc(100% - 112px); aspect-ratio: var(--ar); background: ${P.abisso}; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 4px 0 ${P.neroCaldo}; }
#mzMappa canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; cursor: crosshair; }
#mzMappa .pie { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; max-width: 100%; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; text-align: center; }
#mzMappa .pie button { min-height: 44px; padding: 0 12px; background: rgba(46,30,20,.95); border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzMappa .pie button:active { transform: translateY(2px); }
#mzMappa .hd { display: flex; align-items: center; gap: 10px; color: ${P.sabbiaChiara}; font: bold 16px ui-monospace, Menlo, monospace; }
#mzMappa .hd button { min-width: 44px; min-height: 44px; background: rgba(46,30,20,.95); border: 2px solid ${P.legnoChiaro}; color: ${P.sabbiaChiara}; font: bold 18px ui-monospace, Menlo, monospace; cursor: pointer; }
#mzMappa .q { font-size: 12px; font-weight: normal; color: ${P.pietraChiara}; }
@media (max-width: 699px) { #mzMappa .q { display: none; } }
#ui.mz-racing #mzMini, body.mz-sotto #mzMini { visibility: hidden; }
`;

type Saved = { viste?: string[] };
const load = (): Saved => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const save = (s: Saved) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage bloccato: le scoperte valgono fino a fine sessione */ } };
const guard = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };

export function createMinimappa(o: {
  root: HTMLElement; map: GridMap; places: MappaPlace[]; targets: MappaTarget[];
  /** Pannelli aperti, gara, dungeon: la mappa grande non si apre (e si chiude se era aperta). */
  hidden?(): boolean;
  /** Segnalino del navigatore (#144): senza, la mappa non si tocca. */
  segno?: Segno;
}): Minimappa {
  if (!document.getElementById('mz-mini-style')) { const st = document.createElement('style'); st.id = 'mz-mini-style'; st.textContent = CSS; document.head.appendChild(st); }
  const { map } = o, T = map.tile, W = map.w, H = map.h;
  const viste = new Set(load().viste ?? []);
  for (const p of o.places) if (p.sempre) viste.add(p.id);
  const coperta = (p: MappaPlace) => !viste.has(p.id);
  const chiusa = (p: MappaPlace) => !!p.chiusa?.();
  const nascosta = (p: MappaPlace) => coperta(p) || chiusa(p);
  const firmaChiuse = () => o.places.filter(chiusa).map((p) => p.id).join(',');
  let chiuseFirma = firmaChiuse();

  // ——— base: un pixel per cella, nebbia a scacchi sulle isole non scoperte (ridisegnata quando ne scopri una) ———
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bg = base.getContext('2d')!;
  const paintBase = () => {
    const img = bg.createImageData(W, H), rgb = new Map<string, [number, number, number]>();
    const c3 = (h: string) => { let v = rgb.get(h); if (!v) { v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; rgb.set(h, v); } return v; };
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const [r, g, b] = c3(TILE_COL[map.at(cx, cz)] ?? P.acquaProfonda), i = (cz * W + cx) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    for (const p of o.places) {
      if (!nascosta(p)) continue;
      // nuvola: ellisse che sborda dall'isola (la forma non si indovina) col bordo mangiucchiato; dentro chiara, sul bordo a scacchi
      const rx = p.w / 2 + 5, rz = p.h / 2 + 5, mx = p.x0 + p.w / 2, mz = p.z0 + p.h / 2;
      for (let cz = Math.max(0, Math.floor(mz - rz)); cz < Math.min(H, Math.ceil(mz + rz)); cz++) for (let cx = Math.max(0, Math.floor(mx - rx)); cx < Math.min(W, Math.ceil(mx + rx)); cx++) {
        const e = ((cx + 0.5 - mx) / rx) ** 2 + ((cz + 0.5 - mz) / rz) ** 2, h = ((cx * 73856093) ^ (cz * 19349663)) >>> 0;
        const bordo = 1 - 0.18 * ((h % 97) / 97) - 0.06 * Math.sin(cx * 0.7 + cz * 0.4);
        if (e > bordo) continue;
        const col = e > bordo - 0.22 ? NEBBIA[(cx + cz) & 1]! : NEBBIA[0]!;
        const [r, g, b] = c3(col), i = (cz * W + cx) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
      }
    }
    bg.putImageData(img, 0, 0);
  };
  paintBase();
  /** Centro di un'isola in metri (per nomi e «?»). */
  const centro = (p: MappaPlace) => ({ x: (p.x0 + p.w / 2) * T, z: (p.z0 + p.h / 2) * T });
  const dentroCoperta = (x: number, z: number) => o.places.some((p) => nascosta(p) && x >= p.x0 * T && x <= (p.x0 + p.w) * T && z >= p.z0 * T && z <= (p.z0 + p.h) * T);

  // ——— minimappa ———
  const mini = document.createElement('button'); mini.type = 'button'; mini.id = 'mzMini'; mini.className = 'mz'; mini.title = 'Mappa (M)'; mini.setAttribute('aria-label', 'Apri la mappa');
  const R = 96; // tela interna: 96×96, un pixel = ~2 m
  const mc = document.createElement('canvas'); mc.width = R; mc.height = R;
  const mg = mc.getContext('2d')!; mg.imageSmoothingEnabled = false;
  const nord = document.createElement('span'); nord.className = 'n'; nord.textContent = 'N';
  mini.append(mc, nord); guard(mini);
  mini.addEventListener('click', (e) => { e.preventDefault(); mini.blur(); toggle(); });
  o.root.appendChild(mini);

  // ——— mappa grande ———
  const ov = document.createElement('div'); ov.id = 'mzMappa'; ov.className = 'mz'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Mappa dell\'arcipelago');
  ov.style.setProperty('--ar', `${W} / ${H}`);
  const hd = document.createElement('div'); hd.className = 'hd';
  const tit = document.createElement('span'); tit.textContent = 'MAPPA';
  const q = document.createElement('span'); q.className = 'q'; q.textContent = 'la nebbia si toglie passandoci vicino in barca';
  const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'Chiudi (Esc, M)';
  hd.append(tit, q, x);
  const fr = document.createElement('div'); fr.className = 'fr';
  const bc = document.createElement('canvas'); bc.width = W * K; bc.height = H * K;
  const big = bc.getContext('2d')!; big.imageSmoothingEnabled = false;
  fr.appendChild(bc);
  // riga in fondo: come si mette il segnalino, o dov'è e TOGLI
  const pie = document.createElement('div'); pie.className = 'pie';
  const pieIco = pixIcon('segno', 16), pieTxt = document.createElement('span');
  const togli = document.createElement('button'); togli.type = 'button'; togli.dataset['act'] = 'togli'; togli.textContent = 'TOGLI'; togli.title = 'Togli il segnalino';
  pie.append(pieIco, pieTxt, togli);
  if (!o.segno) pie.style.display = 'none';
  ov.append(hd, fr, pie); guard(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  x.addEventListener('click', () => close());
  togli.addEventListener('click', () => { o.segno?.set(null); drawBig(); });
  o.root.appendChild(ov);
  /** Metri del mondo → pixel della tela della mappa grande. */
  const px = (m: number) => (m / T) * K;
  /** Il segnalino agganciato a una meta sta sopra la sua icona (la punta sul bordo alto), libero con la punta sul punto. */
  const puntaSegno = (s: { x: number; z: number; su?: string }) => ({ x: px(s.x), y: px(s.z) - (s.su ? 13 : 0) });
  const metaVisibile = (t: MappaTarget) => (t.show?.() ?? true) && !!t.icon && !dentroCoperta(t.x, t.z);
  // tocco sulla mappa: sul segnalino lo togli, sull'icona di una meta il segnalino si aggancia a lei, altrove lo metti lì
  bc.addEventListener('click', (e) => {
    const sg = o.segno;
    if (!sg) return;
    const r = bc.getBoundingClientRect();
    if (!r.width) return;
    const sc = r.width / bc.width, cx = (e.clientX - r.left) / sc, cy = (e.clientY - r.top) / sc; // px della tela
    const cur = sg.get();
    if (cur) { const p = puntaSegno(cur); if (Math.hypot(cx - p.x, cy - (p.y - 20)) * sc < TOCCO_SEGNO) { sg.set(null); drawBig(); return; } }
    let meta: MappaTarget | null = null, best = TOCCO_META;
    for (const t of o.targets) {
      if (!metaVisibile(t)) continue;
      const d = Math.hypot(cx - px(t.x), cy - px(t.z)) * sc;
      if (d < best) { best = d; meta = t; }
    }
    sg.set(meta ? { x: meta.x, z: meta.z, su: meta.id, nome: meta.label } : { x: (cx / K) * T, z: (cy / K) * T });
    drawBig();
  });
  let open = false, last: Pose = { x: 0, z: 0, yaw: 0 }, lastPeers: readonly { nome?: string; x: number; z: number }[] = [], lastYaw = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.code === 'KeyM') { e.preventDefault(); close(); }
    e.stopPropagation(); // con la mappa aperta i tasti non arrivano al gioco
  };
  function show(): void { if (open || o.hidden?.()) return; open = true; ov.classList.add('on'); addEventListener('keydown', onKey, true); drawBig(); }
  function close(): void { if (!open) return; open = false; ov.classList.remove('on'); removeEventListener('keydown', onKey, true); }
  function toggle(): void { if (open) close(); else show(); }

  /** Freccia a pixel (te): triangolo con contorno, punta verso `a` (radianti, 0 = su). */
  const freccia = (g: CanvasRenderingContext2D, cx: number, cy: number, a: number, s: number) => {
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.8, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.8, s * 0.8); g.closePath();
    g.fillStyle = P.giallo; g.fill(); g.lineWidth = Math.max(1, s / 4); g.strokeStyle = P.neroCaldo; g.stroke(); g.restore();
  };
  const punto = (g: CanvasRenderingContext2D, cx: number, cy: number, s: number, col: string) => {
    g.fillStyle = P.neroCaldo; g.fillRect(Math.round(cx - s / 2) - 1, Math.round(cy - s / 2) - 1, s + 2, s + 2);
    g.fillStyle = col; g.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
  };

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
    big.clearRect(0, 0, bc.width, bc.height);
    big.drawImage(base, 0, 0, bc.width, bc.height);
    big.font = 'bold 20px ui-monospace, Menlo, monospace'; big.textAlign = 'center'; big.textBaseline = 'middle'; big.lineJoin = 'round';
    const scritta = (t: string, cx: number, cy: number, col: string, size = 20) => { big.font = `bold ${size}px ui-monospace, Menlo, monospace`; big.lineWidth = size / 4; big.strokeStyle = P.neroCaldo; big.strokeText(t, cx, cy); big.fillStyle = col; big.fillText(t, cx, cy); };
    for (const p of o.places) {
      const c = centro(p);
      if (chiusa(p)) { // lucchetto sulla nebbia; il nome solo se l'hai già vista
        big.fillStyle = P.neroCaldo; big.fillRect(px(c.x) - 22, px(c.z) - 22, 44, 44);
        drawPix(big, 'lucchetto', px(c.x) - 20, px(c.z) - 20, 5);
        if (!coperta(p) && p.nome) scritta(p.nome, px(c.x), px(c.z) + 40, P.sabbiaChiara, 16);
      } else if (coperta(p)) scritta('?', px(c.x), px(c.z), P.sabbiaChiara, 44);
      else if (p.nome) scritta(p.nome, px(c.x), px((p.z0 + p.h) * T) + 14, P.sabbiaChiara);
    }
    const sg = o.segno?.get() ?? null, punta = sg ? puntaSegno(sg) : null;
    if (punta) { // scia di puntini da te al segnalino, in linea d'aria (sotto le icone)
      const ax = px(last.x), az = px(last.z), n = Math.floor(Math.hypot(punta.x - ax, punta.y - az) / 16);
      for (let i = 2; i < n; i++) punto(big, ax + ((punta.x - ax) * i) / n, az + ((punta.y - az) * i) / n, 4, P.giallo);
    }
    for (const t of o.targets) {
      if (!metaVisibile(t) || !t.icon) continue;
      big.fillStyle = P.neroCaldo; big.fillRect(px(t.x) - 13, px(t.z) - 13, 26, 26);
      drawPix(big, t.icon, px(t.x) - 12, px(t.z) - 12, 3);
    }
    if (punta) drawPix(big, 'segno', Math.round(punta.x) - 20, Math.round(punta.y) - 40, 5);
    paintPie();
    for (const p of lastPeers) { punto(big, px(p.x), px(p.z), 10, P.sabbiaChiara); if (p.nome) scritta(p.nome, px(p.x), px(p.z) - 18, P.sabbiaChiara); }
    freccia(big, px(last.x), px(last.z), last.yaw, 14);
  }

  function drawMini(me: Pose, camYaw: number): void {
    const s = R / (RAGGIO_MINI * 2 / T); // pixel per cella
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.fillStyle = P.acquaProfonda; mg.fillRect(0, 0, R, R);
    // su = davanti alla camera: ruota il mondo di −yaw attorno a te (stessa convenzione di input.ts e compass.ts)
    mg.translate(R / 2, R / 2); mg.rotate(camYaw); mg.scale(s, s); mg.translate(-me.x / T, -me.z / T);
    mg.drawImage(base, 0, 0);
    mg.setTransform(1, 0, 0, 1, 0, 0);
    const toMini = (wx: number, wz: number) => {
      const dx = (wx - me.x) / T * s, dz = (wz - me.z) / T * s, c = Math.cos(camYaw), si = Math.sin(camYaw);
      return { x: R / 2 + dx * c - dz * si, y: R / 2 + dx * si + dz * c };
    };
    for (const t of o.targets) {
      if (!(t.show?.() ?? true) || !t.icon || dentroCoperta(t.x, t.z)) continue;
      const p = toMini(t.x, t.z), d = Math.hypot(p.x - R / 2, p.y - R / 2), maxD = R / 2 - 7;
      const k = d > maxD ? maxD / d : 1; // fuori dal cerchio: sul bordo, verso la meta
      drawPix(mg, t.icon, Math.round(R / 2 + (p.x - R / 2) * k) - 4, Math.round(R / 2 + (p.y - R / 2) * k) - 4, 1);
    }
    const sg = o.segno?.get();
    if (sg) { // il segnalino sopra le mete, anche nella nebbia; lontano: sul bordo
      const p = toMini(sg.x, sg.z), d = Math.hypot(p.x - R / 2, p.y - R / 2), maxD = R / 2 - 7, k = d > maxD ? maxD / d : 1;
      drawPix(mg, 'segno', Math.round(R / 2 + (p.x - R / 2) * k) - 4, Math.round(R / 2 + (p.y - R / 2) * k) - 4, 1);
    }
    for (const pe of lastPeers) { const p = toMini(pe.x, pe.z); if (Math.hypot(p.x - R / 2, p.y - R / 2) < R / 2 - 3) punto(mg, p.x, p.y, 3, P.sabbiaChiara); }
    freccia(mg, R / 2, R / 2, me.yaw + camYaw, 5);
    // il nord (−Z) sul bordo, girato con la camera: stessa rotazione del disegno
    const r = mini.clientWidth / 2;
    nord.style.left = `${r + Math.sin(camYaw) * (r - 4)}px`; nord.style.top = `${r - Math.cos(camYaw) * (r - 4)}px`;
  }

  let nextScopri = 0, nextMini = 0;
  registerStateProvider('mappa', () => ({ open, viste: [...viste], coperte: o.places.filter(coperta).map((p) => p.id), chiuse: o.places.filter(chiusa).map((p) => p.id), mini: mini.style.visibility !== 'hidden' && getComputedStyle(mini).visibility !== 'hidden' }));
  /** Test (#144): dove sta sullo schermo il punto (x, z) del mondo nella mappa grande aperta (per toccarlo). */
  registerTestHook('mappaSchermo', (wx, wz) => { const r = bc.getBoundingClientRect(), sc = r.width / bc.width; return { x: r.left + px(Number(wx)) * sc, y: r.top + px(Number(wz)) * sc }; });
  registerTestHook('mappa', (v) => { if (v === 'apri') show(); else if (v === 'chiudi') close(); else toggle(); return open; });
  registerTestHook('mappaScopri', (id) => { if (typeof id === 'string') viste.add(id); else for (const p of o.places) viste.add(p.id); save({ viste: [...viste] }); paintBase(); if (open) drawBig(); });

  return {
    update(me, camYaw, peers) {
      last = me; lastPeers = peers; lastYaw = camYaw;
      const now = performance.now();
      if (now >= nextScopri) { // ogni ½ s: isole vicine scoperte
        nextScopri = now + 500;
        let nuove = false;
        for (const p of o.places) {
          if (!coperta(p)) continue;
          const dx = Math.max(p.x0 * T - me.x, 0, me.x - (p.x0 + p.w) * T), dz = Math.max(p.z0 * T - me.z, 0, me.z - (p.z0 + p.h) * T);
          if (Math.hypot(dx, dz) < SCOPRI_M) { viste.add(p.id); nuove = true; }
        }
        if (nuove) save({ viste: [...viste] });
        const f = firmaChiuse(); // un'isola a tema appena sbloccata: via la nebbia
        if (nuove || f !== chiuseFirma) { chiuseFirma = f; paintBase(); }
      }
      if (open && o.hidden?.()) close();
      if (now >= nextMini) { nextMini = now + 66; drawMini(me, lastYaw); if (open) drawBig(); } // 15 volte al secondo bastano
    },
    toggle, close, isOpen: () => open,
    vista: (id) => viste.has(id),
    evidenzia(on) { mini.classList.toggle('qui', on); },
  };
}
