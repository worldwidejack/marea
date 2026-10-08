// Porto più ricco (#63-#65), la parte nel mondo (bundle iniziale, piccola): banco del Mercante delle Perle e Bacheca delle missioni in
// piazza (segnaposto procedurali a colori di palette + cartello DOM), la Gente del Porto (avatar `chr_base` con look diversi, ferma o
// su un giro avanti e indietro), il bottone PARLA / MERCANTE / BACHECA quando ci sei vicino (A / E / Spazio sulla tastiera).
// I pannelli (negozio, missioni, battute) stanno in ui/porto_ui.ts, scaricato con import() alla prima apertura (tetto del JS, TECH §5).
import * as THREE from 'three';
import { DECOR } from '@marea/content';
import { GENTE } from '@marea/content/porto.ts';
import type { PersonaPorto, PortoPosto } from '@marea/content/porto.ts';
import type { LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { createAvatar } from './avatar.ts';
import type { Avatar } from './avatar.ts';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el, injectUiStyle } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { createLabelLayer } from '../ui/sheet.ts';
import type { Label } from '../ui/sheet.ts';
import type { PortoUi } from '../ui/porto_ui.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type PortoKind = 'mercante' | 'bacheca';
export type Porto = {
  /** Banco e Bacheca in coordinate mondo (per la bussola). */
  readonly spots: readonly { id: PortoKind; nome: string; x: number; z: number }[];
  /** Un tick (60 Hz): vicino a un posto o a una persona, il fronte di salita di A apre il pannello (o passa alla battuta dopo).
   *  true = A è del Porto (sei vicino o c'è un pannello aperto): chi viene dopo (minigiochi) non lo usa. */
  tick(a: boolean): boolean;
  /** Ogni frame: gente che cammina, cartelli, bottone. `focus` = dove sei (avatar o barca). */
  update(dt: number, focus: { x: number; z: number }): void;
  /** Un pannello del Porto è aperto (o si sta scaricando): il mondo sta fermo. */
  isBusy(): boolean;
  /** Cosa è aperto adesso (la guida «Primi passi» aspetta un 'parla'). */
  aperto(): 'mercante' | 'bacheca' | 'parla' | null;
  /** Dove sta la Gente del Porto adesso (coordinate mondo): la guida punta la persona più vicina. */
  gente(): readonly { x: number; z: number }[];
  close(): void;
};
export type PortoOpts = {
  world: GameWorld; loader: Loader; api: Api | null; me: Me | null; hud: Hud; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement;
  getLot(): LotState | null; setLot(l: LotState): void;
};
/** Contesto che il chunk dei pannelli riceve da qui. */
export type PortoCtx = PortoOpts & { setLook(l: Look): void; onClose(): void };

type Target = { kind: 'posto'; id: PortoKind; posto: PortoPosto } | { kind: 'persona'; p: PersonaPorto };
type Npc = { p: PersonaPorto; av: Avatar | null; meshes: THREE.Mesh[]; shadow: boolean; pts: { x: number; z: number }[]; len: number; s: number; x: number; z: number; yaw: number; label: Label; talk: boolean };

const CSS = `
.mz-play.on ~ .mz-porto-btn.on { top: calc(60% + 66px); }
.mz-lbl.persona { border-color: ${P.sabbiaChiara}; font-size: 13px; }
`;
const SHOW_M = 60, NAME_M = 13, TAP_M = 7;
/** Draw call (TECH §5): `chr_base` fa 5 draw call a persona, il doppio con l'ombra. Le persone si disegnano solo se sono nell'inquadratura
 *  (i mesh con lo scheletro non hanno frustum culling) ed entro NPC_M m da chi gioca, e fanno ombra solo vicinissime, dove si nota. */
const SHADOW_M = 7, NPC_M = 26;

/** Banco del Mercante (davanti verso −Z): bancone di legno, tenda a strisce rosse e chiare, merce sul banco. */
function bancoGeometry(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  p.push(painted(new THREE.BoxGeometry(2.4, 0.95, 0.8), P.legno, M(0, 0.475, -0.2)), painted(new THREE.BoxGeometry(2.5, 0.08, 0.9), P.legnoChiaro, M(0, 0.99, -0.2)));
  for (const [x, z] of [[-1.15, -0.55], [1.15, -0.55], [-1.15, 0.75], [1.15, 0.75]] as const) p.push(painted(new THREE.BoxGeometry(0.12, z < 0 ? 2.4 : 2.7, 0.12), P.legnoScuro, M(x, z < 0 ? 1.2 : 1.35, z)));
  for (let i = 0; i < 6; i++) p.push(painted(new THREE.BoxGeometry(0.44, 0.06, 1.6), i % 2 ? P.sabbiaChiara : P.rosso, M(-1.1 + i * 0.44, 2.55, 0.1, -0.2, 0, 0)));
  p.push(painted(new THREE.BoxGeometry(2.64, 0.22, 0.05), P.rosso, M(0, 2.33, -0.66)));
  // merce: cappello a cono, corona, polpo, sacchetto di perle
  p.push(painted(new THREE.ConeGeometry(0.28, 0.16, 8), P.sabbia, M(-0.8, 1.11, -0.25)), painted(new THREE.BoxGeometry(0.22, 0.12, 0.22), P.giallo, M(-0.25, 1.09, -0.3)));
  p.push(painted(new THREE.BoxGeometry(0.2, 0.18, 0.2), P.rosso, M(0.3, 1.12, -0.25)), painted(new THREE.IcosahedronGeometry(0.16, 0), P.legnoChiaro, M(0.85, 1.15, -0.2)));
  for (const [x, z] of [[0.75, -0.42], [0.92, -0.45], [0.84, -0.33]] as const) p.push(painted(new THREE.IcosahedronGeometry(0.06, 0), P.pietraChiara, M(x, 1.08, z)));
  return merged(p);
}
/** Bacheca delle missioni (davanti verso −Z): due pali, tavola con cornice, tre foglietti con la puntina, tettuccio. */
function bachecaGeometry(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  for (const x of [-0.95, 0.95]) p.push(painted(new THREE.BoxGeometry(0.14, 2.3, 0.14), P.legnoScuro, M(x, 1.15, 0)));
  p.push(painted(new THREE.BoxGeometry(1.9, 1.2, 0.08), P.legnoChiaro, M(0, 1.45, 0)), painted(new THREE.BoxGeometry(2.0, 0.1, 0.12), P.legnoScuro, M(0, 2.08, 0)), painted(new THREE.BoxGeometry(2.0, 0.1, 0.12), P.legnoScuro, M(0, 0.83, 0)));
  p.push(painted(new THREE.BoxGeometry(2.3, 0.1, 0.7), P.rosso, M(0, 2.4, 0, 0.12, 0, 0)));
  for (const [x, y, r] of [[-0.55, 1.5, 0.06], [0.05, 1.42, -0.04], [0.6, 1.52, 0.05]] as const) {
    p.push(painted(new THREE.BoxGeometry(0.44, 0.56, 0.02), P.sabbiaChiara, M(x, y, -0.05, 0, 0, r)), painted(new THREE.BoxGeometry(0.06, 0.06, 0.03), P.rosso, M(x, y + 0.22, -0.07)));
    p.push(painted(new THREE.BoxGeometry(0.3, 0.03, 0.02), P.pietraScura, M(x, y + 0.05, -0.065, 0, 0, r)), painted(new THREE.BoxGeometry(0.24, 0.03, 0.02), P.pietraScura, M(x, y - 0.06, -0.065, 0, 0, r)));
  }
  return merged(p);
}

export function createPorto(o: PortoOpts): Porto {
  injectUiStyle();
  if (!document.getElementById('mz-porto-style')) { const st = document.createElement('style'); st.id = 'mz-porto-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago, T = arch.tile;
  const place = arch.places.find((q) => q.role === 'porto');
  const [ox, oz] = place?.origin ?? arch.porto.origin;
  const at = (c: readonly [number, number]) => ({ x: (ox + c[0] + 0.5) * T, z: (oz + c[1] + 0.5) * T });
  const group = new THREE.Group(); group.name = 'porto_ricco'; o.world.scene.add(group);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const layer = createLabelLayer(o.root);
  let ui: PortoUi | null = null, loading: Promise<PortoUi | null> | null = null, near: Target | null = null, nearWas: string | null = null, aWas = false, closedAt = 0;

  // ---- banco e bacheca ----
  // banco e bacheca in un solo mesh (un draw call, uno per l'ombra)
  const geos: THREE.BufferGeometry[] = [];
  const posti = (['mercante', 'bacheca'] as const).map((id) => {
    const posto = GENTE.posti[id], w = at(posto.at), f = at(posto.fronte);
    geos.push((id === 'mercante' ? bancoGeometry() : bachecaGeometry()).applyMatrix4(M(w.x, o.world.groundY(w.x, w.z), w.z, 0, posto.rot, 0)));
    const label = layer.add(() => { if (dist(f.x, f.z) < TAP_M) void open({ kind: 'posto', id, posto }); else o.hud.toast(`${posto.nome}: in piazza, al Porto`, 2200); });
    label.set('bubble', [pixIcon(id, 16), el('span', '', posto.cartello)], 'spot'); label.el.classList.add('spot'); label.el.dataset['porto'] = id;
    return { id, posto, x: w.x, z: w.z, fx: f.x, fz: f.z, label };
  });
  const props = new THREE.Mesh(merged(geos), mat); props.name = 'porto_banco_bacheca'; props.castShadow = true; props.receiveShadow = true; group.add(props);

  // ---- gente del Porto ----
  const npcs: Npc[] = GENTE.gente.map((p) => {
    const pts = p.giro.map((c) => at(c));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z);
    const first = pts[0]!;
    const n: Npc = { p, av: null, meshes: [], shadow: true, pts, len, s: 0, x: first.x, z: first.z, yaw: p.ruolo === 'mercante' ? -GENTE.posti.mercante.rot : Math.PI, label: layer.add(() => { if (dist(n.x, n.z) < TAP_M) void open(p.ruolo === 'mercante' ? { kind: 'posto', id: 'mercante', posto: GENTE.posti.mercante } : { kind: 'persona', p }); }), talk: false };
    n.label.set('bubble', [pixIcon(p.ruolo === 'mercante' ? 'mercante' : 'parla', 16), el('span', '', p.nome)], 'persona'); n.label.el.classList.add('persona'); n.label.el.dataset['persona'] = p.id;
    void createAvatar({ loader: o.loader, look: p.look, x: first.x, z: first.z }).then((av) => {
      av.setGround(o.world.groundY); av.object.name = 'gente_' + p.id; group.add(av.object); n.av = av;
      av.object.traverse((x) => { if ((x as THREE.Mesh).isMesh) n.meshes.push(x as THREE.Mesh); });
    }).catch(() => { /* senza avatar la persona non c'è: pazienza */ });
    return n;
  });

  // ---- bottone ----
  const btn = el('button', 'mz mz-play mz-porto-btn'); btn.id = 'mzPortoBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) void open(near); });
  o.root.appendChild(btn);

  const me = () => (o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state);
  function dist(x: number, z: number): number { const f = me(); return Math.hypot(f.x - x, f.z - z); }
  const keyOf = (t: Target | null) => (t ? (t.kind === 'posto' ? t.id : t.p.id) : null);

  async function loadUi(): Promise<PortoUi | null> {
    if (ui) return ui;
    loading ??= import('../ui/porto_ui.ts').then((m) => {
      ui = m.createPortoUi({ ...o, setLook: (l) => o.world.setLook(l), onClose: () => { closedAt = performance.now(); for (const n of npcs) n.talk = false; } });
      return ui;
    }).catch(() => { loading = null; o.hud.toast('Pannello non caricato: riprova', 2500); return null; });
    return loading;
  }
  async function open(t: Target): Promise<boolean> {
    if (ui?.isOpen() || o.world.race.on || performance.now() - closedAt < 350) return false;
    const u = await loadUi();
    if (!u || u.isOpen()) return false;
    btn.classList.remove('on');
    if (t.kind === 'posto') { if (t.id === 'mercante') u.mercante(); else u.bacheca(); return true; }
    const n = npcs.find((x) => x.p.id === t.p.id); if (n) n.talk = true;
    u.parla(t.p);
    return true;
  }

  /** Il posto o la persona più vicina entro il suo raggio (solo a piedi, fuori dalle gare). */
  function findNear(): Target | null {
    if (o.world.mode !== 'walk' || o.world.race.on) return null;
    let best: Target | null = null, bd = Infinity;
    for (const s of posti) { const d = dist(s.fx, s.fz); if (d < s.posto.raggio && d < bd) { bd = d; best = { kind: 'posto', id: s.id, posto: s.posto }; } }
    for (const n of npcs) { if (n.p.raggio <= 0 || !n.av) continue; const d = dist(n.x, n.z); if (d < n.p.raggio && d < bd) { bd = d; best = { kind: 'persona', p: n.p }; } }
    return best;
  }

  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };
  /** Punto del giro a distanza `s` (avanti e indietro: dopo `len` si torna) e direzione di marcia. */
  function along(n: Npc, s: number): { x: number; z: number; dx: number; dz: number } {
    const L = n.len, u = s % (2 * L), back = u > L, d = back ? 2 * L - u : u;
    let acc = 0;
    for (let i = 1; i < n.pts.length; i++) {
      const a = n.pts[i - 1]!, b = n.pts[i]!, seg = Math.hypot(b.x - a.x, b.z - a.z);
      if (acc + seg >= d || i === n.pts.length - 1) {
        const k = seg > 0 ? Math.min(1, (d - acc) / seg) : 0, sg = back ? -1 : 1;
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: ((b.x - a.x) / (seg || 1)) * sg, dz: ((b.z - a.z) / (seg || 1)) * sg };
      }
      acc += seg;
    }
    return { x: n.pts[0]!.x, z: n.pts[0]!.z, dx: 0, dz: -1 };
  }

  registerStateProvider('porto', () => ({
    near: keyOf(near), open: ui?.isOpen() ? ui.kind : null, ui: ui?.state() ?? null,
    posti: posti.map((s) => ({ id: s.id, x: s.x, z: s.z, fronte: { x: s.fx, z: s.fz } })),
    gente: npcs.map((n) => ({ id: n.p.id, nome: n.p.nome, x: n.x, z: n.z, pronto: !!n.av, visibile: !!n.av?.object.visible, parla: n.talk })),
  }));
  registerTestHook('portoApri', async (id) => {
    const k = String(id);
    const posto = posti.find((s) => s.id === k), n = npcs.find((x) => x.p.id === k);
    if (posto) return open({ kind: 'posto', id: posto.id, posto: posto.posto });
    if (n) return open(n.p.ruolo === 'mercante' ? { kind: 'posto', id: 'mercante', posto: GENTE.posti.mercante } : { kind: 'persona', p: n.p });
    return false;
  });
  registerTestHook('portoChiudi', () => { ui?.close(); return true; });
  /** Prova un cappello (indice di avatar.json) sull'avatar, solo in locale: per gli screenshot dei cappelli. */
  registerTestHook('portoCappello', (i) => { o.world.setLook({ ...o.world.look, cappello: Number(i) }); return true; });
  /** Vetrina delle decorazioni (solo test, per gli screenshot): tutte quelle di decor.json in fila davanti a te, ogni 2,5 m. */
  registerTestHook('portoVetrina', async (soloMercante) => {
    const m = await import('../render/decor.ts');
    const f = me(), list = DECOR.filter((d) => !soloMercante || d.mercante), per = 4;
    for (const [i, d] of list.entries()) {
      const { obj } = await m.decorObject(d.id, o.loader);
      const x = f.x + ((i % per) - (per - 1) / 2) * 2.5, z = f.z - 2 - Math.floor(i / per) * 2.5;
      obj.position.set(x, o.world.groundY(x, z), z); obj.rotation.y = Math.PI; obj.name = 'vetrina_' + d.id; group.add(obj);
    }
    return list.length;
  });
  registerTestHook('portoCaricato', () => loadUi().then((u) => !!u));

  return {
    spots: posti.map((s) => ({ id: s.id, nome: s.posto.nome, x: s.fx, z: s.fz })),
    isBusy: () => !!ui?.isOpen(),
    aperto: () => (ui?.isOpen() ? ui.kind : null),
    gente: () => npcs,
    close: () => ui?.close(),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (ui?.isOpen()) { if (pressA && ui.kind === 'parla') ui.avanti(); near = null; return true; } // telefono: il bottone A fa andare avanti le battute
      near = findNear();
      const k = keyOf(near);
      if (near && k !== nearWas) o.hud.toast(near.kind === 'posto' ? `${near.posto.nome}: premi A` : `${near.p.nome}: premi A per parlare`, 2200);
      nearWas = k;
      if (near && pressA) void open(near);
      return !!near || !!loading && !ui;
    },
    update(dt, focus) {
      const t = near;
      const show = !!t && !ui?.isOpen() && !o.world.race.on && !o.world.frozen;
      const k = keyOf(t);
      if (show && t && btn.dataset['k'] !== k) {
        btn.dataset['k'] = k ?? '';
        const label = t.kind === 'posto' ? t.posto.cartello : `PARLA · ${t.p.nome.toUpperCase()}`;
        btn.replaceChildren(pixIcon(t.kind === 'posto' ? t.id : 'parla', 24), el('span', '', label), el('small', '', 'A'));
      }
      btn.classList.toggle('on', show);
      const fd = (x: number, z: number) => Math.hypot(focus.x - x, focus.z - z);
      for (const s of posti) { const p = screenOf(s.x, 3.3, s.z); s.label.place(p.x, p.y, p.on && fd(s.x, s.z) < SHOW_M && !o.world.race.on); }
      for (const n of npcs) {
        const sp = screenOf(n.x, 1, n.z), far = fd(n.x, n.z) > NPC_M || !(sp.on || Math.abs(v.x) < 1.25 && Math.abs(v.y) < 1.25 && v.z < 1);
        if (n.av) { n.av.visible = !far; n.av.object.visible = !far; } // avatar.update (che lo copierebbe) da lontano non gira
        const shadow = !far && fd(n.x, n.z) < SHADOW_M;
        if (shadow !== n.shadow) { n.shadow = shadow; for (const m of n.meshes) m.castShadow = shadow; }
        if (far) { n.label.place(0, 0, false); continue; }
        const f = me(), close = n.talk || (o.world.mode === 'walk' && Math.hypot(f.x - n.x, f.z - n.z) < Math.max(2.2, n.p.raggio));
        let anim = 'idle';
        if (n.pts.length > 1 && n.p.velocita > 0 && !close) {
          n.s += dt * n.p.velocita;
          const q = along(n, n.s);
          n.x = q.x; n.z = q.z; n.yaw = Math.atan2(q.dx, -q.dz); anim = 'walk';
        } else if (close && n.p.ruolo !== 'mercante') n.yaw = Math.atan2(f.x - n.x, -(f.z - n.z)); // si gira verso di te
        if (n.av) { n.av.setPose({ x: n.x, z: n.z, yaw: n.yaw, anim }); n.av.update(1, dt); }
        const p = screenOf(n.x, 2.25, n.z);
        n.label.place(p.x, p.y, p.on && !!n.av && fd(n.x, n.z) < NAME_M && !n.talk && !o.world.race.on && n.p.ruolo !== 'mercante'); // il Mercante ha già il cartello del banco
      }
    },
  };
}
