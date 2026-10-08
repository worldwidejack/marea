// Contrabbandiere del Porto: banco del giorno (mezzanotte di Roma, solo roba del suo banco), prezzi (niente guadagni facili), azioni.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, RPG } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { applyRpgAction, parseRpgAction } from '../src/rpg/actions.ts';
import { CATEGORIE_LOSCHE, bancoDi, finoAMezzanotte, giornoRoma, offertaLosca, prezzoLosco, valoreDi } from '../src/rpg/contrabbando.ts';
import { heroOf, newHero } from '../src/rpg/hero.ts';
import { ITEMS, hasItem, itemDef } from '../src/rpg/items.ts';
import type { HeroState } from '../src/rpg/types.ts';

const H = 3_600_000, D = 24 * H;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
const lotOf = (h: HeroState, ms: number): LotState => ({ ...newLot('jack', ms, null), hero: h });

test('contrabbando: il banco ha solo oggetti che esistono, della categoria giusta, niente unici', () => {
  const kinds: Record<string, readonly string[]> = { arma: ['arma', 'arco'], armatura: ['armatura', 'veste'], materiale: ['materiale'], ingrediente: ['ingrediente'] };
  for (const cat of CATEGORIE_LOSCHE) for (const id of RPG.contrabbando.banco[cat]) {
    assert.ok(hasItem(id), `banco ${id}`);
    assert.ok(kinds[cat]!.includes(itemDef(id).kind), `${id} non è ${cat}`);
    assert.ok(!itemDef(id).unico, `${id} è unico`);
  }
  for (const id of Object.keys(RPG.contrabbando.valori)) assert.ok(id === 'risorsa:legno' || hasItem(id), `valori ${id}`);
});

test('contrabbando: cambia a mezzanotte di Roma (inverno UTC+1, estate UTC+2), mai uguale al giorno prima', () => {
  const inverno = Date.UTC(2026, 11, 27, 22, 59), estate = Date.UTC(2026, 6, 10, 21, 59);
  assert.equal(giornoRoma(inverno + 60_000), giornoRoma(inverno) + 1);
  assert.equal(giornoRoma(estate + 60_000), giornoRoma(estate) + 1);
  assert.equal(finoAMezzanotte(inverno), 60_000);
  assert.equal(finoAMezzanotte(estate), 60_000);
  assert.deepEqual(bancoDi(inverno), bancoDi(inverno - 20 * H));
  const visti = new Set<string>();
  for (let g = 0; g < 60; g++) {
    const oggi = bancoDi(inverno + g * D), ieri = bancoDi(inverno + (g - 1) * D);
    for (const cat of CATEGORIE_LOSCHE) {
      assert.ok(RPG.contrabbando.banco[cat].includes(oggi[cat]));
      assert.notEqual(oggi[cat], ieri[cat], `${cat} uguale due giorni di fila`);
      visti.add(oggi[cat]);
    }
  }
  assert.ok(visti.size > 15, 'in due mesi gira quasi tutto il banco');
});

test('contrabbando: tutto ha un valore, vende caro e compra poco (niente guadagni comprando e rivendendo)', () => {
  for (const it of ITEMS) {
    assert.ok(valoreDi(it.id) > 0, `${it.id} senza valore`);
    assert.ok(prezzoLosco(it.id) > offertaLosca(it.id, 1) * 3, `${it.id}: rivenderlo rende troppo`);
  }
  // bottega del Banco → contrabbandiere: si perde sempre
  for (const [id, p] of Object.entries(RPG.bottega)) assert.ok(offertaLosca(id, 10) < p * 10, `bottega ${id}`);
  // forgiare col Legno e rivendere non dà monete: 20 Legno = 1 moneta al massimo
  assert.ok(offertaLosca('katana_legno', 1) <= 1);
  assert.equal(offertaLosca('frecce_legno', 20), 0);
  // pozioni: vendere quel che hai preparato rende un po' più degli ingredienti, ma resta sotto il prezzo degli ingredienti in bottega
  const r = RECIPES.find((x) => x.risultato === 'pozione_vita_minore')!;
  assert.ok(offertaLosca('pozione_vita_minore', 1) < Object.entries(r.ingredienti).reduce((s, [m, q]) => s + (RPG.bottega[m] ?? 0) * q, 0));
});

test('contrabbando: compra la merce di oggi nello zaino, vende dallo zaino, non quel che hai addosso', () => {
  const ms = Date.UTC(2026, 11, 28, 12), oggi = bancoDi(ms);
  const ricco = { ...newHero(), monete: 5000 };
  // compra: solo la merce di oggi, con le monete, nello zaino
  const altro = RPG.contrabbando.banco.materiale.find((x) => x !== oggi.materiale)!;
  assert.throws(() => applyRpgAction(lotOf(ricco, ms), { t: 'contrabbando', op: 'compra', item: altro, n: 1 }, ms), isErr('oggetto'));
  assert.throws(() => applyRpgAction(lotOf({ ...ricco, monete: 1 }, ms), { t: 'contrabbando', op: 'compra', item: oggi.materiale, n: 1 }, ms), isErr('risorse'));
  assert.throws(() => applyRpgAction(lotOf({ ...ricco, monete: 1e7 }, ms), { t: 'contrabbando', op: 'compra', item: oggi.materiale, n: 999 }, ms), isErr('peso'));
  let l = applyRpgAction(lotOf(ricco, ms), { t: 'contrabbando', op: 'compra', item: oggi.arma, n: 1 }, ms);
  assert.equal(heroOf(l).inv[oggi.arma], 1);
  assert.equal(heroOf(l).monete, 5000 - prezzoLosco(oggi.arma));
  // vende: monete in più, oggetto via; quello equipaggiato no
  const m0 = heroOf(l).monete;
  l = applyRpgAction(l, { t: 'contrabbando', op: 'vendi', item: oggi.arma, n: 1 }, ms);
  assert.equal(heroOf(l).inv[oggi.arma] ?? 0, 0);
  assert.equal(heroOf(l).monete, m0 + offertaLosca(oggi.arma, 1));
  const h = newHero(), arma = h.equip.arma!;
  assert.throws(() => applyRpgAction(lotOf(h, ms), { t: 'contrabbando', op: 'vendi', item: arma, n: h.inv[arma]! }, ms), isErr('equip'));
  assert.throws(() => applyRpgAction(lotOf(h, ms), { t: 'contrabbando', op: 'vendi', item: 'lingotto_ferro', n: 1 }, ms), isErr('oggetto'));
  // roba che non vale niente: non la prende
  assert.throws(() => applyRpgAction(lotOf({ ...h, inv: { ...h.inv, frecce_legno: 25 } }, ms), { t: 'contrabbando', op: 'vendi', item: 'frecce_legno', n: 1 }, ms), isErr('oggetto'));
});

test('contrabbando: forma di rete', () => {
  assert.deepEqual(parseRpgAction({ t: 'contrabbando', op: 'vendi', item: 'zanna_lupo', n: 3, x: 1 }), { t: 'contrabbando', op: 'vendi', item: 'zanna_lupo', n: 3 });
  assert.equal(parseRpgAction({ t: 'contrabbando', op: 'ruba', item: 'zanna_lupo', n: 3 }), null);
  assert.equal(parseRpgAction({ t: 'contrabbando', op: 'compra', item: 'zanna_lupo', n: 0 }), null);
});
