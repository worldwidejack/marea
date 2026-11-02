// Armature in scatole sul protagonista: le scatole di vestito.ts sono misurate sul manichino (il vecchio avatar AI, models_chr_ai.py)
// e qui si portano sul corpo nuovo osso per osso, come fa assets/blender/eroe_adatta.py coi vestiti del Mercante (i due file vanno tenuti
// insieme). Ogni osso: stessa posizione lungo l'osso (accorciato o allungato come quello nuovo), distanza dall'osso ingrandita di SPESSORE.
// SPESSORE qui è più grosso che in Blender: le scatole non si spingono fuori dalla pelle, e devono stare sopra tunica, maniche e pantaloni.
// Le ossa dei due corpi stanno nel manifest, alla voce `corpo` di chr_base.
import * as THREE from 'three';

type Ossa = Record<string, [[number, number, number], [number, number, number]]>;
export type Corpo = { ossa: Ossa; manichino: Ossa };

const SPESSORE: Record<string, number> = { Hips: 1.25, Spine: 1.2, UpperArm: 1.35, LowerArm: 1.35, UpperLeg: 1.2, LowerLeg: 1.1, Foot: 1.1 };

/** Telaio di un osso: Y lungo l'osso, X il più vicino possibile a +x del mondo, origine in testa all'osso. */
function telaio(h: THREE.Vector3, t: THREE.Vector3): THREE.Matrix4 {
  const y = t.clone().sub(h).normalize();
  const ref = Math.abs(y.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const x = ref.sub(y.clone().multiplyScalar(ref.dot(y))).normalize();
  const z = x.clone().cross(y);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(h);
}

/** Matrice «manichino → protagonista» per osso (niente testa: le armature non la toccano). null se il modello non ha la voce `corpo`. */
export function matriciCorpo(c: Corpo | undefined): Map<string, THREE.Matrix4> | null {
  if (!c) return null;
  const out = new Map<string, THREE.Matrix4>(), v = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);
  for (const [b, [h1, t1]] of Object.entries(c.ossa)) {
    const vecchio = c.manichino[b], k = SPESSORE[b.split('.')[0]!];
    if (!vecchio || k === undefined) continue;
    const [h0, t0] = vecchio, lung = v(t1).distanceTo(v(h1)) / Math.max(1e-6, v(t0).distanceTo(v(h0)));
    out.set(b, telaio(v(h1), v(t1)).multiply(new THREE.Matrix4().makeScale(k, lung, k)).multiply(telaio(v(h0), v(t0)).invert()));
  }
  return out;
}
