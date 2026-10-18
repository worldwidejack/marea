// MODIFICA ISOLA (#403): logica di riorganizzazione edifici (drag & drop, rotazione, magazzino, salvataggio atomico).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCellError, defaultTemplate } from '@marea/sim';
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

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
function frameGeo(s = 1.9, t = 0.22, h = 0.08): THREE.BufferGeometry {
  return mergeGeometries([
    box(s, h, t, 0, 0, -s / 2 + t / 2),
    box(s, h, t, 0, 0, s / 2 - t / 2),
    box(t, h, s, -s / 2 + t / 2, 0, 0),
    box(t, h, s, s / 2 - t / 2, 0, 0),
  ]);
}

export function createModificaIsola(o: ModificaIsolaOptions): ModificaIsola {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const canvas = o.world.scene ? (document.getElementById('gl') as HTMLCanvasElement) : null;

  const matOk = new THREE.MeshBasicMaterial({ color: SAGOMA_OK });
  const matNo = new THREE.MeshBasicMaterial({ color: SAGOMA_NO });
  const sagomaMesh = new THREE.Mesh(frameGeo(1.9, 0.22, 0.08), matOk);
  sagomaMesh.name = 'modifica_sagoma';
  sagomaMesh.visible = false;
  w.scene.add(sagomaMesh);

  let active = false;
  let originalLot: LotState | null = null;
  let workingLot: LotState | null = null;
  let selectedId: string | null = null;
  let selectedFromMagazzino: string | null = null;
  let dragging: { id: string; origCell: [number, number]; fromMagazzino: boolean } | null = null;
  let dragHoverCell: [number, number] | null = null;
  let dragCellOk = false;
  let busy = false;

  const lotDef = o.slot !== null ? arch.lots.find((l) => l.slot === o.slot) ?? null : null;
  const origin: [number, number] = lotDef ? lotDef.origin : [0, 0];
  const tpl = o.lotto?.template ?? defaultTemplate();

  const worldPos = (c: readonly [number, number]) => {
    const x = (origin[0] + c[0] + 0.5) * T, z = (origin[1] + c[1] + 0.5) * T;
    return { x, z, y: w.groundY(x, z) };
  };

  const isMyGarden = () => {
    if (!o.lotto || o.slot === null || o.stanza.dentro() !== null || w.mode !== 'walk') return false;
    const qui = arch.placeAt(w.avatar.state.x, w.avatar.state.z);
    return qui?.role === 'lotto' && qui.slot === o.slot;
  };

  function updateSagoma(cell: [number, number] | null, valid = true): void {
    if (!cell) {
      sagomaMesh.visible = false;
      return;
    }
    const p = worldPos(cell);
    sagomaMesh.position.set(p.x, p.y + 0.04, p.z);
    sagomaMesh.material = valid ? matOk : matNo;
    sagomaMesh.visible = true;
  }

  function renderUi(): void {
    if (!active || !workingLot) return;
    ui.updateTray(workingLot.magazzinoEdifici ?? [], selectedFromMagazzino);
    const b = selectedId ? workingLot.buildings.find((x) => x.id === selectedId) ?? null : null;
    ui.updateSelection(b);
    if (b && b.building !== 'molo') {
      updateSagoma(b.cell, true);
    } else if (!dragging) {
      updateSagoma(null);
    }
  }

  function checkCellValid(cell: [number, number], buildingKind: string, excludeId?: string): boolean {
    if (!workingLot) return false;
    const testLot: LotState = {
      ...workingLot,
      buildings: workingLot.buildings.filter((x) => x.id !== excludeId),
    };
    return buildCellError(testLot, cell, tpl, buildingKind) === null;
  }

  function rotateSelected(): void {
    if (!workingLot || !selectedId) return;
    const b = workingLot.buildings.find((x) => x.id === selectedId);
    if (!b || b.building === 'molo') return;
    const rot = ((b.rot ?? 0) + 1) % 4;
    workingLot = {
      ...workingLot,
      buildings: workingLot.buildings.map((x) => (x.id === selectedId ? { ...x, rot: rot || undefined } : x)),
    };
    o.lotto?.set(workingLot);
    suona('martello');
    renderUi();
  }

  function stowSelected(): void {
    if (!workingLot || !selectedId) return;
    const b = workingLot.buildings.find((x) => x.id === selectedId);
    if (!b || b.building === 'molo') return;
    if (workingLot.construction?.placedId === selectedId) {
      o.hud.toast('L’edificio è in costruzione', 2000);
      return;
    }
    const stored: StoredBuilding = { id: b.id, building: b.building, level: b.level, buffer: b.buffer, lastMs: b.lastMs };
    if (b.rot) stored.rot = b.rot;
    workingLot = {
      ...workingLot,
      buildings: workingLot.buildings.filter((x) => x.id !== selectedId),
      magazzinoEdifici: [...(workingLot.magazzinoEdifici ?? []), stored],
    };
    selectedId = null;
    o.lotto?.set(workingLot);
    suona('click');
    renderUi();
  }

  function stowAll(): void {
    if (!workingLot) return;
    const keep: PlacedBuilding[] = [];
    const toStow: StoredBuilding[] = [];
    for (const b of workingLot.buildings) {
      if (b.building === 'molo' || workingLot.construction?.placedId === b.id) {
        keep.push(b);
      } else {
        const s: StoredBuilding = { id: b.id, building: b.building, level: b.level, buffer: b.buffer, lastMs: b.lastMs };
        if (b.rot) s.rot = b.rot;
        toStow.push(s);
      }
    }
    workingLot = {
      ...workingLot,
      buildings: keep,
      magazzinoEdifici: [...(workingLot.magazzinoEdifici ?? []), ...toStow],
    };
    selectedId = null;
    o.lotto?.set(workingLot);
    suona('click');
    o.hud.toast('Tutti gli edifici sono stati riposti nel magazzino', 2200);
    renderUi();
  }

  function openEdit(): void {
    if (active || !o.lotto) return;
    const current = o.lotto.state();
    if (!current) return;
    active = true;
    originalLot = current;
    workingLot = JSON.parse(JSON.stringify(current)) as LotState;
    workingLot.magazzinoEdifici ??= [];
    selectedId = null;
    selectedFromMagazzino = null;
    dragging = null;

    w.frozen = true;
    w.avatar.visible = false;

    const cx = (origin[0] + 15) * T;
    const cz = (origin[1] + 11.5) * T;
    const cy = w.groundY(cx, cz);
    o.renderer.diorama.follow(cx, cy, cz);
    o.renderer.diorama.snap?.();
    o.renderer.diorama.blocca?.({ yaw: Math.PI / 4, pitch: Math.PI / 2.7, dist: 50, fov: 32 });

    ui.setButtonVisible(false);
    ui.setOverlayVisible(true);
    suona('click');
    renderUi();
  }

  async function closeEdit(salva = false): Promise<void> {
    if (!active) return;
    if (salva && workingLot && o.api) {
      busy = true;
      try {
        const placed = workingLot.buildings.map((b) => ({ id: b.id, cell: b.cell, rot: b.rot }));
        const stowed = (workingLot.magazzinoEdifici ?? []).map((b) => b.id);
        const res = await o.api.buildingLayout({ placed, stowed });
        o.lotto?.set(res);
        suona('martello');
        o.hud.toast('Disposizione salvata con successo!', 2200);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Errore nel salvataggio della disposizione';
        o.hud.toast(msg, 3200);
        return;
      } finally {
        busy = false;
      }
    } else if (originalLot) {
      o.lotto?.set(originalLot);
    }

    active = false;
    selectedId = null;
    selectedFromMagazzino = null;
    dragging = null;
    updateSagoma(null);

    o.renderer.diorama.blocca?.(null);
    o.renderer.diorama.follow(w.avatar.state.x, w.groundY(w.avatar.state.x, w.avatar.state.z), w.avatar.state.z);
    w.avatar.visible = true;
    w.frozen = false;

    ui.setOverlayVisible(false);
  }

  const ui = createModificaIsolaUi(o.root, {
    onOpen: openEdit,
    onRiponiTutto: stowAll,
    onAnnulla: () => void closeEdit(false),
    onSalva: () => void closeEdit(true),
    onGira: rotateSelected,
    onRiponi: stowSelected,
    onSelectTrayItem: (id: string) => {
      selectedId = null;
      selectedFromMagazzino = id;
      dragging = { id, origCell: [0, 0], fromMagazzino: true };
      renderUi();
    },
  });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  function cellAt(clientX: number, clientY: number): [number, number] | null {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, o.renderer.camera);
    groundPlane.constant = -w.groundY((origin[0] + 15) * T, (origin[1] + 11.5) * T);
    if (ray.ray.intersectPlane(groundPlane, hitPoint)) {
      const cx = Math.floor(hitPoint.x / T) - origin[0];
      const cz = Math.floor(hitPoint.z / T) - origin[1];
      return [cx, cz];
    }
    return null;
  }

  let pointerDownPos: { x: number; y: number; time: number } | null = null;

  function onPointerDown(e: PointerEvent): void {
    if (!active || !workingLot || busy) return;
    if ((e.target as HTMLElement)?.closest('#mzModificaTopBar, #mzModificaSelBar, #mzModificaTray')) return;
    pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };

    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;

    if (selectedFromMagazzino) {
      const sb = workingLot.magazzinoEdifici?.find((x) => x.id === selectedFromMagazzino);
      if (sb && checkCellValid(c, sb.building)) {
        const placed: PlacedBuilding = { id: sb.id, building: sb.building, level: sb.level, cell: c, buffer: sb.buffer, lastMs: sb.lastMs, rot: sb.rot };
        workingLot = {
          ...workingLot,
          buildings: [...workingLot.buildings, placed],
          magazzinoEdifici: workingLot.magazzinoEdifici?.filter((x) => x.id !== selectedFromMagazzino),
        };
        selectedFromMagazzino = null;
        selectedId = sb.id;
        o.lotto?.set(workingLot);
        suona('martello');
        renderUi();
        return;
      }
    }

    const b = workingLot.buildings.find((x) => x.cell[0] === c[0] && x.cell[1] === c[1] && x.building !== 'molo');
    if (b) {
      selectedId = b.id;
      selectedFromMagazzino = null;
      dragging = { id: b.id, origCell: [b.cell[0], b.cell[1]], fromMagazzino: false };
      dragHoverCell = c;
      dragCellOk = true;
      renderUi();
    } else if (selectedId) {
      const selB = workingLot.buildings.find((x) => x.id === selectedId);
      if (selB && checkCellValid(c, selB.building, selectedId)) {
        workingLot = {
          ...workingLot,
          buildings: workingLot.buildings.map((x) => (x.id === selectedId ? { ...x, cell: c } : x)),
        };
        o.lotto?.set(workingLot);
        suona('martello');
        renderUi();
      } else {
        selectedId = null;
        renderUi();
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!active || !workingLot || !dragging) return;
    const dist = pointerDownPos ? Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) : 0;
    if (dist < 8) return;

    if (e.clientY > window.innerHeight - 110) {
      updateSagoma(null);
      dragHoverCell = null;
      return;
    }

    const c = cellAt(e.clientX, e.clientY);
    if (!c) {
      updateSagoma(null);
      dragHoverCell = null;
      return;
    }

    dragHoverCell = c;
    const buildingKind = dragging.fromMagazzino
      ? workingLot.magazzinoEdifici?.find((x) => x.id === dragging?.id)?.building
      : workingLot.buildings.find((x) => x.id === dragging?.id)?.building;

    if (!buildingKind) return;
    dragCellOk = checkCellValid(c, buildingKind, dragging.fromMagazzino ? undefined : dragging.id);
    updateSagoma(c, dragCellOk);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!active || !workingLot || !dragging) {
      pointerDownPos = null;
      return;
    }

    const wasDragging = pointerDownPos ? Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) >= 8 : false;

    if (e.clientY > window.innerHeight - 110 && !dragging.fromMagazzino) {
      const b = workingLot.buildings.find((x) => x.id === dragging?.id);
      if (b && b.building !== 'molo' && workingLot.construction?.placedId !== b.id) {
        stowSelected();
      }
      dragging = null;
      pointerDownPos = null;
      return;
    }

    if (wasDragging && dragHoverCell && dragCellOk) {
      const dest = dragHoverCell;
      if (dragging.fromMagazzino) {
        const sb = workingLot.magazzinoEdifici?.find((x) => x.id === dragging?.id);
        if (sb) {
          const placed: PlacedBuilding = { id: sb.id, building: sb.building, level: sb.level, cell: dest, buffer: sb.buffer, lastMs: sb.lastMs, rot: sb.rot };
          workingLot = {
            ...workingLot,
            buildings: [...workingLot.buildings, placed],
            magazzinoEdifici: workingLot.magazzinoEdifici?.filter((x) => x.id !== sb.id),
          };
          selectedId = sb.id;
          selectedFromMagazzino = null;
          suona('martello');
        }
      } else {
        workingLot = {
          ...workingLot,
          buildings: workingLot.buildings.map((x) => (x.id === dragging?.id ? { ...x, cell: dest } : x)),
        };
        suona('martello');
      }
      o.lotto?.set(workingLot);
    }

    dragging = null;
    pointerDownPos = null;
    renderUi();
  }

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  const onKey = (e: KeyboardEvent) => {
    if (!active) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      void closeEdit(false);
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      rotateSelected();
    }
  };
  window.addEventListener('keydown', onKey);

  registerStateProvider('modificaIsola', () => ({
    active,
    selectedId,
    selectedFromMagazzino,
    placedCount: workingLot?.buildings.length ?? 0,
    magazzinoCount: workingLot?.magazzinoEdifici?.length ?? 0,
    buildings: workingLot?.buildings.map((b) => ({ id: b.id, building: b.building, level: b.level, cell: b.cell, rot: b.rot ?? 0 })),
    magazzino: workingLot?.magazzinoEdifici?.map((b) => ({ id: b.id, building: b.building, level: b.level, rot: b.rot ?? 0 })),
  }));

  registerTestHook('modificaIsolaApri', () => openEdit());
  registerTestHook('modificaIsolaChiudi', (salva) => void closeEdit(Boolean(salva)));
  registerTestHook('modificaIsolaSeleziona', (id) => { selectedId = id ? String(id) : null; selectedFromMagazzino = null; renderUi(); return true; });
  registerTestHook('modificaIsolaRuota', () => rotateSelected());
  registerTestHook('modificaIsolaRiponi', () => stowSelected());
  registerTestHook('modificaIsolaRiponiTutto', () => stowAll());
  registerTestHook('modificaIsolaSposta', (id, cell) => {
    if (!workingLot) return false;
    const c = cell as [number, number];
    workingLot = {
      ...workingLot,
      buildings: workingLot.buildings.map((x) => (x.id === id ? { ...x, cell: c } : x)),
    };
    o.lotto?.set(workingLot);
    renderUi();
    return true;
  });

  return {
    get active() { return active; },
    open: openEdit,
    close: closeEdit,
    update(_dt: number) {
      if (active) return;
      ui.setButtonVisible(isMyGarden() && !document.querySelector('#mzSheet.on'));
    },
    dispose() {
      if (active) void closeEdit(false);
      ui.dispose();
      sagomaMesh.removeFromParent();
      sagomaMesh.geometry.dispose();
      matOk.dispose();
      matNo.dispose();
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKey);
    },
  };
}
