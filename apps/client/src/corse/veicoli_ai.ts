// I veicoli delle Corse fatti con l'AI 3D (#281): da un'immagine pulita del veicolo (ChatGPT, stile della reference scelta da Jack)
// a un modello con texture (SAM 3 su Higgsfield, 1 credito), poi in Blender saldato, girato, scalato e alleggerito, poi
// `tools/veicolo_ai_leggero.mjs` (texture 512, senza normali, quantizzato): `public/assets/veicoli_ai/<modello>.glb`, ~150 KB, muso
// verso −Z, lungo quanto il modello del kit, ruote a terra, perno al centro. Sostituiscono solo la carrozzeria: il pilota (animale,
// segnaposto o avatar) resta quello di `veicoloGeo(…, senzaCarrozzeria)`. Si scaricano uno alla volta, quando un veicolo li chiede.
// Il materiale diventa Lambert con la texture, come il resto del mondo: la passata pixel lo tratta come gli altri.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { M, P, merged, painted } from '../render/island_parts.ts';

/** I modelli del kit che hanno la versione AI. */
export const VEICOLI_AI: readonly string[] = [
  'cs_v_kart', 'cs_v_sportiva', 'cs_v_fuoristrada', 'cs_v_moto', 'cs_v_moto_acqua', 'cs_v_bob', 'cs_v_carrello_miniera', 'cs_v_carrello_spesa',
  'cs_v_vasca', 'cs_v_divano', 'cs_v_ape', 'cs_v_struzzo', 'cs_v_pizza', 'cs_v_papera',
];
/** `?veicoli=kit` nell'indirizzo: i veicoli del kit Blender di prima, per confrontare. */
const spenti = typeof location !== 'undefined' && new URLSearchParams(location.search).get('veicoli') === 'kit';
const pronti = new Map<string, THREE.Object3D>(), inArrivo = new Map<string, Promise<void>>();
let loader: GLTFLoader | null = null;

/** Questo modello ha (o avrà, appena scaricata) la carrozzeria AI. */
export const haVeicoloAi = (modello: string | null | undefined): modello is string => !spenti && !!modello && VEICOLI_AI.includes(modello);

/** Scarica la carrozzeria AI di un modello (una volta sola); si risolve anche se il file non c'è (resta il kit). */
export function caricaVeicoloAi(modello: string | null | undefined): Promise<void> {
  if (!haVeicoloAi(modello)) return Promise.resolve();
  let p = inArrivo.get(modello);
  if (!p) {
    p = (loader ??= new GLTFLoader()).loadAsync(`/assets/veicoli_ai/${modello}.glb`).then((g) => {
      g.scene.traverse((o) => {
        const me = o as THREE.Mesh;
        if (!me.isMesh) return;
        me.castShadow = true; if (!me.userData['tipo']) me.name = 'veicolo_ai'; // ruote e gambe tengono il loro nome (veicolo_ai_pezzi)
        if (!me.geometry.attributes.normal) me.geometry.computeVertexNormals(); // il glb arriva senza normali: lisce qui
        const vecchio = me.material as THREE.MeshStandardMaterial;
        me.material = new THREE.MeshLambertMaterial({ map: vecchio.map, color: vecchio.color });
        vecchio.dispose();
      });
      const vuote: THREE.Object3D[] = [];
      g.scene.traverse((o) => { if (o.userData['tipo'] === 'ruota') vuote.push(o); });
      for (const o of vuote) { // le ruote tonde vere al posto di quelle dell'AI (tolte da veicolo_ai_pezzi)
        const u = o.userData as { r: number; w: number; cerchio: string }, me = new THREE.Mesh(ruotaGeo(u.r, u.w, u.cerchio), matRuote);
        me.castShadow = true; me.name = 'ruota_tonda';
        me.scale.setScalar(1 / (o.parent?.scale.x || 1)); // il nodo del modello è scalato (quantizzato): la ruota è in metri
        o.add(me);
      }
      pronti.set(modello, g.scene);
    }).catch(() => { /* senza file resta il modello del kit */ });
    inArrivo.set(modello, p);
  }
  return p;
}

const matRuote = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const geoRuote = new Map<string, THREE.BufferGeometry>();
/** Ruota tonda in metri sull'asse X: gomma coi tasselli (da dietro si vedono scorrere), cerchione del colore `cerchio` della palette con
 *  tre razze scure sui due lati (di fianco si vede girare). */
function ruotaGeo(r: number, w: number, cerchio: string): THREE.BufferGeometry {
  const k = `${r}|${w}|${cerchio}`;
  let g = geoRuote.get(k);
  if (g) return g;
  const parts: THREE.BufferGeometry[] = [], asse = (x = 0, rx = 0) => M(x, 0, 0, rx, 0, Math.PI / 2);
  parts.push(painted(new THREE.CylinderGeometry(r * 0.92, r * 0.92, w, 16), P.roccia, asse()));
  const N = 12, alto = r * 0.14, lungo = ((2 * Math.PI * r) / N) * 0.55;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, rr = r - alto / 2;
    parts.push(painted(new THREE.BoxGeometry(w * 1.02, alto, lungo), P.neroCaldo, M(0, Math.cos(a) * rr, Math.sin(a) * rr, a)));
  }
  parts.push(painted(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w + 0.02, 10), (P as Record<string, string>)[cerchio] ?? P.pietra, asse()));
  for (const lato of [-1, 1]) {
    for (let i = 0; i < 3; i++) parts.push(painted(new THREE.BoxGeometry(0.02, r * 0.1, r * 1.0), P.neroCaldo, M(lato * (w / 2 + 0.015), 0, 0, (i / 3) * Math.PI)));
    parts.push(painted(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.03, 8), P.neroCaldo, asse(lato * (w / 2 + 0.02))));
  }
  g = merged(parts);
  geoRuote.set(k, g);
  return g;
}

/** La carrozzeria AI di questo modello è già scaricata. */
export const aiPronta = (modello: string | null | undefined): boolean => !!modello && pronti.has(modello);

/** Una copia della carrozzeria AI (geometria e materiali condivisi), o null se non è (ancora) scaricata. */
export function veicoloAi(modello: string | null | undefined): THREE.Object3D | null {
  const m = modello ? pronti.get(modello) : undefined;
  if (!m) return null;
  const c = m.clone();
  animaPezzi(c);
  return c;
}

/** Ruote e gambe (staccate da `tools/veicolo_ai_pezzi.mjs`, Jack 14 ott: «non possono essere modelli fermi che slittano»): le ruote
 *  girano con la strada fatta e quelle davanti sterzano in curva, le gambe vanno avanti e indietro col passo. Si aggiornano da sole
 *  prima di ogni disegno, da quanto il veicolo si è spostato e girato: valgono in gara, nell'hub e nel garage senza toccare chi li muove. */
function animaPezzi(root: THREE.Object3D): void {
  const ruote: THREE.Object3D[] = [], gambe: THREE.Object3D[] = [];
  let corpo: THREE.Mesh | null = null;
  root.traverse((o) => {
    const tipo = o.userData['tipo'];
    if (tipo === 'ruota') ruote.push(o);
    else if (tipo === 'gamba') gambe.push(o);
    else if (o.name === 'veicolo_ai' && !corpo) corpo = o as THREE.Mesh; // la carrozzeria (non le ruote tonde, che stanno prima)
  });
  if (!corpo || (!ruote.length && !gambe.length)) return;
  for (const o of [...ruote, ...gambe]) o.rotation.order = 'YXZ'; // prima sterza, poi gira sul suo asse
  const prima = new THREE.Vector3(), ora = new THREE.Vector3(), dir = new THREE.Vector3(), sc = new THREE.Vector3();
  let t0 = -1, rotta0 = 0, sterzo = 0, passo = 0, ampiezza = 0;
  (corpo as THREE.Mesh).onBeforeRender = () => {
    const t = performance.now();
    if (t - t0 < 4) return; // più disegni nello stesso fotogramma (ombre, passata pixel): uno basta
    root.getWorldPosition(ora); root.getWorldDirection(dir); root.getWorldScale(sc);
    const rotta = Math.atan2(-dir.x, -dir.z); // il muso è −Z
    if (t0 < 0) { t0 = t; prima.copy(ora); rotta0 = rotta; return; }
    const dt = Math.min(0.1, (t - t0) / 1000);
    let d = (prima.x - ora.x) * dir.x + (prima.z - ora.z) * dir.z + (prima.y - ora.y) * dir.y; // metri in avanti (dir guarda indietro)
    d /= sc.x || 1;
    let giro = rotta - rotta0;
    if (giro > Math.PI) giro -= 2 * Math.PI; else if (giro < -Math.PI) giro += 2 * Math.PI;
    t0 = t; prima.copy(ora); rotta0 = rotta;
    if (Math.abs(d) > 4) { d = 0; giro = 0; } // teletrasporto (ripartenza dopo una caduta, cambio pista): niente giri pazzi
    const v = d / dt;
    const voluto = Math.abs(v) > 1 ? Math.max(-0.5, Math.min(0.5, (giro / dt) * 0.35)) : sterzo; // fermi (palco del garage che gira) non sterza
    sterzo += (voluto - sterzo) * Math.min(1, dt * 10);
    for (const r of ruote) {
      r.rotation.x = (r.rotation.x - d / (r.userData['r'] as number)) % (2 * Math.PI);
      if (r.userData['davanti']) r.rotation.y = sterzo;
    }
    if (gambe.length) {
      passo += d / 3.5; // un passo ogni 3,5 m: con passi più corti, a tutta velocità le gambe sfarfallano
      ampiezza += (Math.min(0.55, Math.abs(v) * 0.06) - ampiezza) * Math.min(1, dt * 6);
      for (const g of gambe) g.rotation.x = Math.sin(2 * Math.PI * (passo + (g.userData['fase'] as number))) * ampiezza;
    }
  };
}

/** Per i test: come stanno ruote e gambe di un veicolo in scena (rotazione sul loro asse e sterzo, in gradi). */
export function infoPezzi(veicolo: THREE.Object3D | undefined): { nome: string; gira: number; sterza: number }[] {
  const out: { nome: string; gira: number; sterza: number }[] = [];
  veicolo?.traverse((o) => { if (o.userData['tipo']) out.push({ nome: o.name, gira: Math.round((o.rotation.x * 180) / Math.PI), sterza: Math.round((o.rotation.y * 180) / Math.PI) }); });
  return out;
}
