// I segreti dell'isola (docs/TEMPLARI.md §9c): il muro crepato si rompe solo con un colpo pesante e porta nella cripta (eroi e zombie
// scendono e salgono dalla scala); 5 zombie uccisi lì dentro liberano la Lancia di Longino sull'altare (affondo in fila, cura, caricata ti
// porta avanti); le campanelle nell'ordine del muro (cambia col seed) danno una pozione a testa, una volta; i tre teschi fanno partire la
// canzone. Tutto deterministico: il server rigioca uguale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLARI } from '@marea/content/templari.ts';
import { stepTemplari, stepTemplariInsieme, templari } from '../src/templari/templari.ts';
import type { TState } from '../src/templari/templari.ts';
import { apriPorta } from '../src/templari/porte.ts';
import { esplodi, ferisci, uccidi } from '../src/templari/colpi.ts';
import { daiArma } from '../src/templari/eroe.ts';
import { nuovoZombie, usa } from '../src/templari/stato.ts';
import { inCripta, rompiMuro, suonaCampanella } from '../src/templari/segreti.ts';
import { raggiungibili } from '../src/templari/raggiungi.ts';
import { replayTemplari } from '../src/templari/replay.ts';
import { bfs, cellOf, stepDown } from '../src/dungeon/map.ts';
import { packDungeon } from '../src/dungeon/replay.ts';
import type { DungeonInput } from '../src/dungeon/types.ts';
import type { TEventoDi } from '../src/templari/types.ts';

const F: DungeonInput = { mx: 0, my: 0, a: false, b: false, c: false, d: false };
const tick = (sec: number) => Math.round(sec * 60);
/** Passi con lo stesso input; ritorna gli eventi di tutti i passi. */
function passi(s: TState, n: number, inp: Partial<DungeonInput> = {}): TEventoDi[] {
  const out: TEventoDi[] = [];
  for (let i = 0; i < n && !s.done; i++) { stepTemplari(s, { ...F, ...inp }); out.push(...s.eventi); }
  return out;
}
function partita(seed = 3): TState {
  const s = templari.create({ seed, opzioni: { subito: true } });
  s.fase = 'combatti'; s.ondata = 5; s.quanti = 0; s.usciti = 0; s.prossima = 1e9; s.eroe.punti = 50000;
  s.eroe.vita = s.eroe.max = 1e6;
  return s;
}
const cr = (s: TState) => s.arena.cripta!;
/** Davanti al muro crepato, girato verso di lui. */
function alMuro(s: TState): void { const c = cr(s); s.eroe.x = c.su.x; s.eroe.z = c.su.z; s.eroe.fx = -c.su.fx; s.eroe.fz = -c.su.fz; }
/** Un colpo in mischia: un tocco, o tenuto fino al colpo caricato. */
function colpo(s: TState, caricato: boolean): TEventoDi[] {
  const out = passi(s, caricato ? tick(1.4) : 1, { a: true });
  out.push(...passi(s, tick(1.2)));
  return out;
}
/** L'eroe sulla cella libera accanto a (x, z). */
function accanto(s: TState, x: number, z: number) {
  const g = s.gr.eroe, cx = Math.floor(x), cz = Math.floor(z);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) if (!g.solid[(cz + dz) * g.w + cx + dx]) { s.eroe.x = cx + dx + 0.5; s.eroe.z = cz + dz + 0.5; return; }
  throw new Error(`niente di libero accanto a ${x},${z}`);
}

test('la mappa: la cripta staccata da tutto finché il muro regge, quattro campanelle, tre teschi; l\'ordine cambia col seed', () => {
  const s = partita();
  for (const q of s.arena.porte) if (!q.id.startsWith('grata')) apriPorta(s, q); // le grate delle catacombe (§12b) portano sotto anche loro
  const c = cr(s), d = raggiungibili(s);
  assert.equal(d[cellOf(s.gr.eroe, c.giu.x, c.giu.z)], -1, 'nella cripta si arriva senza rompere il muro');
  assert.ok(d[cellOf(s.gr.eroe, c.su.x, c.su.z)]! >= 0, 'il muro non si raggiunge dalla chiesa');
  assert.ok(s.arena.comparse.filter((x) => x.zona === 'cripta').every((x) => inCripta(s, x.x, x.z)), 'comparse della cripta fuori dalla cripta');
  assert.ok(inCripta(s, c.altare.x + 1, c.altare.z) && !inCripta(s, c.su.x, c.su.z));
  assert.deepEqual(s.arena.campanelle.map((x) => x.id).sort(), Object.keys(TEMPLARI.campanelle.lista).sort());
  assert.equal(s.arena.teschi.length, 3);
  assert.ok(s.arena.indizio, 'manca il muro con l\'ordine');
  const ordini = new Set(Array.from({ length: 12 }, (_, k) => templari.create({ seed: k + 1 }).segreti.ordine.join()));
  assert.ok(ordini.size >= 4, 'l\'ordine delle campanelle è quasi sempre lo stesso');
  assert.deepEqual(templari.create({ seed: 9 }).segreti.ordine, templari.create({ seed: 9 }).segreti.ordine);
  assert.equal(templari.view(s).segreti.ordine.length, 4);
});

test('il muro crepato: un colpo normale fa solo polvere, il colpo caricato lo rompe', () => {
  const s = partita();
  alMuro(s);
  const ev = colpo(s, false);
  assert.ok(ev.some((e) => e.t === 'cripta' && e.fase === 'polvere'), 'niente polvere');
  assert.equal(s.segreti.muro, false, 'rotto con un colpo normale');
  alMuro(s);
  const ev2 = colpo(s, true);
  assert.ok(ev2.some((e) => e.t === 'cripta' && e.fase === 'muro'), 'il colpo caricato non lo rompe');
  assert.equal(s.gr.eroe.solid[cr(s).muro.cella], 0);
});

test('il muro crepato: un\'esplosione lì accanto lo rompe (fuoco greco, bombe, Bordata)', () => {
  const s = partita(), c = cr(s);
  esplodi(s, c.su.x + 1, c.su.z, 3, 100);
  assert.equal(s.segreti.muro, true);
});

test('la scala: si scende nella cripta entrando nel muro rotto e si torna su dalla scala in fondo', () => {
  const s = partita(), c = cr(s);
  rompiMuro(s); alMuro(s);
  const ev = passi(s, tick(1), { mx: -c.su.fx, my: -c.su.fz });
  assert.ok(ev.some((e) => e.t === 'scala' && e.giu === true), 'non è sceso');
  assert.ok(inCripta(s, s.eroe.x, s.eroe.z), 'non è nella cripta');
  assert.equal(templari.view(s).segreti.dentro, true);
  s.eroe.x = c.giu.x; s.eroe.z = c.giu.z;
  const su = passi(s, tick(1), { mx: -c.giu.fx, my: -c.giu.fz });
  assert.ok(su.some((e) => e.t === 'scala' && e.giu === false), 'non è salito');
  assert.ok(!inCripta(s, s.eroe.x, s.eroe.z));
});

test('gli zombie seguono l\'eroe giù dalla scala, e dai sarcofagi ne escono di nuovi', () => {
  const s = partita(), c = cr(s);
  rompiMuro(s);
  s.eroe.x = c.giu.x - 4; s.eroe.z = c.giu.z;
  const z = nuovoZombie(s, 'fante', c.su.x + 1, c.su.z, 2.2); z.st = 'insegue';
  let sceso = false;
  for (let k = 0; k < tick(8) && !sceso; k++) { passi(s, 1); sceso = inCripta(s, z.x, z.z); }
  assert.ok(sceso, 'lo zombie non è sceso nella cripta');
  // l'ondata: con l'eroe nella cripta gli zombie escono dai sarcofagi
  s.quanti = 3; s.usciti = 0; s.prossima = s.tick;
  passi(s, tick(6));
  const nuovi = s.zombie.filter((x) => x !== z && !x.def.fantasma); // i fantasmi (§12b punto 5) girano sopra per conto loro
  assert.ok(nuovi.length >= 2 && nuovi.every((x) => inCripta(s, x.x, x.z)), JSON.stringify(nuovi.map((x) => [x.x, x.z])));
});

test('le anime: 5 zombie uccisi nella cripta liberano la Lancia (quelli di fuori non contano); AZIONE la prende', () => {
  const s = partita(), c = cr(s);
  rompiMuro(s);
  s.eroe.x = c.altare.x + 1.2; s.eroe.z = c.altare.z;
  let p = templari.view(s).prompt;
  assert.ok(p?.cosa === 'lancia' && !p.puoi && /0\/5/.test(p.testo), JSON.stringify(p));
  uccidi(s, nuovoZombie(s, 'fante', c.su.x + 1, c.su.z, 0));
  assert.equal(s.segreti.anime, 0, 'conta uno zombie morto in chiesa');
  for (let k = 0; k < TEMPLARI.cripta.anime; k++) {
    s.eventi = [];
    uccidi(s, nuovoZombie(s, 'fante', c.giu.x - 2 - k, c.giu.z, 0));
    assert.ok(s.eventi.some((e) => e.t === 'anima' && e.n === k + 1));
  }
  assert.ok(s.eventi.some((e) => e.t === 'cripta' && e.fase === 'libera'));
  p = templari.view(s).prompt;
  assert.ok(p?.cosa === 'lancia' && p.puoi, JSON.stringify(p));
  const ev = passi(s, 1, { d: true });
  assert.ok(ev.some((e) => e.t === 'cripta' && e.fase === 'presa'));
  assert.equal(templari.view(s).eroe.arma, 'lancia');
  passi(s, 1);
  assert.notEqual(templari.view(s).prompt?.cosa, 'lancia', 'l\'altare offre ancora la Lancia a chi ce l\'ha');
  uccidi(s, nuovoZombie(s, 'fante', c.giu.x - 3, c.giu.z, 0));
  assert.equal(s.segreti.anime, TEMPLARI.cripta.anime, 'le anime contano ancora dopo');
});

test('la Lancia: un affondo prende tutti quelli in fila (0,8 × la vita: al secondo muoiono), ogni uccisione ridà vita; caricata ti porta avanti', () => {
  const s = partita(), h = s.eroe;
  daiArma(s, 'lancia');
  h.x = 46.5; h.z = 38.5; h.fx = 1; h.fz = 0; h.max = 100; h.vita = 40; h.quiete = 0;
  for (const dx of [1.1, 2.1, 3.2]) { const z = nuovoZombie(s, 'fante', h.x + dx, h.z, 0); z.st = 'insegue'; }
  h.intoccabile = s.tick + tick(5); // tra i due affondi il primo della fila colpisce: qui si guarda solo la vita che torna
  const primo = colpo(s, false);
  assert.equal(primo.filter((e) => e.t === 'colpo').length, 3, 'l\'affondo non trapassa la fila');
  assert.equal(primo.filter((e) => e.t === 'morte').length, 0, 'un affondo solo basta (§12b: 0,8 × la vita dell\'ondata)');
  const ev = colpo(s, false);
  assert.equal(ev.filter((e) => e.t === 'morte').length, 3, 'al secondo affondo non muoiono tutti');
  assert.equal(Math.round(h.vita), 40 + 3 * (TEMPLARI.armi.find((a) => a.id === 'lancia')!.cura ?? 0));
  const x0 = h.x;
  colpo(s, true);
  assert.ok(h.x - x0 > 2, `l'affondo caricato ha portato avanti di ${h.x - x0}`);
});

test('le campanelle: sbagliata = si ricomincia; nell\'ordine del muro = una pozione nuova anche con 4 già bevute; una volta sola', () => {
  const s = partita(), o = s.segreti.ordine;
  for (const q of s.arena.porte) apriPorta(s, q);
  s.eroe.pozioni = ['pietra', 'viandante', 'lesto', 'bombardiere'];
  const suona = (id: string) => { const c = s.arena.campanelle.find((x) => x.id === id)!; accanto(s, c.x, c.z); assert.equal(templari.view(s).prompt?.cosa, 'campanella', id); const ev = passi(s, 1, { d: true }); passi(s, tick(1.3)); return ev; };
  suona(o[0]!); suona(o[1]!);
  assert.equal(s.segreti.giuste, 2);
  const sb = suona(o[3]!);
  assert.ok(sb.some((e) => e.t === 'campanella' && !e.giusta && e.n === 0));
  assert.equal(s.segreti.giuste, 0);
  let ultima: TEventoDi[] = [];
  for (const id of o) ultima = suona(id);
  assert.ok(ultima.some((e) => e.t === 'campaneGiuste'));
  assert.equal(s.eroe.pozioni.length, 5, 'niente pozione in regalo');
  assert.ok(['risorto', 'fonte'].includes(s.eroe.pozioni[4]!));
  const c0 = s.arena.campanelle[0]!;
  accanto(s, c0.x, c0.z);
  assert.equal(templari.view(s).prompt?.puoi, false, 'si suona ancora');
  assert.equal(suona(o[0]!).filter((e) => e.t === 'campanella').length, 0);
});

test('insieme: le campanelle danno una pozione a ognuno, e anche il secondo prende la Lancia', () => {
  const s = templari.create({ seed: 7, opzioni: { subito: true, eroi: 2 } }), c = cr(s);
  for (const id of s.segreti.ordine) suonaCampanella(s, id);
  assert.ok(s.eroi.every((h) => h.pozioni.length === 1), JSON.stringify(s.eroi.map((h) => h.pozioni)));
  rompiMuro(s); s.segreti.anime = TEMPLARI.cripta.anime;
  for (let i = 0; i < 2; i++) { const h = s.eroi[i]!; h.x = c.altare.x + 1.2; h.z = c.altare.z + (i ? 1 : -1) * 0.6; }
  stepTemplariInsieme(s, [{ ...F, d: true }, F]);
  stepTemplariInsieme(s, [F, { ...F, d: true }]);
  assert.ok(s.eroi.every((h) => h.armi.some((x) => x?.id === 'lancia')), 'la Lancia l\'ha presa uno solo');
  usa(s, 0);
});

test('insieme: chi cade perde la Lancia (§12b) e all\'altare servono altre 5 anime per riprenderla', () => {
  const s = templari.create({ seed: 7, opzioni: { subito: true, eroi: 2 } }), c = cr(s), b = s.eroi[1]!, n = TEMPLARI.cripta.anime;
  rompiMuro(s); s.segreti.anime = n;
  s.eroi[0]!.vita = s.eroi[0]!.max = 1e6;
  usa(s, 1); daiArma(s, 'lancia');
  ferisci(s, 1e6, b.x + 1, b.z);
  assert.equal(b.giu, true);
  while (b.giu && !s.done) stepTemplariInsieme(s, [F, F]);
  assert.ok(!b.armi.some((x) => x?.id === 'lancia'), 'si è rialzato con la Lancia');
  b.x = c.altare.x + 1.2; b.z = c.altare.z;
  let p = templari.view(s, 1).prompt;
  assert.ok(p?.cosa === 'lancia' && !p.puoi && p.testo.includes(`${n}/${2 * n}`), JSON.stringify(p));
  s.eventi = [];
  for (let k = 0; k < n; k++) uccidi(s, nuovoZombie(s, 'fante', c.giu.x - 2 - k, c.giu.z, 0));
  assert.equal(s.segreti.anime, 2 * n, 'le anime non contano più per chi aspetta la sua Lancia');
  assert.ok(s.eventi.some((e) => e.t === 'cripta' && e.fase === 'libera'));
  p = templari.view(s, 1).prompt;
  assert.ok(p?.cosa === 'lancia' && p.puoi, JSON.stringify(p));
  stepTemplariInsieme(s, [F, { ...F, d: true }]);
  assert.ok(b.armi.some((x) => x?.id === 'lancia'), 'non l\'ha ripresa');
});

test('i teschi: AZIONE tenuto su ognuno; al terzo la canzone (una volta)', () => {
  const s = partita();
  for (const q of s.arena.porte) apriPorta(s, q);
  let canzoni = 0;
  s.arena.teschi.forEach((t, k) => {
    s.eroe.x = t.x; s.eroe.z = t.z + 0.3;
    assert.equal(templari.view(s).prompt?.cosa, 'teschio', t.id);
    passi(s, tick(0.8), { d: true }); passi(s, 2);
    assert.equal(s.segreti.teschi[t.id], false, 'preso senza tenere fino in fondo');
    const ev = passi(s, tick(1.6), { d: true }); passi(s, 2);
    assert.ok(ev.some((e) => e.t === 'teschio' && e.n === k + 1), t.id);
    canzoni += ev.filter((e) => e.t === 'canzone').length;
  });
  assert.equal(canzoni, 1);
  assert.ok(templari.view(s).segreti.teschi.every((t) => t.preso));
});

test('il server rigioca uguale: dalla partenza al muro, colpo caricato, giù nella cripta fino all\'altare', () => {
  const s = templari.create({ seed: 11, opzioni: { subito: true } }), c = cr(s), frames: DungeonInput[] = [];
  const step = (inp: DungeonInput) => { frames.push(inp); stepTemplari(s, inp); };
  /** Cammina fino alla cella di (x, z) lungo il BFS della griglia dell'eroe. */
  const vai = (x: number, z: number) => {
    const g = s.gr.eroe, d = bfs(g, cellOf(g, x, z));
    for (let k = 0; k < 3000 && !s.done; k++) {
      const qui = cellOf(g, s.eroe.x, s.eroe.z);
      if (qui === cellOf(g, x, z) && Math.abs(s.eroe.x - x) < 0.3 && Math.abs(s.eroe.z - z) < 0.3) return;
      const nx = qui === cellOf(g, x, z) ? qui : stepDown(g, d, qui), tx = nx >= 0 ? (nx % g.w) + 0.5 : x, tz = nx >= 0 ? Math.floor(nx / g.w) + 0.5 : z;
      const dx = tx - s.eroe.x, dz = tz - s.eroe.z, dd = Math.sqrt(dx * dx + dz * dz) || 1;
      step({ ...F, mx: Math.round((dx / dd) * 8) / 8, my: Math.round((dz / dd) * 8) / 8 });
    }
    throw new Error(`non arrivo a ${x},${z}`);
  };
  vai(c.su.x, c.su.z);
  step({ ...F, mx: -c.su.fx * 0.25, my: -c.su.fz * 0.25 }); // si gira verso il muro
  for (let k = 0; k < tick(1.4); k++) step({ ...F, a: true });
  for (let k = 0; k < tick(1.2); k++) step(F);
  assert.equal(s.segreti.muro, true, 'il muro non si è rotto');
  for (let k = 0; k < tick(1) && !inCripta(s, s.eroe.x, s.eroe.z); k++) step({ ...F, mx: -c.su.fx, my: -c.su.fz });
  assert.ok(inCripta(s, s.eroe.x, s.eroe.z), 'non è sceso');
  vai(c.altare.x + 1, c.altare.z);
  assert.equal(replayTemplari(11, { subito: true }, packDungeon(frames)).hash, templari.result(s).hash);
});
