// Animali e mondo vivo (#67): gabbiani sopra Porto e coste (si posano su lanterne, torii e moli e ripartono quando arrivi), gatti
// sui moli (dormono, si stiracchiano, ti seguono per qualche metro, fanno le fusa con A o un tocco), pesci che saltano vicino a te,
// granchi che scappano di lato, delfini accanto alla barca veloce in mare aperto, lucciole di notte col ciclo acceso.
// Solo resa lato client. Tutti gli animali vicini a chi gioca finiscono in UNA mesh rifatta a ogni frame (le forme copiate e girate
// sulla CPU: pochi migliaia di triangoli) → 1 draw call (+1 nell'ombra); le lucciole, che brillano, in una seconda mesh non illuminata.
// Si scarica con import() subito dopo l'avvio (main.ts, blocco «Animali (#67)»): il JS iniziale ha un tetto.
import * as THREE from 'three';
import { canBoard, createRng } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Hud } from '../ui/hud.ts';
import { PAL, el } from '../ui/style.ts';
import { creaForme, LUCI_LUCCIOLA, MANTELLI, SQUAME } from '../render/animali_forme.ts';
import { acqua, aggiornaGabbiano, aggiornaGatto, aggiornaGranchio, disegnaSalto, nuoviGabbiani, prua } from './animali_vita.ts';
import type { Chi, Disegna, Gabbiano, Gatto, Granchio, Mondo, Posatoio, Salto, Stormo, XZ } from './animali_vita.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Animali = { tick(a: boolean): void; update(dt: number, t: number): void; dispose(): void };
/** Fin dove (m da chi gioca) gli animali si muovono e si disegnano: oltre la camera più larga non si vedono. */
const RAGGIO = 48;
const MAX_V = 36000, MAX_V_LUCI = 1200, N_LUCCIOLE = 24;

/** Mesh dinamica: le forme vengono scritte (girate e spostate) in un unico buffer a ogni frame. */
function pennello(max: number, mat: THREE.Material, nome: string) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  const g = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), ca = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', pa); g.setAttribute('color', ca); g.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(g, mat); mesh.name = nome; mesh.frustumCulled = false;
  let n = 0;
  const put: Disegna = (f, x, y, z, h, pitch = 0, roll = 0, s = 1, c1, c2) => {
    if (n + f.n > max) return;
    // R = Ry(−h) · Rx(pitch) · Rz(roll) · s
    const cy = Math.cos(-h), sy = Math.sin(-h), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const a00 = cr, a01 = -sr, a10 = cp * sr, a11 = cp * cr, a12 = -sp, a20 = sp * sr, a21 = sp * cr, a22 = cp; // Rx·Rz (a02 = 0)
    const m00 = (cy * a00 + sy * a20) * s, m01 = (cy * a01 + sy * a21) * s, m02 = sy * a22 * s;
    const m10 = a10 * s, m11 = a11 * s, m12 = a12 * s;
    const m20 = (-sy * a00 + cy * a20) * s, m21 = (-sy * a01 + cy * a21) * s, m22 = cy * a22 * s;
    const P = f.pos, C = f.col, K = f.ch;
    for (let i = 0, o = n * 3; i < f.n; i++, o += 3) {
      const px = P[i * 3]!, py = P[i * 3 + 1]!, pz = P[i * 3 + 2]!;
      pos[o] = x + m00 * px + m01 * py + m02 * pz; pos[o + 1] = y + m10 * px + m11 * py + m12 * pz; pos[o + 2] = z + m20 * px + m21 * py + m22 * pz;
      const k = K[i], c = k === 1 ? c1 : k === 2 ? c2 : null;
      if (c) { col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; } else { col[o] = C[i * 3]!; col[o + 1] = C[i * 3 + 1]!; col[o + 2] = C[i * 3 + 2]!; }
    }
    n += f.n;
  };
  return {
    mesh, put,
    begin() { n = 0; },
    end() {
      g.setDrawRange(0, n); mesh.visible = n > 0;
      if (!n) return;
      pa.clearUpdateRanges(); pa.addUpdateRange(0, n * 3); pa.needsUpdate = true;
      ca.clearUpdateRanges(); ca.addUpdateRange(0, n * 3); ca.needsUpdate = true;
    },
    get n() { return n; },
  };
}

// ———— cuoricino a pixel (fusa): 12×11, rosso con riflesso, contorno nero caldo ————
const CUORE = ['.oo...oo.', 'orro.orro', 'orwrorrro', 'orrrrrrro', 'orrrrrrro', '.orrrrro.', '..orrro..', '...oro...', '....o....'];
function cuore(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 9; c.height = 9; c.className = 'mz-ico';
  c.style.width = c.style.height = size + 'px'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d'), col: Record<string, string> = { o: PAL.neroCaldo, r: PAL.rosso, w: PAL.sabbiaChiara };
  if (g) CUORE.forEach((row, y) => [...row].forEach((k, x) => { const f = col[k]; if (f) { g.fillStyle = f; g.fillRect(x, y, 1, 1); } }));
  return c;
}

export function createAnimali(o: { world: GameWorld; camera: THREE.Camera; canvas: HTMLCanvasElement; root: HTMLElement; hud?: Hud; buio?: () => number;
  /** Diario del capitano (#87): un animale passato vicino a chi gioca (una volta per specie a sessione). */
  avvista?: (id: 'gabbiano' | 'gatto' | 'granchio' | 'pesce' | 'delfino' | 'lucciola') => void }): Animali {
  const w = o.world, map = w.map, arch = w.archipelago, T = map.tile;
  const rng = createRng(`animali:${arch.id}`);
  const mondo: Mondo = { map, groundY: w.groundY, rng: rng.fork('vita') };
  const F = creaForme();
  const corpi = pennello(MAX_V, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 'animali');
  corpi.mesh.castShadow = true;
  const luci = pennello(MAX_V_LUCI, new THREE.MeshBasicMaterial({ vertexColors: true }), 'lucciole');
  w.scene.add(corpi.mesh, luci.mesh);
  const col = (hex: string) => new THREE.Color(hex);

  // ———— dove stanno: dai dati dell'arcipelago ————
  const tileAt = (cx: number, cz: number) => map.at(cx, cz);
  const centro = (cx: number, cz: number): XZ => ({ x: (cx + 0.5) * T, z: (cz + 0.5) * T });
  const stormi: Stormo[] = [], gatti: Gatto[] = [], granchi: Granchio[] = [];
  let nGatto = 0;
  for (const p of arch.places) {
    const r = rng.fork(`posto:${p.index}`);
    const docks: { cx: number; cz: number }[] = [], rive: { cx: number; cz: number }[] = [];
    for (let cz = p.origin[1]; cz < p.origin[1] + p.h; cz++) for (let cx = p.origin[0]; cx < p.origin[0] + p.w; cx++) {
      const k = tileAt(cx, cz);
      if (k === 'd') docks.push({ cx, cz });
      else if (k === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => tileAt(cx + dx!, cz + dz!) === ',')) rive.push({ cx, cz });
    }
    const x0 = p.origin[0] * T, z0 = p.origin[1] * T, x1 = (p.origin[0] + p.w) * T, z1 = (p.origin[1] + p.h) * T;
    const qui = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
    // posatoi: cima dei pali delle lanterne, architrave del torii, bordi dei moli verso l'acqua
    const posatoi: Posatoio[] = [];
    for (const q of arch.props) {
      if (!qui(q.x, q.z)) continue;
      const y0 = w.groundY(q.x, q.z);
      if (q.k === 'lanterna') posatoi.push({ x: q.x, y: y0 + 2.0, z: q.z, preso: null });
      if (q.k === 'torii') for (const lx of [-1.1, -0.35, 0.4, 1.15]) posatoi.push({ x: q.x + lx * Math.cos(q.rot), y: y0 + 3.06, z: q.z - lx * Math.sin(q.rot), preso: null });
    }
    for (const d of docks) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = tileAt(d.cx + dx, d.cz + dz);
        if ((k === ',' || k === '~') && r.next() < 0.35) { const c = centro(d.cx, d.cz); posatoi.push({ x: c.x + dx * 0.75, y: w.groundY(c.x, c.z), z: c.z + dz * 0.75, preso: null }); }
      }
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const vicini = (c: XZ, d: number) => posatoi.filter((q) => Math.hypot(q.x - c.x, q.z - c.z) < d);
    if (p.role === 'porto') {
      const molo = p.boat;
      stormi.push({ c: { x: molo.x, z: molo.z - 6 }, r: 8, h: 10, dir: 1, posatoi: vicini({ x: molo.x, z: molo.z - 6 }, 18) });
      stormi.push({ c: { x: cx, z: cz }, r: 10, h: 12, dir: -1, posatoi: [] });
    } else stormi.push({ c: { x: p.boat.x, z: p.boat.z - 5 }, r: 7, h: 9 + r.next() * 3, dir: r.next() < 0.5 ? 1 : -1, posatoi: vicini(p.boat, 16) });
    // gatti: 3 al Porto, 1 su ogni lotto; casa su una cella di molo, giro tra molo e sabbia lì attorno
    const nG = p.role === 'porto' ? 3 : p.role === 'lotto' ? 1 : 0;
    const terra = (c: { cx: number; cz: number }) => { const k = tileAt(c.cx, c.cz); return k === 'd' || k === '.'; };
    for (let i = 0; i < nG && docks.length; i++) {
      const d = docks[Math.floor(r.next() * docks.length)]!, casa = centro(d.cx, d.cz);
      const area: XZ[] = [];
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (terra({ cx: d.cx + dx, cz: d.cz + dz })) area.push(centro(d.cx + dx, d.cz + dz));
      const [m1, m2] = MANTELLI[(nGatto++ * 5 + p.index) % MANTELLI.length]!;
      const stato = (['dorme', 'siede', 'cammina'] as const)[i % 3]!;
      gatti.push({ x: casa.x + (r.next() - 0.5), z: casa.z + (r.next() - 0.5), h: r.next() * 6.28, casa, area, mantello: [col(m1), col(m2)], stato, fino: r.next() * 12, meta: area[0] ?? casa, passo: 0, seguito: 0, calma: 0 });
    }
    // granchi: 3 sulla sabbia vicino all'acqua bassa (Porto, lotti, Selvaggia)
    for (let i = 0; i < 3 && rive.length && (p.role === 'porto' || p.role === 'lotto' || p.island === 'selvaggia'); i++) {
      const c = rive[Math.floor(r.next() * rive.length)]!, casa = centro(c.cx, c.cz);
      granchi.push({ casa, b: { ...casa }, x: casa.x, z: casa.z, h: r.next() * 6.28, stato: 'fermo', fino: 0, meta: casa, fase: r.next() * 6.28, lontano: 0 });
    }
  }
  const gabbiani: Gabbiano[] = nuoviGabbiani(stormi, rng.fork('gabbiani'), 0);
  // Diario del capitano (#87): ogni specie si segnala una volta sola, quando passa davvero vicino
  const avvistati = new Set<string>();
  const avvista = (id: 'gabbiano' | 'gatto' | 'granchio' | 'pesce' | 'delfino' | 'lucciola') => { if (!o.avvista || avvistati.has(id)) return; avvistati.add(id); o.avvista(id); };
  const rVita = rng.fork('salti');

  // ———— chi gioca ————
  const chi = (): Chi & { y: number } => {
    const walk = w.mode === 'walk', p = walk ? w.avatar.object.position : w.boat.object.position, s = walk ? w.avatar.state : w.boat.state;
    return { x: p.x, z: p.z, y: p.y, walk, moving: walk ? w.avatar.state.anim !== 'idle' : Math.abs(w.boat.state.speed) > 0.3, yaw: Number.isFinite(s.yaw) ? s.yaw : 0, speed: walk ? 0 : w.boat.state.speed };
  };

  const vec = new THREE.Vector3();
  /** Il punto si vede, con un margine (frazione dello schermo) dai bordi. */
  const inVista = (x: number, y: number, z: number, m: number) => { vec.set(x, y, z).project(o.camera); return vec.z > -1 && vec.z < 1 && Math.abs(vec.x) < 1 - m && Math.abs(vec.y) < 1 - m; };
  // ———— pesci che saltano ————
  const salti: Salto[] = [];
  let prossimoSalto = 3, nSalti = 0;
  const salta = (c: Chi, t: number): boolean => {
    // prima si cerca un punto d'acqua che si veda bene sullo schermo, poi uno qualsiasi
    for (let i = 0; i < 24; i++) {
      const a = rVita.next() * Math.PI * 2, d = 4 + rVita.next() * (c.walk ? 8 : 7);
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, dir = rVita.next() * Math.PI * 2, dx = Math.cos(dir), dz = Math.sin(dir);
      if (!acqua(mondo, x, z) || !acqua(mondo, x + dx * 2.4, z + dz * 2.4) || !acqua(mondo, x + 1.2, z) || !acqua(mondo, x - 1.2, z)) continue;
      if (i < 16 && (!inVista(x, 0.6, z, 0.25) || !inVista(x + dx * 2.2, 0.6, z + dz * 2.2, 0.25))) continue;
      if (!c.walk && Math.hypot(x - c.x, z - c.z) < 3) continue;
      const [c1, c2] = SQUAME[Math.floor(rVita.next() * SQUAME.length)]!;
      const s: Salto = { x, z, dx, dz, t0: t, dur: 0.95, len: 2.2, alto: 1.2 + rVita.next() * 0.5, c1: col(c1), c2: col(c2) };
      salti.push(s); nSalti++;
      if (rVita.next() < 0.25) salti.push({ ...s, x: x - dz * 0.7, z: z + dx * 0.7, t0: t + 0.3, alto: s.alto * 0.8 }); // a volte in due
      return true;
    }
    return false;
  };

  // ———— delfini: accanto alla barca veloce in mare aperto ————
  let delfiniSu = 0, delfiniGiu = 0, delfiniOn = false, delfiniVisti = 0, delfiniN = 0;
  // ———— lucciole ————
  const lucciole = Array.from({ length: N_LUCCIOLE }, (_, i) => ({ a: null as XZ | null, f: i * 1.37, k: 0.7 + (i % 5) * 0.13 }));
  const cLucciola = LUCI_LUCCIOLA.map(col);
  let accese = 0;

  // ———— fusa: A da fermo accanto a un gatto, o un tocco sul gatto ————
  const strato = el('div'); strato.id = 'mzAnimali';
  Object.assign(strato.style, { position: 'absolute', inset: '0', overflow: 'hidden', zIndex: '6', pointerEvents: 'none' });
  o.root.appendChild(strato);
  type Fumetto = { k: Gatto; el: HTMLElement; fino: number };
  const fumetti: Fumetto[] = [];
  let fusaTot = 0, aWas = false, suggerito = false, attivi = true;

  const schermo = (x: number, y: number, z: number) => {
    vec.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((vec.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - vec.y) / 2) * r.height, on: vec.z > -1 && vec.z < 1 && Math.abs(vec.x) < 1.05 && Math.abs(vec.y) < 1.05 };
  };
  let tNow = 0;
  const fusa = (k: Gatto) => {
    const c = chi();
    k.stato = 'fusa'; k.fino = tNow + 3.2; k.h = prua(c.x - k.x, c.z - k.z); k.calma = tNow + 6; fusaTot++;
    for (const f of fumetti.splice(0)) f.el.remove();
    const e = el('div', 'mz mz-emote'); e.dataset['who'] = 'gatto';
    const b = el('div', 'mz-emote-b'); b.append(cuore(22), el('span', '', 'Rrr rrr'));
    e.appendChild(b); strato.appendChild(e);
    fumetti.push({ k, el: e, fino: tNow + 2.6 });
  };
  const gattoVicino = (d: number): Gatto | null => {
    const c = chi(); let best: Gatto | null = null, bd = d;
    for (const k of gatti) { const dd = Math.hypot(k.x - c.x, k.z - c.z); if (dd < bd) { bd = dd; best = k; } }
    return best;
  };
  const puoi = () => attivi && w.mode === 'walk' && !w.frozen && !w.race.on;
  let giu: { id: number; x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { giu = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    const d = giu; giu = null;
    if (!d || d.id !== e.pointerId || performance.now() - d.t > 450 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || !puoi()) return;
    if (document.elementFromPoint(e.clientX, e.clientY) !== o.canvas) return;
    const rr = o.root.getBoundingClientRect(), c = chi();
    let best: Gatto | null = null, bd = 44;
    for (const k of gatti) {
      if (Math.hypot(k.x - c.x, k.z - c.z) > 8) continue;
      const s = schermo(k.x, w.groundY(k.x, k.z) + 0.3, k.z), dd = Math.hypot(s.x - (e.clientX - rr.left), s.y - (e.clientY - rr.top));
      if (s.on && dd < bd) { bd = dd; best = k; }
    }
    if (best) fusa(best);
  };
  o.canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp);

  registerStateProvider('animali', () => {
    const c = chi(), vic = (p: XZ) => Math.hypot(p.x - c.x, p.z - c.z) < RAGGIO;
    const gv = gabbiani.filter((g) => vic(g.p));
    const stati: Record<string, number> = {};
    for (const k of gatti) if (vic(k)) stati[k.stato] = (stati[k.stato] ?? 0) + 1;
    return {
      attivi, tris: (corpi.n + luci.n) / 3,
      gabbiani: { tot: gabbiani.length, vicini: gv.length, posati: gv.filter((g) => g.stato === 'posato').length, inVolo: gv.filter((g) => g.stato !== 'posato').length },
      gatti: { tot: gatti.length, vicini: Object.values(stati).reduce((a, b) => a + b, 0), stati, fusa: fusaTot, fumetto: fumetti.length > 0 },
      pesci: { salti: nSalti, ora: salti.length }, granchi: { tot: granchi.length, vicini: granchi.filter(vic).length, sotto: granchi.filter((g) => g.stato === 'sotto').length },
      delfini: delfiniOn ? delfiniN : 0, delfiniFuori: delfiniOn ? delfiniVisti : 0, lucciole: accese,
    };
  });
  registerTestHook('animali', (on) => { attivi = on !== false; if (!attivi) { corpi.begin(); corpi.end(); luci.begin(); luci.end(); } return attivi; });
  registerTestHook('pesce', () => salta(chi(), tNow));
  /** Il gatto più vicino lontano dalla barca (lì A fa salire a bordo) e un punto calpestabile accanto a lui, dove mettersi per le fusa. */
  registerTestHook('gatto', () => {
    const c = chi(), b = w.boat.state;
    const k = gatti.filter((g) => Math.hypot(g.x - b.x, g.z - b.z) > 5).sort((a, q) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0];
    if (!k) return null;
    const accanto = [[1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]].map(([dx, dz]) => ({ x: k.x + dx!, z: k.z + dz! })).find((q) => map.walkable(q.x, q.z)) ?? null;
    return { x: k.x, z: k.z, stato: k.stato, accanto };
  });
  /** Per guardare le forme da vicino (test e prove di look): tutte le pose in fila davanti a (x, z) per `s` secondi. */
  let vetrina: { x: number; z: number; fino: number } | null = null;
  registerTestHook('vetrina', (x, z, s) => { vetrina = { x: Number(x), z: Number(z), fino: tNow + Number(s ?? 30) }; });
  registerTestHook('fermaGatti', () => { for (const k of gatti) { k.stato = 'siede'; k.fino = tNow + 60; k.calma = tNow + 60; } }); // per gli screenshot: stanno fermi dove sono

  const aggiorna = (dt: number, t: number): void => {
    const c = chi(), vic = (p: XZ, d = RAGGIO) => Math.hypot(p.x - c.x, p.z - c.z) < d;
    corpi.begin(); luci.begin();
    const draw = corpi.put;
    if (vetrina && t < vetrina.fino) {
      const v = vetrina, y = w.groundY(v.x, v.z), [m1, m2] = MANTELLI[0]!.map(col) as [THREE.Color, THREE.Color], [s1, s2] = SQUAME[1]!.map(col) as [THREE.Color, THREE.Color];
      const fila: [Parameters<Disegna>[0], number, THREE.Color?, THREE.Color?][] = [
        [F.gabbiano.posato, 0], [F.gabbiano.su, 0.6], [F.gabbiano.mezzo, 0.6], [F.gabbiano.giu, 0.6],
        [F.gatto.seduto, 0, m1, m2], [F.gatto.fusa, 0, m1, m2], [F.gatto.dorme, 0, m1, m2], [F.gatto.stira, 0, m1, m2], [F.gatto.cammina[0], 0, m1, m2],
        [F.granchio[0], 0], [F.pesce, 0.4, s1, s2], [F.spruzzo[1], 0], [F.delfino, 0.5],
      ];
      const cam = o.camera.position, hv = prua(cam.x - v.x, cam.z - v.z) + 0.6; // di tre quarti verso la camera
      fila.forEach(([f, dy, a, b], i) => draw(f, v.x + (i % 7) * 1.6 - 4.8, y + dy, v.z + Math.floor(i / 7) * 2.2, hv, 0, 0, f === F.granchio[0] ? 1.3 : f === F.pesce ? 1.4 : 1, a, b));
    }
    for (const g of gabbiani) aggiornaGabbiano(g, t, c, mondo.rng, F.gabbiano, vic(g.s.c, RAGGIO + 15) ? draw : null);
    for (const k of gatti) aggiornaGatto(k, mondo, t, dt, c, F.gatto, vic(k) ? draw : null);
    for (const g of granchi) if (vic(g, RAGGIO)) aggiornaGranchio(g, mondo, t, dt, c, F.granchio, draw);
    if (o.avvista) { // Diario del capitano (#87)
      if (gabbiani.some((g) => vic(g.p, 15))) avvista('gabbiano');
      if (gatti.some((k) => vic(k, 8))) avvista('gatto');
      if (granchi.some((g) => vic(g, 8))) avvista('granchio');
    }
    // pesci: ogni tanto, più spesso in barca
    if (t >= prossimoSalto) { if (salta(c, t)) avvista('pesce'); prossimoSalto = t + (c.walk ? 3 + rVita.next() * 4 : 1.8 + rVita.next() * 2.7); }
    for (let i = salti.length - 1; i >= 0; i--) if (!disegnaSalto(salti[i]!, t, F, draw)) salti.splice(i, 1);
    // delfini: in barca, veloce, su acqua profonda
    const largo = !c.walk && c.speed > 5 && (() => { const q = map.worldToCell(c.x, c.z); return map.at(q.cx, q.cz) === '~'; })();
    if (largo) { delfiniSu += dt; delfiniGiu = 0; } else { delfiniGiu += dt; delfiniSu = 0; }
    if (delfiniSu > 0.8) delfiniOn = true; else if (delfiniGiu > 2.5) delfiniOn = false;
    delfiniVisti = 0;
    if (delfiniOn) {
      const fx = Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = Math.sin(c.yaw);
      const posti = c.speed > 8 ? [[2.8, -0.4], [-2.9, 0.8], [4.3, 1.9]] : [[2.8, -0.4], [-2.9, 0.8]];
      delfiniN = posti.length;
      posti.forEach(([lat, avanti], i) => {
        const along = avanti! + 0.7 * Math.sin(t * 0.5 + i * 2), x = c.x + rx * lat! + fx * along, z = c.z + rz * lat! + fz * along;
        if (!acqua(mondo, x, z)) return;
        // salti a delfino: fuori dall'acqua per il 60 % del giro, spruzzo dove esce e dove rientra
        const p = ((t + i * 0.45) / 1.4) % 1;
        if (p < 0.1) draw(F.spruzzo[Math.min(2, Math.floor(p / 0.034))]!, x - fx * 1.0, 0.02, z - fz * 1.0, 0);
        if (p > 0.6 && p < 0.7) draw(F.spruzzo[Math.min(2, Math.floor((p - 0.6) / 0.034))]!, x + fx * 1.2, 0.02, z + fz * 1.2, 0);
        if (p >= 0.6) return;
        const u = p / 0.6;
        draw(F.delfino, x, -0.75 + 1.1 * Math.sin(Math.PI * u), z, c.yaw, 0.6 * Math.cos(Math.PI * u), 0, 1.25);
        delfiniVisti++;
      });
    }
    // lucciole: col buio, sull'erba attorno a chi gioca
    const buio = o.buio?.() ?? 0;
    accese = 0;
    if (buio > 0.3) {
      const quante = Math.round(N_LUCCIOLE * Math.min(1, (buio - 0.3) / 0.5));
      for (let i = 0; i < quante; i++) {
        const l = lucciole[i]!;
        const ciclo = (t * 0.9 + l.f) % 2.4, acc = ciclo < 1.5;
        if (!l.a || (!acc && !vic(l.a, 13))) {
          l.a = null;
          for (let k = 0; k < 4 && !l.a; k++) {
            const a = mondo.rng.next() * Math.PI * 2, d = 1.5 + mondo.rng.next() * 7, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
            const q = map.worldToCell(x, z); if (map.at(q.cx, q.cz) === 'g') l.a = { x, z };
          }
        }
        if (!l.a || !acc) continue;
        const y = w.groundY(l.a.x, l.a.z) + 0.9 + 0.5 * Math.sin(t * 0.6 * l.k + l.f);
        luci.put(F.lucciola, l.a.x + 0.9 * Math.sin(t * 0.37 * l.k + l.f), y, l.a.z + 0.9 * Math.cos(t * 0.29 / l.k + l.f * 2), 0, 0, 0, ciclo < 0.15 || ciclo > 1.35 ? 0.6 : 1, cLucciola[i % cLucciola.length]);
        accese++;
      }
    }
    if (delfiniVisti > 0) avvista('delfino');
    if (accese > 0) avvista('lucciola');
    corpi.end(); luci.end();
    // fumetti delle fusa e suggerimento la prima volta che ti fermi accanto a un gatto
    for (let i = fumetti.length - 1; i >= 0; i--) {
      const f = fumetti[i]!;
      if (t >= f.fino) { f.el.remove(); fumetti.splice(i, 1); continue; }
      const s = schermo(f.k.x, w.groundY(f.k.x, f.k.z) + 0.75, f.k.z);
      f.el.style.visibility = s.on ? 'visible' : 'hidden';
      f.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y) - 10}px) translate(-50%, -100%)`;
      f.el.style.opacity = f.fino - t < 0.3 ? String(Math.max(0, (f.fino - t) / 0.3)) : '1';
    }
    if (!suggerito && c.walk && !c.moving && puoi() && gattoVicino(1.9) && !canBoard(w.avatar.state, w.boat.state, map)) {
      suggerito = true; o.hud?.toast(matchMedia('(pointer: coarse)').matches ? 'A · accarezza il gatto' : 'E · accarezza il gatto', 2500);
    }
  };

  const api: Animali = {
    tick(a) {
      const press = a && !aWas; aWas = a;
      if (!press || !puoi()) return;
      const k = gattoVicino(1.9);
      if (k && !canBoard(w.avatar.state, w.boat.state, map)) fusa(k);
    },
    update(dt, t) {
      tNow = t;
      if (!attivi) return;
      // gli animali sono contorno: se qualcosa qui si rompe si spengono, il gioco no
      try { aggiorna(dt, t); } catch (e) { attivi = false; corpi.begin(); corpi.end(); luci.begin(); luci.end(); console.error('[marea] animali spenti', e); }
    },
    dispose() {
      o.canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp);
      corpi.mesh.removeFromParent(); luci.mesh.removeFromParent(); corpi.mesh.geometry.dispose(); luci.mesh.geometry.dispose(); strato.remove();
    },
  };
  return api;
}
