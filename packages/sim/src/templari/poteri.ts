// Power-up (docs/TEMPLARI.md §9): escono da terra dove muore uno zombie (2,5 %, al massimo 4 a ondata; i boss ne lasciano sempre uno),
// restano 25 s e si prendono passandoci sopra. Faretra piena (munizioni piene) · Ira di Dio (30 s, ogni colpo uccide, boss esclusi) ·
// Campane a martello (muoiono tutti gli zombie in campo, boss esclusi, +400) · Decima (30 s punti doppi) · Muratori (finestre rifatte, +200).
// Li fa uscire `lasciaPotere` in colpi.ts (alla morte di uno zombie).
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import type { TPotere } from '@marea/content/templari.ts';
import type { TState } from './stato.ts';
import { ev, inPiedi, secToTicks, slotDi, usa } from './stato.ts';
import { dai, uccidi } from './colpi.ts';
import { setFinestra } from './mappa.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

export function applica(s: TState, tipo: TPotere): void {
  const k = TEMPLARI.poteri, h = s.eroe;
  switch (tipo) {
    case 'faretra':
      for (const sl of h.armi) if (sl) { const a = armaDef(sl.id); if (a.tipo !== 'mischia') { const p = slotDi(a, !!sl.pot); sl.colpi = p.colpi; sl.riserva = p.riserva; } }
      h.ricarica = 0;
      break;
    case 'ira': s.poteri.ira = s.tick + secToTicks(k.durata); break;
    case 'decima': s.poteri.decima = s.tick + secToTicks(k.durata); break;
    case 'campane':
      for (const z of s.zombie) if (z.st !== 'morto' && z.st !== 'fugge' && !z.def.boss) uccidi(s, z, false);
      dai(s, k.campane, 'potere');
      break;
    case 'muratori':
      s.arena.finestre.forEach((_, i) => { s.assi[i] = TEMPLARI.barricate.assi; setFinestra(s.arena, s.gr, i, TEMPLARI.barricate.assi); });
      for (const z of s.zombie) if (z.st === 'strappa') { z.finestra = -1; z.st = 'insegue'; z.stT = 0; z.stDur = 0; }
      dai(s, k.muratori, 'potere');
  }
}

/** I power-up a terra che un eroe tocca (la Faretra riempie le armi di chi la prende; gli altri valgono per tutti). */
export function stepPoteri(s: TState): void {
  if (!s.drops.length) return;
  const r = TEMPLARI.poteri.raggio + TEMPLARI.eroe.raggio;
  for (const k of inPiedi(s)) {
    const h = s.eroi[k]!;
    for (let i = 0; i < s.drops.length; i++) {
      const d = s.drops[i]!;
      if (d.tipo === 'scudo' || d.fine <= s.tick) continue;
      if ((d.x - h.x) * (d.x - h.x) + (d.z - h.z) * (d.z - h.z) > r * r) continue;
      s.drops.splice(i--, 1);
      usa(s, k);
      ev(s, { t: 'potere', tipo: d.tipo, preso: true, x: r2(d.x), z: r2(d.z) });
      applica(s, d.tipo);
    }
  }
}
