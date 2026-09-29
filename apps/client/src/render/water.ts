// Acqua a pixel: piano con texture 2 colori che scorre. Stub funzionante (WP0); WP1 aggiunge onde ai bordi e schiuma.
import * as THREE from 'three';
export function createWater(o: { size: number }): { mesh: THREE.Object3D; update(t: number): void } {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3FB9C9'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#7FE3E0';
  for (let i = 0; i < 14; i++) g.fillRect((i * 7) % 32, (i * 11) % 32, 3, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(o.size / 4, o.size / 4);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.size, o.size), new THREE.MeshLambertMaterial({ map: tex }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(o.size / 2, 0, o.size / 2); mesh.receiveShadow = true;
  return { mesh, update: (t) => { tex.offset.set((t * 0.02) % 1, (t * 0.013) % 1); } };
}
