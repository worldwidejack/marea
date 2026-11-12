// I difensori e gli insetti nuovi della Difesa (livelli 7-12, docs/DIFESA.md §3): mangiatutto, ripetitore, muro alto, potenziatore,
// mortaio; bruco con lo scudo (furia), vespa (vola), maggiolino gigante. Ogni prova isola una cosa su un campo senza ondate né cielo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFESA, profiloDifesa } from '@marea/content/difesa.ts';
import type { DTipoNemico } from '@marea/content/difesa.ts';
import { TICK_HZ } from '../src/constants.ts';
import type { DNemico, DState } from '../src/difesa/stato.ts';
import { nuovaPartita, passo } from '../src/difesa/difesa.ts';
import { componiOndata, nuovoNemico } from '../src/difesa/ondate.ts';
import { ferisci } from '../src/difesa/nemici.ts';
import { pianta } from '../src/difesa/unita.ts';
import { sceltaPredefinita } from '../src/difesa/carte.ts';

const P = profiloDifesa('pvz');
/** Livello 12 con tutte e 11 le carte, profilo pvz, niente ondate né cielo, carte cariche, tanta valuta. */
function banco(): DState {
  const s = nuovaPartita(3, 11, { profilo: 'pvz', carte: DIFESA.livelli[11]!.carte });
  s.conto = 1e9; s.cielo.conto = 1e9; s.valuta = 99999;
  for (const c of s.carte) c.pronta = 0;
  return s;
}
const per = (s: DState, sec: number) => { for (let i = 0; i < sec * TICK_HZ && !s.esito; i++) passo(s); };
/** Un nemico fermo (per provare un colpo alla volta senza che si muova). */
function fermo(s: DState, tipo: DTipoNemico, corsia: number, x: number): DNemico {
  const e = nuovoNemico(s, tipo, corsia, x, 0);
  e.passo = 0; e.corsa = 0;
  s.nemici.push(e);
  return e;
}

test('livelli 7-12: una novità per livello, carte e nemici esistono, l\'intro è tra i nemici', () => {
  assert.deepEqual(DIFESA.livelli.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const [i, l] of DIFESA.livelli.entries()) {
    for (const t of l.carte) assert.ok(P.unita[t], `livello ${l.id}: carta ${t}`);
    for (const t of l.nemici) assert.ok(P.nemici[t], `livello ${l.id}: nemico ${t}`);
    if (l.nuova) assert.ok(l.carte.includes(l.nuova), `livello ${l.id}: la carta nuova è tra le carte`);
    if (l.intro) assert.ok(l.nemici.includes(l.intro), `livello ${l.id}: l'intro è tra i nemici`);
    if (i > 0) for (const t of DIFESA.livelli[i - 1]!.carte) assert.ok(l.carte.includes(t), `livello ${l.id}: tiene la carta ${t}`);
  }
  assert.deepEqual(DIFESA.livelli.slice(6).map((l) => l.nuova), ['mangiatutto', 'ripetitore', 'muroAlto', 'potenziatore', 'mortaio', null]);
  assert.equal(DIFESA.sopravvivenza.carte.length, 11);
});

test('mangiatutto: inghiotte intero (con l\'armatura) il nemico davanti e poi digerisce 42 s; il gigante e chi vola no', () => {
  const s = banco(), u = pianta(s, 'mangiatutto', 2, 3)!;
  const gigante = fermo(s, 'gigante', 2, 4.2), vespa = fermo(s, 'volante', 2, 4.4), cono = fermo(s, 'cono', 2, 5.0);
  per(s, 0.1);
  assert.ok(!s.nemici.includes(cono), 'il cono è stato inghiottito');
  assert.ok(s.nemici.includes(gigante) && s.nemici.includes(vespa), 'il gigante e la vespa no');
  assert.equal(s.stats.uccisi, 1);
  assert.ok(Math.abs((u.t - s.tick) / TICK_HZ - 42) < 0.2, `digestione ${(u.t - s.tick) / TICK_HZ} s`);
  const altro = fermo(s, 'base', 2, 4.6);
  per(s, 5);
  assert.ok(s.nemici.includes(altro), 'mentre digerisce non inghiotte');
  u.t = s.tick; // finita la digestione
  gigante.vita = 0; s.nemici.splice(s.nemici.indexOf(gigante), 1); vespa.vita = 0; s.nemici.splice(s.nemici.indexOf(vespa), 1);
  per(s, 0.1);
  assert.ok(!s.nemici.includes(altro), 'dopo la digestione inghiotte di nuovo');
});

test('ripetitore: due colpi alla volta (40 di danno per volta)', () => {
  const s = banco();
  pianta(s, 'ripetitore', 2, 0);
  const e = fermo(s, 'base', 2, 6);
  while (e.vita >= e.vitaMax && s.tick < 10 * TICK_HZ) passo(s);
  per(s, 0.8);
  assert.equal(e.vita, e.vitaMax - 40, `vita ${e.vita}`);
});

test('muro alto: la cavalletta non lo scavalca, si ferma a mangiarlo (8000 di vita)', () => {
  const s = banco();
  const muro = pianta(s, 'muroAlto', 2, 5)!;
  assert.equal(muro.vita, 8000);
  const sal = nuovoNemico(s, 'saltatore', 2, 9, 0);
  s.nemici.push(sal);
  per(s, 15);
  assert.equal(sal.salto, 0, 'non ha saltato');
  assert.ok(sal.x > 5, `è ancora davanti al muro: ${sal.x}`);
  assert.ok(muro.vita < 8000 && s.unita.includes(muro), 'lo morde e il muro regge');
});

test('potenziatore: i colpi che gli passano sopra fanno il doppio e perdono il gelo; senza, no', () => {
  const prova = (conPotenziatore: boolean, tipo: 'sparatore' | 'gelo') => {
    const s = banco();
    pianta(s, tipo, 2, 0);
    if (conPotenziatore) pianta(s, 'potenziatore', 2, 2);
    const e = fermo(s, 'base', 2, 8);
    while (e.vita >= e.vitaMax && s.tick < 10 * TICK_HZ) passo(s);
    return e;
  };
  assert.equal(prova(false, 'sparatore').vita, 250);
  assert.equal(prova(true, 'sparatore').vita, 230, 'fuoco: 40 invece di 20');
  assert.ok(prova(false, 'gelo').gelo > 0, 'il colpo gelato gela');
  assert.equal(prova(true, 'gelo').gelo, 0, 'sul potenziatore il gelo si scioglie');
});

test('mortaio: colpisce in qualsiasi corsia, non dentro la zona morta, danno pieno al centro e splash attorno, non la vespa', () => {
  const s = banco();
  pianta(s, 'mortaio', 2, 0);
  const vicino = fermo(s, 'base', 2, 1.8), vespa = fermo(s, 'volante', 2, 5), centro = fermo(s, 'base', 2, 5), vicinoLato = fermo(s, 'base', 2, 5.6), altraCorsia = fermo(s, 'base', 3, 5);
  vicino.testa = true;
  while (centro.vita === centro.vitaMax && s.tick < 10 * TICK_HZ) passo(s);
  assert.equal(centro.vita, centro.vitaMax - 60, 'pieno al centro');
  assert.equal(vicinoLato.vita, vicinoLato.vitaMax - 30, 'splash dimezzato a 0,6 caselle');
  assert.equal(altraCorsia.vita, altraCorsia.vitaMax - 30, 'splash anche nella corsia accanto');
  assert.equal(vicino.vita, vicino.vitaMax, 'dentro la zona morta non colpisce');
  assert.equal(vespa.vita, vespa.vitaMax, 'chi vola non lo prende');
  // un nemico in un\'altra corsia, lontano: lo prende anche se la sua corsia è vuota di difensori
  const t = banco();
  pianta(t, 'mortaio', 0, 0);
  const lontano = fermo(t, 'base', 4, 7);
  per(t, 8);
  assert.ok(lontano.vita < lontano.vitaMax, 'colpisce in diagonale');
});

test('bruco con lo scudo: caduta la foglia resta fermo 0,6 s e poi corre 2,5 volte più veloce', () => {
  const s = banco();
  const e = nuovoNemico(s, 'scudo', 1, 8, 0);
  s.nemici.push(e);
  const passo0 = e.passo;
  ferisci(s, e, 250);
  assert.equal(e.armatura, 0);
  assert.ok(e.furia > s.tick, 'furia partita');
  const x0 = e.x;
  per(s, 0.5);
  assert.equal(e.x, x0, 'fermo durante la pausa');
  per(s, 0.1);
  const x1 = e.x;
  per(s, 2);
  assert.ok(Math.abs((x1 - e.x) / (passo0 * 2 * TICK_HZ) - 2.5) < 0.05, `corre ${(x1 - e.x) / (passo0 * 2 * TICK_HZ)} volte più veloce`);
});

test('vespa: vola sopra i difensori senza morderli, le mine non la toccano, il tosaerba sì', () => {
  const s = banco();
  const muro = pianta(s, 'muro', 2, 4)!, mina = pianta(s, 'mina', 2, 6)!;
  mina.armata = true; mina.t = 0;
  const v = nuovoNemico(s, 'volante', 2, 8.8, 0);
  s.nemici.push(v);
  per(s, 32);
  assert.ok(v.x < 4, `è passata sopra il muro: ${v.x}`);
  assert.equal(v.mangia, 0);
  assert.equal(muro.vita, muro.vitaMax, 'il muro non è stato morso');
  assert.ok(s.unita.includes(mina) && v.vita === v.vitaMax, 'la mina è ancora lì e la vespa intatta');
  per(s, 30);
  assert.ok(!s.nemici.includes(v), 'il tosaerba (o chi arriva in fondo) la spazza');
  assert.equal(s.stats.tosaerba, 1);
});

test('maggiolino gigante: schiaccia un difensore a colpo, non perde la testa, muore a vita zero', () => {
  const s = banco();
  const cavolo = pianta(s, 'muro', 2, 3)!, g = nuovoNemico(s, 'gigante', 2, 4.2, 0);
  s.nemici.push(g);
  per(s, 5);
  assert.ok(!s.unita.includes(cavolo), `il cavolo da 4000 è caduto in 5 s (vita ${cavolo.vita})`);
  ferisci(s, g, 2500);
  assert.equal(g.testa, true, 'a un terzo della vita niente testa che cade');
  assert.ok(s.nemici.includes(g));
  ferisci(s, g, 600);
  assert.ok(!s.nemici.includes(g), 'a vita zero muore');
});

test('livello 9: più saltatori che nel livello 10 (stessi nemici, peso ×3)', () => {
  const conta = (livello: number) => {
    let n = 0;
    for (let seme = 1; seme <= 40; seme++) { const s = nuovaPartita(seme, livello, { profilo: 'pvz' }); for (const w of [6, 8, 10]) n += componiOndata(s, w).filter((t) => t === 'saltatore').length; }
    return n;
  };
  assert.ok(conta(8) > conta(9) * 1.4, `${conta(8)} contro ${conta(9)}`);
});

test("scelta delle carte: fino a 8 si portano tutte, sopra si sceglie; la carta nuova c'è sempre, poi le salvate, poi la priorità", () => {
  const L = DIFESA.livelli, max = DIFESA.carte.max;
  assert.equal(max, 8);
  for (const l of L.slice(0, 8)) assert.deepEqual(sceltaPredefinita(l), l.carte, `livello ${l.id}: tutte`);
  for (const l of L.slice(8)) {
    const sc = sceltaPredefinita(l);
    assert.equal(sc.length, 8, `livello ${l.id}: 8 carte`);
    if (l.nuova) assert.ok(sc.includes(l.nuova), `livello ${l.id}: c'è la carta nuova`);
    assert.deepEqual(sc, l.carte.filter((t) => sc.includes(t)), "nell'ordine del livello");
  }
  const l12 = L[11]!;
  // le salvate vincono sulla priorità; quelle che non sono del livello o doppie si ignorano
  assert.deepEqual(sceltaPredefinita(l12, ['mortaio', 'potenziatore', 'mortaio', 'sparatore', 'gelo', 'muro', 'bomba', 'mina', 'ripetitore']), ['sparatore', 'bomba', 'muro', 'mina', 'gelo', 'ripetitore', 'potenziatore', 'mortaio']);
  // livello 9: la carta nuova (muro alto) entra anche se non era tra le salvate, a scapito dell'ultima salvata
  const l9 = L[8]!, salvate = ['sparatore', 'produttore', 'ripetitore', 'bomba', 'muro', 'mina', 'mangiatutto', 'gelo'] as const;
  assert.deepEqual(sceltaPredefinita(l9, salvate), l9.carte.filter((t) => t !== 'gelo'));
  // il livello non ha la carta nuova (12) e la Sopravvivenza: solo salvate e priorità
  assert.equal(sceltaPredefinita(DIFESA.sopravvivenza).length, 8);
});

test('partita: senza scelta porta 8 carte (le predefinite), con la scelta quelle e in ordine; una carta lasciata a casa non si pianta', () => {
  const s = nuovaPartita(1, 11, { profilo: 'pvz' });
  assert.deepEqual(s.carte.map((c) => c.tipo), sceltaPredefinita(DIFESA.livelli[11]!));
  const t = nuovaPartita(1, 11, { profilo: 'pvz', carte: ['mortaio', 'sparatore', 'potenziatore'] });
  assert.deepEqual(t.carte.map((c) => c.tipo), ['sparatore', 'potenziatore', 'mortaio'], "nell'ordine del livello, non della scelta");
  t.valuta = 999; for (const c of t.carte) c.pronta = 0;
  assert.equal(pianta(t, 'produttore', 2, 1), null, "la carta lasciata a casa non c'è");
  assert.ok(t.ev.some((e) => e.e === 'rifiuto' && e.motivo === 'carta'));
  assert.ok(pianta(t, 'mortaio', 2, 0));
  const l2 = nuovaPartita(1, 1, { profilo: 'pvz' });
  assert.deepEqual(l2.carte.map((c) => c.tipo), DIFESA.livelli[1]!.carte, 'ai livelli con poche carte non si sceglie');
});
