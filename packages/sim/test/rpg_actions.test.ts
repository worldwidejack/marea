// Azioni del personaggio sull'isola: attributi, perk, equip, libri, forgia, alchimia, bottega, Forziere, Serra, forma di rete, determinismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPG } from '@marea/content/rpg.ts';
import { collectAll, newLot } from '../src/economy/actions.ts';
import { advance } from '../src/economy/advance.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { hashJson } from '../src/hash.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { gainSkillXp, heroOf, newHero } from '../src/rpg/hero.ts';
import type { HeroState, RpgAction } from '../src/rpg/types.ts';

const T0 = 1_800_000_000_000, H = 3_600_000;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
/** Lotto con gli edifici dati già costruiti (id → livello) e tanto Legno. */
function lotWith(bs: Record<string, number>, hero?: HeroState, forziere?: Record<string, number>): LotState {
  const l = newLot('jack', T0, null);
  const extra = Object.entries(bs).map(([b, level], i) => ({ id: `${b}-${i + 2}`, building: b, level, cell: [i + 1, 0] as [number, number], buffer: 0, lastMs: T0 }));
  const out: LotState = { ...l, buildings: [...l.buildings, ...extra], resources: { legno: 500, pietra: 500, perle: 0 } };
  if (hero) out.hero = hero;
  if (forziere) out.forziere = forziere;
  return out;
}
const act = (l: LotState, a: RpgAction, dt = 1000): LotState => applyRpgAction(l, a, l.nowMs + dt);
const withInv = (inv: Record<string, number>, h: HeroState = newHero()): HeroState => ({ ...h, inv: { ...h.inv, ...inv } });

test('rpg azioni: attributo e perk con punti, livello di abilità e prerequisiti', () => {
  let l = lotWith({});
  assert.throws(() => act(l, { t: 'attributo', attr: 'vita' }), isErr('livello'));
  let h = gainSkillXp(newHero(), 'armiLeggere', 3000);
  assert.ok(h.skill.armiLeggere.lv >= 30 && h.scelte > 0 && h.perkPunti > 1);
  l = lotWith({}, h);
  const v0 = l.version;
  l = act(l, { t: 'attributo', attr: 'stamina' });
  assert.equal(heroOf(l).punti.stamina, 1);
  assert.equal(heroOf(l).scelte, h.scelte - 1);
  assert.ok(l.version > v0);
  assert.throws(() => act(l, { t: 'perk', perk: 'al_polso' }), isErr('perk'), 'serve prima Lama affilata');
  assert.throws(() => act(l, { t: 'perk', perk: 'ap_braccia' }), isErr('livello_skill'));
  assert.throws(() => act(l, { t: 'perk', perk: 'boh' }), isErr('sconosciuto'));
  l = act(l, { t: 'perk', perk: 'al_lama' });
  l = act(l, { t: 'perk', perk: 'al_polso' });
  assert.deepEqual(heroOf(l).perk, ['al_lama', 'al_polso']);
  assert.throws(() => act(l, { t: 'perk', perk: 'al_lama' }), isErr('unico'));
  h = { ...heroOf(l), perkPunti: 0 };
  assert.throws(() => act({ ...l, hero: h }, { t: 'perk', perk: 'al_maestro' }), isErr('perk'));
});

test('rpg azioni: equip controlla slot, tipo e zaino; leggere un libro insegna la magia', () => {
  let l = lotWith({}, withInv({ spadone_ferro: 1, anello_vita_debole: 1, libro_fulmine: 1, libro_lupo_spettrale: 1 }));
  l = act(l, { t: 'equip', slot: 'arma', item: 'spadone_ferro' });
  assert.equal(heroOf(l).equip.arma, 'spadone_ferro');
  l = act(l, { t: 'equip', slot: 'arma', item: 'arco_legno' });
  assert.equal(heroOf(l).equip.arma, 'arco_legno', 'l\'arco va nello slot arma');
  assert.throws(() => act(l, { t: 'equip', slot: 'corpo', item: 'spadone_ferro' }), isErr('equip'));
  assert.throws(() => act(l, { t: 'equip', slot: 'arma', item: 'martello_ferro' }), isErr('oggetto'));
  l = act(l, { t: 'equip', slot: 'anello1', item: 'anello_vita_debole' });
  assert.throws(() => act(l, { t: 'equip', slot: 'anello2', item: 'anello_vita_debole' }), isErr('oggetto'), 'una copia sola');
  assert.throws(() => act(l, { t: 'equip', slot: 'magia', item: 'fulmine' }), isErr('equip'));
  l = act(l, { t: 'equip', slot: 'corpo', item: null });
  assert.equal(heroOf(l).equip.corpo, undefined);
  assert.throws(() => act(l, { t: 'leggi', item: 'libro_fulmine' }), isErr('livello_skill'), 'Distruzione 30');
  l = act(l, { t: 'leggi', item: 'libro_lupo_spettrale' });
  assert.deepEqual(heroOf(l).magie, ['fiammata', 'lupo_spettrale']);
  assert.equal(heroOf(l).inv.libro_lupo_spettrale, undefined, 'il libro si consuma');
  l = act(l, { t: 'equip', slot: 'magia', item: 'lupo_spettrale' });
  assert.equal(heroOf(l).equip.magia, 'lupo_spettrale');
  assert.throws(() => act(l, { t: 'leggi', item: 'pozione_vita_minore' }), isErr('oggetto'));
});

test('rpg azioni: forgia con Banco, livello del Banco, materiali da zaino e Forziere, Legno del Magazzino, perk e xp', () => {
  const h = withInv({ lingotto_ferro: 3 });
  assert.throws(() => act(lotWith({}, h), { t: 'forgia', item: 'katana_ferro' }), isErr('edificio'));
  assert.throws(() => act(lotWith({ banco: 1 }, h), { t: 'forgia', item: 'katana_argento' }), isErr('livello'));
  assert.throws(() => act(lotWith({ banco: 1 }, h), { t: 'forgia', item: 'katana_ferro' }), isErr('materiale'), '3 lingotti su 4');
  assert.throws(() => act(lotWith({ banco: 3 }, h), { t: 'forgia', item: 'unico_martello_re' }), isErr('oggetto'));
  // 3 nello zaino + 1 nel Forziere bastano
  let l = act(lotWith({ banco: 1, forziere: 1 }, h, { lingotto_ferro: 1 }), { t: 'forgia', item: 'katana_ferro' });
  assert.equal(heroOf(l).inv.katana_ferro, 1);
  assert.equal(heroOf(l).inv.lingotto_ferro, undefined);
  assert.equal(l.forziere?.lingotto_ferro, undefined);
  assert.ok(heroOf(l).skill.forgiatura.xp > 0, 'xp di Forgiatura');
  // legno: si paga col Legno del Magazzino; 10 frecce per forgiata
  l = act(lotWith({ banco: 1 }), { t: 'forgia', item: 'frecce_legno', n: 2 });
  assert.equal(l.resources.legno, 500 - 10);
  assert.equal(heroOf(l).inv.frecce_legno, 20 + 20);
  assert.equal(l.ledger.spent.legno, 10);
  const povero = { ...lotWith({ banco: 1 }), resources: { legno: 5, pietra: 0, perle: 0 } };
  assert.throws(() => act(povero, { t: 'forgia', item: 'katana_legno' }), (e: unknown) => isErr('risorse')(e) && (e as EconomyError).manca?.legno === 15);
  // Mano parsimoniosa: −20 % di materiale (4 → 4 × 0,8 = 3,2 → 4 arrotondato su; 6 → 5)
  const fabbro: HeroState = { ...withInv({ lingotto_ferro: 5 }), perk: ['fo_parsimonia'] };
  l = act(lotWith({ banco: 1 }, fabbro), { t: 'forgia', item: 'martello_ferro' });
  assert.equal(heroOf(l).inv.lingotto_ferro, undefined, 'martello: 6 lingotti × 0,8 = 5');
});

test('rpg azioni: alchimia con Tavolo, livello di Alchimia, ingredienti da zaino e Forziere', () => {
  const h = withInv({ erba_curativa: 3 });
  assert.throws(() => act(lotWith({}, h), { t: 'alchimia', ricetta: 'r_vita_minore' }), isErr('edificio'));
  assert.throws(() => act(lotWith({ alchimia: 1 }, h), { t: 'alchimia', ricetta: 'r_vita' }), isErr('livello_skill'));
  assert.throws(() => act(lotWith({ alchimia: 1 }, h), { t: 'alchimia', ricetta: 'r_vita_minore', n: 2 }), isErr('materiale'));
  assert.throws(() => act(lotWith({ alchimia: 1 }, h), { t: 'alchimia', ricetta: 'r_niente' }), isErr('sconosciuto'));
  const l = act(lotWith({ alchimia: 1, forziere: 1 }, h, { erba_curativa: 1 }), { t: 'alchimia', ricetta: 'r_vita_minore', n: 2 });
  assert.equal(heroOf(l).inv.pozione_vita_minore, 2 + 2);
  assert.equal(heroOf(l).inv.erba_curativa, undefined);
  assert.equal(l.forziere?.erba_curativa, undefined);
  assert.ok(heroOf(l).skill.alchimia.xp > 0);
});

test('rpg azioni: bottega al Banco con le monete', () => {
  const h = { ...newHero(), monete: 30 };
  assert.throws(() => act(lotWith({}, h), { t: 'compra', item: 'lingotto_ferro', n: 1 }), isErr('edificio'));
  assert.throws(() => act(lotWith({ banco: 1 }, h), { t: 'compra', item: 'lingotto_argento', n: 1 }), isErr('oggetto'));
  assert.throws(() => act(lotWith({ banco: 1 }, h), { t: 'compra', item: 'lingotto_ferro', n: 2 }), isErr('risorse'));
  const l = act(lotWith({ banco: 1 }, h), { t: 'compra', item: 'lingotto_bronzo', n: 2 });
  assert.equal(heroOf(l).inv.lingotto_bronzo, 2);
  assert.equal(heroOf(l).monete, 30 - 2 * RPG.bottega.lingotto_bronzo!);
});

test('rpg azioni: Forziere con capienza per livello, niente equipaggiati, zaino a peso', () => {
  const h = withInv({ lingotto_ferro: 120, martello_ferro: 1 });
  assert.throws(() => act(lotWith({}, h), { t: 'deposita', item: 'lingotto_ferro', n: 1 }), isErr('edificio'));
  let l = act(lotWith({ forziere: 1 }, h), { t: 'deposita', item: 'lingotto_ferro', n: 100 });
  assert.equal(l.forziere?.lingotto_ferro, 100);
  assert.throws(() => act(l, { t: 'deposita', item: 'lingotto_ferro', n: 1 }), isErr('peso'), 'L1 = 100 kg');
  const l2 = act(lotWith({ forziere: 2 }, heroOf(l), l.forziere), { t: 'deposita', item: 'lingotto_ferro', n: 20 });
  assert.equal(l2.forziere?.lingotto_ferro, 120, 'L2 = 250 kg');
  assert.throws(() => act(l, { t: 'deposita', item: 'katana_legno', n: 1 }), isErr('equip'));
  assert.throws(() => act(l, { t: 'deposita', item: 'anello_vita', n: 1 }), isErr('oggetto'));
  l = act(l, { t: 'preleva', item: 'lingotto_ferro', n: 30 });
  assert.equal(l.forziere?.lingotto_ferro, 70);
  assert.equal(heroOf(l).inv.lingotto_ferro, 50);
  assert.throws(() => act(l, { t: 'preleva', item: 'lingotto_ferro', n: 70 }), isErr('peso'), 'lo zaino regge 100 kg');
  assert.throws(() => act(l, { t: 'preleva', item: 'lingotto_argento', n: 1 }), isErr('oggetto'));
});

test('rpg Serra: accumula come la Segheria, collectAll non la tocca, l\'azione la raccoglie a rotazione', () => {
  let l = lotWith({ serra: 1 });
  l = advance(l, T0 + 5 * H);
  const serra = () => l.buildings.find((b) => b.building === 'serra')!;
  assert.equal(serra().buffer, 20, '4 ingredienti/ora × 5 h');
  const res = l.resources;
  l = collectAll(l, l.nowMs + 1);
  assert.ok(serra().buffer >= 20, 'collectAll non svuota la Serra');
  assert.deepEqual(l.resources, res);
  // senza Forziere: nello zaino
  const z = act(l, { t: 'serra' });
  const inv = heroOf(z).inv;
  assert.equal((inv.erba_curativa ?? 0) + (inv.fiore_azzurro ?? 0) + (inv.radice_vigore ?? 0), 20);
  for (const id of ['erba_curativa', 'fiore_azzurro', 'radice_vigore']) assert.ok((inv[id] ?? 0) >= 6, `${id} a rotazione`);
  assert.ok(z.buildings.find((b) => b.building === 'serra')!.buffer < 1);
  // con Forziere: nel Forziere
  const f = act({ ...l, buildings: [...l.buildings, { id: 'forziere-9', building: 'forziere', level: 1, cell: [9, 0], buffer: 0, lastMs: T0 }] }, { t: 'serra' });
  assert.equal(Object.values(f.forziere ?? {}).reduce((a, b) => a + b, 0), 20);
  assert.throws(() => act(lotWith({}), { t: 'serra' }), isErr('edificio'));
});

test('rpg parseRpgAction: solo forme valide, oggetto pulito', () => {
  assert.deepEqual(parseRpgAction({ t: 'forgia', item: 'katana_ferro', extra: 1 }), { t: 'forgia', item: 'katana_ferro' });
  assert.deepEqual(parseRpgAction({ t: 'equip', slot: 'corpo', item: null }), { t: 'equip', slot: 'corpo', item: null });
  assert.deepEqual(parseRpgAction({ t: 'deposita', item: 'x', n: 999 }), { t: 'deposita', item: 'x', n: 999 });
  assert.deepEqual(parseRpgAction({ t: 'serra' }), { t: 'serra' });
  for (const bad of [null, 1, 'serra', [], { t: 'boh' }, { t: 'attributo', attr: 'forza' }, { t: 'compra', item: 'x', n: 0 }, { t: 'compra', item: 'x', n: 1.5 },
    { t: 'compra', item: 'x', n: 1000 }, { t: 'compra', item: 'x' }, { t: 'leggi', item: '' }, { t: 'leggi', item: 'x'.repeat(41) }, { t: 'equip', slot: 'testa', item: 'x' },
    { t: 'alchimia', ricetta: 'r', n: -1 }, { t: 'perk', perk: 3 }]) assert.equal(parseRpgAction(bad), null, JSON.stringify(bad));
});

test('rpg azioni: deterministiche (stesse azioni = stesso hash) e pure (lo stato di partenza non cambia)', () => {
  const run = () => {
    let l = lotWith({ banco: 1, alchimia: 1, forziere: 1, serra: 1 }, withInv({ lingotto_ferro: 8, erba_curativa: 4 }));
    const start = JSON.stringify(l);
    const seq: RpgAction[] = [{ t: 'forgia', item: 'katana_ferro' }, { t: 'equip', slot: 'arma', item: 'katana_ferro' }, { t: 'alchimia', ricetta: 'r_vita_minore', n: 2 },
      { t: 'deposita', item: 'lingotto_ferro', n: 4 }, { t: 'serra' }, { t: 'forgia', item: 'frecce_legno' }];
    let t = T0;
    for (const a of seq) { t += 2 * H; l = applyRpgAction(l, a, t); }
    return { l, start };
  };
  const a = run(), b = run();
  assert.equal(hashJson(a.l), hashJson(b.l));
  assert.equal(heroOf(a.l).equip.arma, 'katana_ferro');
  const again = lotWith({ banco: 1, alchimia: 1, forziere: 1, serra: 1 }, withInv({ lingotto_ferro: 8, erba_curativa: 4 }));
  assert.equal(JSON.stringify(again), a.start);
});
