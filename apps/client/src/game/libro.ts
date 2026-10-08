// Libro degli ospiti e «Mentre eri via» (#86, GDD §2), la parte nel bundle iniziale (piccola): un leggio col libro aperto vicino al molo
// di ogni isola abitata (cella RIENTRO.libro di content), cartello LIBRO da vicino, bottone FIRMA sull'isola di un amico (LIBRO sulla tua)
// quando ci sei accanto a piedi (A / E / Spazio). Il pannello del libro e la cartolina «Mentre eri via» stanno in ui/rientro.ts,
// scaricato con import() solo quando servono (tetto del JS iniziale, TECH §5). Firmare = POST /api/libro/firma: decide il server.
import * as THREE from 'three';
import { RIENTRO } from '@marea/content';
import { firmatoOggi } from '@marea/sim';
import type { Riepilogo } from '@marea/sim';
import type { EmoteId } from '@marea/protocol';
import type { GameWorld } from './world.ts';
import type { LotView } from './lot.ts';
import type { Api, Me } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { el, injectUiStyle } from '../ui/style.ts';
import { pixIcon } from '../ui/icons.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import type { RientroUi } from '../ui/rientro.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

/** Un'isola abitata col suo libro: `view` dà il LotState (firme comprese), `mine` = la tua. */
export type LibroIsola = { slot: number; owner: string; ownerName: string; mine: boolean; view: LotView };
export type Libri = {
  /** Un tick (60 Hz): vicino al leggio, il fronte di salita di A apre il libro. true = A è del libro (sei accanto o è aperto). */
  tick(a: boolean): boolean;
  /** Ogni frame: cartelli e bottone. `focus` = dove sei (avatar o barca). */
  update(focus: { x: number; z: number }): void;
  /** Libro o cartolina aperti (o in caricamento): il mondo sta fermo. */
  isBusy(): boolean;
  close(): void;
  /** «Mentre eri via»: la cartolina, se nel riepilogo c'è qualcosa da raccontare. Risponde true se l'ha mostrata. */
  cartolina(r: Riepilogo, novita: number, raccogli: (() => void) | null): Promise<boolean>;
};
export type LibriOpts = {
  world: GameWorld; api: Api | null; me: Me | null; hud: Hud; root: HTMLElement; camera: THREE.Camera; canvas: HTMLCanvasElement;
  isole: LibroIsola[];
  /** Firma andata a buon fine: l'emote scelta parte anche sopra la testa (la vedono gli amici vicini). false = non è partita (riprova). */
  onFirma(emote: EmoteId): boolean;
};

const CSS = `
.mz-lbl.libro { border-color: ${P.giallo}; font-size: 13px; min-height: 32px; }
.mz-play.on ~ .mz-libro-btn.on { top: calc(60% + 66px); }
`;

/** Leggio col libro aperto: chi legge sta dalla parte +Z (verso il molo), il piano è inclinato verso di lui. */
function leggioGeometry(): THREE.BufferGeometry {
  const top: THREE.BufferGeometry[] = [
    painted(new THREE.BoxGeometry(0.72, 0.06, 0.52), P.legnoChiaro, M(0, 0, 0)),
    painted(new THREE.BoxGeometry(0.66, 0.03, 0.44), P.rosso, M(0, 0.045, 0)),
    painted(new THREE.BoxGeometry(0.31, 0.04, 0.4), P.sabbiaChiara, M(-0.16, 0.075, 0, 0, 0, 0.1)),
    painted(new THREE.BoxGeometry(0.31, 0.04, 0.4), P.sabbiaChiara, M(0.16, 0.075, 0, 0, 0, -0.1)),
    painted(new THREE.BoxGeometry(0.2, 0.012, 0.03), P.pietraScura, M(-0.16, 0.1, -0.08, 0, 0, 0.1)),
    painted(new THREE.BoxGeometry(0.2, 0.012, 0.03), P.pietraScura, M(-0.16, 0.1, 0.04, 0, 0, 0.1)),
    painted(new THREE.BoxGeometry(0.16, 0.012, 0.03), P.pietraScura, M(0.16, 0.1, -0.08, 0, 0, -0.1)),
    painted(new THREE.BoxGeometry(0.035, 0.012, 0.3), P.rosso, M(0.02, 0.1, 0.12)),
  ];
  const t = merged(top).applyMatrix4(M(0, 1.02, 0, 0.38, 0, 0));
  return merged([
    painted(new THREE.BoxGeometry(0.56, 0.08, 0.44), P.legnoScuro, M(0, 0.04, 0)),
    painted(new THREE.BoxGeometry(0.13, 0.95, 0.13), P.legno, M(0, 0.55, 0)),
    painted(new THREE.BoxGeometry(0.3, 0.06, 0.1), P.legnoScuro, M(0, 0.98, 0)),
    t,
  ]);
}

export function createLibri(o: LibriOpts): Libri {
  injectUiStyle();
  if (!document.getElementById('mz-libro-style')) { const st = document.createElement('style'); st.id = 'mz-libro-style'; st.textContent = CSS; document.head.appendChild(st); }
  const arch = o.world.archipelago, cfg = RIENTRO.libro;
  const layer = createLabelLayer(o.root);
  const geos: THREE.BufferGeometry[] = [];
  const libri = o.isole.map((is) => {
    const w = arch.lotCellToWorld(is.slot, cfg.lotto), y = o.world.groundY(w.x, w.z);
    geos.push(leggioGeometry().applyMatrix4(M(w.x, y, w.z, 0, 0, 0, 1.2, 1.2, 1.2)));
    const label = layer.add(() => { if (dist(w.x, w.z) < cfg.raggio * 2.5) void open(lib); else o.hud.toast(`Libro degli ospiti${is.mine ? '' : ' di ' + is.ownerName}: vicino al molo`, 2200); });
    label.set('bubble', [pixIcon('libro', 16), el('span', '', 'LIBRO')], 'libro'); label.el.classList.add('libro'); label.el.dataset['libro'] = is.owner;
    const lib = { is, x: w.x, z: w.z + 0.9, px: w.x, pz: w.z, y, label }; // x, z = dove sta chi legge (davanti al leggio, verso il molo)
    return lib;
  });
  type Lib = (typeof libri)[number];
  if (geos.length) {
    const mesh = new THREE.Mesh(merged(geos), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.name = 'libri_ospiti'; mesh.castShadow = true; mesh.receiveShadow = true; o.world.scene.add(mesh);
  }

  const btn = el('button', 'mz mz-play mz-libro-btn'); btn.id = 'mzLibroBtn'; btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (near) void open(near); });
  o.root.appendChild(btn);

  let ui: RientroUi | null = null, loading: Promise<RientroUi | null> | null = null, near: Lib | null = null, nearWas: Lib | null = null, aWas = false, closedAt = 0, busy = false;
  const me = () => (o.world.mode === 'walk' ? o.world.avatar.state : o.world.boat.state);
  function dist(x: number, z: number): number { const f = me(); return Math.hypot(f.x - x, f.z - z); }
  const firmato = (l: Lib) => !l.is.mine && !!o.me && !!l.is.view.state() && firmatoOggi(l.is.view.state()!, o.me.id, o.api?.serverNow() ?? 0);

  async function loadUi(): Promise<RientroUi | null> {
    if (ui) return ui;
    loading ??= import('../ui/rientro.ts').then((m) => { ui = m.createRientroUi({ root: o.root, hud: o.hud, now: () => o.api?.serverNow() ?? 0, onClose: () => { closedAt = performance.now(); } }); return ui; })
      .catch(() => { loading = null; o.hud.toast('Pannello non caricato: riprova', 2500); return null; });
    return loading;
  }
  async function firma(l: Lib, emote: EmoteId): Promise<boolean> {
    if (!o.api || busy) return false;
    busy = true;
    try {
      const lot = await o.api.firma(l.is.owner, emote);
      l.is.view.set(lot);
      ui?.close();
      o.hud.toast(`Hai firmato il libro di ${l.is.ownerName}`, 2600);
      // a pannello chiuso il mondo riparte al tick dopo e l'emote si può fare: riprova per un paio di secondi (telefoni lenti)
      const prova = (n: number) => { if (!o.onFirma(emote) && n > 0) setTimeout(() => prova(n - 1), 150); };
      setTimeout(() => prova(14), 100);
      return true;
    } catch (e) {
      o.hud.toast(e instanceof ApiError ? e.message : 'Firma non riuscita, riprova', 3000);
      if (e instanceof ApiError && e.status === 409) void l.is.view.refresh();
      return false;
    } finally { busy = false; }
  }
  async function open(l: Lib): Promise<boolean> {
    if (ui?.isOpen() || o.world.race.on || performance.now() - closedAt < 350) return false;
    const u = await loadUi();
    if (!u || u.isOpen()) return false;
    btn.classList.remove('on');
    if (!l.is.mine && !l.is.view.state()) await l.is.view.refresh();
    u.libro({
      mine: l.is.mine, ownerName: l.is.ownerName, lot: l.is.view.state(), now: () => o.api?.serverNow() ?? 0,
      puoFirmare: !l.is.mine && !!o.api && !!o.me && !firmato(l), firmato: firmato(l), firma: (e) => firma(l, e),
    });
    return true;
  }
  function findNear(): Lib | null {
    if (o.world.mode !== 'walk' || o.world.race.on) return null;
    let best: Lib | null = null, bd = Infinity;
    for (const l of libri) { const d = dist(l.x, l.z); if (d < cfg.raggio && d < bd) { bd = d; best = l; } }
    return best;
  }

  const v = new THREE.Vector3();
  const screenOf = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(o.camera);
    const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  let card: { riepilogo: Riepilogo; novita: number; mostrata: boolean } | null = null;
  registerStateProvider('libro', () => ({
    near: near?.is.owner ?? null, open: ui?.isOpen() ? ui.kind : null, ui: ui?.state() ?? null, busy,
    libri: libri.map((l) => ({ owner: l.is.owner, mine: l.is.mine, x: l.x, z: l.z, firme: l.is.view.state()?.ospiti?.length ?? 0, firmato: firmato(l) })),
    cartolina: card,
  }));
  registerTestHook('libroApri', async (owner) => { const l = libri.find((x) => x.is.owner === owner) ?? near; return l ? open(l) : false; });
  registerTestHook('libroChiudi', () => { ui?.close(); return true; });

  return {
    isBusy: () => !!ui?.isOpen(),
    close: () => ui?.close(),
    async cartolina(r, novita, raccogli) {
      const vuota = r.depositi.legno + r.depositi.pietra + r.depositi.perle <= 0 && !r.cantiere && !r.ospitiTot && !r.missioniNuove && novita <= 0;
      card = { riepilogo: r, novita, mostrata: false };
      if (vuota) return false;
      const u = await loadUi();
      if (!u) return false;
      if (u.isOpen()) u.close();
      u.cartolina(r, novita, raccogli);
      card.mostrata = true;
      return true;
    },
    tick(a) {
      const pressA = a && !aWas; aWas = a;
      if (ui?.isOpen()) { near = null; return true; }
      near = findNear();
      if (near && near !== nearWas) o.hud.toast(near.is.mine ? 'Il tuo libro degli ospiti: premi A' : firmato(near) ? `Hai già firmato oggi il libro di ${near.is.ownerName}` : `Libro di ${near.is.ownerName}: premi A per firmare`, 2200);
      nearWas = near;
      if (near && pressA) void open(near);
      return !!near || (!!loading && !ui);
    },
    update(focus) {
      const t = near, show = !!t && !ui?.isOpen() && !o.world.race.on && !o.world.frozen;
      const k = t ? `${t.is.owner}:${t.is.mine ? 'mio' : firmato(t) ? 'fatto' : 'firma'}` : '';
      if (show && t && btn.dataset['k'] !== k) {
        btn.dataset['k'] = k;
        btn.replaceChildren(pixIcon('libro', 24), el('span', '', t.is.mine ? 'LIBRO DEGLI OSPITI' : firmato(t) ? 'LIBRO · FIRMATO' : 'FIRMA'), el('small', '', 'A'));
      }
      btn.classList.toggle('on', show);
      for (const l of libri) {
        const d = Math.hypot(focus.x - l.px, focus.z - l.pz), p = d < cfg.vista ? screenOf(l.px, l.y + 2.0, l.pz) : null;
        l.label.place(p?.x ?? 0, p?.y ?? 0, !!p?.on && !o.world.race.on && !ui?.isOpen(), dist(l.px, l.pz) < LABEL_NEAR_M);
      }
    },
  };
}
