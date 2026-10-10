// Luce e nebbia del dungeon a celle (#208): due DataTexture sul piano del pavimento lette dai materiali della scena (render/finestra.ts).
// - Luce (RGB, RES texel per cella): torce, bracieri, scala e altari, cotta una volta all'inizio con la linea di vista della sim (le colonne
//   fanno ombra); i texel dentro un muro prendono il pavimento più acceso accanto (per le cime dei muri).
// - Nebbia (R, un texel per cella): 0 mai visto, VISTO già visto, da LONTANO a 1 in vista ora (più vicino = più chiaro). La vista si calcola
//   dal centro della cella dell'eroe (tornando nella stessa cella si vede sempre la stessa cosa) e solo i muri la fermano: le colonne no,
//   così dietro una colonna non resta un buco nel pavimento. Quando cambia, la nebbia va verso il nuovo valore in un terzo di secondo (lo
//   shader la riduce a gradini col retino: si vede una dissolvenza a pixel, non un'apparizione).
import * as THREE from 'three';
import { lineOfSight } from '@marea/sim/dungeon/map.ts';
import type { DMap } from '@marea/sim/dungeon/map.ts';

export type Sorgente = { x: number; z: number; c: string; i: number; r: number };
export type LuceDungeon = {
  luce: THREE.DataTexture; nebbia: THREE.DataTexture;
  /** Vista dalla cella `hc` (indice cz·W + cx). */
  vista(hc: number): void;
  /** Ogni frame (dt in secondi): la nebbia scorre verso il bersaglio. */
  passo(dt: number): void;
  /** 0 mai vista, VISTO già vista, ≥ LONTANO in vista ora (il bersaglio, non il valore che sta scorrendo). */
  livello(i: number): number;
  readonly viste: number;
  dispose(): void;
};
export const VISTO = 0.28, LONTANO = 0.55, RES = 2;
const R_VICINO = 8, R_VISTA = 19; // m
const VEL = 3.2; // nebbia: unità al secondo

const dataTex = (data: Uint8Array, w: number, h: number, f: THREE.PixelFormat) => {
  const t = new THREE.DataTexture(data, w, h, f, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
};

export function createLuce(map: DMap, o: { isFloor(cx: number, cz: number): boolean; muro(cx: number, cz: number): boolean; sorgenti: Sorgente[] }): LuceDungeon {
  const W = map.w, H = map.h, T = map.tile, N = W * H;

  // ---- luce cotta ----
  const LW = W * RES, LH = H * RES, LT = T / RES, LN = LW * LH;
  const acc = new Float32Array(LN * 3), col = new THREE.Color();
  const pav = (lx: number, lz: number) => o.isFloor(Math.floor(lx / RES), Math.floor(lz / RES));
  for (const s of o.sorgenti) {
    col.set(s.c);
    const R = Math.ceil(s.r / LT), sx = Math.floor(s.x / LT), sz = Math.floor(s.z / LT);
    for (let lz = Math.max(0, sz - R); lz <= Math.min(LH - 1, sz + R); lz++) for (let lx = Math.max(0, sx - R); lx <= Math.min(LW - 1, sx + R); lx++) {
      if (!pav(lx, lz)) continue;
      const x = (lx + 0.5) * LT, z = (lz + 0.5) * LT, d = Math.sqrt((x - s.x) ** 2 + (z - s.z) ** 2);
      if (d >= s.r || (d > LT && !lineOfSight(map, s.x, s.z, x, z))) continue;
      const k = s.i * (1 - d / s.r) ** 2, i = (lz * LW + lx) * 3;
      acc[i] = acc[i]! + col.r * k; acc[i + 1] = acc[i + 1]! + col.g * k; acc[i + 2] = acc[i + 2]! + col.b * k;
    }
  }
  const dLuce = new Uint8Array(LN * 4);
  for (let lz = 0; lz < LH; lz++) for (let lx = 0; lx < LW; lx++) {
    let j = lz * LW + lx;
    // dentro un muro: il texel di pavimento più acceso accanto (cime dei muri; le facce leggono già il pavimento davanti)
    if (o.muro(Math.floor(lx / RES), Math.floor(lz / RES))) {
      let best = -1, m = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = lx + dx, nz = lz + dz;
        if (nx < 0 || nz < 0 || nx >= LW || nz >= LH || !pav(nx, nz)) continue;
        const q = nz * LW + nx, v = acc[q * 3]! + acc[q * 3 + 1]! + acc[q * 3 + 2]!;
        if (v > m) { m = v; best = q; }
      }
      if (best < 0) continue;
      j = best;
    }
    const i = lz * LW + lx;
    for (let c = 0; c < 3; c++) dLuce[i * 4 + c] = Math.min(255, Math.round((acc[j * 3 + c]! / 2) * 255));
    dLuce[i * 4 + 3] = 255;
  }
  const luce = dataTex(dLuce, LW, LH, THREE.RGBAFormat);

  // ---- nebbia ----
  const dNebbia = new Uint8Array(N);
  const nebbia = dataTex(dNebbia, W, H, THREE.RedFormat);
  // per la vista solo i muri sono opachi (le colonne sono sottili: dietro si vede ancora il pavimento)
  const soloMuri = { w: W, h: H, tile: T, solid: map.solid, opaque: new Uint8Array(N) };
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) if (o.muro(cx, cz)) soloMuri.opaque[cz * W + cx] = 1;
  const tgt = new Float32Array(N), cur = new Float32Array(N), seen = new Uint8Array(N);
  let viste = 0, primo = true, mosso = false;
  const api: LuceDungeon = {
    luce, nebbia,
    get viste() { return viste; },
    vista(hc) {
      const hcx = hc % W, hcz = (hc - hcx) / W, hx = (hcx + 0.5) * T, hz = (hcz + 0.5) * T, R = Math.ceil(R_VISTA / T);
      for (let i = 0; i < N; i++) tgt[i] = seen[i] ? VISTO : 0;
      for (let cz = Math.max(0, hcz - R); cz <= Math.min(H - 1, hcz + R); cz++) for (let cx = Math.max(0, hcx - R); cx <= Math.min(W - 1, hcx + R); cx++) {
        if (!o.isFloor(cx, cz)) continue;
        const x = (cx + 0.5) * T, z = (cz + 0.5) * T, d = Math.sqrt((x - hx) ** 2 + (z - hz) ** 2);
        if (d > R_VISTA || !lineOfSight(soloMuri, hx, hz, x, z)) continue;
        const i = cz * W + cx;
        tgt[i] = 1 - (1 - LONTANO) * Math.min(1, Math.max(0, (d - R_VICINO) / (R_VISTA - R_VICINO)));
        if (!seen[i]) { seen[i] = 1; viste++; }
      }
      // muri: il pavimento più chiaro tra gli 8 vicini (le facce leggono comunque la cella davanti a sé, questo vale per le cime)
      for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
        if (!o.muro(cx, cz)) continue;
        let best = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, nz = cz + dz;
          if (nx >= 0 && nz >= 0 && nx < W && nz < H && o.isFloor(nx, nz)) best = Math.max(best, tgt[nz * W + nx]!);
        }
        const i = cz * W + cx;
        tgt[i] = best; if (best > 0 && !seen[i]) { seen[i] = 1; viste++; }
      }
      // la prima volta niente dissolvenza: si parte già vedendo la stanza
      if (primo) { primo = false; cur.set(tgt); for (let i = 0; i < N; i++) dNebbia[i] = Math.round(cur[i]! * 255); nebbia.needsUpdate = true; }
      mosso = true;
    },
    passo(dt) {
      if (!mosso) return;
      const k = VEL * Math.min(0.1, Math.max(0, dt));
      let ancora = false;
      for (let i = 0; i < N; i++) {
        const a = cur[i]!, b = tgt[i]!;
        if (a === b) continue;
        const v = Math.abs(b - a) <= k ? b : a + Math.sign(b - a) * k;
        cur[i] = v; dNebbia[i] = Math.round(v * 255);
        if (v !== b) ancora = true;
      }
      nebbia.needsUpdate = true;
      mosso = ancora;
    },
    livello: (i) => (i < 0 || i >= N ? 0 : tgt[i]! > VISTO ? Math.max(LONTANO, tgt[i]!) : tgt[i]!),
    dispose() { luce.dispose(); nebbia.dispose(); },
  };
  return api;
}
