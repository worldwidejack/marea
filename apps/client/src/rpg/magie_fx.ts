// Effetti delle magie di fuoco ed elettricità nel dungeon (docs/RPG.md §Magie), tutti a scatti e in colori di palette, senza luci:
// - Fuoco continuo: una fiamma davanti alle mani, a lingue che tremano e si allargano verso la punta (lunga quanto `hero.canale.len`, già
//   accorciata dal primo muro). Elettricità continua: un raggio a zig-zag giallo con il cuore azzurro, che si ridisegna 15 volte al secondo.
// - Bombe: a terra, dove atterreranno, un cerchio col raggio dello scoppio che si riempie mentre la bomba arriva; allo scoppio un'onda,
//   un lampo e qualche pezzo che schizza (rosso/arancio/giallo il fuoco, giallo/azzurro l'elettricità).
// - Ombra di mira: mentre punti una bomba, a terra dove atterrerebbe, un disco scuro col raggio dello scoppio (solo nella tua scena: gli altri non la vedono).
// Vale per l'eroe di questo client e per i compagni (`compagni[].canale`). Prima persona: il tuo raggio parte dalla punta della bacchetta e va
// dove guardi, anche in alto e in basso (la sim lo accorcia a pavimento, soffitto e muri), e finisce sul primo nemico che prende, con le
// scintille dove tocca; quello dei compagni sale e scende col loro alzo.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { MAGIA_Y } from '@marea/sim/dungeon/tuning.ts';
import { OCCHI_Y } from '@marea/sim/dungeon/alzo.ts';
import { PAL } from '../ui/style.ts';

export type MagieFx = {
  tick(v: DungeonView): void;
  update(t: number, hero: { x: number; z: number }, v: DungeonView): void;
  /** L'ombra di mira della bomba che stai puntando (null = nessuna): dove atterra, raggio dello scoppio, elemento. */
  ombra(p: { x: number; z: number; r: number; el?: El } | null): void;
  counts(): { raggi: number; bombe: number; scoppi: number };
  dispose(): void;
};

type El = 'fuoco' | 'elettricita' | 'cura' | 'furia' | undefined;
const COL: Record<'fuoco' | 'elettricita' | 'cura' | 'furia', readonly string[]> = {
  fuoco: [PAL.arancio, PAL.giallo, PAL.rosso, PAL.arancio],
  elettricita: [PAL.giallo, PAL.acquaBassa, PAL.giallo, PAL.sabbiaChiara],
  cura: [PAL.erba, PAL.erbaChiara, PAL.acquaBassa, PAL.erba],
  furia: [PAL.arancio, PAL.rosaNeon, PAL.giallo, PAL.rosso],
};
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
/** Numero «casuale» stabile (0..1) per un intero: il tremolio si ridisegna a scatti, non a ogni frame. */
const rnd = (n: number): number => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

const SEG_FUOCO = 11, SEG_ELETTRO = 9, SEG_FP = 20;
/** Prima persona: giri al secondo dei pezzi lungo il flusso, grandezza vista (m per metro di distanza) vicino alla mano e in fondo, distanza della mano dagli occhi. */
const FP = { giri: 1.1, a0: 0.018, a1: 0.085, lato: 1.1, d0: 0.6 };
/** Da 0..1 sullo schermo a 0..1 nel mondo: i pezzi sono equidistanti come si vedono, non come stanno (la prospettiva li ammasserebbe in fondo). */
const inMondo = (s: number, d1: number): number => { const d = 1 / (1 / FP.d0 + (1 / d1 - 1 / FP.d0) * s); return (d - FP.d0) / (d1 - FP.d0); };
const SCALA_FP: Record<'fuoco' | 'cura' | 'furia', readonly string[]> = { fuoco: [PAL.sabbiaChiara, PAL.giallo, PAL.arancio, PAL.rosso], cura: [PAL.sabbiaChiara, PAL.erbaChiara, PAL.erba, PAL.acquaBassa], furia: [PAL.giallo, PAL.arancio, PAL.rosso, PAL.rosaNeon] };

/** Prima persona: `origine` = dove sta in mondo la punta della bacchetta (il tuo raggio parte da lì e scorre verso il bersaglio), `sguardo` =
 *  la direzione degli occhi (il raggio va di lì). */
export function createMagieFx(scene: THREE.Scene, floorY: number, o: { origine?: () => THREE.Vector3; sguardo?: () => THREE.Vector3 } = {}): MagieFx {
  const root = new THREE.Group(); root.name = 'magie_fx'; scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map<string, THREE.MeshBasicMaterial>();
  const mat = (c: string, opacity = 1): THREE.MeshBasicMaterial => {
    const k = c + opacity; let m = mats.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }); mats.set(k, m); }
    return m;
  };

  // ---- raggi: uno per eroe in gioco (indice = `io` per te, 100 + i per i compagni), riusati
  type Raggio = { g: THREE.Group; segs: THREE.Mesh[]; glow: THREE.Mesh; colpo: THREE.Mesh[] };
  const raggi = new Map<number, Raggio>();
  const raggio = (k: number): Raggio => {
    let r = raggi.get(k);
    if (!r) {
      const g = new THREE.Group(); g.visible = false; root.add(g);
      const segs: THREE.Mesh[] = [];
      for (let i = 0; i < Math.max(SEG_FUOCO, SEG_ELETTRO, o.origine ? SEG_FP : 0); i++) { const m = new THREE.Mesh(box, mat(PAL.arancio)); m.renderOrder = 3; g.add(m); segs.push(m); }
      const glow = new THREE.Mesh(box, mat(PAL.giallo, 0.35)); glow.renderOrder = 2; g.add(glow);
      const colpo = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(box, mat(PAL.giallo)); m.renderOrder = 3; m.visible = false; g.add(m); return m; });
      r = { g, segs, glow, colpo }; raggi.set(k, r);
    }
    return r;
  };
  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
  /** Un pezzo di raggio tra due punti (spessore w): scatola scalata e girata lungo il segmento. */
  const tratto = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, w: number, h: number): void => {
    const len = a.distanceTo(b);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(w, h, Math.max(0.01, len));
    m.lookAt(b);
  };
  const disegna = (r: Raggio, x: number, z: number, fx: number, fz: number, len0: number, el: El, t: number, seed: number, n = 0): void => {
    const e = el ?? 'fuoco', col = COL[e], fase = Math.floor(t * (e === 'fuoco' ? 14 : 15)) + seed * 31, cn = Math.sqrt(Math.max(0, 1 - n * n)), len = len0 * cn;
    const y = floorY + MAGIA_Y - 0.05, x0 = x + fx * 0.45, z0 = z + fz * 0.45, sale = cn > 1e-3 ? n / cn : 0; // un compagno in prima persona: il raggio sale o scende col suo alzo
    const L = Math.max(0.3, len - 0.45);
    r.g.visible = true;
    if (e === 'fuoco' || e === 'cura' || e === 'furia') {
      // fiamma/flusso a pezzi: cubi che si ingrossano verso la punta, sfalsati di lato e in alto a ogni scatto, colori a rotazione
      for (let i = 0; i < r.segs.length; i++) {
        const m = r.segs[i]!;
        if (i >= SEG_FUOCO) { m.visible = false; continue; }
        const k = (i + 0.5) / SEG_FUOCO, w = (0.16 + 0.42 * k) * (0.7 + 0.3 * rnd(fase + i));
        const j = (rnd(fase * 3 + i) - 0.5) * 0.7 * k, jy = (rnd(fase * 5 + i) - 0.5) * 0.35 * k;
        m.visible = true; m.material = mat(col[(i + fase) % col.length]!);
        m.position.set(x0 + fx * L * k - fz * j, y + jy + 0.08 * k + sale * L * k, z0 + fz * L * k + fx * j);
        m.scale.setScalar(w); m.rotation.set(rnd(fase + i * 7) * 3, rnd(fase + i * 11) * 3, 0);
      }
      r.glow.visible = false;
    } else {
      // zig-zag elettrico: punti spezzati di lato e in altezza, si ridisegnano a scatti
      let px = x0, pz = z0, py = y;
      for (let i = 0; i < r.segs.length; i++) {
        const m = r.segs[i]!;
        if (i >= SEG_ELETTRO) { m.visible = false; continue; }
        const k1 = (i + 1) / SEG_ELETTRO, j = (rnd(fase * 7 + i) - 0.5) * 0.7 * (i === SEG_ELETTRO - 1 ? 0 : 1), jy = (rnd(fase * 11 + i) - 0.5) * 0.4 * (i === SEG_ELETTRO - 1 ? 0 : 1);
        const nx = x0 + fx * L * k1 - fz * j, nz = z0 + fz * L * k1 + fx * j, ny = y + jy + sale * L * k1;
        a3.set(px, py, pz); b3.set(nx, ny, nz);
        m.visible = true; m.material = mat(i % 2 ? PAL.acquaBassa : PAL.giallo);
        tratto(m, a3, b3, 0.12, 0.12);
        px = nx; pz = nz; py = ny;
      }
      r.glow.visible = true; r.glow.material = mat(PAL.acquaBassa, 0.16);
      a3.set(x0, y, z0); b3.set(x0 + fx * L, y + sale * L, z0 + fz * L); tratto(r.glow, a3, b3, 0.4, 0.4);
    }
  };

  /** Prima persona: il tuo raggio visto dagli occhi. Dalla punta della bacchetta al bersaglio, sottile vicino e largo in fondo: i pezzi scorrono via
   *  dalla mano, così si legge come un flusso e non copre la vista. */
  const disegnaFp = (r: Raggio, da: THREE.Vector3, x: number, z: number, fx: number, fz: number, len: number, el: El, t: number): void => {
    const e = el ?? 'fuoco', occhi = o.sguardo?.(), sc = Math.floor(t * 30);
    // dagli occhi lungo lo sguardo per `len` m (la sim l'ha già fermato a muri, pavimento, soffitto o sul primo nemico): lì finisce
    const fine = occhi ? b3.set(x + occhi.x * len, floorY + OCCHI_Y + occhi.y * len, z + occhi.z * len) : b3.set(x + fx * len, floorY + MAGIA_Y, z + fz * len);
    const dx = fine.x - da.x, dy = fine.y - da.y, dz = fine.z - da.z, d1 = Math.max(FP.d0 + 0.5, Math.sqrt(dx * dx + dy * dy + dz * dz) + FP.d0);
    r.g.visible = true; r.glow.visible = false;
    // dove tocca: scintille (elettricità) o lingue di fuoco che schizzano, ridisegnate a scatti
    const cc = COL[e], lon = Math.min(1, Math.max(0.15, (d1 - FP.d0) / 4)); // da vicino le scintille si stringono: non devono coprire la vista
    r.colpo.forEach((m, i) => {
      const f = Math.floor(t * 16) + i * 7, gx = (rnd(f) - 0.5) * 0.5 * lon, gy = rnd(f + 3) * 0.45 * lon, gz = (rnd(f + 5) - 0.5) * 0.5 * lon;
      m.visible = true; m.material = mat(cc[(i + f) % cc.length]!); m.position.set(fine.x + gx, fine.y + gy - 0.1 * lon, fine.z + gz); m.scale.setScalar((0.06 + rnd(f + 9) * 0.08) * lon); m.rotation.set(f, f * 0.7, 0);
    });
    if (e === 'elettricita') {
      let px = da.x, py = da.y, pz = da.z;
      const fase = Math.floor(t * 15), nx = -fz, nz = fx;
      for (let i = 0; i < r.segs.length; i++) {
        const m = r.segs[i]!;
        if (i >= SEG_ELETTRO) { m.visible = false; continue; }
        const s = (i + 1) / SEG_ELETTRO, k = inMondo(s, d1), dist = FP.d0 + (d1 - FP.d0) * k, ult = i === SEG_ELETTRO - 1 ? 0 : 1, j = (rnd(fase * 7 + i) - 0.5) * 0.09 * dist * ult, jy = (rnd(fase * 11 + i) - 0.5) * 0.09 * dist * ult;
        const qx = da.x + dx * k + nx * j, qy = da.y + dy * k + jy, qz = da.z + dz * k + nz * j, w = 0.012 * dist;
        a3.set(px, py, pz); m.visible = true; m.material = mat(i % 2 ? PAL.acquaBassa : PAL.giallo);
        tratto(m, a3, new THREE.Vector3(qx, qy, qz), w, w);
        m.renderOrder = 3; px = qx; py = qy; pz = qz;
      }
      return;
    }
    const sca = SCALA_FP[e];
    for (let i = 0; i < r.segs.length; i++) {
      const m = r.segs[i]!;
      if (i >= SEG_FP) { m.visible = false; continue; }
      const s = (i / SEG_FP + (sc / 30) * FP.giri) % 1, k = inMondo(s, d1), dist = FP.d0 + (d1 - FP.d0) * k, a = FP.a0 + (FP.a1 - FP.a0) * s, c = Math.floor(s * sca.length);
      const lato = (rnd(i * 3 + 1) - 0.5) * FP.lato * a * dist, su = (rnd(i * 5 + 2) - 0.5) * FP.lato * a * dist;
      m.visible = true; m.material = mat(sca[Math.min(sca.length - 1, c)]!);
      m.position.set(da.x + dx * k - fz * lato, da.y + dy * k + su, da.z + dz * k + fx * lato);
      m.scale.setScalar(a * dist * Math.min(1, (1 - s) * 6) * (0.75 + 0.25 * rnd(i + Math.floor(sc / 3))));
      m.rotation.set(rnd(i + 7) * 3 + s * 4, rnd(i + 11) * 3, 0);
    }
  };

  // ---- bombe: cerchio d'atterraggio per ogni bomba in volo
  const ringGeo = new THREE.RingGeometry(0.9, 1, 24, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 24); discGeo.rotateX(-Math.PI / 2);
  type Bomba = { g: THREE.Group; disco: THREE.Mesh; anello: THREE.Mesh; d0: number; vista: number };
  const bombe = new Map<number, Bomba>();

  // ---- ombra di mira: disco scuro con l'anello del colore della magia, dove atterrerebbe la bomba puntata
  const ombraG = new THREE.Group(); ombraG.visible = false; root.add(ombraG);
  const ombraDisco = new THREE.Mesh(discGeo, mat(PAL.neroCaldo, 0.45)), ombraAnello = new THREE.Mesh(ringGeo, mat(PAL.arancio, 0.9));
  ombraDisco.renderOrder = 1; ombraAnello.renderOrder = 2; ombraG.add(ombraDisco, ombraAnello);

  // ---- scoppi: onda, lampo e pezzi che schizzano (riusati, al massimo SCOPPI_MAX)
  type Scoppio = { g: THREE.Group; onda: THREE.Mesh; lampo: THREE.Mesh; pezzi: THREE.Mesh[]; dir: number[]; t0: number; r: number; el: El; viva: boolean };
  const scoppi: Scoppio[] = [];
  const SCOPPI_MAX = 6, DUR = 0.55, PEZZI = 8;
  const nuovoScoppio = (): Scoppio => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const onda = new THREE.Mesh(ringGeo, mat(PAL.arancio, 0.9)); onda.renderOrder = 3; g.add(onda);
    const lampo = new THREE.Mesh(discGeo, mat(PAL.giallo, 0.5)); lampo.renderOrder = 2; g.add(lampo);
    const pezzi: THREE.Mesh[] = [];
    for (let i = 0; i < PEZZI; i++) { const p = new THREE.Mesh(box, mat(PAL.arancio)); p.scale.setScalar(0.22); g.add(p); pezzi.push(p); }
    return { g, onda, lampo, pezzi, dir: Array.from({ length: PEZZI }, (_, i) => rnd(i + 1) * 6.283), t0: -9, r: 1, el: undefined, viva: false };
  };

  let nRaggi = 0;
  return {
    tick(v) {
      const now = performance.now() / 1000;
      for (const e of v.eventi) {
        if (e.t !== 'scoppio') continue; // gli scoppi si vedono tutti, anche quelli dei compagni
        let s = scoppi.find((x) => !x.viva) ?? (scoppi.length < SCOPPI_MAX ? undefined : scoppi.reduce((a, b) => (a.t0 < b.t0 ? a : b)));
        if (!s) { s = nuovoScoppio(); scoppi.push(s); }
        s.t0 = now; s.r = Math.max(0.8, e.r); s.el = e.el; s.viva = true;
        s.g.position.set(e.x, floorY + 0.08, e.z);
        const col = COL[e.el ?? 'fuoco'];
        s.onda.material = mat(col[0]!, 0.9); s.lampo.material = mat(e.el === 'elettricita' ? PAL.acquaBassa : e.el === 'cura' ? PAL.erbaChiara : PAL.arancio, 0.5);
        s.pezzi.forEach((p, i) => { p.material = mat(col[(i + 2) % col.length]!); });
      }
    },
    update(t, hero, v) {
      const now = performance.now() / 1000;
      // raggi: il tuo e quelli dei compagni
      nRaggi = 0;
      const usati = new Set<number>();
      const accendi = (k: number, x: number, z: number, fx: number, fz: number, c: { len: number; el?: El; fin?: number; n?: number } | undefined): void => {
        if (!c) return;
        usati.add(k); nRaggi++;
        if (k === 0 && o.origine) disegnaFp(raggio(k), o.origine(), x, z, fx, fz, c.fin ?? c.len, c.el, t); else { disegna(raggio(k), x, z, fx, fz, c.fin ?? c.len, c.el, t, k, c.n ?? 0); for (const m of raggio(k).colpo) m.visible = false; }
      };
      accendi(0, hero.x, hero.z, v.hero.fx, v.hero.fz, v.hero.canale);
      for (const c of v.compagni) accendi(100 + c.i, c.x, c.z, c.fx, c.fz, c.canale);
      for (const [k, r] of raggi) if (!usati.has(k)) r.g.visible = false;
      // bombe in volo: il cerchio dove atterreranno si riempie a gradini
      const vive = new Set<number>();
      for (const p of v.proiettili) {
        if (!p.bomba) continue;
        vive.add(p.id);
        let b = bombe.get(p.id);
        const [tx, tz] = p.bomba, r = p.r ?? 2;
        if (!b) {
          const g = new THREE.Group(); root.add(g);
          const anello = new THREE.Mesh(ringGeo, mat(PAL.rosso, 0.85)), disco = new THREE.Mesh(discGeo, mat(PAL.rosso, 0.28));
          anello.renderOrder = disco.renderOrder = 2; g.add(anello, disco);
          b = { g, disco, anello, d0: Math.max(0.5, Math.hypot(tx - p.x, tz - p.z)), vista: now }; bombe.set(p.id, b);
          const col = COL[p.el ?? 'fuoco'];
          anello.material = mat(col[0]!, 0.85); disco.material = mat(col[1]!, 0.28);
        }
        const dist = Math.hypot(tx - p.x, tz - p.z), k = 1 - dist / b.d0;
        b.g.position.set(tx, floorY + 0.06, tz);
        b.anello.scale.setScalar(r);
        b.disco.scale.setScalar(Math.max(0.05, r * steps(k, 5)));
        b.anello.visible = Math.floor(now * 6) % 2 === 0 || k > 0.6; // lampeggia piano, poi fisso
      }
      for (const [id, b] of bombe) if (!vive.has(id)) { b.g.removeFromParent(); bombe.delete(id); }
      // scoppi
      for (const s of scoppi) {
        if (!s.viva) continue;
        const a = (now - s.t0) / DUR;
        if (a >= 1) { s.viva = false; s.g.visible = false; continue; }
        s.g.visible = true;
        const k = steps(a, 5);
        s.onda.scale.setScalar(s.r * (0.3 + 0.7 * k)); (s.onda.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
        s.lampo.scale.setScalar(s.r * (0.2 + 0.6 * k)); s.lampo.visible = a < 0.5;
        s.pezzi.forEach((p, i) => {
          const d = s.r * 0.9 * k, ang = s.dir[i]!;
          p.position.set(Math.cos(ang) * d, 0.2 + 1.4 * Math.sin(Math.PI * Math.min(1, k)) * (0.5 + 0.5 * rnd(i + 9)), Math.sin(ang) * d);
          p.scale.setScalar(0.24 * (1 - k * 0.7)); p.rotation.set(k * 5 + i, k * 4, 0);
        });
      }
    },
    ombra(p) {
      ombraG.visible = !!p;
      if (!p) return;
      ombraG.position.set(p.x, floorY + 0.05, p.z);
      ombraG.scale.setScalar(Math.max(0.5, p.r));
      ombraAnello.material = mat(COL[p.el ?? 'fuoco'][0]!, 0.9);
    },
    counts: () => ({ raggi: nRaggi, bombe: bombe.size, scoppi: scoppi.filter((s) => s.viva).length }),
    dispose() { root.removeFromParent(); box.dispose(); ringGeo.dispose(); discGeo.dispose(); for (const m of mats.values()) m.dispose(); },
  };
}
