// Le catacombe (docs/TEMPLARI.md §12b punto 3): sotto la cripta un piano di tunnel staccato da tutto, con tre scale verso il sopra — il muro
// rotto della rotonda (la cripta), la grata dell'ossario e la grata della grotta dell'accampamento (1250 l'una, si comprano da sopra o da
// sotto). Eroi e zombie passano dalle scale aperte; le comparse delle nicchie si accendono col muro rotto o con una grata; le anime per la
// Lancia contano solo nella sala della cripta; la grotta è una scorciatoia per il Mercante. Tutto deterministico: il server rigioca uguale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { apriPorta, portaVicina, zonaAperta } from '../src/templari/porte.ts';
import { uccidi } from '../src/templari/colpi.ts';
import { nuovoZombie } from '../src/templari/stato.ts';
import { inCripta, inSala, rompiMuro } from '../src/templari/segreti.ts';
import { raggiungibili } from '../src/templari/raggiungi.ts';
import { cellOf } from '../src/dungeon/map.ts';
import { TIPO } from '../src/templari/mappa.ts';
import type { Capo, Passaggio } from '../src/templari/mappa.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number, inp: Partial<DungeonInput> = {}) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, { ...F, ...inp }); };
function partita(seed = 3): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = 5; s.quanti = 0; s.usciti = 0; s.prossima = 1e9; s.eroe.punti = 50000;
  s.eroe.vita = s.eroe.max = 1e6;
  return s;
}
const pas = (s: TState, id: string): Passaggio => s.arena.passaggi.find((p) => p.id === id)!;
const porta = (s: TState, id: string) => s.arena.porte.find((p) => p.id === id)!;
/** L'eroe sulla cella davanti a un capo, girato verso il capo. */
function davanti(s: TState, c: Capo): void { s.eroe.x = c.davanti.x; s.eroe.z = c.davanti.z; s.eroe.fx = -c.davanti.fx; s.eroe.fz = -c.davanti.fz; }
/** Passi dall'eroe a ogni cella, passando dalle scale aperte (come gli zombie: flow field). */
function passiFino(s: TState, x: number, z: number): number {
  const d = raggiungibili(s), i = cellOf(s.gr.eroe, x, z);
  return d[i] ?? -1;
}

test('la mappa: tre scale (cripta, ossario, grotta), il sotto staccato dal sopra, la fucina nella sua sala, grate da 1250', () => {
  const s = partita(), a = s.arena;
  assert.deepEqual(a.passaggi.map((p) => p.id).sort(), ['cripta', 'grata_grotta', 'grata_ossario']);
  for (const p of a.passaggi) {
    assert.ok(p.a.z < a.sopra && p.b.z >= a.sopra, `${p.id}: un capo sopra e uno sotto`);
    assert.ok(inCripta(s, p.b.davanti.x, p.b.davanti.z), `${p.id}: il capo di sotto dà sulle catacombe`);
    assert.ok(!inCripta(s, p.a.davanti.x, p.a.davanti.z), `${p.id}: il capo di sopra dà sul sopra`);
  }
  for (const id of ['grata_ossario', 'grata_grotta']) {
    assert.equal(TEMPLARI.porte[id]!.prezzo, 1250);
    assert.equal(TEMPLARI.porte[id]!.zona, 'cripta');
    for (const c of porta(s, id).celle) assert.equal(a.tipo[c], TIPO.grata);
  }
  assert.ok(a.fucina && inCripta(s, a.fucina.x, a.fucina.z + 1) && !inSala(s, a.fucina.x, a.fucina.z + 1), 'la fucina sta nelle catacombe, fuori dalla sala della cripta');
  // nella sala della cripta ci sono l'altare e i sarcofagi; le comparse delle catacombe sono nelle catacombe
  const cr = a.cripta!;
  assert.ok(inSala(s, cr.altare.x + 1, cr.altare.z) && inSala(s, cr.giu.x, cr.giu.z));
  const sotto = a.comparse.filter((c) => c.zona === 'cripta');
  assert.ok(sotto.length >= 12 && sotto.every((c) => inCripta(s, c.x, c.z)), `comparse di sotto: ${sotto.length}`);
  assert.ok(sotto.filter((c) => !inSala(s, c.x, c.z)).length >= 6, 'comparse nelle nicchie dei tunnel');
  // senza muro né grate il sotto non si raggiunge, nemmeno con tutte le altre porte aperte
  for (const q of a.porte) if (!q.id.startsWith('grata')) apriPorta(s, q);
  assert.equal(passiFino(s, cr.giu.x, cr.giu.z), -1);
  assert.equal(zonaAperta(s, 'cripta'), false);
});

test('la grata della grotta: si compra da sopra, si scende nelle catacombe e si risale; zona accesa senza rompere il muro', () => {
  const s = partita(), p = pas(s, 'grata_grotta');
  for (const q of s.arena.porte) if (!q.id.startsWith('grata')) apriPorta(s, q);
  davanti(s, p.a);
  assert.equal(portaVicina(s)?.id, 'grata_grotta', 'la grata non si vede da davanti');
  const p0 = s.eroe.punti;
  passi(s, 1, { d: true }); passi(s, 2);
  assert.equal(s.porte['grata_grotta'], true, 'la grata non si apre');
  assert.equal(p0 - s.eroe.punti, 1250);
  assert.equal(zonaAperta(s, 'cripta'), true, 'col sotto aperto escono gli zombie delle nicchie');
  assert.equal(s.segreti.muro, false);
  // un passo sulla grata: giù
  s.eroe.x = p.a.x; s.eroe.z = p.a.z; passi(s, 2);
  assert.ok(inCripta(s, s.eroe.x, s.eroe.z), `non è sceso: ${s.eroe.x},${s.eroe.z}`);
  // e su dall'altro capo
  s.eroe.x = p.b.x; s.eroe.z = p.b.z; passi(s, 2);
  assert.ok(!inCripta(s, s.eroe.x, s.eroe.z) && Math.abs(s.eroe.x - p.a.davanti.x) < 1.5 && Math.abs(s.eroe.z - p.a.davanti.z) < 1.5, `non è risalito: ${s.eroe.x},${s.eroe.z}`);
});

test('la grata dell\'ossario si compra anche da sotto', () => {
  const s = partita(), p = pas(s, 'grata_ossario');
  rompiMuro(s);
  davanti(s, p.b);
  assert.equal(portaVicina(s)?.id, 'grata_ossario');
  passi(s, 1, { d: true }); passi(s, 2);
  assert.equal(s.porte['grata_ossario'], true);
  s.eroe.x = p.b.x; s.eroe.z = p.b.z; passi(s, 2);
  assert.ok(!inCripta(s, s.eroe.x, s.eroe.z), 'non è salito all\'ossario');
  assert.ok(Math.abs(s.eroe.z - p.a.davanti.z) < 1.5, `è salito in ${s.eroe.x},${s.eroe.z}`);
});

test('gli zombie seguono l\'eroe dalle grate: dal sopra giù nelle catacombe e su dall\'altra grata', () => {
  const s = partita(), g = pas(s, 'grata_grotta'), o = pas(s, 'grata_ossario');
  for (const q of s.arena.porte) apriPorta(s, q);
  // l'eroe sotto, davanti alla salita dell'ossario; uno zombie sopra, davanti alla grata della grotta: scende dalla grotta e lo raggiunge
  davanti(s, o.b);
  const z = nuovoZombie(s, 'fante', g.a.davanti.x, g.a.davanti.z, 3); z.st = 'insegue'; z.cd = 1e9;
  let giu = false;
  for (let k = 0; k < 60 * 40 && !giu; k++) { passi(s, 1); giu = inCripta(s, z.x, z.z); }
  assert.ok(giu, `lo zombie non scende: ${z.x},${z.z}`);
  // l'eroe risale dall'ossario: lo zombie torna su
  s.eroe.x = o.a.davanti.x; s.eroe.z = o.a.davanti.z;
  let su = false;
  for (let k = 0; k < 60 * 40 && !su; k++) { passi(s, 1); su = !inCripta(s, z.x, z.z); }
  assert.ok(su, `lo zombie non risale: ${z.x},${z.z}`);
});

test('le anime per la Lancia contano solo nella sala della cripta, non nei tunnel', () => {
  const s = partita(), cr = s.arena.cripta!, f = s.arena.fucina!;
  rompiMuro(s);
  const z1 = nuovoZombie(s, 'fante', f.x, f.z + 2, 0);
  uccidi(s, z1);
  assert.equal(s.segreti.anime, 0, 'un morto nei tunnel ha dato un\'anima');
  const z2 = nuovoZombie(s, 'fante', cr.altare.x + 3, cr.altare.z, 0);
  uccidi(s, z2);
  assert.equal(s.segreti.anime, 1);
});

test('la grotta è una scorciatoia: dalla chiesa al Mercante si fa meno strada passando sotto', () => {
  const sopra = partita(), sotto = partita();
  for (const q of sopra.arena.porte) if (!q.id.startsWith('grata')) apriPorta(sopra, q);
  apriPorta(sotto, porta(sotto, 'grata_grotta')); rompiMuro(sotto);
  const me = sopra.arena.personaggi.find((x) => x.id === 'mercante')!, x = me.x - me.fx, z = me.z - me.fz;
  const d1 = passiFino(sopra, x, z);
  // dalla partenza al muro, giù, per i tunnel, su dalla grotta (raggiungibili conta i passi di ogni tratto, ognuno dalla sua partenza):
  // qui conta che ci si arrivi; quanto si risparmia lo misura il flow field degli zombie
  assert.ok(d1 > 0 && passiFino(sotto, x, z) >= 0, 'con muro e grata il Mercante si raggiunge da sotto');
  const s = sotto, h = s.arena.spawn;
  s.eroe.x = x; s.eroe.z = z; passi(s, 1);
  const flow = s.flow[cellOf(s.gr.percorso, h.x, h.z)]!;
  console.log(`dalla chiesa al Mercante: ${flow} passi da sotto, ${d1} da sopra`);
  assert.ok(flow > 0 && flow < d1 - 5, `dalla chiesa al Mercante: ${flow} passi da sotto, ${d1} da sopra`);
});
