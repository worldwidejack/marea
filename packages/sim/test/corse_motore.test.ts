// Motore v2 dell'Isola delle Corse (docs/CORSE.md A11). Cosa si controlla:
// - il nastro: campioni a passo costante, terna ortonormale, giro della morte a testa in giù, andata e ritorno mondo ↔ pista;
// - le superfici e gli eventi firma;
// - la guida: muri, salti sopra il buco, cadute e ripartenza, ponte senza muri, scorciatoia;
// - il pilota automatico che arriva su ogni pista;
// - determinismo e opzioni.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORSE, CORSE_PISTE, validateCorse } from '@marea/content/corse.ts';
import { garaCorse, opzioniGara, pilotaGara } from '../src/corse/gara.ts';
import type { GaraState } from '../src/corse/gara.ts';
import { campo, costruisciNastro, dove, punto, svoltaTra } from '../src/corse/nastro.ts';
import { VUOTO, effetto, pistaCorse, superficieA, veicoloCorse } from '../src/corse/pista.ts';
import { hashJson } from '../src/hash.ts';
import { packInputs, quantize, unpackInputs } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const nuova = (pista: string, veicolo?: string, bot = true, seed = 7): GaraState =>
  garaCorse.create({ seed, difficulty: 2, opzioni: { pista, ...(veicolo ? { veicolo } : {}), bot: bot ? '1' : '0' } });
/** Corre la gara col pilota (di serie quello automatico) e conta muri, salti, cadute e tick sul ramo. */
function corri(s: GaraState, pilota: (s: GaraState) => InputFrame = (x) => pilotaGara(x)) {
  const log: InputFrame[] = [];
  let ramo = 0, salto = 0, maxDs = 0, prima = s.veicoli[0]!.prog;
  while (!s.done) {
    const f = quantize(pilota(s)); log.push(f); garaCorse.step(s, f);
    const k = s.veicoli[0]!;
    if (k.ramo >= 0) ramo++;
    if (k.aria) salto++;
    if (!k.caduto && Math.abs(k.prog - prima) < 20) maxDs = Math.max(maxDs, Math.abs(k.prog - prima));
    prima = k.prog;
  }
  return { log, r: garaCorse.result(s), ramo, salto, maxDs };
}

test('corse v2: i dati sono a posto e ogni pista ha veicoli della sua famiglia', () => {
  assert.deepEqual(validateCorse(), []);
  assert.ok(Object.keys(CORSE_PISTE).length >= 4);
});

test('corse v2: il nastro ha campioni a passo costante e una terna ortonormale; mondo ↔ pista torna', () => {
  for (const id of Object.keys(CORSE_PISTE)) {
    const n = pistaCorse(id).n;
    assert.ok(Math.abs(n.passo - CORSE_PISTE[id]!.passo) < 0.05, `${id}: passo ${n.passo}`);
    for (let i = 0; i < n.n; i++) {
      const j = n.chiuso ? (i + 1) % n.n : Math.min(i + 1, n.n - 1);
      if (j !== i) {
        const d = Math.hypot(n.x[j]! - n.x[i]!, n.y[j]! - n.y[i]!, n.z[j]! - n.z[i]!);
        assert.ok(d > n.passo * 0.9 && d < n.passo * 1.02, `${id}: salto di ${d.toFixed(3)} m al campione ${i}`);
      }
      const dot = (a: number, b: number, c: number, x: number, y: number, z: number) => a * x + b * y + c * z;
      const T = [n.tx[i]!, n.ty[i]!, n.tz[i]!] as const, R = [n.rx[i]!, n.ry[i]!, n.rz[i]!] as const, U = [n.ux[i]!, n.uy[i]!, n.uz[i]!] as const;
      assert.ok(Math.abs(dot(...T, ...T) - 1) < 1e-6 && Math.abs(dot(...R, ...R) - 1) < 1e-6 && Math.abs(dot(...U, ...U) - 1) < 1e-6, `${id}: versori ${i}`);
      assert.ok(Math.abs(dot(...T, ...R)) < 1e-6 && Math.abs(dot(...T, ...U)) < 1e-6 && Math.abs(dot(...R, ...U)) < 1e-6, `${id}: terna storta ${i}`);
    }
    // un punto a (s, lat, h) ritrovato da dove()
    const P: [number, number, number] = [0, 0, 0];
    for (const s of [3, n.len * 0.37, n.len * 0.81]) {
      punto(n, s, 2.5, 0.4, P);
      const w = dove(n, P[0], P[1], P[2], s, 30);
      assert.ok(Math.abs(w.s - s) < 0.05 && Math.abs(w.lat - 2.5) < 0.05 && Math.abs(w.h - 0.4) < 0.05, `${id} a ${s}: ${JSON.stringify(w)}`);
    }
  }
  // un anello chiuso piano gira di un giro intero (±2π)
  const anello = pistaCorse('prova_anello').n;
  assert.ok(Math.abs(Math.abs(svoltaTra(anello, 0, anello.len)) - 2 * Math.PI) < 0.05, `svolta ${svoltaTra(anello, 0, anello.len)}`);
  // pista aperta: niente giro intorno
  const aperta = costruisciNastro([{ p: [0, 0, 0] }, { p: [50, 0, 0] }, { p: [100, -10, 20] }], { chiuso: false, passo: 1, larghezza: 5 });
  assert.equal(aperta.chiuso, false); assert.ok(aperta.len > 100 && aperta.y[aperta.n - 1]! < -9.9);
});

test('corse v2: il giro della morte va a testa in giù, aderente, e chi ha velocità ci passa senza cadere', () => {
  const n = pistaCorse('prova_folle').n;
  let sotto = 0, alto = 0;
  for (let i = 0; i < n.n; i++) if (n.uy[i]! < -0.95 && n.ad[i]) { sotto++; alto = Math.max(alto, n.y[i]!); }
  assert.ok(sotto > 3 && alto > 18, `campioni a testa in giù ${sotto}, quota ${alto}`);
  const s = nuova('prova_folle', 'kart', false);
  let giu = 0;
  while (!s.done) {
    garaCorse.step(s, quantize(pilotaGara(s)));
    const k = s.veicoli[0]!;
    if (k.ramo < 0 && campo(n, n.uy, k.s) < -0.9 && !k.aria) giu++;
  }
  const r = garaCorse.result(s);
  assert.ok(giu > 10, `tick a testa in giù attaccati alla pista: ${giu}`);
  assert.equal(r.detail['cadute'], 0, JSON.stringify(r.detail));
});

test('corse v2: superfici, buffi ed eventi firma (la pozzanghera arriva dal secondo giro)', () => {
  const p = pistaCorse('prova_anello'), ev = p.def.eventi[0]!, s = (ev.da + ev.a) / 2, lat = (ev.lat![0] + ev.lat![1]) / 2;
  assert.equal(superficieA(p, -1, s, lat, 1), 'asfalto');
  assert.equal(superficieA(p, -1, s, lat, 2), 'acquaBassa');
  assert.equal(superficieA(p, -1, s, 6, 2), 'asfalto', 'fuori dalla fascia della pozzanghera');
  assert.equal(superficieA(p, -1, 10, 8, 1), 'erba', 'oltre la carreggiata il bordo');
  const sab = p.def.superfici[0]!;
  assert.equal(superficieA(p, -1, (sab.da + sab.a) / 2, 5, 1), 'sabbia');
  const folle = pistaCorse('prova_folle'), buco = folle.def.vuoti[0]!;
  assert.equal(superficieA(folle, -1, (buco.da + buco.a) / 2, 0, 1), VUOTO);
  // le barche sulla terra vanno piano; la vasca da bagno (buffa) meno piano
  const moto = effetto(veicoloCorse('moto_acqua'), 'asfalto'), vasca = effetto(veicoloCorse('vasca'), 'asfalto');
  assert.ok(moto.velocita < 0.5 && vasca.velocita > moto.velocita * 2);
  assert.ok(effetto(veicoloCorse('kart'), 'sabbia').velocita < 1);
});

test('corse v2: il muro tiene dentro (tutto sterzo a destra non esce mai)', () => {
  const s = nuova('prova_anello', 'kart', false), n = pistaCorse('prova_anello').n;
  for (let i = 0; i < 1500; i++) {
    garaCorse.step(s, { mx: 1, my: 1, a: false, b: false });
    const k = s.veicoli[0]!;
    assert.ok(Math.abs(k.lat) <= campo(n, n.l, k.s) + 3 + 0.01, `fuori: ${k.lat}`);
    assert.equal(k.cadute, 0);
  }
});

test('corse v2: il salto sopra il buco riesce a tutto gas; piano si cade e si riparte prima del buco', () => {
  const { r } = corri(nuova('prova_folle', 'kart', false));
  assert.ok(r.detail['salti']! >= 2 && r.detail['cadute'] === 0, JSON.stringify(r.detail));
  // a metà gas il salto è corto: cade nel buco, riparte prima della rampa e poi passa (la ripartenza dà un po' di rincorsa)
  const s = nuova('prova_folle', 'kart', false), buco = pistaCorse('prova_folle').def.vuoti[0]!;
  let caduto = false, ripartito = false;
  for (let i = 0; i < 60 * 40 && !ripartito; i++) {
    const k = s.veicoli[0]!;
    const vicino = k.ramo < 0 && k.s > buco.da - 60 && k.s < buco.a;
    const f = pilotaGara(s);
    garaCorse.step(s, quantize(vicino && !caduto ? { ...f, my: 0.45 } : f));
    if (k.caduto) caduto = true;
    if (caduto && !k.caduto && !k.aria) { ripartito = true; assert.ok(k.s < buco.da && k.lat === 0, `ripartito a ${k.s} (buco da ${buco.da})`); }
  }
  assert.ok(caduto && ripartito, `caduto ${caduto}, ripartito ${ripartito}`);
});

test('corse v2: dal ponte senza muri si cade di lato; sul resto della pista il muro tiene', () => {
  const p = pistaCorse('prova_folle'), ponte = p.def.senzaMuro[0]!;
  const s = nuova('prova_folle', 'kart', false);
  let caduto = false;
  for (let i = 0; i < 60 * 60 && !caduto; i++) {
    const k = s.veicoli[0]!, sulPonte = k.ramo < 0 && k.s > ponte.da + 5 && k.s < ponte.a - 10;
    garaCorse.step(s, quantize(sulPonte ? { mx: -1, my: 1, a: false, b: false } : pilotaGara(s)));
    if (k.caduto) caduto = true;
  }
  assert.ok(caduto, 'sterzando tutto a sinistra sul ponte si cade');
});

test('corse v2: il pilota automatico prende la scorciatoia e il progresso non salta', () => {
  const { r, ramo, maxDs } = corri(nuova('prova_folle', 'auto', false));
  assert.ok(ramo > 100, `tick sulla scorciatoia: ${ramo}`);
  assert.ok(maxDs < 1, `progresso per tick fino a ${maxDs} m`);
  assert.equal(r.detail['giri'], r.detail['tot']);
});

test('corse v2: il pilota automatico arriva su ogni pista con ogni veicolo, e col primo della famiglia vince', () => {
  for (const id of Object.keys(CORSE_PISTE)) {
    const fam = CORSE_PISTE[id]!.famiglia;
    for (const v of CORSE.veicoli.filter((x) => x.famiglia === fam)) {
      const { r } = corri(nuova(id, v.id));
      assert.equal(r.detail['giri'], r.detail['tot'], `${id} ${v.id}: ${JSON.stringify(r.detail)}`);
      assert.equal(r.detail['cadute'], 0, `${id} ${v.id}: ${JSON.stringify(r.detail)}`);
    }
    if (id === 'prova_folle') continue; // la pista folle è una vetrina: il pilota automatico non è il più furbo
    for (const seed of [1, 42]) {
      const { r } = corri(nuova(id, undefined, true, seed));
      assert.equal(r.medal, 'oro', `${id} seed ${seed}: ${JSON.stringify(r.detail)}`);
    }
  }
  // chi va a mezzo gas senza drift arriva ultimo
  const { r } = corri(nuova('prova_anello'), (s) => pilotaGara(s, true));
  assert.equal(r.detail['pos'], 5); assert.equal(r.medal, null);
});

test('corse v2: deterministico (stessi input → stesso risultato e stessi veicoli) e opzioni normalizzate', () => {
  const a = nuova('prova_folle', 'kart', true, 99), { log, r } = corri(a);
  const b = nuova('prova_folle', 'kart', true, 99);
  for (const f of unpackInputs(packInputs(log))) garaCorse.step(b, f);
  assert.deepEqual(garaCorse.result(b), r);
  assert.equal(hashJson(b.veicoli), hashJson(a.veicoli));
  assert.deepEqual(opzioniGara({ pista: 'inesistente', veicolo: 'boh' }), { pista: Object.keys(CORSE_PISTE)[0], veicolo: 'kart', bot: '1' });
  assert.deepEqual(opzioniGara({ pista: 'prova_baia', veicolo: 'kart', bot: '0' }), { pista: 'prova_baia', veicolo: 'moto_acqua', bot: '0' });
  assert.equal(nuova('prova_baia', undefined, false).veicoli.length, 1);
});
