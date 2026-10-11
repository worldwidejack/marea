// Albero delle abilità, seconda tornata (11 ott 2026): Lame avvelenate, Lama d'aria, Spaccaossa, Terremoto, Frecce perforanti, Faretra infinita,
// Pioggia di frecce, Combustione, Catena di fulmini, Banchetto, Doppio richiamo, Medico da campo, Doppia dose, Pozioni durature, Capolavoro, Elisir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERKS, SKILLS } from '@marea/content/rpg.ts';
import { dungeon, stepParty, createPartyRun } from '../src/dungeon/dungeon.ts';
import { newEnemy } from '../src/dungeon/state.ts';
import type { DungeonState, Enemy } from '../src/dungeon/state.ts';
import { HOLD_TICKS } from '../src/dungeon/tuning.ts';
import { newLot } from '../src/economy/actions.ts';
import type { LotState } from '../src/economy/types.ts';
import { applyRpgAction } from '../src/rpg/actions.ts';
import { heroOf, newHero, runHeroOf } from '../src/rpg/hero.ts';
import type { HeroState, RpgAction, RunHero, RunPerk, RunSpell } from '../src/rpg/types.ts';
import { arena, heroBase, inp, katana, run } from './dungeon_util.ts';

const T0 = 1_800_000_000_000;
const alleati = (o: Partial<NonNullable<RunPerk['alleati']>> = {}): NonNullable<RunPerk['alleati']> => ({ danno: 1, vita: 1, perenne: false, max: 1, banchetto: 0, ...o });
const conPerk = (perk: RunPerk, o: Partial<RunHero> = {}): RunHero => heroBase({ perk, ...o });
function dummy(s: DungeonState, tipo: string, dx = 1.5, vita = 1000, dz = 0): Enemy {
  const e = newEnemy(s, tipo, s.hero.x + dx, s.hero.z + dz);
  e.vita = e.max = vita; e.st = 'dorme';
  return e;
}
const colpiSu = (ev: DungeonState['eventi'], id: number): number[] => ev.flatMap((x) => (x.t === 'colpo' && x.su === 'nemico' && x.id === id ? [x.danno] : []));
function caricato(s: DungeonState): DungeonState['eventi'] {
  const n = Math.ceil(s.runHero.arma.carica * (1 + s.runHero.armatura.malus) * 60) + HOLD_TICKS + 5;
  return [...run(s, n, inp({ a: true })), ...run(s, 70)];
}
const arcoHero = (perk?: RunPerk): RunHero => heroBase({
  arma: { id: 'arco_ferro', kind: 'arco', skill: 'arceria', classe: null, danno: 14, tempo: 0.9, portata: 0, carica: 0.9, caricaMolt: 1, gittata: 28, traits: {} },
  frecce: { id: 'frecce_ferro', n: 40, danno: 6, gittata: 6, gravita: 7, traits: {} },
  ...(perk ? { perk } : {}),
});
const con = (h: HeroState, id: string, slot: 'corpo' | 'arma' | 'frecce'): HeroState => ({ ...h, inv: { ...h.inv, [id]: (h.inv[id] ?? 0) + 1 }, equip: { ...h.equip, [slot]: id } });

test('albero: ogni abilità ha un perk da livello 90-100 e Alchimia non è più la parente povera', () => {
  for (const s of SKILLS) assert.ok(PERKS.some((p) => p.skill === s && p.livello >= 90), `${s} senza perk finale`);
  assert.ok(PERKS.filter((p) => p.skill === 'alchimia').length >= 8);
  const byId = new Map(PERKS.map((p) => [p.id, p]));
  for (const p of PERKS) if (p.richiede) assert.ok(byId.get(p.richiede)!.livello < p.livello, p.id);
});

test('Spaccaossa e Frecce perforanti: tratti dell\'arma e delle frecce nel RunHero; Elisir e Pozioni durature', () => {
  const pes = runHeroOf({ ...con(newHero(), 'martello_bronzo', 'arma'), perk: ['ap_braccia', 'ap_sfondatore', 'ap_spaccaossa'] });
  assert.equal(pes.arma.traits.penetra, 0.3);
  const leg = runHeroOf({ ...con(newHero(), 'katana_bronzo', 'arma'), perk: ['ap_braccia', 'ap_sfondatore', 'ap_spaccaossa'] });
  assert.equal(leg.arma.traits.penetra, undefined, 'le leggere no');
  const fr = runHeroOf({ ...newHero(), perk: ['ar_falco', 'ar_perforanti'] });
  assert.equal(fr.frecce?.traits.trapassa, true);
  assert.equal(runHeroOf(newHero()).frecce?.traits.trapassa, undefined);
  const el = runHeroOf({ ...newHero(), perk: ['alc_erborista', 'alc_medico', 'alc_pelle', 'alc_elisir'] });
  assert.equal(el.max.vita, runHeroOf(newHero()).max.vita + 10);
  assert.equal(el.max.magicka, runHeroOf(newHero()).max.magicka + 10);
  assert.equal(el.max.stamina, runHeroOf(newHero()).max.stamina + 10);
  // pozioni con effetto a tempo: +50 % di durata
  const h0 = { ...newHero(), inv: { ...newHero().inv, pozione_vigore: 1 } };
  const norm = runHeroOf(h0).pozioni.find((p) => p.buff), lunga = runHeroOf({ ...h0, perk: ['alc_erborista', 'alc_medico', 'alc_durature'] }).pozioni.find((p) => p.buff);
  if (norm && lunga) assert.ok(Math.abs(lunga.buff!.secondi - norm.buff!.secondi * 1.5) < 0.02);
});

test('Lame avvelenate: il colpo normale di un\'arma leggera avvelena, il caricato e le armi pesanti no', () => {
  const s = arena(conPerk({ veleno: 1 })), e = dummy(s, 'bandito');
  run(s, 1, inp({ a: true })); run(s, 70);
  assert.equal(e.bleed, 3);
  assert.ok(e.bleedT > 0 || e.vita < e.max);
  assert.ok(dungeon.view(s).nemici.find((x) => x.id === e.id)!.sanguina || e.bleedT === 0);
  const c = arena(conPerk({ veleno: 1 })), ec = dummy(c, 'bandito');
  caricato(c);
  assert.equal(ec.bleed, 0, 'il caricato non avvelena');
  const p = arena(conPerk({ veleno: 1 }, { arma: katana({ id: 'martello_ferro', skill: 'armiPesanti', classe: 'pesante', danno: 30 }) })), ep = dummy(p, 'bandito');
  run(p, 1, inp({ a: true })); run(p, 70);
  assert.equal(ep.bleed, 0, 'le pesanti no');
});

test('Lama d\'aria: il caricato lancia una lama che trapassa e colpisce chi sta lontano', () => {
  const s = arena(conPerk({ aria: true })), lontano = dummy(s, 'bandito', 7, 1000);
  const ev = caricato(s);
  assert.ok(colpiSu(ev, lontano.id).length >= 1, 'la lama arriva a 7 m');
  const n = arena(conPerk({}), 1), ln = dummy(n, 'bandito', 7, 1000);
  assert.equal(colpiSu(caricato(n), ln.id).length, 0, 'senza il perk no');
  // un tocco normale non lancia niente
  const t = arena(conPerk({ aria: true })), lt = dummy(t, 'bandito', 7, 1000);
  run(t, 1, inp({ a: true })); run(t, 80);
  assert.equal(lt.vita, 1000);
});

test('Terremoto: il caricato a segno spinge e ferisce chi sta intorno; i boss restano dove sono', () => {
  const s = arena(conPerk({ terremoto: true }));
  const vicino = dummy(s, 'bandito', 1.5, 1000), accanto = dummy(s, 'bandito', -2.5, 1000), boss = dummy(s, 're_ossa', 2.5, 5000, 1.5), lontano = dummy(s, 'bandito', 9, 1000);
  const x0 = accanto.x, b0 = boss.x;
  const ev = caricato(s);
  assert.ok(ev.some((e) => e.t === 'terremoto'));
  assert.ok(accanto.x < x0 - 1, `spinto via ${(x0 - accanto.x).toFixed(1)} m`);
  assert.ok(accanto.vita < 1000);
  assert.ok(Math.abs(boss.x - b0) < 1.3, 'il boss non si sposta');
  assert.equal(lontano.vita, 1000);
  assert.ok(vicino.vita < 1000);
  // senza nessuno colpito niente
  const v = arena(conPerk({ terremoto: true }));
  assert.ok(!caricato(v).some((e) => e.t === 'terremoto'));
});

test('Faretra infinita: la freccia a volte non si consuma; Pioggia di frecce: Scarica da 5 ogni 20 s', () => {
  const s = arena(arcoHero({ risparmio: 1 }));
  s.hero.x = 3; s.hero.z = 6;
  run(s, 70, inp({ a: true, m: 1 })); run(s, 3, inp({ m: 1 }));
  assert.equal(s.hero.frecce, 40, 'con probabilità 1 non si consuma mai');
  assert.equal(s.usati['frecce_ferro'], undefined);
  const p = arena(arcoHero({ scarica: true, pioggia: true }));
  p.hero.x = 3; p.hero.z = 6;
  run(p, 1, inp({ e: true })); run(p, 50, inp({ m: 1 }));
  assert.equal(p.usati['frecce_ferro'], 5);
  assert.equal(dungeon.view(p).hero.scarica! < 0.05, true);
  run(p, 19 * 60);
  assert.ok(dungeon.view(p).hero.scarica! < 1, 'dopo 19 s non è ancora pronta');
  run(p, 2 * 60);
  assert.equal(dungeon.view(p).hero.scarica, 1, 'dopo 20 s sì');
});

const fiammata: RunSpell = { id: 'fiammata', scuola: 'distruzione', elemento: 'fuoco', costo: 15, ricarica: 0.4, danno: 14, velocita: 12, raggio: 0.5, sanguina: 0, evoca: null, durata: 0 };
const scintilla: RunSpell = { id: 'fulmine', scuola: 'distruzione', elemento: 'elettricita', costo: 10, ricarica: 0.4, danno: 40, velocita: 30, raggio: 0.35, sanguina: 0, evoca: null, durata: 0 };

test('Combustione: una magia di fuoco lascia una chiazza che brucia i nemici (non l\'eroe) e dà xp di Distruzione', () => {
  const s = arena(conPerk({ combustione: true }, { magie: [fiammata] }));
  const e = dummy(s, 'bandito', 6, 1000);
  run(s, 1, inp({ c: true, a: true })); run(s, 40);
  assert.ok(s.fuochi.some((f) => f.amico), 'chiazza accesa');
  const v = dungeon.view(s).fuochi.find((f) => f.amico);
  assert.ok(v && v.amico === true);
  e.paralisi = s.tick + 100000; // fermo dentro il fuoco (se no, svegliato dal colpo, scappa dietro all'eroe)
  const v0 = e.vita;
  run(s, 3 * 60);
  assert.ok(v0 - e.vita > 5, `brucia: ${(v0 - e.vita).toFixed(1)}`);
  assert.equal(s.hero.brucia, 0);
  assert.ok((dungeon.result(s).xp.distruzione ?? 0) > 0);
  run(s, 6 * 60);
  assert.equal(s.fuochi.length, 0, 'si spegne dopo 4 s');
  // senza il perk niente chiazza
  const n = arena(heroBase({ magie: [fiammata] }));
  dummy(n, 'bandito', 6, 1000);
  run(n, 1, inp({ c: true, a: true })); run(n, 40);
  assert.equal(n.fuochi.length, 0);
});

test('Catena di fulmini: l\'elettricità salta al nemico più vicino entro 5 m con metà del danno', () => {
  const s = arena(conPerk({ catena: true }, { magie: [scintilla] }));
  const a = dummy(s, 'bandito', 8, 1000), b = dummy(s, 'bandito', 8, 1000, 3), lontano = dummy(s, 'bandito', 8, 1000, 9);
  const ev = [...run(s, 1, inp({ c: true, a: true })), ...run(s, 40)];
  const colA = colpiSu(ev, a.id)[0]!, colB = colpiSu(ev, b.id)[0]!;
  assert.ok(colA > 0 && colB > 0, `${colA} ${colB}`);
  assert.ok(Math.abs(colB - colA / 2) <= 1, `salto ${colB} vs ${colA}`);
  assert.equal(lontano.vita, 1000);
  assert.ok(ev.some((e) => e.t === 'catena'));
  // il fuoco non salta
  const f = arena(conPerk({ catena: true }, { magie: [fiammata] }));
  const f1 = dummy(f, 'bandito', 8, 1000), f2 = dummy(f, 'bandito', 8, 1000, 3);
  run(f, 1, inp({ c: true, a: true })); run(f, 40);
  assert.ok(f1.vita < 1000 && f2.vita === 1000);
});

const lupo = { id: 'lupo_spettrale', scuola: 'evocazione' as const, costo: 10, ricarica: 0.5, danno: 0, velocita: 0, raggio: 0, sanguina: 0, evoca: 'lupo_spettrale', durata: 60 };
/** Prima volta: C prende la magia in mano; poi basta la A. */
const evoca = (s: DungeonState): void => { run(s, 1, inp({ ...(s.hero.incanta ? {} : { c: true }), a: true })); run(s, 2); run(s, 60); };
const vivi = (s: DungeonState): Enemy[] => s.enemies.filter((e) => e.alleato && e.st !== 'morto');

test('Doppio richiamo: due evocazioni insieme, la terza manda via la più vecchia', () => {
  const s = arena(conPerk({ alleati: alleati({ max: 2 }) }, { magie: [lupo], max: { vita: 100, magicka: 1000, stamina: 100 } }));
  s.hero.magicka = 1000;
  evoca(s); assert.equal(vivi(s).length, 1);
  evoca(s); assert.equal(vivi(s).length, 2);
  const ids = vivi(s).map((e) => e.id);
  evoca(s);
  const dopo = vivi(s).map((e) => e.id);
  assert.equal(dopo.length, 2);
  assert.ok(!dopo.includes(ids[0]!) && dopo.includes(ids[1]!), 'la più vecchia se ne va');
  // senza il perk ne basta una
  const n = arena(heroBase({ magie: [lupo] }));
  n.hero.magicka = 1000;
  evoca(n); evoca(n);
  assert.equal(vivi(n).length, 1);
});

test('Banchetto: una parte del danno dell\'alleato cura chi l\'ha evocato', () => {
  const s = arena(conPerk({ alleati: alleati({ banchetto: 0.5 }) }, { magie: [lupo] }));
  evoca(s);
  s.hero.vita = 20;
  const t = dummy(s, 'bandito', 3, 1000); t.st = 'veglia'; t.paralisi = s.tick + 100000; // non risponde: contano solo i colpi dell'alleato
  const ev = run(s, 240);
  const dati = colpiSu(ev, t.id);
  assert.ok(dati.length > 0);
  assert.ok(s.hero.vita > 20 + dati.reduce((a, b) => a + b, 0) * 0.3, `vita ${s.hero.vita.toFixed(1)} dopo ${dati.length} colpi`);
  const n = arena(conPerk({ alleati: alleati() }, { magie: [lupo] }));
  evoca(n); n.hero.vita = 20;
  const t2 = dummy(n, 'bandito', 3, 1000); t2.st = 'veglia'; t2.paralisi = n.tick + 100000;
  run(n, 240);
  assert.ok(n.hero.vita < 25, 'senza Banchetto non si cura (solo la rigenerazione lenta)');
});

test('Medico da campo: la pozione che bevi cura anche il compagno vicino, non quello lontano', () => {
  const hero = (campo: boolean): RunHero => heroBase({ ...(campo ? { perk: { campo: true } } : {}), pozioni: [{ id: 'pozione_vita_minore', n: 3, cura: { vita: 40 }, buff: null }] });
  const party = (campo: boolean) => createPartyRun({ seed: 3, dungeon: 'grotta', eroi: [{ hero: hero(campo) }, { hero: hero(false) }] });
  const s = party(true);
  s.eroi[0]!.hero.vita = 30; s.eroi[1]!.hero.vita = 30;
  stepParty(s, [inp({ d: true }), inp()]);
  assert.ok(s.eroi[0]!.hero.vita >= 69, 'chi beve si cura');
  assert.ok(s.eroi[1]!.hero.vita >= 69, 'il compagno vicino pure');
  const lontano = party(true);
  lontano.eroi[0]!.hero.vita = 30; lontano.eroi[1]!.hero.vita = 30; lontano.eroi[1]!.hero.x += 40;
  stepParty(lontano, [inp({ d: true }), inp()]);
  assert.ok(lontano.eroi[1]!.hero.vita < 35, 'il compagno lontano no');
  const senza = party(false);
  senza.eroi[0]!.hero.vita = 30; senza.eroi[1]!.hero.vita = 30;
  stepParty(senza, [inp({ d: true }), inp()]);
  assert.ok(senza.eroi[1]!.hero.vita < 35, 'senza il perk no');
});

function lotWith(bs: Record<string, number>, hero: HeroState, forziere: Record<string, number> = {}): LotState {
  const l = newLot('jack', T0, null);
  const extra = Object.entries(bs).map(([b, level], i) => ({ id: `${b}-${i + 2}`, building: b, level, cell: [i + 1, 0] as [number, number], buffer: 0, lastMs: T0 }));
  return { ...l, buildings: [...l.buildings, ...extra], resources: { legno: 5000, pietra: 500, perle: 0 }, hero, forziere };
}
const act = (l: LotState, a: RpgAction): LotState => applyRpgAction(l, a, l.nowMs + 1000);

test('Doppia dose e Capolavoro: ogni preparazione ha la sua probabilità di venire doppia (stesso stato, stesso risultato)', () => {
  const base = newHero();
  const senza = { ...base, inv: { ...base.inv, erba_curativa: 80 } };
  const con1 = { ...senza, perk: ['alc_erborista', 'alc_doppia'] };
  const n0 = heroOf(act(lotWith({ alchimia: 1 }, senza), { t: 'alchimia', ricetta: 'r_vita_minore', n: 40 })).inv.pozione_vita_minore ?? 0;
  const l1 = act(lotWith({ alchimia: 1 }, con1), { t: 'alchimia', ricetta: 'r_vita_minore', n: 40 });
  const n1 = heroOf(l1).inv.pozione_vita_minore ?? 0;
  assert.ok(n1 > n0 && n1 < n0 + 40, `${n0} → ${n1}: qualcuna doppia, non tutte`);
  assert.equal(heroOf(act(lotWith({ alchimia: 1 }, con1), { t: 'alchimia', ricetta: 'r_vita_minore', n: 40 })).inv.pozione_vita_minore, n1, 'deterministico');
  // Capolavoro
  const totale = (l: LotState): number => (heroOf(l).inv.katana_legno ?? 0) + (l.forziere?.katana_legno ?? 0);
  const f0 = totale(act(lotWith({ banco: 1 }, base), { t: 'forgia', item: 'katana_legno', n: 20 }));
  const capo = { ...base, perk: ['fo_parsimonia', 'fo_maestro', 'fo_capolavoro'] };
  const f1 = totale(act(lotWith({ banco: 1 }, capo), { t: 'forgia', item: 'katana_legno', n: 20 }));
  assert.ok(f1 > f0, `${f0} → ${f1}`);
  assert.ok(f1 <= f0 + 20);
});
