// La guida delle Corse v2 (#170, docs/CORSE.md A11): sterzo progressivo, drift a 3 livelli che conviene, turbo alla partenza,
// acrobazie, scia, turbo sommati e regole spente (gli interruttori A/B del banco di prova).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORSE } from '@marea/content/corse.ts';
import { VIA, curvaSterzo, garaCorse, pilotaGara } from '../src/corse/gara.ts';
import type { GaraState, GaraView } from '../src/corse/gara.ts';
import { REGOLE_TUTTE, daiTurbo, livelloDrift } from '../src/corse/veicolo.ts';
import { quantize } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const nuova = (pista: string, veicolo?: string, bot = true, seed = 7, regole: Record<string, string> = {}): GaraState =>
  garaCorse.create({ seed, difficulty: 2, opzioni: { pista, ...(veicolo ? { veicolo } : {}), bot: bot ? '1' : '0', ...regole } });
const FERMO: InputFrame = { mx: 0, my: 1, a: false, b: false };
/** Salta il conto alla rovescia senza toccare niente (gas dato solo al VIA: niente turbo e niente motore ingolfato). */
const via = (s: GaraState) => { while (s.tick < 1) garaCorse.step(s, { ...FERMO, my: 0 }); return s; };
/** Corre la gara col pilota (di serie quello automatico). */
function corri(s: GaraState, pilota: (s: GaraState) => InputFrame = (x) => pilotaGara(x)) {
  while (!s.done) garaCorse.step(s, quantize(pilota(s)));
  return { r: garaCorse.result(s) };
}

test('corse v2 (#170): lo sterzo ha la curva del joystick, la rampa da tastiera e cala con la velocità', () => {
  // la curva: a metà joystick si sterza meno della metà, in fondo tutto
  assert.ok(curvaSterzo(0.5) < 0.45 && curvaSterzo(1) === 1 && curvaSterzo(-1) === -1 && curvaSterzo(0) === 0);
  // la rampa: tasto premuto → non subito tutto, ci arriva in qualche decimo
  const s = via(nuova('prova_anello', 'kart', false)), k = s.veicoli[0]!;
  garaCorse.step(s, { mx: 1, my: 1, a: false, b: false });
  assert.ok(k.st > 0 && k.st < 0.2, `primo tick ${k.st}`);
  for (let i = 0; i < 20; i++) garaCorse.step(s, { mx: 1, my: 1, a: false, b: false });
  assert.equal(k.st, 1);
  // senza la regola: tutto subito
  const v = via(nuova('prova_anello', 'kart', false, 7, { sterzo: '0' }));
  garaCorse.step(v, { mx: 1, my: 1, a: false, b: false });
  assert.equal(v.veicoli[0]!.st, 1);
  // a tutta velocità si gira più piano che a velocità media (per stringere serve il drift)
  const svolta = (vel: number) => {
    const g = via(nuova('prova_fuga', 'kart', false)), q = g.veicoli[0]!;
    q.v = vel; q.st = 1;
    const h0 = q.hl;
    garaCorse.step(g, { mx: 1, my: 1, a: false, b: false });
    return q.hl - h0;
  };
  assert.ok(svolta(20) < svolta(8) * 0.65, `svolta a 20 m/s ${svolta(20)}, a 8 m/s ${svolta(8)}`);
});

test('corse v2 (#170): il drift ha 3 livelli, contro il muro perde la carica e in curva conviene', () => {
  const D = CORSE.drift;
  assert.deepEqual([0, D.carica[0], D.carica[1], D.carica[2]].map(livelloDrift), [0, 1, 2, 3]);
  // tieni il drift fino al viola e lascia: turbo del terzo livello
  const s = via(nuova('prova_fuga', 'kart', false)), k = s.veicoli[0]!;
  k.v = 15;
  for (let i = 0; i < 6; i++) garaCorse.step(s, { mx: 1, my: 1, a: true, b: false }); // lo sterzo sale in rampa: il drift parte appena passa la soglia
  assert.equal(k.drift, 1);
  let max = 0;
  const dritto = () => { k.lat = 0; k.hf = 1; k.hl = 0; k.mf = 1; k.ml = 0; k.v = 15; }; // in mezzo alla pista: si misura solo la carica
  let tick = 0;
  for (; tick < 60 * 3 && k.drift; tick++) { dritto(); garaCorse.step(s, { mx: 0, my: 1, a: true, b: false }); max = Math.max(max, livelloDrift(k.carica)); if (max === 3) break; }
  assert.equal(max, 3, `carica ${k.carica}`);
  assert.ok(Math.abs(tick / 60 - D.carica[2]) < 0.1, `viola dopo ${tick} tick`);
  dritto(); garaCorse.step(s, { mx: 0, my: 1, a: false, b: false });
  assert.ok((k.drift as number) === 0 && k.livello === 3 && k.turbo > D.spinta[1], `turbo ${k.turbo} livello ${k.livello}`);
  // stringere carica più in fretta; contro il muro la carica si perde
  const w = via(nuova('prova_fuga', 'kart', false)), m = w.veicoli[0]!;
  m.v = 15;
  for (let i = 0; i < 6; i++) garaCorse.step(w, { mx: -1, my: 1, a: true, b: false });
  const c0 = m.carica; m.lat = 0; m.hf = 1; m.hl = 0; m.mf = 1; m.ml = 0;
  garaCorse.step(w, { mx: -1, my: 1, a: true, b: false });
  assert.ok(m.drift === -1 && m.carica - c0 > (1 / 60) * 1.3, `stringendo +${m.carica - c0}`);
  m.lat = -20; garaCorse.step(w, { mx: -1, my: 1, a: true, b: false });
  assert.ok(m.muro && m.carica === 0, `muro ${m.muro} carica ${m.carica}`);
  // il bottone tenuto senza sterzare non parte in drift dopo il saltello (va ripremuto)
  const t = via(nuova('prova_fuga', 'kart', false)), q = t.veicoli[0]!;
  q.v = 15;
  for (let i = 0; i < 30; i++) garaCorse.step(t, { mx: 0, my: 1, a: true, b: false });
  garaCorse.step(t, { mx: 1, my: 1, a: true, b: false });
  assert.equal(q.drift, 0);
  // il drift fa girare più veloce: col pilota automatico il giro dell'anello e della pista folle è più corto che senza drift
  for (const id of ['prova_anello', 'prova_folle']) {
    const con = corri(nuova(id, 'kart', false)).r.detail['ms']!;
    const senza = corri(nuova(id, 'kart', false), (x) => { const f = pilotaGara(x); return x.tick > 0 && !x.veicoli[0]!.aria ? { ...f, a: false } : f; }).r.detail['ms']!;
    assert.ok(con < senza * 0.97, `${id}: con drift ${con} ms, senza ${senza} ms`);
  }
});

test('corse v2 (#170): turbo alla partenza col gas (razzo, buona, motore ingolfato) e conto alla rovescia', () => {
  const parti = (premi: number | null, regole: Record<string, string> = {}) => {
    const s = nuova('prova_fuga', 'kart', false, 7, regole), k = s.veicoli[0]!;
    assert.equal(s.tick, -VIA);
    while (s.tick < 1) { assert.equal(k.v, 0, 'nel conto alla rovescia si sta fermi'); garaCorse.step(s, { mx: 0, my: premi !== null && -s.tick <= premi * 60 ? 1 : 0, a: false, b: false }); }
    for (let i = 0; i < 90; i++) garaCorse.step(s, FERMO);
    return k;
  };
  const razzo = parti(0.2), buona = parti(0.7), ingolfato = parti(2), niente = parti(null), spenta = parti(0.2, { partenza: '0' });
  assert.ok(razzo.partenza === 2 && buona.partenza === 1 && ingolfato.partenza === -1 && niente.partenza === 0 && spenta.partenza === 0);
  assert.ok(razzo.prog > buona.prog && buona.prog > niente.prog && niente.prog > ingolfato.prog, [razzo, buona, niente, ingolfato].map((k) => k.prog.toFixed(2)).join(' > '));
  const g = nuova('prova_fuga', 'kart', false), q = g.veicoli[0]!;
  while (g.tick < 30) garaCorse.step(g, { mx: 0, my: 1, a: false, b: false }); // gas tenuto da prima del 3
  assert.ok(q.partenza === -1 && q.v === 0, 'ingolfato: mezzo secondo dopo il VIA è ancora fermo');
  // i tempi contano dal VIA
  const s = nuova('prova_fuga', 'kart', false);
  for (let i = 0; i < VIA + 60; i++) garaCorse.step(s, FERMO);
  assert.equal((garaCorse.view(s) as GaraView).ms, 1000);
});

test('corse v2 (#170): acrobazia in aria → turbo all\'atterraggio; sulle onde no', () => {
  const salta = (premi: boolean, regole: Record<string, string> = {}) => {
    const s = via(nuova('prova_folle', 'kart', false, 7, regole)), k = s.veicoli[0]!;
    for (let i = 0; i < 60 * 60 && !s.done; i++) {
      const f = pilotaGara(s), prima = k.aria;
      garaCorse.step(s, quantize({ ...f, a: k.aria ? premi && prima && k.acro === 0 && k.tenuto < 0 : false }));
      if (prima && !k.aria && k.acro === 0 && k.turbo > 0 && k.livello === 2) return true;
    }
    return false;
  };
  assert.ok(salta(true), 'premendo in aria si atterra col turbo');
  assert.ok(!salta(false), 'senza premere niente turbo');
  assert.ok(!salta(true, { acrobazie: '0' }), 'regola spenta');
  // in acqua il pilota automatico salta sulle onde ma lì l'acrobazia non c'è
  const b = via(nuova('prova_baia', undefined, false)), m = b.veicoli[0]!;
  let acro = 0, onde = 0;
  for (let i = 0; i < 60 * 30; i++) { const prima = m.acro; garaCorse.step(b, quantize(pilotaGara(b))); if (m.acro > 0 && prima === 0) acro++; if (m.acro < 0 && prima >= 0) onde++; }
  assert.ok(onde > 5 && acro < onde / 4, `salti sulle onde ${onde}, acrobazie ${acro}`);
});

test('corse v2 (#170): la scia dietro un avversario dà il turbo; i turbo si sommano fino al tetto', () => {
  const s = via(nuova('prova_fuga', 'kart', true)), [tu, bot] = [s.veicoli[0]!, s.veicoli[1]!];
  // tu 6 m dietro al bot, in fila: dopo `secondi` parte la scia
  let preso = -1;
  for (let i = 0; i < 60 * 3 && preso < 0; i++) {
    tu.s = bot.s - 6; tu.lat = bot.lat; tu.v = bot.v = 15; tu.turbo = 0;
    garaCorse.step(s, FERMO);
    if (tu.turbo > 0) preso = i;
  }
  assert.ok(preso >= Math.round(CORSE.scia.secondi * 60) - 2 && preso <= Math.round(CORSE.scia.secondi * 60) + 2, `scia dopo ${preso} tick`);
  // spenta: niente
  const t = via(nuova('prova_fuga', 'kart', true, 7, { scia: '0' })), [a, b] = [t.veicoli[0]!, t.veicoli[1]!];
  for (let i = 0; i < 60 * 3; i++) { a.s = b.s - 6; a.lat = b.lat; a.v = b.v = 15; garaCorse.step(t, FERMO); assert.equal(a.scia, 0); }
  // somma: alla Crash Team Racing si aggiungono, col tetto; senza, vince il più lungo
  const k = t.veicoli[0]!;
  k.turbo = 1; daiTurbo(k, 1, 2, true); assert.equal(k.turbo, 2);
  daiTurbo(k, 5, 2, true); assert.equal(k.turbo, CORSE.turbo.max);
  k.turbo = 1; daiTurbo(k, 0.5, 1, false); assert.equal(k.turbo, 1);
  assert.deepEqual(Object.keys(REGOLE_TUTTE), ['sterzo', 'partenza', 'acrobazie', 'scia', 'somma']);
});
