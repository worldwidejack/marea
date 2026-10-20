// Mercante e Strega (docs/TEMPLARI.md §7b): si compra solo vicino a loro e coi punti; il potenziamento raddoppia il danno, allarga il
// caricatore e cambia il nome; le munizioni del Mercante valgono anche per le armi della cassa; le pozioni fanno quello che dicono, al
// massimo 4; l'Elisir ti rialza una volta e ti toglie le pozioni; gli acquisti sono azioni che il server rigioca uguali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI, armaDef } from '@marea/content/templari.ts';
import { stepTemplari, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { daiArma } from '../src/templari/eroe.ts';
import { ferisci } from '../src/templari/colpi.ts';
import { armaIn, nuovoZombie, slotDi } from '../src/templari/stato.ts';
import { offerteMercante, offerteStrega } from '../src/templari/bottega.ts';
import { parseTAzioni, replayTemplari } from '../src/templari/replay.ts';
import { encodeDungeon, packDungeon } from '../src/dungeon/replay.ts';
import type { TAzione, TAzioni } from '../src/templari/types.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import { FERMO, passi } from './templari_util.ts';

function partita(punti = 50000): TState {
  const s = templari.create({ seed: 3, opzioni: { subito: true } });
  for (const k in s.fuochi) s.fuochi[k] = true; // i fuochi accesi (§9b): Strega, Mercante e rogo funzionano
  s.fase = 'combatti'; s.ondata = 8; s.quanti = 0; s.usciti = 0; s.prossima = 1e9;
  s.eroe.punti = punti;
  return s;
}
/** L'eroe davanti al Mercante o alla Strega (le porte per arrivarci non contano: si sposta). */
function da(s: TState, chi: 'mercante' | 'strega') {
  const p = s.arena.personaggi.find((x) => x.id === chi)!;
  s.eroe.x = p.x - p.fx * 0.6; s.eroe.z = p.z - p.fz * 0.6;
}
const mercante = (cosa: 'potenzia' | 'munizioni', slot = 0): TAzione => ({ t: 'compra', da: 'mercante', cosa, slot });
const strega = (cosa: 'pietra' | 'viandante' | 'lesto' | 'bombardiere' | 'risorto' | 'fonte'): TAzione => ({ t: 'compra', da: 'strega', cosa });

test('i posti: Strega in cima al cimitero, Mercante sulla riva della spiaggia, tutti e due fuori dal campo', () => {
  const s = partita(), a = s.arena;
  const st = a.personaggi.find((x) => x.id === 'strega')!, me = a.personaggi.find((x) => x.id === 'mercante')!;
  assert.ok(st.z < 5 && st.fz === -1, JSON.stringify(st));
  assert.ok(me.z > 70 && me.fz === 1, JSON.stringify(me));
  assert.equal(templari.view(s).prompt?.cosa ?? null, null);
  da(s, 'strega');
  assert.equal(templari.view(s).prompt?.cosa, 'strega');
  da(s, 'mercante');
  assert.equal(templari.view(s).prompt?.cosa, 'mercante');
});

test('Mercante: lontano non vende; potenzia l\'arma (5000), danno ×2, caricatore più grande, nome nuovo, una volta sola', () => {
  const s = partita();
  daiArma(s, 'moschetto');
  const slot = s.eroe.cur, prima = armaIn(s).danno;
  assert.equal(templari.act(s, mercante('potenzia', slot)), null, 'venduto da lontano');
  da(s, 'mercante');
  const ev = templari.act(s, mercante('potenzia', slot));
  assert.ok(ev?.some((e) => e.t === 'potenziata' && e.nome === armaDef('moschetto').nomePot), JSON.stringify(ev));
  assert.equal(s.eroe.punti, 50000 - 5000);
  assert.equal(armaIn(s).danno, prima * 2);
  assert.equal(s.eroe.armi[slot]!.riserva, slotDi(armaDef('moschetto'), true).riserva);
  assert.ok(s.eroe.armi[slot]!.riserva > armaDef('moschetto').riserva!);
  assert.equal(templari.view(s).eroe.armi[slot]!.pot, true);
  assert.equal(templari.act(s, mercante('potenzia', slot)), null, 'potenziata due volte');
  assert.equal(s.eroe.punti, 45000);
  // senza punti niente
  const p = partita(4999); da(p, 'mercante');
  assert.equal(templari.act(p, mercante('potenzia', 0)), null);
});

test('Mercante: munizioni anche per le armi della cassa (750), per le potenziate il doppio; il muro ricarica la potenziata al suo prezzo', () => {
  const s = partita();
  da(s, 'mercante');
  daiArma(s, 'arco_lungo');
  const sl = s.eroe.armi[s.eroe.cur]!;
  sl.colpi = 0; sl.riserva = 0;
  const o = offerteMercante(s).find((x) => x.cosa === 'munizioni' && x.slot === s.eroe.cur)!;
  assert.equal(o.prezzo, 750);
  assert.ok(templari.act(s, mercante('munizioni', s.eroe.cur)));
  assert.equal(sl.colpi === 0 ? s.eroe.armi[s.eroe.cur]!.riserva : s.eroe.armi[s.eroe.cur]!.riserva, armaDef('arco_lungo').riserva);
  // piene: non si comprano
  assert.equal(offerteMercante(s).find((x) => x.cosa === 'munizioni' && x.slot === s.eroe.cur)!.puoi, false);
  templari.act(s, mercante('potenzia', s.eroe.cur));
  s.eroe.armi[s.eroe.cur]!.riserva = 0;
  assert.equal(offerteMercante(s).find((x) => x.cosa === 'munizioni' && x.slot === s.eroe.cur)!.prezzo, 1500);
  // la spada non ha munizioni
  assert.ok(!offerteMercante(s).some((x) => x.cosa === 'munizioni' && s.eroe.armi[x.slot]?.id === 'spada'));
  // ricomprare dal muro un'arma potenziata la lascia potenziata
  daiArma(s, 'moschetto'); const i = s.eroe.armi.findIndex((x) => x?.id === 'moschetto');
  s.eroe.armi[i] = { ...slotDi(armaDef('moschetto'), true), riserva: 0 };
  daiArma(s, 'moschetto');
  assert.equal(s.eroe.armi[i]!.pot, true);
  assert.equal(s.eroe.armi[i]!.riserva, slotDi(armaDef('moschetto'), true).riserva);
});

test('Strega: la Zuppa di pietra porta la vita a 200, si beve (niente attacchi per un attimo), una volta sola', () => {
  const s = partita();
  da(s, 'strega');
  const ev = templari.act(s, strega('pietra'));
  assert.ok(ev?.some((e) => e.t === 'pozione' && e.id === 'pietra'));
  assert.equal(s.eroe.max, 200); assert.equal(s.eroe.vita, 200);
  assert.equal(s.eroe.punti, 50000 - 2500);
  assert.equal(templari.view(s).posa.anim, 'beve');
  passi(s, 2, { a: true }); passi(s, 1);
  assert.equal(s.eroe.act, 'beve', 'ha attaccato mentre beveva');
  passi(s, Math.round(TEMPLARI.strega.beve * 60));
  assert.equal(s.eroe.act, 'idle');
  assert.equal(templari.act(s, strega('pietra')), null);
  // regge 4 colpi del fante, al quinto cade
  const fante = TEMPLARI.nemici.find((n) => n.id === 'fante')!.danno;
  for (let i = 0; i < 4; i++) ferisci(s, fante, s.eroe.x + 1, s.eroe.z);
  assert.equal(s.done, false);
  ferisci(s, fante, s.eroe.x + 1, s.eroe.z);
  assert.equal(s.done, true);
});

test('Strega: al massimo 4 pozioni; il menù dice perché no', () => {
  const s = partita();
  da(s, 'strega');
  for (const p of ['viandante', 'lesto', 'bombardiere', 'fonte'] as const) assert.ok(templari.act(s, strega(p)), p);
  assert.equal(templari.act(s, strega('pietra')), null);
  const o = offerteStrega(s);
  assert.equal(o.find((x) => x.cosa === 'pietra')!.descr, 'Ne hai già 4');
  assert.equal(o.find((x) => x.cosa === 'lesto')!.descr, 'Già bevuta');
});

test('pozioni: Infuso lesto ricarica prima, Brodo del viandante corre di più, Grappa fa più danno, Acqua santa rigenera prima', () => {
  const base = partita(), conP = partita();
  da(conP, 'strega');
  for (const p of ['lesto', 'viandante', 'bombardiere', 'fonte'] as const) templari.act(conP, strega(p));
  passi(conP, 80);
  for (const s of [base, conP]) { daiArma(s, 'moschetto'); s.eroe.x = 46.5; s.eroe.z = 42.5; }
  assert.ok(armaIn(conP).ricarica! < armaIn(base).ricarica! * 0.65);
  assert.ok(Math.abs(armaIn(conP).danno - armaIn(base).danno * 1.3) < 1e-6);
  assert.ok(armaIn(conP).tempo < armaIn(base).tempo);
  // corsa: 40 tick col joystick in fondo
  for (const s of [base, conP]) { s.eroe.x = 46.5; s.eroe.z = 42.5; }
  passi(base, 40, { my: -1 }); passi(conP, 40, { my: -1 });
  assert.ok((42.5 - conP.eroe.z) > (42.5 - base.eroe.z) * 1.15, `${42.5 - conP.eroe.z} contro ${42.5 - base.eroe.z}`);
  // rigenerazione: dopo 2 s senza colpi l'acqua santa ha già ridato vita, senza no
  for (const s of [base, conP]) { s.eroe.vita = 50; s.eroe.quiete = 0; }
  passi(base, 120); passi(conP, 120);
  assert.equal(base.eroe.vita, 50);
  assert.ok(conP.eroe.vita > 60);
});

test('Elisir del risorto: cadi, ti rialzi con la vita piena e senza pozioni, intoccabile per un po\'; al massimo 3 per partita', () => {
  const s = partita();
  da(s, 'strega');
  templari.act(s, strega('pietra')); templari.act(s, strega('risorto'));
  passi(s, 80);
  const z = nuovoZombie(s, 'fante', s.eroe.x + 1.2, s.eroe.z, 1); z.st = 'insegue';
  ferisci(s, 1e6, z.x, z.z);
  assert.equal(s.done, false);
  assert.deepEqual(s.eroe.pozioni, []);
  assert.equal(s.eroe.max, TEMPLARI.eroe.vita); assert.equal(s.eroe.vita, TEMPLARI.eroe.vita);
  assert.ok(Math.sqrt((z.x - s.eroe.x) ** 2 + (z.z - s.eroe.z) ** 2) >= 2.9, 'lo zombie non è stato spinto via');
  ferisci(s, 1e6, z.x, z.z);
  assert.equal(s.done, false, 'intoccabile appena rialzato');
  passi(s, Math.round(3 * 60) + 2);
  for (let i = 0; i < 2; i++) { da(s, 'strega'); assert.ok(templari.act(s, strega('risorto')), `elisir ${i + 2}`); s.eroe.pozioni = []; }
  assert.equal(templari.act(s, strega('risorto')), null, 'quarto elisir');
  assert.equal(offerteStrega(s).find((x) => x.cosa === 'risorto')!.descr, 'Finita per questa partita');
});

test('acquisti in replay: il server li rigioca uguali; le azioni sbagliate non passano', () => {
  // una partita vera: l'eroe sta fermo, si compra la Zuppa con le porte chiuse (non si arriva: niente) e poi si esce
  const s = templari.create({ seed: 9, opzioni: { subito: true } });
  const frames: DungeonInput[] = [], azioni: TAzioni = [];
  for (let i = 0; i < 300; i++) {
    if (i === 100) { const a: TAzione = strega('pietra'); azioni.push([s.tick, a]); templari.act(s, a); }
    frames.push(FERMO); stepTemplari(s, FERMO);
  }
  azioni.push([s.tick, { t: 'esci' }]); templari.act(s, { t: 'esci' });
  const r = replayTemplari(9, { subito: true }, packDungeon(frames), parseTAzioni(JSON.parse(JSON.stringify(azioni)))!);
  assert.equal(r.hash, templari.result(s).hash);
  assert.ok(encodeDungeon(packDungeon(frames)).length > 0);
  assert.deepEqual(parseTAzioni([[5, { t: 'compra', da: 'strega', cosa: 'pietra' }], [9, { t: 'compra', da: 'mercante', cosa: 'potenzia', slot: 1 }]]), [[5, { t: 'compra', da: 'strega', cosa: 'pietra' }], [9, { t: 'compra', da: 'mercante', cosa: 'potenzia', slot: 1 }]]);
  assert.equal(parseTAzioni([[5, { t: 'compra', da: 'strega', cosa: 'caffè' }]]), null);
  assert.equal(parseTAzioni([[5, { t: 'compra', da: 'mercante', cosa: 'potenzia', slot: 7 }]]), null);
});
