// I veicoli delle Corse fatti con l'AI 3D (#281): da un'immagine pulita del veicolo (ChatGPT, stile della reference scelta da Jack)
// a un modello con texture (SAM 3 su Higgsfield, 1 credito), poi in Blender saldato, girato, scalato e alleggerito
// (`public/assets/veicoli_ai/<modello>.glb`: muso verso −Z, lungo quanto il modello del kit, ruote a terra, perno al centro).
// Sostituiscono solo la carrozzeria: il pilota (animale, segnaposto o avatar) resta quello di `veicoloGeo(…, senzaCarrozzeria)`.
// Il materiale diventa Lambert con la texture, come il resto del mondo: la passata pixel lo tratta come gli altri.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** I modelli del kit che hanno la versione AI. */
export const VEICOLI_AI = ['cs_v_kart'] as const;
const pronti = new Map<string, THREE.Object3D>();
/** `?veicoli=kit` nell'indirizzo: i veicoli del kit Blender di prima, per confrontare. */
const spenti = typeof location !== 'undefined' && new URLSearchParams(location.search).get('veicoli') === 'kit';
let promessa: Promise<void> | null = null;

export function caricaVeicoliAi(): Promise<void> {
  return (promessa ??= (async () => {
    if (spenti) return;
    const l = new GLTFLoader();
    await Promise.all(VEICOLI_AI.map(async (m) => {
      try {
        const g = await l.loadAsync(`/assets/veicoli_ai/${m}.glb`);
        g.scene.traverse((o) => {
          const me = o as THREE.Mesh;
          if (!me.isMesh) return;
          me.castShadow = true; me.name = 'veicolo_ai';
          const vecchio = me.material as THREE.MeshStandardMaterial;
          me.material = new THREE.MeshLambertMaterial({ map: vecchio.map, color: vecchio.color });
          vecchio.dispose();
        });
        pronti.set(m, g.scene);
      } catch { /* senza file resta il modello del kit */ }
    }));
  })());
}

/** Una copia della carrozzeria AI (geometria e materiali condivisi), o null se quel modello non ce l'ha. */
export function veicoloAi(modello: string | null): THREE.Object3D | null {
  const m = modello ? pronti.get(modello) : undefined;
  return m ? m.clone() : null;
}
