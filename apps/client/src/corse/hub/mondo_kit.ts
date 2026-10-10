// Il montaggio dei pezzi dell'hub (#185): scarica il kit (loader del gioco + manifest_corse.json, come corse/scena.ts), sceglie per
// ogni nome il pezzo vero, l'alternativa o il segnaposto, e fonde tutto per riquadro col terreno: UNA mesh sull'atlas per riquadro,
// UNA mesh emissiva per tutto l'hub, le teste dei manichini in un InstancedMesh, la ruota panoramica a parte (gira).
import * as THREE from 'three';
import type { Loader } from '../../render/loader.ts';
import { Tela, geoTela, guarda } from './mondo_base.ts';
import type { NomeP, Pennello } from './mondo_base.ts';
import { chiave } from './mondo_mesh.ts';
import type { Strato, Tele } from './mondo_mesh.ts';
import { ALTERNATIVE } from './mondo_pezzi.ts';
import type { Pezzo, Testa } from './mondo_pezzi.ts';
import { segnaposto } from './mondo_segnaposto.ts';

type Parte = { geo: THREE.BufferGeometry; emissivo: boolean };

function float32(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of ['position', 'normal', 'uv']) {
    const a = g.attributes[k]; if (!a) continue;
    if (a.array instanceof Float32Array && !(a as THREE.BufferAttribute).normalized) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}
/** Le parti di un modello del kit, già nelle coordinate del modello, con il colore bianco (moltiplica l'atlas: niente cambia). */
async function partiKit(l: Loader, nome: string): Promise<Parte[]> {
  const { scene } = await l.load(nome), out: Parte[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    let g = float32(m.geometry.clone()); g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 3).fill(1), 3));
    const nm = (Array.isArray(m.material) ? m.material[0] : m.material)?.name ?? '';
    out.push({ geo: g, emissivo: nm.startsWith('mat_emissivo') });
  });
  return out;
}
/** La geometria della tela coi colori «dopo l'atlas» (le tinte). */
export function geoTinta(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const t = g.userData['tinta'] as Float32Array | undefined;
  if (t) g.setAttribute('color', new THREE.Float32BufferAttribute(t, 3));
  return g;
}
function giraFacce(g: THREE.BufferGeometry): void {
  for (const k of ['position', 'normal', 'uv', 'color']) {
    const a = g.attributes[k]; if (!a) continue;
    const arr = a.array as Float32Array, w = a.itemSize;
    for (let t = 0; t < a.count; t += 3) for (let c = 0; c < w; c++) { const i1 = (t + 1) * w + c, i2 = (t + 2) * w + c, x = arr[i1]!; arr[i1] = arr[i2]!; arr[i2] = x; }
  }
}
/** Unisce geometrie non indicizzate con position/normal/uv/color. */
export function unisci(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0; for (const g of gs) n += g.attributes.position!.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) {
    const c = g.attributes.position!.count;
    pos.set(g.attributes.position!.array as Float32Array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array as Float32Array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array as Float32Array, o * 3); else col.fill(1, o * 3, (o + c) * 3);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/** Pezzi che si vedono interi anche da lontano (edifici, porte, monumenti); gli alberi e le rocce da lontano diventano sagome. */
const SEMPRE = /^(cs_h_porta_|cs_h_sbarra|cs_h_garage|cs_h_torre|cs_h_statua|cs_h_podio|cs_h_trofeo|cs_tribuna|cs_casa_|cs_h_tempio|cs_h_rovina|cs_h_palazzo|cs_h_tendone|cs_h_ruota_base|cs_faro|cs_h_igloo|cs_h_corallo|cs_barca_vela|boat_barca|cs_arco_via|cs_h_bancarella)/;
/** Sagome da lontano (12-20 triangoli, colori pieni): misure prese dai pezzi del kit. */
function sagoma(nome: string): THREE.BufferGeometry | null {
  const t = new Tela(), p = (c: NomeP): Pennello => ({ p: c });
  const albero = (h: number, r: number, tronco: number, chioma: NomeP, cima?: NomeP, dx = 0) => {
    t.prisma(dx * 0.5, 0, 0, r * 0.14, r * 0.1, tronco, 3, p('legno'), null);
    t.prisma(dx, tronco * 0.9, 0, r, cima ? 0.05 : r * 0.6, h - tronco * 0.9, 5, p(chioma), cima ? null : p(chioma));
  };
  switch (nome) {
    case 'cs_h_albero': albero(4.5, 1.8, 2, 'erbaScura'); break;
    case 'cs_h_albero_giungla': albero(9, 3, 5, 'bosco'); break;
    case 'cs_h_palma': albero(8.2, 2.8, 7.2, 'erba', undefined, 2.6); break;
    case 'prop_palma': albero(3.6, 1.3, 3.2, 'erba', undefined, 1); break;
    case 'cs_h_pino_neve': case 'cs_pino': albero(5.8, 1.8, 1, 'bosco', 'bosco'); break;
    case 'cs_h_roccia_a': case 'cs_scoglio_a': t.box(0, 0, 0, 4, 2.4, 3.6, 0.3, p('pietraScura'), p('pietra')); break;
    case 'cs_h_roccia_b': case 'cs_scoglio_b': t.box(0, 0, 0, 3, 1.1, 2.4, 0.3, p('pietraScura'), p('pietra')); break;
    default: return null;
  }
  return geoTinta(geoTela(t));
}

/** Le geometrie di un riquadro, per strato: terreno vicino e lontano (con le strade), pezzi vicino e lontano. */
/** `O` = le sagome che fanno l'ombra (da vicino): costano poco nel passaggio dell'ombra. */
export type Riquadro = { tV: THREE.BufferGeometry; pV: THREE.BufferGeometry | null; L: THREE.BufferGeometry | null; O: THREE.BufferGeometry | null };
/** Solo la geometria procedurale (senza i pezzi del kit): per i primi istanti, coi colori pieni (`pre`) o con le tinte. */
export function riquadroTele(tele: Tele, k: number, pre: boolean): { tV: THREE.BufferGeometry[]; tL: THREE.BufferGeometry[]; pV: THREE.BufferGeometry[]; pL: THREE.BufferGeometry[] } {
  const g = (s: Strato) => { const tl = tele.di(k, s); if (!tl || !tl.triangoli) return []; const x = geoTela(tl); return [pre ? x : geoTinta(x)]; };
  const p = g('p');
  return { tV: [...g('t'), ...g('s')], tL: [...g('tl'), ...g('sl')], pV: [...p, ...g('pv')], pL: p.map((x) => x.clone()) };
}
const fondi = (gs: THREE.BufferGeometry[]): THREE.BufferGeometry | null => { if (!gs.length) return null; const g = unisci(gs); for (const x of gs) x.dispose(); return g; };

export type Montato = { riquadri: Map<number, Riquadro>; luci: THREE.BufferGeometry; teste: THREE.InstancedMesh | null; ruota: THREE.Mesh | null; pezzi: number; triangoli: number; mancanti: string[]; conteggi: Record<string, number> };

/** Monta i pezzi: per ogni riquadro il terreno + i pezzi del kit (o segnaposto, o sagome da lontano), più le luci e le teste. */
export async function montaKit(l: Loader, tele: Tele, pezzi: Pezzo[], teste: Testa[], ruota: { x: number; y: number; z: number; ry: number } | null, matA: THREE.Material): Promise<Montato> {
  const kit = new Map<string, Parte[]>(), sagome = new Map<string, THREE.BufferGeometry | null>(), mancanti: string[] = [], conteggi: Record<string, number> = {};
  const risolvi = async (nome: string): Promise<Parte[]> => {
    const k = kit.get(nome); if (k) return k;
    let parti: Parte[] = [];
    const vero = [nome, ...(ALTERNATIVE[nome] ?? [])].find((n) => l.has(n));
    if (vero) { try { parti = await partiKit(l, vero); } catch (e) { console.warn('[hub] pezzo non caricato', vero, e); } }
    if (!parti.length) {
      const s = segnaposto(nome);
      if (s) parti = [{ geo: geoTinta(geoTela(s.a)), emissivo: false }, ...(s.e.triangoli ? [{ geo: geoTinta(geoTela(s.e)), emissivo: true }] : [])];
      if (!vero) mancanti.push(nome);
    }
    kit.set(nome, parti); sagome.set(nome, sagoma(vero ?? nome));
    return parti;
  };
  type Acc = { tV: THREE.BufferGeometry[]; tL: THREE.BufferGeometry[]; pV: THREE.BufferGeometry[]; pL: THREE.BufferGeometry[] };
  const acc = new Map<number, Acc>(), luci: THREE.BufferGeometry[] = [];
  for (const k of tele.riquadri()) acc.set(k, riquadroTele(tele, k, false));
  if (tele.e.triangoli) luci.push(geoTinta(geoTela(tele.e)));
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), S = new THREE.Vector3();
  let fatti = 0, triangoli = 0;
  for (const pz of pezzi) {
    const pp = await risolvi(pz.m); if (!pp.length) continue;
    conteggi[pz.m] = (conteggi[pz.m] ?? 0) + 1;
    const s = pz.s ?? 1, sx = s * (pz.sx ?? 1), sy = s * (pz.sy ?? 1);
    M4.compose(V.set(pz.x, pz.y, pz.z), Q.setFromAxisAngle(Y, pz.ry), S.set(sx, sy, s));
    const k = chiave(pz.x, pz.z);
    let r = acc.get(k); if (!r) acc.set(k, (r = { tV: [], tL: [], pV: [], pL: [] }));
    const sempre = SEMPRE.test(pz.m), sg = sagome.get(pz.m);
    for (const x of pp) {
      const g = x.geo.clone(); g.applyMatrix4(M4);
      if (sx < 0) giraFacce(g);
      if (x.emissivo) luci.push(g);
      else { r.pV.push(g); if (sempre) r.pL.push(g.clone()); }
      triangoli += g.attributes.position!.count / 3;
    }
    if (!sempre && sg) { const g = sg.clone(); g.applyMatrix4(M4); r.pL.push(g); }
    fatti++;
  }
  const riquadri = new Map<number, Riquadro>();
  for (const [k, a] of acc) {
    const tV = fondi(a.tV), tL = fondi(a.tL);
    const O = a.pL.length ? unisci(a.pL) : null;
    riquadri.set(k, { tV: tV ?? new THREE.BufferGeometry(), pV: fondi(a.pV), O, L: fondi([...(tL ? [tL] : []), ...a.pL]) });
  }
  const gl = unisci(luci); for (const x of luci) x.dispose();
  // le teste dei manichini
  let im: THREE.InstancedMesh | null = null;
  const tp = await risolvi('cs_manichino_testa');
  if (tp[0] && teste.length) { im = testeManichini(tp[0].geo, matA, teste); triangoli += (tp[0].geo.attributes.position!.count / 3) * teste.length; }
  // la ruota panoramica: il pezzo che gira, con il perno sul mozzo
  let ruotaM: THREE.Mesh | null = null;
  if (ruota) {
    const parti = await risolvi('cs_h_ruota_giro');
    const atlante = parti.filter((p) => !p.emissivo).map((p) => p.geo), em = parti.filter((p) => p.emissivo).map((p) => p.geo);
    if (atlante.length || em.length) {
      const g = unisci([...atlante, ...em]);
      // il perno è sul mozzo: il mozzo sta tanto in alto da non far toccare terra alle cabine (anche girando)
      const bb = g.boundingBox!, raggio = Math.max(-bb.min.y, bb.max.y, -bb.min.x, bb.max.x);
      ruotaM = new THREE.Mesh(g, matA); ruotaM.name = 'hub_ruota';
      ruotaM.position.set(ruota.x, ruota.y + raggio + 0.8, ruota.z); ruotaM.rotation.set(0, ruota.ry, 0);
      ruotaM.castShadow = true;
      triangoli += g.attributes.position!.count / 3;
    }
  }
  return { riquadri, luci: gl, teste: im, ruota: ruotaM, pezzi: fatti, triangoli: Math.round(triangoli), mancanti, conteggi };
}

/** Le teste dei manichini: guardano davanti a sé e si girano verso la camera quando passa vicino, a scatti (4 volte al secondo). */
function testeManichini(geo: THREE.BufferGeometry, mat: THREE.Material, teste: Testa[]): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, teste.length);
  im.name = 'hub_teste'; im.castShadow = false; im.frustumCulled = false;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(1, 1, 1), V = new THREE.Vector3();
  const ry = teste.map((h) => h.ry);
  // si disegnano solo le teste entro 110 m dalla camera (le prime `count` istanze)
  let cx = 0, cz = 0;
  const scrivi = () => {
    let n = 0;
    teste.forEach((h, i) => { if ((cx - h.x) ** 2 + (cz - h.z) ** 2 > 110 * 110) return; M4.compose(V.set(h.x, h.y, h.z), Q.setFromAxisAngle(Y, ry[i]!), S); im.setMatrixAt(n++, M4); });
    if (!n && teste[0]) { const h = teste[0]; M4.compose(V.set(h.x, h.y, h.z), Q.setFromAxisAngle(Y, ry[0]!), S); im.setMatrixAt(n++, M4); } // almeno una: se no onBeforeRender non torna più
    im.count = n; im.instanceMatrix.needsUpdate = true;
  };
  scrivi();
  let ultimo = 0;
  im.onBeforeRender = (_r, _s, cam) => {
    if (!(cam as THREE.PerspectiveCamera).isPerspectiveCamera) return;
    const ora = performance.now(); if (ora - ultimo < 250) return;
    ultimo = ora;
    cx = cam.position.x; cz = cam.position.z;
    teste.forEach((h, i) => {
      const d2 = (cx - h.x) ** 2 + (cz - h.z) ** 2;
      let a = h.ry;
      if (d2 < 34 * 34) { a = guarda(cx - h.x, cz - h.z); const dd = Math.atan2(Math.sin(a - h.ry), Math.cos(a - h.ry)); a = h.ry + Math.max(-1.6, Math.min(1.6, dd)); }
      ry[i] = a;
    });
    scrivi();
  };
  return im;
}
