import { collegaController } from '../lib/controller.mjs';

export const timeout = 240000;

export default async function (ctx) {
  const { assert } = ctx;
  const p = await ctx.open('?test=1&net=0', { viewport: { width: 1280, height: 800 } });
  const { page } = p;
  await ctx.waitReady(page, 20000);
  const registra = () => page.evaluate(() => {
    window.__k = [];
    for (const t of ['keydown', 'keyup']) addEventListener(t, (e) => window.__k.push((t === 'keydown' ? '+' : '-') + e.code));
  });
  const visti = () => page.evaluate(() => window.__k.splice(0));
  const imposta = (profilo, id, slot, code) => page.evaluate((a) => window.__game.test.comandi_tasto(a), { profilo, id, slot, code });
  const bindPad = (profilo, id, b) => page.evaluate((a) => window.__game.test.comandi_pad(a), { profilo, id, b });
  let pad;
  await registra();

  await ctx.test('senza controller i tasti di serie passano', async () => {
    assert((await ctx.getState(page)).comandi.pad === null, 'pad già collegato');
    await page.keyboard.press('Space');
    assert((await visti()).join(' ') === '+Space -Space', 'Spazio non è arrivato al gioco');
  });

  await ctx.test('Borgo: stick analogico, Y cambia attrezzo, B fa la capriola', async () => {
    pad = await collegaController(page);
    await pad.stato([], [0.9, 0, 0, 0]);
    await ctx.waitState(page, (s) => s.wp2_input.src === 'pad' && s.wp2_input.mag > 0.5, 8000);
    assert((await visti()).includes('+KeyD'), 'stick non tradotto per i giochi che leggono i tasti');
    await pad.stato([1], [0.9, 0, 0, 0]);
    await ctx.waitState(page, (s) => s.avatar.anim === 'roll', 8000);
    await pad.stato();
    await pad.premi(3);
    const k = await visti();
    assert(k.includes('-KeyD') && k.includes('+KeyQ') && k.includes('-KeyQ'), 'movimento incollato o cambio attrezzo assente: ' + k);
  });

  await ctx.test('lo stesso pulsante e lo stesso tasto possono fare cose diverse in Borgo e in barca', async () => {
    await bindPad('borgo', 'attrezzo', 2);
    await imposta('borgo', 'attrezzo', 0, 'KeyZ');
    await imposta('barca', 'perle', 0, 'KeyZ');
    await pad.premi(2);
    await page.keyboard.press('KeyZ');
    const borgo = await visti();
    assert(borgo.filter((k) => k === '+KeyQ').length === 2 && !borgo.includes('+KeyT'), 'binding Borgo: ' + borgo);
    await page.evaluate(() => window.__game.test.setMode('boat'));
    await pad.premi(2);
    await page.keyboard.press('KeyZ');
    const barca = await visti();
    assert(barca.includes('+KeyP') && barca.includes('+KeyT') && !barca.includes('+KeyQ'), 'binding Barca: ' + barca);
    await page.evaluate(() => window.__game.test.setMode('walk'));
    await page.reload(); await ctx.waitReady(page, 20000); await registra();
    await page.keyboard.press('KeyZ');
    assert((await visti()).includes('+KeyQ'), 'la rimappatura non è rimasta salvata');
    pad = await collegaController(page);
  });

  const seleziona = async (sel) => {
    for (let i = 0; i < 60; i++) {
      if (await page.locator(sel + '[data-pad-focus]').count()) return;
      await pad.premi(5);
    }
    throw new Error('Pulsante irraggiungibile col controller: ' + sel);
  };

  await ctx.test('Start apre le impostazioni e si cambia il binding usando solo il pad', async () => {
    await pad.premi(9);
    await page.waitForSelector('#mzSet.on');
    await seleziona('#mzSet [data-set="comandi"]');
    await pad.premi(0);
    await page.waitForSelector('#mzCmdModo');
    await seleziona('#mzCmdModo');
    await pad.premi(15);
    await page.waitForFunction(() => document.querySelector('#mzCmdModo').value === 'barca');
    await seleziona('#mzCmdStick');
    await pad.premi(15);
    await page.waitForFunction(() => document.querySelector('#mzCmdStick').value === '1');
    await seleziona('[data-cmd="azione:p0"]');
    await pad.premi(0);
    await page.waitForSelector('[data-cmd="azione:p0"].attesa');
    await pad.premi(5);
    assert((await page.textContent('[data-cmd="azione:p0"]')) === 'RB', 'pulsante non assegnato');
    await ctx.shot(page, 'schermata_controller');
    await pad.premi(1);
    await page.waitForSelector('#mzSet [data-set="comandi"]');
    await pad.premi(1);
    await page.waitForSelector('#mzSet.on', { state: 'hidden' });
    assert((await ctx.getState(page)).comandi.azione.pad === 0, 'assegnazione Barca applicata nel Borgo');
    await page.evaluate(() => window.__game.test.setMode('boat'));
    await pad.stato();
    await pad.stato([], [0, 0, 0.9, 0]);
    await ctx.waitState(page, (s) => s.comandi.mov.x > 0.5, 8000);
    await pad.stato();
  });

  ctx.noErrors(p, 'comandi');
  await page.context().close();

  await ctx.test('telefono: modalità, assegnazione e ripristino del solo profilo', async () => {
    const tel = await ctx.open('?test=1&net=0', { viewport: { width: 390, height: 844, isMobile: true, hasTouch: true } });
    await ctx.waitReady(tel.page, 35000);
    await tel.page.click('#mzSetBtn');
    await tel.page.click('#mzSet [data-set="comandi"]');
    const select = tel.page.locator('#mzCmdModo');
    await select.selectOption('dungeon');
    assert((await tel.page.textContent('[data-cmd="eroe:p0"]')) === 'Select', 'inventario Dungeon assente');
    assert((await tel.page.textContent('[data-cmd="pausa:p0"]')) === 'Start', 'pausa Dungeon assente');
    await ctx.shot(tel.page, 'dungeon_390');
    await select.selectOption('borgo');
    await tel.page.click('[data-cmd="foto:k0"]');
    await tel.page.keyboard.press('KeyZ');
    assert((await tel.page.textContent('[data-cmd="foto:k0"]')) === 'Z', 'tasto Foto non rimappato');
    await tel.page.click('.mz-cmd-top button:nth-child(2)');
    assert((await tel.page.textContent('[data-cmd="foto:k0"]')) === 'O', 'profilo Borgo non ripristinato');
    ctx.noErrors(tel, 'comandi al telefono');
  });

}
