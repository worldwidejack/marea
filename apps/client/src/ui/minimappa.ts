// Minimappa (#62): un cerchio in alto a destra (telefono) o in basso a destra sopra il bottone A (PC) con l'arcipelago attorno a te, girato come la
// camera; toccandolo o premendo M si apre la mappa intera, con te, gli amici, le mete della bussola e i nomi delle isole.
// Le isole non ancora visitate stanno sotto la nebbia (Porto e la tua isola si vedono da subito): ci passi vicino in barca e
// si scoprono. Le scoperte restano su questo dispositivo (localStorage). Un'isola chiusa (es. la Tempesta) resterà nella nebbia
// finché non la sblocchi, perché non ci puoi arrivare. Disegno su <canvas> a pixel con la palette: un pixel per cella della mappa.
import type { GridMap, Tile } from '@marea/sim';
import { drawPix } from './icons.ts';
import type { PixId } from './icons.ts';
import { PAL } from './style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

const P = PAL;
const STORE = 'marea:mappa';
/** Raggio (m) della minimappa e distanza (m) dal bordo di un'isola entro cui la scopri. */
const RAGGIO_MINI = 100, SCOPRI_M = 55;
/** Pixel della tela della mappa grande per cella. */
const K = 3;
const TILE_COL: Record<Tile, string> = {
  '~': P.acquaProfonda, ',': P.acqua, B: P.acqua, '.': P.sabbia, P: P.sabbia, L: P.sabbia, g: P.erba, r: P.roccia, d: P.legno,
};
const NEBBIA = [P.pietraChiara, P.pietra];

export type MappaPlace = { id: string; nome: string; x0: number; z0: number; w: number; h: number; sempre?: boolean };
export type MappaTarget = { id: string; label: string; x: number; z: number; icon?: PixId; show?(): boolean };
export type Pose = { x: number; z: number; yaw: number };
export type Minimappa = { update(me: Pose, cameraYaw: number, peers: readonly { nome?: string; x: number; z: number }[]): void; toggle(): void; close(): void; isOpen(): boolean };

const CSS = `
#mzMini { position: absolute; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 136px); /* sopra il bottone A (84 px a 36 px dal fondo) */ width: 148px; height: 148px; z-index: 13; cursor: pointer; padding: 0; border: none; background: none; }
#mzMini canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; border-radius: 50%; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; box-sizing: border-box; background: ${P.abisso}; }
#mzMini .n { position: absolute; left: 50%; top: 0; transform: translate(-50%, -50%); font: bold 11px ui-monospace, Menlo, monospace; color: ${P.giallo}; text-shadow: 0 1px 0 ${P.neroCaldo}, 1px 0 0 ${P.neroCaldo}, -1px 0 0 ${P.neroCaldo}; pointer-events: none; }
#mzMini:focus { outline: none; } #mzMini:focus-visible canvas { border-color: ${P.giallo}; }
@media (max-width: 699px) { #mzMini { width: 92px; height: 92px; bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 58px); } }
#mzMappa { position: absolute; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 8px; background: rgba(22,63,115,.9); padding: 12px; box-sizing: border-box; }
#mzMappa.on { display: flex; }
#mzMappa .fr { position: relative; max-width: 100%; max-height: calc(100% - 56px); aspect-ratio: var(--ar); background: ${P.abisso}; border: 3px solid ${P.legnoChiaro}; box-shadow: 0 4px 0 ${P.neroCaldo}; }
#mzMappa canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
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
}): Minimappa {
  if (!document.getElementById('mz-mini-style')) { const st = document.createElement('style'); st.id = 'mz-mini-style'; st.textContent = CSS; document.head.appendChild(st); }
  const { map } = o, T = map.tile, W = map.w, H = map.h;
  const viste = new Set(load().viste ?? []);
  for (const p of o.places) if (p.sempre) viste.add(p.id);
  const coperta = (p: MappaPlace) => !viste.has(p.id);

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
      if (!coperta(p)) continue;
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
  const dentroCoperta = (x: number, z: number) => o.places.some((p) => coperta(p) && x >= p.x0 * T && x <= (p.x0 + p.w) * T && z >= p.z0 * T && z <= (p.z0 + p.h) * T);

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
  fr.appendChild(bc); ov.append(hd, fr); guard(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  x.addEventListener('click', () => close());
  o.root.appendChild(ov);
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

  function drawBig(): void {
    big.clearRect(0, 0, bc.width, bc.height);
    big.drawImage(base, 0, 0, bc.width, bc.height);
    const px = (m: number) => (m / T) * K;
    big.font = 'bold 20px ui-monospace, Menlo, monospace'; big.textAlign = 'center'; big.textBaseline = 'middle'; big.lineJoin = 'round';
    const scritta = (t: string, cx: number, cy: number, col: string, size = 20) => { big.font = `bold ${size}px ui-monospace, Menlo, monospace`; big.lineWidth = size / 4; big.strokeStyle = P.neroCaldo; big.strokeText(t, cx, cy); big.fillStyle = col; big.fillText(t, cx, cy); };
    for (const p of o.places) {
      const c = centro(p);
      if (coperta(p)) scritta('?', px(c.x), px(c.z), P.sabbiaChiara, 44);
      else if (p.nome) scritta(p.nome, px(c.x), px((p.z0 + p.h) * T) + 14, P.sabbiaChiara);
    }
    for (const t of o.targets) {
      if (!(t.show?.() ?? true) || !t.icon || dentroCoperta(t.x, t.z)) continue;
      big.fillStyle = P.neroCaldo; big.fillRect(px(t.x) - 13, px(t.z) - 13, 26, 26);
      drawPix(big, t.icon, px(t.x) - 12, px(t.z) - 12, 3);
    }
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
    for (const pe of lastPeers) { const p = toMini(pe.x, pe.z); if (Math.hypot(p.x - R / 2, p.y - R / 2) < R / 2 - 3) punto(mg, p.x, p.y, 3, P.sabbiaChiara); }
    freccia(mg, R / 2, R / 2, me.yaw + camYaw, 5);
    // il nord (−Z) sul bordo, girato con la camera: stessa rotazione del disegno
    const r = mini.clientWidth / 2;
    nord.style.left = `${r + Math.sin(camYaw) * (r - 4)}px`; nord.style.top = `${r - Math.cos(camYaw) * (r - 4)}px`;
  }

  let nextScopri = 0, nextMini = 0;
  registerStateProvider('mappa', () => ({ open, viste: [...viste], coperte: o.places.filter(coperta).map((p) => p.id), mini: mini.style.visibility !== 'hidden' && getComputedStyle(mini).visibility !== 'hidden' }));
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
        if (nuove) { save({ viste: [...viste] }); paintBase(); }
      }
      if (open && o.hidden?.()) close();
      if (now >= nextMini) { nextMini = now + 66; drawMini(me, lastYaw); if (open) drawBig(); } // 15 volte al secondo bastano
    },
    toggle, close, isOpen: () => open,
  };
}
