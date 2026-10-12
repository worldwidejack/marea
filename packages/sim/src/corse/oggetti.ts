// Gli oggetti alla Mario Kart (#250, docs/CORSE.md A7): scatole sulla pista, roulette, e cinque effetti (turbo, trappola lasciata dietro,
// colpo dritto, colpo che insegue chi sta davanti, scudo). Solo nelle gare CON OGGETTI. Numeri in CORSE.oggetti (motore.json).
// Tutto vive in «progresso» (m dal via, come Veicolo.prog): sui circuiti si confronta a meno di un giro, così trappole e scatole valgono
// a ogni giro. Scatole, trappole e colpi dritti stanno sulla principale: chi è su un ramo non li prende. Il colpo a ricerca invece arriva sempre.
// Avanti o indietro (Jack, 12 ott): di serie la trappola cade dietro e i colpi partono avanti; USA «dall'altra parte» (InputFrame.c, senza
// frenare: Jack, «uno non deve per forza frenare per sparare») li manda al contrario: la trappola vola avanti di `lancio` m, il colpo dritto va indietro, quello a ricerca insegue
// chi ti sta subito dietro.
// La pesca è casuale ma dal seed (createRng con seed, tick e veicolo): il server la rigioca uguale. Chi è dietro in classifica pesca meglio.
import { CORSE } from '@marea/content/corse.ts';
import type { COggettoDef } from '@marea/content/corse.ts';
import { DT } from '../constants.ts';
import { createRng } from '../rng.ts';
import { campo } from './nastro.ts';
import { VUOTO, superficieA, suBinari } from './pista.ts';
import type { Pista } from './pista.ts';
import { daiTurbo } from './veicolo.ts';
import type { Regole, Veicolo } from './veicolo.ts';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** La tasca di un veicolo: l'oggetto (id del catalogo, '' = niente), quante volte si usa ancora, la roulette che gira (s), scudo e
 *  colpo preso (s rimasti), USA premuto il tick prima (si usa allo scatto), da quanto lo tiene (s: serve ai bot). */
export type Tasca = { ogg: string; cariche: number; roulette: number; scudo: number; colpito: number; premuto: boolean; tenuto: number };
/** Una scatola: progresso nel giro, scarto laterale, s prima che ricompaia (0 = c'è). */
export type Scatola = { prog: number; lat: number; t: number };
/** Una trappola a terra o un colpo in volo: chi l'ha lanciato, dove, da quanto (s). `bersaglio` = indice del veicolo inseguito (−1 = nessuno). */
export type Trappola = { ogg: string; da: number; prog: number; lat: number; t: number; p0: number };
export type Colpo = { ogg: string; da: number; prog: number; lat: number; t: number; v: number; bersaglio: number };
export type OggettiState = {
  /** Gli id del catalogo che possono uscire su questa pista (base + quelli della zona). */
  pesca: string[];
  scatole: Scatola[];
  tasche: Tasca[];
  trappole: Trappola[];
  colpi: Colpo[];
  /** Per le statistiche: oggetti usati e colpi presi, per veicolo. */
  usati: number[]; presi: number[];
};

export const oggettoDef = (id: string): COggettoDef => {
  const o = CORSE.oggetti.catalogo.find((x) => x.id === id);
  if (!o) throw new Error(`Oggetto sconosciuto: ${id}`);
  return o;
};

/** s sulla principale per un progresso. */
export function sDiProg(p: Pista, prog: number): number {
  const L = p.n.len, s = p.def.via + prog;
  if (p.n.chiuso) { const q = s - Math.floor(s / L) * L; return q >= L ? 0 : q; }
  return clamp(s, 0, L);
}
/** b − a in progresso: sui circuiti a meno di un giro (−mezzo giro..+mezzo giro). */
function dprog(p: Pista, a: number, b: number): number {
  let d = b - a;
  if (p.n.chiuso) { const L = p.arrivo; d -= Math.floor(d / L + 0.5) * L; }
  return d;
}

/** Le scatole della pista: una fila a ogni frazione `righe` del giro (o della fuga), spostata avanti se cade su un buco o sui binari. */
function scatoleDi(p: Pista): Scatola[] {
  const S = CORSE.oggetti.scatole, out: Scatola[] = [];
  for (const r of S.righe) {
    let prog = r * p.arrivo;
    for (let i = 0; i < 12; i++) {
      const s = sDiProg(p, prog);
      if (superficieA(p, -1, s, 0, 1) !== VUOTO && !suBinari(p, -1, s, p.def.famiglia)) break;
      prog += 8;
    }
    const l = campo(p.n, p.n.l, sDiProg(p, prog));
    for (const f of S.lat) out.push({ prog, lat: f * l, t: 0 });
  }
  return out;
}

export function nuoviOggetti(p: Pista, n: number): OggettiState {
  const pesca = CORSE.oggetti.catalogo.filter((o) => o.livello === 'base' || (o.livello === 'zona' && o.zona === p.def.zona)).map((o) => o.id);
  const tasche: Tasca[] = [];
  for (let i = 0; i < n; i++) tasche.push({ ogg: '', cariche: 0, roulette: 0, scudo: 0, colpito: 0, premuto: false, tenuto: 0 });
  return { pesca, scatole: scatoleDi(p), tasche, trappole: [], colpi: [], usati: tasche.map(() => 0), presi: tasche.map(() => 0) };
}

/** Pesca dal catalogo con i pesi della fascia di classifica (0 primi, 1 metà, 2 ultimi). */
function pesca(o: OggettiState, seed: number, tick: number, i: number, fascia: number): string {
  let tot = 0;
  for (const id of o.pesca) tot += oggettoDef(id).pesi[fascia]!;
  let x = createRng(`${seed}:ogg:${tick}:${i}`).next() * tot;
  for (const id of o.pesca) { x -= oggettoDef(id).pesi[fascia]!; if (x < 0) return id; }
  return o.pesca[o.pesca.length - 1]!;
}

/** Chi viene preso: lo scudo lo para, sennò gira senza gas e perde velocità, drift e turbo. */
function colpisci(o: OggettiState, ks: Veicolo[], j: number): void {
  const t = o.tasche[j]!, k = ks[j]!, C = CORSE.oggetti.colpito;
  if (t.scudo > 0) { t.scudo = 0; return; }
  k.v *= C.velocita; k.drift = 0; k.carica = 0; k.turbo = 0; k.livello = 0;
  k.fermo = Math.max(k.fermo, C.secondi);
  t.colpito = C.secondi;
  o.presi[j]!++;
}
const colpibile = (k: Veicolo) => !k.fine && !k.caduto && k.ramo < 0 && k.h < 1.5;

/** Quanto vola una trappola lanciata avanti (s): finché vola non prende nessuno (la resa la disegna in aria). */
export const VOLO_TRAPPOLA = 0.45;

/** Usa l'oggetto in tasca del veicolo `i`, dall'altra parte se `indietro` (vedi in testa). `pos` = posizioni in classifica (1…). */
function usa(o: OggettiState, p: Pista, ks: Veicolo[], i: number, pos: number[], R: Regole, indietro: boolean): void {
  const t = o.tasche[i]!, k = ks[i]!, d = oggettoDef(t.ogg);
  if (d.effetto === 'turbo') daiTurbo(k, d.secondi!, 3, R.somma);
  else if (d.effetto === 'scudo') t.scudo = d.secondi!;
  else if (d.effetto === 'trappola') {
    const avanti = indietro; // la trappola di serie va dietro: dall'altra parte vola avanti
    o.trappole.push({ ogg: d.id, da: i, prog: k.prog + (avanti ? d.lancio! : -d.dietro!), lat: k.ramo < 0 ? k.lat : 0, t: avanti ? -VOLO_TRAPPOLA : 0, p0: k.prog });
    if (o.trappole.length > CORSE.oggetti.massimiATerra) o.trappole.shift();
  } else {
    // il colpo a ricerca insegue chi ti sta subito davanti (o dietro); dal primo (o dall'ultimo) posto va dritto
    const bersaglio = d.effetto === 'ricerca' ? pos.indexOf(pos[i]! + (indietro ? 1 : -1)) : -1;
    const v = indietro ? Math.max(0, k.v) - d.velocita! : d.velocita! + Math.max(0, k.v);
    o.colpi.push({ ogg: d.id, da: i, prog: k.prog + (indietro ? -2.5 : 2.5), lat: k.ramo < 0 ? k.lat : 0, t: 0, v, bersaglio });
  }
  o.usati[i]!++;
  t.cariche--; t.tenuto = 0;
  if (t.cariche <= 0) { t.ogg = ''; t.cariche = 0; }
}

/** Quando usa l'oggetto un bot (0 = no, 1 = sì, 2 = sì e indietro): lo scudo e il razzo quasi subito, il turbo dopo un attimo, la
 *  trappola (dietro) se qualcuno lo segue da vicino, il colpo dritto se ha qualcuno in fila davanti, o dietro e vicino (comunque, dopo un po', li usa). */
function botUsa(o: OggettiState, p: Pista, ks: Veicolo[], i: number): 0 | 1 | 2 {
  const t = o.tasche[i]!, k = ks[i]!, d = oggettoDef(t.ogg);
  if (d.effetto === 'scudo') return t.tenuto > 0.4 ? 1 : 0;
  if (d.effetto === 'ricerca') return t.tenuto > 1 ? 1 : 0;
  if (d.effetto === 'turbo') return t.tenuto > 1.3 ? 1 : 0;
  if (t.tenuto > 6) return 1;
  if (k.ramo >= 0) return 0;
  for (let j = 0; j < ks.length; j++) {
    const a = ks[j]!;
    if (j === i || !colpibile(a)) continue;
    const dp = dprog(p, k.prog, a.prog), fila = Math.abs(a.lat - k.lat) < 1.4;
    if (d.effetto === 'trappola' && dp < -2 && dp > -14) return 1;
    if (d.effetto === 'dritto' && fila && dp > 3 && dp < 30) return 1;
    if (d.effetto === 'dritto' && fila && dp < -3 && dp > -12) return 2;
  }
  return 0;
}

/** Un tick degli oggetti, dopo la guida di tutti: scatole, roulette, USA (il tuo dal bottone, i bot da soli), trappole e colpi. */
export function passoOggetti(o: OggettiState, p: Pista, ks: Veicolo[], usaTu: boolean, indietroTu: boolean, posizioni: () => number[], seed: number, tick: number, R: Regole): void {
  const S = CORSE.oggetti.scatole;
  let pos: number[] | null = null;
  const classifica = () => (pos ??= posizioni());
  // scatole: chi ci passa sopra e ha la tasca vuota pesca (la scatola sparisce comunque)
  for (const b of o.scatole) {
    if (b.t > 0) { b.t = Math.max(0, b.t - DT); continue; }
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i]!;
      if (!colpibile(k) || Math.abs(dprog(p, k.prog, b.prog)) > S.raggio || Math.abs(k.lat - b.lat) > S.raggio) continue;
      b.t = S.ricompare;
      const t = o.tasche[i]!;
      if (t.ogg || t.roulette > 0) break;
      const c = classifica(), n = ks.length, q = n > 1 ? (c[i]! - 1) / (n - 1) : 0;
      t.ogg = pesca(o, seed, tick, i, q < 0.34 ? 0 : q < 0.67 ? 1 : 2);
      t.cariche = oggettoDef(t.ogg).cariche;
      t.roulette = S.roulette; t.tenuto = 0;
      break;
    }
  }
  // tasche: roulette, scudo, colpo preso; poi chi usa l'oggetto
  for (let i = 0; i < ks.length; i++) {
    const t = o.tasche[i]!, k = ks[i]!;
    t.roulette = Math.max(0, t.roulette - DT);
    t.scudo = Math.max(0, t.scudo - DT);
    t.colpito = Math.max(0, t.colpito - DT);
    const scatto = i === 0 ? usaTu && !t.premuto : false;
    if (i === 0) t.premuto = usaTu;
    if (!t.ogg || t.roulette > 0 || k.fine || k.caduto) continue;
    t.tenuto += DT;
    const b = i === 0 ? (scatto ? (indietroTu ? 2 : 1) : 0) : botUsa(o, p, ks, i);
    if (b) usa(o, p, ks, i, classifica(), R, b === 2);
  }
  // trappole: chi ci passa sopra (anche chi l'ha lasciata, dopo un attimo) gira; spariscono col tempo
  for (let x = o.trappole.length - 1; x >= 0; x--) {
    const tr = o.trappole[x]!, d = oggettoDef(tr.ogg);
    tr.t += DT;
    let preso = tr.t > d.durata!;
    if (!preso && tr.t >= 0) for (let j = 0; j < ks.length; j++) {
      const k = ks[j]!;
      if ((j === tr.da && tr.t < 1) || !colpibile(k)) continue;
      if (Math.abs(dprog(p, k.prog, tr.prog)) <= d.raggio! && Math.abs(k.lat - tr.lat) <= d.raggio!) { colpisci(o, ks, j); preso = true; break; }
    }
    if (preso) o.trappole.splice(x, 1);
  }
  // colpi in volo: il dritto va avanti nella sua corsia, quello a ricerca stringe verso il bersaglio e lo prende sempre
  for (let x = o.colpi.length - 1; x >= 0; x--) {
    const c = o.colpi[x]!, d = oggettoDef(c.ogg), b = c.bersaglio >= 0 ? ks[c.bersaglio]! : null;
    c.t += DT;
    c.prog += c.v * DT;
    const l = campo(p.n, p.n.l, sDiProg(p, c.prog));
    if (b && b.ramo < 0) c.lat += clamp(b.lat - c.lat, -d.sterza! * DT, d.sterza! * DT);
    c.lat = clamp(c.lat, -l, l);
    let finito = c.t > d.vita! || (!p.n.chiuso && (c.prog > p.arrivo || c.prog < -p.def.via));
    if (!finito && b) {
      if (b.fine || b.caduto) c.bersaglio = -1;
      else if (c.v >= 0 ? c.prog >= b.prog - d.raggio! : c.prog <= b.prog + d.raggio!) { colpisci(o, ks, c.bersaglio); finito = true; }
    }
    if (!finito && !b) for (let j = 0; j < ks.length; j++) {
      const k = ks[j]!;
      if ((j === c.da && c.t < 0.5) || !colpibile(k)) continue;
      if (Math.abs(dprog(p, k.prog, c.prog)) <= d.raggio! && Math.abs(k.lat - c.lat) <= d.raggio!) { colpisci(o, ks, j); finito = true; break; }
    }
    if (finito) o.colpi.splice(x, 1);
  }
}
