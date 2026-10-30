// Fuga dalla lava (Isola Vulcano): corsa senza fine a schermo intero. Il feeling in numeri (salto corto e lungo, coyote, salto prenotato,
// giravolta, scavalco, bordo), il percorso dal seed, il muro di lava, il pilota di riferimento, il replay e il posto sull'isola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, BALANCE, ISLANDS, MINIGAMES_CFG } from '@marea/content';
import { lava } from '../src/minigames/lava.ts';
import type { LavaState, LavaView } from '../src/minigames/lava.ts';
import { HW, T, X0, avanza, azzera, corpoNuovo, nuovoEvento } from '../src/minigames/lava_fisica.ts';
import type { Corpo, Evento, Mondo, Pezzo } from '../src/minigames/lava_fisica.ts';
import { LUNGHEZZA } from '../src/minigames/lava_percorso.ts';
import type { Difficulty, MinigameResult } from '../src/minigames/types.ts';
import { getMinigame } from '../src/minigames/registry.ts';
import '../src/minigames/lava_registra.ts'; // la lava è nel registro solo lato server (come lo vede il DO del lotto)
import { hashJson } from '../src/hash.ts';
import { createRng } from '../src/rng.ts';
import { isPackedInputs, packInputs, quantize, replay } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';
import { soloPrize } from '../src/economy/rewards.ts';
import { composeArchipelago } from '../src/world/archipelago.ts';

const C = MINIGAMES_CFG.lava;
const NO: InputFrame = { mx: 0, my: 0, a: false, b: false };

function gioca(seed: number, difficulty: Difficulty, pilota: (s: LavaState, t: number) => InputFrame): { s: LavaState; log: InputFrame[]; r: MinigameResult } {
  const s = lava.create({ seed, difficulty });
  const log: InputFrame[] = [];
  for (let t = 0; !s.done; t++) { const f = quantize(pilota(s, t)); log.push(f); lava.step(s, f); }
  return { s, log, r: lava.result(s) };
}
const auto = (s: LavaState) => lava.autopilot(s, createRng(1));

// ---- un mondo a mano, per misurare la fisica ----
const mondo = (pezzi: Pezzo[], extra: Partial<Mondo> = {}): Mondo => ({ pezzi, mensole: [], spuntoni: [], magmini: [], geyser: [], ...extra });
const piano = (h = 2, fino = 4000): Mondo => mondo([{ x0: 0, x1: fino, h }]);
/** Fa correre un corpo per `n` tick con `tocca(t)` (t da 1); restituisce gli eventi di ogni tick e il corpo. */
function corri(w: Mondo, c: Corpo, n: number, tocca: (t: number, c: Corpo) => boolean, morti: boolean[] = []): { evs: Evento[]; c: Corpo; minY: number } {
  const evs: Evento[] = []; let minY = c.y;
  for (let t = 1; t <= n; t++) { const e = azzera(nuovoEvento()); avanza(c, w, t, tocca(t, c), morti, e); evs.push({ ...e }); minY = Math.min(minY, c.y); }
  return { evs, c, minY };
}
const start = (h = 2): Corpo => corpoNuovo(-h * T);

test('lava: registrato, 180 s a 60 Hz, stesso seed = stesso percorso, seed diverso = percorso diverso, si parte coi piedi per terra', () => {
  assert.equal(getMinigame('lava'), lava);
  assert.equal(lava.maxTicks, C.maxSeconds * 60);
  const a = lava.create({ seed: 42, difficulty: 2 }), b = lava.create({ seed: 42, difficulty: 2 }), c = lava.create({ seed: 43, difficulty: 2 });
  assert.equal(hashJson(a), hashJson(b));
  assert.notEqual(hashJson(a.mondo), hashJson(c.mondo));
  assert.ok(a.c.terra && a.c.x === X0 && a.c.y === -2 * T && a.c.margine === C.muro.margine);
});

test('lava: il percorso arriva oltre il traguardo, buchi e salti sono fattibili, ci sono tutti i tipi di pezzo e di gemma', () => {
  for (const seed of [1, 2, 3, 99, 123456]) {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = lava.create({ seed, difficulty: d }), p = s.mondo.pezzi;
      assert.ok(p.at(-1)!.x1 >= LUNGHEZZA, 'il percorso arriva oltre la corsa più lunga');
      for (let i = 1; i < p.length; i++) {
        const buco = p[i]!.x0 - p[i - 1]!.x1, su = p[i]!.h - p[i - 1]!.h;
        assert.ok(buco >= 0 && buco <= 7 * T + 4, `seed ${seed}: buco di ${buco} px a x=${p[i - 1]!.x1}`);
        assert.ok(p[i]!.h >= 1 && p[i]!.h <= 6);
        if (buco > 0) assert.ok(su <= 1, `seed ${seed}: dopo un buco la roccia sale di ${su} tile`);
        else assert.ok(su <= 3, `seed ${seed}: gradino di ${su} tile`);
      }
    }
    const s = lava.create({ seed, difficulty: 2 });
    assert.ok(s.mondo.spuntoni.length >= 4 && s.mondo.magmini.length >= 4 && s.mondo.geyser.length >= 3 && s.mondo.mensole.length >= 3, `seed ${seed}: pezzi`);
    const n = (k: string) => s.gemme.filter((g) => g.k === k).length;
    assert.ok(n('ossidiana') >= 200 && n('scintilla') >= 5 && n('rubino') >= 1, `seed ${seed}: gemme ${n('ossidiana')} ${n('scintilla')} ${n('rubino')}`);
    for (let i = 1; i < s.gemme.length; i++) assert.ok(s.gemme[i]!.x >= s.gemme[i - 1]!.x, 'gemme in ordine di x');
    for (const g of s.gemme) assert.ok(g.y < 0 && g.y > -9 * T - 60, `gemma fuori scena: ${g.y}`);
  }
});

test('lava: salto corto e salto lungo — tenendo premuto si sale e si va più lontano, e il tocco in aria è una giravolta (una sola volta)', () => {
  const alto = (tieni: number) => { const r = corri(piano(), start(), 80, (t) => t <= tieni); return { su: -r.minY - 32, evs: r.evs }; };
  const corto = alto(1).su, lungo = alto(40).su;
  assert.ok(corto > 20 && corto < 36, `salto corto ${corto} px`);
  assert.ok(lungo > 3.8 * T && lungo < 5.4 * T, `salto lungo ${lungo} px`);
  const medio = alto(14).su;
  assert.ok(medio > corto + 8 && medio < lungo - 8, `salto medio ${medio} (tra ${corto} e ${lungo})`);
  // giravolta: un secondo tocco a metà discesa dà una spinta in più, un terzo no
  const r = corri(piano(), start(), 120, (t) => t <= 10 || t === 24 || t === 30);
  assert.equal(r.evs.filter((e) => e.spin).length, 1, 'una sola giravolta per salto');
  const senza = corri(piano(), start(), 120, (t) => t <= 10);
  assert.ok(r.evs.findIndex((e) => e.atterra) > senza.evs.findIndex((e) => e.atterra) + 5, 'la giravolta tiene in aria più a lungo');
});

test('lava: coyote (un attimo dopo il bordo si salta ancora) e salto prenotato (tocco poco prima di atterrare = salto appena tocchi terra)', () => {
  const bordo = mondo([{ x0: 0, x1: 240, h: 2 }, { x0: 700, x1: 4000, h: 2 }]);
  const quando = (c: Corpo) => c.x > 240 - HW;
  const lascia = (tocco: number) => {
    let t0 = -1;
    return corri(bordo, start(), 200, (t, c) => { if (t0 < 0 && quando(c)) t0 = t; return t0 >= 0 && t === t0 + tocco; });
  };
  const presto = lascia(C.fisica.coyote - 2), tardi = lascia(C.fisica.coyote + 4);
  assert.ok(presto.evs.some((e) => e.salto), 'subito dopo il bordo: salto vero');
  assert.ok(!tardi.evs.some((e) => e.salto) && tardi.evs.some((e) => e.spin), 'troppo tardi: solo una giravolta');
  // prenotato: tocco corto, e un secondo tocco 3 tick prima di atterrare
  const base = corri(piano(), start(), 60, (t) => t === 1), tAtt = base.evs.findIndex((e) => e.atterra) + 1;
  const pren = corri(piano(), start(), 60, (t) => t === 1 || t === tAtt - 3);
  const i = pren.evs.findIndex((e) => e.atterra);
  assert.ok(pren.evs[i + 1]?.salto, 'salta di nuovo appena atterra');
  assert.ok(!pren.evs.some((e) => e.spin), 'a un attimo da terra il tocco non diventa una giravolta');
});

test('lava: i gradini bassi si scavalcano da soli (e il tocco giusto dà lo scavalco bello), il muro alto no, il bordo ti tira su', () => {
  for (const salita of [1, 2]) {
    const w = mondo([{ x0: 0, x1: 240, h: 2 }, { x0: 240, x1: 4000, h: 2 + salita }]);
    const r = corri(w, start(), 200, () => false);
    assert.ok(r.evs.some((e) => e.scavalco) && !r.evs.some((e) => e.colpo), `gradino di ${salita} tile: scavalco senza colpi`);
    assert.ok(r.c.terra && r.c.y === -(2 + salita) * T && r.c.x > 240, 'finisce in piedi sopra il gradino');
    // il tocco nei tick dello scavalco: bello, e sale più in alto
    let f = -1; const prova = corri(w, start(), 200, (t, c) => { const e = c.scav > 0; if (e && f < 0) f = t + 2; return f > 0 && t === f; });
    assert.ok(prova.evs.some((e) => e.bello), 'scavalco bello');
  }
  const muro = mondo([{ x0: 0, x1: 240, h: 2 }, { x0: 240, x1: 4000, h: 5 }]);
  const r = corri(muro, start(), 160, () => false);
  assert.ok(r.evs.some((e) => e.colpo === 1) && r.c.x < 240 - HW + 1, 'muro di 3 tile: colpo e fermo davanti');
  assert.ok(r.c.margine < C.muro.margine - C.colpo.margine + 1);
  // saltando giusto lo si supera; mistimed ma vicino al bordo ti tira su
  let su = false;
  for (let d = 0; d < 110 && !su; d++) { const q = corri(muro, start(), 200, (t) => t >= d && t < d + 40); su = q.evs.some((e) => e.aggancio) && !q.evs.some((e) => e.colpo); }
  assert.ok(su, 'esiste un salto in cui il bordo ti tira su senza colpi');
  const sopra = corri(muro, start(), 200, (t) => t >= 60 && t < 100);
  assert.ok(sopra.c.x > 260 || sopra.evs.some((e) => e.aggancio || e.colpo), 'saltando si supera o si sbatte, mai bloccati nel nulla');
});

test('lava: spuntoni e magmini — lo spuntone fa male, il magmino si calpesta (rimbalzo, catena) o si scavalca, il geyser eruttato fa male', () => {
  const sp = mondo([{ x0: 0, x1: 4000, h: 2 }], { spuntoni: [{ x: 240, h: 2 }] });
  assert.ok(corri(sp, start(), 200, () => false).evs.some((e) => e.colpo === 2), 'spuntone senza saltare = colpo');
  let pulito = false;
  for (let d = 0; d < 110 && !pulito; d++) pulito = !corri(sp, start(), 200, (t) => t === d + 1).evs.some((e) => e.colpo);
  assert.ok(pulito, 'un salto corto passa sopra lo spuntone');
  const mg = mondo([{ x0: 0, x1: 4000, h: 2 }], { magmini: [{ x: 240, h: 2, amp: 0, per: 180, fase: 0 }] });
  const giu = corri(mg, start(), 200, () => false, [false]);
  assert.ok(giu.evs.some((e) => e.scavalco) && !giu.evs.some((e) => e.colpo || e.nemico), 'di corsa il magmino si scavalca');
  let calpesta = false;
  for (let d = 0; d < 110 && !calpesta; d++) {
    const m: boolean[] = [false], q = corri(mg, start(), 200, (t) => t >= d + 1 && t < d + 12, m);
    calpesta = q.evs.some((e) => e.nemico === 1) && m[0] === true && !q.evs.some((e) => e.colpo);
  }
  assert.ok(calpesta, 'saltandoci sopra: nemico battuto, rimbalzo');
  const gy = mondo([{ x0: 0, x1: 4000, h: 2 }], { geyser: [{ x: 240, h: 2, alto: 40, per: 100, fase: 0 }] });
  let preso = false;
  for (let k = 0; k < 100 && !preso; k++) preso = corri({ ...gy, geyser: [{ ...gy.geyser[0]!, fase: k }] }, start(), 200, () => false).evs.some((e) => e.colpo === 2);
  assert.ok(preso, 'il geyser acceso fa male a chi ci corre dentro');
});

test('lava: la lava non uccide ma costa — il tuffo ti rimette in aria sopra la prossima roccia, ti tolgono vantaggio, a zero sei bruciato', () => {
  const buco = mondo([{ x0: 0, x1: 240, h: 2 }, { x0: 400, x1: 4000, h: 3 }]);
  const r = corri(buco, start(), 260, () => false);
  const i = r.evs.findIndex((e) => e.bagno === 2);
  assert.ok(i >= 0, 'caduto nel buco: tuffo');
  assert.ok(r.c.margine <= C.muro.margine - C.bagno.margine + 20, `vantaggio perso: ${r.c.margine}`);
  assert.ok(r.c.terra && r.c.y === -3 * T && r.c.x > 400, 'la spinta porta oltre il buco, sulla roccia dopo');
  // un secondo tuffo mentre sei ancora invulnerabile è gratis
  assert.ok(!r.evs.slice(i + 1).some((e) => e.bagno === 2), 'niente doppio addebito');
  // bloccato contro un muro il muro di lava ti raggiunge
  const s = lava.create({ seed: 5, difficulty: 2 });
  s.mondo.pezzi.splice(0, s.mondo.pezzi.length, { x0: 0, x1: 240, h: 2 }, { x0: 240, x1: 9000, h: 6 });
  for (let t = 0; t < 1200 && !s.done; t++) lava.step(s, NO);
  assert.equal(s.fine, 'bruciato');
  assert.ok(s.tick < 600, `bruciato in ${s.tick} tick`);
});

test('lava: il pilota di riferimento fa oro su molti seed quasi senza colpi; il replay dal log compresso è identico', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const d = ((seed % 3) + 1) as Difficulty;
    const { s, log, r } = gioca(seed * 7919, d, auto);
    assert.equal(r.done, true);
    assert.equal(r.medal, 'oro', `seed ${seed} d${d}: ${r.score} ${JSON.stringify(r.detail)}`);
    assert.ok(r.detail['colpi']! <= 3 && r.detail['bagni']! <= 1, `seed ${seed}: ${r.detail['colpi']} colpi, ${r.detail['bagni']} tuffi`);
    if (seed <= 2) {
      const p = packInputs(log);
      assert.ok(isPackedInputs(p, lava.maxTicks));
      assert.deepEqual(replay('lava', seed * 7919, d, p), r, `replay diverso seed ${seed}`);
      const s2 = lava.create({ seed: seed * 7919, difficulty: d });
      for (const f of log) lava.step(s2, f);
      assert.equal(hashJson(s2), hashJson(s));
    }
  }
});

test('lava: un pilota con riflessi umani (tocchi in ritardo) a volte muore ma gioca bene; chi non tocca mai brucia presto e non prende medaglie', () => {
  const coda: boolean[] = [];
  const lento = gioca(7919, 2, (s) => { coda.push(auto(s).a); return { ...NO, a: coda.length > 10 ? coda[coda.length - 11]! : false }; });
  assert.ok(lento.r.score > 400, `in ritardo di 10 tick: ${lento.r.score}`);
  assert.ok(lento.s.tick < lava.maxTicks || lento.r.score > 1500, 'o muore, o gioca da oro');
  for (const seed of [5, 6, 7]) {
    const fermo = gioca(seed, 2, () => NO);
    assert.equal(fermo.s.fine, 'bruciato');
    assert.ok(fermo.r.medal === null && fermo.s.tick < 45 * 60, `fermo seed ${seed}: ${fermo.r.medal} in ${fermo.s.tick} tick`);
  }
  const sempre = gioca(5, 2, () => ({ ...NO, a: true }));
  assert.ok(sempre.r.done && Number.isFinite(sempre.s.c.y) && sempre.s.c.y <= 0);
  const caso = createRng(3);
  const tocchi = gioca(5, 2, () => ({ ...NO, a: caso.next() < 0.1 })).r;
  assert.ok(tocchi.medal !== 'oro', `a caso: ${tocchi.medal} ${tocchi.score}`);
});

test('lava: input rotti (assi fuori scala, NaN, a che cambia ogni tick) non rompono la sim; dopo la fine sta ferma; log troppo lunghi rifiutati', () => {
  const s = lava.create({ seed: 8, difficulty: 2 });
  const rng = createRng(8);
  for (let t = 0; t < lava.maxTicks + 50; t++) {
    lava.step(s, { mx: rng.next() * 1e9 - 5e8, my: Number.NaN, a: rng.next() < 0.5, b: rng.next() < 0.5 });
    assert.ok(Number.isFinite(s.c.y) && Number.isFinite(s.c.vy) && Number.isFinite(s.c.x) && s.c.y <= 0 && s.punti >= 0, `tick ${t}: ${s.c.y} ${s.c.vy}`);
  }
  assert.equal(s.done, true);
  const tick = s.tick;
  lava.step(s, NO);
  assert.equal(s.tick, tick, 'dopo la fine la sim sta ferma');
  const v = lava.view(s) as LavaView;
  assert.ok(v.done && v.medals.oro > v.medals.argento && v.medals.argento > v.medals.bronzo);
  assert.equal(isPackedInputs([[lava.maxTicks + 1, 0, 0, 1, 0]], lava.maxTicks), false);
  assert.throws(() => replay('lava', 1, 2, [[lava.maxTicks + 1, 0, 0, 1, 0]]));
});

test('lava: il posto sta sull\'Isola Vulcano, a piedi; l\'oro dà monete in più', () => {
  const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
  const p = arch.places.find((q) => q.island === C.isola);
  assert.ok(p?.tema, 'isola a tema');
  const [cx, cz] = C.posto;
  assert.ok(['.', 'g'].includes(arch.map.at(p.origin[0] + cx, p.origin[1] + cz)), 'cella camminabile');
  const extra = C.premioExtra?.oro ?? 0;
  assert.ok(extra > 0);
  assert.equal(soloPrize('oro', 'lava'), BALANCE.solo.premi.oro + extra);
});
