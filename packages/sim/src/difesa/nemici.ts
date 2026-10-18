// I nemici della Difesa (docs/DIFESA.md §2.3): camminano verso sinistra, si fermano a mordere il primo difensore che toccano (100 di
// danno al secondo), l'armatura prende i colpi prima del corpo, sotto un terzo della vita cade la testa (non mordono più e spariscono
// poco dopo), il gelo dimezza passo e morsi, il saltatore corre e salta il primo difensore. Qui anche il danno e il tosaerba.
import { DIFESA } from '@marea/content/difesa.ts';
import type { DNemico, DState, DUnita } from './stato.ts';
import { prof, tick, vivo } from './stato.ts';

/** Il bordo sinistro del nemico (dove morde): mezza casella abbondante davanti al centro. */
export const BOCCA = 0.3;
/** Mezza larghezza del corpo per i colpi. */
export const CORPO = 0.3;

/** Danno a un nemico: prima l'armatura (il resto passa al corpo), poi il corpo; sotto la soglia cade la testa, a zero sparisce. */
export function ferisci(s: DState, e: DNemico, danno: number, gelo = false): void {
  if (e.vita <= 0) return;
  const P = prof(s);
  if (gelo) e.gelo = s.tick + tick(P.gelo.durata);
  let d = danno, armatura = false;
  if (e.armatura > 0) {
    const a = Math.min(e.armatura, d);
    e.armatura -= a; d -= a; armatura = true;
    if (e.armatura <= 0) s.ev.push({ e: 'armatura', id: e.id, tipo: e.tipo });
  }
  e.colpito = s.tick;
  s.ev.push({ e: 'colpito', id: e.id, corsia: e.corsia, x: e.x, gelo, armatura });
  if (d <= 0) return;
  e.vita -= d;
  if (e.testa && e.vita < e.vitaMax * P.testa.soglia) {
    e.testa = false; e.mangia = 0; e.muore = s.tick + tick(P.testa.dopo);
    s.ev.push({ e: 'testa', id: e.id });
  }
  if (e.vita <= 0) muori(s, e);
}
export function muori(s: DState, e: DNemico): void {
  e.vita = 0; e.testa = false;
  const i = s.nemici.indexOf(e);
  if (i >= 0) s.nemici.splice(i, 1);
  s.stats.uccisi++;
  s.ev.push({ e: 'morto', id: e.id, tipo: e.tipo, corsia: e.corsia, x: e.x });
}

/** Il difensore che il nemico sta toccando con la bocca (il più a destra), se c'è. */
function davanti(s: DState, e: DNemico): DUnita | undefined {
  let best: DUnita | undefined;
  for (const u of s.unita) {
    if (u.corsia !== e.corsia) continue;
    if (e.x - BOCCA <= u.col + 0.85 && e.x >= u.col + 0.15 && (!best || u.col > best.col)) best = u;
  }
  return best;
}

export function passoNemici(s: DState): void {
  const P = prof(s), C = DIFESA.campo;
  for (const e of [...s.nemici]) {
    if (!e.testa) {
      if (s.tick >= e.muore) { muori(s, e); continue; }
      e.x -= e.passo * (e.gelo > s.tick ? P.gelo.passo : 1);
      continue;
    }
    const lento = e.gelo > s.tick ? P.gelo.passo : 1;
    // il saltatore: corre fino al primo difensore, ci salta sopra e atterra dietro, poi cammina
    if (e.salto === 1) {
      const k = (s.tick - e.saltoT0) / Math.max(1, e.saltoT1 - e.saltoT0);
      e.x = e.saltoDa + (e.saltoA - e.saltoDa) * Math.min(1, k);
      if (s.tick >= e.saltoT1) e.salto = 2;
      continue;
    }
    const u = davanti(s, e);
    if (e.corsa > 0 && e.salto === 0 && u) {
      e.salto = 1; e.saltoDa = e.x; e.saltoA = u.col - 0.05; e.saltoT0 = s.tick; e.saltoT1 = s.tick + tick(P.nemici[e.tipo].salto ?? 1);
      s.ev.push({ e: 'salta', id: e.id });
      continue;
    }
    if (u && !(u.tipo === 'mina' && u.armata)) {
      e.mangia = u.id;
      u.vita -= (P.morso / tick(1)) * (e.gelo > s.tick ? P.gelo.morso : 1);
      if (s.tick - u.morsa >= tick(0.45)) { u.morsa = s.tick; s.ev.push({ e: 'morso', id: e.id, unita: u.id }); }
      if (u.vita <= 0) {
        s.unita.splice(s.unita.indexOf(u), 1);
        s.stats.mangiate++;
        s.ev.push({ e: 'mangiato', id: u.id, tipo: u.tipo, corsia: u.corsia, col: u.col });
        e.mangia = 0;
      }
      continue;
    }
    e.mangia = 0;
    e.x -= (e.corsa > 0 && e.salto === 0 ? e.corsa : e.passo) * lento;
    // in fondo alla corsia: parte il tosaerba; se è già andato, la base è persa
    const t = s.tosa[e.corsia]!;
    if (t.stato === 0 && e.x - BOCCA <= C.tosaerba + 0.35) {
      t.stato = 1; s.stats.tosaerba++; s.tosaOndata[e.corsia] = s.ondata;
      s.ev.push({ e: 'tosaerba', corsia: e.corsia });
    } else if (t.stato === 2 && e.x <= C.casa && !s.immortale && !s.esito) {
      s.esito = 'persa'; s.fine = s.tick;
      s.ev.push({ e: 'persa' });
    }
  }
}

/** Il tosaerba che corre: spazza via tutti i nemici della sua corsia, poi è usato. */
export function passoTosaerba(s: DState): void {
  const v = prof(s).tosaerba.vel / tick(1), C = DIFESA.campo;
  for (let r = 0; r < s.tosa.length; r++) {
    const t = s.tosa[r]!;
    if (t.stato !== 1) continue;
    t.x += v;
    for (const e of [...s.nemici]) if (e.corsia === r && Math.abs(e.x - t.x) < 0.45 && e.vita > 0) muori(s, e);
    if (t.x > C.colonne + 1.2) t.stato = 2;
  }
}

/** I nemici vivi della corsia, da sinistra a destra. */
export const nemiciIn = (s: DState, corsia: number): DNemico[] => s.nemici.filter((e) => e.corsia === corsia && vivo(e)).sort((a, b) => a.x - b.x);
