// Il Santuario del Capo Ardente: gli effetti della scena. I bracieri del Giuramento (cesto di pietra, fiamma e luce vera quando sono accesi, e sul pavimento
// l'area 3×3 che ripara dal calore), la lava delle trappole (viva a chiazze rosse e gialle, a crosta nera e screpolata quando i bracieri della stanza sono
// accesi) e il bordo di lava dell'arena, le ondate di calore (la zona si arroventa a scatti prima dello scoppio), i cerchi a terra dei globi di lava, dei
// Mite, della pioggia di braci, dello schianto e dell'onda di Korok (si riempiono dal centro; poi il globo cade e scoppia), la linea che lega lo Sciamano a
// te e l'anello rosso sul braciere che il Colosso sta per calciare. Tutto a scatti, colori di palette. Il modello vero del braciere (dng_ceneri_braciere)
// vince sul segnaposto di ceneri.ts.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { M, merged, painted } from '../render/island_parts.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { cellHash, object } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { bracialeObj, fiammaGeo } from './ceneri.ts';
import { colori } from './diga.ts';

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const MAXL = 4, MAXG = 24, MAXLINEE = 6;

export type CeneriFx = {
  tick(v: DungeonView): void;
  update(t: number, hero: { x: number; z: number }, v: DungeonView): void;
  counts(): { bracieri: number; accesi: number; lavaViva: number; lavaCrosta: number; cerchi: number; calore: number; luci: number };
  dispose(): void;
};

export function createCeneriFx(o: { sc: DungeonScene; loader: Loader }): CeneriFx {
  const root = new THREE.Group(); root.name = 'ceneri_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY, map = o.sc.map, T = map.tile;
  const lit = (x: number, z: number) => o.sc.light(x, z) > 0;
  const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), q = new THREE.Quaternion(), col = new THREE.Color();
  const flat = (r: number, h = 0.02) => { const g = new THREE.BoxGeometry(1, h, 1); g.scale(r, 1, r); return g; };

  // ---- bracieri: il cesto (modello o segnaposto), la fiamma da acceso, l'area 3×3 che ripara, qualche luce vera sui più vicini ----
  const fiamma = fiammaGeo();
  const fiammaMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const areaGeo = new THREE.PlaneGeometry(3 * T, 3 * T); areaGeo.rotateX(-Math.PI / 2);
  const bracieri = map.bracieri.map((b) => {
    const holder = new THREE.Group(); holder.position.set(b.x, fy, b.z); holder.rotation.y = cellHash(b.cx, b.cz, 6) * 6.28; root.add(holder);
    void object(o.loader, 'dng_ceneri_braciere', bracialeObj).then((g) => { holder.add(g); o.sc.ritocca(holder); });
    const f = new THREE.Mesh(fiamma, fiammaMat); f.visible = false; holder.add(f);
    const area = new THREE.Mesh(areaGeo, new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.16, depthWrite: false }));
    area.position.set(b.x, fy + 0.05, b.z); area.visible = false; area.renderOrder = 1; root.add(area);
    return { b, holder, fiamma: f, area, acceso: false };
  });
  const luci = Array.from({ length: MAXL }, () => { const l = new THREE.PointLight(PAL.arancio, 0, 9, 1.6); l.position.y = fy + 1.6; root.add(l); return l; });

  // ---- lava: una chiazza per cella, viva o a crosta secondo la colata (e se i bracieri della stanza sono accesi) ----
  const celle: number[] = [];
  for (let i = 0; i < map.lava.length; i++) if (map.lava[i]) celle.push(i);
  const piastra = new THREE.BoxGeometry(T, 0.07, T);
  const mkLava = (colori4: readonly string[]) => {
    const im = new THREE.InstancedMesh(piastra, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.5 }), Math.max(1, celle.length));
    im.frustumCulled = false; im.name = 'lava';
    celle.forEach((i, k) => { const cx = i % map.w, cz = (i - cx) / map.w; im.setColorAt(k, col.set(colori4[Math.floor(cellHash(cx, cz, 11) * colori4.length)]!)); });
    root.add(im); o.sc.ritocca(im);
    return im;
  };
  const viva = mkLava([PAL.rosso, PAL.arancio, PAL.arancio, PAL.giallo]);
  const crosta = mkLava([PAL.neroCaldo, PAL.neroCaldo, PAL.pietraScura]);
  (crosta.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.06;
  let lavaChiave = '', nViva = 0, nCrosta = 0;

  // ---- ondate di calore: la zona che si arroventa, e il lampo dello scoppio ----
  const zone = (o.sc.def.ondate ?? []).map(() => {
    const m = new THREE.Mesh(flat(1), new THREE.MeshBasicMaterial({ color: PAL.arancio, transparent: true, opacity: 0.2, depthWrite: false }));
    m.visible = false; m.renderOrder = 1; root.add(m);
    return m;
  });
  let lampo = 0;

  // ---- cerchi a terra (geyser): anello, disco che si riempie, il globo che cade, lo scoppio ----
  const ringGeo = new THREE.RingGeometry(0.93, 1, 24, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 24); discGeo.rotateX(-Math.PI / 2);
  const globoGeo = merged([painted(new THREE.IcosahedronGeometry(0.3, 0), PAL.neroCaldo), painted(new THREE.IcosahedronGeometry(0.22, 0), PAL.arancio, M(0, 0.1, 0))]);
  const scoppioGeo = merged([painted(new THREE.IcosahedronGeometry(1, 0), PAL.arancio), painted(new THREE.IcosahedronGeometry(0.65, 0), PAL.giallo, M(0, 0.15, 0))]);
  const scoppioMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: PAL.arancio, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });
  const cerchi = new Map<number, { g: THREE.Group; ring: THREE.Mesh; disc: THREE.Mesh; cade: THREE.Mesh; scoppio: THREE.Mesh }>();

  // ---- linee dello Sciamano e anello del calcio ----
  const linee = Array.from({ length: MAXLINEE }, () => {
    const g = new THREE.BoxGeometry(1, 0.05, 0.05); g.translate(0.5, 0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.85, depthWrite: false }));
    m.visible = false; m.renderOrder = 2; root.add(m);
    return m;
  });
  const anelli = Array.from({ length: 2 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.9, depthWrite: false }));
    m.visible = false; m.renderOrder = 2; m.scale.setScalar(1.7); root.add(m);
    return m;
  });
  let nCerchi = 0;

  return {
    tick(v) {
      for (const e of v.eventi) if (e.t === 'calore' && (e.eroe === undefined || e.eroe === v.io)) lampo = performance.now() / 1000;
      const seen = new Set<number>();
      for (const gv of v.geyser) {
        seen.add(gv.id);
        let r = cerchi.get(gv.id);
        if (!r && cerchi.size < MAXG) {
          const g = new THREE.Group(); g.position.set(gv.x, fy + 0.06, gv.z); root.add(g);
          const c = gv.onda ? PAL.arancio : PAL.rosso;
          const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
          const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: gv.onda ? 0.22 : 0.32, depthWrite: false }));
          const cade = new THREE.Mesh(globoGeo, colori('ceneri_globo')), scoppio = new THREE.Mesh(scoppioGeo, scoppioMat);
          ring.scale.setScalar(gv.r); ring.renderOrder = disc.renderOrder = 1; cade.visible = !gv.onda && !gv.evoca && gv.r <= 3; scoppio.visible = false;
          g.add(ring, disc, cade, scoppio); r = { g, ring, disc, cade, scoppio }; cerchi.set(gv.id, r);
        }
        if (!r) continue;
        r.ring.visible = r.disc.visible = !gv.getto; r.scoppio.visible = gv.getto;
        r.disc.scale.setScalar(gv.r * Math.max(0.05, steps(gv.t, gv.onda ? 10 : 6))); // si riempie dal centro verso il bordo
        if (r.cade.visible) r.cade.position.y = 6 * (1 - steps(gv.t, 8)) + 0.3;
        if (gv.getto) r.scoppio.scale.setScalar(Math.min(gv.r, 3) * (0.5 + 0.5 * steps(gv.t * 2, 3)));
      }
      for (const [id, r] of cerchi) if (!seen.has(id)) { r.g.removeFromParent(); for (const m of [r.ring, r.disc]) (m.material as THREE.Material).dispose(); cerchi.delete(id); }
    },
    update(t, hero, v) {
      const now = performance.now() / 1000;
      // bracieri: acceso o spento, e le luci vere sui tre più vicini all'eroe
      let accesi = 0;
      const vicini: { d: number; b: (typeof bracieri)[number] }[] = [];
      bracieri.forEach((br, i) => {
        const vis = lit(br.b.x, br.b.z), acceso = !!v.bracieri[i]?.acceso;
        br.holder.visible = vis; br.acceso = acceso;
        br.fiamma.visible = vis && acceso; br.area.visible = vis && acceso;
        if (!vis || !acceso) return;
        accesi++;
        br.fiamma.scale.set(1 + 0.12 * (Math.floor(t * 8 + i) % 2), 1 + 0.2 * (Math.floor(t * 7 + i * 3) % 3) / 2, 1 + 0.12 * (Math.floor(t * 8 + i) % 2));
        (br.area.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.07 * (Math.floor(t * 3 + i) % 2);
        vicini.push({ d: (br.b.x - hero.x) ** 2 + (br.b.z - hero.z) ** 2, b: br });
      });
      vicini.sort((a, b) => a.d - b.d);
      luci.forEach((l, k) => {
        const n = vicini[k];
        if (!n) { l.intensity = 0; return; }
        l.position.set(n.b.b.x, fy + 1.8, n.b.b.z); l.intensity = 16 * (0.92 + 0.16 * (Math.floor(t * 8 + k) % 2));
      });
      // lava: viva (rossa) o a crosta, secondo lo stato della sua colata; il bordo dell'arena resta sempre viva
      const stato = new Map(v.lave.map((l) => [l.n, l.stato]));
      const chiave = celle.map((i) => (stato.get(map.lava[i]!) ?? 'scorre') === 'crosta' ? 'c' : 'v').join('') + '|' + celle.map((i) => (lit(((i % map.w) + 0.5) * T, (Math.floor(i / map.w) + 0.5) * T) ? 1 : 0)).join('');
      if (chiave !== lavaChiave) {
        lavaChiave = chiave; nViva = 0; nCrosta = 0;
        celle.forEach((i, k) => {
          const cx = i % map.w, cz = (i - cx) / map.w, x = (cx + 0.5) * T, z = (cz + 0.5) * T, on = lit(x, z), c = (stato.get(map.lava[i]!) ?? 'scorre') === 'crosta';
          p3.set(x, fy + 0.03, z);
          viva.setMatrixAt(k, m4.compose(p3, q.identity(), s3.setScalar(on && !c ? 1 : 0))); crosta.setMatrixAt(k, m4.compose(p3, q.identity(), s3.setScalar(on && c ? 1 : 0)));
          if (on) { if (c) nCrosta++; else nViva++; }
        });
        viva.instanceMatrix.needsUpdate = crosta.instanceMatrix.needsUpdate = true;
      }
      (viva.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.45 + 0.25 * (Math.floor(t * 6) % 2);
      // ondate di calore: la zona si arroventa a scatti prima dello scoppio; allo scoppio un lampo
      const flash = now - lampo < 0.3;
      v.calore.forEach((c, i) => {
        const z = zone[i];
        if (!z) return;
        const [x0, z0, x1, z1] = c.zona;
        z.visible = (c.stato === 'avviso' || flash) && hero.x >= x0 - 3 && hero.x <= x1 + 3 && hero.z >= z0 - 3 && hero.z <= z1 + 3; // solo nella stanza dove sei
        if (!z.visible) return;
        z.position.set((x0 + x1) / 2, fy + 0.04, (z0 + z1) / 2); z.scale.set(x1 - x0, 1, z1 - z0);
        const m = z.material as THREE.MeshBasicMaterial;
        m.color.set(flash ? PAL.giallo : PAL.arancio);
        m.opacity = flash ? 0.5 : 0.08 + 0.3 * steps(c.t, 5) * (Math.floor(t * 8) % 2 ? 1 : 0.7);
      });
      // linee degli Sciamani che evocano e anelli sui bracieri che il Colosso sta per calciare
      let nl = 0, na = 0;
      for (const n of v.nemici) {
        if (n.anim === 'morto' || !lit(n.x, n.z) || !n.mira) continue;
        if (n.attacco === 'evoca' && nl < MAXLINEE) {
          const l = linee[nl++]!, dx = n.mira[0] - n.x, dz = n.mira[1] - n.z, len = Math.max(0.1, Math.hypot(dx, dz));
          l.visible = true; l.position.set(n.x, fy + 1.2, n.z); l.rotation.set(0, Math.atan2(-dz, dx), 0); l.scale.set(len, 1, 1);
          (l.material as THREE.MeshBasicMaterial).opacity = Math.floor(t * 12) % 2 ? 0.9 : 0.45; // tremolante
        } else if (n.attacco === 'calcio' && na < anelli.length) {
          const a = anelli[na++]!;
          a.visible = true; a.position.set(n.mira[0], fy + 0.08, n.mira[1]); a.scale.setScalar(1.5 + 0.3 * steps(n.t, 4));
        }
      }
      for (let k = nl; k < MAXLINEE; k++) linee[k]!.visible = false;
      for (let k = na; k < anelli.length; k++) anelli[k]!.visible = false;
      nCerchi = cerchi.size;
    },
    counts: () => ({ bracieri: bracieri.length, accesi: bracieri.filter((b) => b.acceso).length, lavaViva: nViva, lavaCrosta: nCrosta, cerchi: nCerchi, calore: zone.filter((z) => z.visible).length, luci: luci.filter((l) => l.intensity > 0).length }),
    dispose() {
      root.removeFromParent(); fiamma.dispose(); fiammaMat.dispose(); areaGeo.dispose(); piastra.dispose(); ringGeo.dispose(); discGeo.dispose(); globoGeo.dispose(); scoppioGeo.dispose();
      viva.dispose(); crosta.dispose(); for (const z of zone) z.geometry.dispose();
    },
  };
}
