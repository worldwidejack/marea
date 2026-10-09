// Le camere del banco di prova delle piste (#170), dal menù opzioni:
// - dietro e alta: «sui binari», sulla pista qualche metro dietro di te, così nei giri della morte e nelle curve restano sopra la
//   strada (il sopra è quello della pista lì); guardano un po' più avanti, a metà tra il muso e il moto: in drift vedi il kart di traverso;
// - cofano (Jack: «molto più dentro la macchina, solo il cofano e la strada»): negli occhi del pilota, guarda dove punta il muso.
// FOV che si allarga con la velocità e col turbo (col colpo `pugno` quando parte), scossa negli atterraggi, tremolio con l'onda vicina.
import * as THREE from 'three';
import { nuovaTerna, terna } from '@marea/sim/corse/nastro.ts';
import { nastroDi } from '@marea/sim/corse/pista.ts';
import type { Pista } from '@marea/sim/corse/pista.ts';
import type { Veicolo } from '@marea/sim/corse/veicolo.ts';
import { occhio } from '../veicoli3d.ts';

export type Modo = 'dietro' | 'alta' | 'cofano';
/** Il tuo veicolo nel mondo (posizione, muso, sopra, moto), la pista, il fronte dell'onda e il saltello del drift (m). */
export type Inquadra = { pos: THREE.Vector3; fwd: THREE.Vector3; up: THREE.Vector3; moto: THREE.Vector3; k: Veicolo; p: Pista; onda: number; hop: number; effetti: boolean; dt: number };

export function creaRegia(camera: THREE.PerspectiveCamera) {
  const camF = new THREE.Vector3(1, 0, 0), camU = new THREE.Vector3(0, 1, 0), camP = new THREE.Vector3(), tmp = new THREE.Vector3(), dx = new THREE.Vector3(), T3 = nuovaTerna();
  /** ok = false: la prossima inquadratura salta subito al posto giusto (cambio di camera o di gara). */
  const st = { ok: false, pugno: 0, scossa: 0 };
  const lente = (fov: number, near: number, dt: number) => {
    if (Math.abs(camera.fov - fov) > 0.05 || camera.near !== near || camera.far !== 900) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.near = near; camera.far = 900; camera.updateProjectionMatrix(); }
  };
  function segui(modo: Modo, q: Inquadra): void {
    const { k, p, dt } = q, tel = camera.aspect < 0.8, v = Math.max(0, k.v);
    st.scossa *= Math.exp(-dt * 9); st.pugno *= Math.exp(-dt * 2.2);
    const pugno = q.effetti ? st.pugno : 0, scossa = q.effetti ? st.scossa : 0;
    if (modo === 'cofano') {
      const [alto, avanti] = occhio(k.id);
      camU.lerp(q.up, st.ok ? 1 - Math.exp(-dt * 14) : 1).normalize();
      camera.position.copy(q.pos).addScaledVector(camU, alto + q.hop).addScaledVector(q.fwd, avanti);
      if (scossa > 0.005) camera.position.addScaledVector(camU, (Math.random() - 0.5) * scossa * 0.5);
      camera.up.copy(camU);
      camera.lookAt(tmp.copy(camera.position).addScaledVector(q.fwd, 10).addScaledVector(camU, tel ? -2.1 : -1.3)); // sul telefono più giù: il muso deve stare sopra i comandi
      lente((tel ? 84 : 72) + (k.turbo > 0 ? 6 : 0) + Math.max(0, v - 15) * 0.4 + pugno, 0.08, dt);
      st.ok = true;
      return;
    }
    const base = modo === 'alta' ? [13, 7, 0.5] : [tel ? 7.6 : 6.4, tel ? 3.4 : 2.7, 1];
    const dist = base[0]! + v * 0.04, alt = base[1]! + Math.max(0, k.h) * 0.6;
    let nc = nastroDi(p, k.ramo), sc = k.s - dist;
    if (k.ramo >= 0 && sc < 0) { nc = p.n; sc = p.rami[k.ramo]!.def.da + sc; } // sull'imbocco di un ramo la camera è ancora sulla principale
    terna(nc, sc, T3);
    const latc = k.lat * 0.7;
    camP.set(T3.x + T3.rx * latc + T3.ux * alt, T3.y + T3.ry * latc + T3.uy * alt, T3.z + T3.rz * latc + T3.uz * alt);
    // l'onda che si avvicina fa tremare la camera (sotto i 35 m)
    const tremo = p.def.inseguitore ? Math.max(0, 1 - (k.prog - q.onda) / 35) : 0;
    if (tremo > 0) camP.addScaledVector(camU, Math.sin(performance.now() * 0.06) * 0.14 * tremo);
    tmp.set(T3.ux, T3.uy, T3.uz).normalize();
    camU.lerp(tmp, st.ok ? 1 - Math.exp(-dt * 10) : 1).normalize();
    camera.position.lerp(camP, st.ok ? 1 - Math.exp(-dt * 20) : 1);
    if (scossa > 0.005) camera.position.addScaledVector(camU, (Math.random() - 0.5) * scossa).addScaledVector(dx.set(T3.rx, T3.ry, T3.rz), (Math.random() - 0.5) * scossa);
    camera.up.copy(camU);
    camF.copy(q.fwd).multiplyScalar(0.4).addScaledVector(q.moto, 0.6).normalize();
    camera.lookAt(tmp.copy(q.pos).addScaledVector(camF, 4).addScaledVector(q.up, base[2]!));
    lente((tel ? 78 : 64) + (k.turbo > 0 ? 6 : 0) + Math.max(0, v - 15) * 0.3 + pugno, 0.3, dt);
    st.ok = true;
  }
  return { st, segui };
}
