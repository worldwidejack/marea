// Segnaposto degli ingressi dei dungeon (game/ingressi.ts) quando manca il modello prop_ingresso_<stile> nel manifest: arco di pietra,
// per l'Impianto di Drenaggio un casotto di lamiera, per l'Archivio Navigazionale un osservatorio con la cupola d'ottone e la banderuola,
// per la Fucina a Pressione un altoforno di mattoni con la bocca accesa e il camino, per il Mausoleo Cinetico un tempietto di marmo bianco
// con la cupola, l'orologio sopra la porta e i canali d'acqua, per la Diga dei Disertori la prua del galeone incastrata tra le rocce nere
// (una o due draw call ciascuno). Porta sigillata (Epopea della Regata, la Diga): sbarre incrociate e sigillo rosso davanti alla bocca.
// Bundle iniziale: piccolo.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

/** Segnaposto se il modello manca: arco di pietra scura con la bocca nera (colori di palette). */
export function placeholder(stile?: string): THREE.Object3D {
  if (stile === 'drenaggio') return boccaporto();
  if (stile === 'archivio') return osservatorio();
  if (stile === 'fucina') return altoforno();
  if (stile === 'mausoleo') return tempietto();
  if (stile === 'diga') return prua();
  if (stile === 'baita') return chalet();
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

/** Fucina a Pressione (Epopea della Regata 3), finché manca prop_ingresso_fucina: altoforno di mattoni refrattari sull'arco nord dell'anello,
 *  bocca ad arco col fuoco acceso (verso −Z), fasce e tubi d'ottone, camino a gradini con la brace in cima, un'incudine davanti (come la
 *  ricetta Blender). */
function altoforno(): THREE.Object3D {
  const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
  const parts = [
    painted(new THREE.BoxGeometry(3.2, 2.4, 2.6), PAL.legnoScuro, M(0, 1.2, 0.3)), // il forno di mattoni
    painted(new THREE.BoxGeometry(3.4, 0.2, 2.8), PAL.neroCaldo, M(0, 2.5, 0.3)),
    painted(new THREE.BoxGeometry(3.3, 0.16, 2.7), PAL.arancio, M(0, 0.7, 0.3)), // fascia d'ottone
    painted(new THREE.CylinderGeometry(0.9, 1.25, 1.0, 6), PAL.legnoScuro, M(0, 3.1, 0.5)), painted(new THREE.CylinderGeometry(0.55, 0.8, 1.1, 6), PAL.roccia, M(0, 4.15, 0.5)), // camino a gradini
    painted(cil(0.62, 0.12, 6), PAL.rosso, M(0, 4.76, 0.5)), // brace in cima
    painted(new THREE.BoxGeometry(1.7, 1.5, 0.12), PAL.neroCaldo, M(0, 0.85, -1.0)), // la bocca
    painted(new THREE.BoxGeometry(2.0, 0.22, 0.3), PAL.roccia, M(0, 1.72, -1.02)), // architrave
    painted(cil(0.16, 2.6, 5), PAL.arancio, M(-1.75, 1.3, -0.2)), painted(cil(0.16, 1.9, 5), PAL.arancio, M(1.75, 0.95, -0.2)), // tubi d'ottone
    painted(new THREE.BoxGeometry(0.7, 0.35, 0.4), PAL.neroCaldo, M(1.25, 0.35, -1.55)), painted(new THREE.BoxGeometry(0.3, 0.3, 0.3), PAL.roccia, M(1.25, 0.12, -1.55)), // incudine
  ];
  const g = new THREE.Group(); g.name = 'ingresso_fucina';
  g.add(new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // il fuoco nella bocca e la brace in cima al camino brillano da sé (si vedono anche di notte): seconda draw call
  g.add(new THREE.Mesh(merged([
    painted(new THREE.BoxGeometry(1.3, 0.9, 0.06), PAL.arancio, M(0, 0.65, -1.06)), painted(new THREE.BoxGeometry(0.8, 0.45, 0.07), PAL.giallo, M(0, 0.5, -1.08)),
    painted(new THREE.BoxGeometry(0.5, 0.1, 0.5), PAL.arancio, M(0, 4.82, 0.5)),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.75 })));
  return g;
}

/** Mausoleo Cinetico (Epopea della Regata 4), finché manca prop_ingresso_mausoleo: tempietto di marmo bianco sull'arco nord-ovest
 *  dell'anello, sul gradino; porta scura (verso −Z) tra due colonnine d'ottone, l'orologio sopra la porta, la cupola con la lanterna
 *  d'acqua in cima e i due canali d'acqua che escono ai lati (come la ricetta Blender). */
function tempietto(): THREE.Object3D {
  const cil = (r: number, h: number, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
  const parts = [
    painted(new THREE.BoxGeometry(3.6, 0.3, 3.0), PAL.pietra, M(0, 0.15, 0.2)), // gradino
    painted(new THREE.BoxGeometry(3.0, 2.2, 2.4), PAL.pietraChiara, M(0, 1.4, 0.3)), // il tempietto
    painted(new THREE.BoxGeometry(3.3, 0.2, 2.7), PAL.giallo, M(0, 2.6, 0.3)), // cornice d'ottone
    painted(new THREE.CylinderGeometry(0.9, 1.3, 0.7, 8), PAL.pietraChiara, M(0, 3.05, 0.3)), painted(cil(0.32, 0.5, 6), PAL.giallo, M(0, 3.65, 0.3)), // cupola
    painted(new THREE.BoxGeometry(1.3, 1.5, 0.12), PAL.neroCaldo, M(0, 1.05, -0.92)), // la porta
    painted(cil(0.13, 2.2, 6), PAL.arancio, M(-0.95, 1.4, -1.0)), painted(cil(0.13, 2.2, 6), PAL.arancio, M(0.95, 1.4, -1.0)), // colonnine
    painted(cil(0.42, 0.06, 10), PAL.giallo, M(0, 2.15, -0.93, Math.PI / 2)), painted(cil(0.34, 0.07, 10), PAL.sabbiaChiara, M(0, 2.15, -0.94, Math.PI / 2)), // l'orologio
    painted(new THREE.BoxGeometry(0.05, 0.26, 0.03), PAL.neroCaldo, M(0, 2.25, -0.99)), painted(new THREE.BoxGeometry(0.2, 0.05, 0.03), PAL.neroCaldo, M(0.08, 2.15, -0.99)), // lancette
    painted(new THREE.BoxGeometry(0.4, 0.12, 1.2), PAL.pietraScura, M(-1.75, 0.06, -0.6)), painted(new THREE.BoxGeometry(0.4, 0.12, 1.2), PAL.pietraScura, M(1.75, 0.06, -0.6)), // sponde dei canali
  ];
  const g = new THREE.Group(); g.name = 'ingresso_mausoleo';
  g.add(new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // l'acqua dei canali e la lanterna in cima brillano da sé: seconda draw call
  g.add(new THREE.Mesh(merged([
    painted(new THREE.BoxGeometry(0.26, 0.06, 1.2), PAL.acquaBassa, M(-1.75, 0.13, -0.6)), painted(new THREE.BoxGeometry(0.26, 0.06, 1.2), PAL.acquaBassa, M(1.75, 0.13, -0.6)),
    painted(new THREE.IcosahedronGeometry(0.22, 0), PAL.acquaBassa, M(0, 4.05, 0.3)),
  ]), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.acqua, emissiveIntensity: 0.6 })));
  return g;
}

/** La Diga dei Disertori, finché manca prop_ingresso_diga: la prua della «Stella del Mattino» incastrata di traverso tra due pareti di roccia
 *  nera nella Gola del Dente; lo squarcio nello scafo è la bocca (verso −Z), sopra il bompresso spezzato e la polena senza volto che stringe
 *  una culla; sotto la polena dondola la lanterna azzurra (come la ricetta Blender). */
function prua(): THREE.Object3D {
  const parti: THREE.BufferGeometry[] = [
    painted(new THREE.BoxGeometry(1.4, 4.0, 3.2), PAL.roccia, M(-2.7, 2.0, 0.6, 0, 0.25, 0.08)), painted(new THREE.BoxGeometry(1.1, 2.4, 2.0), PAL.neroCaldo, M(-3.0, 4.1, 0.9, 0.1, 0, 0.18)), // la roccia a sinistra
    painted(new THREE.BoxGeometry(1.5, 4.6, 3.0), PAL.neroCaldo, M(2.7, 2.3, 0.7, 0, -0.2, -0.06)), painted(new THREE.BoxGeometry(1.0, 2.2, 1.6), PAL.roccia, M(3.0, 4.7, 0.9, -0.1, 0, -0.14)), // e a destra
  ];
  // le due fiancate della prua, a V: si chiudono sulla ruota di prua (verso −Z), fasciame a bande col catrame e la falchetta in cima
  const scafo: THREE.BufferGeometry[] = [];
  for (const lato of [-1, 1]) {
    const ry = 0.42 * lato, x = 0.9 * lato;
    [[0.55, PAL.legnoScuro], [1.55, PAL.legno], [2.55, PAL.legnoScuro], [3.35, PAL.legno]].forEach(([y, c], k) => scafo.push(painted(new THREE.BoxGeometry(0.32, k === 3 ? 0.6 : 1.0, 4.5 - k * 0.3), c as string, M(x * (1 + k * 0.06), y as number, 0.6, 0, ry, 0))));
    for (const y of [1.05, 2.05, 3.05]) scafo.push(painted(new THREE.BoxGeometry(0.34, 0.07, 4.4), PAL.neroCaldo, M(x, y, 0.6, 0, ry, 0)));
    scafo.push(painted(new THREE.BoxGeometry(0.4, 0.14, 3.8), PAL.legnoChiaro, M(x * 1.2, 3.72, 0.8, 0, ry, 0))); // la falchetta
  }
  scafo.push(painted(new THREE.BoxGeometry(0.36, 4.4, 0.36), PAL.legnoScuro, M(0, 2.1, -1.5, -0.15, 0, 0))); // la ruota di prua
  const sg = merged(scafo); sg.applyMatrix4(M(0, 0, 0, 0, 0.3, 0.05)); // di traverso nella gola
  parti.push(sg,
    painted(new THREE.BoxGeometry(1.3, 1.8, 0.24), PAL.neroCaldo, M(-0.35, 0.9, -1.25, 0, 0.3, 0)), // lo squarcio nello scafo: la bocca
    ...[[-1.0, 1.6], [-0.85, 0.3], [0.3, 1.75], [0.35, 0.2]].map(([x, y], k) => painted(new THREE.BoxGeometry(0.12, 0.5, 0.12), PAL.legno, M(x!, y!, -1.4, 0, 0.3, k % 2 ? 0.6 : -0.5))), // le tavole spezzate attorno
    painted(new THREE.CylinderGeometry(0.11, 0.14, 2.4, 6), PAL.legno, M(0.55, 4.0, -2.2, -1.05, 0.3, 0)), // il bompresso spezzato
    painted(new THREE.ConeGeometry(0.12, 0.35, 4), PAL.legnoChiaro, M(0.95, 4.55, -3.05, -1.05, 0.3, 0)), // la scheggia in punta
    painted(new THREE.CylinderGeometry(0.2, 0.28, 1.2, 6), PAL.legnoChiaro, M(0.3, 2.95, -1.95, -0.5, 0.3, 0)), // la polena: il corpo
    painted(new THREE.BoxGeometry(0.32, 0.34, 0.3), PAL.legnoChiaro, M(0.38, 3.6, -2.2)), // la testa senza volto
    painted(new THREE.BoxGeometry(0.5, 0.22, 0.3), PAL.legno, M(0.28, 2.8, -2.3, 0, 0.3, 0)), painted(new THREE.BoxGeometry(0.42, 0.06, 0.24), PAL.sabbia, M(0.28, 2.92, -2.3, 0, 0.3, 0)), // la culla tra le braccia
    painted(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), PAL.roccia, M(0.75, 3.1, -2.7)), // la catenella della lanterna, dal bompresso
    painted(new THREE.BoxGeometry(0.32, 0.08, 0.32), PAL.roccia, M(0.75, 2.68, -2.7)), painted(new THREE.BoxGeometry(0.32, 0.08, 0.32), PAL.roccia, M(0.75, 2.26, -2.7)), // il telaio della lanterna
    painted(new THREE.BoxGeometry(0.8, 0.12, 0.12), PAL.legnoScuro, M(-1.4, 0.08, -1.8, 0, 0.6, 0)), painted(new THREE.BoxGeometry(0.6, 0.1, 0.1), PAL.legno, M(1.3, 0.06, -1.6, 0, -0.4, 0)), // tavole a terra
  );
  const g = new THREE.Group(); g.name = 'ingresso_diga';
  g.add(new THREE.Mesh(merged(parti), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // la lanterna azzurra brilla da sé (si vede anche di notte, nella tempesta): seconda draw call
  g.add(new THREE.Mesh(merged([painted(new THREE.BoxGeometry(0.26, 0.36, 0.26), PAL.acquaBassa, M(0.75, 2.47, -2.7))]),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.acquaBassa, emissiveIntensity: 0.9 })));
  return g;
}

/** Il Tempio della «Doppia Nera» (Isola dell'Adrenalina), finché manca prop_ingresso_baita: baita alpina di larice col tetto spiovente
 *  coperto di neve finta, sci rosa fluo incrociati sopra la porta, due rombi neri del cartello «Doppia Nera» e un cannone spara-neve davanti. */
function chalet(): THREE.Object3D {
  const cil = (r: number, h: number, n = 6) => new THREE.CylinderGeometry(r, r, h, n);
  const parts: THREE.BufferGeometry[] = [
    painted(new THREE.BoxGeometry(3.8, 0.24, 3.0), PAL.pietra, M(0, 0.12, 0.2)), // basamento di pietra
    painted(new THREE.BoxGeometry(3.2, 2.2, 2.4), PAL.legno, M(0, 1.32, 0.3)), // baita di larice
    painted(new THREE.BoxGeometry(3.3, 0.16, 2.5), PAL.legnoScuro, M(0, 0.85, 0.3)),
    painted(new THREE.BoxGeometry(3.3, 0.16, 2.5), PAL.legnoScuro, M(0, 1.85, 0.3)),
    // tetto spiovente a due falde con cappello di neve bianca
    painted(new THREE.BoxGeometry(2.3, 0.22, 2.8), PAL.legnoScuro, M(-0.9, 2.85, 0.3, 0, 0, 0.55)),
    painted(new THREE.BoxGeometry(2.3, 0.22, 2.8), PAL.legnoScuro, M(0.9, 2.85, 0.3, 0, 0, -0.55)),
    painted(new THREE.BoxGeometry(2.35, 0.16, 2.85), PAL.sabbiaChiara, M(-0.9, 2.98, 0.3, 0, 0, 0.55)),
    painted(new THREE.BoxGeometry(2.35, 0.16, 2.85), PAL.sabbiaChiara, M(0.9, 2.98, 0.3, 0, 0, -0.55)),
    painted(new THREE.BoxGeometry(1.4, 0.7, 2.3), PAL.legno, M(0, 2.65, 0.3)), // timpano
    // bocca d'ingresso col tornello a lato
    painted(new THREE.BoxGeometry(1.35, 1.65, 0.14), PAL.neroCaldo, M(0, 1.05, -0.92)),
    painted(new THREE.BoxGeometry(1.6, 0.18, 0.24), PAL.legnoChiaro, M(0, 1.92, -0.95)),
    // due sci rosa fluo incrociati sopra la porta e cartello «Doppia Nera» (due rombi neri su giallo)
    painted(new THREE.BoxGeometry(1.7, 0.12, 0.06), PAL.rosaNeon, M(0, 2.55, -0.95, 0, 0, 0.45)),
    painted(new THREE.BoxGeometry(1.7, 0.12, 0.06), PAL.rosaNeon, M(0, 2.55, -0.95, 0, 0, -0.45)),
    painted(new THREE.BoxGeometry(0.45, 0.45, 0.06), PAL.giallo, M(0, 3.15, -0.95, 0, 0, Math.PI / 4)),
    painted(new THREE.BoxGeometry(0.16, 0.16, 0.08), PAL.neroCaldo, M(-0.08, 3.15, -0.97, 0, 0, Math.PI / 4)),
    painted(new THREE.BoxGeometry(0.16, 0.16, 0.08), PAL.neroCaldo, M(0.08, 3.15, -0.97, 0, 0, Math.PI / 4)),
    // cannone spara-neve giallo/azzurro e cumulo di neve a fianco
    painted(cil(0.28, 0.85, 8), PAL.giallo, M(-1.45, 0.85, -1.25, 1.1, -0.3, 0)),
    painted(cil(0.32, 0.14, 8), PAL.acquaBassa, M(-1.35, 1.02, -1.58, 1.1, -0.3, 0)),
    painted(cil(0.1, 0.65, 5), PAL.roccia, M(-1.45, 0.35, -1.25)),
    painted(new THREE.BoxGeometry(1.1, 0.35, 0.8), PAL.sabbiaChiara, M(1.35, 0.25, -1.2)),
  ];
  const g = new THREE.Group(); g.name = 'ingresso_baita';
  g.add(new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  return g;
}

/** Cancello sbarrato del Portale del Vuoto: sbarre di ferro battuto, serratura con castone dorato a forma d'onda marina e stele runica accanto. */
function cancelloVuoto(): THREE.Object3D {
  const cil = (r: number, h: number, n = 6) => new THREE.CylinderGeometry(r, r, h, n);
  const z = -0.55;
  const parts: THREE.BufferGeometry[] = [
    // telaio esterno del cancello in ferro scuro battuto
    painted(new THREE.BoxGeometry(1.9, 0.12, 0.08), PAL.neroCaldo, M(0, 0.25, z)),
    painted(new THREE.BoxGeometry(1.9, 0.1, 0.08), PAL.neroCaldo, M(0, 1.25, z)),
    painted(new THREE.BoxGeometry(1.9, 0.12, 0.08), PAL.neroCaldo, M(0, 2.25, z)),
    painted(new THREE.BoxGeometry(0.12, 2.3, 0.1), PAL.neroCaldo, M(-0.9, 1.25, z)),
    painted(new THREE.BoxGeometry(0.12, 2.3, 0.1), PAL.neroCaldo, M(0.9, 1.25, z)),
  ];
  const sbarreX = [-0.65, -0.42, -0.2, 0, 0.2, 0.42, 0.65];
  for (const bx of sbarreX) {
    parts.push(painted(cil(0.035, 2.1, 6), PAL.roccia, M(bx, 1.25, z)));
    parts.push(painted(new THREE.ConeGeometry(0.065, 0.22, 4), PAL.neroCaldo, M(bx, 2.36, z)));
  }
  // grande serratura circolare al centro con incavo dorato per l'anello dell'onda
  parts.push(painted(cil(0.32, 0.12, 10), PAL.neroCaldo, M(0, 1.25, z - 0.04, Math.PI / 2)));
  parts.push(painted(cil(0.24, 0.14, 10), PAL.giallo, M(0, 1.25, z - 0.05, Math.PI / 2)));
  // stele di pietra a lato con targa che accoglie il sigillo
  parts.push(painted(new THREE.BoxGeometry(0.45, 1.1, 0.45), PAL.pietraScura, M(1.35, 0.55, z - 0.2)));
  parts.push(painted(new THREE.BoxGeometry(0.32, 0.4, 0.06), PAL.pietraChiara, M(1.35, 0.75, z - 0.44)));
  const g = new THREE.Group(); g.name = 'sigillo_cancello';
  g.add(new THREE.Mesh(merged(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // gemme d'onda marina luminescenti: richiamo visivo dell'Anello dell'Onda
  const gemme = [
    painted(cil(0.14, 0.16, 8), PAL.acquaBassa, M(0, 1.25, z - 0.07, Math.PI / 2)),
    painted(new THREE.BoxGeometry(0.16, 0.04, 0.05), PAL.pietraChiara, M(0, 1.26, z - 0.16, 0, 0, 0.4)),
    painted(new THREE.IcosahedronGeometry(0.08, 0), PAL.acquaBassa, M(1.35, 0.75, z - 0.48)),
  ];
  g.add(new THREE.Mesh(merged(gemme), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.acquaBassa, emissiveIntensity: 0.65 })));
  return g;
}

/** Porta sigillata: due sbarre di ferro incrociate davanti alla bocca e il sigillo rosso a forma d'onda (si nasconde quando si apre). */
export function sigillo(stile?: string): THREE.Object3D {
  if (stile === 'vuoto') return cancelloVuoto();
  const z = stile === 'archivio' ? -1.25 : stile === 'fucina' ? -1.18 : stile === 'mausoleo' ? -1.08 : stile === 'drenaggio' ? -0.82 : stile === 'diga' ? -1.5 : -0.75;
  const y = stile === 'archivio' || stile === 'drenaggio' ? 1.25 : stile === 'fucina' ? 0.9 : stile === 'mausoleo' ? 1.05 : stile === 'diga' ? 0.95 : 1.2;
  const geo = merged([
    painted(new THREE.BoxGeometry(2.4, 0.16, 0.1), PAL.roccia, M(0, y, z, 0, 0, Math.PI / 4)),
    painted(new THREE.BoxGeometry(2.4, 0.16, 0.1), PAL.roccia, M(0, y, z, 0, 0, -Math.PI / 4)),
    painted(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 8), PAL.rosso, M(0, y, z - 0.08, Math.PI / 2)),
    painted(new THREE.BoxGeometry(0.34, 0.06, 0.04), PAL.giallo, M(0, y + 0.04, z - 0.13, 0, 0, 0.3)), // l'onda del sigillo
  ]);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.name = 'sigillo';
  return m;
}

/** I blocchi di terreno (render/island.ts: erba, sabbia, riva, lastricato, scogliera, molo, pali; anche delle isole a tema): non sono scenografia. */
const TERRENO = /^(erba|sabbia|sabbia_bordo|lastricato|riva|scogliera|molo|pali)$|_(erba|sabbia|riva)$/;

/** La scenografia casuale (palme, sassi) non sa degli ingressi: quella entro 6 m si toglie, se no copre la bocca vista dalla camera.
 *  Ritorna quante istanze ha tolto. TODO: farlo in render/island.ts bloccando le celle come per edifici e prop (chiesto in
 *  tests/out/richieste/r-scena.md). */
export function togliScenografia(scene: THREE.Object3D, spots: readonly { x: number; z: number }[]): number {
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let n = 0;
  scene.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || /^mod_|cemento|boa|regata|ingresso/.test(im.name) || TERRENO.test(im.name)) return;
    let hit = false;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(im.matrixWorld);
      if (spots.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < 6) && m4.determinant() !== 0) { im.setMatrixAt(i, zero); hit = true; n++; }
    }
    if (hit) im.instanceMatrix.needsUpdate = true;
  });
  return n;
}
