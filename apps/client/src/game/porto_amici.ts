// Porto tra amici (#110 #111), la parte nel mondo (bundle iniziale, piccola): il Tabellone dei record in piazza (legno, procedurale in
// palette, un mesh) e il Faro comune sullo scoglio a nord-est (modelli bld_faro_l1/l2: cresce coi livelli; al livello 0 è spento,
// finestre e lanterna scure; dal livello 1 si accende e di notte un fascio gira dalla lanterna, più lungo e largo a ogni livello). Cartelli RECORD / FARO, bottone quando ci sei vicino
// (A / E / Spazio). I pannelli stanno in ui/porto_amici_ui.ts, scaricato con import() alla prima apertura (tetto del JS, TECH §5).
import * as THREE from 'three';
import { PORTO_AMICI } from '@marea/content/porto_amici.ts';
import type { PortoPosto } from '@marea/content/porto.ts';
import type { LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import type { Api, FaroVista, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el, injectUiStyle } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { createLabelLayer } from '../ui/sheet.ts';
import type { PortoAmiciUi } from '../ui/porto_amici_ui.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type AmiciKind = 'record' | 'faro';
export type PortoAmici = {
  /** Tabellone e Faro in coordinate mondo (dove si mette chi gioca: per la bussola). */
  readonly spots: readonly { id: AmiciKind; nome: string; x: number; z: number }[];
  /** Un tick (60 Hz): vicino a un posto, il fronte di salita di A apre il pannello. true = A è di questi posti. */
  tick(a: boolean): boolean;
  update(dt: number, focus: { x: number; z: number }): void;
  isBusy(): boolean;
  close(): void;
};
export type PortoAmiciOpts = {
  world: GameWorld; loader: Loader; api: Api | null; me: Me | null; hud: Hud; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement;
  getLot(): LotState | null; setLot(l: LotState): void; notte(): boolean;
};
/** Contesto che il chunk dei pannelli riceve da qui. */
export type PortoAmiciCtx = PortoAmiciOpts & { getFaro(): FaroVista | null; setFaro(f: FaroVista): void; onClose(): void };

const CSS = `
.mz-play.on ~ .mz-amici-btn.on { top: calc(60% + 66px); }
`;
const SHOW_M = 60, TAP_M = 7;
/** Come cresce il faro: modello, scala, lunghezza e larghezza del fascio di notte (m) per livello 0-3 (0 = spento). */
const CRESCITA = [
  { model: 'bld_faro_l1', scala: 1, fascio: 0, largo: 0 },
  { model: 'bld_faro_l1', scala: 1.15, fascio: 12, largo: 0.7 },
  { model: 'bld_faro_l2', scala: 1.15, fascio: 20, largo: 1.0 },
  { model: 'bld_faro_l2', scala: 1.45, fascio: 30, largo: 1.4 },
] as const;
/** Altezza del modello e della lanterna (m, scala 1): dal manifest (bounds) e dalla parte emissiva del glb. */
const ALTEZZA: Record<string, number> = { bld_faro_l1: 5.3, bld_faro_l2: 7.35 };
const LANTERNA: Record<string, number> = { bld_faro_l1: 4.55, bld_faro_l2: 6.1 };

/** Tabellone dei record (davanti verso +Z): due pali, tavola con cornice, righe con le medaglie, tettuccio e la coppa in cima. */
function tabelloneGeometry(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  for (const x of [-1.35, 1.35]) p.push(painted(new THREE.BoxGeometry(0.16, 2.9, 0.16), P.legnoScuro, M(x, 1.45, 0)));
  p.push(painted(new THREE.BoxGeometry(2.6, 1.7, 0.1), P.legno, M(0, 1.85, 0)));
  p.push(painted(new THREE.BoxGeometry(2.8, 0.12, 0.16), P.legnoScuro, M(0, 2.74, 0)), painted(new THREE.BoxGeometry(2.8, 0.12, 0.16), P.legnoScuro, M(0, 0.96, 0)));
  p.push(painted(new THREE.BoxGeometry(3.1, 0.1, 0.8), P.rosso, M(0, 3.0, 0.05, 0.14, 0, 0)));
  const med = [P.giallo, P.pietraChiara, P.arancio];
  for (let r = 0; r < 5; r++) {
    const y = 2.5 - r * 0.3;
    p.push(painted(new THREE.BoxGeometry(2.3, 0.2, 0.02), P.sabbiaChiara, M(0, y, 0.06)));
    p.push(painted(new THREE.BoxGeometry(0.14, 0.14, 0.03), med[r % 3]!, M(-1.0, y, 0.075)));
    p.push(painted(new THREE.BoxGeometry(0.9 - (r % 2) * 0.3, 0.04, 0.03), P.pietraScura, M(-0.3, y, 0.075)), painted(new THREE.BoxGeometry(0.4, 0.04, 0.03), P.pietraScura, M(0.75, y, 0.075)));
  }
  // coppa sul tetto
  p.push(painted(new THREE.BoxGeometry(0.34, 0.08, 0.34), P.legnoScuro, M(0, 3.18, 0)), painted(new THREE.CylinderGeometry(0.06, 0.1, 0.2, 6), P.giallo, M(0, 3.32, 0)));
  p.push(painted(new THREE.CylinderGeometry(0.24, 0.12, 0.3, 8), P.giallo, M(0, 3.55, 0)));
  return merged(p);
}

export function createPortoAmici(o: PortoAmiciOpts): PortoAmici {
  injectUiStyle();
  if (!document.getElementById('mz-amici-style')) { const st = document.createElement('style'); st.id = 'mz-amici-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago, T = arch.tile;
  const place = arch.places.find((q) => q.role === 'porto');
  const [ox, oz] = place?.origin ?? arch.porto.origin;
  const at = (c: readonly [number, number]) => ({ x: (ox + c[0] + 0.5) * T, z: (oz + c[1] + 0.5) * T });
  const group = new THREE.Group(); group.name = 'porto_amici'; o.world.scene.add(group);
  const layer = createLabelLayer(o.root);
  let ui: PortoAmiciUi | null = null, loading: Promise<PortoAmiciUi | null> | null = null, near: AmiciKind | null = null, nearWas: AmiciKind | null = null, aWas = false, closedAt = 0;
  let faro: FaroVista | null = null;

  const posti = (['record', 'faro'] as const).map((id) => {
    const posto: PortoPosto = id === 'record' ? PORTO_AMICI.tabellone : PORTO_AMICI.faro, w = at(posto.at), f = at(posto.fronte);
    const label = layer.add(() => { if (Math.hypot(me().x - f.x, me().z - f.z) < TAP_M) void open(id); else o.hud.toast(`${posto.nome}: al Porto`, 2200); });
    label.set('bubble', [pixIcon(id, 16), el('span', '', posto.cartello)], 'spot'); label.el.classList.add('spot'); label.el.dataset['amici'] = id;
    return { id, posto, x: w.x, z: w.z, y: o.world.groundY(w.x, w.z), fx: f.x, fz: f.z, label };
  });
  const tab = posti[0]!, fp = posti[1]!;

  // ---- tabellone: un mesh ----
  const tabMesh = new THREE.Mesh(tabelloneGeometry().applyMatrix4(M(tab.x, tab.y, tab.z, 0, tab.posto.rot, 0)), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  tabMesh.name = 'tabellone_record'; tabMesh.castShadow = true; tabMesh.receiveShadow = true; group.add(tabMesh);

  // ---- faro: modello che cresce, lanterna, fascio di notte ----
  const faroG = new THREE.Group(); faroG.name = 'faro_comune'; faroG.position.set(fp.x, fp.y, fp.z); faroG.rotation.y = fp.posto.rot; group.add(faroG);
  const modelli = new Map<string, THREE.Object3D>();
  /** Le parti emissive (finestre, lanterna) di ogni modello: col faro spento si scambiano con una copia scura. */
  const luci: { mesh: THREE.Mesh; on: THREE.Material; off: THREE.Material }[] = [];
  const spenta = (m: THREE.Material): THREE.Material => {
    const x = m.clone() as THREE.MeshStandardMaterial;
    if ('emissive' in x) { x.emissive.setRGB(0, 0, 0); x.emissiveMap = null; x.map = null; x.color.set(P.roccia); }
    return x;
  };
  const fascioMat = new THREE.MeshBasicMaterial({ color: P.giallo, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  const fascio = new THREE.Mesh(merged([painted(new THREE.BoxGeometry(1, 1, 1), P.giallo, M(0.5, 0, 0)), painted(new THREE.BoxGeometry(1, 1, 1), P.giallo, M(-0.5, 0, 0))]), fascioMat);
  fascio.name = 'faro_fascio'; fascio.visible = false; faroG.add(fascio);
  let livello = -1, modelloOn = '', giro = 0, acceso = false;
  async function mostraLivello(lv: number): Promise<void> {
    const c = CRESCITA[Math.max(0, Math.min(CRESCITA.length - 1, lv))]!;
    livello = lv;
    let m = modelli.get(c.model);
    if (!m && o.loader.has(c.model)) {
      try {
        m = (await o.loader.load(c.model)).scene; m.name = 'faro_' + c.model; faroG.add(m); modelli.set(c.model, m);
        m.traverse((n) => { const mesh = n as THREE.Mesh; if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.name === 'mat_emissivo') luci.push({ mesh, on: mesh.material, off: spenta(mesh.material) }); });
      } catch { /* senza modello niente faro: pazienza */ }
    }
    if (livello !== lv) return; // nel frattempo è cambiato ancora
    for (const [k, x] of modelli) x.visible = k === c.model;
    if (m) m.scale.setScalar(c.scala);
    modelloOn = m ? c.model : '';
    acceso = c.fascio > 0;
    for (const l of luci) l.mesh.material = acceso ? l.on : l.off;
    fascio.position.set(0, (LANTERNA[c.model] ?? 4) * c.scala, 0); fascio.scale.set(c.fascio || 1, (c.largo || 1) * 0.6, c.largo || 1);
  }
  void mostraLivello(0);
  const setFaro = (f: FaroVista) => {
    const su = faro !== null && f.livello > faro.livello;
    faro = f;
    if (f.livello !== livello) void mostraLivello(f.livello);
    if (su) o.hud.toast(`Il Faro del Porto è al livello ${f.livello}: Segherie e Cave +${Math.round(f.bonus * 100)} % per tutti`, 3600);
  };
  const ricarica = () => (o.api?.enabled ? o.api.faro().then(setFaro, () => { /* resta quello noto */ }) : Promise.resolve());
  const pronto = ricarica();

  // ---- bottone ----
  const btn = el('button', 'mz mz-play mz-amici-btn'); btn.id = 'mzAmiciBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) void open(near); });
  o.root.appendChild(btn);

  function me() { return o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state; }
  async function loadUi(): Promise<PortoAmiciUi | null> {
    if (ui) return ui;
    loading ??= import('../ui/porto_amici_ui.ts').then((m) => {
      ui = m.createPortoAmiciUi({ ...o, getFaro: () => faro, setFaro, onClose: () => { closedAt = performance.now(); } });
      return ui;
    }).catch(() => { loading = null; o.hud.toast('Pannello non caricato: riprova', 2500); return null; });
    return loading;
  }
  async function open(id: AmiciKind): Promise<boolean> {
    if (ui?.isOpen() || o.world.race.on || performance.now() - closedAt < 350) return false;
    const u = await loadUi();
    if (!u || u.isOpen()) return false;
    btn.classList.remove('on');
    if (id === 'record') u.record(); else u.faro();
    return true;
  }
  function findNear(): AmiciKind | null {
    if (o.world.mode !== 'walk' || o.world.race.on) return null;
    let best: AmiciKind | null = null, bd = Infinity;
    for (const s of posti) { const f = me(), d = Math.hypot(f.x - s.fx, f.z - s.fz); if (d < s.posto.raggio && d < bd) { bd = d; best = s.id; } }
    return best;
  }
  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  registerStateProvider('portoAmici', () => ({
    near, open: ui?.isOpen() ? ui.kind : null, ui: ui?.state() ?? null,
    posti: posti.map((s) => ({ id: s.id, x: s.x, z: s.z, fronte: { x: s.fx, z: s.fz } })),
    faro: { livello, modello: modelloOn,  scala: CRESCITA[Math.max(0, livello)]?.scala ?? 1, acceso, fascio: fascio.visible, luci: luci.length, dati: faro },
  }));
  registerTestHook('amiciApri', (id) => open(String(id) === 'faro' ? 'faro' : 'record'));
  registerTestHook('amiciChiudi', () => { ui?.close(); return true; });
  registerTestHook('amiciFaro', () => ricarica().then(() => faro?.livello ?? null));
  registerTestHook('amiciPronto', () => pronto);
  /** Solo resa (screenshot dei livelli): il faro come se fosse al livello `lv`, senza toccare i dati. */
  registerTestHook('amiciMostra', (lv) => mostraLivello(Number(lv)).then(() => livello));

  return {
    spots: posti.map((s) => ({ id: s.id, nome: s.posto.nome, x: s.fx, z: s.fz })),
    isBusy: () => !!ui?.isOpen(),
    close: () => ui?.close(),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (ui?.isOpen()) { near = null; return true; }
      near = findNear();
      if (near && near !== nearWas) o.hud.toast(`${near === 'record' ? PORTO_AMICI.tabellone.nome : PORTO_AMICI.faro.nome}: premi A`, 2200);
      nearWas = near;
      if (near && pressA) void open(near);
      return !!near || (!!loading && !ui);
    },
    update(dt, focus) {
      const show = !!near && !ui?.isOpen() && !o.world.race.on && !o.world.frozen;
      if (show && near && btn.dataset['k'] !== near) {
        btn.dataset['k'] = near;
        btn.replaceChildren(pixIcon(near, 24), el('span', '', near === 'record' ? 'RECORD' : 'FARO'), el('small', '', 'A'));
      }
      btn.classList.toggle('on', show);
      for (const s of posti) {
        const h = s.id === 'faro' ? (ALTEZZA[modelloOn] ?? 5) * (CRESCITA[Math.max(0, livello)]?.scala ?? 1) + 1.6 : 4.1;
        const p = screenOf(s.x, s.y + h, s.z);
        s.label.place(p.x, p.y, p.on && Math.hypot(focus.x - s.x, focus.z - s.z) < SHOW_M && !o.world.race.on && !ui?.isOpen());
      }
      // di notte, acceso: il fascio gira (un giro ogni 8 s)
      const c = CRESCITA[Math.max(0, livello)];
      fascio.visible = !!c?.fascio && o.notte();
      if (fascio.visible) { giro = (giro + dt * Math.PI / 4) % (Math.PI * 2); fascio.rotation.y = giro; }
    },
  };
}
