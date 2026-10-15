// La scenografia della discesa (#229): i pezzi del kit `cs_d_*` piazzati con regole lungo il sentiero e fusi per tratti da 60 m (un draw
// call per tratto; i tratti lontani si spengono). Il senso di velocità viene da qui: erba, fiori e felci fitti a un passo dal sentiero,
// alberi che sfrecciano accanto.
// - Cresta: erba alta e fiori sui bordi, sassi e massi sparsi, pini piegati dal vento (pochi verso il dirupo, così il mare si vede).
// - Bosco: abeti e tronchi alti fitti vicino al sentiero e più radi lontano, felci e cespugli sui bordi.
// - Sul sentiero: i sassi e i ceppi della sim (stesse posizioni e misure), le rampe, i tronchi da saltare, le radici.
// Le posizioni sono a caso ma sempre uguali (seme fisso). Niente pezzi sul sentiero di un altro tratto (tornanti): si guarda il terreno.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BICI } from '@marea/content/corse_discesa.ts';
import { campo, punto, nuovaTerna, terna } from '@marea/sim/corse/nastro.ts';
import type { Sentiero } from '@marea/sim/corse/bici.ts';
import { pezzo } from './kit.ts';
import type { Terreno } from './terreno.ts';

export const PEZZI = [
  'cs_d_bici_telaio', 'cs_d_bici_sterzo', 'cs_d_bici_ruota', 'cs_d_braccia',
  'cs_d_abete_a', 'cs_d_abete_b', 'cs_d_pino_cresta', 'cs_d_tronco_alto', 'cs_d_tronco', 'cs_d_ceppo', 'cs_d_sasso_a', 'cs_d_sasso_b', 'cs_d_masso',
  'cs_d_radici', 'cs_d_cespuglio', 'cs_d_fiori', 'cs_d_erba', 'cs_d_felce', 'cs_d_cartello', 'cs_d_rampa',
] as const;

const TRATTO = 40, ACCESO = 220;
function rng(seme: number) {
  let t = seme >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export type Scenografia = { group: THREE.Group; pezzi: number; tris: number; vicino(p: THREE.Vector3): void };

export function creaScenografia(S: Sentiero, ter: Terreno): Scenografia {
  const n = S.n, d = S.def, caso = rng(2026), P3: [number, number, number] = [0, 0, 0], T = nuovaTerna();
  const tratti: { nome: string; m: THREE.Matrix4 }[][] = [];
  /** I pezzi piccoli (erba, fiori, felci, cespugli, radici) non fanno ombra: vanno in una mesh a parte per tratto. */
  const PICCOLI = new Set(['cs_d_erba', 'cs_d_fiori', 'cs_d_felce', 'cs_d_cespuglio', 'cs_d_radici']);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), v = new THREE.Vector3();
  let pezzi = 0;
  /** `scala` uguale sui tre assi, o [larghezza, altezza] (x e z, y). */
  const metti = (nome: string, s: number, x: number, y: number, z: number, yaw: number, scala: number | [number, number], inclina = 0) => {
    if (!pezzo(nome)) return;
    const i = Math.max(0, Math.floor(s / TRATTO));
    e.set(inclina * (caso() - 0.5), yaw, inclina * (caso() - 0.5)); q.setFromEuler(e); v.set(x, y, z);
    if (typeof scala === 'number') sc.setScalar(scala); else sc.set(scala[0], scala[1], scala[0]);
    (tratti[i] ??= []).push({ nome, m: m4.clone().compose(v, q, sc) });
    pezzi++;
  };
  /** Un pezzo accanto al sentiero a `s`, `lat` m dal centro: solo se lì non c'è un altro tratto del sentiero (tornanti) né il vuoto. */
  const fuori = (nome: string, s: number, lat: number, scala: number, margine = 0.4, inclina = 0.12) => {
    punto(n, s, lat, 0, P3);
    const inf = ter.info(P3[0], P3[2]);
    if (!inf || inf.fuori < Math.abs(lat) - campo(n, n.l, s) - 0.5 || inf.fuori < margine) return;
    if (inf.fuori < 4 && d.legno.some((t) => inf.s > t.da - 3 && inf.s < t.a + 3)) return; // accanto alle tavole niente: la terra è più giù
    if (inf.fuori < 16 && d.ruscelli.some((r) => inf.s > r.s - 2 && inf.s < r.s + r.largo + 2)) return; // nel fosso del ruscello niente: la terra è più giù
    metti(nome, inf.s, P3[0], inf.y - 0.05, P3[2], caso() * Math.PI * 2, scala, inclina);
  };
  const zonaA = (s: number) => d.zone.find((z) => s >= z.da && s < z.a)?.tipo ?? 'bosco';
  const latoA = (s: number, lato: -1 | 1) => d.lati.find((l) => l.lato === lato && s >= l.da && s < l.a)?.tipo ?? 'prato';
  const bordo = d.bordo;

  for (let s = 0; s < n.len; s += 1) {
    const l = campo(n, n.l, s), zona = zonaA(s);
    for (const lato of [-1, 1] as const) {
      const tipo = latoA(s, lato), r = () => caso();
      if (zona === 'cresta') {
        if (r() < 0.75) fuori('cs_d_erba', s, lato * (l + 0.15 + r() * 3.2), 0.8 + r() * 0.6, 0.1);
        if (r() < 0.35) fuori('cs_d_fiori', s, lato * (l + 0.3 + r() * 6), 0.8 + r() * 0.5, 0.2);
        if (r() < 0.25) fuori('cs_d_erba', s, lato * (l + 3 + r() * 14), 1 + r() * 0.6);
        if (r() < 0.1) fuori(r() < 0.5 ? 'cs_d_sasso_a' : 'cs_d_sasso_b', s, lato * (l + bordo + r() * 14), 0.7 + r() * 1.2);
        if (r() < 0.025) fuori('cs_d_masso', s, lato * (l + bordo + 4 + r() * 30), 0.8 + r() * 0.8, 2, 0.3);
        if (r() < (tipo === 'dirupo' ? 0.02 : 0.05)) fuori('cs_d_pino_cresta', s, lato * (l + bordo + 2 + r() * 34), 0.8 + r() * 0.5, 1, 0.08);
      } else {
        if (r() < 0.3) fuori('cs_d_felce', s, lato * (l + 0.2 + r() * 2.5), 0.8 + r() * 0.5, 0.1);
        if (r() < 0.12) fuori('cs_d_cespuglio', s, lato * (l + 0.8 + r() * 4), 0.7 + r() * 0.5, 0.3);
        if (r() < 0.2) fuori('cs_d_erba', s, lato * (l + 0.1 + r() * 2), 0.6 + r() * 0.4, 0.1);
        if (r() < 0.22) { const a = l + bordo + 0.6 + r() * 9; fuori(r() < 0.3 ? 'cs_d_tronco_alto' : r() < 0.5 ? 'cs_d_abete_a' : 'cs_d_abete_b', s, lato * a, 0.8 + r() * 0.45, 1.5, 0.05); }
        if (r() < 0.085) fuori(r() < 0.3 ? 'cs_d_tronco_alto' : r() < 0.5 ? 'cs_d_abete_a' : 'cs_d_abete_b', s, lato * (l + bordo + 10 + r() * 50), 0.9 + r() * 0.4, 4, 0.05);
        if (r() < 0.04) fuori(r() < 0.5 ? 'cs_d_sasso_a' : 'cs_d_ceppo', s, lato * (l + bordo + r() * 8), 0.8 + r() * 0.6);
      }
    }
  }
  // sul sentiero: ostacoli della sim (misure vere), rampe e tronchi, radici
  const yaw = (s: number) => { terna(n, s, T); return Math.atan2(-T.tx, -T.tz); }; // il davanti dei modelli è −Z
  // i sassi con la base e l'altezza della sim (la base del corpo del sasso = BICI.sasso.base × r, models_discesa.py: sasso_a raggio
  // 0,45 alto 0,62, sasso_b raggio 0,62 alto 0,48); il ceppo è già della misura giusta
  const base = BICI.sasso.base;
  for (const o of d.ostacoli) {
    punto(n, o.s, o.lat, 0, P3);
    if (o.tipo === 'ceppo') { metti('cs_d_ceppo', o.s, P3[0], P3[1] - 0.05, P3[2], caso() * Math.PI * 2, o.r / 0.32); continue; }
    const a = caso() < 0.5, raggio = a ? 0.45 : 0.62, alto = a ? 0.62 : 0.48;
    metti(a ? 'cs_d_sasso_a' : 'cs_d_sasso_b', o.s, P3[0], P3[1] - 0.05, P3[2], caso() * Math.PI * 2, [(o.r * base) / raggio, o.alto / alto]);
  }
  // rampe e tronchi dove li mette la sim (`rilievo`): la rampa del kit è lunga 3 e alta 1 col labbro a −Z, il tronco centrato
  for (const r of d.rampe) {
    const s = r.tipo === 'tronco' ? r.s : r.s - 1.5 * r.alto; punto(n, s, 0, 0, P3);
    if (r.tipo === 'tronco') metti('cs_d_tronco', r.s, P3[0], P3[1], P3[2], yaw(s) + Math.PI / 2, 1);
    else metti('cs_d_rampa', r.s, P3[0], P3[1], P3[2], yaw(s), r.alto);
  }
  for (const t of d.radici) for (let s = t.da + 1; s < t.a; s += 2.2 + caso() * 1.5) { punto(n, s, 0, 0, P3); metti('cs_d_radici', s, P3[0], P3[1] - 0.02, P3[2], yaw(s) + (caso() - 0.5) * 0.6, 0.9 + caso() * 0.3); }
  { punto(n, 6, -campo(n, n.l, 6) - 1.2, 0, P3); metti('cs_d_cartello', 6, P3[0], P3[1], P3[2], yaw(6) + Math.PI * 0.3, 1); }

  // fusione per tratti
  const group = new THREE.Group(); group.name = 'scenografia';
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const meshes: THREE.Mesh[] = [];
  let tris = 0;
  tratti.forEach((lista, i) => {
    for (const piccoli of [false, true]) {
      const parte = (lista ?? []).filter((x) => PICCOLI.has(x.nome) === piccoli);
      if (!parte.length) continue;
      const geos = parte.map(({ nome, m }) => pezzo(nome)!.clone().applyMatrix4(m));
      const g = mergeGeometries(geos)!; for (const x of geos) x.dispose();
      g.computeBoundingSphere();
      tris += g.attributes.position!.count / 3;
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = !piccoli; mesh.receiveShadow = true; mesh.name = `scenografia_${i}${piccoli ? '_piccoli' : ''}`;
      mesh.userData.centro = g.boundingSphere!.center.clone(); mesh.userData.piccoli = piccoli;
      meshes.push(mesh); group.add(mesh);
    }
  });
  return {
    group, pezzi, tris,
    vicino(p) { for (const m of meshes) m.visible = (m.userData.centro as THREE.Vector3).distanceTo(p) < (m.userData.piccoli ? ACCESO * 0.4 : ACCESO); },
  };
}
