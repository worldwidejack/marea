// Porte, zone, trappole e power-up dei Templari (docs/TEMPLARI.md §3, §9): le porte si comprano con AZIONE e accendono le comparse della
// loro zona; il rogo e la campana uccidono chi ci passa (senza punti), i boss perdono vita, l'eroe si fa male; i power-up escono a caso
// (al massimo 4 a ondata, sempre dai boss), dove l'eroe arriva, e si prendono passandoci sopra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, nemicoDef } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { attive } from '../src/templari/ondate.ts';
import { colpisci, dai, lasciaPotere, uccidi } from '../src/templari/colpi.ts';
import { nuovoZombie } from '../src/templari/stato.ts';
import { raggiungePunto } from '../src/templari/raggiungi.ts';
import { stepCassa } from '../src/templari/cassa.ts';
import { daiArma } from '../src/templari/eroe.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, F); };
/** Un tocco di AZIONE (fronte di salita) e un tick per lasciarla. */
const azione = (s: TState) => { stepTemplari(s, { ...F, d: true }); stepTemplari(s, F); };
function arena(seed = 1, ondata = 1): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = ondata; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  s.eroe.vita = s.eroe.max = 1e6; // i test non devono morire per sbaglio
  return s;
}
function zombie(s: TState, tipo: string, x: number, z: number) {
  const zz = nuovoZombie(s, tipo, x, z, 0);
  zz.st = 'insegue'; zz.cd = 1e9;
  return zz;
}
const centro = (s: TState, i: number) => ({ x: ((i % s.arena.w) + 0.5) * s.arena.tile, z: (Math.floor(i / s.arena.w) + 0.5) * s.arena.tile });
const porta = (s: TState, id: string) => s.arena.porte.find((p) => p.id === id)!;
/** L'eroe sulla cella libera accanto alla porta, dalla parte già aperta. */
function davanti(s: TState, id: string) {
  const g = s.gr.eroe;
  for (const i of porta(s, id).celle) for (const d of [1, -1, g.w, -g.w]) {
    const c = centro(s, i + d);
    if (!g.solid[i + d] && raggiungePunto(s, c.x, c.z)) { s.eroe.x = c.x; s.eroe.z = c.z; return; }
  }
  throw new Error('porta ' + id + ' non raggiungibile');
}
const zone = (s: TState) => [...new Set(attive(s).map((c) => c.zona))].sort();

test('porte: AZIONE con i punti apre la porta, la zona si accende; senza punti niente', () => {
  const s = arena();
  assert.deepEqual(zone(s), ['fuori']);
  davanti(s, 'portale');
  const v0 = templari.view(s);
  assert.equal(v0.prompt?.cosa, 'porta');
  assert.equal(v0.prompt?.prezzo, TEMPLARI.porte['portale']!.prezzo);
  assert.equal(v0.prompt?.puoi, false); // 500 punti non bastano
  azione(s);
  assert.equal(s.porte['portale'], false);
  s.punti = 2000;
  azione(s);
  assert.equal(s.porte['portale'], true);
  assert.equal(s.punti, 2000 - TEMPLARI.porte['portale']!.prezzo);
  assert.ok(templari.view(s).porte.find((p) => p.id === 'portale')?.aperta);
  assert.deepEqual(zone(s), ['fuori', 'piazza']);
  // in piazza ci si arriva, al cimitero e alla spiaggia no
  const y = s.arena.comparse.find((c) => c.zona === 'piazza')!, u = s.arena.comparse.find((c) => c.zona === 'cimitero')!, j = s.arena.comparse.find((c) => c.zona === 'spiaggia')!;
  assert.ok(raggiungePunto(s, y.x, y.z));
  assert.ok(!raggiungePunto(s, u.x, u.z));
  assert.ok(!raggiungePunto(s, j.x, j.z));
});

test('zone: taverna dalla piazza, spiaggia dalla taverna o dal cimitero col cancello', () => {
  const s = arena();
  s.punti = 1e6;
  for (const id of ['portale', 'taverna', 'spiaggia_taverna']) { davanti(s, id); azione(s); assert.equal(s.porte[id], true, id); }
  assert.deepEqual(zone(s), ['fuori', 'piazza', 'spiaggia', 'taverna']);
  const j = s.arena.comparse.find((c) => c.zona === 'spiaggia')!;
  assert.ok(raggiungePunto(s, j.x, j.z));
  const t = arena();
  t.punti = 1e6;
  for (const id of ['cimitero', 'spiaggia_cimitero']) { davanti(t, id); azione(t); assert.equal(t.porte[id], true, id); }
  assert.deepEqual(zone(t), ['cimitero', 'fuori', 'spiaggia']);
});

test('ondate con la piazza aperta: gli zombie escono anche dalla piazza quando sei lì', () => {
  const s = arena(3, 2);
  s.punti = 1e6;
  davanti(s, 'portale'); azione(s);
  const y = s.arena.comparse.filter((c) => c.zona === 'piazza');
  s.eroe.x = y[0]!.x + 7; s.eroe.z = y[0]!.z;
  s.quanti = 30; s.prossima = s.tick;
  const visti = new Set<string>();
  for (let i = 0; i < 60 * 30 && s.usciti < 12; i++) {
    stepTemplari(s, F);
    for (const e of s.eventi) if (e.t === 'sorge') visti.add(s.arena.comparse.find((c) => Math.abs(c.x - e.x) < 0.01 && Math.abs(c.z - e.z) < 0.01)?.zona ?? '?');
  }
  assert.ok(visti.has('piazza'), [...visti].join(','));
});

test('rogo: la leva accende la brace; chi ci passa muore senza punti, il boss perde vita, l\'eroe brucia; poi si ricarica', () => {
  const s = arena();
  const ti = s.arena.trappole.findIndex((t) => t.id === 'rogo'), t = s.arena.trappole[ti]!, d = TEMPLARI.trappole['rogo']!;
  // accanto alla leva
  const g = s.gr.eroe, lc = Math.floor(t.leva.z) * g.w + Math.floor(t.leva.x);
  const libera = [1, -1, g.w, -g.w].map((k) => lc + k).find((i) => !g.solid[i])!;
  Object.assign(s.eroe, centro(s, libera));
  assert.equal(templari.view(s).prompt?.cosa, 'trappola');
  s.punti = 1500;
  azione(s);
  assert.equal(s.punti, 1500 - d.prezzo);
  assert.ok(templari.view(s).trappole.find((x) => x.id === 'rogo')!.accesa > 24);
  const p = centro(s, t.celle[2]!), q = centro(s, t.celle[5]!);
  const fante = zombie(s, 'fante', p.x, p.z), cav = zombie(s, 'cavaliere', q.x, q.z);
  const punti = s.punti, morti = s.uccisioni;
  passi(s, 2);
  assert.equal(fante.st, 'morto');
  assert.equal(s.uccisioni, morti + 1);
  assert.equal(s.punti, punti);
  assert.ok(cav.st !== 'morto' && cav.vita < cav.max);
  // l'eroe sulla brace si fa male
  const v0 = s.eroe.vita;
  Object.assign(s.eroe, centro(s, t.celle[0]!));
  passi(s, 40);
  assert.ok(s.eroe.vita <= v0 - d.eroe.danno, `vita ${v0} → ${s.eroe.vita}`);
  // finiti i secondi si spegne e si ricarica: niente seconda accensione prima del tempo
  passi(s, 60 * d.durata);
  assert.equal(templari.view(s).trappole.find((x) => x.id === 'rogo')!.accesa, 0);
  Object.assign(s.eroe, centro(s, libera));
  s.punti = 5000;
  assert.equal(templari.view(s).prompt?.puoi, false);
  azione(s);
  assert.equal(s.punti, 5000);
  passi(s, 60 * d.ricarica);
  assert.equal(templari.view(s).prompt?.puoi, true);
});

test('campana: fuori dalla porta nord, falcia chi ci passa', () => {
  const s = arena();
  const ti = s.arena.trappole.findIndex((t) => t.id === 'campana'), t = s.arena.trappole[ti]!;
  assert.ok(t.celle.length > 20);
  s.trappole[ti]!.fine = s.tick + 600; s.trappole[ti]!.pronta = s.tick + 1200;
  const p = centro(s, t.celle[10]!), z = zombie(s, 'pirata', p.x, p.z);
  passi(s, 2);
  assert.equal(z.st, 'morto');
});

test('power-up: al massimo 4 a ondata, i boss ne lasciano sempre uno, e cadono dove l\'eroe arriva', () => {
  const s = arena(7);
  for (let i = 0; i < 600; i++) { const z = zombie(s, 'fante', s.eroe.x - 3, s.eroe.z); uccidi(s, z); }
  const pw = s.drops.filter((d) => d.tipo !== 'scudo');
  assert.ok(pw.length >= 1 && pw.length <= TEMPLARI.poteri.maxOndata, `${pw.length} power-up`);
  // il boss: sempre
  const t = arena(8), n0 = t.drops.length;
  uccidi(t, zombie(t, 'cavaliere', t.eroe.x - 3, t.eroe.z));
  assert.equal(t.drops.length, n0 + 1);
  // ucciso fuori da una finestra: il power-up va dentro, dove si arriva
  const u = arena(9), f = u.arena.finestre[0]!;
  lasciaPotere(u, f.fuori.x, f.fuori.z, true);
  const dd = u.drops.at(-1)!;
  assert.ok(raggiungePunto(u, dd.x, dd.z));
});

function prendi(s: TState, tipo: 'faretra' | 'ira' | 'campane' | 'decima' | 'muratori') {
  s.drops.push({ id: s.nextId++, tipo, x: s.eroe.x, z: s.eroe.z, fine: s.tick + 600 });
  stepTemplari(s, F);
  assert.ok(!s.drops.some((d) => d.tipo === tipo), 'preso ' + tipo);
}

test('power-up: Faretra piena, Ira di Dio, Campane a martello, Decima, Muratori', () => {
  // faretra: munizioni piene
  const a = arena();
  daiArma(a, 'arco');
  const sl = a.eroe.armi.find((x) => x?.id === 'arco')!;
  sl.colpi = 0; sl.riserva = 0;
  prendi(a, 'faretra');
  assert.equal(sl.colpi, TEMPLARI.armi.find((x) => x.id === 'arco')!.colpi);
  // ira: un colpo da niente uccide (non i boss)
  const b = arena(1, 20);
  prendi(b, 'ira');
  const z = zombie(b, 'fante', b.eroe.x + 5, b.eroe.z), c = zombie(b, 'cavaliere', b.eroe.x - 5, b.eroe.z);
  assert.equal(colpisci(b, z, { danno: 1, mischia: true, caricato: false, dirX: 1, dirZ: 0, spinta: 0 }), 'ucciso');
  assert.equal(colpisci(b, c, { danno: 1, mischia: true, caricato: false, dirX: -1, dirZ: 0, spinta: 0 }), 'colpito');
  passi(b, 60 * TEMPLARI.poteri.durata + 2);
  const z2 = zombie(b, 'fante', b.eroe.x + 5, b.eroe.z);
  assert.equal(colpisci(b, z2, { danno: 1, mischia: true, caricato: false, dirX: 1, dirZ: 0, spinta: 0 }), 'colpito');
  // campane: muoiono tutti (non i boss), +400
  const k = arena();
  const tre = [zombie(k, 'fante', k.eroe.x + 4, k.eroe.z), zombie(k, 'pirata', k.eroe.x - 4, k.eroe.z), zombie(k, 'fante', k.eroe.x, k.eroe.z + 3)];
  const boss = zombie(k, 'cavaliere', k.eroe.x + 6, k.eroe.z + 2);
  const p0 = k.punti;
  prendi(k, 'campane');
  assert.ok(tre.every((x) => x.st === 'morto'));
  assert.notEqual(boss.st, 'morto');
  assert.equal(k.punti, p0 + TEMPLARI.poteri.campane);
  // decima: punti doppi per 30 s
  const d = arena();
  prendi(d, 'decima');
  const q0 = d.punti;
  dai(d, 10, 'colpo');
  assert.equal(d.punti, q0 + 20);
  // muratori: tutte le finestre rifatte, +200
  const m = arena();
  m.assi = m.assi.map(() => 0);
  const r0 = m.punti;
  prendi(m, 'muratori');
  assert.ok(m.assi.every((n) => n === TEMPLARI.barricate.assi));
  assert.equal(m.punti, r0 + TEMPLARI.poteri.muratori);
  assert.ok(nemicoDef('fante'));
});

test('cassa: comincia in chiesa e, a porte chiuse, si sposta solo dove l\'eroe arriva', () => {
  const s = arena(11);
  const p = () => s.arena.casse[s.cassa.posto]!;
  assert.ok(raggiungePunto(s, p().x, p().z));
  for (let i = 0; i < 20; i++) {
    s.cassa.fase = 'vola'; s.cassa.fine = s.tick;
    stepCassa(s);
    assert.ok(raggiungePunto(s, p().x, p().z), `posto ${s.cassa.posto}`);
  }
});
