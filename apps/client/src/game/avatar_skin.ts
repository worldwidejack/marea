// Le skin del protagonista (`chr_eroe`, assets/blender/models_chr_eroe_ai.py): altre texture a 512 px con le STESSE UV, una per skin, in
// /assets/skin/<id>.png (tools/meshy/skin_tinta.py e skin_bake.py). Si cambiano al volo sul materiale `mat_eroe`, senza ricaricare il modello.
// Una skin è una voce di avatar.json `abiti` col campo `skin`: si compra dal Mercante, sta nella Borsa e si indossa come ogni vestito. Le
// voci senza `skin` (i vecchi vestiti sul corpo di chr_base) lasciano al protagonista la texture di partenza. Chunk a parte (import() da avatar.ts).
import * as THREE from 'three';

const urlSkin = (id: string): string => `/assets/skin/${id}.png`;

const CACHE = new Map<string, Promise<THREE.Texture | null>>();
/** La texture di una skin, caricata una volta sola e uguale per tutti gli avatar; gli stessi filtri di quella del glb (nearest, sRGB, UV del glTF). */
function carica(id: string, base: THREE.Texture): Promise<THREE.Texture | null> {
  let p = CACHE.get(id);
  if (!p) {
    p = new Promise<THREE.Texture | null>((ok) => {
      new THREE.TextureLoader().load(urlSkin(id), (t) => {
        t.flipY = base.flipY; t.colorSpace = base.colorSpace; t.magFilter = base.magFilter; t.minFilter = base.minFilter;
        t.wrapS = base.wrapS; t.wrapT = base.wrapT; t.channel = base.channel; t.generateMipmaps = false;
        t.name = 'skin_' + id; ok(t);
      }, undefined, () => { console.warn(`[marea] skin ${id} non caricabile`); ok(null); });
    });
    CACHE.set(id, p);
  }
  return p;
}

export type SkinAvatar = { set(id: string | null): void; readonly attuale: string | null };

/** Cambia la texture dei materiali `mats` (quelli del protagonista) tra quella del glb e le skin. L'ultima richiesta vince; se una skin non arriva resta la precedente. */
export function creaSkin(mats: THREE.MeshLambertMaterial[]): SkinAvatar {
  const base = mats[0]?.map ?? null;
  let voluta: string | null = null, attuale: string | null = null, gen = 0;
  const metti = (t: THREE.Texture | null) => { for (const m of mats) { m.map = t; m.needsUpdate = true; } };
  return {
    get attuale() { return attuale; },
    set(id) {
      if (id === voluta || !base) return;
      voluta = id; const mio = ++gen;
      if (!id || id === 'base') { metti(base); attuale = null; return; } // 'base' = la texture del glb
      void carica(id, base).then((t) => { if (mio !== gen || !t) return; metti(t); attuale = id; });
    },
  };
}
