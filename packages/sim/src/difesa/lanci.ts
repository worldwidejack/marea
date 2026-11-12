// Il mortaio della Difesa: tira ogni tanto un colpo in arco sul nemico di terra più avanzato di QUALSIASI corsia, ma non su chi gli sta
// troppo vicino (la zona morta attorno a lui, `minimo` caselle). Il colpo ci mette un po' ad arrivare (più lontano, più tempo) e cade
// davanti al bersaglio, dove sarà: fa il danno pieno al centro e uno splash ridotto attorno. Chi vola non lo prende.
import type { DUnitaDef } from '@marea/content/difesa.ts';
import { DIFESA } from '@marea/content/difesa.ts';
import type { DNemico, DState, DUnita } from './stato.ts';
import { prof, tick, vivo } from './stato.ts';
import { ferisci } from './nemici.ts';

/** Il bersaglio: il nemico di terra più a sinistra (il più avanzato) che sta oltre la zona morta; a parità, il più vicino. */
function bersaglio(s: DState, u: DUnita, minimo: number): DNemico | null {
  const cx = u.col + 0.5, cy = u.corsia + 0.5;
  let best: DNemico | null = null, bd = 0;
  for (const e of s.nemici) {
    if (!vivo(e) || e.vola || e.salto === 1 || e.x > DIFESA.campo.visibile) continue;
    const dx = e.x - cx, dy = e.corsia + 0.5 - cy, d2 = dx * dx + dy * dy;
    if (d2 < minimo * minimo) continue;
    if (!best || e.x < best.x || (e.x === best.x && d2 < bd)) { best = e; bd = d2; }
  }
  return best;
}

/** Il mortaio `u` tira: false se non c'è nessuno da colpire fuori dalla zona morta. */
export function lanciaDa(s: DState, u: DUnita, d: DUnitaDef): boolean {
  const e = bersaglio(s, u, d.minimo ?? 2);
  if (!e) return false;
  const cx = u.col + 0.5, cy = u.corsia + 0.5, dx = e.x - cx, dy = e.corsia + 0.5 - cy;
  const T = tick((d.voloBase ?? 0.8) + (d.voloCasella ?? 0.1) * Math.sqrt(dx * dx + dy * dy));
  // si mira davanti al nemico, dove sarà quando il colpo arriva (fermo se sta mordendo)
  const v = e.mangia > 0 ? 0 : (e.corsa > 0 && e.salto === 0 ? e.corsa : e.passo) * (e.gelo > s.tick ? prof(s).gelo.passo : 1);
  s.lanci.push({ id: s.nid++, da: [cx, cy], a: [Math.max(0.2, e.x - v * T), e.corsia + 0.5], t0: s.tick, t1: s.tick + T, danno: d.danno ?? 60, splash: d.splash ?? 0.5, centro: d.centro ?? 0.5, raggio: d.raggio ?? 1 });
  s.ev.push({ e: 'lancia', id: u.id, corsia: u.corsia });
  return true;
}

/** I colpi in arco: quando arrivano, danno al centro e splash attorno ai nemici di terra. */
export function passoLanci(s: DState): void {
  for (const l of [...s.lanci]) {
    if (s.tick < l.t1) continue;
    s.lanci.splice(s.lanci.indexOf(l), 1);
    s.ev.push({ e: 'cade', x: l.a[0], y: l.a[1] });
    for (const e of [...s.nemici]) {
      if (!vivo(e) || e.vola || e.salto === 1) continue;
      const dx = e.x - l.a[0], dy = e.corsia + 0.5 - l.a[1], d2 = dx * dx + dy * dy;
      if (d2 > l.raggio * l.raggio) continue;
      ferisci(s, e, d2 <= l.centro * l.centro ? l.danno : l.danno * l.splash);
    }
  }
}
