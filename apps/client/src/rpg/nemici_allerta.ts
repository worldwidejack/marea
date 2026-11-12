// Il «!» e il «?» sopra la testa dei nemici (niente barre: la percezione sta nel motore, quiete.ts). «!» rosso per un secondo quando ti
// vede (da dorme o veglia passa all'attacco), «?» giallo quando ti ha sentito o intravisto e viene a cercarti. Disegnati a pixel, nearest.
import * as THREE from 'three';
import type { DungeonView } from '@marea/sim/dungeon/types.ts';
import { PAL } from '../ui/style.ts';
import { registerStateProvider } from '../test/testapi.ts';

type NemV = DungeonView['nemici'][number];
export type Segno = { sprite: THREE.Sprite; fino: number; da: number; k: '!' | '?' } | null;

/** Quanto resta (s): il «!» un secondo, il «?» un po' di più. Altezza del segno (m) e i 5×8 pixel di ognuno. */
const RESTA = { '!': 1, '?': 1.6 } as const, ALTO = 0.42;
const DISEGNI = {
  '!': ['.###.', '.###.', '.###.', '.###.', '..#..', '.....', '.###.', '.###.'],
  '?': ['.###.', '##.##', '...##', '..##.', '..#..', '.....', '..#..', '..#..'],
} as const;
const QUIETI = new Set(['dorme', 'veglia']);
/** Per i test: i segni a schermo adesso. */
const vivi = new Set<NonNullable<Segno>>();
registerStateProvider('segni', () => {
  const now = performance.now() / 1000, n = (k: string): number => [...vivi].filter((s) => s.k === k && s.fino > now && s.sprite.parent?.parent).length;
  const dove = [...vivi].filter((s) => s.fino > now && s.sprite.parent?.parent).map((s) => { const p = s.sprite.getWorldPosition(new THREE.Vector3()); return { k: s.k, x: p.x, z: p.z }; });
  return { '!': n('!'), '?': n('?'), dove };
});

const mats = new Map<string, THREE.SpriteMaterial>();
function materiale(k: '!' | '?'): THREE.SpriteMaterial {
  const m0 = mats.get(k);
  if (m0) return m0;
  const D = DISEGNI[k], W = D[0].length + 2, H = D.length + 2, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!, pieno = (x: number, y: number): boolean => D[y]?.[x] === '#';
  // contorno scuro attorno a ogni pixel pieno, poi il colore
  g.fillStyle = PAL.neroCaldo;
  for (let y = 0; y < D.length; y++) for (let x = 0; x < D[0].length; x++) if (pieno(x, y)) g.fillRect(x, y, 3, 3);
  g.fillStyle = k === '!' ? PAL.rosso : PAL.giallo;
  for (let y = 0; y < D.length; y++) for (let x = 0; x < D[0].length; x++) if (pieno(x, y)) g.fillRect(x + 1, y + 1, 1, 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  mats.set(k, m);
  return m;
}

/** Dal fotogramma di prima (`p`) a questo (`n`): il segno da mostrare adesso (o quello che c'era). */
export function segnoNuovo(cur: Segno, p: NemV, n: NemV, root: THREE.Object3D, now: number): Segno {
  if (n.alleato || n.anim === 'morto') return togliSegno(cur);
  const k = QUIETI.has(p.anim) && !QUIETI.has(n.anim) ? '!' : !p.cerca && n.cerca && QUIETI.has(n.anim) ? '?' : null;
  if (!k) return cur;
  if (cur && cur.k === k) { cur.fino = now + RESTA[k]; return cur; }
  togliSegno(cur);
  const sprite = new THREE.Sprite(materiale(k)), D = DISEGNI[k];
  sprite.scale.set((ALTO * (D[0].length + 2)) / (D.length + 2), ALTO, 1); sprite.renderOrder = 5;
  root.add(sprite);
  const nuovo: NonNullable<Segno> = { sprite, fino: now + RESTA[k], da: now, k };
  vivi.add(nuovo);
  return nuovo;
}

/** Ogni fotogramma: sopra la testa (`alto` m), spunta a scatti e saltella un poco; finito il tempo sparisce. */
export function posaSegno(s: Segno, alto: number, now: number): Segno {
  if (!s) return s;
  if (now >= s.fino) return togliSegno(s);
  const k = Math.min(1, Math.floor(((now - s.da) / 0.12) * 3) / 3), su = Math.floor((now - s.da) * 6) % 2 ? 0.04 : 0;
  s.sprite.scale.y = ALTO * (0.4 + 0.6 * k);
  s.sprite.position.set(0, alto + 0.15 + su, 0);
  return s;
}

function togliSegno(s: Segno): null {
  s?.sprite.removeFromParent();
  if (s) vivi.delete(s);
  return null;
}
