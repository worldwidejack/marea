// Il pilota automatico della Difesa: gioca come una persona, a tre livelli di bravura, per i test e per lo strumento di bilanciamento
// (tools/difesa_bilancio.mjs). Ragiona ogni `reazione` secondi: raccoglie le monete, poi fa una mossa alla volta in quest'ordine:
// bomba sui gruppi o sulle emergenze, esca per il saltatore, produttori finché la difesa regge, tiratori dove il danno non basta,
// muri davanti ai nemici corazzati, mine per i nemici soli lontani, il gelo dove ci sono già tiratori. Il bravo pianta al posto giusto;
// il medio è più lento e ogni tanto sbaglia casella; il distratto reagisce tardi, si perde monete e mette i difensori un po' a caso.
// Ha il suo caso (non tocca quello della partita): la partita resta la stessa a parità di seme e di mosse.
import type { DTipoUnita } from '@marea/content/difesa.ts';
import { DIFESA } from '@marea/content/difesa.ts';
import type { DComando, DNemico, DState } from './stato.ts';
import { caso, prof, tick, unitaIn, vivo } from './stato.ts';

export type DBravura = 'bravo' | 'medio' | 'distratto';
export type DBot = { bravura: DBravura; caso: number; prossima: number; viste: Record<number, 1 | 2> };
type Stile = { reazione: number; raccogli: number; perde: number; produttori: number; bomba: number; mina: boolean; muro: number; gelo: boolean; sbaglia: number; anticipo: boolean };
const STILI: Record<DBravura, Stile> = {
  bravo: { reazione: 0.25, raccogli: 0.3, perde: 0, produttori: 2, bomba: 1, mina: true, muro: 1, gelo: true, sbaglia: 0, anticipo: true },
  medio: { reazione: 0.9, raccogli: 1.4, perde: 0.05, produttori: 1.4, bomba: 0.7, mina: true, muro: 0.7, gelo: true, sbaglia: 0.15, anticipo: true },
  distratto: { reazione: 2.2, raccogli: 3.2, perde: 0.3, produttori: 1, bomba: 0.3, mina: false, muro: 0.3, gelo: false, sbaglia: 0.45, anticipo: false },
};

export function creaBot(bravura: DBravura, seme = 7): DBot {
  return { bravura, caso: (seme >>> 0) || 1, prossima: 0, viste: {} };
}

const DPS = (s: DState, t: DTipoUnita): number => { const d = prof(s).unita[t]; return d.tipo === 'tiro' ? (d.danno ?? 20) / ((d.cadenza ?? 1.5) - (d.cadenzaCaso ?? 0) / 2) : 0; };
const vitaDi = (e: DNemico): number => e.vita + e.armatura;

/** Le mosse del pilota per questo tick (vuote se non è il momento di ragionare). */
export function autopilota(s: DState, b: DBot): DComando[] {
  if (s.esito || s.tick < b.prossima) return [];
  const st = STILI[b.bravura], P = prof(s), C = DIFESA.campo, out: DComando[] = [];
  b.prossima = s.tick + tick(st.reazione * (0.7 + 0.6 * caso(b)));
  // 1. monete: il distratto se ne perde qualcuna
  for (const m of s.monete) {
    if (!b.viste[m.id]) b.viste[m.id] = caso(b) < st.perde ? 2 : 1;
    if (b.viste[m.id] === 1 && s.tick - m.nata >= tick(st.raccogli)) out.push({ t: 'raccogli', id: m.id });
  }
  let valuta = s.valuta + out.reduce((a, c) => a + (c.t === 'raccogli' ? (s.monete.find((m) => m.id === c.id)?.valore ?? 0) : 0), 0);
  const pronta = (t: DTipoUnita) => { const c = s.carte.find((k) => k.tipo === t); return !!c && c.pronta <= s.tick && valuta >= P.unita[t].costo; };
  const libera = (r: number, c: number) => c >= 0 && c < C.colonne && s.corsie.includes(r) && !unitaIn(s, r, c);
  const metti = (tipo: DTipoUnita, r: number, c: number): boolean => {
    let col = c;
    if (st.sbaglia > 0 && caso(b) < st.sbaglia) col = Math.max(0, Math.min(C.colonne - 1, c + Math.floor(caso(b) * 5) - 2));
    if (!libera(r, col)) col = c;
    if (!libera(r, col)) return false;
    out.push({ t: 'pianta', tipo, corsia: r, col });
    valuta -= P.unita[tipo].costo;
    return true;
  };
  const corsie = s.corsie;
  const nem = (r: number) => s.nemici.filter((e) => e.corsia === r && vivo(e) && e.x <= C.ingresso + 1.5);
  const unitaDi = (r: number) => s.unita.filter((u) => u.corsia === r);
  const dpsCorsia = (r: number) => unitaDi(r).reduce((a, u) => a + DPS(s, u.tipo), 0);
  /** Quanto manca: vita dei nemici della corsia contro il danno che la corsia fa prima che arrivino ai tiratori. */
  const bisogno = (r: number) => {
    const ns = nem(r);
    if (!ns.length) return 0;
    const front = Math.min(...ns.map((e) => e.x)), tiratori = unitaDi(r).filter((u) => DPS(s, u.tipo) > 0);
    const muro = unitaDi(r).some((u) => u.tipo === 'muro' && u.col < front) ? 25 : 0;
    const tempo = Math.max(3, (front - Math.max(1, ...tiratori.map((u) => u.col + 1))) / 0.16) + muro;
    return ns.reduce((a, e) => a + vitaDi(e), 0) / tempo - dpsCorsia(r);
  };
  const tiratoriIn = (r: number) => unitaDi(r).filter((u) => DPS(s, u.tipo) > 0).length;
  const produttori = s.unita.filter((u) => P.unita[u.tipo].tipo === 'produce').length;
  const carta = (t: DTipoUnita) => s.carte.some((c) => c.tipo === t);
  // 0. tutorial: niente arriva finché non pianti
  if (s.attesa && pronta('sparatore')) { metti('sparatore', corsie[0]!, 2); return out; }

  // 2. bomba: gruppo grosso o un nemico ormai addosso a una corsia che non lo ferma
  if (carta('bomba') && pronta('bomba') && caso(b) < st.bomba) {
    let best = { v: 0, r: -1, c: -1 };
    for (const r0 of corsie) for (let c = 0; c < C.colonne; c++) {
      let v = 0;
      for (const e of s.nemici) if (vivo(e) && Math.abs(e.corsia - r0) <= 1 && e.x >= c + 0.5 - 1.5 && e.x <= c + 0.5 + 1.5 && e.x < C.visibile) v += vitaDi(e) + (e.x < 2.5 ? 600 : 0);
      if (v > best.v && libera(r0, c)) best = { v, r: r0, c };
    }
    if (best.v >= 1200 || (best.v >= 700 && bisogno(best.r) > 0)) { metti('bomba', best.r, best.c); return out; }
  }
  // 3. il saltatore che corre: un'esca a destra (lo fa saltare lì, poi cammina piano)
  for (const r of corsie) {
    const sal = nem(r).find((e) => e.corsa > 0 && e.salto === 0 && e.x < C.visibile + 0.3);
    if (!sal || caso(b) < st.sbaglia) continue;
    const primo = Math.max(-1, ...unitaDi(r).map((u) => u.col));
    if (primo >= Math.floor(sal.x) - 1 || primo >= 6) continue;
    const esca: DTipoUnita | null = carta('mina') && pronta('mina') ? 'mina' : carta('muro') && pronta('muro') ? 'muro' : null;
    if (esca && metti(esca, r, Math.min(C.colonne - 1, Math.max(primo + 2, 6)))) return out;
  }
  // 4. una corsia nei guai: tiratore (o gelo) nella prima casella libera dopo i produttori
  const urgenti = corsie.filter((r) => bisogno(r) > 0).sort((a, z) => bisogno(z) - bisogno(a));
  for (const r of urgenti) {
    const gelo = st.gelo && carta('gelo') && tiratoriIn(r) >= 2 && pronta('gelo');
    const tipo: DTipoUnita | null = gelo ? 'gelo' : pronta('sparatore') ? 'sparatore' : null;
    if (!tipo) break;
    for (let c = 1; c <= 6; c++) if (libera(r, c)) { if (metti(tipo, r, c)) return out; break; }
  }
  // 5. economia: produttori in colonna 0 (poi 1) finché la difesa regge
  const voglio = Math.round(st.produttori * corsie.length);
  if (carta('produttore') && produttori < voglio && pronta('produttore') && urgenti.length === 0) {
    for (const c of [0, 1]) {
      const r = corsie.filter((x) => libera(x, c)).sort((a, z) => unitaDi(a).length - unitaDi(z).length)[0];
      if (r !== undefined && metti('produttore', r, c)) return out;
    }
  }
  // 6. un tiratore per corsia prima che arrivino (il distratto aspetta di vederli)
  if (st.anticipo && pronta('sparatore')) {
    const vuota = corsie.find((r) => tiratoriIn(r) === 0 && (!carta('produttore') || produttori >= Math.min(2, voglio) || s.ondata > 0));
    if (vuota !== undefined) for (let c = 1; c <= 4; c++) if (libera(vuota, c)) { if (metti('sparatore', vuota, c)) return out; break; }
  }
  // 7. muro davanti a chi è corazzato o in gruppo
  if (carta('muro') && pronta('muro') && caso(b) < st.muro) {
    for (const r of corsie) {
      const ns = nem(r), tir = unitaDi(r).filter((u) => DPS(s, u.tipo) > 0);
      if (!tir.length || !ns.length || unitaDi(r).some((u) => u.tipo === 'muro')) continue;
      if (!ns.some((e) => e.armatura > 0) && ns.length < 3) continue;
      const c = Math.min(7, Math.max(...tir.map((u) => u.col)) + 2), front = Math.min(...ns.map((e) => e.x));
      if (front > c + 1.2 && metti('muro', r, c)) return out;
    }
  }
  // 8. mina per un nemico solo e lontano (si arma prima che arrivi)
  if (st.mina && carta('mina') && pronta('mina')) {
    for (const r of corsie) {
      const ns = nem(r);
      if (ns.length !== 1 || ns[0]!.corsa > 0) continue;
      const c = Math.floor(ns[0]!.x - 3.4);
      if (c >= 2 && c < C.colonne && ns[0]!.x < C.visibile + 0.5 && metti('mina', r, c)) return out;
    }
  }
  // 9. soldi avanzati: rinforzo la corsia più carica, poi altri tiratori ovunque
  if (valuta >= 250 && pronta('sparatore')) {
    const r = [...corsie].sort((a, z) => nem(z).reduce((x, e) => x + vitaDi(e), 0) - nem(a).reduce((x, e) => x + vitaDi(e), 0) || tiratoriIn(a) - tiratoriIn(z))[0]!;
    for (let c = 1; c <= 5; c++) if (libera(r, c)) { metti(st.gelo && carta('gelo') && pronta('gelo') && tiratoriIn(r) >= 2 ? 'gelo' : 'sparatore', r, c); break; }
  }
  return out;
}
