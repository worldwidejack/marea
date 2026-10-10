// L'hub dell'Isola delle Corse alla Diddy Kong Racing (docs/CORSE.md A3, #185): il mondo a parte che si gira col veicolo.
// Questo file costruisce il MONDO (terreno, strade, mare, pezzi del kit, porte, garage, molo, atmosfera) e risponde alle domande
// della guida (quota, superficie, ostacoli, bordo). Non sa niente di input, veicoli, camera o menù: quelli stanno in `hub/index.ts`
// e `hub/guida.ts`. Il mondo vero sta nei file `mondo_*.ts`: terreno e pianta (mondo_terreno), geometria procedurale (mondo_mesh),
// pezzi e regole (mondo_pezzi, mondo_segnaposto), montaggio del kit (mondo_kit), cielo e luce (mondo_cielo).
import * as THREE from 'three';
import { loaderCorse } from '../veicoli_kit.ts';
import { geoTela, nebbiaABande } from './mondo_base.ts';
import { NEBBIA, creaAtmosfera, texAcqua } from './mondo_cielo.ts';
import { montaKit, riquadroTele, unisci } from './mondo_kit.ts';
import { Tele, acquaInTela, costruzioniInTele, stradeInTele, terrenoInTele } from './mondo_mesh.ts';
import { piazza } from './mondo_pezzi.ts';
import { MARE, NRIQ, RIQ, X0, Z0, creaTerreno } from './mondo_terreno.ts';

/** Entro questa distanza (m, dalla camera al bordo del riquadro) il riquadro si disegna intero; oltre, terreno a 4 m e sagome. */
const VICINO = 62;

export type IdPorta = 'spiaggia' | 'ghiaccio' | 'giungla' | 'neon' | 'lunapark' | 'fondale';
/** Una porta di zona: davanti (x, z) c'è il punto dove il veicolo «entra» (entro `raggio` m); `yaw` = verso dove guarda chi entra. */
export type PortaHub = { id: IdPorta; nome: string; x: number; z: number; yaw: number; raggio: number; aperta: boolean };
/** Un posto dove si ferma il veicolo (garage, molo): centro, raggio d'ingresso e verso di partenza. */
export type PostoHub = { x: number; z: number; yaw: number; raggio: number };
export type Superficie = 'strada' | 'erba' | 'sabbia' | 'neve' | 'legno' | 'roccia' | 'acqua';
/** Ostacolo tondo in pianta (tronchi, lampioni, case, pile di gomme…): il veicolo ci rimbalza contro. */
export type Ostacolo = { x: number; z: number; r: number };
/** Per la minimappa: le strade come spezzate, il contorno dell'isola, i posti. */
export type Pianta = { costa: [number, number][]; strade: [number, number][][]; min: [number, number]; max: [number, number] };

export type MondoHub = {
  /** Tutto il mondo (terreno, mare, pezzi). Va messo nella scena di `hub/index.ts`. */
  readonly gruppo: THREE.Group;
  /** Si risolve quando il kit è scaricato e montato (prima il mondo c'è già, con il terreno e le strade). */
  readonly pronta: Promise<{ pezzi: number; triangoli: number }>;
  /** Livello del mare (m). */
  readonly mare: number;
  /** Quota del terreno/strada/molo in (x, z), in m. Sotto `mare` = acqua. Continua (salvo i trampolini: gradino voluto). */
  quota(x: number, z: number): number;
  superficie(x: number, z: number): Superficie;
  /** true = qui non si va (mare aperto oltre la riva, montagne a picco): la guida respinge il veicolo. */
  fuori(x: number, z: number): boolean;
  /** Ostacoli vicini a (x, z) entro `r` m (griglia interna: costa poco chiamarla a ogni tick). */
  ostacoli(x: number, z: number, r: number): Ostacolo[];
  readonly porte: PortaHub[];
  readonly garage: PostoHub;
  /** Dove si parte arrivando dalla barca, e dove si torna in barca. */
  readonly molo: PostoHub;
  readonly pianta: Pianta;
  /** Cielo, nebbia e luci dell'hub sulla scena (`hub/index.ts` lo chiama una volta), poi `segui` sposta il sole col veicolo. */
  atmosfera(scene: THREE.Scene): { segui(x: number, z: number): void };
  /** Animazioni (bandiere, teste dei manichini, ruota panoramica…): una volta a frame. */
  aggiorna(t: number, camera: THREE.Camera): void;
  dispose(): void;
};

export function creaHub(): MondoHub {
  const gruppo = new THREE.Group(); gruppo.name = 'corse_hub';
  const t = creaTerreno();
  const tele = new Tele();
  terrenoInTele(t, tele); stradeInTele(t, tele); costruzioniInTele(t, tele);
  const pz = piazza(t, tele);

  // materiali: prima dell'atlas i colori pieni della palette, poi l'atlas a pixel (stessa geometria, altri colori)
  const matPre = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const matA = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const matEPre = new THREE.MeshBasicMaterial({ vertexColors: true });
  const matE = new THREE.MeshBasicMaterial({ vertexColors: true });
  const acquaTex = texAcqua();
  const matAcqua = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: acquaTex });
  for (const m of [matPre, matA, matEPre, matE, matAcqua]) nebbiaABande(m);

  // riquadri (subito, coi colori pieni): terreno vicino/lontano (riceve le ombre), pezzi vicino/lontano (fanno ombra)
  type Riq = { k: number; x0: number; z0: number; tV: THREE.Mesh; pV: THREE.Mesh; L: THREE.Mesh; O: THREE.Mesh; vicino: boolean };
  const riquadri = new Map<number, Riq>();
  const mesh = (g: THREE.BufferGeometry, nome: string, ombra: boolean) => { const m = new THREE.Mesh(g, matPre); m.name = nome; m.receiveShadow = true; m.castShadow = ombra; m.visible = false; gruppo.add(m); return m; };
  const vuota = () => new THREE.BufferGeometry();
  // l'ombra dei pezzi la fanno le loro sagome (alberi a cono, edifici interi): mesh che non si vede (non scrive colore né profondità)
  const matOmbra = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const ombra = (g: THREE.BufferGeometry, k: number) => { const m = new THREE.Mesh(g, matOmbra); m.name = 'hub_ombra_' + k; m.castShadow = true; m.receiveShadow = false; m.visible = false; gruppo.add(m); return m; };
  for (const k of tele.riquadri()) {
    const r = riquadroTele(tele, k, true), u = (gs: THREE.BufferGeometry[]) => (gs.length ? unisci(gs) : vuota());
    riquadri.set(k, { k, x0: X0 + (k % NRIQ) * RIQ, z0: Z0 + Math.floor(k / NRIQ) * RIQ, tV: mesh(u(r.tV), 'hub_terra_' + k, false), pV: mesh(u(r.pV), 'hub_pezzi_' + k, false), L: mesh(u([...r.tL, ...r.pL]), 'hub_lontano_' + k, false), O: ombra(vuota(), k), vicino: true });
  }
  let luci = new THREE.Mesh(geoTela(tele.e), matEPre); luci.name = 'hub_luci'; luci.frustumCulled = false; gruppo.add(luci);
  const acqua = new THREE.Mesh(geoTela(acquaInTela(t)), matAcqua); acqua.name = 'hub_mare'; acqua.receiveShadow = true; acqua.frustumCulled = false; gruppo.add(acqua);
  let teste: THREE.InstancedMesh | null = null, ruota: THREE.Mesh | null = null;

  // ostacoli in una griglia da 8 m
  const OG = 8, og = new Map<number, Ostacolo[]>();
  const ok = (i: number, j: number) => (i + 256) * 512 + (j + 256);
  for (const o of pz.ostacoli) {
    for (let i = Math.floor((o.x - o.r) / OG); i <= Math.floor((o.x + o.r) / OG); i++) for (let j = Math.floor((o.z - o.r) / OG); j <= Math.floor((o.z + o.r) / OG); j++) {
      const k = ok(i, j); let a = og.get(k); if (!a) og.set(k, (a = [])); a.push(o);
    }
  }

  const pronta = (async () => {
    const l = await loaderCorse();
    const atlas = (await l.texture('atlas.png')).clone(); atlas.flipY = false; atlas.needsUpdate = true; // le UV delle glb hanno l'origine in alto
    matA.map = atlas; matE.map = atlas; matA.needsUpdate = true; matE.needsUpdate = true;
    const m = await montaKit(l, tele, pz.pezzi, pz.teste, pz.ruota, matA);
    for (const [k, g] of m.riquadri) {
      const r = riquadri.get(k); if (!r) continue;
      for (const [chi, geo] of [['tV', g.tV], ['pV', g.pV], ['L', g.L]] as const) {
        const ms = r[chi]; ms.geometry.dispose(); ms.geometry = geo ?? vuota(); ms.material = matA;
      }
      r.O.geometry.dispose(); r.O.geometry = g.O ?? vuota();
    }
    gruppo.remove(luci); luci.geometry.dispose();
    luci = new THREE.Mesh(m.luci, matE); luci.name = 'hub_luci'; luci.frustumCulled = false; gruppo.add(luci);
    if (m.teste) { teste = m.teste; gruppo.add(teste); }
    if (m.ruota) { ruota = m.ruota; gruppo.add(ruota); }
    if (m.mancanti.length) console.info('[hub] pezzi del kit ancora mancanti (segnaposto):', m.mancanti.join(' '));
    (globalThis as { __hub?: Record<string, unknown> }).__hub!['conteggi'] = m.conteggi;
    let tri = 0; for (const [, r] of riquadri) tri += (r.tV.geometry.attributes.position?.count ?? 0) / 3 + (r.pV.geometry.attributes.position?.count ?? 0) / 3;
    return { pezzi: m.pezzi, triangoli: Math.round(tri + m.luci.attributes.position!.count / 3 + acqua.geometry.attributes.position!.count / 3) };
  })();
  pronta.catch((e: unknown) => console.warn('[hub] kit non caricato:', e));

  const strade = t.strade.map((s) => s.c.filter((_, i) => i % 6 === 0 || i === s.c.length - 1).map((c) => [Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10] as [number, number]));
  let atm: ReturnType<typeof creaAtmosfera> | null = null;
  const mondo: MondoHub = {
    gruppo, pronta, mare: MARE,
    quota: t.quota, superficie: t.superficie, fuori: t.fuori,
    ostacoli(x, z, r) {
      const out: Ostacolo[] = [], visti = new Set<Ostacolo>();
      for (let i = Math.floor((x - r) / OG); i <= Math.floor((x + r) / OG); i++) for (let j = Math.floor((z - r) / OG); j <= Math.floor((z + r) / OG); j++)
        for (const o of og.get(ok(i, j)) ?? []) if (!visti.has(o) && (o.x - x) ** 2 + (o.z - z) ** 2 < (r + o.r) ** 2) { visti.add(o); out.push(o); }
      return out;
    },
    porte: pz.porte, garage: pz.garage, molo: pz.molo,
    pianta: { costa: t.costa, strade, min: [X0 + 40, Z0 + 40], max: [-X0 - 40, -Z0 - 40] },
    atmosfera(scene) {
      atm = creaAtmosfera(scene);
      return { segui: (x, z) => atm!.segui(x, z) };
    },
    aggiorna(tm, camera) {
      const cam = camera as THREE.PerspectiveCamera;
      // il cielo segue la camera (dentro il piano lontano)
      if (atm) { atm.cielo.position.copy(cam.position); atm.cielo.scale.setScalar((cam.far || 900) * 0.9); }
      acquaTex.offset.set((tm * 0.05) % 1, (tm * 0.11) % 1);
      if (ruota) ruota.rotation.z = tm * 0.12;
      // i riquadri: da vicino interi, da lontano terreno a 4 m e sagome, oltre la nebbia niente
      const cx = cam.position.x, cz = cam.position.z;
      for (const [, r] of riquadri) {
        const dx = Math.max(r.x0 - cx, 0, cx - r.x0 - RIQ), dz = Math.max(r.z0 - cz, 0, cz - r.z0 - RIQ), d = Math.sqrt(dx * dx + dz * dz);
        r.vicino = d < VICINO + (r.vicino ? 12 : 0);
        const dentro = d < NEBBIA.lontano + 20;
        r.tV.visible = r.pV.visible = r.O.visible = dentro && r.vicino;
        r.L.visible = dentro && !r.vicino;
      }
    },
    dispose() {
      gruppo.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      for (const m of [matPre, matA, matEPre, matE, matAcqua, matOmbra]) m.dispose();
      acquaTex.dispose();
      if (atm) { atm.cielo.removeFromParent(); atm.cielo.geometry.dispose(); atm.luci.removeFromParent(); }
    },
  };
  // aggancio per i test e le foto
  (globalThis as { __hub?: unknown }).__hub = { mondo, pronta, gruppo, pezzi: pz.pezzi.length, teste: pz.teste.length, ostacoli: pz.ostacoli.length };
  return mondo;
}
