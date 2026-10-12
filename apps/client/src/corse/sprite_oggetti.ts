// Gli sprite in pixel art degli oggetti delle Corse (#250): disegnati a lettere (una lettera = un colore della palette, '.' = trasparente),
// dalla concept degli oggetti (assets/concept/corse/corse_20_oggetti.jpg) ridotta a pixel. Diventano texture nearest.
import * as THREE from 'three';
import { P } from '../render/island_parts.ts';

const PAL: Record<string, string> = { g: P.giallo, a: P.arancio, b: P.ambraNeon, c: P.legnoChiaro, l: P.legno, s: P.legnoScuro, n: P.neroCaldo, h: P.sabbiaChiara };

/** La buccia di banana (Jack, 12 ott: «la banana deve avere uno sprite a forma di banana»). */
export const BUCCIA = [
  '...................lllls................',
  '...................ssssn................',
  '...................ssssn................',
  '...................sssss................',
  '....................llsl................',
  '...................baall................',
  '..................ggaaaaaa..............',
  '.................bbggbbaaa..............',
  '.................bgggbbbbaa.............',
  '................gbgggbabaaa.............',
  '................bggggbababaa............',
  '................bgggggbbbaaa............',
  '................bgbgggbbaaaa............',
  '................angggnbbaaaa............',
  '................angggnbbaaaa............',
  '................angggnbbaaaa............',
  '...............gbgaglgbbaaaa............',
  '...............bbgggggbaaaaa............',
  '...............bbgggggbaaaaa......lls...',
  '...l..........bbbgggggbabaaaa...gbacs...',
  '..sllb.....abbbagggggabbbaaaa.ggggga....',
  '..slbbbggggabgbbggggglbbbbbbcabgggba....',
  '..slagggggggggagggggglbgbbbbacabbbaa....',
  '...laagggggggaagggggblbgbbbbblcaacc.....',
  '....aaabbgbaacgggbggalaggggggblllc......',
  '......caaaaalbggggggaslbgggggggg........',
  '............gggggggaa..abggggggggggcll..',
  '.........bggggggggaa....bbggggggggalsn..',
  '........lllabgggaaa......aabgggggaalsn..',
  '........lllaaaaaac........aaaaaaaalss...',
  '..........lllca.............aaaalc......',
];

/** Le righe di lettere → texture (nearest, senza mipmap: pixel netti). */
export function texturePixel(righe: readonly string[]): THREE.DataTexture {
  const h = righe.length, w = righe[0]!.length, d = new Uint8Array(w * h * 4), c = new THREE.Color();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = righe[y]![x]!, i = ((h - 1 - y) * w + x) * 4; // le righe vanno dall'alto, la texture dal basso
    if (ch === '.' || !PAL[ch]) continue;
    c.set(PAL[ch]).convertLinearToSRGB();
    d[i] = Math.round(c.r * 255); d[i + 1] = Math.round(c.g * 255); d[i + 2] = Math.round(c.b * 255); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}
