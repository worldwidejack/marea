// Accendere l'isola e montare la campana (docs/TEMPLARI.md §9b): tre fuochi si accendono tenendo AZIONE (lasciare prima = si ricomincia);
// il coro accende il rogo, il cimitero sveglia la Strega, il falò dei pirati porta il Mercante; tutti e tre = punti e un power-up. La
// campana sta a terra finché la squadra non prende i suoi tre pezzi (posti diversi a seconda del seed) e la monta alla leva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { accendiTrappola, apriPorta } from '../src/templari/porte.ts';
import { postoPezzo } from '../src/templari/fuochi.ts';
import { replayTemplari } from '../src/templari/replay.ts';
import { packDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const passi = (s: TState, n: number, inp: Partial<DungeonInput> = {}) => { for (let i = 0; i < n && !s.done; i++) stepTemplari(s, { ...F, ...inp }); };
function partita(seed = 3): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = 5; s.quanti = 0; s.usciti = 0; s.prossima = 1e9; s.eroe.punti = 50000;
  s.eroe.vita = s.eroe.max = 1e6;
  return s;
}
/** L'eroe sulla cella libera accanto a (x, z). */
function accanto(s: TState, x: number, z: number) {
  const g = s.gr.eroe, cx = Math.floor(x), cz = Math.floor(z);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) if (!g.solid[(cz + dz) * g.w + cx + dx]) { s.eroe.x = cx + dx + 0.5; s.eroe.z = cz + dz + 0.5; return; }
  throw new Error(`niente di libero accanto a ${x},${z}`);
}
const fuoco = (s: TState, id: string) => s.arena.fuochi.find((f) => f.id === id)!;
const tick = (sec: number) => Math.round(sec * 60);

test('la mappa ha i tre fuochi e i tre pezzi della campana con più posti; i posti cambiano col seed', () => {
  const s = partita();
  assert.deepEqual(s.arena.fuochi.map((f) => f.id).sort(), Object.keys(TEMPLARI.fuochi.lista).sort());
  assert.deepEqual(s.arena.pezzi.map((p) => p.id).sort(), Object.keys(TEMPLARI.campana.pezzi).sort());
  for (const p of s.arena.pezzi) assert.ok(p.posti.length >= 2, p.id);
  const firme = new Set(Array.from({ length: 12 }, (_, k) => JSON.stringify(templari.create({ seed: k + 1, opzioni: { subito: true } }).pezzi)));
  assert.ok(firme.size >= 3, 'i pezzi stanno sempre negli stessi posti');
  assert.deepEqual(templari.create({ seed: 5 }).pezzi, templari.create({ seed: 5 }).pezzi, 'stesso seed, stessi posti');
});

test('fuoco: AZIONE tenuto 1,5 s lo accende; lasciare prima si ricomincia da capo', () => {
  const s = partita(), f = fuoco(s, 'coro');
  accanto(s, f.x, f.z);
  assert.equal(templari.view(s).prompt?.cosa, 'fuoco');
  passi(s, tick(1), { d: true }); passi(s, 2);
  passi(s, tick(1), { d: true });
  assert.equal(s.fuochi['coro'], false, 'acceso senza tenere fino in fondo');
  passi(s, tick(0.6), { d: true });
  assert.equal(s.fuochi['coro'], true);
  assert.equal(templari.view(s).prompt?.cosa === 'fuoco', false, 'il bottone chiede ancora di accenderlo');
});

test('il rogo funziona solo col fuoco del coro acceso', () => {
  const s = partita(), i = s.arena.trappole.findIndex((t) => t.id === 'rogo');
  assert.equal(accendiTrappola(s, i), false);
  s.fuochi['coro'] = true;
  assert.equal(accendiTrappola(s, i), true);
});

test('la Strega dorme e la nave è al largo finché il loro fuoco è spento', () => {
  const s = partita();
  const st = s.arena.personaggi.find((x) => x.id === 'strega')!;
  s.eroe.x = st.x - st.fx * 0.6; s.eroe.z = st.z - st.fz * 0.6;
  const p = templari.view(s).prompt;
  assert.ok(p?.cosa === 'strega' && !p.puoi && /dorme/.test(p.testo), JSON.stringify(p));
  assert.equal(templari.act(s, { t: 'compra', da: 'strega', cosa: 'pietra' }), null);
  // il fuoco del cimitero è lì accanto
  const f = fuoco(s, 'cimitero');
  accanto(s, f.x, f.z);
  passi(s, tick(1.6), { d: true });
  assert.equal(s.fuochi['cimitero'], true);
  s.eroe.x = st.x - st.fx * 0.6; s.eroe.z = st.z - st.fz * 0.6;
  assert.ok(templari.view(s).prompt?.puoi);
  assert.ok(templari.act(s, { t: 'compra', da: 'strega', cosa: 'pietra' }));
  const me = s.arena.personaggi.find((x) => x.id === 'mercante')!;
  s.eroe.x = me.x - me.fx * 0.6; s.eroe.z = me.z - me.fz * 0.6;
  assert.equal(templari.act(s, { t: 'compra', da: 'mercante', cosa: 'potenzia', slot: 0 }), null, 'il Mercante vende col falò spento');
});

test('tutti e tre i fuochi: punti e un power-up', () => {
  const s = partita();
  s.fuochi['coro'] = true; s.fuochi['cimitero'] = true;
  for (const q of s.arena.porte) apriPorta(s, q); // fino alla spiaggia (il power-up cade dove si arriva)
  const f = fuoco(s, 'spiaggia'), p0 = s.eroe.punti, d0 = s.drops.length;
  accanto(s, f.x, f.z);
  let tutti = false, potere = false;
  for (let k = 0; k < tick(1.6); k++) { passi(s, 1, { d: true }); tutti ||= s.eventi.some((e) => e.t === 'fuochiTutti'); potere ||= s.eventi.some((e) => e.t === 'potere' && !e.preso); }
  assert.ok(tutti && potere, JSON.stringify({ tutti, potere }));
  assert.ok(s.eroe.punti >= p0 + TEMPLARI.fuochi.tutti);
  assert.equal(s.drops.length, d0 + 1, 'il power-up non è rimasto a terra');
});

test('campana: a terra finché mancano pezzi; presi i tre pezzi si monta alla leva e la trappola funziona', () => {
  const s = partita(), i = s.arena.trappole.findIndex((t) => t.id === 'campana'), t = s.arena.trappole[i]!;
  assert.equal(accendiTrappola(s, i), false, 'la campana suona senza essere montata');
  accanto(s, t.leva.x, t.leva.z);
  let p = templari.view(s).prompt;
  assert.ok(p?.cosa === 'monta' && !p.puoi && /0\/3/.test(p.testo), JSON.stringify(p));
  const n = Object.keys(s.pezzi).length;
  let k = 0;
  for (const id of Object.keys(s.pezzi)) {
    const q = postoPezzo(s, id)!;
    s.eroe.x = q.x; s.eroe.z = q.z + 0.3;
    assert.equal(templari.view(s).prompt?.cosa, 'pezzo');
    passi(s, 1, { d: true });
    assert.ok(s.eventi.some((e) => e.t === 'pezzo' && e.id === id && e.presi === ++k && e.tutti === n));
    passi(s, 1);
  }
  assert.equal(templari.view(s).pezzi.filter((x) => !x.preso).length, 0);
  accanto(s, t.leva.x, t.leva.z);
  p = templari.view(s).prompt;
  assert.ok(p?.cosa === 'monta' && p.puoi, JSON.stringify(p));
  passi(s, tick(2.1), { d: true });
  assert.equal(s.campana, true);
  passi(s, 2);
  assert.equal(templari.view(s).prompt?.cosa, 'trappola');
  assert.equal(accendiTrappola(s, i), true);
});

test('il server rigioca fuochi e pezzi uguali', () => {
  const s = templari.create({ seed: 4, opzioni: { subito: true } });
  const f = fuoco(s, 'coro'), frames: DungeonInput[] = [];
  // dalla partenza al fuoco del coro: l'eroe ci cammina (sta a due passi) e tiene AZIONE
  for (let k = 0; k < 400 && !s.fuochi['coro']; k++) {
    const dx = f.x - s.eroe.x, dz = f.z - 0.9 - s.eroe.z, d = Math.sqrt(dx * dx + dz * dz);
    const inp: DungeonInput = d > 0.6 ? { ...F, mx: Math.round((dx / d) * 8) / 8, my: Math.round((dz / d) * 8) / 8 } : { ...F, d: true };
    frames.push(inp); stepTemplari(s, inp);
  }
  assert.equal(s.fuochi['coro'], true, 'il fuoco del coro non si è acceso');
  assert.equal(replayTemplari(4, { subito: true }, packDungeon(frames)).hash, templari.result(s).hash);
});
