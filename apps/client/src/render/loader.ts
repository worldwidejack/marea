// Caricatore glTF + manifest; texture nearest sRGB. Stub funzionante (WP0); WP1 aggiunge cache e atlas condiviso.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export type Manifest = { version: string; atlas: string; models: Record<string, { file: string; tris?: number; clips?: string[] }> };
export type Loader = { manifest: Manifest; has(name: string): boolean; load(name: string): Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }>; texture(name: string): Promise<THREE.Texture> };
export class MissingAsset extends Error {}
export async function createLoader(o: { base: string }): Promise<Loader> {
  let manifest: Manifest = { version: '0', atlas: '', models: {} };
  try { const r = await fetch(o.base + 'manifest.json', { cache: 'no-store' }); if (r.ok) manifest = (await r.json()) as Manifest; } catch { /* nessun asset: si usano i segnaposto */ }
  const gltf = new GLTFLoader();
  const cache = new Map<string, Promise<{ scene: THREE.Group; clips: THREE.AnimationClip[] }>>();
  const fixTex = (root: THREE.Object3D) => root.traverse((n) => {
    const m = (n as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.map) { m.map.magFilter = m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; m.map.colorSpace = THREE.SRGBColorSpace; }
    if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true; }
  });
  return {
    manifest,
    has: (name) => name in manifest.models,
    load(name) {
      const entry = manifest.models[name];
      if (!entry) return Promise.reject(new MissingAsset(`Modello mancante: ${name}`));
      let p = cache.get(name);
      if (!p) { p = gltf.loadAsync(o.base + entry.file).then((g) => { fixTex(g.scene); return { scene: g.scene, clips: g.animations }; }); cache.set(name, p); }
      return p.then((r) => ({ scene: r.scene.clone(true), clips: r.clips }));
    },
    async texture(name) { const t = await new THREE.TextureLoader().loadAsync(o.base + name); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; },
  };
}
