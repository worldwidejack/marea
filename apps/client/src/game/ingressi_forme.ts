// Segnaposto degli ingressi dei dungeon (game/ingressi.ts) quando manca il modello prop_ingresso_<stile> nel manifest: arco di pietra,
// per l'Impianto di Drenaggio un casotto di lamiera, per l'Archivio Navigazionale un osservatorio con la cupola d'ottone e la banderuola
// (una draw call ciascuno). Porta sigillata (Epopea della Regata): sbarre incrociate e sigillo rosso davanti alla bocca. Bundle iniziale: piccolo.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

/** Segnaposto se il modello manca: arco di pietra scura con la bocca nera (colori di palette). */
export function placeholder(stile?: string): THREE.Object3D {
  if (stile === 'drenaggio') return boccaporto();
  if (stile === 'archivio') return osservatorio();
  const g = new THREE.Group(), stone = new THREE.MeshLambertMaterial({ color: '#4A4340', flatShading: true }), dark = new THREE.MeshLambertMaterial({ color: '#23201F' });
  for (const sx of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 1.2), stone); p.position.set(sx, 1.3, 0); g.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.2), stone); top.position.y = 2.9; g.add(top);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.2), dark); hole.position.set(0, 1.25, -0.2); g.add(hole);
  return g;
}
/** Impianto di Drenaggio (Epopea della Regata 1), finché manca prop_ingresso_drenaggio: casotto di lamiera chiodata sull'anello della Laguna,
 *  portellone tondo d'ottone (la bocca, verso −Z), tubi che scendono nel terreno, valvola rossa e comignolo. */
function boccaporto(): THREE.Object3D {
  const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
  const geo = merged([ // un solo pezzo a colori per vertice: una draw call sull'isola
    painted(new THREE.BoxGeometry(3.4, 2.7, 2), PAL.pietraScura, M(0, 1.35, 0.4)),
    painted(new THREE.BoxGeometry(3.7, 0.3, 2.3), PAL.roccia, M(0, 2.85, 0.4)),
    painted(new THREE.BoxGeometry(3.5, 0.18, 2.1), PAL.legno, M(0, 0.55, 0.4)), // fascia di ruggine
    painted(cil(1.05, 0.22, 10), PAL.arancio, M(0, 1.3, -0.62, Math.PI / 2)),
    painted(cil(0.82, 0.24, 10), PAL.neroCaldo, M(0, 1.3, -0.62, Math.PI / 2)),
    painted(cil(0.2, 3.1, 5), PAL.legno, M(-1.95, 1.55, -0.1)),
    painted(cil(0.2, 2.4, 5), PAL.legno, M(1.95, 1.2, -0.1)),
    painted(cil(0.28, 0.16, 6), PAL.arancio, M(-1.95, 2.3, -0.1)),
    painted(cil(0.38, 0.07, 8), PAL.rosso, M(1.95, 2.1, -0.38, Math.PI / 2)),
    painted(cil(0.17, 1, 5), PAL.neroCaldo, M(1.1, 3.45, 0.95)),
  ]);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.name = 'ingresso_drenaggio';
  return m;
}

/** Archivio Navigazionale (Epopea della Regata 2), finché manca prop_ingresso_archivio: osservatorio di pietra con la cupola d'ottone,
 *  portone tondo con la rosa dei venti (la bocca, verso −Z), banderuola in cima, due rotoli di carte davanti (come la ricetta Blender). */
function osservatorio(): THREE.Object3D {
  const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
  const parts = [
    painted(new THREE.BoxGeometry(3.2, 2.6, 2.6), PAL.pietraScura, M(0, 1.3, 0.3)),
    painted(new THREE.BoxGeometry(3.5, 0.25, 2.9), PAL.legnoScuro, M(0, 2.72, 0.3)),
    painted(new THREE.CylinderGeometry(1.1, 1.25, 0.55, 6), PAL.arancio, M(0, 3.125, 0.3)), painted(new THREE.CylinderGeometry(0.7, 1.1, 0.45, 6), PAL.arancio, M(0, 3.625, 0.3)), // cupola
    painted(cil(0.06, 1.35, 5), PAL.neroCaldo, M(0, 4.525, 0.3)), // asta della banderuola
    painted(new THREE.BoxGeometry(0.9, 0.06, 0.08), PAL.giallo, M(0.05, 4.95, 0.3)), painted(new THREE.ConeGeometry(0.14, 0.3, 4), PAL.giallo, M(0.6, 4.95, 0.3, 0, 0, -Math.PI / 2)),
    painted(cil(1.0, 0.2, 8), PAL.legnoScuro, M(0, 1.2, -1.0, Math.PI / 2)), // portone tondo
    painted(cil(0.82, 0.06, 8), PAL.neroCaldo, M(0, 1.2, -1.04, Math.PI / 2)),
    painted(new THREE.BoxGeometry(1.5, 0.08, 0.06), PAL.giallo, M(0, 1.2, -1.14)), painted(new THREE.BoxGeometry(0.08, 1.5, 0.06), PAL.giallo, M(0, 1.2, -1.14)), // rosa dei venti
    painted(cil(0.16, 1.1, 5), PAL.sabbiaChiara, M(-1.25, 0.16, -1.15, 0, 0, Math.PI / 2)), painted(cil(0.14, 0.9, 5), PAL.sabbiaChiara, M(1.3, 0.14, -1.15, 0, 0, Math.PI / 2)), // rotoli di carte
  ];
  const m = new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.name = 'ingresso_archivio';
  return m;
}

/** Porta sigillata: due sbarre di ferro incrociate davanti alla bocca e il sigillo rosso a forma d'onda (si nasconde quando si apre). */
export function sigillo(stile?: string): THREE.Object3D {
  const z = stile === 'archivio' ? -1.25 : stile === 'drenaggio' ? -0.82 : -0.75, y = stile === 'archivio' || stile === 'drenaggio' ? 1.25 : 1.2;
  const geo = merged([
    painted(new THREE.BoxGeometry(2.4, 0.16, 0.1), PAL.roccia, M(0, y, z, 0, 0, Math.PI / 4)),
    painted(new THREE.BoxGeometry(2.4, 0.16, 0.1), PAL.roccia, M(0, y, z, 0, 0, -Math.PI / 4)),
    painted(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 8), PAL.rosso, M(0, y, z - 0.08, Math.PI / 2)),
    painted(new THREE.BoxGeometry(0.34, 0.06, 0.04), PAL.giallo, M(0, y + 0.04, z - 0.13, 0, 0, 0.3)), // l'onda del sigillo
  ]);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.name = 'sigillo';
  return m;
}

/** La scenografia casuale (palme, sassi) non sa degli ingressi: quella entro 6 m si toglie, se no copre la bocca vista dalla camera.
 *  Ritorna quante istanze ha tolto. TODO: farlo in render/island.ts bloccando le celle come per edifici e prop (chiesto in
 *  tests/out/richieste/r-scena.md). */
export function togliScenografia(scene: THREE.Object3D, spots: readonly { x: number; z: number }[]): number {
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let n = 0;
  scene.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || /^mod_|cemento|boa|regata|ingresso/.test(im.name)) return;
    let hit = false;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(im.matrixWorld);
      if (spots.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < 6) && m4.determinant() !== 0) { im.setMatrixAt(i, zero); hit = true; n++; }
    }
    if (hit) im.instanceMatrix.needsUpdate = true;
  });
  return n;
}
