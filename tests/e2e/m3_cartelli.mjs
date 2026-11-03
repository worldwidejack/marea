// Cartelli (#129, poi «fuori dalle balle»), senza server (net=0): i cartelli del mondo si vedono solo da vicino (entro LABEL_NEAR_M),
// più lontano spariscono, da PC e da telefono. Screenshot della piazza da PC.
export const timeout = 120000;
export default async function (ctx) {
  const { assert } = ctx;
  const lbl = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? { shown: !!e.style.transform && !e.style.transform.includes('-9999') } : null; }, sel);
  const posto = async (page, id) => (await ctx.getState(page)).porto.posti.find((p) => p.id === id);
  const vai = async (page, x, z) => { await page.evaluate(([x, z]) => window.__game.test.teleport(x, z), [x, z]); };

  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await ctx.waitState(d.page, (s) => s.porto && s.porto.posti.length >= 3, 20000);

  await ctx.test('PC: lontano dalla piazza i cartelli sono nascosti, davanti alla Bacheca si vede', async () => {
    const b = await posto(d.page, 'bacheca');
    await vai(d.page, b.fronte.x, b.fronte.z + 40);
    await d.page.waitForFunction(() => ['mercante', 'bacheca'].every((k) => !document.querySelector(`.mz-lbl[data-porto="${k}"]`)?.style.transform || document.querySelector(`.mz-lbl[data-porto="${k}"]`).style.transform.includes('-9999')), null, { timeout: 15000 }).catch(() => {});
    const m = await lbl(d.page, '.mz-lbl[data-porto="mercante"]'), lont = await lbl(d.page, '.mz-lbl[data-porto="bacheca"]');
    assert(m && !m.shown && lont && !lont.shown, 'da lontano: ' + JSON.stringify([m, lont]));
    await vai(d.page, b.fronte.x, b.fronte.z + 1);
    await d.page.waitForFunction(() => (() => { const x = document.querySelector('.mz-lbl[data-porto="bacheca"]')?.style.transform; return !!x && !x.includes('-9999'); })(), null, { timeout: 15000 }).catch(() => {});
    const bb = await lbl(d.page, '.mz-lbl[data-porto="bacheca"]');
    assert(bb && bb.shown, 'Bacheca da vicino: ' + JSON.stringify(bb));
    await ctx.shot(d.page, 'desktop_cartelli_piazza');
  });

  await ctx.test('PC: avvicinandosi al Mercante il suo cartello compare', async () => {
    const m = await posto(d.page, 'mercante');
    await vai(d.page, m.fronte.x, m.fronte.z + 1);
    await d.page.waitForFunction(() => (() => { const x = document.querySelector('.mz-lbl[data-porto="mercante"]')?.style.transform; return !!x && !x.includes('-9999'); })(), null, { timeout: 15000 }).catch(() => {});
    const l = await lbl(d.page, '.mz-lbl[data-porto="mercante"]');
    assert(l && l.shown, 'Mercante da vicino: ' + JSON.stringify(l));
  });

  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  await ctx.waitState(p.page, (s) => s.porto && s.porto.posti.length >= 3, 20000);
  await ctx.test('telefono: anche qui i cartelli lontani sono nascosti', async () => {
    const b = await posto(p.page, 'bacheca');
    await vai(p.page, b.fronte.x, b.fronte.z + 40);
    await p.page.waitForTimeout(1500);
    const m = await lbl(p.page, '.mz-lbl[data-porto="bacheca"]');
    assert(m && !m.shown, 'sul telefono la Bacheca lontana si vede: ' + JSON.stringify(m));
  });
}