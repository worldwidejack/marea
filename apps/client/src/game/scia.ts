// Scia della barca: la strada fatta dalla prua (un punto ogni ~1,2 m, fino a SCIA_PUNTI, ognuno con l'età e la forza della scia di
// quel momento). La disegna l'acqua stessa (render/scia_acqua.ts): qui niente mesh, solo i punti.
// Il primo punto segue la prua in tempo reale; i punti invecchiano e dopo SCIA_VITA secondi spariscono: ferma, la scia si spegne da sola.
import { SCIA_LUNGA, SCIA_PUNTI, SCIA_VITA, scriviScia } from '../render/scia_acqua.ts';

export type Scia = { update(dt: number, x: number, z: number, yaw: number, wake: number): void; count(): number };

const PASSO = SCIA_LUNGA / (SCIA_PUNTI - 2); // la strada registrata è lunga SCIA_LUNGA metri (un punto resta per la prua di adesso)

/** `halfLen`: mezza lunghezza dello scafo (m): la scia parte dalla prua. */
export function createScia(halfLen: number): Scia {
  // punti registrati, dal più nuovo: x, z, età, forza
  const px = new Float32Array(SCIA_PUNTI), pz = new Float32Array(SCIA_PUNTI), eta = new Float32Array(SCIA_PUNTI), forza = new Float32Array(SCIA_PUNTI);
  const out = new Float32Array(SCIA_PUNTI * 4);
  let n = 0, scritti = 0;
  const me = {};
  return {
    count: () => n,
    update(dt, x, z, yaw, wake) {
      const bx = x + Math.sin(yaw) * (halfLen - 0.7), bz = z - Math.cos(yaw) * (halfLen - 0.7);
      for (let i = 0; i < n; i++) eta[i] = eta[i]! + dt;
      while (n > 0 && eta[n - 1]! >= SCIA_VITA) n--;
      if (wake > 0.06 && (n === 0 || Math.hypot(bx - px[0]!, bz - pz[0]!) >= PASSO)) {
        const m = Math.min(n, SCIA_PUNTI - 2); // uno resta per la prua di adesso
        px.copyWithin(1, 0, m); pz.copyWithin(1, 0, m); eta.copyWithin(1, 0, m); forza.copyWithin(1, 0, m);
        px[0] = bx; pz[0] = bz; eta[0] = 0; forza[0] = wake; n = m + 1;
      }
      // prua di adesso + strada fatta
      const tot = n > 0 ? n + 1 : 0;
      if (tot > 0) {
        out[0] = bx; out[1] = bz; out[2] = 0; out[3] = wake;
        for (let i = 0; i < n; i++) { const k = (i + 1) * 4; out[k] = px[i]!; out[k + 1] = pz[i]!; out[k + 2] = eta[i]!; out[k + 3] = forza[i]!; }
      }
      if (tot > 0 || scritti > 0) scriviScia(me, out, tot);
      scritti = tot;
    },
  };
}
