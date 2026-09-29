// Cielo a bande di pixel. Stub (WP0): colore pieno; WP1 fa le bande.
import * as THREE from 'three';
export function createSky(): { object: THREE.Object3D; color: THREE.Color } { return { object: new THREE.Group(), color: new THREE.Color(0x9fd3ff) }; }
