// Cielo a 4 bande piatte (ART_BIBLE §7): niente gradiente liscio. È lo sfondo della scena (un quad a schermo, 1 draw call).
// Con la camera diorama a 45° si vede di rado; resta come fondo quando il mare finisce o a schermo molto largo.
import * as THREE from 'three';
import { pixelTexture } from './loader.ts';
// Dall'alto al basso: acqua bassa (cielo chiaro), pietra chiara (foschia), giallo caldo, arancio al tramonto sull'orizzonte.
export const SKY_BANDS = ['#7FE3E0', '#E8E1D6', '#F5D547', '#F2A33A'] as const;
export function createSky(): { object: THREE.Object3D; color: THREE.Color; texture: THREE.Texture } {
  const c = document.createElement('canvas'); c.width = 1; c.height = 32;
  const g = c.getContext('2d')!;
  // Bande disuguali (più cielo in alto), bordi netti: resta a pixel, niente sfumature.
  const stops = [0, 14, 22, 28, 32];
  for (let i = 0; i < 4; i++) { g.fillStyle = SKY_BANDS[i]!; g.fillRect(0, stops[i]!, 1, stops[i + 1]! - stops[i]!); }
  const texture = pixelTexture(new THREE.CanvasTexture(c));
  return { object: new THREE.Group(), color: new THREE.Color(SKY_BANDS[0]), texture };
}
