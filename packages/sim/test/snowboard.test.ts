// Snowboard dell'Isola dell'Adrenalina (docs/ADRENALINA.md §7, CONTRACTS §42). Cosa si controlla:
// - i dati e la barra Adrenalina (riempie, tetto, cala dopo 3 s, gradini, si azzera);
// - la discesa del pilota automatico sulla verde (~80 s, tutte le porte, niente cadute) e il determinismo;
// - la guida: curva stretta che frena, neve fresca che rallenta, il bosco oltre la neve, gli alberi, la porta mancata;
// - il fuoripista: al bivio chi va dritto finisce contro l'abete caduto, il sentiero tiene la velocità bassa, si rientra e si arriva;
// - il salto: grande se lasci sul bordo, basso se tieni, i trick in combo, la presa, gli atterraggi storti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARRA, SNOWBOARD, SNOWBOARD_PISTE, validateAdrenalina } from '@marea/content/adrenalina.ts';
import { azzeraBarra, moltiplicatore, nuovaBarra, passoBarra, riempiBarra } from '../src/adrenalina/barra.ts';
import { bordoA, pendenzaA, pistaSnowboard, quotaA } from '../src/adrenalina/pista.ts';
import { pilotaSnowboard, snowboard } from '../src/minigames/snowboard.ts';
import { medagliaDaPosizione, migliora, posizioneDiscesa } from '../src/adrenalina/classifica.ts';
import { MINIGAMES } from '../src/minigames/registry.ts';
import '../src/adrenalina/registra.ts';
import { replay, packInputs } from '../src/replay.ts';
import type { SnowState } from '../src/minigames/snowboard.ts';
import { hashJson } from '../src/hash.ts';
import { quantize } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const VERDE = SNOWBOARD_PISTE['snowboard_verde']!;
const nuova = (): SnowState => snowboard.create({ seed: 3, difficulty: 1 });
const F = (o: Partial<InputFrame> = {}): InputFrame => ({ mx: 0, my: 0, a: false, b: false, ...o });
/** Mette la tavola a `s`, `lat`, alla velocità `v`, a terra. */
function qui(s: SnowState, at: number, lat: number, v: number): SnowState {
  s.s = at; s.lat = lat; s.v = v; s.vl = 0; s.aria = false; s.h = 0; s.y = quotaA(pistaSnowboard(s.pista), at, lat);
  s.porta = VERDE.porte.findIndex((g) => g.s > at); if (s.porta < 0) s.porta = VERDE.porte.length;
  return s;
}
const passi = (s: SnowState, n: number, f: InputFrame | ((s: SnowState) => InputFrame)) => { for (let i = 0; i < n && !s.done; i++) snowboard.step(s, typeof f === 'function' ? f(s) : f); };

test('snowboard: i dati sono a posto', () => {
  assert.deepEqual(validateAdrenalina(), []);
  const p = pistaSnowboard('snowboard_verde');
  // ~1,8 km: un quarto di porte, un quarto di salti, metà nel bosco (a tempo)
  assert.ok(p.n.len > 1600 && p.n.len < 2000, `pista lunga ${p.n.len} m`);
  assert.ok(VERDE.porte.length >= 8 && VERDE.porte.length <= 22, `${VERDE.porte.length} porte`);
  // una discesa vera da una montagna (birbasan, 12 ott): tanto dislivello, pendenza media da pista rossa, tratti oltre i 30°
  const giu = p.n.y[0]! - p.n.y[p.n.n - 1]!, ripido = p.n.ty.filter((ty) => -ty > 0.5).length;
  assert.ok(giu > 450 && giu / p.n.len > 0.33, `dislivello ${giu} m su ${p.n.len} m`);
  assert.ok(ripido > 250, `solo ${ripido} m oltre i 30°`);
  // tre salti di neve nel canalino, stretti quanto lui, e il trampolino grande
  assert.equal(VERDE.rampe.length, 4); assert.equal(VERDE.rampe.filter((r) => r.grande).length, 1);
  const canalino = VERDE.zone.find((z) => z.id === 'canalino')!;
  assert.ok(VERDE.rampe.filter((r) => r.s > canalino.da && r.s < canalino.a && r.lat[1] - r.lat[0] >= 2 * bordoA(p, r.s) - 0.01).length === 3, 'i salti del canalino');
  // le porte tutte prima della cornice, vicine (meno di 30 m) e sfalsate: si prendono curvando, non scendendo dritti
  const cornice = VERDE.zone.find((z) => z.id === 'cornice')!;
  assert.ok(VERDE.porte.length >= 10 && VERDE.porte.every((g) => g.s < cornice.da), 'porte nel primo tratto');
  assert.ok(VERDE.porte.every((g, i, a) => i === 0 || (g.s - a[i - 1]!.s < 30 && g.lat * a[i - 1]!.lat < 0)), 'porte vicine e sfalsate');
  // la pista curva: tra le porte gira di almeno 120° in tutto, e il bosco è la parte più lunga
  const bosco = VERDE.zone.find((z) => z.id === 'fuoripista')!;
  let giro = 0; for (let i = 1; i < cornice.da; i++) giro += Math.abs(p.n.th[i]! - p.n.th[i - 1]!);
  assert.ok(giro > 2, `le porte girano di ${giro} rad`);
  assert.ok(bosco.a - bosco.da > 600, `bosco lungo ${bosco.a - bosco.da} m`);
  assert.ok(VERDE.arrivo < p.n.len);
});

test('barra Adrenalina: riempie, tetto, cala dopo calaDopo s, tre gradini, si azzera', () => {
  const b = nuovaBarra();
  assert.equal(moltiplicatore(b, BARRA), 1);
  for (let i = 0; i < 4; i++) riempiBarra(b, BARRA, 'salto_grande');
  assert.ok(b.v >= BARRA.soglie[0] && moltiplicatore(b, BARRA) === 2, `barra ${b.v}`);
  for (let i = 0; i < 10; i++) riempiBarra(b, BARRA, 'salto_grande');
  assert.equal(b.v, 1); assert.equal(moltiplicatore(b, BARRA), 3);
  assert.equal(riempiBarra(b, BARRA, 'sconosciuto'), 0);
  for (let i = 0; i < BARRA.calaDopo * 60 - 2; i++) passoBarra(b, BARRA, 1 / 60);
  assert.equal(b.v, 1, 'prima di calaDopo non cala');
  for (let i = 0; i < 60; i++) passoBarra(b, BARRA, 1 / 60);
  assert.ok(b.v < 1 && b.v > 1 - BARRA.cala * 1.1, `dopo un secondo ${b.v}`);
  azzeraBarra(b); assert.equal(b.v, 0);
});

test('snowboard: il pilota automatico scende la verde in ~80 s, tutte le porte, niente cadute, trick in combo', () => {
  const s = nuova();
  passi(s, snowboard.maxTicks, (x) => pilotaSnowboard(x));
  const r = snowboard.result(s);
  assert.equal(r.done, true); assert.equal(r.detail['arrivato'], 1);
  assert.ok(r.detail['ms']! > 60_000 && r.detail['ms']! < 120_000, `tempo ${r.detail['ms']} ms`);
  assert.equal(r.detail['porte'], VERDE.porte.length); assert.equal(r.detail['mancate'], 0); assert.equal(r.detail['cadute'], 0);
  assert.ok(r.detail['salti']! >= 3, `salti ${r.detail['salti']}`);
  assert.deepEqual(s.eventi.filter((e) => e.k === 'fuoripista' || e.k === 'rientro' || e.k === 'arrivo').map((e) => e.k).slice(-3), ['fuoripista', 'rientro', 'arrivo']);
  assert.ok(r.detail['trick']! >= 4 && r.detail['combo']! >= 2, JSON.stringify(r.detail));
  const pigro = nuova();
  passi(pigro, snowboard.maxTicks, (x) => pilotaSnowboard(x, true));
  // la classifica è a tempo con abbuoni: i trick fanno scendere il tempo finale (lo score è più alto)
  const rp = snowboard.result(pigro);
  assert.equal(rp.detail['ms'], r.detail['ms']);
  assert.ok(r.detail['finale']! < rp.detail['finale']! - 4000 && r.score > rp.score, `finale ${r.detail['finale']} contro ${rp.detail['finale']} senza trick`);
  assert.equal(r.detail['finale'], r.detail['ms']! - r.detail['abbuono']! + r.detail['penalita']!);
  assert.equal(r.score, SNOWBOARD.tempo.scoreBase - Math.round(r.detail['finale']! / 10));
});

test('snowboard: stessi input, stessa discesa (il server la rigiocherà)', () => {
  const a = nuova(), log: InputFrame[] = [];
  passi(a, snowboard.maxTicks, (x) => { const f = quantize(pilotaSnowboard(x)); log.push(f); return f; });
  const b = nuova();
  for (const f of log) snowboard.step(b, f);
  assert.equal(hashJson(a), hashJson(b));
  assert.deepEqual(snowboard.result(a), snowboard.result(b));
  assert.deepEqual(snowboard.opzioni!({ pista: 'boh' }), { pista: 'snowboard_verde' });
});

test('snowboard: la curva stretta frena, la neve fresca rallenta, oltre la neve il bosco fa cadere', () => {
  const at = 120;
  const dritto = qui(nuova(), at, 0, 18), stretta = qui(nuova(), at, 0, 18);
  passi(dritto, 90, F());
  passi(stretta, 90, (s) => F({ mx: s.tick % 40 < 20 ? 1 : -1 }));
  assert.ok(stretta.v < dritto.v - 2, `stretta ${stretta.v} contro dritto ${dritto.v}`);
  const p = pistaSnowboard('snowboard_verde'), l = bordoA(p, at);
  const fresca = qui(nuova(), at, l + 3, 18);
  passi(fresca, 120, F());
  assert.ok(fresca.v < dritto.v - 4, `neve fresca ${fresca.v}`);
  assert.equal(fresca.cadute, 0);
  const bosco = qui(nuova(), at, l + VERDE.neve + 0.5, 15);
  passi(bosco, 2, F());
  assert.equal(bosco.cadute, 1); assert.equal(bosco.perche, 'bosco');
});

test('snowboard: contro un albero cadi, 2 s fermo, barra a zero, riparti da lì; rasente riempie la barra', () => {
  const o = VERDE.ostacoli.find((x) => x.tipo === 'abete' && Math.abs(x.lat) < 8)!;
  const s = qui(nuova(), o.s - 12, o.lat, 14);
  s.barra.v = 0.7;
  let fermi = 0;
  passi(s, 60, F());
  assert.equal(s.cadute, 1, 'addosso all\'albero'); assert.equal(s.perche, 'abete'); assert.equal(s.barra.v, 0);
  while (s.caduta > 0) { snowboard.step(s, F()); fermi++; }
  assert.ok(Math.abs(fermi - SNOWBOARD.caduta * 60) <= 60, `fermo ${fermi} tick`);
  assert.ok(Math.abs(s.s - o.s) < 4 && Math.abs(s.lat - o.lat) > o.r + SNOWBOARD.corpo, 'riparte accanto all\'albero');
  passi(s, 60, F());
  assert.equal(s.cadute, 1, 'e non ci ricade sopra');
  const r = qui(nuova(), o.s - 12, o.lat + o.r + SNOWBOARD.corpo + 0.5, 14);
  passi(r, 60, F());
  assert.equal(r.cadute, 0); assert.ok(r.barra.v > 0, 'rasente: la barra sale');
});

test('snowboard: la porta mancata toglie punti e la discesa va avanti', () => {
  const g = VERDE.porte[3]!;
  const s = qui(nuova(), g.s - 10, g.lat + g.w, 15);
  passi(s, 60, F());
  assert.equal(s.mancate, 1); assert.equal(s.punti, -SNOWBOARD.punti.portaMancata); assert.ok(s.v > 10);
  const ok = qui(nuova(), g.s - 10, g.lat, 15);
  passi(ok, 60, F());
  assert.equal(ok.porte, 1); assert.equal(ok.punti, SNOWBOARD.punti.porta);
});

/** Sul trampolino `i`: `lascia` = secondi prima del bordo in cui si lascia (null = si tiene premuto fino in aria). */
function trampolino(i: number, lascia: number | null): SnowState {
  const r = VERDE.rampe[i]!, mid = (r.lat[0] + r.lat[1]) / 2, v = 16;
  const s = qui(nuova(), r.s - r.lungo - 6, mid, v);
  passi(s, 600, (x) => {
    if (x.aria) return F({ a: lascia === null });
    const t = (r.s - x.s) / x.v;
    return F({ a: lascia === null || t > lascia });
  });
  return s;
}
test('snowboard: sul trampolino lasciare proprio sul bordo è il salto grande; tenendo si vola basso', () => {
  const r = VERDE.rampe[0]!, p = pistaSnowboard('snowboard_verde');
  // la spinta si misura rispetto alla neve che scende (il salto di neve sta su un pendio ripido)
  const suNeve = (x: SnowState) => x.vy + x.v * pendenzaA(p, x.s);
  const grande = qui(nuova(), r.s - r.lungo - 6, 0, 16);
  let vyG = 0, vyB = 0;
  passi(grande, 200, (x) => { if (x.aria && !vyG) vyG = suNeve(x); return F({ a: !x.aria && (r.s - x.s) / x.v > 0.05 }); });
  const basso = qui(nuova(), r.s - r.lungo - 6, 0, 16);
  passi(basso, 200, (x) => { if (x.aria && !vyB) vyB = suNeve(x); return F({ a: true }); });
  assert.ok(vyG > r.salto * 0.9, `grande ${vyG}`);
  assert.ok(vyB > 0 && vyB < vyG * 0.75, `basso ${vyB} contro ${vyG}`);
  assert.ok(grande.eventi.some((e) => e.k === 'grande') && grande.barra.v > 0);
  assert.equal(grande.salti, 1); assert.equal(grande.cadute, 0);
  assert.ok(trampolino(0, 0.05).punti > 0);
});

test('snowboard: trick in combo valgono di più; atterrare a metà trick o in presa è una caduta', () => {
  const r = VERDE.rampe.find((q) => q.grande)!;
  /** Salta il trampolino grande e in aria fa `gesti` (uno ogni 0,7 s) e/o la presa. */
  const salta = (gesti: Partial<InputFrame>[], presa: [number, number] | null) => {
    const s = qui(nuova(), r.s - r.lungo - 6, 0, 18);
    passi(s, 400, (x) => {
      if (!x.aria) return F({ a: x.s < r.s && (r.s - x.s) / x.v > 0.05 });
      const t = x.ariaT, k = Math.floor(t / 0.75);
      if (presa && t >= presa[0] && t < presa[1]) return F({ a: true });
      return k < gesti.length && t - k * 0.75 < 0.05 ? F(gesti[k]) : F();
    });
    return s;
  };
  const uno = salta([{ my: 1 }], null), due = salta([{ my: 1 }, { mx: -1 }], null);
  assert.equal(uno.cadute, 0); assert.equal(uno.trickFatti, 1);
  assert.equal(due.cadute, 0); assert.equal(due.trickFatti, 2); assert.equal(due.maxCombo, 2);
  const nome = (s: SnowState) => s.eventi.filter((e) => e.k === 'trick').map((e) => e.x);
  assert.deepEqual(nome(due), ['Mortale avanti', '360 ×2']);
  assert.ok(due.punti > uno.punti + SNOWBOARD.trick.giro_sx.punti, `combo ${due.punti} contro ${uno.punti}`);
  const presa = salta([], [0.3, 1.0]);
  assert.equal(presa.cadute, 0); assert.ok(presa.eventi.some((e) => e.k === 'presa' && e.n > 100));
  const troppi = salta([{ my: -1 }, { my: 1 }, { mx: 1 }, { my: -1 }, { mx: -1 }], null);
  assert.equal(troppi.cadute, 1); assert.equal(troppi.perche, 'storto');
  const presaLunga = salta([], [0.3, 9]);
  assert.equal(presaLunga.cadute, 1); assert.equal(presaLunga.perche, 'presa');
});

test('snowboard: fuoripista, dritto al bivio si sbatte contro l’abete caduto; nel sentiero la neve alta frena', () => {
  const f = VERDE.fuoripista!;
  assert.ok(f.a - f.da > 150, 'sentiero lungo');
  const dritto = qui(nuova(), f.da - 15, 0, 18);
  // la pista battuta va dritta: nelle coordinate del sentiero (che gira a sinistra) andare dritti è scivolare a destra
  passi(dritto, 240, (x) => F({ mx: x.cadute ? 0 : x.s > f.da ? 1 : 0 }));
  assert.equal(dritto.cadute, 1); assert.equal(dritto.perche, 'tronco');
  const sentiero = qui(nuova(), f.da + 30, 0, 22);
  passi(sentiero, 120, F());
  assert.ok(sentiero.v < SNOWBOARD.fisica.vFuoripista + 1, `nel sentiero ${sentiero.v}`);
});

test('snowboard: dalla cornice si vola da soli; atterrare in piano da troppo in alto è una caduta', () => {
  const z = (id: string) => VERDE.zone.find((q) => q.id === id)!;
  for (const id of ['muro']) {
    const s = qui(nuova(), z(id).da - 25, 0, 17);
    let volo = false;
    passi(s, 240, (x) => { if (x.aria) volo = true; return F(); });
    assert.ok(volo, `niente volo da ${id}`);
    assert.equal(s.cadute, 0, `caduto a ${id}: ${s.perche}`);
  }
  // sopra il pendio quasi piano dell'arrivo, lasciato cadere da 25 m: botta
  const s = qui(nuova(), VERDE.arrivo - 30, 0, 10);
  s.aria = true; s.y += 25; s.vy = 0;
  passi(s, 200, F());
  assert.equal(s.cadute, 1); assert.equal(s.perche, 'botta');
});

test('snowboard: la classifica a tempo dà le medaglie (batti il record = oro, secondo argento, terzo bronzo; il primo prende l’oro)', () => {
  const cl = [{ chi: 'ada', ms: 90_000 }, { chi: 'bea', ms: 95_000 }, { chi: 'ciro', ms: 100_000 }];
  assert.equal(medagliaDaPosizione(posizioneDiscesa([], 'io', 120_000)), 'oro', 'nessuno davanti: oro');
  assert.equal(medagliaDaPosizione(posizioneDiscesa(cl, 'io', 89_000)), 'oro');
  assert.equal(medagliaDaPosizione(posizioneDiscesa(cl, 'io', 92_000)), 'argento');
  assert.equal(medagliaDaPosizione(posizioneDiscesa(cl, 'io', 97_000)), 'bronzo');
  assert.equal(medagliaDaPosizione(posizioneDiscesa(cl, 'io', 101_000)), null);
  // il proprio vecchio tempo non conta: ada che fa peggio del suo record ma meglio di tutti gli altri resta prima
  assert.equal(posizioneDiscesa(cl, 'ada', 93_000), 1);
  assert.equal(migliora(cl, 'ada', 93_000), false); assert.equal(migliora(cl, 'ada', 80_000), true); assert.equal(migliora(cl, 'nuovo', 200_000), true);
});

test('snowboard: nel registro del server (registra.ts) la partita si rigioca uguale', () => {
  assert.ok(MINIGAMES['snowboard']);
  const s = nuova(), log: InputFrame[] = [];
  passi(s, snowboard.maxTicks, (x) => { const f = quantize(pilotaSnowboard(x)); log.push(f); return f; });
  const r = replay('snowboard', 3, 1, packInputs(log), { pista: 'snowboard_verde' });
  assert.deepEqual(r, snowboard.result(s));
});
