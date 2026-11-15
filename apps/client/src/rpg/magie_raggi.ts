// I raggi continui che hanno un disegno loro (magie_stile.ts → `raggio`), chiamati da magie_fx.ts solo quando la vista dice quale magia è
// (`canale.m`: fuori dall'Arena). Fuoco continuo ed Elettricità continua restano quelli di magie_fx.ts.
// - Colata: metallo fuso spesso, dal giallo della mano al rosso in fondo con la crosta scura, e gocce che colano a terra.
// - Bussola Fulminante: un filo dritto azzurro con gli aghi quadrati che corrono verso il bersaglio; più la tieni (Concentra), più sono grossi.
// - Cura a flusso: una doppia elica di cubetti verdi che gira, e in fondo crocette che salgono.
// - Furia a flusso: punte di freccia rosse e rosa che corrono verso l'alleato a impulsi.
// Tutto a scatti, colori pieni, nessuna luce. `lungo(s, out)` mette in `out` il punto a frazione s del raggio (0 = mano, 1 = fondo) e dice quanto
// è grande lì un pezzo (in prima persona i pezzi vicino alla mano sono piccoli, per non coprire la vista).
import * as THREE from 'three';
import { rnd } from './magie_stile.ts';
import type { Raggio } from './magie_stile.ts';

export type Lungo = (s: number, out: THREE.Vector3) => number;
/** I raggi nuovi (gli altri li disegna magie_fx.ts). */
export const RAGGI_NUOVI: ReadonlySet<Raggio> = new Set(['colata', 'bussola', 'elica', 'chevron']);

const Z = new THREE.Vector3(0, 0, 1), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3(), d3 = new THREE.Vector3(), t3 = new THREE.Vector3();
/** Un pezzo allungato tra due punti, spesso w. */
function tra(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, w: number): void {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.set(w, w, Math.max(0.01, a.distanceTo(b)));
  m.quaternion.setFromUnitVectors(Z, t3.copy(b).sub(a).normalize());
}
const fr = (v: number): number => v - Math.floor(v);

/** Disegna il raggio `tipo` coi pezzi `segs` (li accende o spegne tutti). `lato` e `su` = versori di traverso al raggio, `k` = secondi di Concentra. */
export function disegnaRaggio(tipo: Raggio, segs: THREE.Mesh[], col: readonly string[], mat: (c: string) => THREE.Material, t: number, lungo: Lungo, lato: THREE.Vector3, su: THREE.Vector3, k = 0): void {
  let n = 0;
  const usa = (c: string): THREE.Mesh | null => { const m = segs[n++]; if (!m) return null; m.visible = true; m.material = mat(c); m.rotation.set(0, 0, 0); m.scale.setScalar(1); return m; };
  const sc = Math.floor(t * 30) / 30; // il tempo a scatti
  if (tipo === 'colata') {
    for (let i = 0; i < 14; i++) { // il getto: pezzi grossi che scorrono via dalla mano, gialli all'inizio e rossi in fondo
      const s = fr(i / 14 + sc * 0.9), w = lungo(s, a3), m = usa(col[Math.min(2, Math.floor(s * 3))]!);
      if (!m) return;
      m.position.copy(a3).addScaledVector(lato, (rnd(i * 3 + Math.floor(sc * 10)) - 0.5) * w * 0.5).addScaledVector(su, (rnd(i * 5) - 0.5) * w * 0.4);
      m.scale.set(w * 1.5, w * 1.1, w * 1.7); m.rotation.set(rnd(i + 7) * 3, rnd(i + 11) * 3, 0);
      if (rnd(i * 13 + Math.floor(sc * 4)) > 0.82) m.material = mat(col[3]!); // la crosta che si fredda
    }
    for (let i = 0; i < 4; i++) { // gocce che si staccano e cadono
      const f = fr(sc * 1.6 + i * 0.25), w = lungo(0.35 + i * 0.17, a3), m = usa(i % 2 ? col[1]! : col[2]!);
      if (!m) return;
      m.position.copy(a3).addScaledVector(su, -f * f * 1.4); m.scale.set(w * 0.6, w * (0.6 + f), w * 0.6);
    }
  } else if (tipo === 'bussola') {
    lungo(0, a3); lungo(1, b3);
    const filo = usa(col[0]!); if (filo) tra(filo, a3, b3, lungo(0.5, c3) * 0.18);
    const carica = Math.min(1, k / 4);
    for (let i = 0; i < 7; i++) { // gli aghi: quadratini piatti di traverso, che corrono verso il fondo
      const s = fr(i / 7 + sc * 1.4), w = lungo(s, a3) * (0.8 + carica), m = usa(i % 2 ? col[1]! : col[3 - (carica > 0.5 ? 0 : 1)]!);
      if (!m) return;
      m.position.copy(a3); m.quaternion.setFromUnitVectors(Z, c3.copy(b3).sub(a3).normalize()); m.scale.set(w * 1.3, w * 1.3, w * 0.2);
      m.rotateZ(Math.PI / 4);
    }
  } else if (tipo === 'elica') {
    lungo(1, b3);
    for (let i = 0; i < 16; i++) { // doppia elica che gira
      const s = fr(i / 16 + sc * 0.8), w = lungo(s, a3), ang = s * 10 + sc * 7 + (i % 2) * Math.PI, m = usa(col[i % 2]!);
      if (!m) return;
      m.position.copy(a3).addScaledVector(lato, Math.cos(ang) * w * 1.6).addScaledVector(su, Math.sin(ang) * w * 1.6); m.scale.setScalar(w * 0.8);
    }
    for (let i = 0; i < 2; i++) { // crocette che salgono dal bersaglio
      const f = fr(sc * 0.9 + i * 0.5), w = lungo(1, a3) * 0.9, x = (rnd(i + Math.floor(sc * 0.9 + i * 0.5)) - 0.5) * 0.6;
      const h = usa(col[2]!), v = usa(col[2]!);
      if (!h || !v) return;
      h.position.copy(b3).addScaledVector(lato, x).addScaledVector(su, f * 1.2); h.scale.set(w * 1.6, w * 0.5, w * 0.5);
      v.position.copy(h.position); v.scale.set(w * 0.5, w * 1.6, w * 0.5);
    }
  } else if (tipo === 'chevron') {
    lungo(0, a3); lungo(1, b3);
    const dir = c3.copy(b3).sub(a3).normalize(), impulso = Math.floor(t * 6) % 3;
    for (let i = 0; i < 6; i++) { // punte di freccia «>» che corrono verso l'alleato
      const s = fr(i / 6 + sc * 1.1), w = lungo(s, a3) * (i % 3 === impulso ? 1.4 : 1);
      for (const seg of [-1, 1]) {
        const m = usa(i % 2 ? col[1]! : col[0]!);
        if (!m) return;
        tra(m, d3.copy(a3).addScaledVector(dir, -w * 1.4).addScaledVector(lato, seg * w * 1.1), a3, w * 0.4);
      }
    }
  }
  for (; n < segs.length; n++) segs[n]!.visible = false;
}
