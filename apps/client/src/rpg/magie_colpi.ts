// Colpi a segno, scie, scoppi ed evocazioni delle magie nel dungeon (docs/RPG.md §Magie; magie_stile.ts dice cosa fa ogni magia). Lo crea solo
// dungeon_run.ts e lavora solo sulle magie di cui la vista dice l'id (`m`): l'Arena non lo usa e resta com'era.
// - Un proiettile magico che sparisce (nemico, muro, fine corsa) scoppia lì dov'era arrivato: sbuffo di fuoco, nuvola di polvere da sparo,
//   scintille elettriche o una stella di luce. Anche quelli dei nemici (`magia_nemica`), con uno sbuffo viola.
// - Mentre volano lasciano la scia: braci che cadono, fumo, scintille, granelli di luce, gocce, crocette.
// - Gli scoppi delle bombe hanno ognuno il suo disegno (fungo di fuoco, saette, squarcio che si richiude, vortice di lame, crocette, punte).
// - Dove nasce un'evocazione: cerchio viola con le rune che girano e una colonna che sale.
// Tutti i pezzi sono cubi colorati in un'unica InstancedMesh (una sola chiamata di disegno), si muovono e si rimpiccioliscono a scatti.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { suona } from '../audio/ponte.ts';
import { PAL } from '../ui/style.ts';
import { EVOCA, rnd, scatti, stile } from './magie_stile.ts';
import type { Famiglia, Impatto, Scoppio, Scia } from './magie_stile.ts';

export type MagieColpi = { tick(v: DungeonView): void; update(): void; counts(): { pezzi: number }; dispose(): void };

/** Un pezzo: parte da (x, y, z) con velocità (vx, vy, vz) e gravità g, misure (sx, sy, sz) che vanno a × `fine` in `dur` s. */
type Pezzo = { x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; sx: number; sy: number; sz: number; fine: number; t0: number; dur: number; c: THREE.Color; giro: number; yaw: number };
const MAX = 480, FPS = 15, TAU = Math.PI * 2;
const colori = new Map<string, THREE.Color>();
const tinta = (c: string): THREE.Color => { let k = colori.get(c); if (!k) { k = new THREE.Color(c); colori.set(c, k); } return k; };

export function createMagieColpi(scene: THREE.Scene, floorY: number): MagieColpi {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX);
  mesh.name = 'magie_colpi'; mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 3;
  mesh.setColorAt(0, tinta(PAL.giallo)); scene.add(mesh);
  const pezzi: Pezzo[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const ora = (): number => performance.now() / 1000;
  /** Un pezzo nuovo (i più vecchi lasciano il posto se sono troppi). */
  const metti = (o: Partial<Omit<Pezzo, 'c'>> & { x: number; y: number; z: number; c: string; dur: number }, ritardo = 0): void => {
    if (pezzi.length >= MAX) pezzi.shift();
    const s = o.sx ?? 0.12;
    pezzi.push({ vx: 0, vy: 0, vz: 0, g: 0, sy: o.sx ?? s, sz: o.sx ?? s, fine: 0.2, giro: 0, yaw: 0, ...o, sx: s, c: tinta(o.c), t0: ora() + ritardo });
  };
  /** n pezzi a raggiera da (x, y, z): velocità v, in alto vy, colori a rotazione. */
  const raggiera = (x: number, y: number, z: number, n: number, v: number, vy: number, col: readonly string[], dur: number, s: number, g = 9, seme = 0, ritardo = 0): void => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(seme + i) * 0.6, k = 0.6 + 0.4 * rnd(seme + i * 3);
      metti({ x, y, z, vx: Math.cos(a) * v * k, vz: Math.sin(a) * v * k, vy: vy * (0.5 + rnd(seme + i * 5)), g, c: col[i % col.length]!, dur, sx: s * (0.7 + 0.5 * rnd(seme + i * 7)), giro: 8 }, ritardo);
    }
  };
  /** Un lampo: pochi cubi storti e sfalsati attorno al punto (un cubo solo, grande, sembrerebbe una scatola). */
  const lampo = (x: number, y: number, z: number, r: number, col: readonly string[], seme: number, dur = 0.12): void => {
    for (let i = 0; i < 7; i++) metti({ x: x + (rnd(seme + i) - 0.5) * r * 0.7, y: y + (rnd(seme + i * 3) - 0.5) * r * 0.6, z: z + (rnd(seme + i * 5) - 0.5) * r * 0.7, c: col[i % col.length]!, dur, sx: r * (0.08 + 0.1 * rnd(seme + i * 7)), fine: 1.6, yaw: rnd(seme + i) * 3, giro: 5 });
  };
  /** Un anello di cubi a terra che si allarga (o si stringe con v < 0) da r0. */
  const anello = (x: number, z: number, r0: number, v: number, n: number, c: string, dur: number, s: number, ritardo = 0): void => {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; metti({ x: x + Math.cos(a) * r0, y: floorY + 0.1, z: z + Math.sin(a) * r0, vx: Math.cos(a) * v, vz: Math.sin(a) * v, c, dur, sx: s, sy: s * 0.5, fine: 0.4, yaw: -a }, ritardo); }
  };

  // ---------- colpo a segno ----------
  const impatto = (tipo: Impatto, col: readonly string[], x: number, y: number, z: number, seme: number): void => {
    if (tipo === 'sbuffo') { // fuoco: un lampo giallo, lingue che schizzano e due sbuffi di fumo che salgono
      lampo(x, y, z, 0.7, [col[0]!, col[1]!], seme);
      raggiera(x, y, z, 9, 2.6, 2, col, 0.4, 0.16, 6, seme);
      for (let i = 0; i < 2; i++) metti({ x: x + (rnd(seme + i) - 0.5) * 0.3, y, z: z + (rnd(seme + i + 2) - 0.5) * 0.3, vy: 0.9, c: PAL.pietraScura, dur: 0.6, sx: 0.22, fine: 1.6 }, 0.08);
    } else if (tipo === 'nuvola') { // polvere da sparo: nuvola grigia che si allarga e qualche scintilla gialla
      lampo(x, y, z, 0.5, [col[0]!, PAL.sabbiaChiara], seme, 0.08);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; metti({ x, y, z, vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.9, vy: 0.3 + rnd(seme + i) * 0.5, c: i % 2 ? col[2]! : PAL.sabbiaChiara, dur: 0.6, sx: 0.14, fine: 1.7 }); }
      raggiera(x, y, z, 5, 4, 1.5, [col[0]!, col[1]!], 0.25, 0.07, 10, seme);
    } else if (tipo === 'scintille') { // elettricità: croce bianca per un attimo e scintille veloci a raggiera
      metti({ x, y, z, c: PAL.sabbiaChiara, dur: 0.1, sx: 0.7, sy: 0.08, sz: 0.08, fine: 1 }); metti({ x, y, z, c: PAL.sabbiaChiara, dur: 0.1, sx: 0.08, sy: 0.7, sz: 0.08, fine: 1 });
      raggiera(x, y, z, 10, 5, 2.5, col, 0.28, 0.06, 12, seme);
    } else { // Faro: una stella di luce a quattro punte che si allarga a scatti, poi granelli che restano sospesi
      for (const [sx, sy, k] of [[1, 0.08, 0], [0.08, 1, 0], [0.45, 0.14, 1], [0.14, 0.45, 1]] as const) metti({ x, y, z, c: col[k]!, dur: 0.22, sx: sx * 0.5, sy: sy * 0.5, sz: sx * 0.5, fine: 2 });
      raggiera(x, y, z, 6, 1.2, 0.4, [col[1]!, col[0]!], 0.5, 0.06, 0, seme);
    }
  };

  // ---------- scie ----------
  const scia = (tipo: Scia, col: readonly string[], x: number, y: number, z: number, seme: number): void => {
    const j = (k: number): number => (rnd(seme + k) - 0.5) * 0.18;
    switch (tipo) {
      case 'braci': metti({ x: x + j(1), y, z: z + j(2), vy: 0.4, g: 4, c: col[(seme % 3) + 0]!, dur: 0.45, sx: 0.07 }); break;
      case 'fumo': metti({ x: x + j(1), y, z: z + j(2), vy: 0.6, c: rnd(seme) > 0.5 ? PAL.pietra : PAL.pietraScura, dur: 0.6, sx: 0.12, fine: 1.8 }); break;
      case 'scintille': metti({ x: x + j(1) * 2, y: y + j(3) * 2, z: z + j(2) * 2, c: col[seme % 2]!, dur: 0.15, sx: 0.05 }); break;
      case 'luce': metti({ x: x + j(1), y: y + j(3), z: z + j(2), c: col[seme % 2]!, dur: 0.35, sx: 0.05, fine: 0.1 }); break;
      case 'vuoto': metti({ x: x + j(1) * 2, y: y + j(3) * 2, z: z + j(2) * 2, c: seme % 2 ? PAL.viola : PAL.neroCaldo, dur: 0.4, sx: 0.1, fine: 0 }); break;
      case 'gocce': metti({ x: x + j(1), y, z: z + j(2), vy: 0.5, g: 9, c: col[seme % 2]!, dur: 0.4, sx: 0.06 }); break;
      case 'croci': metti({ x: x + j(1), y, z: z + j(2), vy: 0.6, c: col[0]!, dur: 0.5, sx: 0.12, sy: 0.04, sz: 0.04 }); break;
      case 'rosa': metti({ x: x + j(1), y, z: z + j(2), vy: 0.3, g: 3, c: col[seme % 2]!, dur: 0.35, sx: 0.07 }); break;
    }
  };

  // ---------- scoppi delle bombe ----------
  const scoppio = (tipo: Scoppio, col: readonly string[], x: number, z: number, r: number, giro: boolean, seme: number): void => {
    const y = floorY + 0.15;
    switch (tipo) {
      case 'fungo': // Bomba di fuoco: lampo, colonna di fuoco che sale a scatti, onda a terra, braci e fumo che resta
        lampo(x, y + 0.5, z, r * 0.8, [col[0]!, col[1]!, PAL.sabbiaChiara], seme, 0.15);
        for (let i = 0; i < 4; i++) metti({ x, y: y + 0.2, z, vy: 2.2 + i * 0.6, c: col[i % 3]!, dur: 0.5, sx: 0.7 - i * 0.12, fine: 0.2 }, i * 0.04);
        anello(x, z, 0.3, r * 2, 14, col[1]!, 0.4, 0.3);
        raggiera(x, y, z, 12, r * 1.6, 4, col, 0.7, 0.16, 9, seme);
        for (let i = 0; i < 5; i++) metti({ x: x + (rnd(seme + i) - 0.5) * r, y: y + 0.4, z: z + (rnd(seme + i + 9) - 0.5) * r, vy: 0.7, c: i % 2 ? PAL.pietraScura : PAL.pietra, dur: 1.1, sx: 0.22, fine: 1.5 }, 0.15);
        break;
      case 'pop': // una brace della Pioggia: piccolo scoppio arancio
        lampo(x, y + 0.3, z, r * 0.7, [col[0]!, col[1]!], seme);
        raggiera(x, y, z, 7, r * 2, 3, col, 0.4, 0.12, 9, seme);
        anello(x, z, 0.2, r * 2.2, 8, col[2]!, 0.3, 0.18);
        break;
      case 'saette': // Bomba elettrica: lampo azzurro, saette che salgono dal bordo a zig-zag, anello azzurro, scintille a terra
        lampo(x, y + 0.5, z, r * 0.7, [PAL.sabbiaChiara, col[1]!], seme, 0.1);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + rnd(seme) * 0.5, bx = x + Math.cos(a) * r * 0.75, bz = z + Math.sin(a) * r * 0.75;
          for (let h = 0; h < 4; h++) metti({ x: bx + (rnd(seme + i * 4 + h) - 0.5) * 0.4, y: y + 0.3 + h * 0.45, z: bz + (rnd(seme + i * 7 + h) - 0.5) * 0.4, c: h % 2 ? col[1]! : col[0]!, dur: 0.3, sx: 0.09, sy: 0.5, sz: 0.09, fine: 0.5 }, h * 0.03 + i * 0.02);
        }
        anello(x, z, 0.3, r * 2.4, 16, col[1]!, 0.4, 0.22);
        raggiera(x, y, z, 10, r * 2.5, 1, col, 0.35, 0.06, 12, seme);
        break;
      case 'squarcio': // Squarcio del Vuoto: anello viola che si stringe, crepe nere a raggiera a terra, schegge risucchiate, poi un lampo rosa
        anello(x, z, r, -r * 2.2, 18, col[0]!, 0.42, 0.26);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + rnd(seme + i) * 0.4, l = r * (0.5 + 0.4 * rnd(seme + i * 3));
          metti({ x: x + Math.cos(a) * l * 0.5, y: floorY + 0.04, z: z + Math.sin(a) * l * 0.5, c: PAL.neroCaldo, dur: 0.9, sx: l, sy: 0.04, sz: 0.12, fine: 0.6, yaw: -a });
        }
        for (let i = 0; i < 10; i++) { const a = rnd(seme + i * 5) * TAU, d = r * (0.7 + 0.3 * rnd(seme + i)); metti({ x: x + Math.cos(a) * d, y: y + 0.2 + rnd(seme + i * 9) * 1.2, z: z + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.2, vz: -Math.sin(a) * d * 2.2, c: col[i % 3]!, dur: 0.42, sx: 0.12, fine: 0.3, giro: 6 }); }
        metti({ x, y: y + 0.4, z, c: col[2]!, dur: 0.15, sx: 0.8, fine: 0.1 }, 0.4);
        break;
      case 'vortice': // Valzer delle Lame: lame d'acqua che girano a spirale verso fuori (al secondo giro girano al contrario)
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU, w = giro ? -1 : 1;
          metti({ x: x + Math.cos(a) * 0.4, y: y + 0.3 + (i % 3) * 0.25, z: z + Math.sin(a) * 0.4, vx: (Math.cos(a) - w * Math.sin(a) * 1.4) * r * 1.4, vz: (Math.sin(a) + w * Math.cos(a) * 1.4) * r * 1.4, c: col[i % 2]!, dur: 0.45, sx: 0.5, sy: 0.04, sz: 0.12, fine: 0.4, yaw: -a + w * 1.2, giro: w * 10 });
        }
        anello(x, z, 0.3, r * 2, 12, col[2]!, 0.35, 0.15);
        raggiera(x, y, z, 8, 2, 3, [col[0]!, col[1]!], 0.4, 0.06, 9, seme);
        break;
      case 'croci': // Cura a bomba: lampo verde chiaro, anello, crocette che salgono piano
        lampo(x, y + 0.5, z, r * 0.6, [col[2]!, col[0]!], seme, 0.15);
        anello(x, z, 0.3, r * 1.8, 14, col[0]!, 0.45, 0.18);
        for (let i = 0; i < 7; i++) {
          const a = rnd(seme + i) * TAU, d = r * 0.8 * rnd(seme + i * 3), cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d, cy = y + 0.3;
          metti({ x: cx, y: cy, z: cz, vy: 1.1, c: col[i % 2]!, dur: 0.9, sx: 0.3, sy: 0.09, sz: 0.09, fine: 0.6 }, i * 0.05);
          metti({ x: cx, y: cy, z: cz, vy: 1.1, c: col[i % 2]!, dur: 0.9, sx: 0.09, sy: 0.3, sz: 0.09, fine: 0.6 }, i * 0.05);
        }
        break;
      case 'chevron': // Furia a bomba: lampo, punte di freccia che corrono verso fuori, una colonna rossa a scatti
        lampo(x, y + 0.5, z, r * 0.7, [col[3]!, col[1]!], seme);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU, v = r * 2.2;
          for (const lato of [-1, 1]) metti({ x: x + Math.cos(a) * 0.3, y: y + 0.15, z: z + Math.sin(a) * 0.3, vx: Math.cos(a) * v, vz: Math.sin(a) * v, c: col[i % 2]!, dur: 0.4, sx: 0.4, sy: 0.08, sz: 0.1, fine: 0.5, yaw: -a + lato * 0.6 + Math.PI });
        }
        for (let h = 0; h < 3; h++) metti({ x, y: y + 0.2, z, vy: 3, c: col[h % 2]!, dur: 0.35, sx: 0.35, fine: 0.2 }, h * 0.06);
        break;
    }
  };

  // ---------- evocazione ----------
  const evoca = (x: number, z: number, seme: number): void => {
    anello(x, z, 1.1, 0, 12, EVOCA[0]!, 0.9, 0.16);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; metti({ x: x + Math.cos(a) * 0.8, y: floorY + 0.12, z: z + Math.sin(a) * 0.8, c: EVOCA[1]!, dur: 0.9, sx: 0.2, sy: 0.06, sz: 0.2, fine: 0.8, giro: 6, yaw: a }); }
    for (let h = 0; h < 5; h++) metti({ x, y: floorY + 0.2, z, vy: 2.6, c: EVOCA[h % 3]!, dur: 0.6, sx: 0.5 - h * 0.06, fine: 0.1 }, 0.1 + h * 0.05);
    raggiera(x, floorY + 0.3, z, 8, 1.4, 2.5, EVOCA, 0.6, 0.08, 4, seme);
  };

  // ---------- ascolto della vista ----------
  type Volo = { x: number; y: number; z: number; vx: number; vz: number; m?: string; nemica: boolean; bomba: boolean; scia: number; colpito: number };
  const voli = new Map<number, Volo>();
  const suono = (f: Famiglia, k = 0): void => suona(`mg_${f}`, k);
  let seme = 1;
  return {
    tick(v) {
      const now = ora(), visti = new Set<number>();
      for (const p of v.proiettili) {
        if (p.tipo !== 'magia' && p.tipo !== 'magia_nemica') continue;
        if (p.tipo === 'magia' && !p.m) continue; // senza id (non dovrebbe capitare nel dungeon): niente
        visti.add(p.id);
        let o = voli.get(p.id);
        if (!o) { o = { x: p.x, y: p.y, z: p.z, vx: p.vx, vz: p.vz, ...(p.m ? { m: p.m } : {}), nemica: p.tipo === 'magia_nemica', bomba: !!p.bomba, scia: 0, colpito: -9 }; voli.set(p.id, o); }
        o.x = p.x; o.y = p.y; o.z = p.z; o.vx = p.vx; o.vz = p.vz;
        const st = stile(o.m);
        const vicino = (p.x - v.hero.x) ** 2 + (p.z - v.hero.z) ** 2 < 2.6; // a un passo dagli occhi la scia coprirebbe la vista
        if (st?.scia && !vicino && now - o.scia > 0.035) { o.scia = now; scia(st.scia, st.col, p.x, floorY + p.y, p.z, seme++); }
      }
      // un fulmine che attraversa: scintille dove prende ogni nemico (il colpo arriva col suo evento)
      for (const e of v.eventi) {
        if (e.t !== 'colpo' || e.su !== 'nemico') continue;
        for (const o of voli.values()) {
          const st = stile(o.m);
          if (!st?.impatto || o.bomba || (o.x - e.x) ** 2 + (o.z - e.z) ** 2 > 1.6) continue;
          impatto(st.impatto, st.col, o.x, floorY + o.y, o.z, seme++); o.colpito = now; suono(st.suono);
        }
      }
      for (const [id, o] of voli) {
        if (visti.has(id)) continue;
        voli.delete(id);
        if (o.bomba || now - o.colpito < 0.15) continue; // le bombe le disegna lo scoppio; chi ha appena colpito ha già il suo
        const x = o.x + o.vx / 120, z = o.z + o.vz / 120, y = floorY + Math.max(0.1, o.y);
        if (o.nemica) { raggiera(x, y, z, 7, 2.2, 1.5, [PAL.viola, PAL.rosaNeon, PAL.sabbiaChiara], 0.32, 0.1, 6, seme++); lampo(x, y, z, 0.6, [PAL.rosaNeon, PAL.viola], seme++); continue; }
        const st = stile(o.m);
        if (st?.impatto) { impatto(st.impatto, st.col, x, y, z, seme++); suono(st.suono); }
      }
      for (const e of v.eventi) {
        if (e.t === 'scoppio') {
          const st = stile(e.m);
          if (st?.scoppio) { scoppio(st.scoppio, st.col, e.x, e.z, Math.max(0.8, e.r), !!e.giro, seme++); suono(st.suono, st.scoppio === 'pop' ? 0 : 1); }
        } else if (e.t === 'evocato') {
          const n = v.nemici.find((x) => x.id === e.id);
          if (n) { evoca(n.x, n.z, seme++); suono('evoca'); }
        }
      }
    },
    update() {
      const now = ora();
      let n = 0;
      for (let i = pezzi.length - 1; i >= 0; i--) {
        const p = pezzi[i]!, a = (now - p.t0) / p.dur;
        if (a >= 1) { pezzi.splice(i, 1); continue; }
        if (a < 0) continue; // ancora in ritardo
        const t = Math.floor((now - p.t0) * FPS) / FPS, k = 1 + (p.fine - 1) * scatti(a, 4);
        p3.set(p.x + p.vx * t, Math.max(floorY + 0.02, p.y + p.vy * t - 0.5 * p.g * t * t), p.z + p.vz * t);
        q.setFromEuler(e3.set(p.giro * t, p.yaw + p.giro * t * 0.7, 0));
        m4.compose(p3, q, s3.set(p.sx * k, p.sy * k, p.sz * k));
        mesh.setMatrixAt(n, m4); mesh.setColorAt(n, p.c); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    counts: () => ({ pezzi: pezzi.length }),
    dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); },
  };
}
