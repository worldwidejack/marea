// Le magie del dungeon in volo, una forma per magia (magie_stile.ts → `volo`): cubi e ottaedri a colori pieni di palette, senza luci, che si
// muovono a scatti. Il davanti è −z (dungeon_actors.ts gira il contenitore lungo il volo); le bombe non si girano, ruotano per conto loro.
// `userData.anima(t)` = l'animazione di ogni frame (t in s), chiamata da dungeon_actors.ts.
import * as THREE from 'three';
import { PAL } from '../ui/style.ts';
import { rnd, stile } from './magie_stile.ts';
import type { Volo } from './magie_stile.ts';

const BOX = new THREE.BoxGeometry(1, 1, 1), OTTA = new THREE.OctahedronGeometry(1, 0);
const mats = new Map<string, THREE.MeshBasicMaterial>();
const mat = (c: string, op = 1): THREE.MeshBasicMaterial => {
  const k = c + op; let m = mats.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, depthWrite: op >= 1 }); mats.set(k, m); }
  return m;
};
/** Un pezzo: geometria (cubo o ottaedro), misure, posizione, colore. */
const pezzo = (g: THREE.Group, geo: THREE.BufferGeometry, s: [number, number, number], p: [number, number, number], c: string, op = 1): THREE.Mesh => {
  const m = new THREE.Mesh(geo, mat(c, op)); m.scale.set(...s); m.position.set(...p); m.renderOrder = 3; g.add(m); return m;
};
const giro = (t: number, hz: number, passo = Math.PI / 4): number => Math.floor(t * hz) * passo;

type Anima = (t: number) => void;
const COSTRUISCI: Record<Volo, (g: THREE.Group, col: readonly string[]) => Anima> = {
  palla(g, col) { // palla di fuoco: guscio arancio, cuore giallo, lingue rosse dietro che tremano
    const guscio = pezzo(g, OTTA, [0.17, 0.17, 0.22], [0, 0, 0], col[1]!), cuore = pezzo(g, OTTA, [0.1, 0.1, 0.1], [0, 0, -0.06], col[0]!);
    const lingue = [0, 1, 2].map((i) => pezzo(g, BOX, [0.14, 0.14, 0.14], [0, 0, 0.22 + i * 0.14], col[2]!));
    return (t) => {
      guscio.rotation.set(giro(t, 10, 0.5), giro(t, 7, 0.6), 0); cuore.rotation.y = giro(t, 8);
      lingue.forEach((m, i) => { const f = Math.floor(t * 14) + i * 5, k = 1 - i * 0.28; m.scale.setScalar((0.1 + 0.08 * rnd(f)) * k); m.position.x = (rnd(f + 2) - 0.5) * 0.12; m.position.y = (rnd(f + 4) - 0.5) * 0.12; });
    };
  },
  pallottola(g, col) { // palla di moschetto infuocata: piccola e scura, con un tracciante lungo giallo e arancio
    pezzo(g, OTTA, [0.1, 0.1, 0.12], [0, 0, 0], PAL.neroCaldo);
    const t1 = pezzo(g, BOX, [0.05, 0.05, 1.3], [0, 0, 0.72], col[0]!), t2 = pezzo(g, BOX, [0.09, 0.09, 0.45], [0, 0, 0.3], col[1]!);
    return (t) => { const k = 0.8 + 0.4 * rnd(Math.floor(t * 20)); t1.scale.z = 1.3 * k; t1.position.z = 0.1 + 0.65 * k; t2.scale.x = t2.scale.y = 0.07 + 0.04 * rnd(Math.floor(t * 20) + 3); };
  },
  saetta(g, col) { // fulmine: quattro tratti a zig-zag che si ridisegnano 15 volte al secondo, col filo azzurro dentro
    const seg = [0, 1, 2, 3].map((i) => pezzo(g, BOX, [0.07, 0.07, 0.35], [0, 0, 0], i % 2 ? col[0]! : col[2]!));
    pezzo(g, BOX, [0.035, 0.035, 1.3], [0, 0, 0.15], col[1]!);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    return (t) => {
      const f = Math.floor(t * 15); let px = 0, py = 0, pz = -0.5;
      seg.forEach((m, i) => {
        const nz = -0.5 + (i + 1) * 0.32, nx = i === 3 ? 0 : (rnd(f * 7 + i) - 0.5) * 0.3, ny = i === 3 ? 0 : (rnd(f * 11 + i) - 0.5) * 0.3;
        a.set(px, py, pz); b.set(nx, ny, nz);
        m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.z = a.distanceTo(b);
        m.quaternion.setFromUnitVectors(Z, b.sub(a).normalize());
        px = nx; py = ny; pz = nz;
      });
    };
  },
  dardo(g, col) { // Lampo del Faro: un dardo di luce bianca con la punta a diamante e granelli gialli che gli brillano attorno
    pezzo(g, BOX, [0.06, 0.06, 1.5], [0, 0, 0.2], col[0]!);
    pezzo(g, OTTA, [0.1, 0.1, 0.2], [0, 0, -0.58], col[0]!);
    const granelli = [0, 1, 2, 3].map(() => pezzo(g, BOX, [0.05, 0.05, 0.05], [0, 0, 0], col[1]!));
    return (t) => { const f = Math.floor(t * 18); granelli.forEach((m, i) => m.position.set((rnd(f + i * 3) - 0.5) * 0.3, (rnd(f + i * 5) - 0.5) * 0.3, rnd(f + i * 7) * 0.9)); };
  },
  bomba(g, col) { // Bomba di fuoco: palla rossa con la miccia e una fiammella in cima che sfarfalla
    const corpo = new THREE.Group(); g.add(corpo);
    pezzo(corpo, OTTA, [0.34, 0.34, 0.34], [0, 0, 0], col[2]!); pezzo(corpo, OTTA, [0.22, 0.22, 0.22], [0, 0, 0], col[1]!, 1).position.y = 0.06;
    pezzo(g, BOX, [0.07, 0.16, 0.07], [0, 0.4, 0], PAL.legnoScuro);
    const fiamma = pezzo(g, BOX, [0.14, 0.14, 0.14], [0, 0.54, 0], col[0]!);
    return (t) => { corpo.rotation.y = giro(t, 6); const f = Math.floor(t * 16); fiamma.scale.setScalar(0.09 + 0.09 * rnd(f)); fiamma.material = mat(rnd(f + 1) > 0.5 ? col[0]! : col[1]!); fiamma.position.y = 0.5 + 0.06 * rnd(f + 2); };
  },
  brace(g, col) { // una brace della Pioggia: piccola, arancio col cuore giallo
    const a = pezzo(g, OTTA, [0.17, 0.17, 0.17], [0, 0, 0], col[1]!); pezzo(g, OTTA, [0.09, 0.09, 0.09], [0, 0, 0], col[0]!);
    return (t) => { a.rotation.set(giro(t, 9), giro(t, 7), 0); };
  },
  atomo(g, col) { // Bomba elettrica: cuore giallo con due anelli azzurri che le girano attorno, su piani diversi
    const cuore = pezzo(g, BOX, [0.2, 0.2, 0.2], [0, 0, 0], col[0]!);
    const anelli = [0, 1].map((k) => { const r = new THREE.Group(); r.rotation.set(k ? 1.1 : -0.5, 0, k ? 0.4 : -0.9); g.add(r); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pezzo(r, BOX, [0.07, 0.07, 0.07], [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], i % 2 ? col[1]! : col[2]!); } return r; });
    return (t) => { anelli[0]!.rotation.y = giro(t, 10, Math.PI / 8); anelli[1]!.rotation.y = -giro(t, 8, Math.PI / 8); cuore.rotation.set(giro(t, 6), giro(t, 5), 0); };
  },
  vuoto(g, col) { // Squarcio del Vuoto: cuore nero, guscio viola che pulsa e schegge rosa che orbitano
    pezzo(g, OTTA, [0.2, 0.2, 0.2], [0, 0, 0], col[1]!);
    const guscio = pezzo(g, OTTA, [0.28, 0.28, 0.28], [0, 0, 0], col[0]!, 0.55);
    const orbita = new THREE.Group(); g.add(orbita);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; pezzo(orbita, BOX, [0.06, 0.18, 0.06], [Math.cos(a) * 0.5, (i % 2 ? 0.1 : -0.1), Math.sin(a) * 0.5], col[2]!); }
    return (t) => { guscio.scale.setScalar(Math.floor(t * 6) % 2 ? 0.24 : 0.32); orbita.rotation.y = -giro(t, 8); };
  },
  lame(g, col) { // Valzer delle Lame: quattro lame d'acqua che girano in tondo attorno a un cuore chiaro
    pezzo(g, OTTA, [0.12, 0.12, 0.12], [0, 0, 0], col[2]!);
    const giostra = new THREE.Group(); g.add(giostra);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2, l = new THREE.Group(); l.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38); l.rotation.y = -a; giostra.add(l);
      pezzo(l, BOX, [0.12, 0.04, 0.5], [0, 0, 0], col[0]!); pezzo(l, BOX, [0.05, 0.05, 0.42], [0.06, 0, 0], col[1]!);
    }
    return (t) => { giostra.rotation.y = giro(t, 14, Math.PI / 6); };
  },
  sfera_cura(g, col) { // Cura a bomba: sfera verde con la croce chiara che gira
    pezzo(g, OTTA, [0.3, 0.3, 0.3], [0, 0, 0], col[1]!);
    const croce = new THREE.Group(); g.add(croce);
    pezzo(croce, BOX, [0.5, 0.12, 0.12], [0, 0, 0], col[2]!); pezzo(croce, BOX, [0.12, 0.5, 0.12], [0, 0, 0], col[2]!);
    return (t) => { croce.rotation.y = giro(t, 5); };
  },
  sfera_furia(g, col) { // Furia a bomba: sfera arancio con sei punte rosa
    const s = new THREE.Group(); g.add(s);
    pezzo(s, OTTA, [0.28, 0.28, 0.28], [0, 0, 0], col[2]!);
    for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) pezzo(s, BOX, [x ? 0.26 : 0.08, y ? 0.26 : 0.08, z ? 0.26 : 0.08], [x * 0.32, y * 0.32, z * 0.32], col[1]!);
    return (t) => { s.rotation.set(giro(t, 7), giro(t, 5), 0); };
  },
};

/** La forma in volo della magia `id` (null = non ne ha una sua: si usa il disegno per elemento). */
export function formaMagia(id: string): THREE.Group | null {
  const st = stile(id);
  if (!st?.volo) return null;
  const g = new THREE.Group();
  g.userData['anima'] = COSTRUISCI[st.volo](g, st.col);
  return g;
}
