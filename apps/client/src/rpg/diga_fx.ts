// La Diga dei Disertori (docs/RPG.md §2g): gli effetti della scena. Le Ruote di Sentina (gemma rossa da girare, la ruota gira a scatti,
// poi verde), la risacca (strisce di schiuma a terra nel verso della corrente: umide nella calma, ribollono nell'avviso, corrono nella
// raffica; asciutte quando la ruota la ferma), i rottami acuminati, il ponte mobile (alzato in verticale, scende a scatti quando giri la
// sua ruota), i piloni dell'arena (interi, poi moncone e tavole sparse), le corsie dei colpi dritti (rettangolo rosso che si riempie: la
// schiacciata della Guardia, l'affondo del Capitano; la carica è una freccia larga che lampeggia gialla quando non ti segue più), la linea
// di mira del Fuciliere (rossa che ti segue, gialla e a scatti quando si blocca), i barili dell'Albatros (cerchio rosso che pulsa e si
// riempie dal centro, il barile che cade) e le cannonate della salva (cerchio arancio, la palla che cade), lo scudo giallo della salva, la
// catena gialla sulla schiena del Capitano chino sulla lancia, il fuoco fatuo azzurro sulla vela nell'Ultima Marea, e oltre la murata
// distrutta del Ponte di Comando il mare calmo all'alba. Tutto a scatti, colori di palette; i modelli veri (dng_diga_ruota, dng_diga_pilone,
// dng_diga_ponte) vincono sui segnaposto di diga.ts.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, merged, painted, px } from '../render/island_parts.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { cellHash, object } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { colori, monconeObj, piloneObj, ponteObj, rottamiGeo, ruotaBaseObj, ruotaObj } from './diga.ts';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const MAXC = 8, MAXL = 10, MAXB = 12;

export type DigaFx = {
  tick(v: DungeonView): void;
  update(t: number, hero: { x: number; z: number }, v: DungeonView, gioco: boolean): void;
  counts(): { ruote: number; girate: number; piloni: number; rotti: number; rottami: number; schiuma: number; corsie: number; linee: number; fisse: number; barili: number; cannonate: number; ponte: number; scudo: boolean; catena: boolean; fatuo: boolean; mare: boolean };
  dispose(): void;
};

/** Schiuma della risacca lungo +X: tre strisce bianche e azzurre con le creste, piatte a terra. */
function schiumaGeo(): THREE.BufferGeometry {
  return merged([
    painted(box(1.5, 0.04, 0.12), PAL.sabbiaChiara, M(-0.1, 0.03, -0.55)), painted(box(1.1, 0.04, 0.1), PAL.acquaBassa, M(0.2, 0.03, 0)),
    painted(box(1.3, 0.04, 0.12), PAL.sabbiaChiara, M(0, 0.03, 0.55)),
    ...[[-0.8, -0.55], [0.75, 0], [0.65, 0.55]].map(([x, z]) => painted(box(0.18, 0.16, 0.2), PAL.sabbiaChiara, M(x!, 0.08, z!))), // creste
  ]);
}

export function createDigaFx(o: { sc: DungeonScene; loader: Loader; say(text: string, ms: number): void; occupato(): boolean }): DigaFx {
  const root = new THREE.Group(); root.name = 'diga_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY, map = o.sc.map, T = map.tile, def = o.sc.def;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0);
  const VERSO = -Math.PI * 0.75; // la faccia −Z guarda la camera (sud-est), come gli ingressi

  // ruote: le valvole (prosciugano, abbassano il ponte) e i timoni (fermano la risacca) della Diga sono tutte Ruote di Sentina
  const ruote = [...map.valvole.map((v) => ({ ...v, tim: false })), ...map.timoni.map((t) => ({ ...t, tim: true }))].map((r) => {
    const holder = new THREE.Group(); holder.position.set(r.x, fy, r.z); holder.rotation.y = VERSO; root.add(holder);
    void object(o.loader, 'dng_diga_ruota', ruotaBaseObj).then((g) => holder.add(g));
    const w = ruotaObj(); holder.add(w.ruota);
    return { holder, ruota: w.ruota, gemma: w.gemma, n: r.n, tim: r.tim, fatto: false, girata: -1 };
  });
  // piloni: interi (modello o segnaposto) e moncone
  const piloni = map.piloni.map((p) => {
    const holder = new THREE.Group(); holder.position.set(p.x, fy, p.z); holder.rotation.y = cellHash(p.cx, p.cz, 5) * 6; root.add(holder);
    const intero = new THREE.Group(); holder.add(intero);
    void object(o.loader, 'dng_diga_pilone', piloneObj).then((g) => intero.add(g));
    const moncone = monconeObj(); moncone.visible = false; holder.add(moncone);
    return { holder, intero, moncone, rotto: false, t0: -1 };
  });
  // rottami: uno per cella, girati a caso
  const celleR: number[] = [];
  for (let i = 0; i < map.rottami.length; i++) if (map.rottami[i]) celleR.push(i);
  const rGeo = rottamiGeo();
  const rottami = new THREE.InstancedMesh(rGeo, colori('rottami'), Math.max(1, celleR.length)); rottami.name = 'rottami'; rottami.frustumCulled = false; root.add(rottami);
  o.sc.ritocca(rottami);
  let rottamiVisti = -1;
  // risacca: schiuma per cella, una InstancedMesh per corrente
  const sGeo = schiumaGeo();
  const schiume = map.venti.map((v) => {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
    const im = new THREE.InstancedMesh(sGeo, mat, v.celle.length); im.name = 'risacca_' + v.n; im.frustumCulled = false; im.renderOrder = 1; root.add(im);
    return { v, im, mat, yaw: Math.atan2(-v.dz, v.dx), chiave: '' };
  });
  // il ponte mobile: il bacino `ponte`, incernierato dalla parte della sua ruota
  const ponteN = Object.values(def.legenda).find((l) => l.ponte !== undefined)?.ponte;
  const ponte = (() => {
    const b = ponteN !== undefined ? map.bacini.find((x) => x.n === ponteN) : undefined, r = ponteN !== undefined ? map.valvole.find((x) => x.n === ponteN) : undefined;
    if (!b || !r) return null;
    const xs = b.celle.map((i) => i % map.w), zs = b.celle.map((i) => Math.floor(i / map.w));
    const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, z0 = Math.min(...zs) * T, z1 = (Math.max(...zs) + 1) * T;
    const est = r.x > (x0 + x1) / 2, lungo = x1 - x0, largo = z1 - z0;
    const holder = new THREE.Group(); holder.position.set(est ? x1 : x0, fy + 0.02, (z0 + z1) / 2); holder.rotation.y = est ? 0 : Math.PI; root.add(holder);
    const tavolato = new THREE.Group(); holder.add(tavolato);
    void object(o.loader, 'dng_diga_ponte', () => ponteObj(lungo, largo)).then((g) => tavolato.add(g));
    o.sc.ritocca(holder);
    return { holder, tavolato, n: ponteN };
  })();
  // corsie (rettangolo che si riempie) e freccia della carica; linee del Fuciliere
  const piano = new THREE.PlaneGeometry(1, 1); piano.rotateX(-Math.PI / 2); piano.translate(0.5, 0, 0); // da 0 a 1 lungo +X
  const punta = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, -1), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)])); punta.rotateX(-Math.PI / 2);
  const corsie = Array.from({ length: MAXC }, () => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const fondo = new THREE.Mesh(piano, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.25, depthWrite: false }));
    const pieno = new THREE.Mesh(piano, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.45, depthWrite: false }));
    const bordo = new THREE.Mesh(piano, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.9, depthWrite: false }));
    const freccia = new THREE.Mesh(punta, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.7, depthWrite: false }));
    for (const m of [fondo, pieno, bordo, freccia]) { m.renderOrder = 1; g.add(m); }
    return { g, fondo, pieno, bordo, freccia };
  });
  const linee = Array.from({ length: MAXL }, () => {
    const m = new THREE.Mesh(box(1, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.85, depthWrite: false }));
    m.geometry.translate(0.5, 0, 0); m.visible = false; m.renderOrder = 2; root.add(m);
    return m;
  });
  // barili e cannonate: cerchio, disco che si riempie dal centro, quello che cade, lo scoppio
  const ringGeo = new THREE.RingGeometry(0.9, 1, 18, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 18); discGeo.rotateX(-Math.PI / 2);
  const bariloGeo = merged([painted(new THREE.CylinderGeometry(0.24, 0.24, 0.42, 8), PAL.rosso), painted(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 8), PAL.legnoScuro, M(0, 0.13, 0)), painted(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 8), PAL.legnoScuro, M(0, -0.13, 0))]);
  const pallaGeo = merged([painted(new THREE.IcosahedronGeometry(0.28, 1), PAL.neroCaldo), painted(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4), PAL.sabbiaChiara, M(0, 0.45, 0))]);
  const scoppioGeo = merged([painted(new THREE.IcosahedronGeometry(1, 0), PAL.arancio), painted(new THREE.IcosahedronGeometry(0.65, 0), PAL.giallo, M(0, 0.15, 0)), painted(new THREE.IcosahedronGeometry(0.5, 0), PAL.pietraScura, M(0.4, 0.4, 0))]);
  const scoppioMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
  const bombe = new Map<number, { g: THREE.Group; ring: THREE.Mesh; disc: THREE.Mesh; cade: THREE.Mesh; scoppio: THREE.Mesh; cannone: boolean }>();
  // il Capitano: lo scudo della salva, la catena sulla schiena, il fuoco fatuo sulla vela
  const scudo = new THREE.Mesh(merged([
    painted(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 10, 1, true, -0.8, 1.6), PAL.giallo),
    ...[-0.8, 0, 0.8].map((a) => painted(box(0.1, 2.7, 0.1), PAL.sabbiaChiara, M(Math.sin(a) * 1.72, 0, Math.cos(a) * 1.72))), // le costole dello scudo
    painted(new THREE.TorusGeometry(1.72, 0.06, 3, 12, 1.6), PAL.sabbiaChiara, M(0, 1.3, 0, Math.PI / 2, 0, Math.PI / 2 - 0.8)),
  ]), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  scudo.visible = false; scudo.renderOrder = 3; root.add(scudo);
  const catena = new THREE.Mesh(merged([0, 1, 2, 3].map((k) => painted(new THREE.TorusGeometry(0.18, 0.05, 4, 8), PAL.giallo, M(0, 1.6 + k * 0.28, 0, 0, k % 2 ? Math.PI / 2 : 0, 0)))),
    new THREE.MeshBasicMaterial({ vertexColors: true }));
  catena.visible = false; catena.renderOrder = 3; root.add(catena);
  const fatuo = new THREE.Mesh(merged([painted(new THREE.ConeGeometry(0.3, 0.9, 5), PAL.acquaBassa), painted(new THREE.ConeGeometry(0.18, 0.6, 5), PAL.sabbiaChiara, M(0.15, 0.1, 0.1)), painted(new THREE.ConeGeometry(0.2, 0.55, 5), PAL.acqua, M(-0.18, -0.05, -0.1))]),
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  fatuo.visible = false; fatuo.renderOrder = 3; root.add(fatuo);
  // il mare oltre la murata distrutta del Ponte di Comando: le celle vuote dell'arena, e il sole che sorge
  const vuote: number[] = [];
  for (let cz = 0; cz < map.h; cz++) for (let cx = 0; cx < map.w; cx++) if (def.rows[cz]?.[cx] === ' ') vuote.push(cz * map.w + cx);
  const mare = (() => {
    if (!vuote.length) return null;
    const xs = vuote.map((i) => i % map.w), zs = vuote.map((i) => Math.floor(i / map.w));
    const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, z1 = (Math.max(...zs) + 1) * T;
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d')!;
    px(g, PAL.acquaProfonda, 0, 0, 16, 16);
    for (const [x, y, w] of [[1, 2, 5], [9, 4, 4], [4, 8, 6], [12, 11, 3], [0, 13, 4], [7, 14, 5]] as const) px(g, PAL.acqua, x, y, w, 1);
    for (const [x, y] of [[3, 5], [13, 1], [10, 9]] as const) px(g, PAL.arancio, x, y, 2, 1); // il sole che sorge sull'acqua
    px(g, PAL.giallo, 6, 11, 1, 1);
    const tx = new THREE.CanvasTexture(c); tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false; tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(8, 6);
    const w = x1 - x0 + 40, h = 40;
    const geo = new THREE.PlaneGeometry(w, h); geo.rotateX(-Math.PI / 2);
    const acqua = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tx })); acqua.position.set((x0 + x1) / 2, fy - 1.2, z1 - h / 2); acqua.name = 'mare';
    const sole = new THREE.Mesh(new THREE.CircleGeometry(5, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: PAL.arancio }));
    sole.position.set((x0 + x1) / 2 + 6, fy - 1.1, z1 - h + 2); sole.name = 'sole';
    const alone = new THREE.Mesh(new THREE.CircleGeometry(7.5, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.35 }));
    alone.position.copy(sole.position).add(new THREE.Vector3(0, -0.05, -0.1));
    // i resti della murata: monconi di legno sul bordo
    const murata = new THREE.Mesh(merged(xs.filter((x, k) => zs[k] === Math.max(...zs)).map((cx, k) => painted(box(0.3, 0.4 + 0.9 * cellHash(cx, 0, 4), 0.3), k % 2 ? PAL.legnoScuro : PAL.legno, M((cx + 0.5) * T + (cellHash(cx, 1, 4) - 0.5), 0.4, z1 - 0.15, 0, 0, (cellHash(cx, 2, 4) - 0.5) * 0.6)))), colori('murata'));
    murata.position.y = fy;
    const g3 = new THREE.Group(); g3.add(acqua, alone, sole, murata); g3.visible = false; root.add(g3);
    const cx = (x0 + x1) / 2, cz = z1 + 4;
    return { g: g3, tx, cx, cz };
  })();
  let nC = 0, nL = 0, nF = 0, nS = 0, catenaOn = false, rottamiPrima = false, consiglio = false, fucileDetto = false, caricaDetta = false;

  return {
    tick(v) {
      const now = performance.now() / 1000;
      for (const e of v.eventi) {
        if (e.eroe !== undefined && e.eroe !== v.io) continue;
        if (e.t === 'rottami' && !rottamiPrima) { rottamiPrima = true; consiglio = true; } // la prima volta, come si passa
      }
      for (const r of ruote) {
        const f = r.tim ? v.timoni.find((x) => x.n === r.n)?.fermo ?? false : v.valvole.find((x) => x.n === r.n)?.aperta ?? false;
        if (f && !r.fatto) r.girata = now;
        r.fatto = f;
      }
      piloni.forEach((p, k) => { const rotto = !!v.piloni[k]?.rotto; if (rotto && !p.rotto) p.t0 = now; p.rotto = rotto; });
      const seen = new Set<number>();
      for (const gv of v.geyser) {
        if (!gv.bomba && !gv.cannone) continue;
        seen.add(gv.id);
        let r = bombe.get(gv.id);
        if (!r) {
          const cannone = !!gv.cannone, g = new THREE.Group(); g.position.set(gv.x, fy + 0.05, gv.z); root.add(g);
          const ringM = new THREE.MeshBasicMaterial({ color: cannone ? PAL.arancio : PAL.rosso, transparent: true, opacity: 0.9, depthWrite: false });
          const discM = new THREE.MeshBasicMaterial({ color: cannone ? PAL.arancio : PAL.rosso, transparent: true, opacity: 0.3, depthWrite: false });
          const ring = new THREE.Mesh(ringGeo, ringM), disc = new THREE.Mesh(discGeo, discM), cade = new THREE.Mesh(cannone ? pallaGeo : bariloGeo, colori(cannone ? 'palla' : 'barile')), scoppio = new THREE.Mesh(scoppioGeo, scoppioMat);
          ring.scale.setScalar(gv.r); ring.renderOrder = disc.renderOrder = 1;
          g.add(ring, disc, cade, scoppio); r = { g, ring, disc, cade, scoppio, cannone }; bombe.set(gv.id, r);
        }
        r.ring.visible = r.disc.visible = r.cade.visible = !gv.getto; r.scoppio.visible = gv.getto;
        r.disc.scale.setScalar(gv.r * Math.max(0.05, steps(gv.t, 6))); // si riempie dal centro verso il bordo
        r.cade.position.y = 6 * (1 - steps(gv.t, 8)) + 0.25;
        if (gv.getto) r.scoppio.scale.setScalar(gv.r * (0.5 + 0.5 * steps(gv.t * 2, 3)));
      }
      for (const [id, r] of bombe) if (!seen.has(id)) { r.g.removeFromParent(); for (const m of [r.ring, r.disc]) (m.material as THREE.Material).dispose(); bombe.delete(id); }
    },
    update(t, hero, v, gioco) {
      const lit = (x: number, z: number) => o.sc.light(x, z) > 0;
      // ruote: gemma rossa che pulsa (da girare), la ruota gira a scatti per un secondo, poi verde
      for (const r of ruote) {
        r.holder.visible = lit(r.holder.position.x, r.holder.position.z);
        if (!r.holder.visible) continue;
        const gira = r.fatto && performance.now() / 1000 - r.girata < 1.2;
        if (gira) r.ruota.rotation.z = Math.floor((performance.now() / 1000 - r.girata) * 10) * (Math.PI / 4);
        const c = r.fatto ? (gira ? PAL.arancio : PAL.erbaChiara) : PAL.rosso;
        if (r.gemma.color.getHexString() !== c.slice(1).toLowerCase()) { r.gemma.color.set(c); r.gemma.emissive.set(c); }
        r.gemma.emissiveIntensity = r.fatto ? 0.25 : 0.15 + 0.3 * (Math.floor(t * 3) % 2);
      }
      // piloni: interi o moncone; quando vanno in pezzi tremano un attimo
      for (const p of piloni) {
        p.holder.visible = lit(p.holder.position.x, p.holder.position.z);
        p.intero.visible = !p.rotto; p.moncone.visible = p.rotto;
        const a = p.rotto ? (performance.now() / 1000 - p.t0) / 0.4 : 1;
        p.moncone.position.y = a < 1 ? 0.3 * (1 - steps(a, 4)) : 0;
      }
      // rottami: si vedono una volta visti (si ricalcola solo quando cambia quanta mappa hai visto)
      const visti = celleR.filter((i) => lit(((i % map.w) + 0.5) * T, (Math.floor(i / map.w) + 0.5) * T)).length;
      if (visti !== rottamiVisti) {
        rottamiVisti = visti;
        celleR.forEach((i, n) => {
          const cx = i % map.w, cz = Math.floor(i / map.w), on = lit((cx + 0.5) * T, (cz + 0.5) * T);
          rottami.setMatrixAt(n, m4.compose(p3.set((cx + 0.5) * T, fy, (cz + 0.5) * T), q.setFromAxisAngle(YA, cellHash(cx, cz, 8) * 6.28), s3.setScalar(on ? 1 : 0)));
        });
        rottami.instanceMatrix.needsUpdate = true;
      }
      // risacca: ferma = niente; calma = schiuma fioca e lenta; avviso = ribolle (lampeggia); raffica = corre forte nel verso della corrente
      nS = 0;
      for (const s of schiume) {
        const sv = v.venti.find((x) => x.n === s.v.n), stato = sv?.stato ?? 'calma';
        const corsa = stato === 'soffia' ? Math.floor(t * 10) % 5 : stato === 'calma' ? Math.floor(t * 2) % 5 : 0, blink = stato === 'avviso' ? Math.floor(t * 8) % 2 : 0;
        const key = `${stato}|${corsa}|${blink}|${rottamiVisti}`;
        if (key === s.chiave) { if (stato !== 'ferma') nS += s.v.celle.length; continue; }
        s.chiave = key;
        s.mat.opacity = stato === 'soffia' ? 0.95 : stato === 'avviso' ? (blink ? 0.85 : 0.4) : 0.3;
        s.v.celle.forEach((i, n) => {
          const cx = i % map.w, cz = (i - cx) / map.w, x = (cx + 0.5) * T + s.v.dx * (corsa * 0.3 - 0.6), z = (cz + 0.5) * T + s.v.dz * (corsa * 0.3 - 0.6);
          const show = stato !== 'ferma' && lit(x, z), k = stato === 'soffia' ? 1.15 : stato === 'avviso' ? 1 + 0.15 * blink : 0.8;
          s.im.setMatrixAt(n, m4.compose(p3.set(x, fy, z), q.setFromAxisAngle(YA, s.yaw), s3.set(show ? k : 0, show ? (stato === 'soffia' ? 1.6 : 1) : 0, show ? k : 0)));
          if (show) nS++;
        });
        s.im.instanceMatrix.needsUpdate = true;
      }
      // il ponte mobile: alzato in verticale, scende a gradini mentre l'acqua della falla cala
      if (ponte) {
        ponte.holder.visible = lit(ponte.holder.position.x, ponte.holder.position.z);
        const l = v.acque.find((a) => a.n === ponte.n)?.livello ?? 1;
        ponte.tavolato.rotation.z = -(Math.PI / 2) * steps(l, 6);
      }
      // corsie dei colpi dritti e freccia della carica; linee del Fuciliere
      nC = 0; nL = 0; nF = 0;
      for (const n of v.nemici) {
        if (n.anim === 'morto' || !lit(n.x, n.z)) continue;
        if (n.corsia && nC < MAXC) {
          const c = corsie[nC++]!, [ex, ez, w] = n.corsia, dx = ex - n.x, dz = ez - n.z, len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz)), carica = n.attacco === 'carica';
          c.g.visible = true; c.g.position.set(n.x, fy + 0.06, n.z); c.g.rotation.y = Math.atan2(-dz, dx);
          const ww = 2 * w;
          c.fondo.scale.set(len, 1, ww); c.pieno.scale.set(len * Math.max(0.05, steps(n.t, 6)), 1, ww);
          c.bordo.scale.set(len, 1, 0.12); c.bordo.position.z = -w; // una riga sul bordo
          c.freccia.visible = carica; c.freccia.position.set(len, 0.01, 0); c.freccia.scale.set(1.4, 1, w * 1.6);
          const giallo = carica && !!n.fisso && Math.floor(t * 10) % 2 === 0;
          for (const m of [c.fondo, c.pieno, c.bordo, c.freccia]) (m.material as THREE.MeshBasicMaterial).color.set(giallo ? PAL.giallo : PAL.rosso);
        }
        if (n.attacco === 'fucile' && n.mira && nL < MAXL) {
          const l = linee[nL++]!, dx = n.mira[0] - n.x, dz = n.mira[1] - n.z, len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
          l.visible = true; l.position.set(n.x, fy + 1.1, n.z); l.rotation.set(0, Math.atan2(-dz, dx), 0); l.scale.set(len, 1, 1);
          const mat = l.material as THREE.MeshBasicMaterial;
          if (n.fisso) { nF++; mat.color.set(Math.floor(t * 12) % 2 ? PAL.giallo : PAL.sabbiaChiara); l.scale.set(len, 1.6, 1.6); } else mat.color.set(PAL.rosso);
          if (n.fisso && gioco && !fucileDetto && !o.occupato()) { fucileDetto = true; o.say('Linea gialla: il Fuciliere spara lungo la linea. Spostati di lato!', 2800); }
        }
        if (n.attacco === 'carica' && gioco && !caricaDetta && !o.occupato()) { caricaDetta = true; o.say('La freccia ti segue: mettiti dietro un pilone e lascialo sbattere contro', 3200); }
      }
      for (let k = nC; k < MAXC; k++) corsie[k]!.g.visible = false;
      for (let k = nL; k < MAXL; k++) linee[k]!.visible = false;
      // il Capitano: scudo della salva davanti, catena gialla sulla schiena quando è chino, fuoco fatuo sulla vela nell'Ultima Marea
      const k = v.nemici.find((n) => n.tipo === 'capitano_vaelen' && n.anim !== 'morto');
      const kv = !!k && lit(k.x, k.z), yaw = k ? Math.atan2(-k.fx, -k.fz) : 0;
      scudo.visible = kv && !!k?.scudo;
      if (k && scudo.visible) { scudo.position.set(k.x, fy + 1.3, k.z); scudo.rotation.y = yaw + Math.PI; (scudo.material as THREE.MeshBasicMaterial).opacity = Math.floor(t * 6) % 2 ? 0.7 : 0.5; }
      catenaOn = kv && (k?.attacco === 'incastrato' || k?.attacco === 'detriti');
      catena.visible = catenaOn && Math.floor(t * 5) % 3 !== 0; // lampeggia: colpisci qui
      if (k && catenaOn) { catena.position.set(k.x - k.fx * 1.0, fy, k.z - k.fz * 1.0); catena.rotation.y = Math.floor(t * 4) * 0.4; }
      fatuo.visible = kv && (k?.fase ?? 0) >= 1;
      if (k && fatuo.visible) {
        fatuo.position.set(k.x + k.fx * 3.7 - k.fz * 1.08, fy + 1.5 + 0.08 * (Math.floor(t * 8) % 2), k.z + k.fz * 3.7 + k.fx * 1.08); // sulla vela, sotto la punta
        fatuo.rotation.y = Math.floor(t * 6) * 0.7; fatuo.scale.setScalar(1 + 0.15 * (Math.floor(t * 7) % 2));
      }
      // il mare all'alba oltre la murata: c'è da quando hai visto il Ponte di Comando
      if (mare) {
        if (!mare.g.visible && lit(mare.cx, mare.cz)) mare.g.visible = true;
        mare.tx.offset.set(Math.floor(t * 2) / 32, Math.floor(t * 1.5) / 48);
      }
      if (consiglio && gioco && !o.occupato()) { consiglio = false; o.say('La risacca ti butta sui rottami: passa nella calma, o al riparo dietro un cannone', 3000); }
    },
    counts: () => ({
      ruote: ruote.length, girate: ruote.filter((r) => r.fatto).length, piloni: piloni.length, rotti: piloni.filter((p) => p.rotto).length, rottami: rottamiVisti,
      schiuma: nS, corsie: nC, linee: nL, fisse: nF, barili: [...bombe.values()].filter((b) => !b.cannone).length, cannonate: [...bombe.values()].filter((b) => b.cannone).length,
      ponte: ponte ? Math.round(-ponte.tavolato.rotation.z * 100) / 100 : -1, scudo: scudo.visible, catena: catenaOn, fatuo: fatuo.visible, mare: !!mare?.g.visible,
    }),
    dispose() {
      root.removeFromParent(); rGeo.dispose(); sGeo.dispose(); piano.dispose(); punta.dispose(); ringGeo.dispose(); discGeo.dispose(); bariloGeo.dispose(); pallaGeo.dispose(); scoppioGeo.dispose();
      rottami.dispose(); for (const s of schiume) s.im.dispose(); mare?.tx.dispose();
    },
  };
}
