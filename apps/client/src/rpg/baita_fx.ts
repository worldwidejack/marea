// Il Tempio della «Doppia Nera»: gli effetti della scena (docs/BAITA.md). Tutto quello che ti sposta o ti rallenta si vede: le lastre di Ghiaccio Vivo (azzurre, lucide;
// si sciolgono a scatti quando giri la colonnina della stanza), le colonnine termiche (lampada rossa da girare, bobina arancio e vapore da accese, un anello giallo
// a terra dove stare), le chiazze delle fiasche (azzurra che rallenta, arancio che brucia), la scia di neve di chi scivola, l'anello sotto i piedi di chi è rallentato,
// le bandierine dello Slalom con la loro zona di gelo e la linea gialla del percorso, i cerchi di gelo che scoppiano. I telegrafi dei nemici (cerchi, quadrato, X,
// cono, linee a terra, fiasca in volo, stelline) stanno in baita_telegrafi.ts. Tutto a scatti, colori di palette.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { PAL } from '../ui/style.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { colonninaObj } from './baita.ts';
import { createTelegrafi } from './baita_telegrafi.ts';

const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const MAXP = 10, MAXG = 8, MAXS = 10, MAXV = 3;

export type BaitaFx = {
  tick(v: DungeonView): void;
  update(t: number, hero: { x: number; z: number }, v: DungeonView, gioco: boolean): void;
  counts(): { ghiaccio: number; sciolte: number; colonnine: number; accese: number; chiazze: number; scia: number; bandierine: number; telegrafi: ReturnType<ReturnType<typeof createTelegrafi>['counts']> };
  dispose(): void;
};

export function createBaitaFx(o: { sc: DungeonScene; say(text: string, ms: number): void; occupato(): boolean }): BaitaFx {
  const root = new THREE.Group(); root.name = 'baita_fx'; o.sc.scene.add(root);
  const fy = o.sc.floorY, map = o.sc.map, T = map.tile;
  const lit = (x: number, z: number) => o.sc.light(x, z) > 0;
  const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), q = new THREE.Quaternion();
  const disc = new THREE.CircleGeometry(1, 20); disc.rotateX(-Math.PI / 2);
  const ring = new THREE.RingGeometry(0.84, 1, 20, 1); ring.rotateX(-Math.PI / 2);
  const basic = (c: string, op: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });

  // ---- Ghiaccio Vivo: una lastra per cella (azzurra, con la sua riga chiara e qualche crepa); si scioglie a scatti quando la colonnina della stanza è girata ----
  const celle: number[] = [];
  for (let i = 0; i < map.ghiaccio.length; i++) if (map.ghiaccio[i]) celle.push(i);
  const tx = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d')!;
    g.fillStyle = PAL.acquaBassa; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PAL.sabbiaChiara;
    for (let k = 0; k < 16; k++) { g.fillRect(k, 0, 1, 1); g.fillRect(0, k, 1, 1); } // la riga chiara sul bordo: si leggono le lastre
    for (const [x, y, w] of [[3, 3, 5], [7, 8, 6], [2, 12, 4]] as const) g.fillRect(x, y, w, 1); // riflessi
    g.fillStyle = PAL.acqua; for (const [x, y] of [[10, 4], [5, 6], [12, 11], [9, 13]] as const) g.fillRect(x, y, 2, 1); // crepe
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const lastra = new THREE.PlaneGeometry(T, T); lastra.rotateX(-Math.PI / 2);
  const ghiaccioMat = new THREE.MeshLambertMaterial({ map: tx, flatShading: true, emissive: PAL.acquaBassa, emissiveIntensity: 0.22 });
  const ghiaccio = new THREE.InstancedMesh(lastra, ghiaccioMat, Math.max(1, celle.length)); ghiaccio.name = 'ghiaccio'; ghiaccio.frustumCulled = false; ghiaccio.renderOrder = 1;
  root.add(ghiaccio); o.sc.ritocca(ghiaccio);
  const sciolta = new Map<number, number>(); // stanza -> da quando (s) è sciolta
  let ghiaccioChiave = '', nGhiaccio = 0;

  // ---- colonnine termiche: lampada rossa e vapore spento, bobina arancio e vapore acceso; l'anello giallo a terra dove stare ----
  const colonnine = map.valvole.map((vv) => {
    const holder = new THREE.Group(); holder.position.set(vv.x, fy, vv.z); root.add(holder);
    const w = colonninaObj(); holder.add(w.g);
    const anello = new THREE.Mesh(ring, basic(PAL.giallo, 0.85)); anello.scale.setScalar(1.4); anello.position.y = 0.06; anello.renderOrder = 1; holder.add(anello);
    const fumo = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.7 })); m.visible = false; holder.add(m); return m; });
    o.sc.ritocca(holder);
    return { vv, holder, w, anello, fumo, acceso: false, t0: -1 };
  });

  // ---- chiazze delle fiasche (disco con l'anello; blu = sciolina che rallenta, arancio = bombardino che brucia) ----
  const chiazze = Array.from({ length: MAXP }, () => {
    const g = new THREE.Group(); g.visible = false; g.renderOrder = 1; root.add(g);
    const d = new THREE.Mesh(disc, basic(PAL.acqua, 0.45)), r = new THREE.Mesh(ring, basic(PAL.sabbiaChiara, 0.9));
    d.position.y = r.position.y = 0.05; g.add(d, r);
    return { g, d, r };
  });

  // ---- scia di neve di chi scivola e anello di chi è rallentato ----
  const scia = Array.from({ length: MAXS }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: PAL.sabbiaChiara, transparent: true, opacity: 0.8 })); m.visible = false; m.userData.t0 = -9; root.add(m); return m; });
  let sciaK = 0, sciaX = 0, sciaZ = 0;
  const lento = new THREE.Mesh(ring, basic(PAL.acquaBassa, 0.9)); lento.scale.setScalar(0.75); lento.visible = false; lento.renderOrder = 2; root.add(lento);

  // ---- bandierine dello Slalom (palo rosso o blu e fiocco), la zona di gelo attorno e la linea gialla del percorso ----
  const bandiere = new Map<number, { g: THREE.Group; zona: THREE.Mesh }>();
  const percorso = Array.from({ length: MAXV }, () => { const g = new THREE.BoxGeometry(1, 0.05, 0.16); g.translate(0.5, 0, 0); const m = new THREE.Mesh(g, basic(PAL.giallo, 0.9)); m.visible = false; m.renderOrder = 2; root.add(m); return m; });
  const palo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), fiocco = new THREE.BoxGeometry(0.7, 0.4, 0.05);

  // ---- cerchi di gelo (i geyser dello Slalom): si riempiono dal centro, poi scoppiano ----
  const gelo = new Map<number, { g: THREE.Group; ring: THREE.Mesh; disc: THREE.Mesh; scoppio: THREE.Mesh }>();
  const scoppioGeo = new THREE.IcosahedronGeometry(1, 0), scoppioMat = new THREE.MeshLambertMaterial({ color: PAL.sabbiaChiara, flatShading: true, emissive: PAL.acquaBassa, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });

  const tele = createTelegrafi({ root, fy, lit, basic, ring, disc });
  const detti = new Set<string>();
  const dici = (k: string, txt: string, gioco: boolean, ms = 3000) => { if (detti.has(k) || !gioco || o.occupato()) return; detti.add(k); o.say(txt, ms); };
  let nChiazze = 0, nScia = 0;

  return {
    tick(v) {
      const now = performance.now() / 1000;
      for (const e of v.eventi) {
        if (e.eroe !== undefined && e.eroe !== v.io) continue;
        if (e.t === 'scongelato' && !sciolta.has(e.n)) sciolta.set(e.n, now);
      }
      for (const n of v.sciolti ?? []) if (!sciolta.has(n)) sciolta.set(n, -9); // ripartito da una lanterna: già sciolto
      const seen = new Set<number>();
      for (const gv of v.geyser) {
        seen.add(gv.id);
        let r = gelo.get(gv.id);
        if (!r && gelo.size < MAXG) {
          const g = new THREE.Group(); g.position.set(gv.x, fy + 0.07, gv.z); root.add(g);
          const rg = new THREE.Mesh(ring, basic(PAL.acqua, 0.95)), d = new THREE.Mesh(disc, basic(PAL.acquaBassa, 0.35)), sc = new THREE.Mesh(scoppioGeo, scoppioMat);
          rg.scale.setScalar(gv.r); rg.renderOrder = d.renderOrder = 1; sc.visible = false; g.add(rg, d, sc); r = { g, ring: rg, disc: d, scoppio: sc }; gelo.set(gv.id, r);
        }
        if (!r) continue;
        r.ring.visible = r.disc.visible = !gv.getto; r.scoppio.visible = gv.getto;
        r.disc.scale.setScalar(gv.r * Math.max(0.05, steps(gv.t, 6)));
        if (gv.getto) r.scoppio.scale.setScalar(gv.r * (0.4 + 0.6 * steps(gv.t * 2, 3)));
      }
      for (const [id, r] of gelo) if (!seen.has(id)) { r.g.removeFromParent(); for (const m of [r.ring, r.disc]) (m.material as THREE.Material).dispose(); gelo.delete(id); }
      tele.tick(v);
    },
    update(t, hero, v, gioco) {
      const now = performance.now() / 1000;
      // ghiaccio: visibile dove hai visto; sciolto = rimpicciolisce a gradini e sparisce
      const chiave = celle.map((i) => `${lit(((i % map.w) + 0.5) * T, (Math.floor(i / map.w) + 0.5) * T) ? 1 : 0}${steps(1 - (now - (sciolta.get(map.ghiaccio[i]!) ?? 1e9)) / 0.9, 4)}`).join('');
      if (chiave !== ghiaccioChiave) {
        ghiaccioChiave = chiave; nGhiaccio = 0;
        celle.forEach((i, k) => {
          const cx = i % map.w, cz = (i - cx) / map.w, x = (cx + 0.5) * T, z = (cz + 0.5) * T, s0 = sciolta.get(map.ghiaccio[i]!), a = s0 === undefined ? 1 : steps(1 - (now - s0) / 0.9, 4), on = lit(x, z) && a > 0;
          ghiaccio.setMatrixAt(k, m4.compose(p3.set(x, fy + 0.04 + 0.002 * (k % 3), z), q.identity(), s3.set(on ? a : 0, 1, on ? a : 0)));
          if (on) nGhiaccio++;
        });
        ghiaccio.instanceMatrix.needsUpdate = true;
      }
      ghiaccioMat.emissiveIntensity = 0.16 + 0.14 * (Math.floor(t * 3) % 2); // luccica
      // colonnine: lampada rossa e anello che pulsano finché non la giri; accesa: bobina arancio, vapore che sale
      for (const [i, c] of colonnine.entries()) {
        const acceso = !!v.valvole[i]?.aperta, vis = lit(c.vv.x, c.vv.z);
        if (acceso && !c.acceso) c.t0 = now;
        c.acceso = acceso; c.holder.visible = vis;
        if (!vis) continue;
        c.w.lampada.color.set(acceso ? PAL.erbaChiara : PAL.rosso); c.w.lampada.emissive.set(acceso ? PAL.erbaChiara : PAL.rosso); c.w.lampada.emissiveIntensity = acceso ? 0.35 : 0.15 + 0.4 * (Math.floor(t * 3) % 2);
        c.w.bobina.color.set(acceso ? PAL.arancio : PAL.pietraScura); c.w.bobina.emissive.set(acceso ? PAL.arancio : PAL.neroCaldo); c.w.bobina.emissiveIntensity = acceso ? 0.5 + 0.3 * (Math.floor(t * 6) % 2) : 0.05;
        c.anello.visible = !acceso && Math.hypot(hero.x - c.vv.x, hero.z - c.vv.z) < 14;
        (c.anello.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * (Math.floor(t * 3) % 2);
        c.fumo.forEach((f, k) => { f.visible = acceso; if (acceso) { const u = ((t * 0.9 + k / 3) % 1); f.position.set(0.18 * (k - 1), 1.8 + 1.6 * steps(u, 6), 0.1 * (k % 2)); f.scale.setScalar(0.6 + u); (f.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u); } });
      }
      // chiazze: blu rallenta, arancio brucia; negli ultimi istanti lampeggiano (poi si asciugano)
      nChiazze = 0;
      const pozze = v.pozze ?? [], bandierine = v.bandierine ?? [];
      pozze.slice(0, MAXP).forEach((p, k) => {
        const c = chiazze[k]!, on = lit(p.x, p.z), sciolina = p.tipo === 'sciolina';
        c.g.visible = on && !(p.t > 0.8 && Math.floor(t * 8) % 2);
        if (!c.g.visible) return;
        nChiazze++; c.g.position.set(p.x, fy, p.z); c.d.scale.setScalar(p.r); c.r.scale.setScalar(p.r);
        (c.d.material as THREE.MeshBasicMaterial).color.set(sciolina ? PAL.acqua : PAL.arancio); (c.d.material as THREE.MeshBasicMaterial).opacity = sciolina ? 0.5 : 0.55 + 0.2 * (Math.floor(t * 5 + k) % 2);
        (c.r.material as THREE.MeshBasicMaterial).color.set(sciolina ? PAL.sabbiaChiara : PAL.giallo);
      });
      for (let k = Math.min(pozze.length, MAXP); k < MAXP; k++) chiazze[k]!.g.visible = false;
      // scia di neve (ogni mezzo metro scivolato) e anello azzurro sotto i piedi di chi è rallentato
      const sc = v.hero.scivola;
      if (sc && Math.hypot(hero.x - sciaX, hero.z - sciaZ) > 0.5) { const m = scia[sciaK++ % MAXS]!; m.visible = true; m.userData.t0 = now; m.position.set(hero.x - sc[0] * 0.3, fy + 0.15, hero.z - sc[1] * 0.3); sciaX = hero.x; sciaZ = hero.z; }
      nScia = 0;
      for (const m of scia) {
        const u = (now - (m.userData.t0 as number)) / 0.5;
        m.visible = u >= 0 && u < 1;
        if (!m.visible) continue;
        nScia++; m.scale.setScalar(1 + 1.2 * u); m.position.y = fy + 0.15 + 0.5 * steps(u, 4); (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u);
      }
      lento.visible = !!v.hero.rallentato; lento.position.set(hero.x, fy + 0.08, hero.z); lento.scale.setScalar(0.7 + 0.1 * (Math.floor(t * 6) % 2));
      // bandierine: palo e fiocco (rosso e blu a turno), la zona di gelo attorno; spaccata = via
      const vive = new Set<number>(), boss = v.nemici.find((n) => n.tipo === 'jean_claude' && n.anim !== 'morto');
      for (const b of bandierine) {
        if (b.abbattuta) continue;
        vive.add(b.id);
        let f = bandiere.get(b.id);
        if (!f) {
          const g = new THREE.Group(); g.position.set(b.x, fy, b.z); root.add(g);
          const c = b.n % 2 ? PAL.rosso : PAL.acqua, p = new THREE.Mesh(palo, new THREE.MeshLambertMaterial({ color: c, flatShading: true })), fi = new THREE.Mesh(fiocco, new THREE.MeshLambertMaterial({ color: PAL.giallo, flatShading: true }));
          p.position.y = 1.1; fi.position.set(0.38, 1.9, 0); g.add(p, fi);
          const zona = new THREE.Mesh(ring, basic(PAL.acqua, 0.7)); zona.scale.setScalar(b.r); zona.position.y = 0.05; zona.renderOrder = 1; g.add(zona);
          f = { g, zona }; bandiere.set(b.id, f); o.sc.ritocca(g);
        }
        f.g.visible = lit(b.x, b.z); f.g.rotation.z = 0.04 * (Math.floor(t * 4 + b.n) % 2 ? 1 : -1);
        (f.zona.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * (Math.floor(t * 3 + b.n) % 2);
      }
      for (const [id, f] of bandiere) if (!vive.has(id)) { f.g.removeFromParent(); (f.zona.material as THREE.Material).dispose(); bandiere.delete(id); }
      const punti: [number, number][] = [...(boss && boss.attacco === 'slalom' ? [[boss.x, boss.z] as [number, number]] : []), ...bandierine.filter((b) => !b.abbattuta).map((b) => [b.x, b.z] as [number, number])];
      percorso.forEach((m, k) => {
        const a = punti[k], b = punti[k + 1];
        m.visible = !!a && !!b && boss?.attacco === 'slalom';
        if (!m.visible) return;
        const dx = b![0] - a![0], dz = b![1] - a![1], len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
        m.position.set(a![0], fy + 0.08, a![1]); m.rotation.set(0, Math.atan2(-dz, dx), 0); m.scale.set(len, 1, 1);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * (Math.floor(t * 6) % 2);
      });
      tele.update(t, v);
      // i consigli, una volta sola: cosa ti sta succedendo e come se ne esce
      for (const e of v.eventi) {
        if (e.eroe !== undefined && e.eroe !== v.io) continue;
        if (e.t === 'scivolata') dici('scivolata', 'Ghiaccio Vivo: scivoli dritto finché non sbatti. Cerca la colonnina!', gioco, 3600);
        else if (e.t === 'rallentato') dici('sciolina', 'Sciolina: ti rallenta finché ci stai dentro. Esci dalla chiazza azzurra!', gioco);
        else if (e.t === 'capogiro') dici('capogiro', 'Gli gira la testa: colpiscilo adesso!', gioco, 2400);
        else if (e.t === 'bandierina' && !e.abbattuta) dici('slalom', 'Gara ufficiale: spacca una bandierina prima che Jean-Claude ci arrivi!', gioco, 3400);
        else if (e.t === 'salto') dici('salto', 'Il quadrato ti segue: esci da lì quando si ferma!', gioco, 3000);
      }
      for (const n of v.nemici) if (n.attacco === 'raffica' && Math.hypot(hero.x - n.x, hero.z - n.z) < 16) dici('raffica', 'Le linee a terra mostrano dove tira lo Sparaneve: togliti di lì!', gioco);
    },
    counts: () => ({ ghiaccio: nGhiaccio, sciolte: sciolta.size, colonnine: colonnine.length, accese: colonnine.filter((c) => c.acceso).length, chiazze: nChiazze, scia: nScia, bandierine: bandiere.size, telegrafi: tele.counts() }),
    dispose() {
      root.removeFromParent(); tx.dispose(); lastra.dispose(); ghiaccioMat.dispose(); disc.dispose(); ring.dispose(); palo.dispose(); fiocco.dispose(); scoppioGeo.dispose(); scoppioMat.dispose(); ghiaccio.dispose(); tele.dispose();
    },
  };
}
