// L'accampamento dei pirati sulla spiaggia (docs/TEMPLARI.md §3): le tende vere al posto delle piramidi grigie (13 ott 2026, birbasan:
// «fai vedere che sono capanne»), con la tela a due falde sul palo di colmo, i due pali che spuntano sopra, l'ingresso scuro con le falde
// aperte sul lato che guarda la camera, le corde ai picchetti, lo stendardo su un'asta e un po' di roba davanti; poi la spiaggia meno
// spoglia: scogli in mare lungo la riva, sassi, conchiglie, legni portati dal mare e alghe sulla sabbia. Solo resa (le tende restano celle
// piene nella sim, gli scogli sulla sabbia sono celle 'q' della mappa). Dal §12b (18 ott 2026) l'accampamento è stretto: la palizzata di
// tronchi appuntiti ('|') e la nave tirata in secca su un fianco ('='), che prima stava in mare a ovest per bellezza, ora fa da muro.
// Tutto fisso in una mesh, sassi e scogli in un InstancedMesh.
import * as THREE from 'three';
import type { Arena } from '@marea/sim/templari/mappa.ts';
import { C, SUOLO, TIPO } from '@marea/sim/templari/mappa.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from '../rpg/dungeon_kit.ts';
import { merged } from '../render/island_parts.ts';
import { unisci } from './armi3d.ts';
import type { Pezzo } from './armi3d.ts';

export type Accampamento = { update(t: number): void; stats(): { palizzata: number; navi: number }; dispose(): void };

const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const CY = (r0: number, r1: number, h: number, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);
/** Triangolo pieno nel piano XY (base da −w/2 a w/2 a terra, punta in alto a h), una faccia per lato. Fatto a mano: ExtrudeGeometry di
 *  three finirebbe nel pezzo di three che si scarica all'avvio (+5,6 KB). */
function triangolo(w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), a = [-w / 2, 0, 0.02, w / 2, 0, 0.02, 0, h, 0.02], b = [w / 2, 0, -0.02, -w / 2, 0, -0.02, 0, h, -0.02];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
  return g;
}

/** Tenda a due falde lunga `lx` (colmo lungo X) e larga `lz`, pivot al centro a terra; l'ingresso sul timpano a +X. */
function tenda(lx: number, lz: number, tela: string, toppa: string, bandiera: 'teschio' | 'rossa'): THREE.BufferGeometry {
  const hc = 2.5, mezzo = lz / 2, falda = Math.sqrt(mezzo * mezzo + hc * hc), ang = Math.atan2(hc, mezzo);
  const p: Pezzo[] = [
    // le due falde di tela, il colmo e i due pali che spuntano sopra
    { g: B(lx + 0.2, 0.06, falda), c: tela, y: hc / 2, z: mezzo / 2, rx: ang }, { g: B(lx + 0.2, 0.06, falda), c: tela, y: hc / 2, z: -mezzo / 2, rx: -ang },
    { g: B(lx + 0.7, 0.1, 0.1), c: PAL.legnoScuro, y: hc + 0.03 },
    ...[-1, 1].map((s): Pezzo => ({ g: B(0.12, hc + 0.75, 0.12), c: PAL.legnoScuro, x: s * (lx / 2 + 0.12), y: (hc + 0.75) / 2 })),
    // i timpani: dietro chiuso, davanti l'ingresso scuro con le falde aperte
    { g: triangolo(lz, hc), c: tela, x: -lx / 2, ry: Math.PI / 2 }, { g: triangolo(lz, hc), c: tela, x: lx / 2 - 0.01, ry: Math.PI / 2 },
    { g: triangolo(1.5, 1.9), c: PAL.neroCaldo, x: lx / 2 + 0.03, ry: Math.PI / 2 },
    ...[-1, 1].map((s): Pezzo => ({ g: B(0.05, 1.7, 0.65), c: toppa, x: lx / 2 + 0.3, y: 0.85, z: s * 0.95, ry: s * 0.6, rx: s * -0.15 })),
    // toppe sulla falda verso la camera, cucite storte
    { g: B(0.7, 0.07, 0.6), c: toppa, x: -0.6, y: hc * 0.45, z: mezzo * 0.55, rx: ang }, { g: B(0.45, 0.07, 0.5), c: toppa, x: 1.0, y: hc * 0.7, z: mezzo * 0.3, rx: ang, ry: 0.2 },
    // corde dai pali ai picchetti
    ...[-1, 1].flatMap((s): Pezzo[] => [{ g: B(0.03, 3.1, 0.03), c: PAL.legnoScuro, x: s * (lx / 2 + 0.75), y: 1.55, rz: s * 0.4 }, { g: B(0.08, 0.2, 0.08), c: PAL.legno, x: s * (lx / 2 + 1.35), y: 0.08 }]),
    // davanti all'ingresso: una botte, una cassa, una stuoia
    { g: CY(0.28, 0.24, 0.62, 7), c: PAL.legno, x: lx / 2 + 0.75, y: 0.31, z: mezzo - 0.3 }, { g: B(0.55, 0.45, 0.45), c: PAL.legnoChiaro, x: lx / 2 + 0.55, y: 0.22, z: -mezzo + 0.5, ry: 0.4 },
    { g: B(0.9, 0.03, 1.5), c: toppa, x: lx / 2 + 1.0, y: 0.015, ry: 0.15 },
    // lo stendardo sull'asta, all'angolo
    { g: CY(0.05, 0.06, 4.0, 5), c: PAL.legnoScuro, x: lx / 2 + 0.3, y: 2.0, z: mezzo + 0.35 },
    { g: B(0.75, 0.05, 0.05), c: PAL.legnoScuro, x: lx / 2 + 0.65, y: 3.9, z: mezzo + 0.35 },
  ];
  if (bandiera === 'teschio') p.push(
    { g: B(0.7, 0.95, 0.03), c: PAL.neroCaldo, x: lx / 2 + 0.68, y: 3.4, z: mezzo + 0.35 },
    { g: B(0.26, 0.22, 0.04), c: PAL.pietraChiara, x: lx / 2 + 0.68, y: 3.55, z: mezzo + 0.35 }, { g: B(0.42, 0.06, 0.04), c: PAL.pietraChiara, x: lx / 2 + 0.68, y: 3.3, z: mezzo + 0.35, rz: 0.6 }, { g: B(0.42, 0.06, 0.04), c: PAL.pietraChiara, x: lx / 2 + 0.68, y: 3.3, z: mezzo + 0.35, rz: -0.6 },
  );
  else p.push({ g: B(0.7, 0.95, 0.03), c: PAL.rosso, x: lx / 2 + 0.68, y: 3.4, z: mezzo + 0.35 }, { g: B(0.7, 0.1, 0.04), c: PAL.giallo, x: lx / 2 + 0.68, y: 3.2, z: mezzo + 0.35 });
  return unisci(p);
}

/** Tronco della palizzata alto `h`, pivot a terra: fusto a 6 facce e punta. */
const tronco = (h: number, c: string): Pezzo[] => [{ g: CY(0.15, 0.17, h - 0.35, 6), c, y: (h - 0.35) / 2 }, { g: new THREE.ConeGeometry(0.15, 0.35, 6), c: PAL.legnoChiaro, y: h - 0.175 }];

/** La nave tirata in secca su un fianco (il carenaggio dei pirati, §3), lunga `lx` lungo X e larga `lz`, pivot al centro a terra: lo scafo
 *  sbandato col ponte verso il mare (assi, boccaporto, parapetto, il moncone dell'albero), la prua a punta a ovest e lo specchio di poppa a
 *  est, la chiglia e la linea della pece, i puntelli che lo reggono; sulla sabbia l'albero spezzato, la vela strappata, un secchio di pece.
 *  Sta tutta dentro le sue celle (la sim le tiene piene). */
function naveInSecca(lx: number, lz: number): THREE.BufferGeometry {
  const h = 2.1, D = lz - 0.7, L = lx - 0.6, s = 0.6, cs = Math.cos(s), sn = Math.sin(s), yc = 1.0;
  /** Un pezzo dello scafo: posizione nel riferimento dello scafo (centro a `yc`, sbandato di `s` attorno a X). */
  const sc = (g: THREE.BufferGeometry, c: string, x: number, y: number, z: number, ry = 0): Pezzo => ({ g, c, x, y: yc + y * cs - z * sn, z: y * sn + z * cs, rx: s, ry });
  const corpo = L - 1.4, xc = 0.7, ponte = h / 2;
  return unisci([
    sc(B(corpo, h, D), PAL.legnoScuro, xc, 0, 0),                                                     // lo scafo
    ...[-1, 1].map((k) => sc(B(1.9, h * 0.92, D * 0.62), PAL.legnoScuro, -L / 2 + 1.0, -0.04, k * D * 0.2, k * 0.42)), // la prua a punta
    sc(B(0.3, h + 0.3, D + 0.1), PAL.legno, L / 2, 0.1, 0),                                              // lo specchio di poppa
    sc(B(L, 0.3, 0.3), PAL.legno, -0.1, -h / 2 - 0.12, 0),                                               // la chiglia
    sc(B(corpo, 0.26, 0.04), PAL.legno, xc, ponte - 0.22, D / 2 + 0.02),                                // il capo di banda
    sc(B(corpo, 0.3, 0.04), PAL.neroCaldo, xc, -h / 2 + 0.3, D / 2 + 0.02),                             // la linea della pece
    ...[-2, -1, 1, 2].map((k) => sc(B(corpo - 0.4, 0.03, 0.05), PAL.neroCaldo, xc, ponte + 0.01, (k * D) / 5)), // le assi del ponte
    sc(B(0.9, 0.07, 0.8), PAL.neroCaldo, xc + 1.6, ponte + 0.03, 0), sc(B(1.0, 0.09, 0.08), PAL.legnoChiaro, xc + 1.6, ponte + 0.05, 0), // il boccaporto
    ...[-3, -2, -1, 0, 1, 2].map((k) => sc(B(0.08, 0.5, 0.08), PAL.legno, xc + k * 1.2 + 0.6, ponte + 0.25, D / 2 - 0.05)),   // il parapetto
    sc(B(corpo * 0.7, 0.07, 0.07), PAL.legno, xc - 0.6, ponte + 0.5, D / 2 - 0.05),
    sc(CY(0.15, 0.19, 1.3, 6), PAL.legno, xc - 1.2, ponte + 0.65, 0),                                  // il moncone dell'albero
    ...[-0.32, 0, 0.32].map((f): Pezzo => ({ g: B(0.14, 1.6, 0.14), c: PAL.legnoChiaro, x: f * L, y: 0.7, z: -lz / 2 + 0.3, rx: -0.55 })), // i puntelli
    { g: CY(0.12, 0.16, lx * 0.6, 5), c: PAL.legno, x: 0.4, y: 0.12, z: lz / 2 - 0.2, rz: Math.PI / 2, ry: 0.06 },  // l'albero spezzato
    { g: B(2.2, 0.05, 1.1), c: PAL.sabbiaChiara, x: 1.6, y: 0.05, z: lz / 2 - 0.5, ry: 0.15 },          // la vela strappata
    { g: B(1.1, 0.05, 0.6), c: PAL.sabbia, x: -2.6, y: 0.05, z: lz / 2 - 0.4, ry: -0.3 },
    { g: CY(0.24, 0.2, 0.45, 7), c: PAL.neroCaldo, x: -L / 2 + 1.3, y: 0.22, z: -lz / 2 + 0.4 },        // il secchio di pece
  ]);
}

export function createAccampamento(scene: THREE.Scene, a: Arena, tende: number[][], navi: number[][] = []): Accampamento {
  const T = a.tile, W = a.w, H = a.h;
  const disp: { dispose(): void }[] = [];
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }); disp.push(lam);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const pezzi: THREE.BufferGeometry[] = [];
  const metti = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, s = 1) => pezzi.push(g.clone().applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), sc.setScalar(s))));

  // ---- tende: tela grezza, sabbia o rossa, mai grigia; metà col teschio e metà con lo stendardo rosso ----
  const TELE: [string, string][] = [[PAL.sabbiaChiara, PAL.legnoChiaro], [PAL.rosso, PAL.sabbiaChiara], [PAL.legnoChiaro, PAL.sabbia], [PAL.sabbia, PAL.rosso]];
  tende.forEach((g, n) => {
    const xs = g.map((i) => i % W), zs = g.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
    const [tela, toppa] = TELE[n % TELE.length]!;
    const geo = tenda((x1 - x0) * T, (z1 - z0) * T + 0.1, tela, toppa, n % 2 ? 'rossa' : 'teschio');
    metti(geo, ((x0 + x1) / 2) * T, 0, ((z0 + z1) / 2) * T); geo.dispose();
  });

  // ---- palizzata (§12b punto 2): tre tronchi appuntiti per cella lungo la fila, legati da due traverse; alti diversi, qualcuno storto ----
  const tipoA = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= H ? TIPO.niente : a.tipo[cz * W + cx]!);
  const TRONCHI = [1.9, 2.15, 2.35, 2.05].map((h, k) => unisci(tronco(h, k % 2 ? PAL.legnoScuro : PAL.legno)));
  let palizzata = 0;
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (tipoA(cx, cz) !== TIPO.palizzata) continue;
    palizzata++;
    const lungoX = tipoA(cx - 1, cz) === TIPO.palizzata || tipoA(cx + 1, cz) === TIPO.palizzata, solo = !lungoX && tipoA(cx, cz - 1) !== TIPO.palizzata && tipoA(cx, cz + 1) !== TIPO.palizzata;
    const x = (cx + 0.5) * T, z = (cz + 0.5) * T;
    for (let k = -1; k <= 1; k++) {
      const h = cellHash(cx * 3 + k, cz, 61), o = k * 0.33;
      metti(TRONCHI[Math.floor(h * TRONCHI.length)]!, lungoX ? x + o : x + (h - 0.5) * 0.06, 0, lungoX ? z + (h - 0.5) * 0.06 : z + o, h * 6);
      if (solo) metti(TRONCHI[Math.floor(h * 3.9) % TRONCHI.length]!, x + o, 0, z + 0.3, h * 4);
    }
    for (const y of [0.55, 1.35]) { const g = unisci([{ g: B(lungoX ? T + 0.02 : 0.08, 0.1, lungoX ? 0.08 : T + 0.02), c: PAL.legnoScuro }]); metti(g, x + (lungoX ? 0 : 0.17), y, z + (lungoX ? 0.17 : 0), 0); g.dispose(); }
  }
  for (const g of TRONCHI) g.dispose();
  // ---- la nave in secca: sulle sue celle ----
  for (const g of navi) {
    const xs = g.map((i) => i % W), zs = g.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
    const lungo = x1 - x0 >= z1 - z0, geo = naveInSecca((lungo ? x1 - x0 : z1 - z0) * T, (lungo ? z1 - z0 : x1 - x0) * T);
    metti(geo, ((x0 + x1) / 2) * T, 0, ((z0 + z1) / 2) * T, lungo ? 0 : Math.PI / 2); geo.dispose();
  }

  // ---- spiaggia: legni portati dal mare e alghe sulla sabbia libera; sassi e conchiglie; scogli in mare lungo la riva ----
  const cella = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= H ? C.fuori : a.cell[cz * W + cx]!);
  const legno = unisci([{ g: CY(0.09, 0.07, 1.4, 5), c: PAL.legnoChiaro, rz: Math.PI / 2 }, { g: CY(0.04, 0.03, 0.5, 4), c: PAL.legnoChiaro, x: 0.3, y: 0.05, z: 0.18, rz: Math.PI / 2, ry: 0.8 }]);
  const alghe = unisci([...[0, 1, 2, 3].map((k): Pezzo => ({ g: CY(0.16 - k * 0.025, 0.18 - k * 0.025, 0.03, 7), c: k % 2 ? PAL.erbaScura : PAL.bosco, x: Math.cos(k * 2.3) * 0.14, y: k * 0.006, z: Math.sin(k * 2.3) * 0.1 }))]); // ciuffo d'alghe
  type Sasso = { x: number; y: number; z: number; s: number; sy: number; c: string; r: number };
  const sassi: Sasso[] = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = cz * W + cx, h = (k: number) => cellHash(cx, cz, k);
    if (a.suolo[i] === SUOLO.sabbia && a.cell[i] === C.terra) {
      const x = (cx + 0.2 + h(1) * 0.6) * T, z = (cz + 0.2 + h(2) * 0.6) * T;
      if (h(3) < 0.025) metti(legno, x, 0.08, z, h(4) * 6);
      else if (h(3) < 0.05) metti(alghe, x, 0.012, z, h(4) * 6);
      if (h(5) < 0.08) sassi.push({ x, y: 0.04, z: z + 0.3, s: 0.07 + h(6) * 0.12, sy: 0.6, c: h(7) < 0.3 ? PAL.sabbiaChiara : h(7) < 0.75 ? PAL.pietra : PAL.pietraScura, r: h(8) * 6 });
    }
    // riva: dalla sabbia verso il mare (a sud) qualche scoglio mezzo sommerso, più grandi più si va al largo
    if (a.suolo[i] === SUOLO.sabbia && cella(cx, cz + 1) === C.fuori && h(9) < 0.22) {
      const n = 1 + Math.floor(h(10) * 3);
      for (let k = 0; k < n; k++) {
        const fuori = 1.6 + h(11 + k) * 4.5, s = 0.45 + h(14 + k) * 0.9 + fuori * 0.08;
        sassi.push({ x: (cx + 0.5 + (h(17 + k) - 0.5) * 2.5) * T, y: -0.08, z: (cz + 1) * T + fuori, s, sy: 0.55 + h(20 + k) * 0.35, c: h(23 + k) < 0.3 ? PAL.roccia : PAL.pietraScura, r: h(26 + k) * 6 });
      }
    }
  }
  legno.dispose(); alghe.dispose();
  const fissi = pezzi.length ? merged(pezzi) : new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(fissi, lam); mesh.name = 'accampamento'; scene.add(mesh); disp.push(fissi);
  const sGeo = new THREE.DodecahedronGeometry(1, 0), sMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const sm = new THREE.InstancedMesh(sGeo, sMat, Math.max(1, sassi.length)); sm.name = 'scogli'; sm.count = sassi.length; sm.frustumCulled = false;
  const col = new THREE.Color();
  sassi.forEach((s, k) => { sm.setMatrixAt(k, m4.compose(v.set(s.x, s.y + s.s * s.sy * 0.5, s.z), q.setFromEuler(e.set(0, s.r, 0)), sc.set(s.s, s.s * s.sy, s.s * 0.9))); sm.setColorAt(k, col.set(s.c)); });
  scene.add(sm); disp.push(sGeo, sMat);
  return {
    update() {},
    stats: () => ({ palizzata, navi: navi.length }),
    dispose() { scene.remove(mesh, sm); for (const d of disp) d.dispose(); },
  };
}
