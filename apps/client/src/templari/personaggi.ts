// Mercante e Strega dell'arena dei Templari (docs/TEMPLARI.md §7b), fuori dal campo, dove la sim li mette (Arena.personaggi: il posto
// dove gli si parla, sul bordo, e da che parte stanno). Il Mercante veneziano sulla sua cocca ormeggiata davanti alla spiaggia, sotto
// la tenda a strisce, con la lanterna e una passerella fino alla sabbia; la Strega nella capanna oltre il cimitero, dietro la staccionata,
// che gira il mestolo nel calderone verde. Pezzi a facce piatte coi colori della palette (island_parts), una luce per uno; la barca
// dondola, il calderone bolle, e quando sei vicino il Mercante alza la mano e la Strega ti guarda.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { M, merged, painted } from '../render/island_parts.ts';

/** `setSvegli`: col fuoco spento (§9b) la Strega dorme (calderone freddo, niente luce né occhi verdi) e la nave del Mercante sta al largo. */
export type Personaggi = { update(t: number, vicino: 'mercante' | 'strega' | null): void; setSvegli(strega: boolean, mercante: boolean): void; dispose(): void };

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cil = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
const PELLE = PAL.sabbia;

/** Una persona a pezzi (stile degli zombie, ma viva): corpo con la veste, testa, cappello. Pivot ai piedi, guarda −Z. */
function persona(o: { veste: string; fascia: string; testa: string; cappello: THREE.BufferGeometry[]; barba?: string; gobba?: boolean }): THREE.BufferGeometry[] {
  const g = o.gobba ? 0.18 : 0;
  return [
    painted(cil(0.24, 0.36, 1.05, 6), o.veste, M(0, 0.53, 0)), // veste fino a terra
    painted(cil(0.2, 0.25, 0.5, 6), o.veste, M(0, 1.28, g * 0.5, -g)), // busto (curvo per la Strega)
    painted(box(0.5, 0.08, 0.38), o.fascia, M(0, 1.04, 0)), // cintura o scialle
    painted(box(0.24, 0.28, 0.24), o.testa, M(0, 1.66, -g * 0.6)),
    painted(box(0.05, 0.05, 0.03), PAL.neroCaldo, M(-0.06, 1.69, -0.13 - g * 0.6)), painted(box(0.05, 0.05, 0.03), PAL.neroCaldo, M(0.06, 1.69, -0.13 - g * 0.6)),
    ...(o.barba ? [painted(box(0.22, 0.16, 0.08), o.barba, M(0, 1.54, -0.12))] : []),
    ...o.cappello,
    painted(cil(0.06, 0.06, 0.55, 5), o.veste, M(-0.27, 1.2, -0.08, 0.3, 0, 0.15)), // braccio sinistro
  ];
}

export function createPersonaggi(scene: THREE.Scene, a: Arena): Personaggi {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), acceso = new THREE.MeshBasicMaterial({ vertexColors: true });
  const disp: { dispose(): void }[] = [mat, acceso];
  const mesh = (parts: THREE.BufferGeometry[], m: THREE.Material = mat) => { const g = merged(parts); disp.push(g); return new THREE.Mesh(g, m); };
  const radice = (id: 'mercante' | 'strega') => {
    const p = a.personaggi.find((x) => x.id === id);
    if (!p) return null;
    const g = new THREE.Group(); g.name = id;
    g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.fx, p.fz); // +Z locale = verso fuori, −Z = verso il campo
    scene.add(g);
    return g;
  };

  // ---- Mercante: la cocca ormeggiata, la tenda, il banco con le merci, la lanterna, la passerella ----
  const mer = radice('mercante');
  let barca: THREE.Group | null = null, mano: THREE.Mesh | null = null, passerella: THREE.Mesh | null = null;
  if (mer) {
    // la camera guarda da sud-est: la barca sta tra lei e il campo, quindi piccola, bassa e senza tende sopra il Mercante
    barca = new THREE.Group(); barca.position.set(0.6, 0, 4.4); barca.scale.setScalar(0.8); mer.add(barca);
    barca.add(mesh([
      painted(box(5.2, 1.0, 2.4), PAL.legnoScuro, M(0, 0.1, 0)), // scafo
      painted(box(5.3, 0.14, 2.5), PAL.legno, M(0, 0.62, 0)), // bordo
      painted(box(1.2, 0.9, 2.4), PAL.legnoScuro, M(-2.4, 0.9, 0)), painted(box(1.0, 0.7, 2.2), PAL.legnoScuro, M(2.5, 0.8, 0)), // castelli
      painted(box(4.6, 0.06, 2.1), PAL.legnoChiaro, M(0, 0.6, 0)), // ponte
      painted(cil(0.08, 0.1, 3.2, 5), PAL.legno, M(1.6, 2.2, 0.7)), painted(box(2.2, 0.08, 0.08), PAL.legno, M(1.6, 3.4, 0.7)), // albero e pennone
      painted(box(2.0, 0.45, 0.3), PAL.sabbiaChiara, M(1.6, 3.2, 0.7)), // vela raccolta
      painted(box(1.0, 0.6, 0.1), PAL.rosso, M(1.6, 4.0, 0.7)), painted(box(0.16, 0.6, 0.12), PAL.giallo, M(1.6, 4.0, 0.7)), // stendardo di San Marco
      // telo a strisce dietro il Mercante, sul castello di poppa (non copre lui)
      ...[0, 1, 2, 3].map((k) => painted(box(0.06, 1.2, 0.42), k % 2 ? PAL.sabbiaChiara : PAL.rosso, M(-1.86, 1.9, -0.6 + k * 0.4))),
      // banco: casse e merci (spezie, stoffe, una botticella)
      painted(box(2.2, 0.7, 0.6), PAL.legno, M(-0.6, 0.98, -0.75)), painted(box(2.3, 0.08, 0.7), PAL.legnoChiaro, M(-0.6, 1.36, -0.75)),
      painted(box(0.3, 0.2, 0.3), PAL.arancio, M(-1.4, 1.5, -0.8)), painted(box(0.3, 0.16, 0.3), PAL.giallo, M(-1.0, 1.48, -0.75)),
      painted(box(0.5, 0.12, 0.35), PAL.viola, M(-0.2, 1.46, -0.8)), painted(cil(0.14, 0.14, 0.32, 6), PAL.legnoScuro, M(0.3, 1.56, -0.78, 0, 0, Math.PI / 2)),
      ...[[1.8, -0.4], [2.3, 0.4], [-2.0, 0.6]].map(([x, z]) => painted(box(0.6, 0.6, 0.6), PAL.legno, M(x!, 0.95, z!))),
      // il Mercante veneziano: veste rossa, berretta nera, barba grigia, dietro il banco, girato un po' verso la camera
      ...persona({ veste: PAL.rosso, fascia: PAL.giallo, testa: PELLE, barba: PAL.pietraChiara, cappello: [painted(cil(0.16, 0.15, 0.2, 6), PAL.neroCaldo, M(0, 1.9, 0)), painted(box(0.1, 0.12, 0.04), PAL.giallo, M(0, 1.9, -0.15))] }).map((g) => g.applyMatrix4(M(-0.6, 0.6, -0.2, 0, -0.8, 0))),
    ]));
    // la lanterna accesa e la sua luce
    barca.add(mesh([painted(box(0.06, 1.0, 0.06), PAL.legnoScuro, M(-2.4, 1.9, -0.8)), painted(box(0.5, 0.06, 0.06), PAL.legnoScuro, M(-2.2, 2.4, -0.8))]));
    barca.add(mesh([painted(box(0.24, 0.3, 0.24), PAL.giallo, M(-2.0, 2.2, -0.8))], acceso));
    const luce = new THREE.PointLight(PAL.giallo, 9, 10, 1.6); luce.position.set(-2.0, 2.3, -1.2); barca.add(luce);
    // la mano che saluta (si alza quando sei vicino)
    mano = mesh([painted(cil(0.06, 0.06, 0.55, 5), PAL.rosso, M(0, -0.25, 0)), painted(box(0.12, 0.14, 0.1), PELLE, M(0, -0.55, 0))]);
    mano.position.set(-0.4, 2.05, -0.38); barca.add(mano);
    // passerella dalla sabbia al ponte
    mer.add(passerella = mesh([painted(box(0.8, 0.07, 2.6), PAL.legno, M(0.1, 0.32, 2.1, -0.2, 0, 0)), ...[1.0, 1.8, 2.6].map((z) => painted(box(0.85, 0.05, 0.07), PAL.legnoScuro, M(0.1, 0.12 + z * 0.2, z, -0.2, 0, 0)))]));
  }

  // ---- Strega: staccionata sul bordo, il calderone sul fuoco, lei col mestolo, la capanna con gli scaffali ----
  const str = radice('strega');
  let mestolo: THREE.Group | null = null, brodo: THREE.Mesh | null = null, testa: THREE.Group | null = null, luceS: THREE.PointLight | null = null, fuocoS: THREE.Mesh | null = null;
  const bolle: THREE.Mesh[] = [];
  if (str) {
    str.add(mesh([
      // staccionata storta sul bordo del cimitero (il calderone e la capanna stanno di là)
      ...[-2.6, -1.6, -0.6, 0.6, 1.6, 2.6].map((x, k) => painted(box(0.1, 0.9, 0.1), PAL.legnoScuro, M(x, 0.45, 0.6, 0, 0, (k % 2 ? 1 : -1) * 0.06))),
      painted(box(5.4, 0.08, 0.06), PAL.legno, M(0, 0.7, 0.6, 0, 0, 0.02)), painted(box(5.4, 0.08, 0.06), PAL.legno, M(0, 0.35, 0.6, 0, 0, -0.02)),
      // il calderone sulle pietre
      painted(cil(0.55, 0.42, 0.65, 8), PAL.neroCaldo, M(0, 0.55, 1.6)), painted(cil(0.6, 0.6, 0.08, 8), PAL.roccia, M(0, 0.88, 1.6)),
      ...[0, 1, 2, 3, 4].map((k) => painted(box(0.3, 0.2, 0.3), PAL.pietraScura, M(Math.cos(k * 1.26) * 0.62, 0.1, 1.6 + Math.sin(k * 1.26) * 0.62, 0, k, 0))),
      // la capanna: tronchi, tetto di paglia storto, comignolo, porta
      painted(box(3.2, 2.0, 2.2), PAL.legnoScuro, M(0, 1.0, 4.2)),
      painted(box(3.6, 0.16, 1.5), PAL.sabbia, M(0, 2.35, 3.6, -0.55, 0, 0.04)), painted(box(3.6, 0.16, 1.5), PAL.legno, M(0, 2.35, 4.8, 0.55, 0, 0.04)),
      painted(box(0.4, 1.0, 0.4), PAL.pietraScura, M(1.1, 2.9, 4.6, 0, 0, 0.12)),
      painted(box(0.8, 1.4, 0.06), PAL.ombraCalda, M(-0.7, 0.7, 3.08)),
      // scaffale con le ampolle davanti alla capanna, erbe appese
      painted(box(1.2, 0.08, 0.35), PAL.legno, M(1.0, 1.1, 2.9)), painted(box(1.2, 0.08, 0.35), PAL.legno, M(1.0, 0.6, 2.9)),
      ...[[0.6, PAL.rosso], [0.85, PAL.viola], [1.1, PAL.acqua], [1.35, PAL.erbaChiara]].map(([x, c]) => painted(cil(0.06, 0.08, 0.22, 5), c as string, M(x as number, 1.26, 2.9))),
      ...[[0.7, PAL.giallo], [1.2, PAL.rosaNeon]].map(([x, c]) => painted(cil(0.08, 0.1, 0.2, 5), c as string, M(x as number, 0.75, 2.9))),
      ...[-1.3, -1.0, 1.3].map((x) => painted(box(0.12, 0.4, 0.08), PAL.erbaScura, M(x, 1.75, 3.05))),
      // la Strega: veste nera, scialle viola, cappello a punta, curva sul calderone
      ...persona({ veste: PAL.neroCaldo, fascia: PAL.viola, testa: PAL.pietra, gobba: true, cappello: [painted(cil(0.32, 0.32, 0.04, 8), PAL.neroCaldo, M(0, 1.84, -0.1)), painted(new THREE.ConeGeometry(0.17, 0.6, 6), PAL.neroCaldo, M(0, 2.15, -0.02, -0.25, 0, 0)), painted(box(0.36, 0.06, 0.36), PAL.viola, M(0, 1.9, -0.1))] }).map((g) => g.applyMatrix4(M(0, 0, 2.5))),
    ]));
    // il brodo verde che brilla, il fuoco sotto, la luce verde
    brodo = mesh([painted(cil(0.48, 0.48, 0.04, 8), PAL.erbaChiara, M(0, 0.84, 1.6))], acceso); str.add(brodo);
    str.add(fuocoS = mesh([painted(new THREE.ConeGeometry(0.22, 0.4, 5), PAL.arancio, M(-0.15, 0.2, 1.5)), painted(new THREE.ConeGeometry(0.16, 0.32, 5), PAL.giallo, M(0.18, 0.17, 1.7))], acceso));
    for (let k = 0; k < 4; k++) { const b = mesh([painted(new THREE.IcosahedronGeometry(0.07, 0), PAL.erbaChiara)], acceso); b.position.set(0, 0.9, 1.6); str.add(b); bolle.push(b); }
    luceS = new THREE.PointLight(PAL.erbaChiara, 10, 9, 1.6); luceS.position.set(0, 1.6, 1.4); str.add(luceS);
    // il mestolo (gira nel calderone) e la testa (guarda te quando sei vicino)
    mestolo = new THREE.Group(); mestolo.position.set(0, 0.85, 1.6); str.add(mestolo);
    mestolo.add(mesh([painted(cil(0.03, 0.03, 1.1, 4), PAL.legno, M(0.25, 0.4, 0, 0, 0, 0.35))]));
    testa = new THREE.Group(); testa.position.set(0, 1.66, 2.5 - 0.11); str.add(testa);
    testa.add(mesh([painted(box(0.07, 0.16, 0.08), PAL.pietra, M(0, -0.04, -0.17)), painted(box(0.04, 0.04, 0.03), PAL.erbaChiara, M(-0.06, 0.03, -0.14)), painted(box(0.04, 0.04, 0.03), PAL.erbaChiara, M(0.06, 0.03, -0.14))], acceso)); // naso lungo e occhi verdi
  }

  const steps = (v: number, n: number) => Math.floor(v * n) / n;
  let sveglia = true, attraccata = true;
  return {
    setSvegli(s, m) {
      sveglia = s; attraccata = m;
      for (const o of [brodo, fuocoS, testa, ...bolle]) if (o) o.visible = s;
      if (luceS) luceS.visible = s;
      if (passerella) passerella.visible = m;
      if (barca) { barca.position.x = m ? 0.6 : 3.5; barca.position.z = m ? 4.4 : 13; barca.visible = true; }
    },
    update(t, vicino) {
      if (barca) { barca.rotation.z = 0.03 * Math.sin(t * 0.9); barca.position.y = 0.06 * Math.sin(t * 1.3) - (attraccata ? 0 : 0.3); } // la barca dondola (al largo un po' più giù)
      if (!sveglia && testa) testa.rotation.x = 0.4;
      if (mano) { const su = vicino === 'mercante' ? 2.6 + 0.3 * Math.sin(t * 8) : 0.2; mano.rotation.x += (su - mano.rotation.x) * 0.15; }
      if (mestolo) mestolo.rotation.y = steps((t * 0.5) % 1, 8) * Math.PI * 2; // gira a scatti
      if (brodo) { const k = 0.85 + 0.15 * Math.sin(t * 5); brodo.scale.set(k, 1, k); }
      bolle.forEach((b, k) => { const f = (t * 0.7 + k * 0.25) % 1; b.position.set(Math.cos(k * 2.1) * 0.25, 0.9 + f * 0.9, 1.6 + Math.sin(k * 2.1) * 0.25); b.scale.setScalar(1 - f); });
      if (luceS) luceS.intensity = 9 + 2 * (((Math.floor(t * 8)) * 0.618) % 1);
      if (testa) testa.rotation.x = vicino === 'strega' ? -0.25 : 0.15 * Math.sin(t * 0.7);
    },
    dispose() { if (mer) scene.remove(mer); if (str) scene.remove(str); for (const d of disp) d.dispose(); },
  };
}
