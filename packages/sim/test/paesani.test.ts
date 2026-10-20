// Test dei paesani di Borgo Marea: battute del Word tutte presenti e tutte raggiungibili, scelta dal bacino giusto (momento di Roma,
// stagione, brutto tempo, lore prima e dopo il Cancello), primo incontro e insistente, niente ripetizioni; favori uguali su server e client,
// pesci e insetti chiesti solo se si prendono davvero per tutto il tempo concesso, messaggio portato e riscosso, regalo, scadenze, premi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSETTI } from '@marea/content/insetti.ts';
import { PAESANI, PAESANI_CFG, validatePaesani } from '@marea/content/paesani.ts';
import type { Battuta } from '@marea/content/paesani.ts';
import { PESCI } from '@marea/content/pesci.ts';
import { MOBILI } from '@marea/content';
import { newLot } from '../src/index.ts';
import { createRng } from '../src/rng.ts';
import { disponibile } from '../src/economy/insetti.ts';
import { pesceDisponibile } from '../src/economy/pesci.ts';
import { checkMonete } from '../src/economy/monete.ts';
import {
  SLOT_MS, chiacchiera, cosaSpecie, cosaSuccede, daVedere, durataTesto, momentoAt, offertaDi, paesaniOf, puoChiedere, slotAt, testoBattuta,
} from '../src/economy/paesani.ts';
import type { ContestoChiacchiera, Offerta } from '../src/economy/paesani.ts';
import type { LotState } from '../src/economy/types.ts';
import { accettaFavore, donaFavore, parlaPaesano, rifiutaFavore } from '../src/rpg/paesani.ts';
import { compraCanna } from '../src/rpg/pesci.ts';
import { compraRetino } from '../src/rpg/insetti.ts';
import { addTo } from '../src/rpg/bag.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { conMonete } from './monete_util.ts';

const MIN = 60_000, HOUR = 60 * MIN;
/** Un martedì d'autunno a Roma (ora legale, UTC+2): ore 10 = 08:00 UTC. */
const OTT = Date.UTC(2026, 9, 20, 8, 0, 0);
const IDS = ['nella', 'tonio', 'bice', 'gaspare', 'ada_fiori'];
const tutte = (p: (typeof PAESANI)[string]): Battuta[] => [...p.base, ...Object.values(p.momenti).flat(), ...Object.values(p.stagioni).flat(), ...p.brutto, ...p.primo, ...p.insistente, ...p.lore, ...p.loreAperto];
const ctx = (o: Partial<ContestoChiacchiera> = {}): ContestoChiacchiera => ({ ms: OTT, cancello: false, pioggia: 0, vento: 0, primo: false, diFila: 1, recenti: [], ...o });

test('paesani: contenuti validi, tutte le 329 battute del Word, lore di Tonio', () => {
  assert.deepEqual(validatePaesani(), []);
  assert.deepEqual(Object.keys(PAESANI).sort(), [...IDS].sort());
  assert.equal(IDS.reduce((s, id) => s + tutte(PAESANI[id]!).length, 0), 329);
  const t = PAESANI['tonio']!;
  assert.ok(t.lore.map(testoBattuta).some((b) => /cancello/i.test(b) && /vuoto/i.test(b)));
  assert.ok(t.lore.map(testoBattuta).some((b) => /onda/i.test(b) && /mausoleo/i.test(b)));
  assert.ok(t.loreAperto.map(testoBattuta).some((b) => /spalancato/i.test(b)));
});

test('paesani: momenti con l\'ora di Roma (ora legale e no)', () => {
  const roma = (y: number, m: number, d: number, h: number, mi = 0) => Date.UTC(y, m - 1, d, h - (m >= 4 && m <= 10 ? 2 : 1), mi);
  assert.equal(momentoAt(roma(2026, 10, 20, 6)), 'mattina');
  assert.equal(momentoAt(roma(2026, 10, 20, 11)), 'tarda');
  assert.equal(momentoAt(roma(2026, 10, 20, 13)), 'pranzo');
  assert.equal(momentoAt(roma(2026, 10, 20, 14, 45)), 'pomeriggio');
  assert.equal(momentoAt(roma(2026, 10, 20, 19)), 'tramonto');
  assert.equal(momentoAt(roma(2026, 10, 20, 23)), 'notte');
  assert.equal(momentoAt(roma(2026, 12, 20, 2)), 'notte');
  assert.equal(momentoAt(roma(2026, 12, 20, 9, 59)), 'mattina');
});

test('chiacchiere: dal bacino giusto, condizioni rispettate, ogni battuta prima o poi esce', () => {
  const rng = createRng(1), viste = new Map<string, Set<string>>();
  const ore = [6, 11, 13, 16, 19, 23], giorni = [Date.UTC(2026, 3, 15), Date.UTC(2026, 6, 15), Date.UTC(2026, 9, 15), Date.UTC(2026, 0, 15)];
  for (const id of IDS) {
    const p = PAESANI[id]!, set = new Set<string>(); viste.set(id, set);
    for (const g of giorni) for (const h of ore) for (const [pioggia, vento] of [[0, 0], [1, 0], [0, 1]] as const) for (const cancello of [false, true]) {
      const ms = g + (h - 2) * HOUR, m = momentoAt(ms);
      for (let k = 0; k < 25; k++) {
        const c = chiacchiera(id, ctx({ ms, cancello, pioggia, vento }), rng);
        assert.ok(c.righe.length >= 1 && c.righe.length <= 2);
        assert.equal(new Set(c.chiavi).size, c.chiavi.length);
        for (const [i, chiave] of c.chiavi.entries()) {
          set.add(chiave);
          const [bac, n] = chiave.split(':') as [string, string];
          const lista = (bac.includes('.') ? (p as unknown as Record<string, Record<string, Battuta[]>>)[bac.split('.')[0]!]![bac.split('.')[1]!] : (p as unknown as Record<string, Battuta[]>)[bac])!;
          const b = lista[Number(n)]!;
          assert.equal(c.righe[i], testoBattuta(b));
          if (bac.startsWith('momenti.')) assert.equal(bac, 'momenti.' + m);
          if (bac === 'brutto') assert.ok(pioggia || vento, 'col bel tempo niente battute da pioggia');
          if (bac === 'lore') assert.ok(!cancello); if (bac === 'loreAperto') assert.ok(cancello);
          assert.ok(!['primo', 'insistente'].includes(bac));
          if (typeof b !== 'string') {
            if (b.asciutto) assert.equal(pioggia, 0, b.t);
            if (b.solo?.includes('pioggia') && !b.solo.includes('vento')) assert.equal(pioggia, 1, b.t);
            if (b.solo?.includes('vento') && !b.solo.includes('pioggia')) assert.equal(vento, 1, b.t);
            const quando = (b.solo ?? []).filter((s) => s !== 'pioggia' && s !== 'vento');
            if (quando.length) assert.ok(quando.includes(m) || (quando.includes('giorno') && ['mattina', 'tarda', 'pranzo', 'pomeriggio'].includes(m)), `${b.t} a ${m}`);
          }
        }
      }
    }
    // tutte le battute di chiacchiera (non primo incontro né insistente) sono uscite almeno una volta
    const attese = ['base', 'brutto', 'lore', 'loreAperto', ...Object.keys(p.momenti).map((k) => 'momenti.' + k), ...Object.keys(p.stagioni).map((k) => 'stagioni.' + k)]
      .flatMap((bac) => { const l = bac.includes('.') ? (p as unknown as Record<string, Record<string, Battuta[]>>)[bac.split('.')[0]!]![bac.split('.')[1]!]! : (p as unknown as Record<string, Battuta[]>)[bac]!; return l.map((_, i) => `${bac}:${i}`); });
    const mai = attese.filter((k) => !set.has(k));
    assert.deepEqual(mai, [], `${id}: mai dette`);
  }
});

test('chiacchiere: primo incontro, insistente in ordine, niente ripetizioni ravvicinate', () => {
  const rng = createRng(7), p = PAESANI['bice']!;
  const primo = chiacchiera('bice', ctx({ primo: true }), rng);
  assert.equal(primo.righe.length, 1);
  assert.ok(p.primo.map(testoBattuta).includes(primo.righe[0]!));
  const dalla = PAESANI_CFG.insistente.dalla;
  for (let n = 0; n < p.insistente.length; n++) assert.equal(chiacchiera('bice', ctx({ diFila: dalla + n }), rng).righe[0], testoBattuta(p.insistente[n]!));
  assert.ok(p.insistente.map(testoBattuta).includes(chiacchiera('bice', ctx({ diFila: dalla + 10 }), rng).righe[0]!));
  assert.ok(!p.insistente.map(testoBattuta).includes(chiacchiera('bice', ctx({ diFila: dalla - 1 }), rng).righe[0]!));
  // con la memoria: 12 chiacchierate di fila senza battute ripetute
  let recenti: string[] = [];
  const dette: string[] = [];
  for (let i = 0; i < 12; i++) {
    const c = chiacchiera('bice', ctx({ recenti }), rng);
    dette.push(...c.chiavi); recenti = [...recenti, ...c.chiavi].slice(-PAESANI_CFG.memoria);
  }
  assert.equal(new Set(dette.slice(-PAESANI_CFG.memoria)).size, Math.min(dette.length, PAESANI_CFG.memoria));
});

// ———— favori ————
/** Un lotto che conosce tutti i paesani (con la canna e/o il retino se chiesto). */
function lotto(o: { canna?: boolean; retino?: boolean } = {}, ms = OTT): LotState {
  let lot = conMonete(newLot('alice', ms), 2000);
  if (o.canna) lot = compraCanna(lot, ms);
  if (o.retino) lot = compraRetino(lot, ms);
  for (const id of IDS) lot = parlaPaesano(lot, id, ms).lot;
  return lot;
}
/** La prima fascia da `ms` in cui il paesano chiede un favore del tipo voluto. */
function cerca(lot: LotState, id: string, ms: number, tipo?: 'parla' | 'porta'): { off: Offerta; ms: number } {
  for (let i = 0; i < 2000; i++) {
    const t = ms + i * SLOT_MS, off = offertaDi(lot, id, t);
    if (off && (!tipo || off.tipo === tipo)) return { off, ms: t };
  }
  throw new Error('nessun favore trovato');
}

test('favori: uguali per stesso lotto e fascia, nessuno se non lo conosci, uno alla volta, pausa dopo il NON ORA', () => {
  const lot = lotto();
  const { off, ms } = cerca(lot, 'tonio', OTT);
  assert.deepEqual(offertaDi(lot, 'tonio', ms + SLOT_MS - 1), off, 'stessa fascia, stesso favore');
  assert.equal(off.tipo, 'parla', 'senza canna né retino solo messaggi');
  assert.equal(offertaDi(newLot('alice', ms), 'tonio', ms), null, 'chi non conosci non ti chiede niente');
  const no = rifiutaFavore(lot, 'tonio', ms);
  assert.equal(offertaDi(no, 'tonio', ms), null);
  assert.equal(offertaDi(no, 'tonio', ms + PAESANI_CFG.favori.pausaMin.no * MIN - 1), null);
  const r = accettaFavore(lot, 'tonio', slotAt(ms), ms);
  assert.equal(paesaniOf(r.lot, ms).accettati, 1);
  for (const id of IDS) assert.equal(offertaDi(r.lot, id, ms + 1), null, 'con un favore in corso nessuno ne chiede altri');
  assert.throws(() => accettaFavore(r.lot, 'tonio', slotAt(ms), ms), /ripensato/);
  assert.throws(() => accettaFavore(lot, 'tonio', slotAt(ms) - 5, ms), /ripensato/);
  // quanti chiedono: circa `probabilita` delle fasce
  let n = 0; for (let i = 0; i < 1000; i++) if (offertaDi(lot, 'ada_fiori', OTT + i * SLOT_MS)) n++;
  assert.ok(n > 250 && n < 450, `favori su 1000 fasce: ${n}`);
});

test('favori: messaggio — accetti, lo dici al destinatario, torni e ti paga; il segno sopra la testa segue', () => {
  let lot = lotto();
  const { off, ms } = cerca(lot, 'gaspare', OTT, 'parla');
  if (off.tipo !== 'parla') throw new Error('tipo');
  lot = accettaFavore(lot, 'gaspare', off.slot, ms).lot;
  assert.equal(daVedere(lot, ms), off.a);
  assert.equal(cosaSuccede(lot, 'gaspare', ms).k, 'attesa');
  const altro = IDS.find((x) => x !== 'gaspare' && x !== off.a)!;
  assert.equal(parlaPaesano(lot, altro, ms).evento.k, 'niente');
  const r1 = parlaPaesano(lot, off.a, ms + MIN);
  assert.equal(r1.evento.k, 'messaggio');
  lot = r1.lot;
  assert.equal(daVedere(lot, ms + MIN), 'gaspare');
  assert.equal(parlaPaesano(lot, off.a, ms + 2 * MIN).evento.k, 'niente', 'il messaggio si porta una volta');
  const prima = lot.monete, magazzino = Object.values(lot.casa?.magazzino ?? {}).reduce((s, n) => s + n, 0);
  const r2 = parlaPaesano(lot, 'gaspare', ms + 3 * MIN);
  assert.equal(r2.evento.k, 'fatto');
  assert.deepEqual(r2.premio, off.premio);
  if ('monete' in off.premio) {
    assert.equal(r2.lot.monete, prima + off.premio.monete);
    assert.ok(off.premio.monete >= PAESANI_CFG.favori.premio.parla[0] && off.premio.monete <= PAESANI_CFG.favori.premio.parla[1] && off.premio.monete % 5 === 0);
  } else assert.equal(Object.values(r2.lot.casa?.magazzino ?? {}).reduce((s, n) => s + n, 0), magazzino + 1);
  assert.equal(checkMonete([r2.lot]), null);
  assert.equal(paesaniOf(r2.lot, ms).favore, null);
  assert.equal(daVedere(r2.lot, ms + 3 * MIN), null);
  assert.equal(offertaDi(r2.lot, 'gaspare', ms + 4 * MIN), null, 'pausa dopo un favore');
});

test('favori: messaggio scaduto — chi l\'ha chiesto se ne fa una ragione, niente premio', () => {
  let lot = lotto();
  const { off, ms } = cerca(lot, 'nella', OTT, 'parla');
  lot = accettaFavore(lot, 'nella', off.slot, ms).lot;
  const tardi = ms + off.durata + MIN;
  assert.equal(daVedere(lot, tardi), null);
  assert.ok(puoChiedere(lot, 'bice', tardi), 'scaduto: gli altri possono chiedere di nuovo');
  const r = parlaPaesano(lot, 'nella', tardi);
  assert.equal(r.evento.k, 'scaduto');
  assert.equal(r.premio, null);
  assert.equal(r.lot.monete, lot.monete);
  assert.equal(paesaniOf(r.lot, tardi).favore, null);
});

test('favori: pesci e insetti chiesti solo se si prendono davvero per tutto il tempo, regalo e premio', () => {
  // per un anno intero, una fascia ogni 7 ore e 20 minuti: ogni pesce o insetto chiesto c'è dall'inizio della fascia alla scadenza
  const lot = lotto({ canna: true, retino: true });
  let porta = 0, pesci = 0, insetti = 0;
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 22 * SLOT_MS) {
    for (const id of IDS) {
      const off = offertaDi(lot, id, t);
      if (off?.tipo !== 'porta') continue;
      porta++;
      const t0 = off.slot * SLOT_MS;
      assert.ok(off.durata >= 60 * MIN && off.durata <= 120 * MIN);
      if (off.cosa === 'pesce') {
        pesci++;
        const d = PESCI.find((p) => p.id === off.id)!;
        assert.ok(['comune', 'noncomune'].includes(d.rarita));
        for (let x = t0; x <= t0 + SLOT_MS + off.durata; x += 5 * MIN) assert.ok(pesceDisponibile(d, x), `${d.id} non c'è a ${new Date(x).toISOString()}`);
      } else {
        insetti++;
        const d = INSETTI.find((i) => i.id === off.id)!;
        assert.ok(['comune', 'noncomune'].includes(d.rarita));
        assert.notEqual(d.tipo, 'sasso', 'senza pala niente insetti dei sassi');
        for (let x = t0; x <= t0 + SLOT_MS + off.durata; x += 5 * MIN) assert.ok(disponibile(d, x), `${d.id} non c'è a ${new Date(x).toISOString()}`);
      }
      if ('monete' in off.premio) assert.ok(off.premio.monete >= 50 && off.premio.monete <= 300 && off.premio.monete % 5 === 0);
      else assert.ok(MOBILI.find((m) => m.id === (off.premio as { mobile: string }).mobile)!.monete <= 240);
    }
  }
  assert.ok(porta > 100 && pesci > 30 && insetti > 30, `porta ${porta}, pesci ${pesci}, insetti ${insetti}`);
  // Tonio chiede quasi sempre pesci, Ada quasi sempre insetti
  let tp = 0, ti = 0, ap = 0, ai = 0;
  for (let i = 0; i < 3000; i++) {
    const a = offertaDi(lot, 'tonio', OTT + i * SLOT_MS), b = offertaDi(lot, 'ada_fiori', OTT + i * SLOT_MS);
    if (a?.tipo === 'porta') { if (a.cosa === 'pesce') tp++; else ti++; }
    if (b?.tipo === 'porta') { if (b.cosa === 'pesce') ap++; else ai++; }
  }
  assert.ok(tp > 2 * ti && ai > 2 * ap, `tonio ${tp}/${ti}, ada ${ap}/${ai}`);
});

test('favori: porta — promemoria, REGALA toglie dallo zaino e paga, troppo tardi niente', () => {
  let lot = lotto({ canna: true });
  const { off, ms } = cerca(lot, 'tonio', OTT, 'porta');
  if (off.tipo !== 'porta') throw new Error('tipo');
  assert.equal(off.cosa, 'pesce', 'solo la canna: solo pesci');
  lot = accettaFavore(lot, 'tonio', off.slot, ms).lot;
  assert.equal(cosaSuccede(lot, 'tonio', ms).k, 'promemoria');
  assert.throws(() => donaFavore(lot, 'tonio', ms), /zaino/);
  const h = heroOf(lot);
  const pieno: LotState = { ...lot, hero: { ...h, inv: addTo(h.inv, off.id, 2) } };
  assert.equal(cosaSuccede(pieno, 'tonio', ms).k, 'dono');
  assert.equal(cosaSuccede(pieno, 'bice', ms).k, 'niente');
  assert.throws(() => donaFavore(pieno, 'bice', ms), /niente/);
  const r = donaFavore(pieno, 'tonio', ms + MIN);
  assert.equal(r.lot.hero!.inv[off.id], 1, 'ne regali uno solo');
  assert.deepEqual(r.premio, off.premio);
  assert.equal(paesaniOf(r.lot, ms).favore, null);
  assert.equal(checkMonete([r.lot]), null);
  assert.throws(() => donaFavore(pieno, 'tonio', ms + off.durata + MIN), /tardi/);
});

test('favori: non più di `alGiorno` al giorno (giorno di Roma)', () => {
  let lot = lotto(), t = OTT;
  for (let n = 0; n < PAESANI_CFG.favori.alGiorno; n++) {
    const { off, ms } = cerca(lot, IDS[n % IDS.length]!, t);
    lot = accettaFavore(lot, off.da, off.slot, ms).lot;
    lot = { ...lot, paesani: { ...lot.paesani!, favore: null } };
    t = ms + SLOT_MS;
  }
  const fine = Date.UTC(2026, 9, 20, 21, 50); // 23:50 a Roma: finché è oggi niente
  if (t < fine) for (let x = t; x < fine; x += SLOT_MS) for (const id of IDS) assert.equal(offertaDi(lot, id, x), null);
  assert.ok(IDS.some((id) => { for (let i = 0; i < 200; i++) if (offertaDi(lot, id, Date.UTC(2026, 9, 21, 6) + i * SLOT_MS)) return true; return false; }), 'il giorno dopo si ricomincia');
});

test('testi: articoli e durate', () => {
  assert.equal(cosaSpecie('pesce', 'triglia'), 'una triglia di scoglio');
  assert.equal(cosaSpecie('pesce', 'orata'), "un'orata");
  assert.equal(cosaSpecie('pesce', 'sgombro'), 'uno sgombro');
  assert.equal(cosaSpecie('insetto', 'ape'), "un'ape operaia");
  assert.equal(cosaSpecie('insetto', 'monarca'), 'una farfalla Monarca');
  assert.equal(durataTesto(60 * MIN), "un'ora");
  assert.equal(durataTesto(90 * MIN), "un'ora e mezza");
  assert.equal(durataTesto(105 * MIN), "un'ora e tre quarti");
  assert.equal(durataTesto(120 * MIN), 'due ore');
  assert.equal(durataTesto(30 * MIN), "mezz'ora");
});
