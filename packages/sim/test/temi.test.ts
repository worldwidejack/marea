// Isole a tema (#68) e corrente al bordo del mondo (#5): chi entra, la barriera in mare, la mappa del Giardino, la barca che non esce dalla mappa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGO, AVATAR, ISLANDS } from '@marea/content';
import { composeArchipelago } from '../src/world/archipelago.ts';
import type { ArchPlace } from '../src/world/archipelago.ts';
import { correnteBordo, newBoat, stepBoat } from '../src/world/boat.ts';
import type { BoatState } from '../src/world/boat.ts';
import { NESSUNO, distanzaIsola, mappeDaOro, respingi, sblocchi, sbloccoTema, viaggiatore } from '../src/world/temi.ts';
import type { Viaggiatore } from '../src/world/temi.ts';
import { newLot } from '../src/economy/actions.ts';
import { finishSolo, startSolo } from '../src/economy/rewards.ts';
import { LIBERATORIA, firmaLiberatoria } from '../src/adrenalina/liberatoria.ts';
import { BORDO } from '../src/constants.ts';
import type { InputFrame } from '../src/types.ts';

const arch = composeArchipelago(ARCHIPELAGO, ISLANDS);
const M = arch.map, T = M.tile;
const temi = arch.places.filter((p) => p.tema);
const isola = (id: string): ArchPlace => { const p = temi.find((q) => q.island === id); assert.ok(p, id); return p; };
const T0 = Date.UTC(2026, 9, 8, 12);

test('sette isole a tema, ognuna con uno sblocco diverso e lontana dal giro iniziale', () => {
  assert.deepEqual(temi.map((p) => p.island).sort(), ['adrenalina', 'corse', 'ghiacci', 'giardino', 'tempesta', 'templari', 'vulcano']);
  // le Corse (docs/CORSE.md) sono aperte a tutti, anche senza link personale; l'Adrenalina vuole firma e casco (docs/ADRENALINA.md)
  assert.deepEqual(temi.map((p) => p.tema!.sblocco.tipo).sort(), ['cappello', 'funivia', 'libera', 'livello', 'mappa', 'molo', 'reliquia']);
  for (const p of temi) assert.equal(p.style, p.island, `${p.island}: stile = tema`);
  const porto = arch.spawnOf(null);
  for (const p of temi) {
    const d = Math.hypot(p.spawn.x - porto.x, p.spawn.z - porto.z);
    assert.ok(d > 150, `${p.island} troppo vicina al Porto (${Math.round(d)} m)`);
    // la barriera non tocca altre isole: nessun lotto, Porto o laguna dentro la fascia
    if (p.tema!.barriera > 0) for (const q of arch.places) if (q !== p) {
      const corners = [[q.origin[0], q.origin[1]], [q.origin[0] + q.w, q.origin[1]], [q.origin[0], q.origin[1] + q.h], [q.origin[0] + q.w, q.origin[1] + q.h]];
      for (const [cx, cz] of corners) assert.ok(distanzaIsola(p, T, cx! * T, cz! * T).d > p.tema!.barriera, `la barriera di ${p.island} tocca ${q.island}`);
    }
  }
});

test('viaggiatore dal lotto: Molo, personaggio, cappello, mappe', () => {
  const lot = newLot('anna', T0);
  const v = viaggiatore(lot, 1);
  assert.equal(v.molo, 1); assert.equal(v.livello, 1); assert.equal(v.cappello, AVATAR.cappelli[1]!.id); assert.deepEqual(v.mappe, []);
  assert.equal(viaggiatore(null, 0).cappello, null, 'nessun cappello');
  assert.equal(viaggiatore(null, 'lanterna').cappello, 'lanterna');
  const lot2 = { ...lot, buildings: lot.buildings.map((b) => (b.building === 'molo' ? { ...b, level: 2 } : b)), hero: { ...(lot.hero ?? ({} as never)), livello: 4 }, mappe: ['giardino'] };
  const v2 = viaggiatore(lot2 as typeof lot, null);
  assert.equal(v2.molo, 2); assert.equal(v2.livello, 4); assert.deepEqual(v2.mappe, ['giardino']);
});

test('di serie tutte chiuse (tranne le Corse, aperte a tutti), col motivo giusto in italiano', () => {
  const s = sblocchi(arch.places, NESSUNO);
  assert.equal(Object.keys(s).length, 7);
  for (const [id, v] of Object.entries(s)) assert.equal(v.aperta, id === 'corse', id);
  assert.match(s['tempesta']!.motivo, /tempesta ti respinge.*Molo al livello 2/);
  assert.match(s['ghiacci']!.motivo, /mare gela.*livello 3/);
  assert.match(s['vulcano']!.motivo, /abitanti ti cacciano.*Lanterna in testa/);
  assert.match(s['giardino']!.motivo, /nebbia.*mappa del Giardino/);
  assert.match(s['templari']!.motivo, /nebbia rossa.*faro della Tempesta/);
  assert.match(s['adrenalina']!.motivo, /guardiano della funivia.*liberatoria.*casco in testa/);
  // con lotto nuovo (Molo L1) e cappello di paglia: tutto chiuso tranne le Corse
  const v = viaggiatore(newLot('bruno', T0), 1);
  assert.ok(Object.entries(sblocchi(arch.places, v)).every(([id, x]) => x.aperta === (id === 'corse')));
  assert.match(sblocchi(arch.places, v)['tempesta']!.motivo, /il tuo è al 1/);
});

test('ognuna si apre col suo requisito, e solo con quello', () => {
  const base: Viaggiatore = { molo: 1, livello: 1, cappello: 'paglia', mappe: [], reliquie: [], liberatorie: [] };
  const casi: [string, Viaggiatore][] = [
    ['tempesta', { ...base, molo: 2 }],
    ['ghiacci', { ...base, livello: 3 }],
    ['vulcano', { ...base, cappello: 'lanterna' }],
    ['giardino', { ...base, mappe: ['giardino'] }],
    ['templari', { ...base, reliquie: ['templari'] }],
    ['adrenalina', { ...base, cappello: 'casco', liberatorie: ['adrenalina'] }],
  ];
  for (const [id, v] of casi) {
    const s = sblocchi(arch.places, v);
    for (const p of temi) assert.equal(s[p.island]!.aperta, p.island === id || p.island === 'corse', `${id}: ${p.island} ${s[p.island]!.aperta ? 'aperta' : 'chiusa'}`);
  }
  assert.equal(sbloccoTema({ tipo: 'molo', livello: 2 }, { ...base, molo: 3 }).aperta, true, 'Molo più alto del necessario');
  assert.equal(sbloccoTema({ tipo: 'libera' }, NESSUNO).aperta, true, 'libera: aperta anche senza niente');
});

test('Adrenalina: si sbarca sempre (niente barriera), ma la funivia vuole la liberatoria firmata e il casco in testa', () => {
  const p = isola('adrenalina'), s = p.tema!.sblocco;
  assert.equal(p.tema!.barriera, 0, 'niente barriera: ti ferma il cancello, non il mare');
  assert.equal(s.tipo, 'funivia');
  const casco = AVATAR.cappelli.find((h) => h.id === 'casco');
  assert.ok(casco && casco.perle > 0 && !casco.mercante, 'il casco si compra a Perle dall’editor');
  assert.equal(AVATAR.cappelli.at(-1)!.id, 'casco', 'in coda: gli indici dei cappelli salvati restano quelli');
  const base: Viaggiatore = { ...NESSUNO, molo: 1 };
  const solo = sbloccoTema(s, { ...base, cappello: 'casco' });
  assert.equal(solo.aperta, false); assert.equal(solo.manca, 'La liberatoria');
  const firma = sbloccoTema(s, { ...base, liberatorie: ['adrenalina'] });
  assert.equal(firma.aperta, false); assert.match(firma.motivo, /senza casco qui non sale nessuno/); assert.equal(firma.manca, 'Casco (35 Perle)');
  assert.equal(sbloccoTema(s, { ...base, liberatorie: ['adrenalina'], cappello: 'lanterna' }).aperta, false, 'un altro cappello non basta');
  assert.equal(sbloccoTema(s, { ...base, liberatorie: ['adrenalina'], cappello: 'casco' }).aperta, true);
  // la firma resta nel lotto, una volta sola
  const lot = newLot('carla', T0), r1 = firmaLiberatoria(lot), r2 = firmaLiberatoria(r1.lot);
  assert.equal(r1.nuova, true); assert.deepEqual(r1.lot.liberatorie, ['adrenalina']); assert.equal(r1.lot.version, lot.version + 1);
  assert.equal(r2.nuova, false); assert.equal(r2.lot, r1.lot, 'seconda firma: il lotto non cambia');
  assert.equal(sbloccoTema(s, viaggiatore(r1.lot, 'casco')).aperta, true, 'dal lotto: firma e casco');
  assert.match(LIBERATORIA, /ossa rotte, orgoglio ferito e Perle perse/);
});

/** Barca che punta dritta verso il molo dell'isola partendo da 120 m, a tutta forza: dove arriva. */
function rotta(p: ArchPlace, aperta: boolean): { minD: number; last: BoatState; respinte: number } {
  const dir = { x: p.spawn.x - (p.origin[0] + p.w / 2) * T, z: p.spawn.z - (p.origin[1] + p.h / 2) * T };
  const n = Math.hypot(dir.x, dir.z); dir.x /= n; dir.z /= n;
  let b = newBoat(p.boat.x + dir.x * 120, p.boat.z + dir.z * 120);
  let minD = Infinity, respinte = 0;
  for (let i = 0; i < 60 * 40; i++) {
    const f: InputFrame = { mx: (p.boat.x - b.x) / Math.max(1, Math.hypot(p.boat.x - b.x, p.boat.z - b.z)), my: (p.boat.z - b.z) / Math.max(1, Math.hypot(p.boat.x - b.x, p.boat.z - b.z)), a: true, b: false };
    const next = stepBoat(b, f, M);
    const r = aperta ? null : respingi(b, next, p, M);
    if (r) respinte++;
    b = r ?? next;
    minD = Math.min(minD, Math.hypot(b.x - p.boat.x, b.z - p.boat.z));
    assert.ok(M.navigable(b.x, b.z), `${p.island}: barca a terra`);
  }
  return { minD, last: b, respinte };
}

test('barriera: chiusa la barca non arriva al molo e resta fuori dalla fascia; aperta ci arriva', () => {
  for (const p of temi) {
    if (p.tema!.barriera <= 0) continue;
    const chiusa = rotta(p, false), aperta = rotta(p, true);
    assert.ok(chiusa.respinte > 0, `${p.island}: mai respinta`);
    assert.ok(distanzaIsola(p, T, chiusa.last.x, chiusa.last.z).d >= p.tema!.barriera - 0.01, `${p.island}: dentro la barriera`);
    assert.ok(chiusa.minD > 15, `${p.island}: chiusa ma arrivata a ${chiusa.minD.toFixed(1)} m dal molo`);
    assert.ok(aperta.minD < 6, `${p.island}: aperta ma ferma a ${aperta.minD.toFixed(1)} m dal molo`);
  }
});

test('barriera: ogni isola respinge a modo suo', () => {
  const dentro = (p: ArchPlace): BoatState => ({ ...newBoat((p.origin[0] + p.w / 2) * T, (p.origin[1] - 2) * T), yaw: Math.PI, speed: 8 }); // a nord, prua verso sud (verso l'isola)
  const prev = (p: ArchPlace): BoatState => ({ ...newBoat((p.origin[0] + p.w / 2) * T, (p.origin[1] - 12) * T), yaw: Math.PI, speed: 8 });
  const tem = isola('tempesta'), ghi = isola('ghiacci'), gia = isola('giardino'), vul = isola('vulcano');
  const rt = respingi(prev(tem), dentro(tem), tem, M)!;
  assert.equal(rt.speed, 0); assert.ok(distanzaIsola(tem, T, rt.x, rt.z).d > tem.tema!.barriera + 2, 'la tempesta butta più in là');
  const rg = respingi(prev(ghi), dentro(ghi), ghi, M)!;
  assert.equal(rg.speed, 0, 'ghiaccio: ferma');
  const rn = respingi(prev(gia), dentro(gia), gia, M)!;
  assert.ok(Math.abs(Math.cos(rn.yaw) - 1) < 1e-6 && rn.speed > 0, 'nebbia: si gira verso nord e torna indietro');
  assert.equal(respingi(prev(vul), dentro(vul), vul, M), null, 'il Vulcano non ha barriera in mare');
  assert.equal(respingi(prev(tem), prev(tem), tem, M), null, 'fuori dalla fascia non succede niente');
});

test('mappa del Giardino: la prima medaglia d’oro da solo la regala, una volta sola', () => {
  assert.deepEqual(mappeDaOro(), ['giardino']);
  let lot = newLot('cia', T0);
  const argento = finishSolo(startSolo(lot, 'regata', 1, T0), 'argento', T0);
  assert.deepEqual(argento.mappe, []); assert.equal(argento.lot.mappe, undefined);
  const oro = finishSolo(startSolo(argento.lot, 'regata', 2, T0), 'oro', T0);
  assert.deepEqual(oro.mappe, ['giardino']); assert.deepEqual(oro.lot.mappe, ['giardino']);
  lot = finishSolo(startSolo(oro.lot, 'regata', 3, T0), 'oro', T0).lot;
  assert.deepEqual(lot.mappe, ['giardino'], 'niente doppioni');
  assert.equal(sblocchi(arch.places, viaggiatore(lot, 0))['giardino']!.aperta, true);
});

test('corrente al bordo (#5): dentro la mappa niente, al bordo riporta indietro, fuori non si esce', () => {
  const W = M.w * T, H = M.h * T;
  const mezzo = newBoat(W / 2, H / 2);
  const r0 = correnteBordo(mezzo, M);
  assert.equal(r0.attiva, false); assert.equal(r0.s, mezzo, 'stesso oggetto: nessun effetto');
  // anche a ridosso di ogni isola (spawn delle barche) la corrente non c'è
  for (const p of arch.places) assert.equal(correnteBordo(newBoat(p.boat.x, p.boat.z), M).attiva, false, `${p.island}: corrente sul molo`);
  const bordo = correnteBordo(newBoat(W - 3, H / 2), M);
  assert.ok(bordo.attiva && bordo.s.x < W - 3, 'al bordo est spinge a ovest');
  assert.ok(correnteBordo(newBoat(H / 2, 2), M).s.z > 2, 'al bordo nord spinge a sud');
  // a tutta forza verso fuori per 60 s: non esce mai e si ferma dentro la fascia
  for (const [mx, my, x0, z0] of [[1, 0, W - 60, H - 160], [-1, 0, 60, H / 2], [0, -1, W / 2, 60], [0, 1, W / 2 - 40, H - 60]] as const) {
    let b = newBoat(x0, z0);
    let fuori = 0;
    for (let i = 0; i < 3600; i++) {
      b = correnteBordo(stepBoat(b, { mx, my, a: true, b: false }, M), M).s;
      if (b.x < 0 || b.z < 0 || b.x > W || b.z > H) fuori++;
    }
    assert.equal(fuori, 0, `uscita dalla mappa (${mx},${my})`);
    const dBordo = Math.min(b.x, b.z, W - b.x, H - b.z);
    assert.ok(dBordo > 2 && dBordo < BORDO.fascia, `(${mx},${my}): ferma a ${dBordo.toFixed(1)} m dal bordo`);
  }
});
