// I veicoli delle Corse fatti con l'AI 3D (#281): da un'immagine pulita del veicolo (ChatGPT, stile della reference scelta da Jack)
// a un modello con texture (SAM 3 su Higgsfield, 1 credito), poi in Blender saldato, girato, scalato e alleggerito, poi
// `tools/veicolo_ai_leggero.mjs` (texture 512, senza normali, quantizzato): `public/assets/veicoli_ai/<modello>.glb`, ~150 KB, muso
// verso −Z, lungo quanto il modello del kit, ruote a terra, perno al centro. Sostituiscono solo la carrozzeria: il pilota (animale,
// segnaposto o avatar) resta quello di `veicoloGeo(…, senzaCarrozzeria)`. Si scaricano uno alla volta, quando un veicolo li chiede.
// Il materiale diventa Lambert con la texture, come il resto del mondo: la passata pixel lo tratta come gli altri.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
        me.castShadow = true; me.name = 'veicolo_ai';
        if (!me.geometry.attributes.normal) me.geometry.computeVertexNormals(); // il glb arriva senza normali: lisce qui
        const vecchio = me.material as THREE.MeshStandardMaterial;
        me.material = new THREE.MeshLambertMaterial({ map: vecchio.map, color: vecchio.color });
        vecchio.dispose();
      });
      pronti.set(modello, g.scene);
    }).catch(() => { /* senza file resta il modello del kit */ });
    inArrivo.set(modello, p);
  }
  return p;
}

/** La carrozzeria AI di questo modello è già scaricata. */
export const aiPronta = (modello: string | null | undefined): boolean => !!modello && pronti.has(modello);

/** Una copia della carrozzeria AI (geometria e materiali condivisi), o null se non è (ancora) scaricata. */
export function veicoloAi(modello: string | null | undefined): THREE.Object3D | null {
  const m = modello ? pronti.get(modello) : undefined;
  return m ? m.clone() : null;
}
