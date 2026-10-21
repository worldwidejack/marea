// Porto più ricco (#63-#65), la parte nel mondo (bundle iniziale, piccola): banco del Mercante del Porto e Bacheca delle missioni in
// piazza (segnaposto procedurali a colori di palette + cartello DOM), la Gente del Porto (avatar `chr_base` con look diversi: chi sta a
// un banco resta lì, gli altri passeggiano per il Borgo, game/passeggio.ts), il bottone PARLA / MERCANTE / BACHECA quando ci sei vicino
// (A / E / Spazio sulla tastiera). Banchi e gente sono solidi (world.solidi, content/collisioni.json).
// I pannelli (negozio, missioni, battute) stanno in ui/porto_ui.ts, scaricato con import() alla prima apertura (tetto del JS, TECH §5).
// Accanto alla Grotta il banco del Contrabbandiere (il Furetto): il suo pannello è GDR (monete, oggetti) e lo apre il chunk GDR via ui/eroe.ts.
import * as THREE from 'three';
import { DECOR } from '@marea/content';
import { GENTE } from '@marea/content/porto.ts';
import type { PersonaPorto, PortoPosto } from '@marea/content/porto.ts';
import { posaForma } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { createAvatar } from './avatar.ts';
import { inFila, scegliLod } from './gente_lod.ts';
import type { Avatar } from './avatar.ts';
import { createPasseggio } from './passeggio.ts';
import type { Passante } from './passeggio.ts';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el, injectUiStyle } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import { eroeForPanels } from '../ui/eroe.ts';
import type { Label } from '../ui/sheet.ts';
import type { PortoUi } from '../ui/porto_ui.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type PortoKind = 'mercante' | 'bacheca' | 'contrabbando';
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
  /** Il tempo che fa dove sei (pioggia e vento 0..1, render/aspetto.ts): le chiacchiere dei paesani col brutto tempo. null = meteo spento. */
  cielo?(): { pioggia: number; vento: number } | null;
};
/** Contesto che il chunk dei pannelli riceve da qui. */
export type PortoCtx = PortoOpts & { setLook(l: Look): void; onClose(): void };

type Target = { kind: 'posto'; id: PortoKind; posto: PortoPosto } | { kind: 'persona'; p: PersonaPorto };
/** `cammina`: chi passeggia (null = sta fermo al suo posto). */
type Npc = { p: PersonaPorto; av: Avatar | null; meshes: THREE.Mesh[]; shadow: boolean; cammina: Passante | null; x: number; z: number; yaw: number; label: Label; talk: boolean; segno: boolean };

const CSS = `
.mz-play.on ~ .mz-porto-btn.on { top: calc(60% + 66px); }
.mz-lbl.persona { border-color: ${P.sabbiaChiara}; font-size: 13px; }
.mz-lbl.persona.segno { border-color: ${P.giallo}; }
.mz-lbl.persona .punto { margin-left: 2px; font-size: 16px; }
`;
const SHOW_M = 60, NAME_M = 13, TAP_M = 7;
/** Entro quanti metri il nome di una persona torna pieno (#129, solo da PC): oltre, fino a NAME_M, è discreto. */
const NAME_NEAR_M = 6;
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
/** Banco del Contrabbandiere (davanti verso −Z), contro le rocce della Grotta: casse impilate, telo scuro storto su due pali, barile,
 *  merce coperta da un telo, sacchetto, bottiglia. */
function loscoGeometry(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  p.push(painted(new THREE.BoxGeometry(0.9, 0.8, 0.8), P.legnoScuro, M(-0.65, 0.4, -0.15)), painted(new THREE.BoxGeometry(0.9, 0.8, 0.8), P.legno, M(0.35, 0.4, -0.1, 0, 0.12, 0)));
  p.push(painted(new THREE.BoxGeometry(0.62, 0.55, 0.6), P.legnoScuro, M(0.95, 0.28, 0.55, 0, -0.3, 0)), painted(new THREE.BoxGeometry(0.6, 0.5, 0.6), P.legno, M(-0.6, 1.05, 0.15, 0, 0.25, 0)));
  for (const x of [-0.65, 0.35]) p.push(painted(new THREE.BoxGeometry(0.92, 0.06, 0.06), P.ombraCalda, M(x, 0.62, -0.56)));
  p.push(painted(new THREE.CylinderGeometry(0.3, 0.3, 0.75, 8), P.legnoChiaro, M(1.2, 0.38, -0.35)), painted(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 8), P.ombraCalda, M(1.2, 0.6, -0.35)));
  for (const x of [-1.15, 1.15]) p.push(painted(new THREE.BoxGeometry(0.1, 2.1, 0.1), P.legnoScuro, M(x, 1.05, 0.75)));
  p.push(painted(new THREE.BoxGeometry(2.6, 0.05, 1.7), P.roccia, M(0, 2.0, 0.05, -0.32, 0, 0.06)), painted(new THREE.BoxGeometry(2.6, 0.3, 0.04), P.roccia, M(0, 1.6, -0.75, 0, 0, 0.06)));
  p.push(painted(new THREE.BoxGeometry(0.75, 0.12, 0.3), P.pietraScura, M(-0.6, 0.86, -0.2, 0, 0.3, 0)), painted(new THREE.IcosahedronGeometry(0.16, 0), P.sabbia, M(0.2, 0.92, -0.2)));
  p.push(painted(new THREE.CylinderGeometry(0.07, 0.09, 0.26, 6), P.erbaScura, M(0.55, 0.93, -0.25)), painted(new THREE.BoxGeometry(0.2, 0.28, 0.2), P.neroCaldo, M(-0.6, 1.44, 0.15)));
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
  const posti = (['mercante', 'bacheca', 'contrabbando'] as const).map((id) => {
    const posto = GENTE.posti[id], w = at(posto.at), f = at(posto.fronte);
    geos.push((id === 'mercante' ? bancoGeometry() : id === 'contrabbando' ? loscoGeometry() : bachecaGeometry()).applyMatrix4(M(w.x, o.world.groundY(w.x, w.z), w.z, 0, posto.rot, 0)));
    const label = layer.add(() => { if (dist(f.x, f.z) < TAP_M) void open({ kind: 'posto', id, posto }); else o.hud.toast(`${posto.nome}: in piazza, al Porto`, 2200); });
    label.set('bubble', [pixIcon(id, 16), el('span', '', posto.cartello)], 'spot'); label.el.classList.add('spot'); label.el.dataset['porto'] = id;
    posaForma(o.world.solidi, id === 'mercante' ? 'banco_mercante' : id === 'contrabbando' ? 'banco_contrabbando' : 'bacheca', w.x, w.z, posto.rot);
    return { id, posto, x: w.x, z: w.z, fx: f.x, fz: f.z, label };
  });
  const props = new THREE.Mesh(merged(geos), mat); props.name = 'porto_banco_bacheca'; props.castShadow = true; props.receiveShadow = true; group.add(props);

  // ---- gente del Porto ----
  /** Chi sta a un banco: Maestro Ishi al Mercante, il Furetto al Contrabbando (null = gente che parla). */
  const bancoDi = (p: PersonaPorto): PortoKind | null => (p.ruolo === 'mercante' ? 'mercante' : p.ruolo === 'contrabbandiere' ? 'contrabbando' : null);
  const alBanco = (b: PortoKind): Target => ({ kind: 'posto', id: b, posto: GENTE.posti[b] });
  const passeggio = createPasseggio({ world: o.world });
  const npcs: Npc[] = GENTE.gente.map((p) => {
    // parte dal primo punto del giro; chi ha una velocità e non sta a un banco passeggia, gli altri sono un solido fermo lì
    const first = at(p.giro[0]!), b = bancoDi(p), cammina = !b && p.velocita > 0 ? passeggio.aggiungi('gente_' + p.id, first.x, first.z, p.velocita) : null;
    if (!cammina) posaForma(o.world.solidi, 'persona', first.x, first.z);
    const n: Npc = { p, av: null, meshes: [], shadow: true, cammina, x: first.x, z: first.z, yaw: b ? -GENTE.posti[b].rot : Math.PI, label: layer.add(() => { if (dist(n.x, n.z) < TAP_M) void open(b ? alBanco(b) : { kind: 'persona', p }); }), talk: false, segno: false };
    nome(n, false); n.label.el.dataset['persona'] = p.id;
    void inFila(() => createAvatar({ loader: o.loader, look: p.look, x: first.x, z: first.z, ...(p.modello ? { modello: p.modello } : {}) })).then((av) => {
      av.setGround(o.world.groundY); av.object.name = 'gente_' + p.id; group.add(av.object); n.av = av;
      av.object.traverse((x) => { if ((x as THREE.Mesh).isMesh) n.meshes.push(x as THREE.Mesh); });
    }).catch(() => { /* senza avatar la persona non c'è: pazienza */ });
    return n;
  });

  /** Il nome sopra la testa; col segno (un paesano da cui devi andare per un favore) è giallo, ha il «!» e si vede da lontano. */
  function nome(n: Npc, segno: boolean): void {
    const b = bancoDi(n.p);
    n.segno = segno;
    n.label.set(segno ? 'full' : 'bubble', [pixIcon(b ?? 'parla', 16), el('span', '', n.p.nome), ...(segno ? [el('b', 'punto', '!')] : [])], segno ? 'segno' : 'persona');
    n.label.el.classList.add('persona'); n.label.el.classList.toggle('segno', segno);
  }
  /** Da quale paesano devi andare adesso per il favore in corso (come economy/paesani.ts `daVedere`, senza scaricare le battute). */
  function daVedere(): string | null {
    const f = o.getLot()?.paesani?.favore, now = o.api?.serverNow() ?? Date.now();
    if (!f || now > f.scade) return null;
    return f.tipo === 'parla' && !f.detto ? f.a : f.da;
  }

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
    if (ui?.isOpen() || eroeForPanels()?.isOpen() || o.world.race.on || performance.now() - closedAt < 350) return false;
    if (t.kind === 'posto' && t.id === 'contrabbando') {
      const e = eroeForPanels();
      if (!e) { o.hud.toast('Il Furetto tratta solo con chi ha un\'isola: apri MAREA col tuo link personale', 3000); return false; }
      const frasi = GENTE.gente.find((p) => p.ruolo === 'contrabbandiere')?.battute ?? [];
      btn.classList.remove('on');
      e.openContrabbando(frasi[Math.floor(Math.random() * frasi.length)] ?? '');
      return true;
    }
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

  registerStateProvider('porto', () => ({
    near: keyOf(near), open: ui?.isOpen() ? ui.kind : null, ui: ui?.state() ?? null,
    posti: posti.map((s) => ({ id: s.id, x: s.x, z: s.z, fronte: { x: s.fx, z: s.fz } })),
    gente: npcs.map((n) => ({ id: n.p.id, nome: n.p.nome, x: n.x, z: n.z, pronto: !!n.av, visibile: !!n.av?.object.visible, parla: n.talk, segno: n.segno, passeggia: !!n.cammina, meta: n.cammina?.meta ?? null })),
    passeggio: passeggio.pronta,
  }));
  registerTestHook('portoApri', async (id) => {
    const k = String(id);
    const posto = posti.find((s) => s.id === k), n = npcs.find((x) => x.p.id === k);
    if (posto) return open({ kind: 'posto', id: posto.id, posto: posto.posto });
    if (n) { const b = bancoDi(n.p); return open(b ? alBanco(b) : { kind: 'persona', p: n.p }); }
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
  /** Le forme dei solidi del Borgo come linee rosse a terra e a un metro (solo test): per vedere se combaciano coi modelli. */
  registerTestHook('solidiVedi', () => {
    const v: number[] = [];
    for (const s of o.world.solidi.fissi) {
      const pts = 'hx' in s ? [[-s.hx, -s.hz], [s.hx, -s.hz], [s.hx, s.hz], [-s.hx, s.hz]].map(([a, b]) => [s.x + a! * s.c + b! * s.s, s.z - a! * s.s + b! * s.c] as const)
        : Array.from({ length: 12 }, (_, i) => [s.x + s.r * Math.cos((i * Math.PI) / 6), s.z + s.r * Math.sin((i * Math.PI) / 6)] as const);
      for (const y of [0.08, 1]) pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]!, g = o.world.groundY(s.x, s.z) + y; v.push(p[0], g, p[1], q[0], g, q[1]); });
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: P.rosso })); l.name = 'solidi_vedi'; group.add(l);
    return o.world.solidi.fissi.length;
  });

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
      const show = !!t && !ui?.isOpen() && !eroeForPanels()?.isOpen() && !o.world.race.on && !o.world.frozen;
      const k = keyOf(t);
      if (show && t && btn.dataset['k'] !== k) {
        btn.dataset['k'] = k ?? '';
        const label = t.kind === 'posto' ? t.posto.cartello : `Parla · ${t.p.nome}`;
        btn.replaceChildren(pixIcon(t.kind === 'posto' ? t.id : 'parla', 24), el('span', '', label), el('small', '', 'A'));
      }
      btn.classList.toggle('on', show);
      const fd = (x: number, z: number) => Math.hypot(focus.x - x, focus.z - z);
      for (const s of posti) { const p = screenOf(s.x, 3.3, s.z); s.label.place(p.x, p.y, p.on && fd(s.x, s.z) < SHOW_M && !o.world.race.on, dist(s.x, s.z) < LABEL_NEAR_M); }
      const vedi = daVedere();
      // chi passeggia cammina anche lontano da te (si disegna solo vicino); sta fermo se ci parli o gli sei accanto
      const f = me(), accanto = (n: Npc) => n.talk || (o.world.mode === 'walk' && Math.hypot(f.x - n.x, f.z - n.z) < Math.max(2.2, n.p.raggio));
      passeggio.update(dt, (c) => { const n = npcs.find((q) => q.cammina === c); return !n || accanto(n); });
      for (const n of npcs) {
        if (n.cammina) { n.x = n.cammina.x; n.z = n.cammina.z; }
        if ((n.p.id === vedi) !== n.segno) nome(n, n.p.id === vedi);
        const sp = screenOf(n.x, 1, n.z), far = fd(n.x, n.z) > NPC_M || !(sp.on || Math.abs(v.x) < 1.25 && Math.abs(v.y) < 1.25 && v.z < 1);
        if (n.av) { n.av.visible = !far; n.av.object.visible = !far; } // avatar.update (che lo copierebbe) da lontano non gira
        const shadow = !far && fd(n.x, n.z) < SHADOW_M;
        if (shadow !== n.shadow) { n.shadow = shadow; for (const m of n.meshes) m.castShadow = shadow; }
        if (far) { // lontano non si disegna; il nome resta solo per chi ha il segno, da cercare
          if (n.segno) { const q = screenOf(n.x, 2.25, n.z); n.label.place(q.x, q.y, q.on && fd(n.x, n.z) < SHOW_M && !o.world.race.on, true); } else n.label.place(0, 0, false);
          continue;
        }
        const close = accanto(n);
        let anim = 'idle';
        if (n.cammina && !close) { n.yaw = n.cammina.yaw; anim = n.cammina.anim; }
        else if (close && !bancoDi(n.p)) { n.yaw = Math.atan2(f.x - n.x, -(f.z - n.z)); if (n.cammina) n.cammina.yaw = n.yaw; } // si gira verso di te
        if (n.av) { n.av.setPose({ x: n.x, z: n.z, yaw: n.yaw, anim }); n.av.update(1, dt); scegliLod(n.meshes, o.camera, n.x, 1, n.z); }
        const p = screenOf(n.x, 2.25, n.z);
        n.label.place(p.x, p.y, p.on && !!n.av && fd(n.x, n.z) < (n.segno ? SHOW_M : NAME_M) && !n.talk && !o.world.race.on && !bancoDi(n.p), n.segno || dist(n.x, n.z) < NAME_NEAR_M); // chi sta a un banco ha già il cartello del banco
      }
    },
  };
}
