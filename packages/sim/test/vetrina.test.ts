// La vetrina del negozio dei mobili (#384): ogni giorno di Roma una scelta diversa, uguale per tutti, pescata da tutto mobili.json;
// si compra solo quello che è esposto; i mobili aggiunti al catalogo entrano da soli nel pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BORGO, MOBILI, MOBILI_VETRINA } from '@marea/content';
import type { MobileDef, StanzaFinitura } from '@marea/content';
import { newLot } from '../src/economy/actions.ts';
import { compraFinituraDelGiorno, compraMobileDelGiorno } from '../src/economy/casa.ts';
import { lotTemplate } from '../src/economy/cells.ts';
import { checkInvariant } from '../src/economy/ledger.ts';
import { finoAMezzanotte, giornoRoma } from '../src/economy/giorno.ts';
import { EconomyError } from '../src/economy/types.ts';
import type { LotState } from '../src/economy/types.ts';
import { inVetrina, inVetrinaFinitura, vetrinaDelGiorno, vetrinaOra } from '../src/economy/vetrina.ts';

const DAY = 86_400_000, HOUR = 3_600_000;
const isErr = (code: string) => (e: unknown) => e instanceof EconomyError && e.code === code && /\p{L}/u.test(e.message);
const T0 = Date.UTC(2026, 9, 18, 12); // 18 ott 2026, mezzogiorno UTC

function ricco(perle: number): LotState {
  const l = newLot('a', 0, lotTemplate()!);
  return { ...l, resources: { ...l.resources, perle }, ledger: { ...l.ledger, generated: { ...l.ledger.generated, perle: l.ledger.generated.perle + perle - l.resources.perle } } };
}

test('la vetrina è la stessa per tutti nello stesso giorno e non dipende da quante volte la chiedi', () => {
  const a = vetrinaOra(T0), b = vetrinaOra(T0 + 5 * HOUR), c = vetrinaOra(T0);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('rispetta le capienze, senza doppioni, solo mobili veri del posto giusto', () => {
  for (let g = 0; g < 60; g++) {
    const v = vetrinaDelGiorno(giornoRoma(T0) + g);
    assert.ok(v.terra.length <= MOBILI_VETRINA.terra && v.parete.length <= MOBILI_VETRINA.parete);
    assert.equal(new Set([...v.terra, ...v.parete]).size, v.terra.length + v.parete.length);
    for (const id of v.terra) assert.equal(MOBILI.find((m) => m.id === id)?.posto, 'terra', id);
    for (const id of v.parete) assert.equal(MOBILI.find((m) => m.id === id)?.posto, 'parete', id);
  }
  // col catalogo di oggi i posti a terra si riempiono sempre
  assert.equal(vetrinaOra(T0).terra.length, Math.min(MOBILI_VETRINA.terra, MOBILI.filter((m) => m.posto === 'terra').length));
});

test('cambia ogni giorno: nei giorni di una stagione passa in vetrina buona parte del catalogo', () => {
  const visti = new Set<string>();
  let uguali = 0;
  for (let g = 0; g < 90; g++) {
    const v = vetrinaDelGiorno(giornoRoma(T0) + g), w = vetrinaDelGiorno(giornoRoma(T0) + g + 1);
    for (const id of [...v.terra, ...v.parete]) visti.add(id);
    if (JSON.stringify(v) === JSON.stringify(w)) uguali++;
  }
  assert.equal(uguali, 0, 'due giorni di fila con la stessa vetrina');
  const terra = MOBILI.filter((m) => m.posto === 'terra').length;
  assert.ok(visti.size >= Math.min(terra, 40), `in 90 giorni sono passati solo ${visti.size} mobili`);
});

test('cambia a mezzanotte di Roma, estate (UTC+2) e inverno (UTC+1)', () => {
  const inverno = Date.UTC(2026, 11, 10, 23, 0) - 1_000, estate = Date.UTC(2026, 6, 10, 22, 0) - 1_000; // un secondo prima della mezzanotte di Roma
  for (const t of [inverno, estate]) {
    assert.equal(giornoRoma(t + 2_000), giornoRoma(t) + 1);
    assert.equal(finoAMezzanotte(t), 1_000);
    assert.deepEqual(vetrinaOra(t), vetrinaOra(t - HOUR));
    assert.notDeepEqual(vetrinaOra(t), vetrinaOra(t + 2_000));
  }
});

test('un mobile nuovo nel catalogo entra da solo nel pool; quelli già in vetrina non si spostano se non vince', () => {
  const prima = Array.from({ length: 40 }, (_, g) => vetrinaDelGiorno(giornoRoma(T0) + g));
  const NUOVO: MobileDef = { id: 'mobile_prova_vetrina', nome: 'Prova', categoria: 'decorazioni', perle: 10, posto: 'terra', colori: ['#C98A4B'] };
  (MOBILI as MobileDef[]).push(NUOVO);
  try {
    const dopo = prima.map((_, g) => vetrinaDelGiorno(giornoRoma(T0) + g));
    const comparso = dopo.filter((v) => v.terra.includes(NUOVO.id)).length;
    assert.ok(comparso >= 1, 'in 40 giorni il mobile nuovo non è mai uscito');
    assert.ok(comparso <= 20, 'il mobile nuovo esce troppo spesso');
    dopo.forEach((v, g) => {
      // il resto della vetrina è quello di prima, meno l'ultimo che ha ceduto il posto al nuovo
      if (v.terra.includes(NUOVO.id)) assert.deepEqual(v.terra.filter((x) => x !== NUOVO.id), prima[g]!.terra.slice(0, v.terra.length - 1));
      else assert.deepEqual(v, prima[g]);
    });
    assert.equal(inVetrina(T0, NUOVO.id), vetrinaOra(T0).terra.includes(NUOVO.id));
  } finally { (MOBILI as MobileDef[]).pop(); }
});

test('compraMobileDelGiorno: si compra solo quello esposto oggi; il resto è «requisito»; l’id sconosciuto è «sconosciuto»', () => {
  const v = vetrinaOra(T0), lot = ricco(1000);
  const esposto = v.terra[0]!, fuori = MOBILI.find((m) => m.posto === 'terra' && !v.terra.includes(m.id))!;
  const l1 = compraMobileDelGiorno(lot, esposto, T0);
  assert.equal(l1.casa?.magazzino?.[esposto], 1);
  assert.ok(l1.resources.perle < lot.resources.perle);
  assert.equal(checkInvariant([l1]), null);
  assert.throws(() => compraMobileDelGiorno(lot, fuori.id, T0), isErr('requisito'));
  assert.throws(() => compraMobileDelGiorno(lot, 'trono', T0), isErr('sconosciuto'));
  // il giorno dopo quello di ieri non c'è più (o ce n'è un altro): l'esposto di oggi domani si compra solo se è di nuovo in vetrina
  const domani = T0 + DAY;
  assert.equal((() => { try { compraMobileDelGiorno(lot, esposto, domani); return true; } catch { return false; } })(), inVetrina(domani, esposto));
  // senza Perle l'errore è quello solito
  assert.throws(() => compraMobileDelGiorno(ricco(0), esposto, T0), isErr('risorse'));
});

test('carte da parati e pavimenti: ogni giorno una scelta a pagamento, uguale per tutti, diversa da un giorno all’altro; i nuovi entrano da soli', () => {
  const pagano = (l: readonly StanzaFinitura[]) => new Set(l.filter((f) => (f.perle ?? 0) > 0).map((f) => f.id));
  const carte = pagano(BORGO.carte), pav = pagano(BORGO.pavimenti), visteC = new Set<string>(), visteP = new Set<string>();
  let uguali = 0;
  for (let g = 0; g < 90; g++) {
    const v = vetrinaDelGiorno(giornoRoma(T0) + g), w = vetrinaDelGiorno(giornoRoma(T0) + g + 1);
    assert.equal(v.carte.length, Math.min(MOBILI_VETRINA.carte, carte.size));
    assert.equal(v.pavimenti.length, Math.min(MOBILI_VETRINA.pavimenti, pav.size));
    assert.equal(new Set(v.carte).size, v.carte.length);
    for (const id of v.carte) { assert.ok(carte.has(id), `${id} non è una carta a pagamento`); visteC.add(id); }
    for (const id of v.pavimenti) { assert.ok(pav.has(id), `${id} non è un pavimento a pagamento`); visteP.add(id); }
    if (JSON.stringify(v.carte) === JSON.stringify(w.carte) && JSON.stringify(v.pavimenti) === JSON.stringify(w.pavimenti)) uguali++;
  }
  assert.equal(uguali, 0, 'due giorni di fila con le stesse carte e gli stessi pavimenti');
  assert.ok(visteC.size >= Math.min(carte.size, 20) && visteP.size >= Math.min(pav.size, 20), `in 90 giorni sono passate ${visteC.size} carte e ${visteP.size} pavimenti`);
  // uno nuovo nel catalogo entra da solo nel pool
  const NUOVA: StanzaFinitura = { id: 'carta_prova_vetrina', nome: 'Prova', motivo: 'righe', colori: ['#E8E1D6', '#B9AFA3', '#7F7568'], perle: 20 };
  (BORGO.carte as StanzaFinitura[]).push(NUOVA);
  try {
    const uscita = Array.from({ length: 60 }, (_, g) => vetrinaDelGiorno(giornoRoma(T0) + g).carte).filter((c) => c.includes(NUOVA.id)).length;
    assert.ok(uscita >= 1 && uscita <= 40, `la carta nuova è uscita ${uscita} volte in 60 giorni`);
  } finally { (BORGO.carte as StanzaFinitura[]).pop(); }
});

test('compraFinituraDelGiorno: si compra solo la carta o il pavimento esposto oggi; quello che hai già è «unico»; l’id sconosciuto «sconosciuto»', () => {
  const v = vetrinaOra(T0), lot = ricco(2000);
  const carta = v.carte[0]!, pavimento = v.pavimenti[0]!;
  const fuoriC = BORGO.carte.find((f) => (f.perle ?? 0) > 0 && !v.carte.includes(f.id))!, fuoriP = BORGO.pavimenti.find((f) => (f.perle ?? 0) > 0 && !v.pavimenti.includes(f.id))!;
  let l1 = compraFinituraDelGiorno(lot, 'carta', carta, T0);
  assert.equal(l1.casa?.carta, carta);
  l1 = compraFinituraDelGiorno(l1, 'pavimento', pavimento, T0);
  assert.equal(l1.casa?.pavimento, pavimento);
  assert.equal(checkInvariant([l1]), null);
  assert.throws(() => compraFinituraDelGiorno(lot, 'carta', fuoriC.id, T0), isErr('requisito'));
  assert.throws(() => compraFinituraDelGiorno(lot, 'pavimento', fuoriP.id, T0), isErr('requisito'));
  assert.throws(() => compraFinituraDelGiorno(l1, 'carta', carta, T0), isErr('unico'), 'già tua');
  assert.throws(() => compraFinituraDelGiorno(lot, 'carta', BORGO.carte[0]!.id, T0), isErr('unico'), 'quella di serie è di tutti');
  assert.throws(() => compraFinituraDelGiorno(lot, 'carta', 'inesistente', T0), isErr('sconosciuto'));
  assert.ok(inVetrinaFinitura(T0, 'carta', carta) && !inVetrinaFinitura(T0, 'carta', fuoriC.id));
  assert.throws(() => compraFinituraDelGiorno(ricco(0), 'carta', carta, T0), isErr('risorse'));
});
