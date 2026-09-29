// WP1 render-mondo: screenshot delle viste chiave (spawn telefono/desktop, zoom min/max, barca in mare aperto, isola dall'alto),
// canvas non vuoto, camera ferma quando l'avatar è fermo, budget di draw call e triangoli (TECH §5).
export const timeout = 150000;
const BUDGET = { drawCalls: 100, triangles: 150000 };
export default async function (ctx) {
  const { assert } = ctx;
  const settle = (p, ms = 900) => p.page.waitForTimeout(ms);
  const varOk = async (p, what) => { const s = await ctx.screenStats(p.page); assert(s.variance > 50, `${what}: varianza ${s.variance.toFixed(1)} troppo bassa`); return s; };
  const perfOk = async (p, what) => {
    const perf = await ctx.getPerf(p.page);
    ctx.log(what, JSON.stringify(perf));
    assert(perf.drawCalls > 0 && perf.drawCalls <= BUDGET.drawCalls, `${what}: draw call ${perf.drawCalls} (budget ${BUDGET.drawCalls})`);
    assert(perf.triangles > 0 && perf.triangles <= BUDGET.triangles, `${what}: triangoli ${perf.triangles} (budget ${BUDGET.triangles})`);
    return perf;
  };

  const p = await ctx.open('?test=1&net=0');
  await ctx.test('telefono: pronto senza errori', async () => { await ctx.waitReady(p.page); await settle(p, 1200); ctx.noErrors(p, 'wp1 telefono'); });
  await ctx.shot(p.page, 'iphone_spawn');
  await ctx.test('telefono: spawn disegnato e nel budget', async () => { await varOk(p, 'spawn'); await perfOk(p, 'spawn'); });
  await ctx.test('camera ferma quando l’avatar è fermo (niente jitter)', async () => {
    const a = (await ctx.getState(p.page)).camera; await p.page.waitForTimeout(400); const b = (await ctx.getState(p.page)).camera;
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    assert(d < 1e-4, `la camera si muove da ferma: ${d}`);
  });
  await ctx.test('zoom min e max', async () => {
    await p.page.evaluate(() => window.__game.test.setZoom(0.6)); await settle(p, 500); await ctx.shot(p.page, 'iphone_zoom_min'); await varOk(p, 'zoom min');
    const c0 = (await ctx.getState(p.page)).camera; assert(Math.abs(c0.zoom - 0.6) < 0.01, `zoom min ${c0.zoom}`);
    await p.page.evaluate(() => window.__game.test.setZoom(1.6)); await settle(p, 500); await ctx.shot(p.page, 'iphone_zoom_max'); await varOk(p, 'zoom max');
    const c1 = (await ctx.getState(p.page)).camera; assert(Math.abs(c1.zoom - 1.6) < 0.01, `zoom max ${c1.zoom}`);
    await perfOk(p, 'zoom max');
    await p.page.evaluate(() => window.__game.test.setZoom(1));
  });
  await ctx.test('barca in mare aperto', async () => {
    await p.page.evaluate(() => window.__game.test.setMode('boat'));
    // Tiene giù finché la barca è a > 18 m dal punto di partenza (la sim rallenta col rendering software dei test).
    const s0 = (await ctx.getState(p.page)).boat;
    await p.page.keyboard.down('ArrowDown');
    await ctx.waitState(p.page, (st, a) => Math.hypot(st.boat.x - a.x, st.boat.z - a.z) > 18, 25000, { x: s0.x, z: s0.z }).catch(() => {});
    await p.page.keyboard.up('ArrowDown');
    await settle(p, 700);
    await ctx.shot(p.page, 'iphone_barca_mare');
    const st = await ctx.getState(p.page);
    assert(st.mode === 'boat', 'non è in barca');
    await varOk(p, 'barca'); await perfOk(p, 'barca');
  });

  await p.close(); // una pagina alla volta: col rendering software due pagine insieme si rubano la CPU
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.test('desktop: pronto senza errori', async () => { await ctx.waitReady(d.page); await settle(d, 1200); ctx.noErrors(d, 'wp1 desktop'); });
  await ctx.shot(d.page, 'desktop_spawn');
  await ctx.test('desktop: spawn nel budget', async () => { await varOk(d, 'desktop spawn'); await perfOk(d, 'desktop spawn'); });
  await ctx.test('desktop: isola dall’alto (centro, zoom max)', async () => {
    const isl = (await ctx.getState(d.page)).island;
    await d.page.evaluate(([x, z]) => { window.__game.test.teleport(x, z); window.__game.test.setZoom(1.6); }, [isl.w, isl.h]); // centro: w×tile/2 = w
    await settle(d, 1500);
    await ctx.shot(d.page, 'desktop_alto');
    await varOk(d, 'dall’alto'); await perfOk(d, 'dall’alto');
    ctx.noErrors(d, 'wp1 desktop');
  });
}
