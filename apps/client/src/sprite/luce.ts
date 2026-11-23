// La luce su uno sprite: uno sprite non ha facce, quindi prende quanta luce c'è nel posto (sole o luna, cielo, lampioni di notte) rispetto
// al giorno pieno, che vale 1: di notte si scurisce col mondo, vicino a un lampione si scalda.
import * as THREE from 'three';
import { GIORNO } from '../render/ciclo.ts';

/** Quanto del sole prende una figura in piedi, in media; il minimo sotto cui non si scende (il personaggio si legge sempre). */
const SOLE = 0.6, MINIMO = 0.34, MASSIMO = 1.05;

export function creaLuce(scena: THREE.Scene): (x: number, y: number, z: number, out: THREE.Color) => void {
  let luci: THREE.Light[] = [], conta = 0;
  const g = GIORNO.sun, tmp = new THREE.Color(), p = new THREE.Vector3();
  const cielo = (c: THREE.Color, sopra: THREE.Color, sotto: THREE.Color, k: number) => c.add(tmp.copy(sopra).lerp(sotto, 0.5).multiplyScalar(k));
  const pieno = new THREE.Color(0, 0, 0);
  cielo(pieno, new THREE.Color(g.sky), new THREE.Color(g.ground), g.hemiI);
  pieno.add(tmp.set(g.amb).multiplyScalar(g.ambI)).add(tmp.set(g.color).multiplyScalar(g.intensity * SOLE));
  const chiudi = (v: number) => Math.max(MINIMO, Math.min(MASSIMO, v));
  return (x, y, z, out) => {
    if (conta++ % 120 === 0) { luci = []; scena.traverse((n) => { if ((n as THREE.Light).isLight) luci.push(n as THREE.Light); }); }
    out.setRGB(0, 0, 0);
    for (const l of luci) {
      if (!l.intensity) continue;
      if (l instanceof THREE.HemisphereLight) cielo(out, l.color, l.groundColor, l.intensity);
      else if (l instanceof THREE.AmbientLight) out.add(tmp.copy(l.color).multiplyScalar(l.intensity));
      else if (l instanceof THREE.DirectionalLight) out.add(tmp.copy(l.color).multiplyScalar(l.intensity * SOLE));
      else if (l instanceof THREE.PointLight && l.distance > 0) {
        const d = l.getWorldPosition(p).distanceTo(tmpV.set(x, y, z)), k = Math.max(0, 1 - (d / l.distance) ** 4);
        if (k > 0) out.add(tmp.copy(l.color).multiplyScalar((l.intensity * k * k * SOLE) / Math.max(0.5, d ** l.decay)));
      }
    }
    out.setRGB(chiudi(out.r / pieno.r), chiudi(out.g / pieno.g), chiudi(out.b / pieno.b));
  };
}
const tmpV = new THREE.Vector3();
