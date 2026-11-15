// Il Portale del Vuoto in prima persona: piattaforme sospese senza muri, quindi da dentro gli occhi si vedeva tutto fino all'orizzonte e
// niente aiutava a capire dove si era. Adesso:
// - la vista è corta e una foschia viola a gradini (render/finestra.ts) mangia le piattaforme lontane: il fondo è dello stesso colore, così
//   quello che non vedi più sparisce nel nulla invece di lasciare un buco nero;
// - le piattaforme hanno un orlo di cristallo e uno spessore, e sotto pendono rocce a punta: si capisce dove finiscono e che sono sospese;
// - ogni stanza ha un faro di cristallo sul bordo con la punta del suo colore, che si vede da lontano anche nella foschia;
// - in cielo le stelle (a scatti, di palette) e il portale, sempre nella direzione del Custode: la stella polare del dungeon.
import * as THREE from 'three';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL } from '../ui/style.ts';
import { cellHash } from './dungeon_kit.ts';
import type { Part } from './dungeon_kit.ts';
import { ACCENTI, facce, posto, stanze, vc } from './fp_arredo.ts';
import type { Pianta, Posa } from './fp_arredo.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const BIANCO = '#ffffff';
/** Cielo: raggio della cupola che segue la camera (m, dentro il piano lontano), stelle, portale (raggio, alzo sull'orizzonte in radianti). */
const CIELO = { r: 46, stelle: 420, portale: 3.6, alzo: 0.2 } as const;
/** Altezza del filo di luce dei fari (m). */
const FILO = 40;
const STELLE = [PAL.sabbiaChiara, PAL.acquaBassa, PAL.viola, PAL.rosaNeon, PAL.pietraChiara] as const;

export type Vuoto = { aggiorna(cam: THREE.Camera, t: number): void; dispose(): void };

export function arredaVuoto(p: Pianta, scene: THREE.Scene, posa: Posa): Vuoto {
  const { map, top } = p, T = map.tile, W = map.w, H = map.h;
  const parte = (geo: THREE.BufferGeometry): Part[] => [{ geo, mat: vc() }];

  // ---- bordo delle piattaforme: orlo viola con schegge di cristallo, e lo spessore della roccia sotto ----
  const bordi = facce(p, true);
  const orlo = merged([
    painted(box(T, 0.16, 0.26), PAL.viola, M(0, top + 0.06, -T / 2 + 0.13)), painted(box(T, 0.9, 0.18), PAL.abisso, M(0, top - 0.5, -T / 2 + 0.09)),
    painted(box(T, 0.06, 0.3), PAL.pietraScura, M(0, top - 0.06, -T / 2 + 0.15)),
  ]);
  posa(parte(orlo), bordi.map((f) => posto(T, f.cx, f.cz, f.dx, f.dz)), 'fp_orlo', 'pieno');
  const scheggia = parte(merged([painted(new THREE.OctahedronGeometry(0.16, 0), BIANCO, M(0, 0, 0, 0, 0, 0, 1, 2.2, 1))]));
  const sch: THREE.Matrix4[] = [], schC: string[] = [];
  bordi.forEach((f, k) => {
    const n = cellHash(k, 1, 61) < 0.5 ? 1 : 2;
    for (let j = 0; j < n; j++) {
      const lungo = (cellHash(k, j, 62) - 0.5) * 1.6, s = 0.5 + 0.6 * cellHash(k, j, 63);
      sch.push(posto(T, f.cx, f.cz, f.dx, f.dz, (f.dx * T) / 2 - f.dx * 0.15 + (f.dz ? lungo : 0), (f.dz * T) / 2 - f.dz * 0.15 + (f.dx ? lungo : 0), s).multiply(M(0, top + 0.3 * s, 0, 0.3 * (j ? 1 : -1), 0, 0.25)));
      schC.push(j ? PAL.acquaBassa : PAL.viola);
    }
  });
  posa(scheggia, sch, 'fp_schegge', 'acceso', schC);

  // ---- sotto: una punta di roccia rovesciata per cella, girata e lunga a caso (più lunga al centro delle piattaforme) ----
  const punta = parte(merged([painted(new THREE.ConeGeometry(T * 0.72, 1, 5), BIANCO, M(0, -0.5, 0, Math.PI, 0, 0))]));
  const sotto: THREE.Matrix4[] = [], sottoC: string[] = [], TONI = [PAL.abisso, PAL.pietraScura, PAL.abisso, PAL.viola];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (!p.isFloor(cx, cz)) continue;
    let vicini = 0; for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) if (p.isFloor(cx + dx, cz + dz)) vicini++;
    const l = (0.6 + vicini * 0.8) * (0.4 + 1.2 * cellHash(cx, cz, 71) ** 2), s = 0.8 + 0.35 * cellHash(cx, cz, 73);
    sotto.push(M((cx + 0.5) * T + (cellHash(cx, cz, 74) - 0.5) * 0.6, top - 0.3, (cz + 0.5) * T + (cellHash(cx, cz, 75) - 0.5) * 0.6, 0, cellHash(cx, cz, 76) * 6, 0, s, l, s)); sottoC.push(TONI[Math.floor(cellHash(cx, cz, 72) * 4)]!);
  }
  posa(punta, sotto, 'fp_sotto', 'pieno', sottoC);

  // ---- fari: uno per stanza, sul bordo più lontano dal centro della piattaforma; la punta si vede anche nella foschia ----
  const { di, celle } = stanze(p), fusto = parte(merged([
    painted(box(0.7, 0.3, 0.7), PAL.pietraScura, M(0, top + 0.15, 0)), painted(box(0.36, 3, 0.36), PAL.abisso, M(0, top + 1.8, 0, 0, Math.PI / 4, 0)),
    painted(box(0.5, 0.14, 0.5), PAL.viola, M(0, top + 3.3, 0)),
  ]));
  const fari: THREE.Matrix4[] = [], punte: { x: number; z: number; c: string }[] = [];
  celle.forEach((gruppo, r) => {
    let sx = 0, sz = 0; for (const i of gruppo) { sx += i % W; sz += Math.floor(i / W); }
    sx /= gruppo.length; sz /= gruppo.length;
    let best: (typeof bordi)[number] | null = null, bd = -1;
    for (const f of bordi) if (di[f.cz * W + f.cx] === r) { const d = (f.cx - sx) ** 2 + (f.cz - sz) ** 2; if (d > bd) { bd = d; best = f; } }
    const c = ACCENTI[r % ACCENTI.length]!;
    if (best) {
      const x = (best.cx + 0.5 + best.dx * 0.5) * T - best.dx * 0.3, z = (best.cz + 0.5 + best.dz * 0.5) * T - best.dz * 0.3;
      fari.push(M(x, 0, z)); punte.push({ x, z, c });
    }
  });
  posa(fusto, fari, 'fp_faro', 'pieno');
  // le punte non prendono foschia né buio (materiale semplice, fuori dalla finestra): sono i punti di riferimento
  const extra = new THREE.Group(); extra.name = 'vuoto_cielo'; scene.add(extra);
  // e da ogni punta sale un filo di luce fino al cielo: da lontano si vede la colonna del colore della stanza
  // (un solo pezzo per tutti: punta e filo fusi, il colore è quello dell'istanza)
  const luce = merged([new THREE.OctahedronGeometry(0.5, 0).scale(1, 1.6, 1), new THREE.BoxGeometry(0.14, FILO, 0.14).translate(0, FILO / 2 + 0.5, 0)].map((g) => g.toNonIndexed()));
  const fari2 = new THREE.InstancedMesh(luce, new THREE.MeshBasicMaterial({ color: BIANCO }), Math.max(1, punte.length));
  fari2.count = punte.length; fari2.frustumCulled = false; fari2.name = 'fp_faro_luce';
  punte.forEach((q, n) => { fari2.setMatrixAt(n, M(q.x, top + 3.9, q.z)); fari2.setColorAt(n, new THREE.Color(q.c)); });
  extra.add(fari2);

  // ---- cielo: stelle e portale su una cupola che segue la camera (lontani all'infinito) ----
  const cupola = new THREE.Group(); cupola.name = 'cupola'; extra.add(cupola);
  const pos = new Float32Array(CIELO.stelle * 3), col = new Float32Array(CIELO.stelle * 3), c = new THREE.Color();
  for (let i = 0; i < CIELO.stelle; i++) {
    const u = cellHash(i, 1, 81) * 2 - 1, a = cellHash(i, 2, 82) * Math.PI * 2, s = Math.sqrt(1 - u * u); // sfera uniforme: sopra e sotto (il vuoto è anche giù)
    pos[i * 3] = Math.cos(a) * s * CIELO.r; pos[i * 3 + 1] = u * CIELO.r; pos[i * 3 + 2] = Math.sin(a) * s * CIELO.r;
    c.set(STELLE[i % STELLE.length]!); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stelle = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false }));
  stelle.renderOrder = -2; cupola.add(stelle);
  // il portale: due anelli e il disco scuro dentro, girato verso la camera, nella direzione del Custode
  const capo = map.nemici.find((n) => n.capo), meta = capo ? { x: (capo.cx + 0.5) * T, z: (capo.cz + 0.5) * T } : { x: map.exit.x, z: map.exit.z };
  const portale = new THREE.Group(); portale.name = 'portale';
  const anello = (r: number, t: number, colore: string) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 4, 20), new THREE.MeshBasicMaterial({ color: colore, depthWrite: false }));
  const disco = new THREE.Mesh(new THREE.CircleGeometry(CIELO.portale * 0.86, 20), new THREE.MeshBasicMaterial({ color: PAL.neroCaldo, depthWrite: false }));
  disco.position.z = -0.2;
  portale.add(disco, anello(CIELO.portale, 0.55, PAL.viola), anello(CIELO.portale * 0.8, 0.28, PAL.rosaNeon), anello(CIELO.portale * 1.18, 0.16, PAL.acquaBassa));
  portale.traverse((o) => { o.renderOrder = -1; }); cupola.add(portale);
  const cam = new THREE.Vector3();
  let passo = -1;

  return {
    aggiorna(camera, t) {
      camera.getWorldPosition(cam); cupola.position.copy(cam);
      const dx = meta.x - cam.x, dz = meta.z - cam.z, l = Math.hypot(dx, dz) || 1, ca = Math.cos(CIELO.alzo), sa = Math.sin(CIELO.alzo);
      portale.position.set((dx / l) * ca * CIELO.r * 0.9, sa * CIELO.r * 0.9, (dz / l) * ca * CIELO.r * 0.9);
      portale.lookAt(cam);
      // il portale gira a scatti (4 al secondo), un ottavo di giro alla volta per l'anello di mezzo
      const k = Math.floor(t * 4);
      if (k !== passo) { passo = k; const a = portale.children[2]; if (a) a.rotation.z = (k % 20) * (Math.PI / 10); }
    },
    dispose() {
      extra.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | undefined; mat?.dispose(); });
      scene.remove(extra);
    },
  };
}
