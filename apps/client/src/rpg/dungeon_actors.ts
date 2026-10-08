// Nemici, proiettili, bottino e ombre nel dungeon (R-scena). Modelli `nem_*` statici animati a mano: bob quando camminano, inclinazione
// indietro telegrafata durante `prepara` (con lampeggio rosso che accelera), affondo nel colpo, flash bianco quando colpiti, caduta e
// dissolvenza a scatti alla morte; alleati evocati tinti viola neon; boss più grandi; cerchio rosso a terra per il colpo ad area.
// Proiettili orientati con la velocità; sacchi sui cadaveri, forzieri che si aprono, libri; ombre a disco in un'unica InstancedMesh.
// Arcieri: arco nella sinistra; quando preparano un tiro si girano di fianco, alzano l'arco verso il bersaglio e tendono la corda a
// gradini con la freccia incoccata, scoccano con un rinculo e lo riabbassano (arco.ts). Frecce in volo grandi e con la scia.
// Interpolazione tra due tick (alpha) per i 60 fps; quel che sta al buio (scena.light) non si disegna.
// Drenaggio: i nemici senza modello usano le forme in codice di rpg/drenaggio.ts; la Valvola-SparaVapore non barcolla (è fissata ai tubi);
// getti d'acqua azzurri.
import * as THREE from 'three';
import { ENEMIES } from '@marea/content/rpg.ts';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import type { Loader } from '../render/loader.ts';
import { PAL } from '../ui/style.ts';
import { boxes, materialsOf, object, tintBlade } from './dungeon_kit.ts';
import type { DungeonScene } from './dungeon_scene.ts';
import { armaArco, frecciaInVolo } from './arco.ts';
import { formaNemico } from './drenaggio.ts';
import type { Arco } from './arco.ts';

type NemV = DungeonView['nemici'][number] & { area?: number };
type Enemy = {
  id: number; root: THREE.Group; body: THREE.Group; mats: THREE.MeshLambertMaterial[]; base: THREE.Color[]; height: number;
  px: number; pz: number; x: number; z: number; v: NemV; diedAt: number; flashT: number; ring: THREE.Group | null; ready: boolean;
  /** Solo arcieri: l'arco nella sinistra e se l'ultimo attacco preparato era un tiro (vale anche per colpisce e recupera). */
  arco: { obj: THREE.Object3D; a: Arco } | null; tiro: boolean;
};
/** `capo`: corona sopra la barra, che si vede anche a vita piena (il nemico da battere per completare il dungeon). */
export type Bar = { id: number; pos: THREE.Vector3; frac: number; ally: boolean; boss: boolean; capo: boolean };
export type Actors = {
  tick(v: DungeonView): void;
  update(alpha: number, dt: number, t: number, heroXZ: { x: number; z: number }): void;
  hit(id: number): void;
  bars(): Bar[];
  /** Posizione (interpolata) di un nemico, per i numeri del danno. */
  posOf(id: number): THREE.Vector3 | null;
  counts(): { enemies: number; drawn: number; proj: number; loot: number };
  dispose(): void;
};

const FALLBACK: Record<string, (number | string)[][]> = {
  nem_bandito: [[0.5, 0.8, 0.3, 0, 0.9, 0, PAL.legno], [0.35, 0.8, 0.25, 0, 0.4, 0, PAL.roccia], [0.25, 0.25, 0.25, 0, 1.45, 0, PAL.sabbia]],
  nem_lupo: [[0.4, 0.45, 1.1, 0, 0.6, 0, PAL.pietraScura], [0.3, 0.3, 0.35, 0, 0.8, -0.6, PAL.pietraScura]],
  nem_ragno: [[0.9, 0.4, 0.9, 0, 0.5, 0, PAL.neroCaldo], [1.8, 0.08, 0.1, 0, 0.35, 0, PAL.roccia], [0.1, 0.08, 1.8, 0, 0.35, 0, PAL.roccia]],
  nem_scheletro: [[0.4, 0.7, 0.2, 0, 1.0, 0, PAL.pietraChiara], [0.25, 0.6, 0.2, 0, 0.35, 0, PAL.pietraChiara], [0.25, 0.25, 0.25, 0, 1.5, 0, PAL.pietraChiara]],
  nem_nonmorto: [[0.5, 0.8, 0.3, 0, 1.0, 0, PAL.erbaScura], [0.35, 0.7, 0.25, 0, 0.4, 0, PAL.roccia], [0.28, 0.28, 0.28, 0, 1.6, 0, PAL.erbaScura]],
  nem_re_ossa: [[1.0, 1.4, 0.6, 0, 1.6, 0, PAL.pietraChiara], [0.7, 1.0, 0.5, 0, 0.5, 0, PAL.pietraChiara], [0.5, 0.5, 0.5, 0, 2.6, 0, PAL.giallo]],
  nem_spettro: [[0.6, 1.4, 0.4, 0, 1.2, 0, PAL.acquaBassa]],
  nem_golem: [[1.3, 1.3, 0.8, 0, 1.3, 0, PAL.acqua], [0.6, 0.5, 0.5, 0, 2.2, 0, PAL.acqua]],
  nem_custode: [[1.4, 2.0, 0.8, 0, 2.0, 0, PAL.viola], [0.7, 0.7, 0.7, 0, 3.3, 0, PAL.rosaNeon]],
};
const NEON = new THREE.Color('#8A5CFF'), RED = new THREE.Color(PAL.rosso), WHITE = new THREE.Color(PAL.sabbiaChiara);
const yawOf = (fx: number, fz: number) => Math.atan2(-fx, -fz);
const steps = (v: number, n: number) => Math.floor(Math.max(0, Math.min(1, v)) * n) / n;
const ARCIERI = new Set(ENEMIES.filter((d) => d.comportamento === 'arciere').map((d) => d.id));
/** Impugnatura dell'arco (spazio della radice del nemico, −Z avanti): a riposo nella mano sinistra lungo il fianco; in mira davanti
 *  all'altezza delle spalle, col corpo girato di fianco (la sinistra verso il bersaglio). */
const ARCO_GIU = new THREE.Vector3(-0.38, 0.85, -0.06), ARCO_SU = new THREE.Vector3(-0.04, 1.28, -0.62), FIANCO = -0.9, ALLUNGO = 0.45;
const YA = new THREE.Vector3(0, 1, 0);

export function createActors(o: { loader: Loader; scene: DungeonScene }): Actors {
  const root = new THREE.Group(); root.name = 'attori'; o.scene.scene.add(root);
  const enemies = new Map<number, Enemy>();
  const proj = new Map<number, { obj: THREE.Object3D; px: number; py: number; pz: number; x: number; y: number; z: number; vy: number; tipo: string }>();
  const loot = new Map<number, { obj: THREE.Group; state: string }>();
  const fy = o.scene.floorY;

  // ombre a disco (nero caldo, 8 lati): una draw call per tutti
  const MAXB = 96;
  const blobGeo = new THREE.CircleGeometry(0.5, 8); blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: PAL.neroCaldo, transparent: true, opacity: 0.45, depthWrite: false }), MAXB);
  blobs.frustumCulled = false; blobs.renderOrder = 1; root.add(blobs);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), cocca = new THREE.Vector3();

  const ringGeo = new THREE.RingGeometry(0.92, 1, 20, 1); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 20); discGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.85, depthWrite: false });
  const discMat = new THREE.MeshBasicMaterial({ color: PAL.rosso, transparent: true, opacity: 0.3, depthWrite: false });

  function addEnemy(n: NemV): Enemy {
    const r = new THREE.Group(); r.name = 'nemico_' + n.id; root.add(r);
    const body = new THREE.Group(); r.add(body);
    const e: Enemy = { id: n.id, root: r, body, mats: [], base: [], height: n.boss ? 3.4 : 1.9, px: n.x, pz: n.z, x: n.x, z: n.z, v: n, diedAt: -1, flashT: 0, ring: null, ready: false, arco: null, tiro: false };
    if (ARCIERI.has(n.tipo) && !n.alleato) {
      void object(o.loader, 'arm_arco', () => boxes([[0.05, 1.3, 0.05, 0, 0, 0, PAL.legno]])).then((m) => {
        tintBlade(m, PAL.legnoChiaro); // chiaro: sul pavimento scuro della grotta si legge
        body.add(m); e.arco = { obj: m, a: armaArco(m, o.loader, true, 2.6) };
      });
    }
    void object(o.loader, n.model, () => formaNemico(n.model) ?? boxes(FALLBACK[n.model] ?? FALLBACK['nem_bandito']!)).then((m) => {
      body.add(m);
      e.mats = materialsOf(m);
      if (n.alleato) for (const x of e.mats) { x.color.lerp(NEON, 0.6); x.transparent = true; x.opacity = 0.85; }
      e.base = e.mats.map((x) => x.emissive.clone());
      const box = new THREE.Box3().setFromObject(m); e.height = (box.max.y - box.min.y) * (n.boss ? 1.2 : 1) + 0.3;
      e.ready = true;
    });
    enemies.set(n.id, e);
    return e;
  }

  function lootObj(tipo: string, vuoto: boolean): Promise<THREE.Object3D> {
    const name = tipo === 'forziere' ? (vuoto ? 'dng_forziere_aperto' : 'dng_forziere') : tipo === 'libro' ? 'dng_libro' : 'prop_sacco';
    const fb: Record<string, (number | string)[][]> = {
      dng_forziere: [[0.9, 0.6, 0.6, 0, 0.3, 0, PAL.legno], [0.92, 0.08, 0.62, 0, 0.5, 0, PAL.giallo]],
      dng_forziere_aperto: [[0.9, 0.45, 0.6, 0, 0.22, 0, PAL.legno], [0.9, 0.5, 0.08, 0, 0.7, 0.3, PAL.legnoScuro]],
      dng_libro: [[0.4, 1.0, 0.3, 0, 0.5, 0, PAL.legnoScuro], [0.45, 0.08, 0.32, 0, 1.05, 0, PAL.viola]],
      prop_sacco: [[0.6, 0.5, 0.5, 0, 0.25, 0, PAL.sabbia], [0.2, 0.15, 0.2, 0, 0.55, 0, PAL.legno]],
    };
    return object(o.loader, name, () => boxes(fb[name]!));
  }
  function projObj(tipo: string): Promise<THREE.Object3D> {
    if (tipo === 'freccia' || tipo === 'freccia_nemica') return frecciaInVolo(o.loader, tipo === 'freccia_nemica');
    if (tipo === 'acqua_nemica') return Promise.resolve(boxes([[0.32, 0.32, 0.5, 0, 0, 0, PAL.acquaBassa], [0.2, 0.2, 0.5, 0, 0, 0.22, PAL.acqua], [0.12, 0.12, 0.3, 0, 0, 0.5, PAL.sabbiaChiara]], true));
    if (tipo === 'magia') return object(o.loader, 'fx_fiammata', () => boxes([[0.35, 0.35, 0.6, 0, 0, 0, PAL.arancio]], true)).then((f) => { for (const m of materialsOf(f)) { m.emissive.set(PAL.arancio); m.emissiveIntensity = 0.8; } return f; });
    return Promise.resolve(boxes([[0.35, 0.35, 0.35, 0, 0, 0, '#8A5CFF'], [0.18, 0.18, 0.5, 0, 0, 0.2, PAL.rosaNeon]], true));
  }

  const api: Actors = {
    tick(v) {
      const seen = new Set<number>();
      for (const n of v.nemici as NemV[]) {
        seen.add(n.id);
        const e = enemies.get(n.id) ?? addEnemy(n);
        e.px = e.x; e.pz = e.z; e.x = n.x; e.z = n.z;
        if (n.anim === 'morto' && e.v.anim !== 'morto') e.diedAt = performance.now() / 1000;
        e.v = n;
      }
      for (const [id, e] of enemies) if (!seen.has(id)) { e.root.removeFromParent(); enemies.delete(id); }
      const ps = new Set<number>();
      for (const p of v.proiettili) {
        ps.add(p.id);
        let r = proj.get(p.id);
        if (!r) {
          const holder = new THREE.Group(); root.add(holder);
          r = { obj: holder, px: p.x, py: p.y, pz: p.z, x: p.x, y: p.y, z: p.z, vy: 0, tipo: p.tipo };
          void projObj(p.tipo).then((m) => holder.add(m));
          proj.set(p.id, r);
        }
        r.vy = (p.y - r.y) * 60; r.px = r.x; r.py = r.y; r.pz = r.z; r.x = p.x; r.y = p.y; r.z = p.z;
        const d = v3.set(p.vx, r.vy, p.vz); if (d.lengthSq() > 1e-6) d.normalize(); else d.set(0, 0, -1);
        r.obj.quaternion.setFromUnitVectors(r.tipo.startsWith('freccia') ? s3.set(0, 1, 0) : s3.set(0, 0, -1), d);
      }
      for (const [id, r] of proj) if (!ps.has(id)) { r.obj.removeFromParent(); proj.delete(id); }
      const ls = new Set<number>();
      for (const b of v.bottini) {
        ls.add(b.id);
        const want = b.tipo === 'cadavere' && b.vuoto ? 'via' : `${b.tipo}:${b.tipo === 'forziere' && b.vuoto ? 1 : 0}`;
        const cur = loot.get(b.id);
        if (cur?.state === want) continue;
        cur?.obj.removeFromParent();
        const g = new THREE.Group(); g.position.set(b.x, fy, b.z); g.rotation.y = (b.id * 1.7) % (Math.PI * 2); root.add(g);
        loot.set(b.id, { obj: g, state: want });
        if (want !== 'via') void lootObj(b.tipo, b.vuoto).then((m) => g.add(m));
      }
      for (const [id, l] of loot) if (!ls.has(id)) { l.obj.removeFromParent(); loot.delete(id); }
    },
    update(alpha, dt, t, hero) {
      let nb = 0;
      const blob = (x: number, z: number, r: number) => { if (nb >= MAXB) return; m4.compose(v3.set(x, fy + 0.03, z), q.identity(), s3.set(r, 1, r)); blobs.setMatrixAt(nb++, m4); };
      blob(hero.x, hero.z, 0.9);
      const now = performance.now() / 1000;
      for (const e of enemies.values()) {
        const n = e.v, x = e.px + (e.x - e.px) * alpha, z = e.pz + (e.z - e.pz) * alpha;
        const lit = o.scene.light(x, z) >= 0.45 || (Math.abs(x - hero.x) < 6 && Math.abs(z - hero.z) < 6);
        const dead = n.anim === 'morto', since = dead ? now - e.diedAt : 0;
        e.root.visible = lit && (!dead || since < 1.2);
        if (e.ring) e.ring.visible = false;
        if (!e.root.visible) continue;
        e.root.position.set(x, fy, z); e.root.rotation.y = yawOf(n.fx, n.fz);
        const b = e.body, bs = n.boss ? 1.2 : 1; b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.setScalar(bs);
        let glowC: THREE.Color | null = null, glow = 0;
        if (n.anim === 'prepara') e.tiro = !!n.tiro;
        const tiro = !!e.arco && e.tiro && (n.anim === 'prepara' || n.anim === 'colpisce' || n.anim === 'recupera');
        let su = 0, tesa = 0; // arco alzato, corda tirata (0..1, a gradini)
        if (tiro) { // arciere: di fianco, arco su, corda tirata a gradini col lampeggio rosso; scocca con un rinculo; riabbassa
          su = n.anim === 'prepara' ? steps(n.t / 0.3, 3) : n.anim === 'colpisce' ? 1 : 1 - steps(n.t, 3);
          tesa = n.anim === 'prepara' ? steps((n.t - 0.25) / 0.75, 4) : 0;
          b.rotation.y = FIANCO * su;
          if (n.anim === 'prepara') { const hz = 4 + 10 * n.t; glowC = RED; glow = Math.floor(t * hz) % 2 === 0 ? 0.35 + 0.5 * n.t : 0.1; }
          if (n.anim === 'colpisce') b.position.z = 0.12;
        } else switch (n.anim) {
          case 'dorme': b.scale.y = bs * (0.92 + 0.02 * Math.sin(t * 2)); break;
          case 'insegue': case 'scappa': {
            if (n.model === 'nem_valvola') { b.position.y = 0.015 * (Math.floor(t * 8 + e.id) % 2); break; } // fissata ai tubi: vibra soltanto
            const k = n.anim === 'scappa' ? 14 : 10; b.position.y = 0.08 * Math.abs(Math.sin(t * k + e.id)); b.rotation.z = 0.08 * Math.sin(t * k + e.id); break;
          }
          case 'prepara': { // telegrafo leggibile: si tira indietro a gradini e lampeggia rosso sempre più spesso
            b.rotation.x = 0.4 * steps(n.t, 4); b.position.z = 0.15 * n.t;
            const hz = 4 + 10 * n.t; glowC = RED; glow = Math.floor(t * hz) % 2 === 0 ? 0.35 + 0.5 * n.t : 0.1;
            if (n.area && n.area > 0) {
              if (!e.ring) { e.ring = new THREE.Group(); e.ring.add(new THREE.Mesh(ringGeo, ringMat), new THREE.Mesh(discGeo, discMat)); root.add(e.ring); }
              e.ring.visible = true; e.ring.position.set(x, fy + 0.05, z); e.ring.scale.setScalar(n.area);
              e.ring.children[1]!.scale.setScalar(Math.max(0.05, steps(n.t, 5)));
            }
            break;
          }
          case 'colpisce': b.rotation.x = -0.5; b.position.z = -0.45; break;
          case 'recupera': b.rotation.x = -0.5 * (1 - n.t); b.position.z = -0.45 * (1 - n.t); break;
          case 'colpito': b.position.z = 0.15; break;
          case 'morto': { const k = steps(since / 0.3, 3); b.rotation.z = 1.4 * k; b.position.y = -0.1 * k; break; }
          default: b.position.y = 0.02 * Math.sin(t * 2 + e.id);
        }
        if (n.alleato) b.position.y += 0.15 + 0.05 * Math.sin(t * 3 + e.id);
        if (e.arco) {
          const yaw = b.rotation.y, a = e.arco.obj;
          a.position.lerpVectors(ARCO_GIU, ARCO_SU, su).applyAxisAngle(YA, -yaw); // nello spazio del corpo, che è girato di yaw
          a.rotation.set(-0.15 * (1 - su), -yaw, 0.15 * su, 'YXZ'); // corda verso di sé, un filo inclinato
          e.arco.a.tendi(tiro && n.anim === 'prepara' && su > 0 ? cocca.set(0, 0, 0.17 + ALLUNGO * tesa) : null, true);
        }
        e.flashT = Math.max(0, e.flashT - dt);
        if (e.flashT > 0 || n.anim === 'colpito') { glowC = WHITE; glow = 0.9; }
        const fade = dead && since > 0.6 ? 1 - steps((since - 0.6) / 0.6, 3) : 1;
        e.mats.forEach((m, i) => {
          if (glowC) m.emissive.copy(glowC).multiplyScalar(glow); else m.emissive.copy(e.base[i]!);
          if (n.alleato) m.emissive.lerp(NEON, 0.35);
          const op = (n.alleato ? 0.85 : 1) * fade;
          if (op < 1 !== m.transparent) { m.transparent = op < 1; m.needsUpdate = true; }
          m.opacity = op;
        });
        if (!dead) blob(x, z, (n.boss ? 2.2 : 1.1) * (n.model === 'nem_ragno' ? 1.6 : 1));
      }
      blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
      for (const r of proj.values()) r.obj.position.set(r.px + (r.x - r.px) * alpha, r.py + (r.y - r.py) * alpha, r.pz + (r.z - r.pz) * alpha);
      for (const l of loot.values()) l.obj.visible = o.scene.light(l.obj.position.x, l.obj.position.z) > 0;
    },
    hit(id) { const e = enemies.get(id); if (e) e.flashT = 0.12; },
    bars() {
      const out: Bar[] = [];
      for (const e of enemies.values()) {
        const n = e.v;
        if (!e.root.visible || n.anim === 'morto' || (n.vita >= n.max && !n.capo) || !e.ready) continue;
        out.push({ id: e.id, pos: e.root.position.clone().setY(fy + e.height), frac: n.vita / n.max, ally: n.alleato, boss: n.boss, capo: !!n.capo });
      }
      return out;
    },
    posOf(id) { const e = enemies.get(id); return e ? e.root.position.clone().setY(fy + e.height) : null; },
    counts: () => ({ enemies: enemies.size, drawn: [...enemies.values()].filter((e) => e.root.visible).length, proj: proj.size, loot: loot.size }),
    dispose() { root.removeFromParent(); blobGeo.dispose(); ringGeo.dispose(); discGeo.dispose(); },
  };
  return api;
}
