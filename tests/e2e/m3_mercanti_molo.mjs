// Mercanti ai moli dell'Isola dell'Adrenalina e dell'Isola Vulcano:
// - Adrenalina: vende sempre e solo il Casco (105 monete) per salire sulla funivia.
// - Vulcano: vende sempre e solo la Lanterna in testa (75 monete) per entrare nell'isola senza essere cacciati.
import fs from 'node:fs';

export const timeout = 120000;

const AVATAR = JSON.parse(fs.readFileSync(new URL('../../packages/content/src/avatar.json', import.meta.url), 'utf8'));
const CASCO_IDX = AVATAR.cappelli.findIndex((h) => h.id === 'casco');
const LANTERNA_IDX = AVATAR.cappelli.findIndex((h) => h.id === 'lanterna');

export default async function (ctx) {
  const { assert } = ctx;
  const hook = (p, fn, ...args) => p.page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const st = (p) => ctx.getState(p.page);

  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 30000);
  const page = d.page;

  await ctx.test('mercanti isole presenti nello stato con i cappelli dedicati', async () => {
    await page.waitForFunction(() => !!window.__game.state().mercanti_isole, null, { timeout: 10000 });
    const s = await st(d);
    const spots = s.mercanti_isole.spots;
    assert(spots.length === 2, `mercanti trovati: ${spots.length}`);

    const adr = spots.find((x) => x.isola === 'adrenalina');
    assert(adr && adr.hatId === 'casco' && adr.monete === 105, `adrenalina: ${JSON.stringify(adr)}`);

    const vul = spots.find((x) => x.isola === 'vulcano');
    assert(vul && vul.hatId === 'lanterna' && vul.monete === 75, `vulcano: ${JSON.stringify(vul)}`);
  });

  await ctx.test('Adrenalina: al molo c’è il mercante del Casco; apri, compra e indossa', async () => {
    // Dai monete al giocatore per la prova
    const curLot = (await st(d)).lot;
    await hook(d, 'setLot', { ...curLot, monete: 500 });
    // Vai vicino al molo di Adrenalina
    await hook(d, 'teleport', 170.5, 87.5);
    await page.waitForTimeout(600);

    // Il bottone del mercante compare
    await page.waitForSelector('#mzMercanteMoloBtn.on', { timeout: 8000 });
    const txt = await page.textContent('#mzMercanteMoloBtn');
    assert(/Casco/i.test(txt), `testo bottone: ${txt}`);

    // Clicca per aprire il pannello
    await page.click('#mzMercanteMoloBtn');
    await page.waitForSelector('#mzMercanteMolo.on', { timeout: 5000 });

    const titolo = await page.textContent('#mzMercanteMolo .mk-titolo');
    assert(/Casco|Caschi/i.test(titolo), `titolo: ${titolo}`);

    // Compra il casco
    await page.click('#mzMercanteMolo .mm-act');
    await page.waitForTimeout(400);

    // Ora è "In testa"
    const actText = await page.textContent('#mzMercanteMolo .mm-act');
    assert(/In testa/i.test(actText), `bottone dopo acquisto: ${actText}`);

    // Verifica che l'avatar ora indossi il casco
    const look = (await st(d)).wp2_avatar.look;
    assert(look.cappello === CASCO_IDX, `cappello indossato: ${look.cappello} (atteso ${CASCO_IDX})`);

    // Chiudi
    await page.click('#mzMercanteMolo .mk-x');
    await page.waitForFunction(() => !document.querySelector('#mzMercanteMolo')?.classList.contains('on'), null, { timeout: 5000 });
  });

  await ctx.test('Vulcano: al molo non si viene cacciati; compra la Lanterna in testa e cammina sull’isola', async () => {
    // Togli la lanterna se indossata
    await hook(d, 'portoCappello', 0);
    await hook(d, 'temiProva', null);

    // Teletrasporto al molo del Vulcano (davanti al banchetto del mercante)
    await hook(d, 'teleport', 605, 517.8);
    await page.waitForTimeout(1000);

    // Al molo non si viene cacciati anche senza lanterna
    const s0 = await st(d);
    assert(s0.mode === 'walk', `non a piedi al molo: ${s0.mode}`);
    assert(!s0.temi.caccia, 'caccia attiva al molo del Vulcano');

    // Il bottone del mercante compare
    await page.waitForSelector('#mzMercanteMoloBtn.on', { timeout: 8000 });
    const txt = await page.textContent('#mzMercanteMoloBtn');
    assert(/Lanterna/i.test(txt), `testo bottone: ${txt}`);

    // Apri il mercante di lanterne
    await page.click('#mzMercanteMoloBtn');
    await page.waitForSelector('#mzMercanteMolo.on', { timeout: 5000 });

    const titolo = await page.textContent('#mzMercanteMolo .mk-titolo');
    assert(/Lanterna|Lanterne/i.test(titolo), `titolo: ${titolo}`);

    // Compra la lanterna
    await page.click('#mzMercanteMolo .mm-act');
    await page.waitForTimeout(400);

    const actText = await page.textContent('#mzMercanteMolo .mm-act');
    assert(/In testa/i.test(actText), `bottone dopo acquisto: ${actText}`);

    const look = (await st(d)).wp2_avatar.look;
    assert(look.cappello === LANTERNA_IDX, `lanterna indossata: ${look.cappello} (atteso ${LANTERNA_IDX})`);

    await page.click('#mzMercanteMolo .mk-x');
    await page.waitForFunction(() => !document.querySelector('#mzMercanteMolo')?.classList.contains('on'), null, { timeout: 5000 });

    // Ora cammina oltre il molo dentro l'isola (alla P)
    await hook(d, 'teleport', 609, 517);
    await page.waitForTimeout(1500);

    // Con la lanterna in testa non vieni cacciato
    const s1 = await st(d);
    assert(s1.mode === 'walk', `cacciato dal vulcano pur avendo la lanterna: ${s1.mode}`);
  });
}
