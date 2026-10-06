// Personaggio: nascita, salita di livello, numeri derivati e fotografia per il dungeon (RunHero).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPG } from '@marea/content/rpg.ts';
import { carried, gainSkillXp, heroDerived, newHero, runHeroOf, skillXpNeeded } from '../src/rpg/hero.ts';
import type { HeroState } from '../src/rpg/types.ts';

/** Personaggio con un oggetto nello zaino e già equipaggiato. */
function wearing(slot: keyof HeroState['equip'], id: string, h: HeroState = newHero()): HeroState {
  return { ...h, inv: { ...h.inv, [id]: (h.inv[id] ?? 0) + 1 }, equip: { ...h.equip, [slot]: id } };
}

test('rpg eroe: nasce da RPG.partenza con katana, vesti di tela, pozione rapida e Fiammata', () => {
  const h = newHero();
  assert.equal(h.livello, 1);
  assert.equal(h.skill.alchimia.lv, RPG.livelli.skillIniziale);
  assert.deepEqual(h.magie, ['fiammata']);
  const r = runHeroOf(h);
  assert.equal(r.arma.id, 'katana_legno');
  assert.equal(r.arma.kind, 'mischia');
  assert.equal(r.armatura.id, 'armatura_legno');
  assert.equal(r.armatura.malus, 0, 'le vesti di tela non rallentano');
  assert.equal(r.magie[r.magia!]?.id, 'fiammata');
  assert.equal(r.pozioni[r.pozione!]?.id, 'pozione_vita_minore');
  assert.equal(r.frecce?.n, 20);
  assert.ok(r.carico > 0 && r.carico === carried(h) && r.carico < r.caricoMax);
  assert.equal(Object.keys(r.pesi).length > 100, true);
  assert.equal(r.pesi.lingotto_ferro, 1);
  const d = heroDerived(h);
  assert.equal(d.max.vita, 100);
  assert.equal(d.xpProssimo, RPG.livelli.xpPersonaggio.base);
});

test('rpg eroe: l\'abilità sale, il personaggio sale a cascata (scelte e perk), tetto a skillMax', () => {
  let h = newHero();
  h = gainSkillXp(h, 'forgiatura', skillXpNeeded(15) - 1);
  assert.equal(h.skill.forgiatura.lv, 15);
  h = gainSkillXp(h, 'forgiatura', 1);
  assert.equal(h.skill.forgiatura.lv, 16);
  assert.equal(h.xp, 16, 'ogni livello di abilità dà xp pari al nuovo livello');
  assert.equal(h.livello, 1);
  h = gainSkillXp(h, 'forgiatura', 2000);
  assert.ok(h.livello > 1 && h.scelte === h.livello - 1 && h.perkPunti === h.livello - 1, `livello ${h.livello}`);
  h = gainSkillXp(h, 'forgiatura', 1e7);
  assert.equal(h.skill.forgiatura.lv, RPG.livelli.skillMax);
  assert.equal(h.skill.forgiatura.xp, 0);
  const same = gainSkillXp(h, 'forgiatura', 500);
  assert.equal(same, h, 'a skillMax non cambia niente');
  assert.equal(gainSkillXp(h, 'arceria', -5), h);
  assert.equal(gainSkillXp(h, 'arceria', Number.NaN), h);
});

test('rpg eroe: ossa più lente, meteorite più veloce, Stamina che compensa il peso', () => {
  const tela = runHeroOf(newHero());
  const ossa = runHeroOf(wearing('corpo', 'armatura_ossa'));
  const meteo = runHeroOf(wearing('corpo', 'armatura_meteorite'));
  // camminata e tempo dell'arma arrivano senza malus: la sim del dungeon li moltiplica per (1 − malus) × velocitaMolt
  const passo = (r: typeof tela) => r.camminata * (1 - r.armatura.malus) * r.armatura.velocitaMolt;
  assert.ok(ossa.armatura.malus > 0.3 && passo(ossa) < passo(tela), 'ossa: bradipo');
  assert.ok(heroDerived(wearing('corpo', 'armatura_ossa')).velocita < heroDerived(newHero()).velocita, 'e attacca più piano');
  assert.ok(ossa.armatura.difesa > meteo.armatura.difesa && ossa.armatura.terrore > 0);
  assert.ok(meteo.armatura.velocitaMolt > 1 && passo(meteo) > passo(tela) && meteo.armatura.malus === 0, 'meteorite: corri di più');
  const forte = runHeroOf({ ...wearing('corpo', 'armatura_ossa'), punti: { vita: 0, magicka: 0, stamina: 10 } });
  assert.ok(forte.armatura.malus < ossa.armatura.malus, 'la Stamina attenua il malus');
  assert.ok(forte.caricoMax > ossa.caricoMax, 'e alza il peso trasportabile');
  const cinghie = runHeroOf({ ...wearing('corpo', 'armatura_ossa'), perk: ['fo_cinghie'] });
  assert.ok(Math.abs(cinghie.armatura.malus - ossa.armatura.malus / 2) < 0.011);
});

test('rpg eroe: tratti di argento, oro, vetro e meteorite arrivano nella fotografia', () => {
  const arg = runHeroOf(wearing('corpo', 'armatura_argento', wearing('arma', 'spadone_argento')));
  assert.equal(arg.arma.traits.bonusVs?.nonmorto, 2);
  assert.equal(arg.arma.skill, 'armiPesanti');
  assert.equal(arg.armatura.vsMagia, 0.5);
  const oro = runHeroOf(wearing('corpo', 'armatura_oro', wearing('arma', 'nunchaku_oro')));
  assert.equal(oro.arma.traits.dropMolt, 2);
  assert.ok(oro.armatura.moneteSuColpito > 0);
  const vetro = runHeroOf(wearing('corpo', 'armatura_vetro', { ...wearing('arma', 'katana_vetro'), usura: { katana_vetro: 12 } }));
  assert.equal(vetro.arma.traits.fragile, 60);
  assert.equal(vetro.arma.usura, 12);
  assert.equal(vetro.armatura.vsContundente, 2);
  const meteo = runHeroOf(wearing('arma', 'martello_meteorite'));
  assert.equal(meteo.arma.traits.penetra, 0.5);
  const arco = runHeroOf(wearing('frecce', 'frecce_argento', wearing('arma', 'arco_argento')));
  assert.equal(arco.arma.kind, 'arco');
  assert.equal(arco.arma.skill, 'arceria');
  assert.equal(arco.arma.traits.moltArgento, 2);
  assert.equal(arco.frecce?.traits.bonusVs?.bestia, 0.3);
  const unico = runHeroOf(wearing('arma', 'unico_katana_spettro'));
  assert.equal(unico.arma.traits.fragile, 0, 'l\'unico di vetro non si rompe');
});

test('rpg eroe: pugni senza arma, anelli, vesti, perk e potenza delle pozioni', () => {
  const h0 = newHero();
  const nudo = runHeroOf({ ...h0, equip: {} });
  assert.equal(nudo.arma.kind, 'pugni');
  assert.equal(nudo.arma.id, null);
  assert.equal(nudo.magia, null);
  assert.equal(nudo.pozione, null);
  assert.equal(runHeroOf(wearing('anello1', 'anello_vita_debole')).max.vita, 120);
  const doppio = wearing('anello2', 'anello_vita_debole', wearing('anello1', 'anello_vita_debole'));
  assert.equal(runHeroOf(doppio).max.vita, 140, 'due anelli uguali: servono due copie');
  assert.equal(runHeroOf({ ...doppio, inv: { ...doppio.inv, anello_vita_debole: 1 } }).max.vita, 120);
  const veste = runHeroOf(wearing('corpo', 'veste_distruzione'));
  assert.equal(veste.max.magicka, 140);
  assert.equal(veste.armatura.difesa, 0);
  assert.ok(veste.magie[0]!.costo < 15 && veste.magie[0]!.danno > 14);
  const base = runHeroOf(h0).arma.danno;
  assert.ok(runHeroOf({ ...h0, perk: ['al_lama'] }).arma.danno > base);
  assert.ok(runHeroOf({ ...h0, perk: ['al_lama', 'al_polso'] }).arma.tempo < runHeroOf(h0).arma.tempo);
  const alchimista = runHeroOf({ ...h0, skill: { ...h0.skill, alchimia: { lv: 65, xp: 0 } } });
  assert.ok(alchimista.pozioni[0]!.cura.vita! > runHeroOf(h0).pozioni[0]!.cura.vita!, 'più Alchimia = pozioni più forti');
  const esperto = runHeroOf({ ...h0, skill: { ...h0.skill, armiLeggere: { lv: 80, xp: 0 } } });
  assert.ok(esperto.arma.danno > base, 'più abilità = più danno');
});
