// Botteghe di Borgo Marea (#414, VISIONE §2): contenuti validi, vetrine del giorno (una cosa per scomparto, uguale per tutti, mai la stessa due
// giorni di fila), livelli a monete del Fabbro e della barca al Cantiere, acquisti dalla vetrina, vernici della barca solo il giorno giusto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR } from '@marea/content';
import { BOTTEGHE, BOTTEGHE_IDS, validateBotteghe } from '@marea/content/botteghe.ts';
import { RPG } from '@marea/content/rpg.ts';
import { newLot } from '../src/economy/actions.ts';
import { compraColoreBarca, possiedeColore } from '../src/economy/barca.ts';
import { delGiorno, inVetrinaBottega, livelloCantiere, livelloFabbro, miglioraBottega, prossimoLivello, vetrinaBottega, vetrinaBottegaDel } from '../src/economy/botteghe.ts';
import { finoAMezzanotte, giornoRoma } from '../src/economy/giorno.ts';
import { checkMonete } from '../src/economy/monete.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { applyRpgAction } from '../src/rpg/actions.ts';
import { prezzoVetrina, sempreInVendita, vetrinaOggetti } from '../src/rpg/botteghe.ts';
import { valoreDi } from '../src/rpg/contrabbando.ts';
import { heroOf } from '../src/rpg/hero.ts';
import { hasItem, itemDef } from '../src/rpg/items.ts';
import { sbloccoTema, viaggiatore } from '../src/world/temi.ts';
import { conMonete, senzaMonete } from './monete_util.ts';

const T0 = 1_800_000_000_000;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
const lotto = (monete: number, extra: Partial<LotState> = {}): LotState => conMonete(senzaMonete({ ...newLot('jack', T0, null), ...extra }), monete);

test('botteghe: contenuti validi, oggetti e vernici esistenti', () => {
  assert.deepEqual(validateBotteghe(), []);
  for (const t of BOTTEGHE.fabbro.scomparti.flat()) for (const m of BOTTEGHE.fabbro.materiali ?? []) {
    const id = `${t}_${m}`;
    assert.ok(hasItem(id) && itemDef(id).forgia, `${id}: nel catalogo e forgiabile`);
    assert.ok(valoreDi(id) > 0, `${id}: ha un valore`);
  }
  for (const id of BOTTEGHE.alchimista.scomparti.flat()) assert.ok(hasItem(id) && ['pozione', 'ingrediente'].includes(itemDef(id).kind), `${id}: pozione o ingrediente`);
  for (const id of BOTTEGHE.cantiere.scomparti.flat()) assert.ok(AVATAR.barca.colori.find((k) => k.id === id)?.cantiere, `${id}: vernice del Cantiere`);
  // la roba di base: lingotti dal Fabbro, erbe dall'Alchimista (al posto della Serra), tutto RPG.bottega diviso fra i due
  assert.deepEqual(sempreInVendita('fabbro').map((x) => x.id).sort(), ['lingotto_bronzo', 'lingotto_ferro']);
  assert.deepEqual(sempreInVendita('alchimista').map((x) => x.id).sort(), ['erba_curativa', 'fiore_azzurro', 'radice_vigore']);
  assert.equal(sempreInVendita('fabbro').length + sempreInVendita('alchimista').length, Object.keys(RPG.bottega).length);
});

test('botteghe: la vetrina del giorno, uno per scomparto, uguale per tutti, mai uguale al giorno prima, tutto esce in un giro', () => {
  const g0 = giornoRoma(T0);
  for (const b of BOTTEGHE_IDS) {
    const def = BOTTEGHE[b];
    for (let g = g0; g < g0 + 120; g++) {
      const v = vetrinaBottegaDel(b, g);
      assert.equal(v.length, def.scomparti.length, `${b}: uno per scomparto`);
      assert.deepEqual(vetrinaBottegaDel(b, g), v, 'deterministica');
      const ieri = vetrinaBottegaDel(b, g - 1);
      for (const [i, id] of v.entries()) {
        const tipi = def.scomparti[i]!;
        assert.ok(def.materiali ? tipi.some((t) => id.startsWith(t + '_')) : tipi.includes(id), `${b}: ${id} viene dal suo scomparto`);
        if ((def.materiali ? tipi.length * def.materiali.length : tipi.length) >= 3) assert.notEqual(id, ieri[i], `${b}: ${id} due giorni di fila (giorno ${g})`);
      }
    }
  }
  // in un giro (tanti giorni quanti oggetti) esce tutto
  const pool = ['a', 'b', 'c', 'd', 'e'], visti = new Set<string>();
  for (let g = 50; g < 55; g++) visti.add(delGiorno(pool, 'prova', g));
  assert.equal(visti.size, 5);
  // cambia a mezzanotte di Roma
  const mezzanotte = T0 + finoAMezzanotte(T0);
  assert.deepEqual(vetrinaBottega('fabbro', mezzanotte - 1), vetrinaBottegaDel('fabbro', giornoRoma(T0)));
  assert.deepEqual(vetrinaBottega('fabbro', mezzanotte), vetrinaBottegaDel('fabbro', giornoRoma(T0) + 1));
  // il Fabbro mette in vetrina solo pezzi che il Contrabbandiere non svaluta a niente (prezzi veri)
  for (const id of vetrinaOggetti('fabbro', T0)) assert.ok(prezzoVetrina('fabbro', id) >= 10, `${id}: ${prezzoVetrina('fabbro', id)} monete`);
});

test('botteghe: il Fabbro sale di livello a monete; chi aveva il Banco tiene il suo livello', () => {
  let l = lotto(5000);
  assert.equal(livelloFabbro(l), 1, 'il primo livello è di tutti');
  assert.equal(prossimoLivello(l, 'fabbro')?.monete, BOTTEGHE.fabbro.livelli![1]!.monete);
  assert.throws(() => miglioraBottega(l, 'fabbro', 2, T0 + 1000), isErr('livello'), '`da` sbagliato: niente si paga due volte');
  assert.throws(() => miglioraBottega(lotto(10), 'fabbro', 1, T0 + 1000), isErr('risorse'));
  l = miglioraBottega(l, 'fabbro', 1, T0 + 1000);
  assert.equal(livelloFabbro(l), 2);
  assert.equal(l.monete, 5000 - BOTTEGHE.fabbro.livelli![1]!.monete);
  l = miglioraBottega(l, 'fabbro', 2, T0 + 2000);
  assert.equal(livelloFabbro(l), 3);
  assert.equal(prossimoLivello(l, 'fabbro'), null);
  assert.throws(() => miglioraBottega(l, 'fabbro', 3, T0 + 3000), isErr('livello'));
  assert.equal(checkMonete([l]), null);
  // il Banco da Lavoro di prima, anche riposto nel magazzino dell'isola, vale come livello col Fabbro
  const banco = (level: number) => ({ id: 'banco-2', building: 'banco', level, buffer: 0, lastMs: T0 });
  assert.equal(livelloFabbro(lotto(0, { buildings: [...newLot('jack', T0, null).buildings, { ...banco(2), cell: [3, 3] }] })), 2);
  assert.equal(livelloFabbro(lotto(0, { magazzinoEdifici: [banco(3)] })), 3);
  // forgiare l'argento: col Fabbro al 2
  const h = { ...heroOf(lotto(0)), inv: { lingotto_argento: 4 } };
  const conEroe = (x: LotState) => ({ ...x, hero: h });
  assert.throws(() => applyRpgAction(conEroe(lotto(100)), { t: 'forgia', item: 'katana_argento' }, T0 + 1000), isErr('livello'));
  const forgiato = applyRpgAction(conEroe(miglioraBottega(lotto(5000), 'fabbro', 1, T0 + 500)), { t: 'forgia', item: 'katana_argento' }, T0 + 1000);
  assert.equal(heroOf(forgiato).inv.katana_argento, 1);
});

test('botteghe: la barca al Cantiere (il Molo di prima) apre la Tempesta', () => {
  const tempesta = { tipo: 'molo' as const, livello: 2 };
  let l = lotto(2000);
  assert.equal(livelloCantiere(l), 1);
  const chiusa = sbloccoTema(tempesta, viaggiatore(l, null));
  assert.equal(chiusa.aperta, false);
  assert.match(chiusa.motivo, /Cantiere navale/);
  l = miglioraBottega(l, 'cantiere', 1, T0 + 1000);
  assert.equal(livelloCantiere(l), 2);
  assert.equal(l.buildings.find((b) => b.building === 'molo')?.level, 2, 'il livello sta nel Molo: velocità e Tempesta come prima');
  assert.equal(l.monete, 2000 - BOTTEGHE.cantiere.livelli![1]!.monete);
  assert.equal(sbloccoTema(tempesta, viaggiatore(l, null)).aperta, true);
  l = miglioraBottega(l, 'cantiere', 2, T0 + 2000);
  assert.equal(livelloCantiere(l), 3);
  assert.throws(() => miglioraBottega(l, 'cantiere', 3, T0 + 3000), isErr('livello'));
  assert.equal(checkMonete([l]), null);
});

test('botteghe: si compra solo la vetrina di oggi, al suo prezzo, nello zaino', () => {
  for (const b of ['fabbro', 'alchimista'] as const) {
    const oggi = vetrinaOggetti(b, T0 + 1000), id = oggi[0]!, prezzo = prezzoVetrina(b, id);
    assert.equal(prezzo, Math.max(1, Math.ceil(valoreDi(id) * BOTTEGHE[b].ricarico!)));
    const n = itemDef(id).kind === 'arma' || itemDef(id).kind === 'armatura' || itemDef(id).kind === 'arco' ? 1 : 3;
    const l = applyRpgAction(lotto(prezzo * n + 7), { t: 'vetrina', bottega: b, item: id, n }, T0 + 1000);
    assert.equal(heroOf(l).inv[id] ?? 0, (heroOf(lotto(0)).inv[id] ?? 0) + n, `${b}: ${id} nello zaino`);
    assert.equal(l.monete, 7);
    assert.equal(checkMonete([l]), null);
    assert.throws(() => applyRpgAction(lotto(prezzo * n - 1), { t: 'vetrina', bottega: b, item: id, n }, T0 + 1000), isErr('risorse'));
    // ieri sì, oggi no
    const fuori = BOTTEGHE[b].scomparti.flat().map((x) => (b === 'fabbro' ? `${x}_oro` : x)).find((x) => hasItem(x) && !oggi.includes(x))!;
    assert.throws(() => applyRpgAction(lotto(9999), { t: 'vetrina', bottega: b, item: fuori, n: 1 }, T0 + 1000), isErr('oggetto'));
  }
  // un pezzo del Fabbro non si compra dall'Alchimista
  const delFabbro = vetrinaOggetti('fabbro', T0 + 1000)[0]!;
  assert.throws(() => applyRpgAction(lotto(9999), { t: 'vetrina', bottega: 'alchimista', item: delFabbro, n: 1 }, T0 + 1000), isErr('oggetto'));
});

test('botteghe: le vernici del Cantiere si comprano solo il giorno che sono in vetrina, le esclusive del Mercante sempre', () => {
  const ora = T0 + 1000, oggi = vetrinaBottega('cantiere', ora);
  const domani = BOTTEGHE.cantiere.scomparti.flat().find((id) => !oggi.includes(id))!;
  let l = compraColoreBarca(lotto(500), oggi[0]!, ora);
  assert.ok(possiedeColore(l, oggi[0]!));
  assert.equal(l.monete, 500 - AVATAR.barca.colori.find((k) => k.id === oggi[0])!.monete);
  assert.throws(() => compraColoreBarca(l, oggi[0]!, ora), isErr('unico'));
  assert.throws(() => compraColoreBarca(lotto(500), domani, ora), isErr('requisito'));
  assert.ok(inVetrinaBottega('cantiere', ora, oggi[2]!));
  l = compraColoreBarca(lotto(500), 'nero', ora);
  assert.ok(possiedeColore(l, 'nero'), 'le esclusive del Mercante non cambiano');
});
