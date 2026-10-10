// Combattimento nel dungeon su un'arena vuota: caricato > normale, schivata, argento sui non-morti, gravità delle frecce, vetro che si rompe,
// zaino pieno, pozioni, magie ed evocazioni, uscita.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungeon } from '../src/dungeon/dungeon.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { HOLD_TICKS } from '../src/dungeon/tuning.ts';
import { arena, heroBase, inp, katana, run } from './dungeon_util.ts';

/** Bersaglio fermo davanti all'eroe (vita alta, non attacca finché non si sveglia). */
function dummy(s: DungeonState, tipo: string, dx = 1.5, vita = 1000): Enemy {
  const e = newEnemy(s, tipo, s.hero.x + dx, s.hero.z);
  e.vita = e.max = vita; e.st = 'dorme';
  return e;
}
const colpiSu = (ev: DungeonState['eventi'], id: number): number[] => ev.flatMap((x) => (x.t === 'colpo' && x.su === 'nemico' && x.id === id ? [x.danno] : []));
function tap(s: DungeonState): DungeonState['eventi'] { return [...run(s, 1, inp({ a: true })), ...run(s, 60)]; }

test('dungeon: tocco di A = attacco normale; A tenuto fino al pieno = caricato, molto più forte', () => {
  const s1 = arena(heroBase()), e1 = dummy(s1, 'bandito');
  const n = colpiSu(tap(s1), e1.id);
  assert.equal(n.length, 1, 'un colpo normale');
  const s2 = arena(heroBase()), e2 = dummy(s2, 'bandito');
  const carica = Math.ceil(s2.runHero.arma.carica * (1 + s2.runHero.armatura.malus) * 60) + HOLD_TICKS + 5;
  const ev = [...run(s2, carica, inp({ a: true }))];
  assert.equal(dungeon.view(s2).hero.anim, 'carica');
  assert.equal(dungeon.view(s2).hero.carica, 1);
  ev.push(...run(s2, 60));
  const c = colpiSu(ev, e2.id);
  assert.equal(c.length, 1, 'un colpo caricato');
  assert.ok(c[0]! >= n[0]! * 2, `caricato ${c[0]} vs normale ${n[0]}`);
  assert.ok(ev.some((x) => x.t === 'colpo' && x.caricato), 'evento caricato');
  // carica lasciata a metà = attacco normale
  const s3 = arena(heroBase()), e3 = dummy(s3, 'bandito');
  const ev3 = [...run(s3, HOLD_TICKS + 10, inp({ a: true })), ...run(s3, 60)];
  assert.deepEqual(colpiSu(ev3, e3.id), n);
});

test('dungeon: mira assistita — l’eroe si gira verso il nemico vicino quando attacca', () => {
  const s = arena(heroBase());
  s.hero.fx = 0; s.hero.fz = -1; // guarda «su», il nemico è a destra
  const e = dummy(s, 'bandito', 1.6);
  assert.equal(colpiSu(tap(s), e.id).length, 1);
  assert.ok(s.hero.fx > 0.99, `faccia ${s.hero.fx},${s.hero.fz}`);
});

test('dungeon: schivata — allontanarsi durante la preparazione evita il colpo', () => {
  const s = arena(heroBase());
  const e = newEnemy(s, 'bandito', s.hero.x + 1.6, s.hero.z);
  e.aggro = true; e.st = 'insegue';
  const stato = (): string => e.st;
  let t = 0;
  while (stato() !== 'prepara' && t++ < 120) run(s, 1);
  assert.equal(e.st, 'prepara', 'il bandito prepara il colpo');
  const vita = s.hero.vita;
  const ev = run(s, e.stDur + 2, inp({ mx: -1 }));
  assert.ok(ev.some((x) => x.t === 'schivato'), 'evento schivato');
  assert.ok(!ev.some((x) => x.t === 'colpo' && x.su === 'eroe'), 'nessun colpo preso');
  assert.ok(s.hero.vita >= vita);
  // fermo invece: il colpo arriva
  const s2 = arena(heroBase());
  const e2 = newEnemy(s2, 'bandito', s2.hero.x + 1.6, s2.hero.z);
  e2.aggro = true; e2.st = 'insegue';
  const ev2 = run(s2, 120);
  assert.ok(ev2.some((x) => x.t === 'colpo' && x.su === 'eroe'), 'restando fermo si prende il colpo');
  assert.ok(s2.hero.vita < s2.runHero.max.vita);
});

test('dungeon: armi d’argento fanno danni doppi ai non-morti (e il ferro no)', () => {
  const ferro = arena(heroBase({ arma: katana({ id: 'katana_ferro', danno: 20 }) })), ef = dummy(ferro, 'scheletro');
  const argento = arena(heroBase({ arma: katana({ id: 'katana_argento', danno: 20, traits: { bonusVs: { nonmorto: 2, mostro: 2 } } }) })), ea = dummy(argento, 'scheletro');
  const df = colpiSu(tap(ferro), ef.id)[0]!, da = colpiSu(tap(argento), ea.id)[0]!;
  const arm = ef.def.armatura;
  assert.equal(df, 20 - arm);
  assert.equal(da, 40 - arm);
  // sui banditi (umani) l'argento non fa bonus
  const b = arena(heroBase({ arma: katana({ danno: 20, traits: { bonusVs: { nonmorto: 2, mostro: 2 } } }) })), eb = dummy(b, 'bandito');
  assert.equal(colpiSu(tap(b), eb.id)[0], 20 - eb.def.armatura);
});

/** Tira una freccia a tensione piena verso +x e misura dove si ferma. */
function gittata(frecce: { id: string; gittata: number; gravita: number }): number {
  const s = arena(heroBase({
    arma: { id: 'arco_ferro', kind: 'arco', skill: 'arceria', classe: null, danno: 14, tempo: 0.9, portata: 0, carica: 0.9, caricaMolt: 1, gittata: 28, traits: {} },
    frecce: { ...frecce, n: 5, danno: 6, traits: {} },
  }));
  s.hero.x = 3; s.hero.z = 14;
  run(s, 70, inp({ a: true }));
  assert.equal(s.hero.carica, 1);
  run(s, 1);
  assert.equal(s.proj.length, 1, 'freccia in volo');
  assert.equal(s.hero.frecce, 4);
  const p = s.proj[0]!;
  let x = p.x;
  for (let i = 0; i < 300 && s.proj.length; i++) { x = s.proj[0]!.x; run(s, 1); }
  assert.equal(s.usati[frecce.id], 1);
  return x - 3;
}
test('dungeon: le frecce di legno cadono prima di quelle di ferro (gravità della freccia)', () => {
  const legno = gittata({ id: 'frecce_legno', gittata: 0, gravita: 20 });
  const ferro = gittata({ id: 'frecce_ferro', gittata: 6, gravita: 7 });
  assert.ok(legno > 5 && legno < ferro * 0.7, `legno ${legno.toFixed(1)} m, ferro ${ferro.toFixed(1)} m`);
  // senza frecce: evento e niente tiro
  const s = arena(heroBase({ arma: { id: 'arco_legno', kind: 'arco', skill: 'arceria', classe: null, danno: 6, tempo: 0.6, portata: 0, carica: 0.6, caricaMolt: 1, gittata: 14, traits: {} }, frecce: null }));
  assert.ok(run(s, 1, inp({ a: true })).some((x) => x.t === 'senzaFrecce'));
});

test('dungeon: il vetro si rompe a quota colpi (si passa ai pugni), l’usura riparte da quella salvata', () => {
  const s = arena(heroBase({ arma: katana({ id: 'katana_vetro', danno: 19, tempo: 0.45, traits: { fragile: 5 }, usura: 2 }) }));
  const e = dummy(s, 'bandito');
  const ev = [...tap(s), ...tap(s)];
  assert.equal(s.usura['katana_vetro'], 4);
  ev.push(...tap(s));
  assert.ok(ev.some((x) => x.t === 'rotto' && x.item === 'katana_vetro'));
  assert.equal(s.hero.arma.kind, 'pugni');
  const r = dungeon.result(s);
  assert.equal(r.rotti['katana_vetro'], 1);
  assert.equal(r.usura['katana_vetro'], 0);
  const pugno = colpiSu(tap(s), e.id)[0]!;
  assert.ok(pugno < 19, `i pugni fanno poco (${pugno})`);
});

test('dungeon: zaino pieno → evento pieno e il bottino resta a terra (le monete si prendono)', () => {
  const s = arena(heroBase({ carico: 149.5, caricoMax: 150 }));
  s.loot.push({ id: 999, x: s.hero.x, z: s.hero.z, tipo: 'forziere', items: { pietra_pesante: 1, erba_curativa: 2 }, monete: 7, vuoto: false, pieno: false });
  const ev = run(s, 1);
  assert.ok(ev.some((x) => x.t === 'pieno' && x.item === 'pietra_pesante'));
  assert.ok(ev.some((x) => x.t === 'monete' && x.n === 7));
  assert.equal(s.monete, 7);
  assert.equal(s.bottino['erba_curativa'], 2, 'gli oggetti leggeri entrano');
  assert.equal(s.loot.at(-1)!.vuoto, false);
  assert.equal(s.loot.at(-1)!.items['pietra_pesante'], 1);
  assert.ok(!run(s, 5).some((x) => x.t === 'pieno'), 'il toast non si ripete restando sopra');
  assert.equal(dungeon.view(s).zaino.monete, 7);
});

test('dungeon: pozione (D) cura e conta in usati; magia (C) costa magicka; evocazione = un alleato che combatte', () => {
  const s = arena(heroBase());
  s.hero.vita = 30;
  const ev = run(s, 1, inp({ d: true }));
  assert.ok(ev.some((x) => x.t === 'pozione'));
  assert.ok(s.hero.vita >= 70);
  assert.equal(dungeon.result(s).usati['pozione_vita_minore'], 1);
  run(s, 40);
  const e = dummy(s, 'bandito', 6, 30);
  const ev2 = [...run(s, 1, inp({ c: true, a: true })), ...run(s, 90)]; // C prende la magia in mano, la A la lancia
  assert.ok(ev2.some((x) => x.t === 'magia' && x.id === 'fiammata'));
  assert.ok(colpiSu(ev2, e.id).length >= 1, 'la fiammata colpisce');
  assert.ok(e.bleedT > 0 || e.st === 'morto', 'sanguina');
  s.hero.magicka = 5;
  run(s, 60);
  assert.ok(run(s, 1, inp({ a: true })).some((x) => x.t === 'senzaMagicka'));
  // evocazione
  const se = arena(heroBase({ magie: [{ id: 'lupo_spettrale', scuola: 'evocazione', costo: 40, ricarica: 2, danno: 0, velocita: 0, raggio: 0, sanguina: 0, evoca: 'lupo_spettrale', durata: 20 }] }));
  const t = dummy(se, 'bandito', 7, 40);
  t.st = 'veglia';
  const ev3 = [...run(se, 1, inp({ c: true, a: true })), ...run(se, 600)];
  assert.ok(ev3.some((x) => x.t === 'evocato' && x.tipo === 'lupo_spettrale'));
  assert.equal(t.st, 'morto', 'il lupo spettrale uccide il bandito');
  assert.equal(dungeon.result(se).uccisi['bandito'], 1);
  assert.ok((dungeon.result(se).xp.evocazione ?? 0) > 40 * 0.5, 'xp di evocazione: il lancio e i colpi del lupo');
  run(se, 20 * 60);
  assert.ok(se.enemies.every((x) => !x.alleato || x.st === 'morto'), 'l’evocazione scade');
});

test('dungeon: A sulla scala = uscito; dopo la fine step non fa più niente', () => {
  const s = arena(heroBase());
  s.hero.x = s.map.exit.x + 0.5; s.hero.z = s.map.exit.z;
  assert.equal(dungeon.view(s).vicinoUscita, true);
  run(s, 1, inp({ a: true }));
  assert.equal(s.done, true);
  assert.equal(s.outcome, 'uscito');
  const tick = s.tick, h = dungeon.result(s).hash;
  run(s, 30, inp({ mx: 1, a: true }));
  assert.equal(s.tick, tick);
  assert.equal(dungeon.result(s).hash, h);
});

test('dungeon: armatura d’ossa (terrore) — i nemici deboli scappano, gli scheletri no', () => {
  const ossa = { id: 'armatura_ossa', difesa: 90, malus: 0.5, vsMagia: 1, vsTaglio: 1, vsContundente: 1, moneteSuColpito: 0, terrore: 2, velocitaMolt: 1 };
  const s = arena(heroBase({ armatura: ossa }));
  const b = newEnemy(s, 'bandito', s.hero.x + 3, s.hero.z), k = newEnemy(s, 'nonmorto', s.hero.x, s.hero.z + 3);
  b.aggro = true; b.st = 'insegue'; k.aggro = true; k.st = 'insegue';
  const d0 = b.x - s.hero.x;
  run(s, 60);
  assert.equal(b.st, 'scappa');
  assert.ok(b.x - s.hero.x > d0, 'il bandito si allontana');
  assert.notEqual(k.st, 'scappa', 'il non-morto (senza pauroso) non scappa');
});

test('dungeon: il colpo ad area dei boss si vede (view.nemici[].area) solo mentre lo prepara', () => {
  const s = arena(heroBase({ max: { vita: 1000, magicka: 100, stamina: 100 } }));
  const boss = newEnemy(s, 're_ossa', s.hero.x + 2.2, s.hero.z);
  boss.aggro = true; boss.st = 'insegue';
  const prep = (): boolean => boss.st === 'prepara';
  const area = (): number | undefined => dungeon.view(s).nemici.find((n) => n.id === boss.id)!.area;
  const viste: (number | undefined)[] = [];
  let colpiAdArea = 0;
  for (let t = 0; t < 60 * 12; t++) {
    run(s, 1);
    if (prep()) viste.push(area());
    else assert.equal(area(), undefined, 'niente cerchio fuori dalla preparazione');
    if (prep() && boss.stT === 1 && boss.area) colpiAdArea++;
  }
  assert.ok(colpiAdArea >= 1, 'almeno un colpo ad area in 12 s');
  assert.ok(viste.some((a) => a === undefined), 'i colpi normali non hanno cerchio');
  assert.ok(viste.some((a) => a !== undefined && Math.abs(a - boss.def.portata * 1.7) < 1e-9), `raggio ${viste.find((a) => a !== undefined)}`);
});

test('dungeon: la vista dice `tiro` quando un arciere prepara una freccia (il client tende l’arco), non nei colpi in mischia', () => {
  const s = arena(heroBase());
  const arciere = newEnemy(s, 'bandito_arciere', s.hero.x + 8, s.hero.z);
  let prep: ReturnType<typeof dungeon.view>['nemici'][number] | undefined;
  for (let i = 0; i < 600 && !prep; i++) { run(s, 1); prep = dungeon.view(s).nemici.find((n) => n.id === arciere.id && n.anim === 'prepara'); }
  assert.ok(prep, 'l’arciere prepara un tiro');
  assert.equal(prep.tiro, true);
  for (let i = 0; i < 120 && !s.proj.some((p) => p.tipo === 'freccia_nemica'); i++) run(s, 1);
  assert.ok(s.proj.some((p) => p.tipo === 'freccia_nemica'), 'poi la freccia parte');
  assert.equal(dungeon.view(s).nemici.find((n) => n.id === arciere.id)!.tiro, undefined, 'scoccata: niente più tiro nella vista');
  const s2 = arena(heroBase()), bandito = newEnemy(s2, 'bandito', s2.hero.x + 1.2, s2.hero.z);
  let p2: ReturnType<typeof dungeon.view>['nemici'][number] | undefined;
  for (let i = 0; i < 600 && !p2; i++) { run(s2, 1); p2 = dungeon.view(s2).nemici.find((n) => n.id === bandito.id && n.anim === 'prepara'); }
  assert.ok(p2, 'il bandito prepara un colpo');
  assert.equal(p2.tiro, undefined);
});

test('dungeon: xp = danno utile (mai oltre la vita del nemico) × moltiplicatore; frecce e magie danno xp come le armi', () => {
  // martello enorme su un nemico quasi morto: xp = la vita che restava, non il danno
  const s = arena(heroBase({ arma: katana({ id: 'martello_ferro', skill: 'armiPesanti', classe: 'pesante', danno: 200 }) }));
  dummy(s, 'bandito', 1.5, 10);
  tap(s);
  assert.equal(dungeon.result(s).xp.armiPesanti, 10);
  // la fiammata: xp di distruzione solo se colpisce, × 3
  const m = arena(heroBase()), e = dummy(m, 'bandito', 6, 1000);
  const ev = [...run(m, 1, inp({ c: true, a: true })), ...run(m, 90)];
  const d = colpiSu(ev, e.id)[0]!;
  assert.ok(d > 0);
  assert.ok(Math.abs((dungeon.result(m).xp.distruzione ?? 0) - d * 3) < 1, `distruzione ${dungeon.result(m).xp.distruzione} vs colpo ${d}`);
});
