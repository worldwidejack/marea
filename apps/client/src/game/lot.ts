// Vista economica di un'isola (M1-isola): edifici del LotState sulle celle del template, depositi, cantiere, tap → pannelli, build mode.
// Sugli slot liberi dell'isola propria un cartello «Costruisci» (tocco = pannello); lo slot suggerito dalla guida apre già la conferma.
// Stato e ora dal server (api.serverNow() solo per animare i timer e i depositi che crescono); rilettura dopo ogni azione e ogni 30 s
// mentre sei sull'isola. Celle di LotState locali al template: mondo = (origin + cell + 0,5) × tile.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLANDS, building as buildingDef } from '@marea/content';
import { advance, bufferParams, parseIsland, storageCap } from '@marea/sim';
import type { GridMap, LotState, PlacedBuilding } from '@marea/sim';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import { ApiError, MSG_401, mancaText } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import { PAL, el } from '../ui/style.ts';
import { pixIcon, resIcon } from '../ui/icons.ts';
import { createLabelLayer, createSheet, flyResources, fmtClock, tickTimers, timerSpan } from '../ui/sheet.ts';
import type { Label, LabelLayer, Sheet } from '../ui/sheet.ts';
import { buildPanel, buildable, buildingPanel } from '../ui/lotpanels.ts';
import type { PanelCtx } from '../ui/lotpanels.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type LotViewOptions = {
  scene: THREE.Scene; loader: Loader; origin: [number, number]; tile: number; api: Api; hud: Hud;
  /** Isola altrui: niente azioni, niente barra risorse. Serve `owner`. */
  readonly?: boolean; owner?: string; ownerName?: string;
  /** Per il tap (raycast): camera del renderer e canvas. Senza, la vista si guarda e basta. */
  camera?: THREE.Camera; canvas?: HTMLCanvasElement;
  /** Template del lotto (id di islands.json o GridMap già letto); default `lotto`, poi la prima isola. */
  template?: string | GridMap;
  groundY?: (x: number, z: number) => number;
  /** Stato già in mano (es. da /api/me): evita la prima lettura. */
  initial?: LotState | null;
  /** Slot suggerito (guida «Primi passi»): il suo cartello è evidenziato e toccarlo apre già la conferma di `building`. */
  hint?: () => { cell: [number, number]; building: string } | null;
  /** Edifici da non offrire nel pannello Costruisci (es. il Tavolo finché le sfide con posta sono spente). */
  hide?: readonly string[];
};
export type LotView = {
  readonly readonly: boolean; readonly group: THREE.Group; readonly ready: Promise<void>;
  state(): LotState | null; refresh(): Promise<void>;
  /** Stato arrivato da un'altra risposta del server (azione GDR, spedizione): si applica senza rileggere. */
  set(l: LotState): void;
  /** Ogni frame. `focus` = posizione dell'avatar: la rilettura ogni 30 s gira solo quando è sull'isola (senza focus: sempre). */
  update(dt: number, focus?: { x: number; z: number }): void;
  tap(target: string | [number, number]): boolean; contains(x: number, z: number): boolean; dispose(): void;
};

const POLL_S = 30, FACING = Math.PI; // i modelli guardano −Z: li giriamo verso la camera (sud-est)
const COLORS: Record<string, [string, string]> = {
  segheria: [PAL.legno, PAL.legnoScuro], cava: [PAL.pietra, PAL.roccia], magazzino: [PAL.legnoChiaro, PAL.rosso],
  casa: [PAL.sabbiaChiara, PAL.rosso], faro: [PAL.pietraChiara, PAL.rosso], tavolo: [PAL.legno, PAL.arancio],
};
const mats = new Map<string, THREE.MeshLambertMaterial>();
const mat = (c: string) => { let m = mats.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: new THREE.Color(c), flatShading: true }); mats.set(c, m); } return m; };
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);

/** Segnaposto a colori di palette finché M1-asset non ha il modello. */
function placeholder(kind: string): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'cantiere') {
    const parts = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([x, z]) => box(0.14, 1.3, 0.14, x, 0, z));
    parts.push(box(1.6, 0.1, 0.12, 0, 1.2, -0.7), box(1.6, 0.1, 0.12, 0, 1.2, 0.7), box(0.12, 0.1, 1.6, -0.7, 1.2, 0), box(0.12, 0.1, 1.6, 0.7, 1.2, 0), box(1.0, 0.25, 0.5, 0.1, 0, 0.1));
    g.add(new THREE.Mesh(mergeGeometries(parts), mat(PAL.legnoChiaro)));
    g.add(new THREE.Mesh(box(0.5, 0.4, 0.5, -0.3, 0, -0.2), mat(PAL.pietra)));
  } else {
    const [body, roof] = COLORS[kind] ?? [PAL.sabbia, PAL.legnoScuro];
    const tall = kind === 'faro' ? 2.6 : 1.2;
    g.add(new THREE.Mesh(box(kind === 'faro' ? 0.9 : 1.5, tall, kind === 'faro' ? 0.9 : 1.3), mat(body)));
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.8, 4).rotateY(Math.PI / 4).translate(0, tall + 0.4, 0), mat(roof));
    g.add(r);
  }
  g.traverse((n) => { if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return g;
}
/** Cornice quadrata a terra (slot libero, cella scelta). */
function frameGeo(): THREE.BufferGeometry {
  const s = 1.7, t = 0.14, h = 0.05;
  return mergeGeometries([box(s, h, t, 0, 0, -s / 2 + t / 2), box(s, h, t, 0, 0, s / 2 - t / 2), box(t, h, s, -s / 2 + t / 2, 0, 0), box(t, h, s, s / 2 - t / 2, 0, 0)]);
}

type Drawn = { holder: THREE.Group; key: string; model: string; height: number; tok: number; label: Label };
type Shared = { sheet: Sheet; labels: LabelLayer; owner: object | null };
const shared = new WeakMap<HTMLElement, Shared>();

export function createLotView(o: LotViewOptions): LotView {
  const ro = !!o.readonly, T = o.tile, [ox, oz] = o.origin;
  const tpl: GridMap = typeof o.template === 'object' ? o.template : parseIsland(ISLANDS.find((i) => i.id === (o.template ?? 'lotto')) ?? ISLANDS.find((i) => i.id === 'lotto') ?? ISLANDS[0]!);
  const gy = o.groundY ?? (() => 0.4);
  const root = o.hud.root ?? (document.getElementById('ui') as HTMLElement);
  let sh = shared.get(root);
  if (!sh) { const s: Shared = { sheet: createSheet(root, () => { s.owner = null; }), labels: createLabelLayer(root), owner: null }; sh = s; shared.set(root, s); }
  const S = sh, me = {};
  const group = new THREE.Group(); group.name = ro ? `lot_${o.owner ?? '?'}` : 'lot_mio'; o.scene.add(group);
  const world = (c: readonly [number, number]) => { const x = (ox + c[0] + 0.5) * T, z = (oz + c[1] + 0.5) * T; return { x, z, y: gy(x, z) }; };
  const fg = frameGeo();
  const slotsMesh = new THREE.InstancedMesh(fg, mat(PAL.arancio), Math.max(1, tpl.lots.length)); slotsMesh.count = 0; slotsMesh.name = 'lot_slot'; group.add(slotsMesh);
  const pick = new THREE.Mesh(fg, mat(PAL.giallo)); pick.visible = false; pick.name = 'lot_scelta'; group.add(pick);
  const drawn = new Map<string, Drawn>();
  const slotLabels = new Map<string, { cell: [number, number]; label: Label }>(); // cartelli «Costruisci» sugli slot liberi
  let lot: LotState | null = o.initial ?? null, view: LotState | null = lot;
  let busy = false, poll = 0, slow = 0, endsSeen = 0, inflight: Promise<void> | null = null, lastError: string | null = null, refreshes = 0, disposed = false;
  let panel: { kind: 'edificio'; id: string } | { kind: 'costruisci'; cell: [number, number]; chosen: string | null } | null = null;
  let holdRes: LotState['resources'] | null = null;

  const now = () => o.api.serverNow();
  const isFree = (c: readonly [number, number]) => !!lot && !lot.buildings.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1]) && !lot.decor.some((d) => d.cell[0] === c[0] && d.cell[1] === c[1]);
  const freeSlots = (): [number, number][] => (lot ? tpl.lots.map((c): [number, number] => [c.cx, c.cz]).filter(isFree) : []);

  // ---- modelli: bld_<id>_l<livello> → _l1 → segnaposto; cantiere: bld_cantiere → segnaposto ----
  async function makeObject(b: PlacedBuilding): Promise<{ obj: THREE.Object3D; name: string }> {
    const def = buildingDef(b.building);
    const names = b.level < 1 ? ['bld_cantiere', 'bld_cantiere_l1'] : [`${def.model}_l${b.level}`, `${def.model}_l1`];
    for (const n of names) if (o.loader.has(n)) { try { return { obj: (await o.loader.load(n)).scene, name: n }; } catch { /* file rotto: prova il prossimo */ } }
    return { obj: placeholder(b.level < 1 ? 'cantiere' : b.building), name: b.level < 1 ? 'segnaposto_cantiere' : 'segnaposto_' + b.building };
  }
  async function loadInto(d: Drawn, b: PlacedBuilding): Promise<void> {
    const tok = ++d.tok;
    const { obj, name } = await makeObject(b);
    if (tok !== d.tok || disposed) return;
    obj.rotation.y = FACING;
    d.holder.clear(); d.holder.add(obj); d.model = name;
    const bb = new THREE.Box3().setFromObject(obj);
    d.height = Number.isFinite(bb.max.y) ? Math.max(1, bb.max.y) : 2.2;
  }
  function sync(): void {
    if (!lot) return;
    const seen = new Set<string>();
    for (const b of lot.buildings) {
      if (b.building === 'molo') continue; // il molo è il terreno `d` dell'isola
      seen.add(b.id);
      let d = drawn.get(b.id);
      if (!d) {
        const holder = new THREE.Group(); holder.name = 'bld_' + b.id; holder.userData['lotId'] = b.id;
        const p = world(b.cell); holder.position.set(p.x, p.y, p.z); group.add(holder);
        const id = b.id;
        d = { holder, key: '', model: '', height: 2.2, tok: 0, label: S.labels.add(() => { if (!ro) void collect(id); }) };
        drawn.set(b.id, d);
      }
      const key = `${b.building}:${b.level}`;
      if (d.key !== key) { d.key = key; void loadInto(d, b); }
    }
    for (const [id, d] of drawn) if (!seen.has(id)) { group.remove(d.holder); d.label.remove(); drawn.delete(id); }
    const free = ro ? [] : freeSlots(), m = new THREE.Matrix4();
    free.forEach((c, i) => { const p = world(c); slotsMesh.setMatrixAt(i, m.makeTranslation(p.x, p.y + 0.02, p.z)); });
    slotsMesh.count = free.length; slotsMesh.instanceMatrix.needsUpdate = true;
    const canBuild = !!lot && buildable(lot).some((d) => !o.hide?.includes(d.id));
    const keep = new Set(canBuild ? free.map((c) => c.join(',')) : []);
    for (const [k, sl] of slotLabels) if (!keep.has(k)) { sl.label.remove(); slotLabels.delete(k); }
    for (const c of canBuild ? free : []) {
      const k = c.join(','); if (slotLabels.has(k)) continue;
      const label = S.labels.add(() => { openBuild(c); });
      label.set('bubble', [pixIcon('martello', 16), el('span', '', 'Costruisci')], 'slot');
      label.el.classList.add('slot'); label.el.dataset['cell'] = k;
      slotLabels.set(k, { cell: c, label });
    }
  }

  // ---- stato dal server ----
  function setLot(l: LotState): void { lot = l; view = advance(l, Math.max(l.nowMs, now())); sync(); refreshUi(true); }
  function fail(e: unknown): string {
    const msg = e instanceof ApiError ? (e.manca ? `${e.message}: ${mancaText(e.manca)}` : e.message) : 'Qualcosa non va, riprova';
    lastError = msg;
    if (e instanceof ApiError && e.status === 401) o.hud.banner?.(MSG_401); else o.hud.toast(msg, 3200);
    return msg;
  }
  function refresh(): Promise<void> {
    if (inflight) return inflight;
    if (!o.api.enabled || (ro && !o.owner)) return Promise.resolve();
    poll = 0;
    inflight = o.api.lot(ro ? o.owner : undefined)
      .then((l) => { refreshes++; if (!disposed) setLot(l); lastError = null; })
      .catch((e: unknown) => { fail(e); })
      .finally(() => { inflight = null; });
    return inflight;
  }
  async function act(fn: () => Promise<LotState>, after?: (prev: LotState, next: LotState) => void): Promise<boolean> {
    if (ro || busy || !lot) return false;
    busy = true; refreshUi(true);
    try { const prev = lot, next = await fn(); if (disposed) return true; setLot(next); after?.(prev, next); lastError = null; return true; }
    catch (e) { fail(e); if (e instanceof ApiError && (e.status === 409 || e.status === 404)) void refresh(); return false; }
    finally { busy = false; refreshUi(true); }
  }
  const screenOf = (x: number, y: number, z: number) => {
    if (!o.camera || !o.canvas) return null;
    const v = new THREE.Vector3(x, y, z).project(o.camera), r = o.canvas.getBoundingClientRect(), rr = root.getBoundingClientRect();
    return { x: r.left - rr.left + ((v.x + 1) / 2) * r.width, y: r.top - rr.top + ((1 - v.y) / 2) * r.height, on: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  };
  function collect(id: string): Promise<boolean> {
    return act(() => o.api.collect(id), (prev, next) => {
      const b = next.buildings.find((x) => x.id === id), res = b ? buildingDef(b.building).produces : undefined;
      if (!b || !res) return;
      const gained = Math.floor(next.resources[res] - prev.resources[res]);
      if (gained <= 0) { o.hud.toast(storageCap(next) - next.resources[res] < 1 ? 'Magazzino pieno: miglioralo per tenere di più' : 'Deposito ancora vuoto'); return; }
      const d = drawn.get(id), p = d ? screenOf(d.holder.position.x, d.holder.position.y + d.height, d.holder.position.z) : null;
      holdRes = prev.resources; refreshUi(true);
      flyResources(root, p ?? { x: innerWidth / 2, y: innerHeight / 2 }, o.hud.resAnchor?.(res) ?? null, res, gained, () => { holdRes = null; o.hud.bump?.(res); refreshUi(true); });
      o.hud.toast(`+${gained} ${res === 'legno' ? 'Legno' : res === 'pietra' ? 'Pietra' : 'Perle'}`, 1400);
    });
  }
  const upgrade = (id: string) => act(() => o.api.upgrade(id));
  const build = (building: string, cell: [number, number]) => act(() => o.api.build(building, cell), (_p, next) => {
    if (!next.construction) return;
    closePanel();
    o.hud.toast(`Cantiere avviato: ${buildingDef(building).nome} tra ${fmtClock(next.construction.endsMs - now())}`, 2600);
  });

  // ---- pannelli ----
  function closePanel(): void { panel = null; pick.visible = false; if (S.owner === me) S.sheet.close(); }
  function openBuilding(id: string): boolean {
    if (!lot?.buildings.some((b) => b.id === id)) return false;
    panel = { kind: 'edificio', id }; pick.visible = false; S.owner = me; renderPanel(); return true;
  }
  function openBuild(cell: [number, number]): boolean {
    if (ro || !lot || !isFree(cell) || !tpl.lots.some((c) => c.cx === cell[0] && c.cz === cell[1])) return false;
    const h = o.hint?.(), sug = h && h.cell[0] === cell[0] && h.cell[1] === cell[1] && buildable(lot).some((d) => d.id === h.building) ? h.building : null;
    panel = { kind: 'costruisci', cell, chosen: sug }; S.owner = me;
    const p = world(cell); pick.position.set(p.x, p.y + 0.04, p.z); pick.visible = true;
    renderPanel(); return true;
  }
  const ctx = (): PanelCtx => ({
    lot: view ?? lot!, readonly: ro, hide: o.hide ?? [], ownerName: o.ownerName ?? o.owner ?? 'un amico', busy,
    onCollect: (id) => void collect(id), onUpgrade: (id) => void upgrade(id), onBuild: (b, c) => void build(b, c),
    onChoose: (b) => { if (panel?.kind === 'costruisci') { panel.chosen = b; renderPanel(); } }, onClose: closePanel,
  });
  function renderPanel(): void {
    if (!panel || !view || S.owner !== me) return;
    if (panel.kind === 'edificio') {
      const id = panel.id, b = view.buildings.find((x) => x.id === id);
      if (!b) { closePanel(); return; }
      const p = buildingPanel(ctx(), b); S.sheet.open('edificio:' + b.id, p.body, p.sig);
    } else {
      if (!isFree(panel.cell)) { closePanel(); return; }
      const p = buildPanel(ctx(), panel.cell, panel.chosen); S.sheet.open(`costruisci:${panel.cell.join(',')}:${panel.chosen ?? ''}`, p.body, p.sig);
    }
    S.sheet.tick(now());
  }

  // ---- UI periodica: depositi proiettati, etichette, barra, chip del cantiere ----
  function refreshUi(force = false): void {
    if (!lot) return;
    if (force || slow >= 0.25) { slow = 0; view = advance(lot, Math.max(lot.nowMs, now())); }
    const v = view ?? lot, t = now();
    const c = v.construction ?? lot.construction;
    if (!ro) {
      o.hud.setResources?.(holdRes ? { ...lot.resources, ...holdRes } : lot.resources);
      const cc = lot.construction;
      if (cc && cc.endsMs > t) o.hud.setWork?.(`${buildingDef(cc.building).nome}${cc.level > 1 ? ' L' + cc.level : ''} tra ${fmtClock(cc.endsMs - t)}`, () => openBuilding(cc.placedId));
      else o.hud.setWork?.(null);
    }
    const fast = bufferParams().fastH;
    for (const b of v.buildings) {
      const d = drawn.get(b.id); if (!d) continue;
      const def = buildingDef(b.building);
      if (c && c.placedId === b.id && c.endsMs > t) {
        d.label.set('timer', [el('span', '', `${def.nome} tra `), timerSpan(c.endsMs)], `t:${c.endsMs}`);
      } else if (def.produces && b.level >= 1 && b.buffer >= 1) {
        const n = Math.floor(b.buffer), rate = def.levels[b.level - 1]?.rate ?? 0, full = rate > 0 && b.buffer >= rate * fast - 0.5;
        d.label.set(full ? 'full' : 'bubble', [resIcon(def.produces, 16), el('span', '', full ? `${n} PIENO` : `+${n}`)], `b:${n}:${full}`);
      } else d.label.set('info', [], 'x');
    }
    tickTimers(S.labels.el, t);
    if (panel) renderPanel();
  }
  function placeLabels(): void {
    const t = now(), c = view?.construction;
    for (const [id, d] of drawn) {
      const b = view?.buildings.find((x) => x.id === id);
      const has = !!b && ((c && c.placedId === id && c.endsMs > t) || (b.level >= 1 && b.buffer >= 1 && !!buildingDef(b.building).produces));
      const p = has ? screenOf(d.holder.position.x, d.holder.position.y + d.height + 0.3, d.holder.position.z) : null;
      d.label.place(p?.x ?? 0, p?.y ?? 0, !!p?.on);
    }
    const h = o.hint?.(), busyNow = !!lot?.construction && lot.construction.endsMs > t;
    for (const sl of slotLabels.values()) {
      const p = world(sl.cell), sp = !busyNow || panel ? screenOf(p.x, p.y + 0.9, p.z) : null; // col cantiere occupato i cartelli tacciono
      const isHint = !!h && h.cell[0] === sl.cell[0] && h.cell[1] === sl.cell[1];
      sl.label.el.classList.toggle('hint', isHint);
      sl.label.place(sp?.x ?? 0, sp?.y ?? 0, !!sp?.on);
    }
  }

  // ---- tap sul canvas: breve, fermo, un dito solo, non sui controlli (sono DOM sopra al canvas) ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), hit = new THREE.Vector3();
  function tapAt(clientX: number, clientY: number): boolean {
    if (!o.camera || !o.canvas || !lot) return false;
    const r = o.canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, o.camera);
    for (const h of ray.intersectObjects([...drawn.values()].map((d) => d.holder), true)) {
      let n: THREE.Object3D | null = h.object;
      while (n && !n.userData['lotId']) n = n.parent;
      if (n) return openBuilding(String(n.userData['lotId']));
    }
    plane.constant = -gy((ox + tpl.w / 2) * T, (oz + tpl.h / 2) * T);
    if (ray.ray.intersectPlane(plane, hit)) {
      const cell: [number, number] = [Math.floor(hit.x / T) - ox, Math.floor(hit.z / T) - oz];
      const b = lot.buildings.find((x) => x.cell[0] === cell[0] && x.cell[1] === cell[1] && x.building !== 'molo');
      if (b) return openBuilding(b.id);
      if (tpl.at(cell[0], cell[1]) === 'L' && openBuild(cell)) return true;
      const molo = lot.buildings.find((x) => x.building === 'molo');
      if (molo && tpl.at(cell[0], cell[1]) === 'd') return openBuilding(molo.id);
    }
    if (S.owner === me) closePanel();
    return false;
  }
  let down: { id: number; x: number; y: number; t: number } | null = null, multi = false;
  const onDown = (e: PointerEvent) => { if (down) { multi = true; return; } multi = false; down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onMove = (e: PointerEvent) => { if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) multi = true; };
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    const ok = !multi && performance.now() - down.t < 450 && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 12;
    down = null;
    if (ok && document.elementFromPoint(e.clientX, e.clientY) === o.canvas) tapAt(e.clientX, e.clientY);
  };
  const onCancel = () => { down = null; };
  o.canvas?.addEventListener('pointerdown', onDown); o.canvas?.addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp); addEventListener('pointercancel', onCancel);
  const onVis = () => { if (!document.hidden) void refresh(); };
  document.addEventListener('visibilitychange', onVis);

  const contains = (x: number, z: number) => x >= ox * T - 6 && z >= oz * T - 6 && x <= (ox + tpl.w) * T + 6 && z <= (oz + tpl.h) * T + 6;
  const tap = (target: string | [number, number]): boolean => {
    if (Array.isArray(target)) { const c: [number, number] = [Number(target[0]), Number(target[1])]; const b = lot?.buildings.find((x) => x.cell[0] === c[0] && x.cell[1] === c[1]); return b ? openBuilding(b.id) : openBuild(c); }
    const b = lot?.buildings.find((x) => x.id === target) ?? lot?.buildings.find((x) => x.building === target);
    return b ? openBuilding(b.id) : false;
  };

  // ---- test API ----
  const key = ro ? `lot:${o.owner ?? '?'}` : 'lot', sfx = ro ? `@${o.owner ?? '?'}` : '';
  const unState = registerStateProvider(key, () => {
    const v = view, t = now();
    return {
      ready: !!lot, readonly: ro, owner: lot?.owner ?? o.owner ?? null, origin: [ox, oz], serverNow: t, busy, refreshes, error: lastError ?? o.api.lastError,
      resources: lot?.resources ?? null,
      buildings: (v?.buildings ?? []).map((b) => ({ id: b.id, building: b.building, level: b.level, cell: b.cell, buffer: Math.floor(b.buffer), model: drawn.get(b.id)?.model ?? null })),
      construction: v?.construction ? { ...v.construction, leftS: Math.max(0, Math.ceil((v.construction.endsMs - t) / 1000)) } : null,
      freeSlots: ro ? [] : freeSlots(),
      panel: S.owner === me && panel ? { ...panel } : null,
      labels: [...drawn.entries()].map(([id, d]) => ({ id, text: d.label.el.textContent ?? '', cls: d.label.el.className })),
      slotSigns: [...slotLabels.values()].map((sl) => ({ cell: sl.cell, hint: sl.label.el.classList.contains('hint') })),
    };
  });
  registerTestHook('lotTap' + sfx, (t) => tap(t as string | [number, number]));
  registerTestHook('lotRefresh' + sfx, () => refresh());
  /** Posizione a schermo (px CSS) di un edificio o di una cella, per toccare davvero il canvas nei test. */
  registerTestHook('lotScreen' + sfx, (t) => {
    const b = typeof t === 'string' ? lot?.buildings.find((x) => x.id === t || x.building === t) : null;
    const c = b ? b.cell : (t as [number, number]);
    const p = world(c), d = b ? drawn.get(b.id) : null;
    return screenOf(p.x, p.y + (d ? d.height * 0.4 : 0), p.z);
  });
  /** Azione diretta senza i controlli della UI (per vedere gli errori del server). */
  registerTestHook('lotAct' + sfx, async (kind, a, b) => {
    const ok = kind === 'collect' ? await collect(String(a)) : kind === 'upgrade' ? await upgrade(String(a)) : await build(String(a), b as [number, number]);
    return { ok, error: lastError };
  });

  const ready = lot ? (sync(), refreshUi(true), Promise.resolve()) : refresh();
  return {
    readonly: ro, group, ready,
    state: () => lot, refresh, tap, contains, set: (l: LotState) => { if (!disposed) setLot(l); },
    update(dt, focus) {
      if (disposed) return;
      slow += dt;
      const active = !focus || contains(focus.x, focus.z);
      if (active && !document.hidden) { poll += dt; if (poll >= POLL_S) void refresh(); }
      const c = lot?.construction;
      if (c && now() >= c.endsMs + 300 && endsSeen !== c.endsMs) { endsSeen = c.endsMs; void refresh(); }
      if (slow >= 0.25) refreshUi();
      if (pick.visible) pick.scale.setScalar(1 + 0.06 * Math.sin(performance.now() / 180));
      placeLabels();
    },
    dispose() {
      disposed = true; unState(); closePanel();
      for (const d of drawn.values()) d.label.remove();
      for (const sl of slotLabels.values()) sl.label.remove();
      slotLabels.clear();
      drawn.clear(); o.scene.remove(group);
      o.canvas?.removeEventListener('pointerdown', onDown); o.canvas?.removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel);
      document.removeEventListener('visibilitychange', onVis);
      if (!ro) { o.hud.setResources?.(null); o.hud.setWork?.(null); }
    },
  };
}
