// I veicoli e gli animali piloti veri delle Corse (#178): i glb di `assets/blender/models_corse_veicoli*.py` e `models_corse_piloti*.py`
// (manifest_corse.json) trasformati in geometria a colori per vertice, come tutto il resto del motore v2: il colore di ogni vertice è
// il texel piatto dell'atlas (p_<colore> della palette), così si fondono col pilota di prima e usano lo stesso materiale.
// Muso verso −Z, perno a terra. Il pilota animale è il modello in piedi tagliato all'anca e seduto sul sedile del veicolo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createLoader } from '../render/loader.ts';
import type { Loader } from '../render/loader.ts';

/** Il modello vero di ogni veicolo della sim (gli id di packages/content/src/corse/motore.json). Chi non c'è resta il segnaposto. */
export const MODELLO: Record<string, string> = {
  kart: 'cs_v_kart', auto: 'cs_v_sportiva', carrello: 'cs_v_carrello_spesa', moto_acqua: 'cs_v_moto_acqua', vasca: 'cs_v_vasca',
};
/** Tutti i modelli (per provarli sul banco con l'aspetto a scelta, anche dove la sim non ha ancora il veicolo). */
export const ASPETTI = [
  'cs_v_kart', 'cs_v_sportiva', 'cs_v_fuoristrada', 'cs_v_moto', 'cs_v_moto_acqua', 'cs_v_bob', 'cs_v_carrello_miniera', 'cs_v_carrello_spesa',
  'cs_v_vasca', 'cs_v_divano', 'cs_v_ape', 'cs_v_struzzo', 'cs_v_pizza', 'cs_v_papera',
] as const;
/** Gli animali piloti, in ordine: il primo bot è il granchio, il secondo il tricheco… */
export const PILOTI = ['cs_p_granchio', 'cs_p_tricheco', 'cs_p_struzzo', 'cs_p_gorilla', 'cs_p_fenicottero', 'cs_p_tartaruga'] as const;

/** Lunghezza a schermo di ogni modello (m): la stessa del segnaposto che sostituisce, così pista e camera non cambiano. */
const LUNG: Record<string, number> = {
  cs_v_kart: 2.7, cs_v_sportiva: 3.5, cs_v_fuoristrada: 3.3, cs_v_moto: 2.5, cs_v_moto_acqua: 3.0, cs_v_bob: 3.0, cs_v_carrello_miniera: 2.9,
  cs_v_carrello_spesa: 2.2, cs_v_vasca: 2.7, cs_v_divano: 3.0, cs_v_ape: 3.0, cs_v_struzzo: 2.6, cs_v_pizza: 3.1, cs_v_papera: 2.7,
};
/** Dove si siede il pilota nel modello (m, prima della scala): [altezza della seduta, avanti(−)/indietro(+)]. */
const SEDILE: Record<string, [number, number]> = {
  cs_v_kart: [0.42, 0.18], cs_v_sportiva: [0.5, 0.2], cs_v_fuoristrada: [0.55, 0.2], cs_v_moto: [0.85, 0.2], cs_v_moto_acqua: [0.8, 0.25],
  cs_v_bob: [0.5, 0.1], cs_v_carrello_miniera: [0.55, 0], cs_v_carrello_spesa: [0.4, 0.1], cs_v_vasca: [0.45, 0.2], cs_v_divano: [0.6, 0.15],
  cs_v_ape: [0.65, 0.1], cs_v_struzzo: [1.3, 0.05], cs_v_pizza: [0.5, 0.1], cs_v_papera: [0.85, 0],
};
/** Quanto può essere grande il pilota in ogni veicolo: [quanto spunta sopra il sedile al massimo, larghezza massima] in m (sotto un tetto sta nel finestrino). */
const MAX_PILOTA: Record<string, [number, number]> = {
  cs_v_sportiva: [0.62, 0.95], cs_v_ape: [0.8, 1.0], cs_v_fuoristrada: [1.0, 1.1], cs_v_moto: [1.0, 0.8], cs_v_moto_acqua: [1.1, 0.95],
  cs_v_bob: [1.1, 1.0], cs_v_kart: [1.2, 1.2], cs_v_papera: [1.1, 1.0], cs_v_carrello_spesa: [1.1, 1.0],
};
/** Quanto del pilota in piedi sta sotto la seduta (frazione dell'altezza: sopra si tiene) e quanto deve spuntare sopra il sedile (m). */
const ANCA: Record<string, [number, number]> = {
  cs_p_granchio: [0, 0.85], cs_p_tricheco: [0.36, 1.15], cs_p_struzzo: [0.43, 1.5], cs_p_gorilla: [0.4, 1.15], cs_p_fenicottero: [0.45, 1.5],
  cs_p_tartaruga: [0.3, 1.0],
};

type Pezzo = { geo: THREE.BufferGeometry; alt: number; lung: number };
const kit = new Map<string, Pezzo>();
let pronto = false, promessa: Promise<void> | null = null;
export const kitPronto = (): boolean => pronto;

/** Quantizza position/normal/uv in float32 puri (le glb quantizzate arrivano normalizzate in Int16) e li rende non indicizzati. */
function float32(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv'] as const) {
    const a = src.attributes[k]; if (!a) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = c === 0 ? a.getX(i) : c === 1 ? a.getY(i) : a.getZ(i);
    out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}

/** Carica una volta sola tutti i modelli del kit; poi `veicoloKit` è sincrono. Se manca un file il segnaposto resta. */
let loaderP: Promise<Loader> | null = null;
/** Il loader del gioco con anche il manifest delle Corse (una volta sola: lo usano anche l'avatar e la scenografia). */
export function loaderCorse(): Promise<Loader> {
  return (loaderP ??= createLoader({ base: '/assets/' }).then(async (l) => { await l.extend('manifest_corse.json'); return l; }));
}

export function caricaKit(): Promise<void> {
  if (promessa) return promessa;
  promessa = (async () => {
    const l = await loaderCorse();
    const tex = await l.texture('atlas.png');
    const img = tex.image as CanvasImageSource & { width: number; height: number };
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true })!; cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    const col = new THREE.Color();
    for (const nome of [...ASPETTI, ...PILOTI]) {
      if (!l.has(nome)) continue;
      const { scene } = await l.load(nome);
      scene.updateMatrixWorld(true);
      const parts: THREE.BufferGeometry[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const g = float32(m.geometry); g.applyMatrix4(m.matrixWorld);
        const uv = g.attributes.uv!, n = g.attributes.position!.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { // il colore di un vertice è il texel dell'atlas sotto la sua UV (le glb hanno l'origine in alto)
          const x = Math.min(cv.width - 1, Math.max(0, Math.floor(uv.getX(i) * cv.width))), y = Math.min(cv.height - 1, Math.max(0, Math.floor(uv.getY(i) * cv.height)));
          const k = (y * cv.width + x) * 4;
          col.setRGB(px[k]! / 255, px[k + 1]! / 255, px[k + 2]! / 255, THREE.SRGBColorSpace);
          c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv');
        parts.push(g);
      });
      if (!parts.length) continue;
      const geo = mergeGeometries(parts)!; geo.computeBoundingBox();
      const b = geo.boundingBox!;
      kit.set(nome, { geo, alt: b.max.y - b.min.y, lung: b.max.z - b.min.z });
    }
    pronto = true;
  })().catch((e) => { console.warn('[corse] kit dei veicoli non caricato, restano i segnaposto', e); });
  return promessa;
}

/** Il pilota animale tagliato all'anca, ridotto e seduto: `y`, `z` = seduta del veicolo (già scalata). */
function animale(nome: string, y: number, z: number, modello: string, scalaVeicolo: number): THREE.BufferGeometry | null {
  const k = kit.get(nome), cfg = ANCA[nome]; if (!k || !cfg) return null;
  const [frac, spuntaBase] = cfg, [maxAlto, maxLargo] = MAX_PILOTA[modello] ?? [1.3, 1.4];
  const taglio = k.alt * frac, visibile = k.alt - taglio, bb = k.geo.boundingBox!;
  const spunta = Math.min(spuntaBase, maxAlto) * Math.min(1, 0.6 + 0.4 * scalaVeicolo), s = Math.min(spunta / visibile, (maxLargo * scalaVeicolo) / (bb.max.x - bb.min.x));
  const p = k.geo.attributes.position!, nrm = k.geo.attributes.normal!, col = k.geo.attributes.color!;
  const P: number[] = [], N: number[] = [], Cc: number[] = [];
  const bmin = k.geo.boundingBox!.min.y;
  for (let t = 0; t < p.count; t += 3) {
    if ((p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3 - bmin < taglio) continue;
    for (let j = 0; j < 3; j++) {
      P.push(p.getX(t + j), p.getY(t + j), p.getZ(t + j)); N.push(nrm.getX(t + j), nrm.getY(t + j), nrm.getZ(t + j));
      Cc.push(col.getX(t + j), col.getY(t + j), col.getZ(t + j));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -(bmin + taglio), 0).premultiply(new THREE.Matrix4().makeScale(s, s, s)).premultiply(new THREE.Matrix4().makeTranslation(0, y, z)));
  return g;
}

export type VeicoloKit = { geo: THREE.BufferGeometry; occhi: [number, number] };

/** Il veicolo vero: `modello` (cs_v_…), il pilota animale se c'è (`pilota`, cs_p_…) o quello segnaposto (`segnaposto` lo disegna il chiamante
 *  con altezza e posizione della seduta). null se il kit non c'è: si usa il segnaposto intero. */
export function veicoloKit(modello: string, pilota: string | null, senzaPilota: boolean, segnaposto: (y: number, z: number) => THREE.BufferGeometry): VeicoloKit | null {
  const v = kit.get(modello); if (!v) return null;
  const s = (LUNG[modello] ?? v.lung) / v.lung, [sy, sz] = SEDILE[modello] ?? [0.5, 0.1];
  const body = v.geo.clone().applyMatrix4(new THREE.Matrix4().makeScale(s, s, s));
  const y = sy * s, z = sz * s;
  const a = pilota ? animale(pilota, y, z, modello, s) : null;
  const geo = senzaPilota ? body : mergeGeometries([body, a ?? segnaposto(y, z)])!;
  const spunta = pilota && !senzaPilota ? Math.min(ANCA[pilota]?.[1] ?? 1, (MAX_PILOTA[modello] ?? [1.3, 1.4])[0]) : 0.8;
  return { geo, occhi: [y + spunta - 0.1, 0.42 - z] };
}

/** Il modello che si disegna per un veicolo della sim (o per l'aspetto scelto). */
export const modelloDi = (id: string, aspetto?: string | null): string | null => aspetto || MODELLO[id] || null;

/** Dove siede l'avatar MAREA (1,6 m) sul veicolo, in coordinate del veicolo già scalato: `seat` per `attachTo` e `scala` dell'avatar
 *  (sotto un tetto si fa più piccolo, come gli animali). Senza modello (il gommone): il segnaposto. */
export function postoAvatar(id: string, aspetto?: string | null): { seat: { x: number; y: number; z: number }; scala: number } {
  const modello = modelloDi(id, aspetto), v = modello ? kit.get(modello) : null;
  const [sy, sz, s] = modello && v ? [...(SEDILE[modello] ?? [0.5, 0.1]), (LUNG[modello] ?? v.lung) / v.lung] as [number, number, number] : [0.3, 0.6, 1];
  const scala = Math.max(0.5, Math.min(1, (modello ? (MAX_PILOTA[modello] ?? [1.3, 1.4])[0] : 1.3) / 1.05));
  // il bacino da seduto sta 0,42 m sopra i piedi dell'avatar e 0,12 sopra la seduta; `attachTo` toglie 0,37 (SEAT_DROP di avatar.ts)
  return { seat: { x: 0, y: sy * s + 0.37 - 0.3 * scala, z: sz * s }, scala };
}
