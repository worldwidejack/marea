// La stanza della casa (#240), stile Animal Crossing: pavimento a piastrelle, tre pareti con la carta da parati (davanti è aperta
// verso la camera), la porta in fondo che porta al giardino. Sta nel template `lotto` (BORGO.stanza, celle locali): così baule e
// decorazioni dentro casa sono celle del LotState come in giardino. Quando sei dentro, attorno è buio: niente mare, niente giardino.
// Pavimenti e carte da parati vengono da borgo.json (il primo è quello di serie); `motivo` dice come si dipinge la texture.
import * as THREE from 'three';
import { BORGO } from '@marea/content';
import type { StanzaFinitura } from '@marea/content';
import type { GameWorld } from './world.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { registerStateProvider } from '../test/testapi.ts';

const ST = BORGO.stanza, [X0, Z0, X1, Z1] = ST.pavimento;
const SPESSORE = 0.3;

/** Texture a pixel di un pavimento o di una carta da parati: 16×16 texel per cella (pavimento, 2 m) o per metro (carta). */
function texture(f: StanzaFinitura): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d')!, [a = P.pietraChiara, b = P.pietra, k = P.pietraScura] = f.colori;
  const px = (col: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (f.motivo === 'rombi') {
    px(a, 0, 0, 16, 16);
    for (let y = 0; y < 16; y++) { const d = Math.abs(8 - y); px(b, d, y, 16 - 2 * d, 1); }
    for (let y = 0; y < 16; y++) { const d = Math.abs(8 - y); px(k, d, y); px(k, 15 - d, y); }
  } else { // 'scacchi' (di serie): quattro piastrelle per cella, fuga scura
    px(a, 0, 0, 16, 16); px(b, 8, 0, 8, 8); px(b, 0, 8, 8, 8);
    px(k, 0, 0, 16, 1); px(k, 0, 8, 16, 1); px(k, 0, 0, 1, 16); px(k, 8, 0, 1, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Una porta (cornice e battente) larga ~1,5 m, in coordinate locali, rivolta verso +z. */
function porta(x: number, y: number, z: number, ry = 0): THREE.BufferGeometry[] {
  const R = (m: THREE.Matrix4) => M(x, y, z, 0, ry, 0).multiply(m);
  return [
    painted(new THREE.BoxGeometry(1.7, 2.5, 0.2), P.legnoScuro, R(M(0, 1.25, 0))),
    painted(new THREE.BoxGeometry(1.3, 2.25, 0.26), P.legno, R(M(0, 1.13, 0))),
    painted(new THREE.BoxGeometry(0.14, 0.14, 0.34), P.giallo, R(M(0.4, 1.1, 0))),
  ];
}

export type Stanza = { dentro(): number | null };

export function createStanza(o: { world: GameWorld; slots: readonly number[] }): Stanza {
  const w = o.world, arch = w.archipelago, T = arch.tile;
  const lw = (X1 - X0) * T, ld = (Z1 - Z0) * T, H = ST.altezza;
  const pav = BORGO.pavimenti[0]!, carta = BORGO.carte[0]!;
  const room = new THREE.Group(); room.name = 'stanza'; room.visible = false;
  // pavimento: la texture si ripete una volta per cella
  const tPav = texture(pav); tPav.repeat.set(X1 - X0, Z1 - Z0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), new THREE.MeshLambertMaterial({ map: tPav }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(X0 * T + lw / 2, 0.02, Z0 * T + ld / 2); floor.receiveShadow = true;
  room.add(floor);
  // pareti: in fondo e ai lati (davanti aperta), carta da parati una volta per metro
  const parete = (lung: number, x: number, z: number, ry: number) => {
    const t = texture(carta); t.repeat.set(lung, H);
    const m = new THREE.Mesh(new THREE.BoxGeometry(lung, H, SPESSORE), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m);
  };
  parete(lw + 2 * SPESSORE, X0 * T + lw / 2, Z0 * T - SPESSORE / 2, 0);
  parete(ld, X0 * T - SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2);
  parete(ld, X1 * T + SPESSORE / 2, Z0 * T + ld / 2, Math.PI / 2);
  // battiscopa, porta sul retro e il buio attorno (copre mare e giardino da qualunque inquadratura)
  const bx = (ST.retro[0] + 0.5) * T, bz = Z0 * T + 0.05;
  const parti = [
    painted(new THREE.BoxGeometry(lw, 0.25, 0.12), P.legnoScuro, M(X0 * T + lw / 2, 0.12, Z0 * T + 0.06)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X0 * T + 0.06, 0.12, Z0 * T + ld / 2)),
    painted(new THREE.BoxGeometry(0.12, 0.25, ld), P.legnoScuro, M(X1 * T - 0.06, 0.12, Z0 * T + ld / 2)),
    ...porta(bx, 0, bz),
  ];
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  room.add(new THREE.Mesh(merged(parti), vc));
  const buio = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: P.neroCaldo }));
  buio.rotation.x = -Math.PI / 2; buio.position.set(X0 * T + lw / 2, -0.3, Z0 * T + ld / 2); room.add(buio);
  w.scene.add(room);

  // la porta del giardino verso la stanza, in ogni giardino abitato (una mesh sola)
  const gx = (ST.giardino[0] + 0.5) * T, gz = (ST.giardino[1] + 0.5) * T;
  const porteGiardino = o.slots.flatMap((s) => {
    const l = arch.lots.find((q) => q.slot === s); if (!l) return [];
    const ox = l.origin[0] * T, oz = l.origin[1] * T;
    return [...porta(ox + gx, w.groundY(ox + gx, oz + gz), oz + gz), painted(new THREE.BoxGeometry(2.6, 2.9, 0.3), P.pietra, M(ox + gx, w.groundY(ox + gx, oz + gz) + 1.45, oz + gz - 0.3))]; // rivolta a sud, verso la camera
  });
  if (porteGiardino.length) { const m = new THREE.Mesh(merged(porteGiardino), vc); m.name = 'porte_giardino'; m.castShadow = true; w.scene.add(m); }

  let qui: number | null = null;
  const nascosti: THREE.Object3D[] = [];
  const dentroDi = (): number | null => {
    const a = w.avatar.state, p = arch.placeAt(a.x, a.z);
    if (!p || p.role !== 'lotto' || p.slot === null) return null;
    const cx = a.x / T - p.origin[0], cz = a.z / T - p.origin[1];
    return cx >= X0 - 1 && cx < X1 + 1 && cz >= Z0 - 1 && cz < Z1 + 1 ? p.slot : null;
  };
  // dopo il cull di ogni frame (world.ts): dentro la stanza si nasconde il resto di quel giardino, il mare e i leggii
  w.dopoCull = () => {
    for (const n of nascosti) n.visible = true;
    nascosti.length = 0;
    qui = dentroDi();
    room.visible = qui !== null;
    if (qui === null) return;
    const l = arch.lots.find((q) => q.slot === qui)!;
    room.position.set(l.origin[0] * T, w.groundY((l.origin[0] + (X0 + X1) / 2) * T, (l.origin[1] + (Z0 + Z1) / 2) * T), l.origin[1] * T);
    const via = (n: THREE.Object3D | undefined | null) => { if (n && n.visible) { n.visible = false; nascosti.push(n); } };
    via(w.scene.getObjectByName('vista_lotto_' + qui)); via(w.water.mesh); via(w.scene.getObjectByName('libri_ospiti')); via(w.scene.getObjectByName('porte_giardino'));
    const zMuro = (l.origin[1] + Z0) * T, v = new THREE.Vector3();
    for (const g of w.scene.children) if (g.name.startsWith('lot_')) for (const c of g.children) { c.getWorldPosition(v); if (v.z < zMuro) via(c); }
  };
  registerStateProvider('stanza', () => ({ dentro: qui, pavimento: pav.id, carta: carta.id }));
  return { dentro: () => qui };
}
