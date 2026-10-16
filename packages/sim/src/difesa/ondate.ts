// Le ondate della Difesa (docs/DIFESA.md §2.4), come in Plants vs Zombies: budget a punti per ondata, pesca a caso coi pesi, ondata
// bandiera ogni 10 (×2,5 + nemici base + quello con la bandiera), nemico nuovo a metà livello e alla fine, l'ondata dopo che arriva prima
// quando quella in corso ha perso abbastanza vita, corsia scelta «liscia» e pietà per la corsia salvata dal tosaerba.
import type { DTipoNemico } from '@marea/content/difesa.ts';
import { DIFESA } from '@marea/content/difesa.ts';
import type { DNemico, DState } from './stato.ts';
import { caso, defPartita, livelloDef, prof, tick, totOndate, tra, vivo } from './stato.ts';

/** Punti dell'ondata n (da 0). */
export function puntiOndata(s: DState, n: number): number {
  const O = prof(s).ondate;
  if (s.livello < 0) return Math.floor((n * O.sopravvivenza.molt) / O.sopravvivenza.diviso) + O.sopravvivenza.piu;
  return Math.floor(n / O.budget.diviso) + O.budget.piu;
}
/** L'ondata n è una bandiera? L'ultima di ogni gruppo di `ogni` (se il livello ne ha meno, l'ultima); mai nel tutorial. */
export function eBandiera(s: DState, n: number): boolean {
  const def = livelloDef(s), ogniCfg = prof(s).ondate.bandiera.ogni;
  if (def?.tutorial) return false;
  const ogni = def && def.ondate < ogniCfg ? def.ondate : ogniCfg;
  return n % ogni === ogni - 1;
}
/** Bandiere già passate (Sopravvivenza): rende più rari i nemici facili e anticipa i difficili. */
const bandierePassate = (s: DState, n: number): number => Math.floor(n / prof(s).ondate.bandiera.ogni);
/** Da a a b mentre x va da x0 a x1 (fermo fuori). */
function curva(x0: number, x1: number, x: number, a: number, b: number): number {
  const t = x <= x0 ? 0 : x >= x1 ? 1 : (x - x0) / (x1 - x0);
  return a + (b - a) * t;
}

function scegliTipo(s: DState, punti: number, n: number): DTipoNemico | null {
  const P = prof(s), tipi = defPartita(s).nemici, b = s.livello < 0 ? bandierePassate(s, n) : 0;
  let tot = 0;
  const pesi: number[] = [];
  for (const t of tipi) {
    const d = P.nemici[t];
    const dall = s.livello < 0 ? Math.max(1, d.dallOndata - Math.floor(curva(18, 50, b, 0, 15))) : d.dallOndata;
    let w = n + 1 < dall || punti < d.punti ? 0 : d.peso;
    if (s.livello < 0 && t === 'base') w = curva(10, 50, b, w, w / 10);
    if (s.livello < 0 && t === 'cono') w = curva(10, 50, b, w, w / 4);
    pesi.push(w); tot += w;
  }
  if (tot <= 0) return null;
  let x = caso(s) * tot;
  for (let i = 0; i < tipi.length; i++) { if (pesi[i]! <= 0) continue; x -= pesi[i]!; if (x <= 0) return tipi[i]!; }
  for (let i = tipi.length - 1; i >= 0; i--) if (pesi[i]! > 0) return tipi[i]!;
  return null;
}

/** Compone l'ondata n: prima i nemici obbligati (bandiera, nemico nuovo, tutti i tipi nell'ultima), poi a caso col budget che resta. */
export function componiOndata(s: DState, n: number): DTipoNemico[] {
  const P = prof(s), def = livelloDef(s), out: DTipoNemico[] = [];
  let punti = puntiOndata(s, n);
  const metti = (t: DTipoNemico) => { out.push(t); punti -= P.nemici[t].punti; };
  if (eBandiera(s, n)) {
    const base = Math.min(punti, P.ondate.bandiera.baseMax);
    punti = Math.floor(punti * P.ondate.bandiera.molt);
    for (let i = 0; i < base; i++) metti('base');
    metti('bandiera');
  }
  const finale = !!def && n === def.ondate - 1;
  if (def?.intro && (n === Math.floor(def.ondate / 2) || finale)) metti(def.intro);
  if (def && finale) for (const t of def.nemici) if (P.nemici[t].peso > 0 && !out.includes(t)) metti(t);
  while (punti > 0 && out.length < 50) {
    const t = scegliTipo(s, punti, n);
    if (!t) break;
    metti(t);
  }
  return out;
}

/** Peso «liscio» di una corsia (come la scelta delle righe di PvZ): sale con le scelte passate dall'ultima e dalla penultima volta. */
function liscio(w: number, ultimo: number, penultimo: number): number {
  if (w < 1e-6) return 0;
  const e1 = 1 / w, e2 = e1 * 2;
  const f1 = 1 + ((ultimo + 1 - e1) / e1) * 2, f2 = 1 + ((penultimo + 1 - e2) / e2) * 2;
  return w * Math.min(100, Math.max(0.01, f1 * 0.75 + f2 * 0.25));
}
/** La corsia del prossimo nemico dell'ondata n. */
export function scegliCorsia(s: DState, n: number): number {
  const pieta = prof(s).pieta, pesi: number[] = [];
  let tot = 0;
  for (let r = 0; r < DIFESA.campo.corsie; r++) {
    let w = 0;
    if (s.corsie.includes(r)) { const d = n - s.tosaOndata[r]!; w = d <= 0 ? pieta[0]! : d <= 1 ? pieta[1]! : 1; }
    pesi.push(w); tot += w;
  }
  const adj = pesi.map((w, r) => liscio(w / tot, s.scelte[r]!.ultimo, s.scelte[r]!.penultimo));
  const totAdj = adj.reduce((a, b) => a + b, 0);
  let x = caso(s) * totAdj, k = -1;
  for (let r = 0; r < adj.length; r++) { if (adj[r]! <= 0) continue; k = r; x -= adj[r]!; if (x <= 0) break; }
  for (let r = 0; r < adj.length; r++) if (pesi[r]! > 0) { s.scelte[r]!.ultimo += 1; s.scelte[r]!.penultimo += 1; }
  s.scelte[k]!.penultimo = s.scelte[k]!.ultimo; s.scelte[k]!.ultimo = 0;
  return k;
}

/** Vita che resta ai nemici (vivi) dell'ondata n: corpo + armatura. */
export function vitaOndata(s: DState, n: number): number {
  let v = 0;
  for (const e of s.nemici) if (e.ondata === n && vivo(e)) v += e.vita + e.armatura;
  return v;
}

export function nuovoNemico(s: DState, tipo: DTipoNemico, corsia: number, x: number, ondata: number): DNemico {
  const d = prof(s).nemici[tipo];
  const passo = tra(s, d.passo) / tick(1), corsa = d.corsa ? tra(s, d.corsa) / tick(1) : 0;
  return {
    id: s.nid++, tipo, corsia, x, vita: d.vita, vitaMax: d.vita, armatura: d.armatura, armaturaMax: d.armatura,
    passo, corsa, salto: 0, saltoDa: 0, saltoA: 0, saltoT0: 0, saltoT1: 0,
    gelo: 0, mangia: 0, testa: true, muore: 0, ondata, nato: s.tick, colpito: -9999,
  };
}

function lancia(s: DState): void {
  const P = prof(s), C = DIFESA.campo, n = s.ondata, tot = totOndate(s);
  if (!s.ondate[n]) s.ondate[n] = componiOndata(s, n);
  const tipi = s.ondate[n]!, bandiera = eBandiera(s, n);
  for (const t of tipi) {
    const corsia = scegliCorsia(s, n);
    const x = C.ingresso + caso(s) * C.ingressoCaso + (bandiera ? C.bandieraIndietro : 0);
    s.nemici.push(nuovoNemico(s, t, corsia, x, n));
  }
  s.ondata++;
  s.ev.push({ e: 'ondata', n, finale: tot > 0 && s.ondata >= tot, quanti: tipi.length });
  s.vitaInizio = vitaOndata(s, n);
  if (tot < 0 || s.ondata < tot) {
    s.vitaProssima = tra(s, P.ondate.anticipo.soglia) * s.vitaInizio;
    s.conto = tick(tra(s, P.ondate.tra));
  } else { s.vitaProssima = -1; s.conto = 0; }
  s.contoInizio = s.conto;
}

/** Il conto alla rovescia delle ondate (un tick). */
export function passoOndate(s: DState): void {
  const A = prof(s).ondate.anticipo, tot = totOndate(s);
  if (s.enorme > 0) {
    s.enorme--;
    if (s.enorme > 0) return;
    s.conto = 1;
  }
  if (tot >= 0 && s.ondata >= tot) return;
  s.conto--;
  if (s.conto > tick(A.conto) && s.contoInizio - s.conto > tick(A.dopo) && s.vitaProssima >= 0 && vitaOndata(s, s.ondata - 1) <= s.vitaProssima) s.conto = tick(A.conto);
  if (s.conto === 3) {
    if (eBandiera(s, s.ondata)) { s.enorme = tick(prof(s).ondate.bandiera.avviso); s.ev.push({ e: 'enorme', n: s.ondata }); return; }
    if (s.ondata === 0) s.ev.push({ e: 'arriva', n: 0 });
  }
  if (s.conto <= 0) lancia(s);
}
