// La casa di un giocatore vista dal client: il LotState del server (monete, casa, personaggio…), il baule e i mobili nella stanza, il
// contatore delle monete in alto (solo la tua). Stato dal server: rilettura dopo ogni azione e ogni 30 s mentre sei nel lotto (o sempre, se
// la vista non sa dove sei). Celle di LotState locali al template `lotto`: mondo = (origin + cell + 0,5) × tile. Le case degli amici sono
// in sola lettura.
import * as THREE from 'three';
import { ISLANDS } from '@marea/content';
import { casaDi, inStanza, parseIsland } from '@marea/sim';
import { createArrediVista } from './arredi_vista.ts';
import type { GridMap, LotState } from '@marea/sim';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import { ApiError, MSG_401 } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type LotViewOptions = {
  scene: THREE.Scene; loader: Loader; origin: [number, number]; tile: number; api: Api; hud: Hud;
  /** Casa altrui: niente contatore delle monete. Serve `owner`. */
  readonly?: boolean; owner?: string; ownerName?: string;
  /** Template del lotto (id di islands.json o GridMap già letto); default `lotto`, poi la prima isola. */
  template?: string | GridMap;
  groundY?: (x: number, z: number) => number;
  /** Stato già in mano (es. da /api/me): evita la prima lettura. */
  initial?: LotState | null;
};
export type LotView = {
  readonly readonly: boolean; readonly group: THREE.Group; readonly ready: Promise<void>;
  state(): LotState | null; refresh(): Promise<void>;
  /** Stato arrivato da un'altra risposta del server (azione GDR, spedizione, acquisto): si applica senza rileggere. */
  set(l: LotState): void;
  /** Ogni frame. `focus` = posizione dell'avatar: la rilettura ogni 30 s gira solo quando è nel lotto (senza focus: sempre). */
  update(dt: number, focus?: { x: number; z: number }): void;
  contains(x: number, z: number): boolean; dispose(): void;
  readonly template: GridMap; readonly origin: [number, number]; readonly tile: number;
};

const POLL_S = 30;

export function createLotView(o: LotViewOptions): LotView {
  const ro = !!o.readonly, T = o.tile, [ox, oz] = o.origin;
  const tpl: GridMap = typeof o.template === 'object' ? o.template : parseIsland(ISLANDS.find((i) => i.id === (o.template ?? 'lotto')) ?? ISLANDS.find((i) => i.id === 'lotto') ?? ISLANDS[0]!);
  const gy = o.groundY ?? (() => 0.4);
  const group = new THREE.Group(); group.name = ro ? `lot_${o.owner ?? '?'}` : 'lot_mio'; o.scene.add(group);
  const world = (c: readonly [number, number]) => { const x = (ox + c[0] + 0.5) * T, z = (oz + c[1] + 0.5) * T; return { x, z, y: gy(x, z) }; };
  const arredi = createArrediVista({ group, origin: o.origin, tile: T, groundY: gy });
  let lot: LotState | null = o.initial ?? null;
  let poll = 0, inflight: Promise<void> | null = null, lastError: string | null = null, refreshes = 0, disposed = false;

  // ---- il baule (il Forziere) in casa: un mobile vero, girato come vuoi (davanti verso +Z, la camera di casa guarda da sud) ----
  const baule = new THREE.Group(); baule.name = 'baule'; group.add(baule);
  let bauleKey = '', bauleTok = 0;
  async function disegnaBaule(livello: number, tok: number): Promise<void> {
    const m = await import('../render/mobili.ts');
    if (tok !== bauleTok || disposed) return;
    const obj = new THREE.Mesh(m.bauleGeo(livello), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    obj.castShadow = obj.receiveShadow = true; obj.userData['baule'] = true;
    baule.clear(); baule.add(obj);
  }
  function sync(): void {
    if (!lot) return;
    const b = lot.buildings.find((x) => x.building === 'forziere' && x.level >= 1 && inStanza(x.cell)) ?? null, rot = casaDi(lot).bauleRot ?? 0;
    const key = b ? `${b.level}:${b.cell.join(',')}:${rot}` : '';
    if (key !== bauleKey) {
      bauleKey = key; baule.visible = !!b;
      if (b) {
        const p = world(b.cell); baule.position.set(p.x, p.y, p.z); baule.rotation.y = (rot * Math.PI) / 2;
        void disegnaBaule(b.level, ++bauleTok).catch(() => { /* senza baule si gioca lo stesso */ });
      }
    }
    arredi.sync(lot);
    if (!ro) o.hud.setResources?.({ monete: lot.monete });
  }

  // ---- stato dal server ----
  let setSeq = 0;
  function setLot(l: LotState): void { setSeq++; poll = 0; lot = l; sync(); }
  function fail(e: unknown): void {
    lastError = e instanceof ApiError ? e.message : 'Qualcosa non va, riprova';
    if (e instanceof ApiError && e.status === 401) o.hud.banner?.(MSG_401); else o.hud.toast(lastError, 3200);
  }
  function refresh(): Promise<void> {
    if (inflight) return inflight;
    if (!o.api.enabled || (ro && !o.owner)) return Promise.resolve();
    poll = 0;
    const seq = setSeq;
    inflight = o.api.lot(ro ? o.owner : undefined)
      .then((l) => { refreshes++; if (!disposed && seq === setSeq && (!lot || l.version >= lot.version)) setLot(l); lastError = null; })
      .catch((e: unknown) => { fail(e); })
      .finally(() => { inflight = null; });
    return inflight;
  }
  const onVis = () => { if (!document.hidden) void refresh(); };
  document.addEventListener('visibilitychange', onVis);

  const contains = (x: number, z: number) => x >= ox * T - 6 && z >= oz * T - 6 && x <= (ox + tpl.w) * T + 6 && z <= (oz + tpl.h) * T + 6;

  // ---- test API ----
  const key = ro ? `lot:${o.owner ?? '?'}` : 'lot', sfx = ro ? `@${o.owner ?? '?'}` : '';
  const unState = registerStateProvider(key, () => ({
    ready: !!lot, readonly: ro, owner: lot?.owner ?? o.owner ?? null, origin: [ox, oz], serverNow: o.api.serverNow(), refreshes, error: lastError ?? o.api.lastError,
    monete: lot?.monete ?? null, baule: bauleKey || null,
  }));
  registerTestHook('lotRefresh' + sfx, () => refresh());

  const ready = lot ? (sync(), Promise.resolve()) : refresh();
  return {
    readonly: ro, group, ready, template: tpl, origin: o.origin, tile: T,
    state: () => lot, refresh, contains, set: (l: LotState) => { if (!disposed) setLot(l); },
    update(dt, focus) {
      if (disposed) return;
      const active = !focus || contains(focus.x, focus.z);
      if (active && !document.hidden) { poll += dt; if (poll >= POLL_S) void refresh(); }
    },
    dispose() {
      disposed = true; unState(); arredi.dispose(); o.scene.remove(group);
      document.removeEventListener('visibilitychange', onVis);
      if (!ro) o.hud.setResources?.(null);
    },
  };
}
