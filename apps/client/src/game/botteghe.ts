// Le botteghe di Borgo Marea (#414, VISIONE §2) nel mondo: il Fabbro in piazza accanto alla Grotta, l'Alchimista a ovest del Mercante, il
// Cantiere navale in riva a est del molo (botteghe.json `posto`: sparse per il Borgo, Jack non le voleva tutte in fila), casette copiate dal concept scelto da Jack (render/botteghe_forme.ts), coi bottegai dietro al banco
// (avatar `chr_base`), il cartellino col nome, il fumo del camino e del calderone. Davanti al banco: bottone col nome della bottega (A / E /
// Spazio) → il pannello della bottega (rpg/bottega_ui.ts, scaricato alla prima apertura). Chunk a parte (main.ts lo scarica dopo l'avvio):
// le botteghe compaiono un attimo dopo il mondo. Draw call: casette in un mesh (+ ombra), insegne, fumi: 4 in tutto, più i bottegai da vicino.
import * as THREE from 'three';
import { BOTTEGHE, BOTTEGHE_IDS } from '@marea/content/botteghe.ts';
import type { BottegaId } from '@marea/content/botteghe.ts';
import { posaForma } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el } from '../ui/style.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import { eroeForPanels } from '../ui/eroe.ts';
import { M, merged } from '../render/island_parts.ts';
import { FORME, canvasInsegna, facciaInsegna, texInsegne } from '../render/botteghe_forme.ts';
import { createAvatar } from './avatar.ts';
import { inFila, scegliLod } from './gente_lod.ts';
import type { Avatar } from './avatar.ts';
import type { BottegaUi } from '../rpg/bottega_ui.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type Botteghe = {
  /** Dove ci si ferma per comprare (coordinate mondo): per la bussola. */
  readonly spots: readonly { id: BottegaId; nome: string; x: number; z: number }[];
  /** Un tick (60 Hz): davanti al banco il fronte di salita di A apre la bottega. true = A è delle botteghe. */
  tick(a: boolean): boolean;
  update(dt: number, focus: { x: number; z: number }): void;
  isBusy(): boolean;
  close(): void;
};
export type BottegheOpts = {
  world: GameWorld; loader: Loader; api: Api | null; me: Me | null; hud: Hud; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement;
  getLot(): LotState | null; setLot(l: LotState): void;
};

const CSS = `
.mz-play.on ~ .mz-bottega-btn.on { top: calc(60% + 66px); }
.mz-bottega-btn canvas { width: 24px; height: 24px; image-rendering: pixelated; }
.mz-lbl.bottega canvas { width: 16px; height: 16px; image-rendering: pixelated; }
`;
/** I bottegai (avatar `chr_base`, 5 draw call a testa e altrettante d'ombra, senza frustum culling) si disegnano solo da vicino: dall'alto sulla
 *  piazza tre bottegai sforavano le 100 draw call (TECH §5). L'ombra solo vicinissimi, come la gente del Porto. */
const SHOW_M = 60, NPC_M = 10, SHADOW_M = 6, PUFF = 5;

/** L'icona a pixel della bottega (la sua insegna) per il bottone e il cartellino. */
const iconaBottega = (id: BottegaId): HTMLCanvasElement => canvasInsegna(id);

export function createBotteghe(o: BottegheOpts): Botteghe {
  if (!document.getElementById('mz-botteghe-style')) { const st = document.createElement('style'); st.id = 'mz-botteghe-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago, T = arch.tile, porto = arch.places.find((q) => q.role === 'porto');
  const [ox, oz] = porto?.origin ?? arch.porto.origin;
  const at = (c: readonly [number, number]) => ({ x: (ox + c[0] + 0.5) * T, z: (oz + c[1] + 0.5) * T });
  const group = new THREE.Group(); group.name = 'botteghe'; o.world.scene.add(group);
  const layer = createLabelLayer(o.root);
  let ui: BottegaUi | null = null, loading: Promise<BottegaUi | null> | null = null, near: BottegaId | null = null, nearWas: BottegaId | null = null, aWas = false, closedAt = 0;

  // ---- le casette (e il fuoco, la pozione) in un mesh a colori per vertice, le insegne in un altro ----
  const corpi: THREE.BufferGeometry[] = [], insegne: THREE.BufferGeometry[] = [];
  const fumi: { x: number; y: number; z: number; c: THREE.Color }[] = [];
  const posti = BOTTEGHE_IDS.flatMap((id) => {
    const b = BOTTEGHE[id], posto = b.posto;
    if (!posto) return [];
    const w = at(posto.at), f = at(posto.fronte), y = o.world.groundY(w.x, w.z), ry = posto.rot + Math.PI; // il modello guarda +Z, `rot` è il verso del davanti (π = sud)
    const forme = FORME[id](), m = M(w.x, y, w.z, 0, ry, 0);
    corpi.push(forme.corpo.applyMatrix4(m));
    if (forme.luce.attributes.position) corpi.push(forme.luce.applyMatrix4(m)); // fuoco e pozione nel corpo: una draw call in meno (TECH §5)
    const s = forme.insegna;
    insegne.push(facciaInsegna(id).applyMatrix4(M(s.x, s.y, s.z, 0, s.ry, 0)).applyMatrix4(m));
    const loc = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z).applyMatrix4(m);
    for (const fu of forme.fumi) { const p = loc(fu.x, fu.y, fu.z); fumi.push({ x: p.x, y: p.y, z: p.z, c: new THREE.Color(fu.colore) }); }
    const bp = loc(forme.bottegaio.x, 0, forme.bottegaio.z);
    posaForma(o.world.solidi, 'bottega_' + id, w.x, w.z, ry); posaForma(o.world.solidi, 'persona', bp.x, bp.z); // la casetta e chi ci sta dietro al banco sono solidi
    const label = layer.add(() => { if (dist(f.x, f.z) < posto.raggio + 2) void apri(id); else o.hud.toast(`${b.nome}: ${posto.dove}`, 2200); });
    label.set('bubble', [iconaBottega(id), el('span', '', b.nome)], 'spot'); label.el.classList.add('spot', 'bottega'); label.el.dataset['bottega'] = id;
    return [{ id, nome: b.nome, raggio: posto.raggio, x: w.x, y, z: w.z, fx: f.x, fz: f.z, ry, bx: bp.x, bz: bp.z, label, av: null as Avatar | null, ombra: true, meshes: [] as THREE.Mesh[] }];
  });
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const corpo = new THREE.Mesh(merged(corpi), vc); corpo.name = 'botteghe_casette'; corpo.castShadow = corpo.receiveShadow = true; group.add(corpo);
  const ins = new THREE.Mesh(merged(insegne), new THREE.MeshLambertMaterial({ map: texInsegne(), side: THREE.FrontSide })); ins.name = 'botteghe_insegne'; group.add(ins);
  // fumo: PUFF cubetti per ogni camino o calderone che salgono, crescono e spariscono (un InstancedMesh)
  const fumo = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshLambertMaterial({ flatShading: true }), Math.max(1, fumi.length * PUFF));
  fumo.name = 'botteghe_fumo'; fumo.frustumCulled = false; group.add(fumo);
  fumi.forEach((fu, i) => { for (let k = 0; k < PUFF; k++) fumo.setColorAt(i * PUFF + k, fu.c); });
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), eu = new THREE.Euler();

  // ---- i bottegai, dietro al banco ----
  for (const s of posti) {
    const look = BOTTEGHE[s.id].look;
    if (!look) continue;
    const modello = BOTTEGHE[s.id].modello;
    void inFila(() => createAvatar({ loader: o.loader, look, x: s.bx, z: s.bz, ...(modello ? { modello } : {}) })).then((av) => {
      av.setGround(o.world.groundY); av.object.name = 'bottegaio_' + s.id; group.add(av.object); s.av = av;
      av.object.traverse((x) => { if ((x as THREE.Mesh).isMesh) s.meshes.push(x as THREE.Mesh); });
      av.setPose({ x: s.bx, z: s.bz, yaw: -s.ry + Math.PI, anim: 'idle' }); // guarda la strada (yaw 0 = −Z)
    }).catch(() => { /* senza avatar la bottega funziona lo stesso */ });
  }

  // ---- bottone ----
  const btn = el('button', 'mz mz-play mz-porto-btn mz-bottega-btn'); btn.id = 'mzBottegaBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) void apri(near); });
  o.root.appendChild(btn);

  const me = () => (o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state);
  function dist(x: number, z: number): number { const f = me(); return Math.hypot(f.x - x, f.z - z); }

  async function loadUi(): Promise<BottegaUi | null> {
    if (ui) return ui;
    loading ??= import('../rpg/bottega_ui.ts').then((m) => {
      ui = m.createBottegaUi({ api: o.api, me: o.me, hud: o.hud, root: o.root, getLot: o.getLot, setLot: o.setLot, onClose: () => { closedAt = performance.now(); } });
      return ui;
    }).catch(() => { loading = null; o.hud.toast('Bottega non caricata: riprova', 2500); return null; });
    return loading;
  }
  async function apri(id: BottegaId): Promise<boolean> {
    if (ui?.isOpen() || eroeForPanels()?.isOpen() || o.world.race.on || performance.now() - closedAt < 350) return false;
    const u = await loadUi();
    if (!u || u.isOpen()) return false;
    btn.classList.remove('on');
    u.apri(id);
    return true;
  }
  function findNear(): BottegaId | null {
    if (o.world.mode !== 'walk' || o.world.race.on) return null;
    let best: BottegaId | null = null, bd = Infinity;
    for (const s of posti) { const d = dist(s.fx, s.fz); if (d < s.raggio && d < bd) { bd = d; best = s.id; } }
    return best;
  }

  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };
  let t = 0;

  registerStateProvider('botteghe', () => ({
    near, aperta: ui?.isOpen() ? ui.kind : null, ui: ui?.state() ?? null,
    posti: posti.map((s) => ({ id: s.id, x: s.x, z: s.z, fronte: { x: s.fx, z: s.fz }, bottegaio: !!s.av })),
  }));
  registerTestHook('bottegaApri', (id) => apri(String(id) as BottegaId));
  registerTestHook('bottegaChiudi', () => { ui?.close(); return true; });
  /** Davanti alla bottega, a `m` metri dal banco (per le foto). */
  registerTestHook('bottegaVai', (id, m) => {
    const s = posti.find((x) => x.id === id); if (!s) return false;
    const k = Number(m ?? 0), dx = s.fx - s.x, dz = s.fz - s.z, l = Math.hypot(dx, dz) || 1;
    o.world.avatar.teleport(s.fx + (dx / l) * k, s.fz + (dz / l) * k, Math.atan2(-dx, dz)); return true;
  });

  return {
    spots: posti.map((s) => ({ id: s.id, nome: s.nome, x: s.fx, z: s.fz })),
    isBusy: () => !!ui?.isOpen(),
    close: () => ui?.close(),
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (ui?.isOpen()) { near = null; return true; }
      near = findNear();
      if (near && near !== nearWas) o.hud.toast(`${BOTTEGHE[near].nome}: premi A`, 2200);
      nearWas = near;
      if (near && pressA) void apri(near);
      return !!near || (!!loading && !ui);
    },
    update(dt, focus) {
      t += dt;
      const show = !!near && !ui?.isOpen() && !eroeForPanels()?.isOpen() && !o.world.race.on && !o.world.frozen;
      if (show && near && btn.dataset['k'] !== near) { btn.dataset['k'] = near; btn.replaceChildren(iconaBottega(near), el('span', '', BOTTEGHE[near].nome), el('small', '', 'A')); }
      btn.classList.toggle('on', show);
      const fd = (x: number, z: number) => Math.hypot(focus.x - x, focus.z - z);
      for (const s of posti) {
        const p = screenOf(s.x, 5.2, s.z);
        s.label.place(p.x, p.y, p.on && fd(s.x, s.z) < SHOW_M && !o.world.race.on, dist(s.x, s.z) < LABEL_NEAR_M);
        if (s.av) {
          const ombra = fd(s.bx, s.bz) < SHADOW_M;
          if (ombra !== s.ombra) { s.ombra = ombra; for (const m of s.meshes) m.castShadow = ombra; }
          const far = fd(s.bx, s.bz) > NPC_M; s.av.visible = !far; s.av.object.visible = !far; if (!far) { s.av.setPose({ x: s.bx, z: s.bz, yaw: -s.ry + Math.PI, anim: 'idle' }); s.av.update(1, dt); scegliLod(s.meshes, o.camera, s.bx, 1, s.bz); } }
      }
      // i fumi che salgono
      fumi.forEach((fu, i) => {
        for (let j = 0; j < PUFF; j++) {
          const ph = (t * 0.3 + j / PUFF + i * 0.37) % 1, s = (0.6 + ph * 1.2) * (ph > 0.75 ? (1 - ph) * 4 : 1);
          pos.set(fu.x + Math.sin(ph * 5 + i) * 0.15 + ph * 0.4, fu.y + ph * 1.8, fu.z + Math.cos(ph * 4 + j) * 0.12);
          q.setFromEuler(eu.set(ph * 2, ph * 3, 0)); sc.setScalar(Math.max(0.001, s));
          fumo.setMatrixAt(i * PUFF + j, mtx.compose(pos, q, sc));
        }
      });
      fumo.instanceMatrix.needsUpdate = true;
    },
  };
}
