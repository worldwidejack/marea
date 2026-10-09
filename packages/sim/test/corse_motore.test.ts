// Motore v2 dell'Isola delle Corse (docs/CORSE.md A11). Cosa si controlla:
// - il nastro: campioni a passo costante, terna ortonormale, giro della morte a testa in giù, andata e ritorno mondo ↔ pista;
// - le superfici e gli eventi firma;
// - la guida: muri, salti sopra il buco, cadute e ripartenza, ponte senza muri, scorciatoia;
// - il pilota automatico che arriva su ogni pista;
// - determinismo e opzioni;
// - (#170) sterzo progressivo, drift a 3 livelli che conviene, turbo alla partenza, acrobazie, scia, turbo sommati, regole spente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORSE, CORSE_PISTE, validateCorse } from '@marea/content/corse.ts';
import { VIA, curvaSterzo, famiglieDi, garaCorse, opzioniGara, pilotaGara } from '../src/corse/gara.ts';
import type { GaraState, GaraView } from '../src/corse/gara.ts';
import { REGOLE_TUTTE, daiTurbo, livelloDrift } from '../src/corse/veicolo.ts';
import { campo, costruisciNastro, dove, punto, svoltaTra } from '../src/corse/nastro.ts';
import { VUOTO, effetto, pistaCorse, superficieA, veicoloCorse } from '../src/corse/pista.ts';
import { hashJson } from '../src/hash.ts';
import { packInputs, quantize, unpackInputs } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

const nuova = (pista: string, veicolo?: string, bot = true, seed = 7, regole: Record<string, string> = {}): GaraState =>
  garaCorse.create({ seed, difficulty: 2, opzioni: { pista, ...(veicolo ? { veicolo } : {}), bot: bot ? '1' : '0', ...regole } });
const FERMO: InputFrame = { mx: 0, my: 1, a: false, b: false };
/** Salta il conto alla rovescia senza toccare niente. */
const via = (s: GaraState) => { while (s.tick < 1) garaCorse.step(s, FERMO); return s; };
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
  assert.ok(Object.keys(CORSE_PISTE).length >= 8);
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

test('corse v2: il pilota automatico arriva su ogni pista con ogni veicolo; il primo della famiglia principale vince, quelli delle altre salgono sul podio', () => {
  for (const id of Object.keys(CORSE_PISTE)) {
    const d = CORSE_PISTE[id]!, fams = famiglieDi(d);
    for (const v of CORSE.veicoli.filter((x) => fams.includes(x.famiglia))) {
      const { r } = corri(nuova(id, v.id));
      assert.equal(r.detail['giri'], r.detail['tot'], `${id} ${v.id}: ${JSON.stringify(r.detail)}`);
      assert.equal(r.detail['cadute'], 0, `${id} ${v.id}: ${JSON.stringify(r.detail)}`);
    }
    if (id === 'prova_folle') continue; // la pista folle è una vetrina: il pilota automatico non è il più furbo
    for (const seed of [1, 42]) {
      const { r } = corri(nuova(id, undefined, true, seed));
      assert.equal(r.medal, 'oro', `${id} seed ${seed}: ${JSON.stringify(r.detail)}`);
    }
    // piste miste: tra le barche e le ruote si fa traffico, quindi il primo veicolo delle altre famiglie deve almeno stare sul podio
    for (const f of fams.slice(1)) {
      const primo = CORSE.veicoli.find((x) => x.famiglia === f)!;
      const { r } = corri(nuova(id, primo.id, true, 1));
      assert.ok((r.detail['pos'] as number) <= 3, `${id} ${primo.id}: ${JSON.stringify(r.detail)}`);
    }
  }
  // chi va a mezzo gas senza drift arriva ultimo
  const { r } = corri(nuova('prova_anello'), (s) => pilotaGara(s, true));
  assert.equal(r.detail['pos'], 5); assert.equal(r.medal, null);
});

test('corse v2: Spiaggia e porto: 4 piste, una per tipo (circuito ruote, circuito acqua, misto, fuga), tutte con un evento o una sorpresa sua', () => {
  const ids = ['spiaggia_lungomare', 'spiaggia_baia', 'spiaggia_porto', 'spiaggia_fuga'];
  for (const id of ids) assert.equal(CORSE_PISTE[id]!.zona, 'spiaggia', id);
  assert.deepEqual(ids.map((id) => famiglieDi(CORSE_PISTE[id]!)), [['ruote'], ['acqua'], ['ruote', 'acqua'], ['ruote']]);
  assert.deepEqual(ids.map((id) => CORSE_PISTE[id]!.tipo), ['circuito', 'circuito', 'circuito', 'fuga']);
  // gli eventi firma cambiano il tratto dal giro giusto: l'onda del lungomare (3°), la marea della baia (2°), i container del porto (2°)
  const dove = (id: string) => { const e = CORSE_PISTE[id]!.eventi[0]!, p = pistaCorse(id), lat = e.lat ? (e.lat[0] + e.lat[1]) / 2 : 0; return { e, p, lat, s: (e.da + e.a) / 2 }; };
  for (const [id, giro, sup, prima] of [['spiaggia_lungomare', 3, 'acquaBassa', 'asfalto'], ['spiaggia_baia', 2, 'acqua', 'sabbia'], ['spiaggia_porto', 2, 'container', 'legno']] as const) {
    const { e, p, lat, s } = dove(id);
    assert.equal(e.daGiro, giro, id);
    assert.equal(superficieA(p, -1, s, lat, giro - 1), prima, `${id} prima del giro ${giro}`);
    assert.equal(superficieA(p, -1, s, lat, giro), sup, `${id} dal giro ${giro}`);
  }
});

test('corse v2: il porto è misto: tutte e due le famiglie, bot misti, ognuno parte e guida nella sua corsia (barche nell\'acqua, ruote sul molo)', () => {
  const d = CORSE_PISTE['spiaggia_porto']!;
  assert.deepEqual(opzioniGara({ pista: 'spiaggia_porto', veicolo: 'vasca' }), { pista: 'spiaggia_porto', veicolo: 'vasca', bot: '1', sterzo: '1', partenza: '1', acrobazie: '1', scia: '1', somma: '1' }, 'una barca è ammessa');
  assert.equal(opzioniGara({ pista: 'spiaggia_porto', veicolo: 'carrello' })['veicolo'], 'carrello', 'e anche un veicolo a ruote');
  const s = nuova('spiaggia_porto', 'kart'), p = pistaCorse('spiaggia_porto');
  const fam = s.veicoli.map((k) => veicoloCorse(k.id).famiglia);
  assert.deepEqual(fam, ['ruote', 'ruote', 'acqua', 'ruote', 'acqua'], 'tu e quattro bot alternati');
  for (const k of s.veicoli) assert.equal(Math.sign(k.lat), Math.sign(d.corsie![veicoloCorse(k.id).famiglia]!), `${k.id} parte nella sua corsia (${k.lat})`);
  // dove sta l'acqua e dove il molo, sulla carreggiata
  assert.equal(superficieA(p, -1, 100, -4.2, 1), 'acqua'); assert.equal(superficieA(p, -1, 100, 4.2, 1), 'legno');
  // fuori dalla sua corsia si rallenta molto
  const barca = veicoloCorse('moto_acqua'), ruote = veicoloCorse('kart');
  assert.ok(effetto(barca, 'legno').velocita < 0.4 && effetto(ruote, 'acqua').velocita < 0.5);
  // e in gara: le ruote restano sul molo, le barche nell'acqua
  const r = corri(nuova('spiaggia_porto', 'kart', true, 3)), g = nuova('spiaggia_porto', 'moto_acqua', true, 3);
  assert.equal(r.r.detail['giri'], 3);
  const lat: Record<string, number[]> = { ruote: [], acqua: [] };
  while (!g.done) {
    garaCorse.step(g, quantize(pilotaGara(g)));
    if (g.tick % 30 === 0) for (const k of g.veicoli) if (k.ramo < 0 && !k.aria) lat[veicoloCorse(k.id).famiglia]!.push(k.lat);
  }
  const media = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(media(lat['ruote']!) > 2 && media(lat['acqua']!) < -2, `corsie: ruote ${media(lat['ruote']!).toFixed(1)}, acqua ${media(lat['acqua']!).toFixed(1)}`);
});

test('corse v2: le scorciatoie del porto sono di una famiglia sola: la passerella delle ruote, il canale delle barche (e convengono)', () => {
  const p = pistaCorse('spiaggia_porto');
  assert.deepEqual(p.def.rami.map((r) => [r.id, r.famiglie]), [['passerella', ['ruote']], ['canale', ['acqua']]]);
  assert.ok(p.def.rami.every((r) => r.turbo && r.turbo.length === 1), 'ognuna ha il suo tappeto del turbo');
  for (const [veicolo, ramo] of [['kart', 'passerella'], ['moto_acqua', 'canale']] as const) {
    const s = nuova('spiaggia_porto', veicolo, false), idx = p.rami.findIndex((r) => r.def.id === ramo), altro = 1 - idx;
    let suQuesto = 0, suAltro = 0;
    while (!s.done) { garaCorse.step(s, quantize(pilotaGara(s))); const k = s.veicoli[0]!; if (k.ramo === idx) suQuesto++; else if (k.ramo === altro) suAltro++; }
    assert.ok(suQuesto > 200 && suAltro === 0, `${veicolo}: ${suQuesto} tick sulla sua scorciatoia, ${suAltro} sull'altra`);
    // senza scorciatoia si perde tempo
    const tempo = garaCorse.result(s).detail['ms'] as number, saved = p.rami.splice(0);
    const t2 = corri(nuova('spiaggia_porto', veicolo, false)).r.detail['ms'] as number;
    p.rami.push(...saved);
    assert.ok(t2 > tempo, `${veicolo}: con la scorciatoia ${tempo} ms, senza ${t2} ms`);
  }
});

test('corse v2: la fuga dall\'onda: il pilota automatico non si fa prendere, chi sta fermo sì (colpo e rallentamento una volta sola); i bot ritardatari vengono presi', () => {
  const p = pistaCorse('spiaggia_fuga'), O = p.def.inseguitore!;
  assert.ok(O && p.def.tipo === 'fuga' && p.def.via + O.parte >= 0);
  // il pilota automatico: l'onda resta dietro per tutta la corsa (e si vede dal risultato)
  const s = nuova('spiaggia_fuga', 'kart', true, 5);
  let min = Infinity, ondaPrima = s.onda;
  while (!s.done) {
    garaCorse.step(s, quantize(pilotaGara(s)));
    min = Math.min(min, s.veicoli[0]!.prog - s.onda);
    assert.ok(s.onda >= ondaPrima, 'l\'onda non torna indietro'); ondaPrima = s.onda;
  }
  const r = garaCorse.result(s);
  assert.equal(r.detail['travolti'], 0); assert.ok(min > 10, `distanza minima ${min.toFixed(1)} m`);
  assert.equal((garaCorse.view(s) as { onda: number | null }).onda, s.onda);
  assert.ok(s.veicoli.slice(1).some((k) => k.travolto === 1), 'qualche bot in ritardo viene preso');
  // chi sta fermo: l'onda lo prende, lo colpisce una volta, e poi gli passa sopra
  const f = nuova('spiaggia_fuga', 'kart', false);
  let vPrima = 0, preso = 0, dentro = 0, fuori = 0;
  for (let i = 0; i < 60 * 40; i++) {
    const k = f.veicoli[0]!;
    garaCorse.step(f, { mx: 0, my: 0, a: false, b: false });
    if (!preso && k.travolto) { preso = f.tick; vPrima = k.v; }
    if (k.prog <= f.onda && k.prog > f.onda - O.spessore) dentro++;
    else if (k.travolto && k.prog <= f.onda - O.spessore) fuori++;
  }
  assert.ok(preso > 60 * 3 && preso < 60 * 15, `preso al tick ${preso}`);
  assert.equal(f.veicoli[0]!.travolto, 1); assert.ok(dentro > 20 && fuori > 100, `dentro ${dentro}, dopo ${fuori}`);
  assert.ok(vPrima === 0);
  // un veicolo in corsa preso dall'onda: colpo (velocità × colpo) e poi massimo rallentato finché il corpo passa
  const c = via(nuova('spiaggia_fuga', 'kart', false, 2)), k = c.veicoli[0]!;
  c.onda = k.prog + 0.1; k.v = 20;
  garaCorse.step(c, { mx: 0, my: 1, a: false, b: false });
  assert.equal(k.travolto, 1); assert.ok(k.v < 20 * (O.colpo + 0.05), `v dopo il colpo ${k.v}`);
  for (let i = 0; i < 40; i++) garaCorse.step(c, { mx: 0, my: 1, a: false, b: false });
  assert.ok(k.v <= 20 * O.rallenta + 1, `v nel corpo dell'onda ${k.v}`);
});

test('corse v2: deterministico (stessi input → stesso risultato e stessi veicoli) e opzioni normalizzate', () => {
  const a = nuova('prova_folle', 'kart', true, 99), { log, r } = corri(a);
  const b = nuova('prova_folle', 'kart', true, 99);
  for (const f of unpackInputs(packInputs(log))) garaCorse.step(b, f);
  assert.deepEqual(garaCorse.result(b), r);
  assert.equal(hashJson(b.veicoli), hashJson(a.veicoli));
  const tutte = { sterzo: '1', partenza: '1', acrobazie: '1', scia: '1', somma: '1' };
  assert.deepEqual(opzioniGara({ pista: 'inesistente', veicolo: 'boh' }), { pista: Object.keys(CORSE_PISTE)[0], veicolo: 'kart', bot: '1', ...tutte });
  assert.deepEqual(opzioniGara({ pista: 'prova_baia', veicolo: 'kart', bot: '0', scia: '0', somma: 'boh' }), { pista: 'prova_baia', veicolo: 'moto_acqua', bot: '0', ...tutte, scia: '0' });
  assert.equal(nuova('prova_baia', undefined, false).veicoli.length, 1);
});

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

test('corse v2 (#170): turbo alla partenza (razzo, buona, motore ingolfato) e conto alla rovescia', () => {
  const parti = (premi: number | null, regole: Record<string, string> = {}) => {
    const s = nuova('prova_fuga', 'kart', false, 7, regole), k = s.veicoli[0]!;
    assert.equal(s.tick, -VIA);
    while (s.tick < 1) { assert.equal(k.v, 0, 'nel conto alla rovescia si sta fermi'); garaCorse.step(s, { mx: 0, my: 1, a: premi !== null && -s.tick <= premi * 60, b: false }); }
    for (let i = 0; i < 90; i++) garaCorse.step(s, FERMO);
    return k;
  };
  const razzo = parti(0.2), buona = parti(0.7), ingolfato = parti(2), niente = parti(null), spenta = parti(0.2, { partenza: '0' });
  assert.ok(razzo.partenza === 2 && buona.partenza === 1 && ingolfato.partenza === -1 && niente.partenza === 0 && spenta.partenza === 0);
  assert.ok(razzo.prog > buona.prog && buona.prog > niente.prog && niente.prog > ingolfato.prog, [razzo, buona, niente, ingolfato].map((k) => k.prog.toFixed(2)).join(' > '));
  const g = nuova('prova_fuga', 'kart', false), q = g.veicoli[0]!;
  while (g.tick < 30) garaCorse.step(g, { mx: 0, my: 1, a: true, b: false });
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
