// Magie di fuoco ed elettricità (docs/RPG.md §Magie): il fuoco fa più danni totali, l'elettricità rallenta; raggio continuo e bomba ad area.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, ITEMS_RAW, LOOT, SPELLS, spellDef } from '@marea/content/rpg.ts';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { newHero, runHeroOf } from '../src/rpg/hero.ts';
import type { RunSpell } from '../src/rpg/types.ts';
import { HZ } from '../src/dungeon/tuning.ts';
import { arena, heroBase, inp, run } from './dungeon_util.ts';

/** La magia `id` com'è per un eroe nuovo (stessi numeri del gioco), in mano nell'arena. */
function conMagia(id: string): DungeonState {
  const h = { ...newHero(), magie: [id], equip: { ...newHero().equip, magia: id, mano: 'magia' as const } };
  const sp: RunSpell = runHeroOf(h).magie[0]!;
  const s = arena(heroBase({ magie: [sp], magia: 0, max: { vita: 500, magicka: 400, stamina: 100 } }));
  s.hero.magicka = 400; s.hero.vita = 500;
  run(s, 1, inp({ c: true })); // C: la magia in mano
  assert.equal(s.hero.incanta, true);
  return s;
}
/** Bersaglio con tanta vita davanti all'eroe a `dx` m (sveglio ma fermo: lo rimettiamo a posto a ogni tick con `inchioda`). */
function bersaglio(s: DungeonState, dx: number, dz = 0, tipo = 'bandito'): Enemy {
  const e = newEnemy(s, tipo, s.hero.x + dx, s.hero.z + dz);
  e.vita = e.max = 100000; e.st = 'dorme';
  return e;
}
/** n tick con lo stesso input, rimettendo i bersagli dov'erano (non si muovono, non attaccano). */
function passi(s: DungeonState, n: number, f = inp(), fermi: Enemy[] = []): DungeonState['eventi'] {
  const pos = fermi.map((e) => [e.x, e.z] as const), ev: DungeonState['eventi'] = [];
  for (let i = 0; i < n && !s.done; i++) {
    dungeon.step(s, f); ev.push(...s.eventi);
    fermi.forEach((e, k) => { e.x = pos[k]![0]; e.z = pos[k]![1]; });
  }
  return ev;
}
const dps = (e: Enemy): number => 100000 - e.vita;

test('magie: nomi nuovi, sei magie d’attacco, ogni magia ha il suo libro e ogni libro sta nel mondo', () => {
  assert.equal(spellDef('fiammata').nome, 'Proiettile infuocato');
  assert.equal(spellDef('fulmine').nome, 'Proiettile elettrico');
  for (const id of ['fuoco_continuo', 'elettro_continuo', 'bomba_fuoco', 'bomba_elettrica']) assert.ok(SPELLS.some((s) => s.id === id), id);
  const nelMondo = new Set<string>();
  for (const d of DUNGEONS) for (const l of Object.values(d.legenda)) if (l.libro) nelMondo.add(l.libro);
  for (const t of LOOT) for (const v of t.voci) if (v.item.startsWith('libro_')) nelMondo.add(v.item);
  for (const s of SPELLS.filter((x) => x.id !== 'fiammata')) {
    const libro = ITEMS_RAW.find((i) => i.insegna === s.id);
    assert.ok(libro && nelMondo.has(libro.id), `il libro di ${s.id} non si trova da nessuna parte`);
  }
});

test('magie: il fuoco fa più danni totali dell’elettricità, solo l’elettricità rallenta', () => {
  const f = spellDef('fiammata'), e = spellDef('fulmine');
  const totale = (m: typeof f): number => (m.danno ?? 0) + (m.sanguina ?? 0) * 3; // all'impatto + bruciatura (SANGUINA_TICKS = 3 s)
  assert.ok(totale(f) > totale(e), 'più danno totale per colpo');
  assert.ok(totale(f) / f.costo > totale(e) / e.costo, 'e per Magicka spesa');
  assert.ok(!f.rallenta && !spellDef('bomba_fuoco').rallenta && !spellDef('fuoco_continuo').rallenta);
  for (const id of ['fulmine', 'elettro_continuo', 'bomba_elettrica']) assert.ok(spellDef(id).rallenta, `${id} rallenta`);
  assert.ok(f.elemento === 'fuoco' && e.elemento === 'elettricita');
});

test('magie: il raggio continuo fa meno del proiettile spammato al massimo, ma ha una gittata di pochi metri', () => {
  for (const [raggio, proiettile] of [['fuoco_continuo', 'fiammata'], ['elettro_continuo', 'fulmine']] as const) {
    const r = spellDef(raggio), p = spellDef(proiettile);
    const dpsRaggio = (r.danno ?? 0) + (r.sanguina ?? 0), dpsProiettile = ((p.danno ?? 0) / p.ricarica) + (p.sanguina ?? 0);
    assert.ok(dpsRaggio < dpsProiettile, `${raggio}: ${dpsRaggio} < ${dpsProiettile}`);
    assert.ok((r.gittata ?? 99) <= 6 && r.forma === 'raggio');
  }
});

test('magie: il proiettile infuocato brucia, il proiettile elettrico rallenta a metà e passa', () => {
  const sf = conMagia('fiammata'), ef = bersaglio(sf, 6);
  const evf = passi(sf, 1, inp({ a: true }), [ef]).concat(passi(sf, 60, inp(), [ef]));
  assert.ok(evf.some((x) => x.t === 'magia' && x.id === 'fiammata'));
  assert.ok(ef.bleed >= 4 && ef.bleedT > 0, 'brucia');
  assert.ok(!(ef.lentoT && ef.lentoT > sf.tick), 'il fuoco non rallenta');
  const se = conMagia('fulmine'), ee = bersaglio(se, 6);
  passi(se, 1, inp({ a: true }), [ee]); passi(se, 30, inp(), [ee]);
  assert.ok(ee.lentoT !== undefined && ee.lentoT > se.tick, 'rallentato');
  assert.equal(ee.lentoMolt, 0.5);
  assert.equal(ee.bleedT, 0, 'e non brucia');
  assert.ok(dps(ee) > 0, 'il lampo ha fatto danno');
});

test('magie: un nemico rallentato cammina a metà velocità (il boss a metà effetto)', () => {
  const corsa = (rallenta: boolean, tipo = 'bandito'): number => {
    const s = arena(heroBase());
    const e = newEnemy(s, tipo, s.hero.x + 9, s.hero.z);
    e.vita = e.max = 100000; e.aggro = true; e.st = 'insegue';
    if (rallenta) { e.lentoT = s.tick + 600; e.lentoMolt = 0.5; e.lentoAcc = 0; }
    const x0 = e.x;
    run(s, 60);
    return x0 - e.x;
  };
  const libero = corsa(false), lento = corsa(true);
  assert.ok(libero > 2, `il nemico libero cammina (${libero.toFixed(2)})`);
  assert.ok(Math.abs(lento / libero - 0.5) < 0.1, `rallentato a metà (${lento.toFixed(2)} contro ${libero.toFixed(2)})`);
  // il boss: rallentamento dimezzato (0,35 → 0,675)
  const s = conMagia('bomba_elettrica'), boss = bersaglio(s, 6, 0, 're_ossa');
  boss.def = { ...boss.def, boss: true };
  passi(s, 1, inp({ a: true }), [boss]); passi(s, 100, inp(), [boss]);
  assert.equal(boss.lentoMolt, 0.675);
});

test('magie: il fuoco continuo brucia tutti nel corridoio, costa Magicka al secondo e si spegne al rilascio', () => {
  const s = conMagia('fuoco_continuo');
  const a = bersaglio(s, 2.5), b = bersaglio(s, 4), lontano = bersaglio(s, 7), lato = bersaglio(s, 3, 3);
  const fermi = [a, b, lontano, lato];
  const m0 = s.hero.magicka;
  const ev = passi(s, 1, inp({ a: true }), fermi).concat(passi(s, 3 * HZ - 1, inp({ a: true }), fermi)); // 3 s di fiamma
  assert.ok(ev.some((x) => x.t === 'magia' && x.id === 'fuoco_continuo'));
  const speso = m0 - s.hero.magicka;
  assert.ok(Math.abs(speso - (20 * 3 - 4 * 3)) < 2, `~20 Magicka al secondo (meno la rigenerazione): ${speso.toFixed(1)}`);
  assert.ok(Math.abs(dps(a) - 22 * 3 - 4 * 3) < 22, `~22 al secondo più la bruciatura: ${dps(a).toFixed(1)}`);
  assert.ok(dps(b) > 22 * 2, 'colpisce anche il secondo nella linea');
  assert.equal(dps(lontano), 0, 'oltre la gittata niente');
  assert.equal(dps(lato), 0, 'di lato niente');
  assert.ok(a.bleedT > 0, 'chi è nella fiamma brucia');
  const v = dungeon.view(s).hero;
  assert.equal(v.anim, 'lancia');
  assert.ok(v.canale && v.canale.el === 'fuoco' && v.canale.len > 4 && v.canale.len <= 4.5, 'la vista mostra il raggio');
  passi(s, 1, inp(), fermi);
  assert.equal(dungeon.view(s).hero.canale, undefined, 'rilasciata la A, si spegne');
  const dopo = dps(a);
  passi(s, 120, inp(), fermi);
  assert.ok(dps(a) - dopo < 22, 'senza A niente più colpi (resta la bruciatura)');
});

test('magie: l’elettricità continua tiene il nemico rallentato finché lo colpisci, e il raggio si ferma a un muro', () => {
  const s = conMagia('elettro_continuo'), a = bersaglio(s, 5);
  passi(s, 1, inp({ a: true }), [a]); passi(s, 60, inp({ a: true }), [a]);
  assert.equal(a.lentoMolt, 0.55);
  assert.ok(a.lentoT! > s.tick, 'rallentato');
  const durante = dps(a);
  assert.ok(durante > 14 * 0.8 && durante < 14 * 1.6, `~14 al secondo: ${durante.toFixed(1)}`);
  passi(s, 60, inp(), [a]); // lascio andare: dopo 0,6 s torna libero
  assert.ok(!(a.lentoT! > s.tick));
  // un muro davanti: il raggio non arriva oltre
  const m = conMagia('elettro_continuo');
  m.hero.x = 36.5; m.hero.z = 13; m.hero.fx = 1; m.hero.fz = 0; // davanti a sé ha il bordo dell'arena a 1,5 m
  passi(m, 2, inp({ a: true }));
  assert.ok(dungeon.view(m).hero.canale!.len <= 1, `corto: ${dungeon.view(m).hero.canale!.len}`);
});

test('magie: finita la Magicka il raggio si spegne (una volta sola) e la A tenuta non lo riaccende', () => {
  const s = conMagia('fuoco_continuo');
  s.hero.magicka = 25;
  const b = bersaglio(s, 2);
  const ev = passi(s, 3 * HZ, inp({ a: true }), [b]);
  assert.equal(ev.filter((x) => x.t === 'senzaMagicka').length, 1);
  assert.equal(dungeon.view(s).hero.canale, undefined);
  assert.ok(s.hero.magicka >= 0 && dps(b) > 0);
});

test('magie: la bomba è lenta, vola in alto e scoppia dove atterra: danno ad area, non a chi sta nel mezzo', () => {
  const s = conMagia('bomba_fuoco');
  const centro = bersaglio(s, 6), vicino = bersaglio(s, 6, 1.2), fuori = bersaglio(s, 6, 4);
  const fermi = [centro, vicino, fuori];
  passi(s, 1, inp({ a: true }), fermi);
  const ev = passi(s, 1, inp(), fermi); // rilascio: parte
  const b = s.proj.find((p) => p.bomba);
  assert.ok(b, 'la bomba è in volo');
  assert.ok(Math.abs(b!.bomba![0] - centro.x) < 0.2 && Math.abs(b!.bomba![1] - centro.z) < 0.2, 'atterra sul primo nemico che ha davanti');
  assert.ok(ev.some((x) => x.t === 'magia' && x.id === 'bomba_fuoco'));
  let alto = 0, scoppio: DungeonState['eventi'][number] | undefined;
  for (let i = 0; i < 2 * HZ && !scoppio; i++) {
    const e = passi(s, 1, inp(), fermi);
    for (const p of s.proj) if (p.bomba) alto = Math.max(alto, p.y);
    scoppio = e.find((x) => x.t === 'scoppio');
    if (!scoppio) assert.equal(dps(centro), 0, 'in volo non colpisce nessuno');
  }
  assert.ok(scoppio && scoppio.t === 'scoppio', 'scoppia');
  assert.ok(alto > 2, `vola in alto (${alto.toFixed(2)} m)`);
  assert.ok(Math.abs(s.tick - 2 - 1.1 * HZ) <= 3, 'dopo ~1,1 s');
  assert.equal(s.proj.filter((p) => p.bomba).length, 0);
  assert.ok(dps(centro) >= 40 - 1 && dps(vicino) >= 40 - 1, 'tutti nel raggio prendono il danno');
  assert.equal(dps(fuori), 0, 'fuori dal raggio niente');
  assert.ok(centro.bleedT > 0 && vicino.bleedT > 0, 'la bomba di fuoco brucia');
  assert.ok(s.hero.vita === 500, 'e non fa male a chi la lancia');
});

test('magie: la bomba elettrica rallenta tutta l’area e un muro in mezzo la fa cadere prima', () => {
  const s = conMagia('bomba_elettrica');
  const a = bersaglio(s, 5), b = bersaglio(s, 5, 1.5);
  passi(s, 1, inp({ a: true }), [a, b]); passi(s, 1, inp(), [a, b]);
  passi(s, 1.2 * HZ, inp(), [a, b]);
  for (const e of [a, b]) { assert.equal(e.lentoMolt, 0.35); assert.ok(e.lentoT! > s.tick, 'rallentato'); assert.equal(e.bleedT, 0); }
  // niente nemici davanti e un muro a 1,5 m: cade prima del muro
  const m = conMagia('bomba_elettrica');
  m.hero.x = 36.5; m.hero.z = 13; m.hero.fx = 1; m.hero.fz = 0;
  passi(m, 1, inp({ a: true })); passi(m, 1, inp());
  const p = m.proj.find((x) => x.bomba)!;
  assert.ok(p.bomba![0] < 38, `non finisce dentro il muro (${p.bomba![0]})`);
});

test('magie: stesso input, stesso risultato (determinismo con raggi e bombe)', () => {
  const gioca = (): number => {
    const s = conMagia('bomba_fuoco');
    const e = bersaglio(s, 5);
    e.st = 'veglia';
    for (let i = 0; i < 400; i++) dungeon.step(s, inp({ a: i % 120 < 60 }));
    return dungeon.result(s).hash;
  };
  assert.equal(gioca(), gioca());
});
