// Il menù d'ingresso dei Templari (docs/TEMPLARI.md §4b, 14 ott 2026, scelte di birbasan): SCEGLI L'EROE prima di entrare nella chiesa,
// da solo e prima della sala di GIOCA INSIEME. Tre eroi (templari.json `eroi`): il tuo avatar di MAREA col vestito dell'eroe
// (rpg/vestito_templari.ts) e la sua arma in mano, che gira su una pedana di pietra con la croce rossa, nella cripta a lume di candela.
// Come il menù delle Corse: a sinistra le carte degli eroi, a destra il pannello col nome, quattro barre (vita, forza, velocità, mira),
// il super e le armi di partenza, sotto il bottone grande DEUS VULT. Al telefono in verticale: l'eroe in alto, le carte, il pannello, il
// bottone. Tastiera: ← → (o A D, ↑ ↓, W S) cambia, Invio o Spazio parte, Esc torna fuori. L'ultima scelta resta (localStorage).
import * as THREE from 'three';
import type { InputFrame } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import type { TClasse, TEroeDef } from '@marea/content/templari.ts';
import { templari } from '@marea/sim/templari/templari.ts';
import type { TView } from '@marea/sim/templari/types.ts';
import { createHeroActor } from '../rpg/dungeon_hero.ts';
import type { HeroActor } from '../rpg/dungeon_hero.ts';
import { TESTA_TEMPLARI, corpoTemplari } from '../rpg/vestito_templari.ts';
import { suona } from '../audio/ponte.ts';
import { el } from '../ui/style.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { armaVista } from './armi3d.ts';
import type { TemplariCtx } from './types.ts';

export const EROE_KEY = 'mz-templari-eroe';
/** L'ultimo eroe scelto (di serie il primo). */
export function eroeSalvato(): TClasse {
  try { const v = localStorage.getItem(EROE_KEY); if (v && TEMPLARI.eroi.some((e) => e.id === v)) return v as TClasse; } catch { /* niente memoria */ }
  return TEMPLARI.eroi[0]!.id;
}
export function salvaEroe(c: TClasse): void { try { localStorage.setItem(EROE_KEY, c); } catch { /* pazienza */ } }

export type Scelta = {
  /** L'eroe scelto, o null = tornato fuori (Esc, ✕). */
  readonly done: Promise<TClasse | null>;
  step(f: InputFrame): void;
  update(dt: number): void;
};

/** Le icone sullo scudo delle carte (SVG a tinta piena, si colorano col testo). */
const ICONA: Record<TClasse, string> = {
  crociato: '<svg viewBox="0 0 24 24"><path d="M4 3l2 0 9 9-2 2L4 5z M20 3l-2 0-9 9 2 2 9-9z" fill="currentColor"/><path d="M6.5 15.5l2 2-3 3-2-2z M17.5 15.5l-2 2 3 3 2-2z M8 13l3 3 M16 13l-3 3" stroke="currentColor" stroke-width="2.4" fill="currentColor"/></svg>',
  bucaniera: '<svg viewBox="0 0 24 24"><path d="M2 8h16l2-2h2v4h-2l-1 1H11l-1 2v1H8l-1 6H3l2-7H2z" fill="currentColor"/><rect x="11" y="11" width="2" height="3" fill="currentColor"/></svg>',
  arciere: '<svg viewBox="0 0 24 24"><path d="M6 2c8 3 12 9 10 20" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M6 2L16 22" stroke="currentColor" stroke-width="1.2"/><path d="M2 14L20 6M20 6l-4-.5M20 6l-2 3.5M2 14l2.5-2.5M2 14l3 .5" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
};
const BARRE: { k: keyof TEroeDef['barre']; nome: string; colore: string }[] = [
  { k: 'vita', nome: 'Vita', colore: '#E8433F' }, { k: 'forza', nome: 'Forza', colore: '#F2A33A' },
  { k: 'velocita', nome: 'Velocità', colore: '#3FB9C9' }, { k: 'mira', nome: 'Mira', colore: '#8FC35B' },
];

const CSS = `
@font-face { font-family: 'MzTitan'; src: url('/assets/fonts/titan-one-latin.woff2') format('woff2'); font-display: swap; }
.mz-tpl-eroi { position: absolute; inset: 0; z-index: 30; display: none; color: #F4E3C1; font-family: 'MzTitan', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif;
  -webkit-user-select: none; user-select: none; pointer-events: none; --rosso: #E8433F; --scuro: #23201F; --pietra: #4A4340; }
.mz-tpl-eroi.on { display: block; }
.mz-tpl-eroi button { pointer-events: auto; cursor: pointer; -webkit-tap-highlight-color: transparent; font: inherit; color: inherit; margin: 0; border: none; background: none; padding: 0; }
.mz-tpl-eroi .ombra { -webkit-text-stroke: 5px var(--scuro); paint-order: stroke fill; }
.mz-tpl-eroi .titolo { position: absolute; left: 24px; top: max(18px, env(safe-area-inset-top)); display: flex; align-items: center; gap: 12px; padding: 8px 28px 8px 18px;
  background: var(--rosso); border: 4px solid #F4E3C1; box-shadow: 0 6px 0 var(--scuro); transform: skewX(-10deg); }
.mz-tpl-eroi .titolo h2 { margin: 0; font-weight: 400; font-size: 34px; letter-spacing: .02em; transform: skewX(10deg); white-space: nowrap; color: #fff; }
.mz-tpl-eroi .titolo small { transform: skewX(10deg); font-size: 15px; color: #F4E3C1; opacity: .9; }
.mz-tpl-eroi .chiudi { position: absolute; right: 22px; top: max(18px, env(safe-area-inset-top)); width: 52px; height: 52px; border-radius: 50%; background: #F4E3C1; color: var(--scuro);
  border: 4px solid var(--scuro); font-size: 24px; box-shadow: 0 4px 0 rgba(0,0,0,.4); }
.mz-tpl-eroi .carte { position: absolute; left: 24px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 14px; }
.mz-tpl-eroi .carta { width: 220px; display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 2px 10px; padding: 10px 12px; text-align: left;
  background: rgba(35,32,31,.82); border: 4px solid #7F7568; box-shadow: 0 5px 0 rgba(0,0,0,.45); opacity: .78; transition: transform .15s, opacity .15s; }
.mz-tpl-eroi .carta .ico { grid-row: span 2; width: 58px; height: 58px; display: grid; place-items: center; background: #E8E1D6; color: var(--scuro); padding-bottom: 8px; box-sizing: border-box;
  clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%); }
.mz-tpl-eroi .carta b { font-weight: 400; font-size: 20px; }
.mz-tpl-eroi .carta small { font-family: system-ui, sans-serif; font-size: 13px; color: #E2B97F; }
.mz-tpl-eroi .carta.on { opacity: 1; border-color: #F5D547; transform: translateX(10px) scale(1.04); box-shadow: 0 0 0 3px var(--scuro), 0 0 22px rgba(245,213,71,.55), 0 5px 0 rgba(0,0,0,.45); }
.mz-tpl-eroi .carta .ico svg { width: 30px; height: 30px; }
.mz-tpl-eroi .carta.on .ico { background: var(--rosso); color: #fff; }
body.mz-tpl-scelta #joystick, body.mz-tpl-scelta #btnA, body.mz-tpl-scelta #btnB, body.mz-tpl-scelta #compass, body.mz-tpl-scelta .mz-labels, body.mz-tpl-scelta #mzMete { visibility: hidden !important; }
.mz-tpl-eroi .pannello { position: absolute; right: 24px; top: 50%; transform: translateY(-56%); width: 340px; padding: 0 0 14px; pointer-events: auto;
  background: rgba(35,32,31,.86); border: 4px solid #F4E3C1; box-shadow: 0 6px 0 var(--scuro); }
.mz-tpl-eroi .nome { background: var(--rosso); padding: 8px 16px; font-size: 28px; color: #fff; border-bottom: 4px solid #F4E3C1; }
.mz-tpl-eroi .descr { margin: 10px 16px 8px; font: 14px/1.35 system-ui, sans-serif; color: #E8E1D6; }
.mz-tpl-eroi .barre { display: grid; gap: 6px; margin: 4px 16px 10px; }
.mz-tpl-eroi .riga { display: grid; grid-template-columns: 92px 1fr; align-items: center; font-size: 15px; }
.mz-tpl-eroi .tacche { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.mz-tpl-eroi .tacche i { height: 14px; background: #4A4340; border: 2px solid var(--scuro); }
.mz-tpl-eroi .super { margin: 4px 16px 0; padding: 8px 10px; border: 3px dashed #F5D547; background: rgba(245,213,71,.08); }
.mz-tpl-eroi .super b { font-weight: 400; font-size: 17px; color: #F5D547; display: block; }
.mz-tpl-eroi .super p { margin: 3px 0 2px; font: 13px/1.3 system-ui, sans-serif; color: #E8E1D6; }
.mz-tpl-eroi .super small, .mz-tpl-eroi .armi { font: 12px/1.3 system-ui, sans-serif; color: #E2B97F; }
.mz-tpl-eroi .armi { margin: 8px 16px 0; }
.mz-tpl-eroi .via { position: absolute; right: 24px; bottom: max(22px, env(safe-area-inset-bottom)); min-width: 340px; padding: 12px 22px; background: #F5D547; color: var(--scuro);
  border: 4px solid var(--scuro); box-shadow: 0 7px 0 var(--scuro); font-size: 34px; letter-spacing: .02em; }
.mz-tpl-eroi .via:active { transform: translateY(4px); box-shadow: 0 3px 0 var(--scuro); }
.mz-tpl-eroi .via small { display: block; font: 12px system-ui, sans-serif; opacity: .75; }
@media (orientation: portrait), (max-width: 760px) {
  .mz-tpl-eroi .titolo { left: 12px; padding: 6px 18px 6px 12px; }
  .mz-tpl-eroi .titolo h2 { font-size: 24px; }
  .mz-tpl-eroi .titolo small { display: none; }
  .mz-tpl-eroi .chiudi { right: 12px; width: 44px; height: 44px; font-size: 20px; }
  .mz-tpl-eroi .carte { left: 12px; right: 12px; top: auto; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 68px + 236px); transform: none; flex-direction: row; gap: 8px; }
  .mz-tpl-eroi .carta { flex: 1; width: auto; grid-template-columns: 1fr; justify-items: center; text-align: center; padding: 6px 4px; }
  .mz-tpl-eroi .carta .ico { grid-row: auto; width: 42px; height: 42px; padding-bottom: 6px; }
  .mz-tpl-eroi .carta .ico svg { width: 22px; height: 22px; }
  .mz-tpl-eroi .carta b { font-size: 14px; }
  .mz-tpl-eroi .carta small { display: none; }
  .mz-tpl-eroi .carta.on { transform: translateY(-6px); }
  .mz-tpl-eroi .pannello { left: 12px; right: 12px; width: auto; top: auto; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 68px); transform: none; height: 226px; overflow: hidden; padding-bottom: 8px; }
  .mz-tpl-eroi .nome { font-size: 20px; padding: 5px 12px; }
  .mz-tpl-eroi .descr { display: none; }
  .mz-tpl-eroi .barre { grid-template-columns: 1fr 1fr; gap: 5px 12px; margin: 8px 12px; }
  .mz-tpl-eroi .riga { grid-template-columns: 1fr; font-size: 12px; gap: 2px; }
  .mz-tpl-eroi .tacche i { height: 10px; }
  .mz-tpl-eroi .super { margin: 0 12px; padding: 6px 8px; }
  .mz-tpl-eroi .super b { font-size: 15px; }
  .mz-tpl-eroi .armi { margin: 6px 12px 0; }
  .mz-tpl-eroi .via { left: 12px; right: 12px; min-width: 0; bottom: max(14px, env(safe-area-inset-bottom)); font-size: 26px; padding: 8px 12px; }
  .mz-tpl-eroi .via small { display: none; }
}`;

// ---------- la cripta: pedana con la croce, colonne, stendardi, candele (pochi box a colori di vertice) ----------
type Bx = [w: number, h: number, d: number, x: number, y: number, z: number, c: string, ry?: number];
function scatole(list: Bx[]): THREE.Mesh {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const [w, h, d, x, y, z, colore, ry] of list) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    m.makeRotationY(ry ?? 0).setPosition(x, y, z);
    const p = g.getAttribute('position');
    c.set(colore);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}
/** La pedana: un tamburo di pietra a lastre con l'anello a scacchi bianco e nero (il Beauceant) e la croce patente rossa sopra. */
function pedana(): THREE.Mesh {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color(), N = 24, R = 1.35, R2 = 1.08, H = 0.3, B = -0.2;
  const tri = (a: number[], b: number[], d: number[], colore: string) => { pos.push(...a, ...b, ...d); c.set(colore); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); };
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2, s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
    const o0 = [R * c0, H, R * s0], o1 = [R * c1, H, R * s1], i0 = [R2 * c0, H, R2 * s0], i1 = [R2 * c1, H, R2 * s1];
    tri([0, H, 0], i1, i0, k % 2 ? '#B9AFA3' : '#A79D91');
    tri(i0, i1, o1, k % 2 ? '#E8E1D6' : '#23201F'); tri(i0, o1, o0, k % 2 ? '#E8E1D6' : '#23201F');
    const b0 = [R * c0, B, R * s0], b1 = [R * c1, B, R * s1], f = k % 2 ? '#7F7568' : '#6E655A';
    tri(o0, o1, b1, f); tri(o0, b1, b0, f);
  }
  // la croce patente: quattro bracci che si allargano verso il bordo
  const y = H + 0.004, r0 = 0.12, r1 = 0.9, w0 = 0.1, w1 = 0.32;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const px = -az, pz = ax, p = (r: number, w: number) => [ax * r + px * w, y, az * r + pz * w];
    tri(p(r0, -w0), p(r1, w1), p(r0, w0), '#E8433F'); tri(p(r0, -w0), p(r1, -w1), p(r1, w1), '#E8433F');
  }
  tri([-r0, y, -r0], [r0, y, r0], [r0, y, -r0], '#E8433F'); tri([-r0, y, -r0], [-r0, y, r0], [r0, y, r0], '#E8433F');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}
function cripta(): { scene: THREE.Scene; fiamme: THREE.Mesh[] } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2E1E14');
  scene.fog = new THREE.Fog('#2E1E14', 7, 15);
  const b: Bx[] = [];
  // il pavimento a lastre
  for (let i = -5; i <= 5; i++) for (let j = -6; j <= 2; j++) b.push([0.96, 0.1, 0.96, i, -0.25, j, (i + j) % 2 ? '#4A4340' : '#5A524D']);
  // il muro di fondo ad archi, le colonne, gli stendardi Beauceant (bianco sopra, nero sotto, croce rossa) e i candelabri
  for (let i = -4; i <= 4; i++) {
    const x = i * 1.2, z = -4.6 - Math.abs(i) * 0.25;
    b.push([1.2, 4.2, 0.4, x, 1.9, z - 0.3, i % 2 ? '#7F7568' : '#6E655A']);
    if (i % 2 === 0) {
      b.push([0.42, 3.8, 0.42, x, 1.7, z + 0.1, '#B9AFA3'], [0.56, 0.16, 0.56, x, 3.65, z + 0.1, '#E8E1D6'], [0.56, 0.2, 0.56, x, -0.1, z + 0.1, '#E8E1D6']);
    } else {
      b.push([0.7, 0.7, 0.05, x, 2.55, z - 0.05, '#E8E1D6'], [0.7, 0.7, 0.05, x, 1.85, z - 0.05, '#23201F']);
      b.push([0.12, 0.6, 0.06, x, 2.3, z - 0.02, '#E8433F'], [0.42, 0.12, 0.06, x, 2.4, z - 0.02, '#E8433F']);
      b.push([0.05, 1.3, 0.05, x, 0.4, z + 0.5, '#5A3A1E'], [0.3, 0.05, 0.12, x, 1.05, z + 0.5, '#5A3A1E']);
    }
  }
  scene.add(scatole(b));
  const ped = pedana(); ped.position.y = -0.2; scene.add(ped);
  // le fiammelle delle candele (si accendono a scatti) e la luce calda
  const fiamme: THREE.Mesh[] = [], fg = new THREE.BoxGeometry(0.07, 0.12, 0.07), fm = new THREE.MeshBasicMaterial({ color: '#FFB03D' });
  for (let i = -4; i <= 4; i++) {
    if (i % 2 === 0) continue;
    const x = i * 1.2, z = -4.6 - Math.abs(i) * 0.25 + 0.5;
    for (const dx of [-0.12, 0.12]) { const f = new THREE.Mesh(fg, fm); f.position.set(x + dx, 1.17, z); scene.add(f); fiamme.push(f); }
  }
  scene.add(new THREE.HemisphereLight('#F4E3C1', '#2E1E14', 1.1));
  const sole = new THREE.DirectionalLight('#FFE0B0', 1.6); sole.position.set(2.5, 5, 4); scene.add(sole, sole.target);
  const rossa = new THREE.PointLight('#FF5C3D', 2.2, 7, 1.5); rossa.position.set(-2, 1.6, -1.5); scene.add(rossa);
  return { scene, fiamme };
}

export function apriScelta(ctx: TemplariCtx, o: { look: Look; insieme?: boolean }): Scelta {
  if (!document.getElementById('mz-tpl-scelta-style')) { const st = document.createElement('style'); st.id = 'mz-tpl-scelta-style'; st.textContent = CSS; document.head.appendChild(st); }
  const eroi = TEMPLARI.eroi;
  let i = Math.max(0, eroi.findIndex((e) => e.id === eroeSalvato())), chiuso = false, t = 0, giro = 0, attore: HeroActor | null = null, attoreDi = -1, cambio = 0;
  let resolve!: (c: TClasse | null) => void;
  const done = new Promise<TClasse | null>((r) => (resolve = r));

  // ---- la scena e la camera (restano quelle del gioco: si rimettono a posto chiudendo) ----
  const { scene, fiamme } = cripta();
  const cam = ctx.renderer.camera, cam0 = { fov: cam.fov, near: cam.near, far: cam.far };
  cam.fov = 32; cam.near = 0.1; cam.far = 40; cam.updateProjectionMatrix();
  scene.userData['near'] = 0.1;
  ctx.renderer.setScene(scene);

  // ---- l'eroe sulla pedana: le pose della sim (uno stato per eroe, fatto una volta) ----
  const pose = new Map<TClasse, TView['posa']>();
  const posa = (c: TClasse): TView['posa'] => {
    let p = pose.get(c);
    if (!p) { p = templari.view(templari.create({ seed: 1, opzioni: { subito: true, classi: [c] } })).posa; pose.set(c, p); }
    return { ...p, x: 0, z: 0 };
  };
  /** L'attore si fa una volta sola (anche se cambi eroe mentre si carica), poi si riveste e cambia arma. */
  let nasce: Promise<HeroActor | null> | null = null;
  async function mostra(k: number): Promise<void> {
    const e = eroi[k]!, my = ++cambio;
    nasce ??= (async () => {
      await ctx.loader.extend('manifest_rpg.json'); // modelli delle armi (l'arco, la spada del kit GDR)
      const a = await createHeroActor({ loader: ctx.loader, look: o.look, hero: { arma: armaVista(e.armi[0]), armatura: { id: corpoTemplari(e.id) } }, scene, floorY: 0.1, x: 0, z: 0, soloBusto: true });
      if (chiuso) { a.dispose(); return null; }
      attore = a;
      return a;
    })();
    const a = await nasce;
    if (!a || my !== cambio || chiuso) return;
    a.equip({ arma: { id: null }, armatura: { id: corpoTemplari(e.id) } });
    await a.setArma(armaVista(e.armi[0]));
    if (my !== cambio || chiuso) return;
    a.avatar.setCappello(TESTA_TEMPLARI[e.id] ?? null);
    attoreDi = k;
  }

  // ---- i pannelli ----
  const box = el('div', 'mz-tpl-eroi on'); box.id = 'mzTplScelta';
  const titolo = el('div', 'titolo'); titolo.append(el('h2', 'ombra', '✠ Scegli l’eroe'), el('small', '', o.insieme ? 'insieme agli amici' : 'Isola dei Templari'));
  const chiudi = el('button', 'chiudi', '✕') as HTMLButtonElement; chiudi.type = 'button'; chiudi.dataset['act'] = 'esci'; chiudi.title = 'Torna fuori (Esc)';
  const carte = el('div', 'carte');
  const btnCarte = eroi.map((e, k) => {
    const c = el('button', 'carta') as HTMLButtonElement; c.type = 'button'; c.dataset['eroe'] = e.id;
    const ico = el('span', 'ico'); ico.innerHTML = ICONA[e.id];
    c.append(ico, el('b', 'ombra', e.nome), el('small', '', e.titolo));
    c.addEventListener('click', () => { if (k !== i) { suona('click'); scegli(k); } });
    carte.append(c);
    return c;
  });
  const pannello = el('div', 'pannello'), nome = el('div', 'nome ombra'), descr = el('p', 'descr'), barre = el('div', 'barre'), sup = el('div', 'super'), armi = el('div', 'armi');
  pannello.append(nome, descr, barre, sup, armi);
  const via = el('button', 'via') as HTMLButtonElement; via.type = 'button'; via.dataset['act'] = 'via';
  via.append(el('span', '', o.insieme ? '✠ In sala' : '✠ Deus vult'), el('small', '', 'Invio'));
  box.append(titolo, chiudi, carte, pannello, via);
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());
  ctx.root.append(box);
  document.body.classList.add('mz-tpl-scelta');

  function disegna(): void {
    const e = eroi[i]!;
    btnCarte.forEach((c, k) => c.classList.toggle('on', k === i));
    nome.textContent = e.nome;
    descr.textContent = e.descr;
    barre.replaceChildren(...BARRE.map((b) => {
      const r = el('div', 'riga'), tc = el('div', 'tacche');
      for (let n = 1; n <= 5; n++) { const x = el('i'); if (n <= e.barre[b.k]) x.style.background = b.colore; tc.append(x); }
      r.append(el('span', 'ombra', b.nome), tc);
      return r;
    }));
    sup.replaceChildren(el('b', '', `Super · ${e.super.nome}`), el('p', '', e.super.descr), el('small', '', `Si carica con ${e.super.uccisioni} uccisioni · bottone «Super» o tasto R`));
    const conCosa = [...e.armi.filter((a): a is string => !!a).map((a) => armaDef(a).nome), ...(e.scudo ? ['Scudo templare'] : [])];
    armi.textContent = `Parte con: ${conCosa.join(' · ')}`;
  }
  function scegli(k: number): void {
    i = (k + eroi.length) % eroi.length; giro = 0;
    disegna(); void mostra(i);
  }
  function fine(c: TClasse | null): void {
    if (chiuso) return;
    chiuso = true;
    if (c) { salvaEroe(c); suona('via'); } else suona('chiudi');
    removeEventListener('keydown', tasti, true);
    box.remove(); attore?.dispose(); attore = null; document.body.classList.remove('mz-tpl-scelta');
    scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    cam.fov = cam0.fov; cam.near = cam0.near; cam.far = cam0.far; cam.updateProjectionMatrix();
    ctx.renderer.setScene(null);
    resolve(c);
  }
  function tasti(e: KeyboardEvent): void {
    if (chiuso) return;
    const k = e.code;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'KeyD' || k === 'KeyS') { suona('click'); scegli(i + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'KeyA' || k === 'KeyW') { suona('click'); scegli(i - 1); }
    else if (k === 'Enter' || k === 'Space') fine(eroi[i]!.id);
    else if (k === 'Escape') fine(null);
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }
  addEventListener('keydown', tasti, true);
  via.addEventListener('click', () => fine(eroi[i]!.id));
  chiudi.addEventListener('click', () => fine(null));
  scegli(i);
  suona('apri');

  registerStateProvider('templariScelta', () => ({ aperta: !chiuso, eroe: eroi[i]!.id, pronto: attoreDi === i, vestito: attore?.avatar.indossaStato()?.corpo ?? null }));
  registerTestHook('templariScegli', (id) => { if (chiuso) return false; const k = eroi.findIndex((e) => e.id === id); if (k < 0) return false; scegli(k); return true; });

  let joyWas = 0;
  return {
    done,
    step(f) {
      if (chiuso) return;
      // il joystick a destra o a sinistra cambia eroe (un passo per spinta)
      const j = f.mx > 0.6 ? 1 : f.mx < -0.6 ? -1 : 0;
      if (j && j !== joyWas) { suona('click'); scegli(i + j); }
      joyWas = j;
      if (attore && attoreDi === i) {
        giro += 0.012;
        const p = posa(eroi[i]!.id), a = 0.5 + giro; // guarda un po' verso la camera, poi gira piano
        attore.tick({ ...p, fx: Math.sin(a) * 0.9, fz: Math.cos(a) });
      }
    },
    update(dt) {
      if (chiuso) return;
      t += dt;
      attore?.update(1, dt);
      for (const [k, f] of fiamme.entries()) { const s = 0.8 + 0.35 * Math.abs(Math.sin(Math.floor(t * 8) * 1.7 + k)); f.scale.set(s, s, s); }
      // inquadratura: in orizzontale l'eroe al centro tra carte e pannello; in verticale in alto, sopra carte e pannello
      const vert = innerHeight > innerWidth * 1.05;
      if (vert) { cam.position.set(0, 1.5, 7.8); cam.lookAt(0, 0.1, 0); } // l'eroe tra il 12 % e il 55 % dell'altezza, sopra le carte
      else { cam.position.set(0, 1.5, 5.2); cam.lookAt(0, 0.95, 0); }
    },
  };
}
