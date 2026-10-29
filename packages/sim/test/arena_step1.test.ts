// Test Step 1 Arena PvP (docs/ARENA.md):
// 1. Normalizzazione a 100 di Vita, Magicka e Stamina in modalità Arena.
// 2. Calibrazione dei danni PvP tra giocatori: nessun one-shot su 100 di Vita (anche col colpo più pesante si arriva vicino ma mai >= 100).
// 3. Evocazioni costose (Scheletro evocato, Golem evocato) lanciabili da chi ha i perk di Evocazione, consumando anche tutta la Magicka.
// 4. Le 4 nuove magie di supporto (Cura a flusso, Cura a bomba, Furia a flusso, Furia a bomba) su evocazioni e compagni alleati.
// 5. Bilanciamento dei normali dungeon intatto + libri delle 4 nuove magie presenti nei dungeon.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, PERKS, RPG, SPELLS, dungeonDef, spellDef } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import { ITEMS, itemDef } from '../src/rpg/items.ts';
import { heroOf, newHero, runHeroArenaOf, runHeroOf } from '../src/rpg/hero.ts';
import { applyRpgAction } from '../src/rpg/actions.ts';
import { NO_DUNGEON_INPUT } from '../src/dungeon/types.ts';
import { dungeon as Dungeon, stepParty } from '../src/dungeon/dungeon.ts';
import { conEroe, createParty, evocaAlleato, secToTicks } from '../src/dungeon/state.ts';
import { dannoPvp, hitHero, hitHeroPvp } from '../src/dungeon/combat.ts';

describe('Arena Step 1 — Bilanciamento PvP e nuove magie di supporto', () => {
  it('1. normalizza a 100 Vita, Magicka e Stamina di base in modalità Arena lasciando intatti i normali dungeon', () => {
    const h = newHero();
    h.livello = 25;
    h.punti = { vita: 10, magicka: 8, stamina: 6 };
    h.perk = ['ev_riserva'];
    h.inv['anello_vita'] = 1;
    h.inv['unico_veste_arcimago'] = 1;
    h.equip.anello1 = 'anello_vita';
    h.equip.corpo = 'unico_veste_arcimago';

    const pve = runHeroOf(h);
    assert.ok(pve.max.vita > 100, 'nei normali dungeon i punti e gli anelli alzano la Vita oltre 100');
    assert.ok(pve.max.magicka > 100, 'nei normali dungeon i punti, le vesti e Riserva alzano la Magicka oltre 100');
    assert.ok(pve.max.stamina > 100, 'nei normali dungeon i punti alzano la Stamina oltre 100');
    assert.equal(pve.arena, undefined);

    const arena = runHeroArenaOf(h);
    assert.deepEqual(arena.max, { vita: 100, magicka: 100, stamina: 100 });
    assert.equal(arena.arena, true);

    const s = Dungeon.create({ seed: 1, dungeon: 'grotta', hero: arena, stato: h });
    assert.equal(s.hero.vita, 100);
    assert.equal(s.hero.magicka, 100);
    assert.equal(s.hero.stamina, 100);
  });

  it('2. calibra i danni PvP tra giocatori evitando qualsiasi one-shot su 100 di Vita (ci si può avvicinare ma mai >= 100)', () => {
    // Attaccante estremo: livello 100 in tutte le abilità, tutti i perk di danno e il Martello del Re delle Ossa (o Spadone di meteorite forgiato)
    const atk = newHero();
    for (const k of Object.keys(atk.skill) as (keyof typeof atk.skill)[]) atk.skill[k].lv = 100;
    atk.perk = PERKS.map((p) => p.id);
    atk.magie = SPELLS.map((s) => s.id);
    for (const it of ITEMS) atk.inv[it.id] = 10;

    // Bersaglio senza alcuna armatura (caso peggiore assoluto per un one-shot)
    const defNudo = newHero();
    delete defNudo.equip.corpo;
    const rhDefNudo = runHeroArenaOf(defNudo);

    for (const it of ITEMS) {
      if (it.kind !== 'arma' && it.kind !== 'arco') continue;
      atk.equip.arma = it.id;
      atk.equip.frecce = 'unico_frecce_abisso';
      const rhAtk = runHeroArenaOf(atk);
      const w = rhAtk.arma;
      const frDanno = w.kind === 'arco' ? (rhAtk.frecce?.danno ?? 0) : 0;

      // Colpo normale, colpo caricato e colpo con Carica massima + Pozione della forza (+30%) + Vento in Poppa (+45%) / Rintocco (+100%)
      const normale = dannoPvp(rhDefNudo.armatura, {
        danno: w.danno + frDanno, traits: w.traits, magico: false, skill: w.skill, caricato: false, dirX: 1, dirZ: 0, daAlleato: false,
      });
      const caricato = dannoPvp(rhDefNudo.armatura, {
        danno: (w.danno + frDanno) * w.caricaMolt, traits: w.traits, magico: false, skill: w.skill, caricato: true, dirX: 1, dirZ: 0, daAlleato: false,
      });
      const estremo = dannoPvp(rhDefNudo.armatura, {
        danno: (w.danno + frDanno) * w.caricaMolt * 1.5, traits: w.traits, magico: false, skill: w.skill, caricato: true, letale: true, dirX: 1, dirZ: 0, daAlleato: false,
      });

      assert.ok(normale < 100, `colpo normale di ${it.id} (${normale}) non deve fare one-shot`);
      assert.ok(caricato < 100, `colpo caricato di ${it.id} (${caricato}) non deve fare one-shot`);
      assert.ok(estremo < 100 && estremo <= RPG.arena.dannoMax, `colpo estremo di ${it.id} (${estremo}) non deve fare one-shot`);
    }

    // Verifica che i colpi più pesanti si avvicinino molto a 100 (es. >= 80) ma lascino vivo il bersaglio a 100 di Vita
    atk.equip.arma = 'unico_martello_re';
    const rhMartello = runHeroArenaOf(atk);
    const s = createParty(dungeonDef('grotta'), 42, [{ hero: rhMartello }, { hero: rhDefNudo }]);
    const dColpo = hitHeroPvp(s, 1, {
      danno: rhMartello.arma.danno * rhMartello.arma.caricaMolt,
      traits: rhMartello.arma.traits, magico: false, skill: 'armiPesanti', caricato: true, letale: true, dirX: 1, dirZ: 0, daAlleato: false,
    });
    assert.ok(dColpo >= 80 && dColpo < 100, `il colpo più pesante in PvP deve avvicinarsi a 100 senza uccidere (${dColpo})`);
    assert.ok(s.eroi[1]!.hero.vita > 0 && !s.eroi[1]!.done, 'il giocatore colpito a 100 di Vita deve sopravvivere al primo colpo');

    // Anche hitHero diretto in modalità Arena non può mai fare one-shot a chi ha 100 di Vita
    const sArena = Dungeon.create({ seed: 7, dungeon: 'grotta', hero: rhDefNudo });
    hitHero(sArena, 250, 'contundente', sArena.hero.x, sArena.hero.z);
    assert.ok(sArena.hero.vita > 0 && !sArena.done, 'hitHero in modalità Arena non può mai fare one-shot su 100 di Vita');
  });

  it('3. rende le magie di evocazione più costose (Scheletro, Golem) lanciabili con i perk di Evocazione consumando anche tutta la Magicka', () => {
    const senzaPerk = newHero();
    senzaPerk.magie = ['lupo_spettrale', 'scheletro_evocato', 'golem_evocato'];
    const rhSenza = runHeroArenaOf(senzaPerk);
    assert.equal(rhSenza.magie.find((m) => m.id === 'scheletro_evocato')?.costo, 110, 'senza perk Scheletro costa 110 (> 100)');
    assert.equal(rhSenza.magie.find((m) => m.id === 'golem_evocato')?.costo, 180, 'senza perk Golem costa 180 (> 100)');

    // Con i perk del ramo Evocazione, Scheletro e Golem sono lanciabili anche con 100 di Magicka (Golem consuma tutta la barra da 100)
    const conPerk = newHero();
    conPerk.perk = ['ev_richiamo'];
    conPerk.magie = ['lupo_spettrale', 'scheletro_evocato', 'golem_evocato'];
    conPerk.equip.magia = 'golem_evocato';
    conPerk.equip.mano = 'magia';

    const rhCon = runHeroArenaOf(conPerk);
    const spScheletro = rhCon.magie.find((m) => m.id === 'scheletro_evocato')!;
    const spGolem = rhCon.magie.find((m) => m.id === 'golem_evocato')!;
    assert.ok(spScheletro.costo <= 100, `con perk Scheletro è lanciabile (${spScheletro.costo} <= 100)`);
    assert.equal(spGolem.costo, 100, 'con perk Golem consuma tutta la Magicka disponibile (100)');

    // Verifica il lancio effettivo del Golem in partita con 100 di Magicka
    const s = Dungeon.create({ seed: 11, dungeon: 'grotta', hero: rhCon, stato: conPerk });
    s.enemies.length = 0;
    Dungeon.step(s, { ...NO_DUNGEON_INPUT, a: true });
    Dungeon.step(s, { ...NO_DUNGEON_INPUT, a: false });
    const golem = s.enemies.find((e) => e.alleato && e.tipo === 'golem_evocato');
    assert.ok(golem, 'il Golem evocato deve nascere');
    assert.ok(s.hero.magicka < 1, 'il lancio del Golem consuma tutta la barra di Magicka');
  });

  it('4. le 4 nuove magie di supporto (Cura a flusso, Cura a bomba, Furia a flusso, Furia a bomba) curano e potenziano evocazioni e alleati', () => {
    for (const id of ['cura_flusso', 'cura_bomba', 'furia_flusso', 'furia_bomba']) {
      const def = spellDef(id);
      assert.equal(def.scuola, 'supporto');
      assert.ok(itemDef(`libro_${id}`).insegna === id, `esiste il libro per ${id}`);
    }

    // 4a. Cura a flusso e Furia a flusso su un'evocazione alleata
    const h = newHero();
    h.magie = ['cura_flusso', 'cura_bomba', 'furia_flusso', 'furia_bomba'];
    h.equip.magia = 'cura_flusso';
    h.equip.mano = 'magia';
    const s = Dungeon.create({ seed: 21, dungeon: 'grotta', hero: runHeroArenaOf(h), stato: h });
    s.enemies.length = 0;
    const lupo = evocaAlleato(s, 'lupo_spettrale', secToTicks(30), s.hero.fx, s.hero.fz);
    lupo.vita = 10;

    // Tieni premuto A per 30 tick (mezzo secondo di Cura a flusso)
    for (let i = 0; i < 30; i++) Dungeon.step(s, { ...NO_DUNGEON_INPUT, a: true });
    Dungeon.step(s, { ...NO_DUNGEON_INPUT, a: false });
    assert.ok(lupo.vita > 15, `Cura a flusso deve rigenerare la vita dell'evocazione (${lupo.vita} > 15)`);

    // Passa a Furia a flusso e potenzia il lupo
    Dungeon.act(s, { t: 'equip', slot: 'magia', item: 'furia_flusso' });
    s.hero.cdMagia = 0; s.hero.magicka = 100;
    for (let i = 0; i < 12; i++) Dungeon.step(s, { ...NO_DUNGEON_INPUT, a: true });
    Dungeon.step(s, { ...NO_DUNGEON_INPUT, a: false });
    assert.ok((lupo.potT ?? 0) > s.tick, 'Furia a flusso attiva potT sull\'evocazione');
    assert.equal(lupo.potM, 1 + (spellDef('furia_flusso').furia?.danno ?? 0));
    assert.equal(lupo.potV, 1 + (spellDef('furia_flusso').furia?.velocita ?? 0));

    // 4b. Cura a bomba e Furia a bomba su compagno di squadra ed evocazione nell'area
    const h1 = newHero();
    h1.magie = ['cura_bomba', 'furia_bomba'];
    h1.equip.magia = 'cura_bomba';
    h1.equip.mano = 'magia';
    const h2 = newHero();
    const party = createParty(dungeonDef('grotta'), 33, [{ hero: runHeroArenaOf(h1), stato: h1 }, { hero: runHeroArenaOf(h2), stato: h2 }]);
    party.enemies.length = 0;
    // Mettiamo il compagno e un'evocazione 2 m davanti all'eroe 0
    const comp = party.eroi[1]!;
    comp.hero.x = party.hero.x + party.hero.fx * 2;
    comp.hero.z = party.hero.z + party.hero.fz * 2;
    comp.hero.vita = 30;
    const scheletro = conEroe(party, 0, () => evocaAlleato(party, 'scheletro_evocato', secToTicks(40), party.hero.fx, party.hero.fz));
    scheletro.x = comp.hero.x; scheletro.z = comp.hero.z;
    scheletro.vita = 20;

    // Lancia Cura a bomba (premi e rilascia A) e fai volare la bomba fino all'impatto
    stepParty(party, [{ ...NO_DUNGEON_INPUT, a: true }, NO_DUNGEON_INPUT]);
    stepParty(party, [{ ...NO_DUNGEON_INPUT, a: false }, NO_DUNGEON_INPUT]);
    for (let i = 0; i < 75; i++) stepParty(party, [NO_DUNGEON_INPUT, NO_DUNGEON_INPUT]);
    assert.ok(comp.hero.vita >= 75, `Cura a bomba deve curare il compagno (${comp.hero.vita})`);
    assert.ok(scheletro.vita >= 65, `Cura a bomba deve curare l'evocazione (${scheletro.vita})`);

    // Lancia Furia a bomba
    party.eroi[0]!.runHero.magia = 1; // furia_bomba
    party.eroi[0]!.hero.cdMagia = 0;
    party.eroi[0]!.hero.magicka = 100;
    scheletro.potT = undefined;
    stepParty(party, [{ ...NO_DUNGEON_INPUT, a: true }, NO_DUNGEON_INPUT]);
    stepParty(party, [{ ...NO_DUNGEON_INPUT, a: false }, NO_DUNGEON_INPUT]);
    for (let i = 0; i < 75; i++) stepParty(party, [NO_DUNGEON_INPUT, NO_DUNGEON_INPUT]);
    assert.ok((scheletro.potT ?? 0) > party.tick, 'Furia a bomba potenzia l\'evocazione nel raggio');
    assert.ok(comp.hero.buffs.some((b) => b.mod === 'furiaDanno' && b.fine > party.tick), 'Furia a bomba potenzia il danno del compagno nel raggio');
    assert.ok(comp.hero.buffs.some((b) => b.mod === 'furiaVel' && b.fine > party.tick), 'Furia a bomba potenzia la velocità del compagno nel raggio');
  });

  it('5. rende disponibili i libri delle 4 nuove magie nei normali dungeon e permette di impararle leggendoli', () => {
    let lot = newLot('p1', 0);
    for (const id of ['cura_flusso', 'cura_bomba', 'furia_flusso', 'furia_bomba']) {
      const libro = `libro_${id}`;
      const h = heroOf(lot);
      h.inv[libro] = 1;
      lot = applyRpgAction({ ...lot, hero: h }, { t: 'leggi', item: libro }, 0);
      assert.ok(heroOf(lot).magie.includes(id), `leggere ${libro} insegna ${id}`);
    }
    assert.equal(DUNGEONS.length, 9);
  });
});
