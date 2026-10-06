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
};
export class MissingAsset extends Error { override name = 'MissingAsset'; }

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
  const gltf = new GLTFLoader();
  const models = new Map<string, Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }>>();
  const textures = new Map<string, Promise<THREE.Texture>>();
  const fix = (root: THREE.Object3D) => root.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mm = m as THREE.MeshStandardMaterial;
      if (mm.map) pixelTexture(mm.map);
      if (mm.emissiveMap) pixelTexture(mm.emissiveMap);
    }
  });
  const extended = new Map<string, Promise<void>>();
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
    load(name) {
      const entry = manifest.models[name];
      if (!entry) return Promise.reject(new MissingAsset(`[marea] modello mancante nel manifest: ${name}`));
      let p = models.get(name);
      if (!p) {
        p = gltf.loadAsync(o.base + entry.file)
          .then((g) => { fix(g.scene); return { scene: g.scene, clips: g.animations }; })
          .catch((e: unknown) => { models.delete(name); throw new MissingAsset(`[marea] modello ${name} (${entry.file}) non caricato: ${String((e as Error)?.message ?? e)}`); });
        models.set(name, p);
      }
      return p.then((r) => ({ scene: r.scene.clone(true), clips: r.clips }));
    },
    texture(name) {
      let p = textures.get(name);
      if (!p) {
        p = new THREE.TextureLoader().loadAsync(o.base + name).then(pixelTexture)
          .catch((e: unknown) => { textures.delete(name); throw new MissingAsset(`[marea] texture ${name} non caricata: ${String((e as Error)?.message ?? e)}`); });
        textures.set(name, p);
      }
      return p;
    },
  };
  return api;
}
