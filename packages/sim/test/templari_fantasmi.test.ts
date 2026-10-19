// I fantasmi (docs/TEMPLARI.md §12b punto 5): un numero fisso dall'ondata 1 (3, 5 insieme), che non conta per finire l'ondata; girano a
// caso attraverso i muri senza attaccare; chi gli passa attraverso (o li colpisce) li fa arrabbiare e allora puntano lui, anche attraverso
// i muri, e colpiscono; si uccidono con qualsiasi arma e dopo 20 s ne torna un altro, lontano. La mira assistita non cerca quelli calmi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI } from '@marea/content/templari.ts';
import { stepTemplari, stepTemplariInsieme, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { colpisci, uccidi } from '../src/templari/colpi.ts';
import { miraTiro } from '../src/templari/eroe.ts';
import { C } from '../src/templari/mappa.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import type { TEventoDi } from '../src/templari/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const tick = (sec: number) => Math.round(sec * 60);
const DEF = TEMPLARI.nemici.find((n) => n.id === 'fantasma')!;
function passi(s: TState, n: number, inp: Partial<DungeonInput> = {}): TEventoDi[] {
  const out: TEventoDi[] = [];
  for (let i = 0; i < n && !s.done; i++) { stepTemplari(s, { ...F, ...inp }); out.push(...s.eventi); }
  return out;
}
/** Partita in un'ondata senza zombie (ne restano 0 da far uscire), eroe immortale. */
function partita(seed = 3, ondata = 5): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = ondata; s.quanti = 1e6; s.usciti = 0; s.prossima = 1e12; s.eroe.punti = 0;
  s.eroe.vita = s.eroe.max = 1e6;
  return s;
}
const fantasmi = (s: TState) => s.zombie.filter((z) => z.def.fantasma && z.st !== 'morto');

test('dall\'ondata 1 ce ne sono 3 (5 insieme), uno alla volta; prima no; non contano per finire l\'ondata', () => {
  const s0 = templari.create({ seed: 4 });
  passi(s0, tick(12));
  assert.equal(fantasmi(s0).length, 0, 'fantasmi prima dell\'ondata 1');
  const s = partita();
  passi(s, tick(2));
  assert.equal(fantasmi(s).length, 1, 'arrivano uno alla volta');
  passi(s, tick(10));
  assert.equal(fantasmi(s).length, DEF.fantasma!.quanti);
  passi(s, tick(30));
  assert.equal(fantasmi(s).length, DEF.fantasma!.quanti, 'il numero resta fisso');
  // l'ondata finisce anche coi fantasmi in giro
  s.quanti = 0; s.usciti = 0;
  const ev = passi(s, 2);
  assert.ok(ev.some((e) => e.t === 'ondataFinita'), 'l\'ondata non finisce coi fantasmi vivi');
  assert.equal(templari.view(s).restano, 0);
  const q = templari.create({ seed: 4, opzioni: { subito: true, eroi: 2 } });
  q.fase = 'combatti'; q.ondata = 3; q.quanti = 1e6; q.prossima = 1e12;
  for (const h of q.eroi) h.vita = h.max = 1e6;
  for (let i = 0; i < tick(20); i++) stepTemplariInsieme(q, [F, F]);
  assert.equal(fantasmi(q).length, DEF.fantasma!.squadra);
});

test('calmi girano a caso attraverso i muri e non attaccano', () => {
  const s = partita(7);
  // l'eroe lontano da tutti, in un angolo della chiesa
  passi(s, tick(12));
  let suMuri = 0, mosso = 0;
  const prima = new Map(fantasmi(s).map((z) => [z.id, [z.x, z.z]]));
  for (let k = 0; k < tick(60); k++) {
    // nessuno gli passa attraverso: l'eroe resta lontano da tutti
    for (const z of fantasmi(s)) if (Math.hypot(z.x - s.eroe.x, z.z - s.eroe.z) < 3) { z.x += 6; }
    passi(s, 1);
    for (const z of fantasmi(s)) { const c = s.arena.cell[Math.floor(z.z) * s.arena.w + Math.floor(z.x)]; if (c === C.muro || c === C.fuori || c === C.basso) suMuri++; }
  }
  for (const z of fantasmi(s)) { const p = prima.get(z.id); if (p && Math.hypot(z.x - p[0]!, z.z - p[1]!) > 3) mosso++; }
  assert.ok(suMuri > 0, 'nessun fantasma è passato attraverso un muro in un minuto');
  assert.ok(mosso >= 2, 'i fantasmi stanno fermi');
  assert.equal(s.eroe.vita, 1e6, 'un fantasma calmo ha attaccato');
  assert.ok(fantasmi(s).every((z) => !z.arrabbiato));
  assert.ok(fantasmi(s).every((z) => z.z < s.arena.sopra * s.arena.tile), 'un fantasma è finito sotto');
});

test('chi gli passa attraverso lo fa arrabbiare: ti punta attraverso i muri e colpisce; ucciso dà i punti e dopo 20 s ne torna un altro lontano', () => {
  const s = partita(5);
  passi(s, tick(2));
  const z = fantasmi(s)[0]!;
  // l'eroe gli passa attraverso (glielo mettiamo addosso, già comparso)
  z.st = 'insegue'; z.stT = 0; z.x = s.eroe.x; z.z = s.eroe.z;
  const e1 = passi(s, 1);
  assert.ok(e1.some((e) => e.t === 'fantasma' && e.fase === 'arrabbiato' && e.id === z.id));
  assert.ok(z.arrabbiato && z.preda === 0);
  // lontano, oltre un muro: arriva dritto e colpisce
  z.x = s.eroe.x; z.z = s.eroe.z - 9; z.st = 'insegue';
  const vita = s.eroe.vita;
  passi(s, tick(6));
  assert.ok(s.eroe.vita <= vita - DEF.danno, `non ha colpito: ${vita - s.eroe.vita}`);
  // ucciso: i punti dell'uccisione più i suoi, niente power-up
  const punti = s.eroe.punti;
  z.vita = 1;
  assert.equal(colpisci(s, z, { danno: 10, dirX: 0, dirZ: 1, spinta: 0, mischia: false, caricato: false }), 'ucciso');
  assert.equal(s.eroe.punti - punti, TEMPLARI.punti.uccisione + DEF.punti!);
  assert.equal(s.drops.length, 0, 'un fantasma ha lasciato un power-up');
  // dopo 20 s ne torna un altro, lontano dall'eroe
  passi(s, tick(15));
  const tutti = () => s.zombie.filter((x) => x.def.fantasma && x.st !== 'morto' && x.id !== z.id);
  const n15 = tutti().length;
  passi(s, tick(DEF.fantasma!.torna - 15 + 2));
  assert.ok(tutti().length >= n15, 'non è tornato');
  const nuovo = tutti().find((x) => x.id > z.id && x.stT < tick(3) + 200);
  assert.ok(nuovo, 'nessun fantasma nuovo');
  assert.ok(Math.hypot(nuovo.x - s.eroe.x, nuovo.z - s.eroe.z) >= DEF.fantasma!.lontano - 0.01 || nuovo.st !== 'sorge', 'è comparso addosso all\'eroe');
});

test('la mira assistita non cerca i fantasmi calmi; colpito senza morire si arrabbia', () => {
  const s = partita(9);
  passi(s, tick(2));
  for (const x of fantasmi(s).slice(1)) uccidi(s, x);
  const z = fantasmi(s)[0]!;
  z.st = 'insegue'; z.stT = 0;
  z.x = s.eroe.x + s.eroe.fx * 4; z.z = s.eroe.z + s.eroe.fz * 4; z.tx = z.x; z.tz = z.z;
  assert.equal(miraTiro(s, 20), null, 'la mira assistita punta un fantasma calmo');
  z.vita = z.max;
  colpisci(s, z, { danno: 1, dirX: 0, dirZ: 1, spinta: 0, mischia: false, caricato: false });
  assert.ok(z.arrabbiato, 'colpito non si arrabbia');
  assert.equal(miraTiro(s, 20), z);
});

test('dove girano non cambia il resto della partita: stesso seed, stesse comparse e stessa cassa', () => {
  const a = partita(11), b = partita(11);
  passi(a, tick(20)); passi(b, tick(20));
  assert.deepEqual(fantasmi(a).map((z) => [z.x, z.z]), fantasmi(b).map((z) => [z.x, z.z]));
  // il rng della partita è quello di prima: i fantasmi hanno il loro
  const c = partita(11);
  for (let i = 0; i < tick(20); i++) { c.ondata = 0; stepTemplari(c, F); c.ondata = 5; }
  assert.equal(a.rng.next(), c.rng.next(), 'i fantasmi hanno usato il rng della partita');
});
