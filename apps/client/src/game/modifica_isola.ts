// MODIFICA ISOLA (#403, #407): riorganizzazione rapida edifici (vista dall'alto adattiva mobile/PC, drag & drop, rotazione, magazzino).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCellError, defaultTemplate, inStanza } from '@marea/sim';
import type { LotState, PlacedBuilding, StoredBuilding } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { LotView } from './lot.ts';
import type { Stanza } from './stanza.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import type { DioramaCamera } from '../render/camera.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { createModificaIsolaUi } from '../ui/modifica_isola_ui.ts';

export type ModificaIsola = {
  readonly active: boolean;
  update(dt: number): void;
  open(): void;
  close(salva?: boolean): Promise<void>;
  dispose(): void;
};

export type ModificaIsolaOptions = {
  world: GameWorld;
  renderer: { camera: THREE.PerspectiveCamera; diorama: DioramaCamera };
  root: HTMLElement;
  hud: Hud;
  api: Api | null;
  lotto: LotView | null;
  slot: number | null;
  stanza: Stanza;
};

const SAGOMA_OK = '#B6FF3D', SAGOMA_NO = '#FF5C3D';
const CAM_YAW = Math.PI / 4, CAM_PITCH = (60 * Math.PI) / 180, CAM_FOV = 45;
const W_ISOLA = 49, H_ISOLA = 41; // ingombro proiettato dell'isola a yaw 45° (m)

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
function frameGeo(s = 1.9, t = 0.22, h = 0.08): THREE.BufferGeometry {
  return mergeGeometries([
    box(s, h, t, 0, 0, -s / 2 + t / 2), box(s, h, t, 0, 0, s / 2 - t / 2),
    box(t, h, s, -s / 2 + t / 2, 0, 0), box(t, h, s, s / 2 - t / 2, 0, 0),
  ]);
}

export function createModificaIsola(o: ModificaIsolaOptions): ModificaIsola {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const canvas = o.world.scene ? (document.getElementById('gl') as HTMLCanvasElement) : null;
  const matOk = new THREE.MeshBasicMaterial({ color: SAGOMA_OK }), matNo = new THREE.MeshBasicMaterial({ color: SAGOMA_NO });
  const sagomaMesh = new THREE.Mesh(frameGeo(1.9, 0.22, 0.08), matOk);
  sagomaMesh.name = 'modifica_sagoma'; sagomaMesh.visible = false; w.scene.add(sagomaMesh);

  let active = false, busy = false, lastW = 0, lastH = 0;
  let originalLot: LotState | null = null, workingLot: LotState | null = null;
  let selectedId: string | null = null, selectedFromMagazzino: string | null = null;
  let dragging: { id: string; origCell: [number, number]; fromMagazzino: boolean } | null = null;
  let dragHoverCell: [number, number] | null = null, dragCellOk = false;

  const lotDef = o.slot !== null ? arch.lots.find((l) => l.slot === o.slot) ?? null : null;
  const origin: [number, number] = lotDef ? lotDef.origin : [0, 0];
  const grid = o.lotto?.template ?? null;
  const tpl = grid ?? defaultTemplate();
  const worldPos = (c: readonly [number, number]) => {
    const x = (origin[0] + c[0] + 0.5) * T, z = (origin[1] + c[1] + 0.5) * T;
    return { x, z, y: w.groundY(x, z) };
  };
  const isMovable = (b: PlacedBuilding) => b.building !== 'molo' && !inStanza(b.cell);
  const trayHeight = () => ((window.innerHeight || 800) <= 500 ? 84 : 104);

  /** Calcola distanza e centro camera in base all'aspect ratio per inquadrare tutta l'isola tra top bar e magazzino. */
  function misuraCamera() {
    const cw = canvas?.clientWidth || window.innerWidth || 390, ch = canvas?.clientHeight || window.innerHeight || 844;
    const aspect = cw / Math.max(1, ch), topPx = ch <= 500 ? 48 : 56, botPx = ch <= 500 ? 136 : 148;
    const freeH = Math.max(0.42, (ch - topPx - botPx) / ch), freeW = 0.94, t = Math.tan((CAM_FOV * Math.PI) / 360);
    const dist = Math.max((H_ISOLA / 2) / (t * freeH), (W_ISOLA / 2) / (t * aspect * freeW));
    const cx0 = (origin[0] + 14.5) * T, cz0 = (origin[1] + 11.2) * T;
    const shift = (2 * dist * t * ((botPx - topPx) / (2 * ch))) / Math.sin(CAM_PITCH);
    const tx = cx0 + Math.sin(CAM_YAW) * shift, tz = cz0 + Math.cos(CAM_YAW) * shift;
    return { yaw: CAM_YAW, pitch: CAM_PITCH, dist, fov: CAM_FOV, tx, tz, ty: w.groundY(cx0, cz0), cw, ch };
  }

  function aggiornaCamera(snap = false): void {
    if (!active) return;
    const m = misuraCamera();
    lastW = m.cw; lastH = m.ch;
    w.camFissa = () => ({ x: m.tx, z: m.tz });
    o.renderer.diorama.blocca?.({ yaw: m.yaw, pitch: m.pitch, dist: m.dist, fov: m.fov });
    o.renderer.diorama.follow(m.tx, m.ty, m.tz);
    if (snap) o.renderer.diorama.snap?.();
  }

  const isMyGarden = () => {
    if (!o.lotto || o.slot === null || o.stanza.dentro() !== null || w.mode !== 'walk') return false;
    const qui = arch.placeAt(w.avatar.state.x, w.avatar.state.z);
    return qui?.role === 'lotto' && qui.slot === o.slot;
  };

  function updateSagoma(cell: [number, number] | null, valid = true): void {
    if (!cell) { sagomaMesh.visible = false; return; }
    const p = worldPos(cell);
    sagomaMesh.position.set(p.x, p.y + 0.04, p.z);
    sagomaMesh.material = valid ? matOk : matNo;
    sagomaMesh.visible = true;
  }

  function renderUi(): void {
    if (!active || !workingLot) return;
    ui.updateTray(workingLot.magazzinoEdifici ?? [], selectedFromMagazzino);
    const b = selectedId ? workingLot.buildings.find((x) => x.id === selectedId) ?? null : null;
    const sb = selectedFromMagazzino ? workingLot.magazzinoEdifici?.find((x) => x.id === selectedFromMagazzino) ?? null : null;
    ui.updateSelection(b, sb);
    if (b && isMovable(b)) updateSagoma(b.cell, true);
    else if (!dragging) updateSagoma(null);
  }

  const checkCellValid = (cell: [number, number], buildingKind: string, excludeId?: string): boolean =>
    !!workingLot && buildCellError({ ...workingLot, buildings: workingLot.buildings.filter((x) => x.id !== excludeId) }, cell, tpl, buildingKind) === null;

  function rotateSelected(): void {
    if (!workingLot || !selectedId) return;
    const b = workingLot.buildings.find((x) => x.id === selectedId);
    if (!b || !isMovable(b)) return;
    const rot = ((b.rot ?? 0) + 1) % 4;
    workingLot = { ...workingLot, buildings: workingLot.buildings.map((x) => (x.id === selectedId ? { ...x, rot: rot || undefined } : x)) };
    o.lotto?.set(workingLot); suona('martello'); renderUi();
  }

  function stowSelected(): void {
    if (!workingLot || !selectedId) return;
    const b = workingLot.buildings.find((x) => x.id === selectedId);
    if (!b || !isMovable(b)) return;
    if (workingLot.construction?.placedId === selectedId) { o.hud.toast('L’edificio è in costruzione', 2000); return; }
    const stored: StoredBuilding = { id: b.id, building: b.building, level: b.level, buffer: b.buffer, lastMs: b.lastMs, ...(b.rot ? { rot: b.rot } : {}) };
    workingLot = { ...workingLot, buildings: workingLot.buildings.filter((x) => x.id !== selectedId), magazzinoEdifici: [...(workingLot.magazzinoEdifici ?? []), stored] };
    selectedId = null; o.lotto?.set(workingLot); suona('click'); renderUi();
  }

  function stowAll(): void {
    if (!workingLot) return;
    const keep: PlacedBuilding[] = [], toStow: StoredBuilding[] = [];
    for (const b of workingLot.buildings) {
      if (!isMovable(b) || workingLot.construction?.placedId === b.id) keep.push(b);
      else toStow.push({ id: b.id, building: b.building, level: b.level, buffer: b.buffer, lastMs: b.lastMs, ...(b.rot ? { rot: b.rot } : {}) });
    }
    workingLot = { ...workingLot, buildings: keep, magazzinoEdifici: [...(workingLot.magazzinoEdifici ?? []), ...toStow] };
    selectedId = null; selectedFromMagazzino = null;
    o.lotto?.set(workingLot); suona('click'); o.hud.toast('Edifici riposti nel magazzino', 2000); renderUi();
  }

  function openEdit(): void {
    if (active || !o.lotto) return;
    const current = o.lotto.state();
    if (!current) return;
    active = true;
    originalLot = JSON.parse(JSON.stringify(current)) as LotState;
    workingLot = JSON.parse(JSON.stringify(current)) as LotState;
    workingLot.magazzinoEdifici ??= [];
    selectedId = null; selectedFromMagazzino = null; dragging = null;
    w.frozen = true; w.avatar.visible = false;
    o.hud.toast('', 0);
    ui.setButtonVisible(false); ui.setOverlayVisible(true);
    aggiornaCamera(true); suona('click'); renderUi();
  }

  async function closeEdit(salva = false): Promise<void> {
    if (!active) return;
    if (salva && workingLot && o.api) {
      busy = true;
      try {
        o.lotto?.set(workingLot);
        const placed = workingLot.buildings.map((b) => ({ id: b.id, cell: b.cell, rot: b.rot ?? 0 }));
        const stowed = (workingLot.magazzinoEdifici ?? []).map((b) => b.id);
        const res = await o.api.buildingLayout({ placed, stowed });
        o.lotto?.set(res); suona('martello'); o.hud.toast('Disposizione salvata!', 2000);
      } catch (e: unknown) {
        o.hud.toast(e instanceof Error ? e.message : 'Errore nel salvataggio della disposizione', 3200);
        return;
      } finally { busy = false; }
    } else if (originalLot) {
      o.lotto?.set(originalLot);
    }
    active = false; selectedId = null; selectedFromMagazzino = null; dragging = null;
    updateSagoma(null); w.camFissa = null;
    o.renderer.diorama.blocca?.(null);
    o.renderer.diorama.follow(w.avatar.state.x, w.groundY(w.avatar.state.x, w.avatar.state.z), w.avatar.state.z);
    o.renderer.diorama.snap?.();
    w.avatar.visible = true; w.frozen = false;
    ui.setOverlayVisible(false);
  }

  let pointerDownPos: { x: number; y: number } | null = null;
  const ui = createModificaIsolaUi(o.root, {
    onOpen: openEdit, onRiponiTutto: stowAll,
    onAnnulla: () => void closeEdit(false), onSalva: () => void closeEdit(true),
    onGira: rotateSelected, onRiponi: stowSelected,
    onSelectTrayItem: (id: string, e: PointerEvent) => {
      selectedId = null; selectedFromMagazzino = id;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      dragging = { id, origCell: [0, 0], fromMagazzino: true };
      dragHoverCell = null; dragCellOk = false;
      suona('click'); renderUi();
    },
  });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPoint = new THREE.Vector3(), proj = new THREE.Vector3();

  function setRay(clientX: number, clientY: number): DOMRect | null {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, o.renderer.camera);
    return r;
  }

  function cellAt(clientX: number, clientY: number): [number, number] | null {
    if (!setRay(clientX, clientY)) return null;
    groundPlane.constant = -w.groundY((origin[0] + 15) * T, (origin[1] + 11.5) * T);
    if (!ray.ray.intersectPlane(groundPlane, hitPoint)) return null;
    const fx = hitPoint.x / T - origin[0], fz = hitPoint.z / T - origin[1];
    const exact: [number, number] = [Math.floor(fx), Math.floor(fz)];
    if (grid?.at(exact[0], exact[1]) === 'L') return exact;
    let best: [number, number] | null = null, bestD = 2.4;
    for (const s of grid?.lots ?? []) {
      const d = Math.hypot(fx - (s.cx + 0.5), fz - (s.cz + 0.5));
      if (d < bestD) { bestD = d; best = [s.cx, s.cz]; }
    }
    return best ?? exact;
  }

  function buildingAt(clientX: number, clientY: number): PlacedBuilding | null {
    if (!workingLot) return null;
    const r = setRay(clientX, clientY);
    if (r && o.lotto) {
      for (const h of ray.intersectObjects(o.lotto.group.children, true)) {
        let n: THREE.Object3D | null = h.object;
        while (n && !n.userData['lotId']) n = n.parent;
        if (n?.userData['lotId']) {
          const b = workingLot.buildings.find((x) => x.id === n!.userData['lotId']);
          if (b && isMovable(b)) return b;
        }
      }
    }
    const c = cellAt(clientX, clientY);
    if (c) {
      const onCell = workingLot.buildings.find((x) => x.cell[0] === c[0] && x.cell[1] === c[1] && isMovable(x));
      if (onCell) return onCell;
    }
    if (r) {
      let best: PlacedBuilding | null = null, bestD = 26;
      for (const b of workingLot.buildings) {
        if (!isMovable(b)) continue;
        const p = worldPos(b.cell);
        proj.set(p.x, p.y + 0.8, p.z).project(o.renderer.camera);
        if (proj.z > 1) continue;
        const sx = (proj.x * 0.5 + 0.5) * r.width + r.left, sy = (-proj.y * 0.5 + 0.5) * r.height + r.top;
        const d = Math.hypot(clientX - sx, clientY - sy);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) return best;
    }
    return null;
  }

  function moveHolderLive(id: string, cell: readonly [number, number]): void {
    const h = o.lotto?.group.children.find((ch) => ch.userData['lotId'] === id);
    if (h) { const p = worldPos(cell); h.position.set(p.x, p.y, p.z); h.visible = true; }
  }

  function placeFromMagazzino(id: string, dest: [number, number]): boolean {
    if (!workingLot) return false;
    const sb = workingLot.magazzinoEdifici?.find((x) => x.id === id);
    if (!sb || !checkCellValid(dest, sb.building)) return false;
    const placed: PlacedBuilding = { id: sb.id, building: sb.building, level: sb.level, cell: dest, buffer: sb.buffer, lastMs: sb.lastMs, rot: sb.rot };
    workingLot = { ...workingLot, buildings: [...workingLot.buildings, placed], magazzinoEdifici: workingLot.magazzinoEdifici?.filter((x) => x.id !== id) };
    selectedFromMagazzino = null; selectedId = sb.id;
    o.lotto?.set(workingLot); suona('martello'); renderUi();
    return true;
  }

  function moveOrSwapBuilding(id: string, dest: [number, number]): boolean {
    if (!workingLot) return false;
    const b = workingLot.buildings.find((x) => x.id === id);
    if (!b || !isMovable(b)) return false;
    if (b.cell[0] === dest[0] && b.cell[1] === dest[1]) return true;
    const other = workingLot.buildings.find((x) => x.id !== id && x.cell[0] === dest[0] && x.cell[1] === dest[1] && isMovable(x));
    if (other && checkCellValid(dest, b.building, other.id) && checkCellValid(b.cell, other.building, b.id)) {
      const origCell: [number, number] = [b.cell[0], b.cell[1]];
      workingLot = { ...workingLot, buildings: workingLot.buildings.map((x) => (x.id === id ? { ...x, cell: dest } : x.id === other.id ? { ...x, cell: origCell } : x)) };
      o.lotto?.set(workingLot); suona('martello'); renderUi();
      return true;
    }
    if (checkCellValid(dest, b.building, id)) {
      workingLot = { ...workingLot, buildings: workingLot.buildings.map((x) => (x.id === id ? { ...x, cell: dest } : x)) };
      o.lotto?.set(workingLot); suona('martello'); renderUi();
      return true;
    }
    return false;
  }

  function onPointerDown(e: PointerEvent): void {
    if (!active || !workingLot || busy) return;
    if ((e.target as HTMLElement)?.closest('#mzModificaTopBar, #mzModificaSelBar, #mzModificaTray')) return;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    const c = cellAt(e.clientX, e.clientY);
    if (selectedFromMagazzino && c && placeFromMagazzino(selectedFromMagazzino, c)) return;
    const hitB = buildingAt(e.clientX, e.clientY);
    if (hitB) {
      selectedId = hitB.id; selectedFromMagazzino = null;
      dragging = { id: hitB.id, origCell: [hitB.cell[0], hitB.cell[1]], fromMagazzino: false };
      dragHoverCell = [hitB.cell[0], hitB.cell[1]]; dragCellOk = true;
      suona('click'); renderUi(); return;
    }
    if (selectedId && c) { if (!moveOrSwapBuilding(selectedId, c)) { selectedId = null; renderUi(); } }
    else { selectedId = null; selectedFromMagazzino = null; renderUi(); }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!active || !workingLot || !dragging || !pointerDownPos) return;
    if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) < 6) return;
    if (e.clientY > window.innerHeight - trayHeight()) { updateSagoma(null); dragHoverCell = null; return; }
    const c = cellAt(e.clientX, e.clientY);
    if (!c) { updateSagoma(null); dragHoverCell = null; return; }
    dragHoverCell = c;
    const buildingKind = dragging.fromMagazzino ? workingLot.magazzinoEdifici?.find((x) => x.id === dragging?.id)?.building : workingLot.buildings.find((x) => x.id === dragging?.id)?.building;
    if (!buildingKind) return;
    const other = !dragging.fromMagazzino ? workingLot.buildings.find((x) => x.id !== dragging?.id && x.cell[0] === c[0] && x.cell[1] === c[1] && isMovable(x)) : undefined;
    dragCellOk = other ? checkCellValid(c, buildingKind, other.id) : checkCellValid(c, buildingKind, dragging.fromMagazzino ? undefined : dragging.id);
    updateSagoma(c, dragCellOk);
    if (!dragging.fromMagazzino) moveHolderLive(dragging.id, c);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!active || !workingLot || !dragging) { pointerDownPos = null; return; }
    const wasDragging = pointerDownPos ? Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) >= 6 : false;
    if (wasDragging && e.clientY > window.innerHeight - trayHeight() && !dragging.fromMagazzino) {
      selectedId = dragging.id; stowSelected(); dragging = null; pointerDownPos = null; return;
    }
    if (wasDragging && dragHoverCell) {
      if (dragging.fromMagazzino) placeFromMagazzino(dragging.id, dragHoverCell);
      else if (!moveOrSwapBuilding(dragging.id, dragHoverCell)) o.lotto?.set(workingLot);
    } else if (!dragging.fromMagazzino) o.lotto?.set(workingLot);
    dragging = null; pointerDownPos = null; renderUi();
  }

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  const onKey = (e: KeyboardEvent) => {
    if (!active) return;
    if (e.code === 'Escape') { e.preventDefault(); void closeEdit(false); }
    else if (e.code === 'KeyR') { e.preventDefault(); rotateSelected(); }
  };
  window.addEventListener('keydown', onKey);

  registerStateProvider('modificaIsola', () => ({
    active, selectedId, selectedFromMagazzino,
    placedCount: workingLot?.buildings.length ?? 0,
    magazzinoCount: workingLot?.magazzinoEdifici?.length ?? 0,
    buildings: workingLot?.buildings.map((b) => ({ id: b.id, building: b.building, level: b.level, cell: b.cell, rot: b.rot ?? 0 })),
    magazzino: workingLot?.magazzinoEdifici?.map((b) => ({ id: b.id, building: b.building, level: b.level, rot: b.rot ?? 0 })),
  }));
  registerTestHook('modificaIsolaApri', () => openEdit());
  registerTestHook('modificaIsolaChiudi', (salva) => closeEdit(Boolean(salva)));
  registerTestHook('modificaIsolaSeleziona', (id) => { selectedId = id ? String(id) : null; selectedFromMagazzino = null; renderUi(); return true; });
  registerTestHook('modificaIsolaRuota', () => rotateSelected());
  registerTestHook('modificaIsolaRiponi', () => stowSelected());
  registerTestHook('modificaIsolaRiponiTutto', () => stowAll());
  registerTestHook('modificaIsolaSposta', (id, cell) => moveOrSwapBuilding(String(id), cell as [number, number]));

  return {
    get active() { return active; },
    open: openEdit, close: closeEdit,
    update(_dt: number) {
      if (active) {
        const cw = canvas?.clientWidth || window.innerWidth, ch = canvas?.clientHeight || window.innerHeight;
        if (cw !== lastW || ch !== lastH) aggiornaCamera(true);
        return;
      }
      ui.setButtonVisible(isMyGarden() && !document.querySelector('#mzSheet.on'));
    },
    dispose() {
      if (active) void closeEdit(false);
      ui.dispose(); sagomaMesh.removeFromParent(); sagomaMesh.geometry.dispose(); matOk.dispose(); matNo.dispose();
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKey);
    },
  };
}
