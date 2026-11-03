// Le skin del protagonista (`chr_eroe`, assets/blender/models_chr_eroe_ai.py): altre texture a 512 px con le STESSE UV, una per skin, in
// /assets/skin/<id>.png (tools/meshy/skin_tinta.py e skin_bake.py). Una skin è una voce di avatar.json `abiti` col campo `skin`: si compra dal
// Mercante, sta nella Borsa e si indossa come ogni vestito. Le voci senza `skin` (i vecchi vestiti sul corpo di chr_base) lasciano al
// protagonista la texture di partenza (`base`). Chunk a parte (import() da avatar.ts).
// Pelle e capelli dell'editor valgono su OGNI skin: la mappa /assets/skin/mappa.png (tools/meshy/skin_mappa.py, uguale per tutte, perché le UV
// sono le stesse) dice quali pixel sono pelle, pelle in ombra, capelli, capelli in luce; qui si ridipingono coi colori del look su un canvas
// 512×512 (filtro nearest, come la texture del glb), una volta a ogni cambio di skin, pelle o capelli. Una skin con la sua pelle (`pelleFissa`
// in avatar.json, una rana verde) tiene i suoi pixel di pelle. La mappa si legge arrotondando il grigio / 50: 0 niente, 1-4 i ruoli.
import * as THREE from 'three';
import { AVATAR } from '@marea/content';
import type { Look } from '@marea/protocol';

const LATO = 512, PASSO = 50;

const CACHE = new Map<string, Promise<Uint8ClampedArray | null>>();
/** I pixel RGBA di /assets/skin/<id>.png, letti una volta sola e uguali per tutti gli avatar. */
function pixel(id: string): Promise<Uint8ClampedArray | null> {
  let p = CACHE.get(id);
  if (!p) {
    p = new Promise((ok) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = LATO;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (!g) { ok(null); return; }
        g.drawImage(im, 0, 0, LATO, LATO); ok(g.getImageData(0, 0, LATO, LATO).data);
      };
      im.onerror = () => { console.warn(`[marea] skin ${id} non caricabile`); ok(null); };
      im.src = `/assets/skin/${id}.png`;
    });
    CACHE.set(id, p);
  }
  return p;
}

const rgb = (hex: string | undefined, o: string): [number, number, number] => { const h = hex ?? o; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };

export type SkinAvatar = { set(look: Look): Promise<void>; readonly attuale: string | null };

/** Cambia la texture dei materiali `mats` (quelli del protagonista): la skin del look (o `base`) con pelle e capelli del look. Ritorna a skin e mappa lette e a primo disegno fatto; l'ultima richiesta vince. */
export async function creaSkin(mats: THREE.MeshLambertMaterial[], look: Look): Promise<SkinAvatar> {
  const base = mats[0]?.map ?? null, mappa = await pixel('mappa');
  let voluta = '', attuale: string | null = null, gen = 0;
  const tela = document.createElement('canvas'); tela.width = tela.height = LATO;
  const g = tela.getContext('2d'), img = new ImageData(LATO, LATO), tex = new THREE.CanvasTexture(tela);
  if (base) { tex.flipY = base.flipY; tex.colorSpace = base.colorSpace; tex.magFilter = base.magFilter; tex.minFilter = base.minFilter; tex.wrapS = base.wrapS; tex.wrapT = base.wrapT; tex.channel = base.channel; }
  tex.generateMipmaps = false; tex.name = 'skin_eroe';
  const av: SkinAvatar = {
    get attuale() { return attuale; },
    async set(l) {
      const ab = l.abito === undefined ? undefined : AVATAR.abiti[l.abito], id = ab?.skin ?? 'base', k = `${id}|${l.pelle}|${l.coloreCapelli}`;
      if (!base || !g || k === voluta) return;
      voluta = k; const mio = ++gen;
      const px = await pixel(id);
      if (mio !== gen || !px) return;
      img.data.set(px);
      if (mappa) {
        const col = [null, rgb(AVATAR.pelle[l.pelle], '#D9A070'), rgb(AVATAR.pelleOmbra[l.pelle], '#B8784C'), rgb(AVATAR.coloriCapelli[l.coloreCapelli], '#5A3A1E'), rgb(AVATAR.capelliLuce[l.coloreCapelli], '#8E5A2B')];
        for (let i = 0, d = img.data; i < LATO * LATO; i++) {
          const r = Math.round((mappa[i * 4] ?? 0) / PASSO), c = col[r];
          if (c && !(ab?.pelleFissa && r < 3)) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
        }
      }
      g.putImageData(img, 0, 0); tex.needsUpdate = true;
      for (const m of mats) if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
      attuale = id === 'base' ? null : id;
    },
  };
  await av.set(look);
  return av;
}
