// Minimappa (#62): il cerchio c'è (telefono in alto a destra, PC in basso a destra), M e il tocco aprono la mappa intera, Esc e ×
// la chiudono; Porto scoperto da subito, le altre isole nella nebbia finché non ci passi vicino. Screenshot: telefono e PC.
export const timeout = 240000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  await p.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 10000 });
  await ctx.test('il cerchio c’è; Porto scoperto, le altre isole nella nebbia', async () => {
    await p.page.waitForTimeout(600);
    const st = (await ctx.getState(p.page)).mappa;
    ctx.assert(st && st.mini, `minimappa non visibile: ${JSON.stringify(st)}`);
    ctx.assert(st.viste.some((v) => v.startsWith('porto')), `Porto non scoperto: ${JSON.stringify(st.viste)}`);
    ctx.assert(st.coperte.length > 0, 'nessuna isola nella nebbia');
    const box = await p.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth }; });
    ctx.assert(box.w >= 80 && box.x + box.w <= box.vw && box.y < 200, `posto del cerchio: ${JSON.stringify(box)}`);
    await ctx.shot(p.page, 'iphone_mini');
  });
  await ctx.test('M apre la mappa intera, Esc la chiude', async () => {
    await p.page.keyboard.press('KeyM'); await p.page.waitForTimeout(300);
    ctx.assert((await ctx.getState(p.page)).mappa.open, 'M non ha aperto la mappa');
    await ctx.shot(p.page, 'iphone_mappa');
    await p.page.keyboard.press('Escape'); await p.page.waitForTimeout(200);
    ctx.assert(!(await ctx.getState(p.page)).mappa.open, 'Esc non ha chiuso la mappa');
  });
  await ctx.test('il tocco sul cerchio apre, × chiude', async () => {
    await p.page.click('#mzMini'); await p.page.waitForTimeout(300);
    ctx.assert((await ctx.getState(p.page)).mappa.open, 'il tocco non ha aperto la mappa');
    await p.page.click('#mzMappa .hd button'); await p.page.waitForTimeout(200);
    ctx.assert(!(await ctx.getState(p.page)).mappa.open, '× non ha chiuso la mappa');
  });
  await ctx.test('isole scoperte: niente più nebbia, la scelta resta dopo il ricaricamento', async () => {
    await p.page.evaluate(() => window.__game.test.mappaScopri());
    ctx.assert((await ctx.getState(p.page)).mappa.coperte.length === 0, 'nebbia rimasta');
    await p.page.evaluate(() => window.__game.test.mappa('apri')); await p.page.waitForTimeout(300);
    await ctx.shot(p.page, 'iphone_mappa_scoperta');
    await p.page.reload(); await ctx.waitReady(p.page, 20000); await p.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 10000 }); await p.page.waitForTimeout(400);
    ctx.assert((await ctx.getState(p.page)).mappa.coperte.length === 0, 'le scoperte non sono rimaste');
    ctx.noErrors(p, 'minimappa');
  });
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await d.page.waitForFunction(() => !!document.getElementById('mzMini'), null, { timeout: 10000 });
  await ctx.test('PC: cerchio in basso a destra, mappa grande', async () => {
    await d.page.waitForTimeout(600);
    await ctx.shot(d.page, 'desktop_mini');
    const box = await d.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, vw: innerWidth, vh: innerHeight }; });
    ctx.assert(box.x > box.vw / 2 && box.y > box.vh / 2, `posto del cerchio: ${JSON.stringify(box)}`);
    await d.page.keyboard.press('KeyM'); await d.page.waitForTimeout(300);
    await ctx.shot(d.page, 'desktop_mappa');
    const perf = await ctx.getPerf(d.page); ctx.log('perf', JSON.stringify(perf));
    ctx.assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(d, 'desktop');
  });
}
