// Gli atlanti degli sprite (tools/sprite/atlante.py): un'immagine WebP e un JSON con i disegni, «vista_mossa_numero».
import * as THREE from 'three';

/** x, y, w, h nell'immagine; ax, ay = i piedi; ms = quanto dura; px, py = la punta della canna (solo nei disegni della canna). */
export type Voce = readonly [x: number, y: number, w: number, h: number, ax: number, ay: number, ms: number, px?: number, py?: number];
type Dati = { w: number; h: number; d: Record<string, Voce> };
export type Atlante = Dati & {
  tex: THREE.Texture;
  /** Le viste disegnate di una mossa, da davanti a dietro, coi gradi. */
  viste(mossa: string): readonly { v: string; gradi: number }[];
  /** Quanti disegni ha una mossa in una vista. */
  quanti(vista: string, mossa: string): number;
};
/** Da davanti (S) a dietro (N) passando da destra, una ogni 22,5°; le altre sette sono lo specchio. */
const VISTE = ['S', 'SSE', 'SE', 'ESE', 'E', 'ENE', 'NE', 'NNE', 'N'];

async function prendi(nome: string): Promise<Atlante> {
  const base = `/assets/sprite/${nome}`;
  const [dati, img] = await Promise.all([
    fetch(base + '.json').then((r) => { if (!r.ok) throw new Error(`sprite ${nome}: ${r.status}`); return r.json() as Promise<Dati>; }),
    new THREE.ImageLoader().loadAsync(base + '.webp'),
  ]);
  const tex = new THREE.Texture(img);
  tex.name = 'sprite_' + nome;
  tex.flipY = false; tex.premultiplyAlpha = true; // premoltiplicata: sfumando un bordo non entra il nero dei pixel vuoti (lo shader ridivide)
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
  const viste = new Map<string, { v: string; gradi: number }[]>();
  return {
    ...dati, tex,
    viste(mossa) {
      let l = viste.get(mossa);
      if (!l) viste.set(mossa, (l = VISTE.flatMap((v, i) => (dati.d[`${v}_${mossa}_1`] ? [{ v, gradi: i * 22.5 }] : []))));
      return l;
    },
    quanti(vista, mossa) { let n = 0; while (dati.d[`${vista}_${mossa}_${n + 1}`]) n++; return n; },
  };
}

const pronti = new Map<string, Atlante>(), attesi = new Map<string, Promise<void>>();
/** L'atlante se è già qui; se no lo chiede e intanto undefined. Se non arriva, si riprova dopo un po'. */
export function atlante(nome: string): Atlante | undefined {
  const a = pronti.get(nome);
  if (!a && !attesi.has(nome)) {
    attesi.set(nome, prendi(nome).then((x) => { pronti.set(nome, x); attesi.delete(nome); }, (e: unknown) => {
      console.warn('[marea]', e);
      setTimeout(() => attesi.delete(nome), 10_000);
    }));
  }
  return a;
}
/** Libera la memoria video degli atlanti il cui nome comincia così (le immagini restano: se servono tornano su da sole). */
export function liberaAtlanti(prefisso: string): void {
  for (const [n, a] of pronti) if (n.startsWith(prefisso)) { a.tex.dispose(); a.tex.needsUpdate = true; }
}
