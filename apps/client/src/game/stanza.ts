// La stanza della casa (#240, #265), stile Animal Crossing: pavimento a piastrelle, tre pareti con la carta da parati (davanti è
// aperta verso la camera, col bordo del pavimento tagliato come un plastico), la porta in fondo che porta al giardino e, sotto, il
// corridoio di assi da cui si entra e si esce in città. Sta nel template `lotto` (BORGO.stanza, celle locali): così baule e decorazioni
// dentro casa sono celle del LotState come in giardino. Dentro la camera è fissa sopra l'ingresso (render/camera.ts `blocca`) e attorno
// è buio: niente mare, pesci, gabbiani, pioggia, cielo né foschia (render/scene.ts `setInterno`). In giardino, al posto della porta, un
// passaggio coperto riporta in casa. In casa e in giardino la minimappa si nasconde (body.mz-casa): il giardino sta fuori dalla mappa.
// Pavimenti e carte da parati vengono da borgo.json (il primo è quello di serie); `motivo` dice come si dipinge la texture.
import * as THREE from 'three';
import { BORGO } from '@marea/content';
import { finitureScelte } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import { M, P, merged, painted } from '../render/island_parts.ts';
import { registerStateProvider } from '../test/testapi.ts';
import { NASCOSTI_DENTRO, costruisciStanza, createInquadratura } from './interno.ts';
import type { Pianta } from './interno.ts';

const ST = BORGO.stanza, [X0, Z0, X1, Z1] = ST.pavimento, [, , C1] = ST.corridoio;
const PIANTA: Pianta = { pavimento: ST.pavimento, corridoio: ST.corridoio, altezza: ST.altezza, retro: ST.retro[0] };

/** Il passaggio coperto del giardino (#265): tettoia di legno su quattro pali con l'interno buio, con la bocca in (x, z) rivolta a est
 *  (verso la camera, che sta a sud-est: si vede il buio dentro); ci si cammina dentro verso ovest e si torna in casa. Coordinate mondo. */
function passaggio(x: number, y: number, z: number): THREE.BufferGeometry[] {
  const g: THREE.BufferGeometry[] = [], gira = M(x, y, z, 0, -Math.PI / 2, 0);
  x = 0; y = 0; z = 0; // costruito con la bocca a nord e il corpo verso sud, poi girato: il corpo va a ovest
  for (const sx of [-1, 1]) for (const dz of [0, 1.8]) g.push(painted(new THREE.BoxGeometry(0.22, 2.5, 0.22), P.legnoScuro, M(x + sx * 1.05, y + 1.25, z + dz)));
  for (const sx of [-1, 1]) g.push(painted(new THREE.BoxGeometry(1.3, 0.14, 2.6), P.legno, M(x + sx * 0.6, y + 2.45, z + 0.9, 0, 0, sx * -0.45)));
  g.push(painted(new THREE.BoxGeometry(0.2, 0.2, 2.6), P.legnoScuro, M(x, y + 2.75, z + 0.9)));
  for (const sx of [-1, 1]) g.push(painted(new THREE.BoxGeometry(0.12, 1.9, 1.6), P.legno, M(x + sx * 1.05, y + 1.2, z + 0.9))); // fianchi
  g.push(painted(new THREE.BoxGeometry(2.0, 2.4, 0.12), P.neroCaldo, M(x, y + 1.2, z + 1.85))); // il buio in fondo
  g.push(painted(new THREE.BoxGeometry(2.0, 0.06, 1.9), P.legnoChiaro, M(x, y + 0.03, z + 0.9))); // assi per terra
  g.push(painted(new THREE.BoxGeometry(0.9, 0.5, 0.08), P.legnoChiaro, M(x, y + 2.3, z - 0.05)), painted(new THREE.BoxGeometry(0.22, 0.22, 0.1), P.rosso, M(x, y + 2.32, z - 0.1))); // insegna
  for (const q of g) q.applyMatrix4(gira);
  return g;
}

export type Stanza = { dentro(): number | null };

export function createStanza(o: { world: GameWorld; renderer: Renderer; slots: readonly number[]; lotDi?: (slot: number) => LotState | null }): Stanza {
  const w = o.world, arch = w.archipelago, T = arch.tile, dio = o.renderer.diorama;
  let pav = BORGO.pavimenti[0]!, carta = BORGO.carte[0]!;
  const { group: room, rifinisci } = costruisciStanza(T, PIANTA, pav, carta);
  room.name = 'stanza'; room.visible = false;
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  w.scene.add(room);
  // pavimento e carta di chi ci abita (#265: comprati al negozio dei mobili e scelti con ARREDA): si ridipingono quando cambiano
  const finiture = (slot: number) => {
    const s = finitureScelte(o.lotDi?.(slot) ?? null);
    pav = BORGO.pavimenti.find((f) => f.id === s.pavimento) ?? BORGO.pavimenti[0]!; carta = BORGO.carte.find((f) => f.id === s.carta) ?? BORGO.carte[0]!;
    rifinisci(pav, carta);
  };

  // il passaggio coperto del giardino verso la stanza, in ogni giardino abitato (una mesh sola)
  const gx = ST.giardino[0] * T, gz = (ST.giardino[1] + 0.5) * T; // bocca sul lato ovest della cella `giardino`
  const passaggi = o.slots.flatMap((s) => {
    const l = arch.lots.find((q) => q.slot === s); if (!l) return [];
    const ox = l.origin[0] * T, oz = l.origin[1] * T;
    return passaggio(ox + gx, w.groundY(ox + gx + 1, oz + gz), oz + gz);
  });
  if (passaggi.length) { const m = new THREE.Mesh(merged(passaggi), vc); m.name = 'passaggi_giardino'; m.castShadow = true; m.receiveShadow = true; w.scene.add(m); }

  const inq = createInquadratura({ world: w, renderer: o.renderer });

  let qui: number | null = null;
  const nascosti: THREE.Object3D[] = [];
  const dentroDi = (): number | null => {
    const a = w.avatar.state, p = arch.placeAt(a.x, a.z);
    if (!p || p.role !== 'lotto' || p.slot === null) return null;
    const cx = a.x / T - p.origin[0], cz = a.z / T - p.origin[1];
    return cx >= X0 - 1 && cx < X1 + 1 && cz >= Z0 - 1 && cz < C1 + 0.5 ? p.slot : null;
  };
  const entra = (slot: number) => { const l = arch.lots.find((q) => q.slot === slot)!; inq.entra(l.origin[0] * T, l.origin[1] * T, PIANTA); };
  const esce = () => inq.esce();
  // dopo il cull di ogni frame (world.ts): dentro la stanza si nasconde il resto di quel giardino, il mare, i leggii, animali e pioggia
  w.dopoCull = () => {
    for (const n of nascosti) n.visible = true;
    nascosti.length = 0;
    const prima = qui;
    qui = dentroDi();
    if (qui !== prima) { if (qui !== null) entra(qui); else esce(); }
    const pl = arch.placeAt(w.avatar.state.x, w.avatar.state.z);
    document.body.classList.toggle('mz-casa', w.mode === 'walk' && (pl?.role === 'lotto' || pl?.role === 'negozio')); // minimappa via in casa, in giardino e nel negozio
    room.visible = qui !== null;
    if (qui === null) return;
    finiture(qui);
    const l = arch.lots.find((q) => q.slot === qui)!;
    room.position.set(l.origin[0] * T, w.groundY((l.origin[0] + (X0 + X1) / 2) * T, (l.origin[1] + (Z0 + Z1) / 2) * T), l.origin[1] * T);
    const via = (n: THREE.Object3D | undefined | null) => { if (n && n.visible) { n.visible = false; nascosti.push(n); } };
    via(w.scene.getObjectByName('vista_lotto_' + qui)); via(w.water.mesh); via(w.scene.getObjectByName('libri_ospiti')); via(w.scene.getObjectByName('passaggi_giardino'));
    for (const n of NASCOSTI_DENTRO) via(w.scene.getObjectByName(n));
    const zMuro = (l.origin[1] + Z0) * T, v = new THREE.Vector3();
    for (const g of w.scene.children) if (g.name.startsWith('lot_')) for (const c of g.children) { c.getWorldPosition(v); if (v.z < zMuro) via(c); }
  };
  registerStateProvider('stanza', () => ({ dentro: qui, pavimento: pav.id, carta: carta.id, camera: qui !== null ? { yaw: dio.yaw, dist: +inq.distanza.toFixed(1) } : null, mini: !document.body.classList.contains('mz-casa') }));
  return { dentro: () => qui };
}
