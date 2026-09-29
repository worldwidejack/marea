// Avvio: nessun errore, __game.ready, canvas non vuoto, l'avatar cammina e sale in barca. Screenshot telefono e desktop.
export const timeout = 120000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0&fps=1');
  await ctx.test('ready senza errori (obiettivo 8 s, limite 20 s: con più agenti in parallelo SwiftShader rallenta)', async () => {
    const t0 = Date.now(); await ctx.waitReady(p.page, 20000); const ms = Date.now() - t0;
    if (ms > 8000) ctx.warn('ready lento', `${ms} ms dopo il load (obiettivo 8 s; su macchina carica è normale)`);
    ctx.noErrors(p, 'boot');
  });
  await ctx.test('il canvas disegna qualcosa', async () => { await p.page.waitForTimeout(600); const s = await ctx.screenStats(p.page); ctx.assert(s.variance > 50, `varianza ${s.variance.toFixed(1)} troppo bassa`); });
  await ctx.shot(p.page, 'iphone_spawn');
  await ctx.test('l’avatar cammina con un input iniettato', async () => {
    const s0 = (await ctx.getState(p.page)).avatar;
    await p.page.evaluate(() => { window.__game.test.teleport(window.__game.state().island.spawn.x, window.__game.state().island.spawn.z); });
    await p.page.keyboard.down('ArrowUp'); await p.page.waitForTimeout(700); await p.page.keyboard.up('ArrowUp');
    const s1 = (await ctx.getState(p.page)).avatar;
    ctx.assert(Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.5, `non si è mosso (${s0.x},${s0.z}) → (${s1.x},${s1.z})`);
  });
  await ctx.test('sale in barca e naviga', async () => {
    await p.page.evaluate(() => window.__game.test.setMode('boat'));
    // joystick (frecce) = vira e accelera verso il mare aperto (giù sullo schermo = sud-est); A vicino al molo vorrebbe dire "scendi"
    await p.page.keyboard.down('ArrowDown'); await p.page.waitForTimeout(1500); await p.page.keyboard.up('ArrowDown');
    const st = await ctx.getState(p.page);
    ctx.assert(st.mode === 'boat', 'non è in barca');
    ctx.assert(st.boat.speed > 0.5, `barca ferma (${st.boat.speed})`);
  });
  await ctx.shot(p.page, 'iphone_barca');
  await ctx.test('zoom min e max', async () => {
    await p.page.evaluate(() => window.__game.test.setZoom(0.6)); await p.page.waitForTimeout(300); await ctx.shot(p.page, 'iphone_zoom_min');
    await p.page.evaluate(() => window.__game.test.setZoom(1.6)); await p.page.waitForTimeout(300); await ctx.shot(p.page, 'iphone_zoom_max');
    const c = (await ctx.getState(p.page)).camera; ctx.assert(c.zoom > 1.5, `zoom ${c.zoom}`);
  });
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.test('desktop: ready senza errori', async () => { await ctx.waitReady(d.page, 20000); await d.page.waitForTimeout(500); ctx.noErrors(d, 'desktop'); });
  await ctx.shot(d.page, 'desktop_spawn');
  await ctx.test('prestazioni: dati letti', async () => { const perf = await ctx.getPerf(d.page); ctx.log('perf', JSON.stringify(perf)); ctx.assert(perf.drawCalls > 0 && perf.drawCalls <= 100, `draw call ${perf.drawCalls}`); });
}
