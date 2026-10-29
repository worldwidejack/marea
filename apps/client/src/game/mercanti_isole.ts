// Mercanti ai moli delle isole a tema:
// - Isola dell'Adrenalina: vende sempre e solo il Casco (per la funivia e lo snowboard).
// - Isola Vulcano: vende sempre e solo la Lanterna in testa (per esplorare l'isola senza essere cacciati).
import * as THREE from 'three';
import { posaForma } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import type { GameWorld } from './world.ts';
import type { Loader } from '../render/loader.ts';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el, PAL } from '../ui/style.ts';
import { createLabelLayer, LABEL_NEAR_M } from '../ui/sheet.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import { createAvatar } from './avatar.ts';
import { inFila, scegliLod } from './gente_lod.ts';
import type { Avatar } from './avatar.ts';
import { createMercanteMoloUi, type MercanteMoloInfo, type MercanteMoloUi } from '../ui/mercante_molo_ui.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';

export type MercantiIsoleOpts = {
  world: GameWorld;
  loader: Loader;
  api: Api | null;
  me: Me | null;
  hud: Hud;
  root: HTMLElement;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  getLot(): LotState | null;
  setLot(l: LotState): void;
  setLook(l: Look): void;
};

export type MercantiIsole = {
  tick(a: boolean): boolean;
  update(dt: number, focus: { x: number; z: number }): void;
  isBusy(): boolean;
  close(): void;
  apri(isola: 'adrenalina' | 'vulcano'): void;
};

type Spot = MercanteMoloInfo & {
  id: string;
  x: number;
  z: number;
  yaw: number;
  bx: number;
  bz: number;
  look: Look;
  av: Avatar | null;
  meshes: THREE.Mesh[];
  label: ReturnType<ReturnType<typeof createLabelLayer>['add']>;
};

const NEAR_M = 3.2, SHOW_M = 60;

function bancoGeometry(isola: 'adrenalina' | 'vulcano'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Tavolo di legno con quattro gambe
  parts.push(painted(new THREE.BoxGeometry(1.6, 0.08, 0.7), PAL.legno, M(0, 0.85, 0)));
  for (const [x, z] of [[-0.7, -0.28], [0.7, -0.28], [-0.7, 0.28], [0.7, 0.28]] as const) {
    parts.push(painted(new THREE.BoxGeometry(0.1, 0.85, 0.1), PAL.legnoScuro, M(x, 0.425, z)));
  }
  // Espositore del pezzo sul banco
  if (isola === 'adrenalina') {
    // Casco arancione con visiera nera sul banco
    parts.push(painted(new THREE.BoxGeometry(0.32, 0.28, 0.32), PAL.arancio, M(0, 1.03, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.28, 0.08, 0.08), PAL.neroCaldo, M(0, 0.98, -0.14)));
    parts.push(painted(new THREE.BoxGeometry(0.08, 0.29, 0.33), PAL.sabbiaChiara, M(0, 1.03, 0)));
  } else {
    // Lanterna rossa con telaio e lume
    parts.push(painted(new THREE.BoxGeometry(0.24, 0.34, 0.24), PAL.rosso, M(0, 1.06, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.14, 0.18, 0.14), PAL.giallo, M(0, 1.06, 0)));
    parts.push(painted(new THREE.BoxGeometry(0.04, 0.14, 0.04), PAL.legnoScuro, M(0, 1.28, 0)));
  }
  return merged(parts);
}

export function createMercantiIsole(o: MercantiIsoleOpts): MercantiIsole {
  const group = new THREE.Group();
  group.name = 'mercanti_isole';
  o.world.scene.add(group);
  const layer = createLabelLayer(o.root);

  let ui: MercanteMoloUi | null = null;
  const getUi = (): MercanteMoloUi => {
    ui ??= createMercanteMoloUi({
      root: o.root,
      hud: o.hud,
      api: o.api,
      me: o.me,
      getLot: o.getLot,
      setLot: o.setLot,
      setLook: o.setLook,
      look: () => o.world.look,
    });
    return ui;
  };

  const spotsDef: (MercanteMoloInfo & { id: string; x: number; z: number; yaw: number; bx: number; bz: number; look: Look })[] = [
    {
      isola: 'adrenalina',
      id: 'mercante_adrenalina',
      nomeNpc: 'Nevio',
      titolo: 'Noleggio Caschi',
      battuta: 'Senza casco la funivia non ti fa salire! Prendine uno qui prima di andare alle piste.',
      hatId: 'casco',
      hatNome: 'Casco',
      monete: 105,
      descr: 'Necessario per salire sulla funivia e scendere con lo snowboard.',
      x: 171,
      z: 88,
      yaw: -Math.PI / 2, // Guarda verso il molo (ovest)
      bx: 170.2, // Posizione del banchetto davanti
      bz: 88,
      look: { pelle: 1, capelli: 2, coloreCapelli: 1, vestito: 2, cappello: 12, abito: 7 }, // Casco + tuta stuntman
    },
    {
      isola: 'vulcano',
      id: 'mercante_vulcano',
      nomeNpc: 'Ignazio',
      titolo: 'Mercante di Lanterne',
      battuta: 'Gli abitanti del Vulcano cacciano chiunque arrivi senza luce. Mettiti una lanterna in testa prima di addentrarti!',
      hatId: 'lanterna',
      hatNome: 'Lanterna in testa',
      monete: 75,
      descr: 'Necessaria per esplorare l’Isola Vulcano senza essere cacciati dagli abitanti.',
      x: 605,
      z: 519.8,
      yaw: 0, // Guarda verso il molo (nord)
      bx: 605,
      bz: 519.0, // Posizione del banchetto davanti
      look: { pelle: 4, capelli: 0, coloreCapelli: 0, vestito: 1, cappello: 4, abito: 4 }, // Lanterna + kimono
    },
  ];

  const banchiGeos: THREE.BufferGeometry[] = [];
  const spots: Spot[] = spotsDef.map((def) => {
    const y = o.world.groundY(def.bx, def.bz);
    banchiGeos.push(bancoGeometry(def.isola).applyMatrix4(M(def.bx, y, def.bz, 0, def.yaw, 0)));
    posaForma(o.world.solidi, 'persona', def.x, def.z);
    posaForma(o.world.solidi, 'persona', def.bx, def.bz);

    let s: Spot;
    const label = layer.add(() => { if (s) apriSpot(s); });
    const emoji = def.isola === 'adrenalina' ? '🪖' : '🏮';
    label.set('bubble', [el('span', '', `${emoji} ${def.titolo}`)], def.id);
    label.el.classList.add('spot');

    s = { ...def, av: null, meshes: [], label };

    void inFila(() => createAvatar({ loader: o.loader, look: def.look, x: def.x, z: def.z })).then((av) => {
      av.setGround(o.world.groundY);
      av.setPose({ x: def.x, z: def.z, yaw: def.yaw, anim: 'idle' });
      group.add(av.object);
      s.av = av;
      av.object.traverse((m) => { if ((m as THREE.Mesh).isMesh) s.meshes.push(m as THREE.Mesh); });
    }).catch(() => { /* senza avatar il mercante funziona lo stesso col banco */ });

    return s;
  });

  const banchiMesh = new THREE.Mesh(merged(banchiGeos), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  banchiMesh.name = 'mercanti_banchi';
  banchiMesh.castShadow = true;
  banchiMesh.receiveShadow = true;
  group.add(banchiMesh);

  // Bottone interattivo A
  const btn = el('button', 'mz mz-play');
  btn.id = 'mzMercanteMoloBtn';
  btn.type = 'button';
  for (const ev of ['pointerdown', 'touchstart']) btn.addEventListener(ev, (x) => x.stopPropagation());
  btn.addEventListener('click', () => { if (nearSpot) apriSpot(nearSpot); });
  o.root.appendChild(btn);

  let nearSpot: Spot | null = null, aWas = false;

  function apriSpot(s: Spot): void {
    btn.classList.remove('on');
    getUi().apri(s);
  }

  const v3 = new THREE.Vector3();

  registerStateProvider('mercanti_isole', () => ({
    spots: spots.map((s) => ({
      isola: s.isola,
      id: s.id,
      x: s.x,
      z: s.z,
      hatId: s.hatId,
      monete: s.monete,
      near: nearSpot === s,
      open: ui?.isOpen() ?? false,
    })),
    near: nearSpot?.id ?? null,
    busy: ui?.isOpen() ?? false,
  }));

  registerTestHook('mercanteIsolaApri', (isola) => {
    const s = spots.find((q) => q.isola === isola);
    if (!s) return false;
    apriSpot(s);
    return true;
  });

  return {
    isBusy: () => ui?.isOpen() ?? false,
    close: () => { ui?.close(); },
    apri(isola) {
      const s = spots.find((q) => q.isola === isola);
      if (s) apriSpot(s);
    },
    tick(a) {
      const pressA = a && !aWas;
      aWas = a;
      if (o.world.mode !== 'walk' || o.world.race.on || ui?.isOpen()) {
        nearSpot = null;
        btn.classList.remove('on');
        return false;
      }
      const p = o.world.avatar.state;
      let closest: Spot | null = null, minDist = Infinity;
      for (const s of spots) {
        const d = Math.hypot(p.x - s.bx, p.z - s.bz);
        if (d < NEAR_M && d < minDist) {
          minDist = d;
          closest = s;
        }
      }
      nearSpot = closest;
      btn.classList.toggle('on', !!nearSpot);
      if (nearSpot) {
        const icon = nearSpot.isola === 'adrenalina' ? '🪖 Casco' : '🏮 Lanterna';
        btn.replaceChildren(el('span', '', icon), el('small', '', 'A'));
        if (pressA) {
          apriSpot(nearSpot);
          return true;
        }
      }
      return false;
    },
    update(_dt, focus) {
      const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
      for (const s of spots) {
        const d = Math.hypot(focus.x - s.x, focus.z - s.z);
        const show = d < SHOW_M;
        if (s.av) s.av.object.visible = show;
        if (show && s.meshes.length) {
          const y = o.world.groundY(s.x, s.z);
          scegliLod(s.meshes, o.camera, s.x, y, s.z);
        }
        if (d < SHOW_M * 1.5) {
          const y = o.world.groundY(s.x, s.z) + 2.0;
          v3.set(s.x, y, s.z).project(o.camera);
          const px = r.left - rr.left + ((v3.x + 1) / 2) * r.width;
          const py = r.top - rr.top + ((1 - v3.y) / 2) * r.height;
          s.label.place(px, py, v3.z < 1, d < LABEL_NEAR_M);
        } else {
          s.label.place(0, 0, false);
        }
      }
    },
  };
}
