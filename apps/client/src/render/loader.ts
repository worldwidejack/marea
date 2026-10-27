// Caricatore glTF + manifest (public/assets/manifest.json). Cache per nome, texture nearest sRGB senza mipmap.
// Senza manifest o con un modello mancante il gioco gira con i segnaposto: chi chiama controlla has(name) prima di load(name).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export type Manifest = { version: string; atlas: string; models: Record<string, { file: string; tris?: number; clips?: string[]; bounds?: unknown }> };
export type Loader = {
  manifest: Manifest;
  has(name: string): boolean;
  load(name: string): Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }>;
  texture(name: string): Promise<THREE.Texture>;
  /** Solo i modelli del manifest che esistono: nomi → presenti. */
  missing?(names: readonly string[]): string[];
  /** Aggiunge i modelli di un manifest secondario (es. 'manifest_rpg.json', caricato entrando in un dungeon). Una volta sola per file. */
  extend(file: string): Promise<void>;
  /** Modelli chiesti e già arrivati (o falliti) da quando c'è la pagina: la barra «Carico… N%» della schermata iniziale (avvio/home.ts). */
  conta(): { chiesti: number; fatti: number };
};
export class MissingAsset extends Error { override name = 'MissingAsset'; }

/** Le glb puntano tutte allo stesso `atlas.png`, ma GLTFLoader fa una texture nuova per ogni file: sulla GPU erano una copia da 4 MB per
 *  modello (13 tra hub e gara delle Corse) e l'iPhone senza memoria ricaricava la pagina dopo VIA. Una texture sola per immagine e
 *  campionamento, condivisa da tutti i caricatori (mondo e Corse). Nessuno le butta: restano finché c'è la pagina. */
const condivise = new Map<string, THREE.Texture>();
function condividi(t: THREE.Texture, uri: string): THREE.Texture {
  const k = `${uri}|${t.wrapS}|${t.wrapT}|${t.flipY}|${t.channel}`;
  const c = condivise.get(k);
  if (c) return c;
  condivise.set(k, t);
  return t;
}

/** Texture pixel art: nearest, niente mipmap, sRGB. */
export function pixelTexture(t: THREE.Texture): THREE.Texture {
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 1; t.needsUpdate = true;
  return t;
}

export async function createLoader(o: { base: string }): Promise<Loader> {
  let manifest: Manifest = { version: '0', atlas: '', models: {} };
  try {
    const r = await fetch(o.base + 'manifest.json', { cache: 'no-store' });
    if (r.ok) {
      const j = (await r.json()) as Partial<Manifest>;
      manifest = { version: String(j.version ?? '0'), atlas: String(j.atlas ?? ''), models: j.models && typeof j.models === 'object' ? j.models : {} };
    } else console.warn(`[marea] manifest.json assente (${r.status}): uso i segnaposto`);
  } catch { console.warn('[marea] manifest.json non leggibile: uso i segnaposto'); }
  // mondo pulito: l'atlas senza puntini al posto di `atlas.png`, per le glb e per chi chiede la texture
  const atlante = (n: string) => (n === 'atlas.png' ? 'atlas_pulito.png' : n);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => u.replace(/(^|\/)atlas\.png$/, '$1atlas_pulito.png'));
  const gltf = new GLTFLoader(manager);
  const models = new Map<string, Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }>>();
  const textures = new Map<string, Promise<THREE.Texture>>();
  const fix = (g: { scene: THREE.Group; parser: { json: { textures?: { source?: number }[]; images?: { uri?: string }[] }; associations: Map<unknown, { textures?: number }> } }) => {
    const uriDi = (t: THREE.Texture) => {
      const i = g.parser.associations.get(t)?.textures, src = i === undefined ? undefined : g.parser.json.textures?.[i]?.source;
      return src === undefined ? undefined : g.parser.json.images?.[src]?.uri;
    };
    const una = (t: THREE.Texture) => { const u = uriDi(t); return u ? condividi(t, u) : t; };
    g.scene.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mm = m as THREE.MeshStandardMaterial;
        if (mm.map) { const t = una(mm.map); if (t === mm.map) pixelTexture(t); else mm.map = t; }
        if (mm.emissiveMap) { const t = una(mm.emissiveMap); if (t === mm.emissiveMap) pixelTexture(t); else mm.emissiveMap = t; }
      }
    });
  };
  const extended = new Map<string, Promise<void>>();
  let chiesti = 0, fatti = 0;
  const api: Loader = {
    manifest,
    extend(file) {
      let p = extended.get(file);
      if (!p) {
        p = fetch(o.base + file, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { models: {} }))
          .then((j: Partial<Manifest>) => { if (j.models && typeof j.models === 'object') Object.assign(manifest.models, j.models); })
          .catch(() => { console.warn(`[marea] ${file} non leggibile: uso i segnaposto`); });
        extended.set(file, p);
      }
      return p;
    },
    has: (name) => Object.prototype.hasOwnProperty.call(manifest.models, name),
    missing: (names) => names.filter((n) => !api.has(n)),
    conta: () => ({ chiesti, fatti }),
    load(name) {
      const entry = manifest.models[name];
      if (!entry) return Promise.reject(new MissingAsset(`[marea] modello mancante nel manifest: ${name}`));
      let p = models.get(name);
      if (!p) {
        p = gltf.loadAsync(o.base + entry.file)
          .then((g) => { fix(g); return { scene: g.scene, clips: g.animations }; })
          .catch((e: unknown) => { models.delete(name); throw new MissingAsset(`[marea] modello ${name} (${entry.file}) non caricato: ${String((e as Error)?.message ?? e)}`); });
        chiesti++; void p.catch(() => {}).finally(() => { fatti++; });
        models.set(name, p);
      }
      return p.then((r) => ({ scene: r.scene.clone(true), clips: r.clips }));
    },
    texture(name) {
      let p = textures.get(name);
      if (!p) {
        p = new THREE.TextureLoader().loadAsync(o.base + atlante(name)).then(pixelTexture)
          .catch((e: unknown) => { textures.delete(name); throw new MissingAsset(`[marea] texture ${name} non caricata: ${String((e as Error)?.message ?? e)}`); });
        textures.set(name, p);
      }
      return p;
    },
  };
  return api;
}
