// M1-mondo · arcipelago: spawn sul proprio lotto (?slot=N) o al Porto, hook goto(), viste di Porto, lotto, laguna, facciate e
// barca in mare aperto tra le isole, ognuna nel budget di TECH §5 (draw call ≤ 100, triangoli ≤ 150.000). Numeri: tests/out/m1_mondo.json
export const timeout = 240000;
const BUDGET = { drawCalls: 100, triangles: 150000 };

export default async function (ctx) {
  const { assert } = ctx;
  const numbers = {};
  const hook = (p, fn, ...args) => p.page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const ticks = (p) => p.page.evaluate(() => window.__game.state().wp2_boat.ticks);
  const waitTicks = async (p, n) => { const t0 = await ticks(p); await p.page.waitForFunction(([t0, n]) => window.__game.state().wp2_boat.ticks - t0 >= n, [t0, n], { timeout: 60000, polling: 50 }); };
  const view = async (p, name, prep) => {
    await ctx.test(`vista ${name}`, async () => {
      await prep();
      await p.page.waitForTimeout(700);
      await ctx.shot(p.page, name);
      const s = await ctx.screenStats(p.page);
      assert(s.variance > 50, `${name}: varianza ${s.variance.toFixed(1)} (schermo vuoto)`);
      const perf = await ctx.getPerf(p.page);
      const st = await ctx.getState(p.page);
      numbers[name] = { drawCalls: perf.drawCalls, triangles: perf.triangles, fps: perf.fps, place: st.arch.place, x: +(st.mode === 'boat' ? st.boat.x : st.avatar.x).toFixed(1), z: +(st.mode === 'boat' ? st.boat.z : st.avatar.z).toFixed(1) };
      ctx.log(name, JSON.stringify(numbers[name]));
      assert(perf.drawCalls > 0 && perf.drawCalls <= BUDGET.drawCalls, `${name}: draw call ${perf.drawCalls} (budget ${BUDGET.drawCalls})`);
      assert(perf.triangles <= BUDGET.triangles, `${name}: triangoli ${perf.triangles} (budget ${BUDGET.triangles})`);
      ctx.noErrors(p, name);
    });
  };

  // --- senza slot: si nasce al Porto ---
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 30000);
  await ctx.test('senza slot: spawn al Porto, sulla terraferma, barca ormeggiata accanto al molo', async () => {
    const st = await ctx.getState(p.page);
    ctx.log('isola', JSON.stringify(st.island), 'arch', JSON.stringify({ slot: st.arch.slot, place: st.arch.place, lots: st.arch.lots }));
    assert(st.arch.slot === null && st.arch.place === 'porto', `spawn fuori dal Porto: ${st.arch.place}`);
    assert(st.island.w >= 200 && st.arch.lots === 8, 'la mappa non è l’arcipelago');
    assert(Math.hypot(st.boat.x - st.island.dock.x, st.boat.z - st.island.dock.z) <= 3, 'barca lontana dal molo');
    const chunks = st.arch.chunks; ctx.log('isole (tri istanziati)', chunks.map((c) => `${c.id}:${c.tris}`).join(' '));
  });
  await view(p, '1_porto', async () => { await hook(p, 'setZoom', 1.3); });
  await view(p, '2_porto_piazza_alto', async () => { await hook(p, 'teleport', 265, 275); await hook(p, 'setZoom', 1.6); });
  await view(p, '2b_porto_torii_vicino', async () => { await hook(p, 'teleport', 265, 299); await hook(p, 'setZoom', 0.6); });
  await view(p, '3_lotto_0', async () => { const r = await hook(p, 'goto', 'lotto:0'); assert(r && r.slot === 0, 'goto lotto:0'); await hook(p, 'setZoom', 1.6); });
  await view(p, '4_lotto_0_centro', async () => { await hook(p, 'teleport', (148 + 15) * 2, (78 + 12) * 2); await hook(p, 'setZoom', 1.6); });
  await view(p, '5_laguna', async () => { const r = await hook(p, 'goto', 'laguna'); assert(r && r.island === 'laguna', 'goto laguna'); await hook(p, 'setZoom', 1.6); });
  await view(p, '6_neon', async () => { await hook(p, 'goto', 'neon'); await hook(p, 'setZoom', 1.6); });
  await view(p, '7_selvaggia', async () => { await hook(p, 'goto', 'selvaggia'); await hook(p, 'setZoom', 1.6); });
  await view(p, '8_barca_tra_le_isole', async () => {
    await hook(p, 'goto', 'porto'); await hook(p, 'setZoom', 1.3); await hook(p, 'setMode', 'boat');
    // prima verso il largo (sud-est), poi a est: tra il Porto e la laguna
    await p.page.keyboard.down('ArrowDown'); await waitTicks(p, 60 * 2); await p.page.keyboard.up('ArrowDown');
    await p.page.keyboard.down('ArrowRight'); await waitTicks(p, 60 * 4); await p.page.keyboard.up('ArrowRight');
    const st = await ctx.getState(p.page);
    assert(st.mode === 'boat' && st.boat.speed > 2, `barca ferma (${st.boat.speed})`);
  });
  await p.close();

  // --- con ?slot=3: si nasce sul molo del proprio lotto con la barca ormeggiata ---
  const q = await ctx.open('?test=1&net=0&slot=3');
  await ctx.waitReady(q.page, 30000);
  await ctx.test('?slot=3: spawn sul lotto 3, barca al suo molo; salita in barca con A', async () => {
    const st = await ctx.getState(q.page);
    assert(st.arch.slot === 3 && st.arch.place === 'lotto', `slot ${st.arch.slot} place ${st.arch.place}`);
    await hook(q, 'teleport', st.island.dock.x, st.island.dock.z); await waitTicks(q, 10);
    await q.page.keyboard.down('KeyJ').catch(() => {}); await q.page.keyboard.up('KeyJ').catch(() => {});
    await q.page.evaluate(() => { const b = document.getElementById('btnA'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, pointerType: 'touch', bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, pointerType: 'touch', bubbles: true })); });
    await waitTicks(q, 10);
    assert((await ctx.getState(q.page)).mode === 'boat', 'dal molo del lotto non si sale in barca');
  });
  await view(q, '9_spawn_slot3', async () => { await hook(q, 'setMode', 'walk'); await hook(q, 'setZoom', 1.3); });
  await q.close();

  // --- desktop: Porto largo ---
  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 30000);
  await view(d, '10_desktop_porto', async () => { await hook(d, 'teleport', 265, 278); await hook(d, 'setZoom', 1.6); });
  await view(d, '11_desktop_lotto', async () => { await hook(d, 'goto', 'lotto:5'); await hook(d, 'teleport', (240 + 15) * 2, (122 + 12) * 2); await hook(d, 'setZoom', 1.6); });
  ctx.writeOut('m1_mondo.json', { when: new Date().toISOString(), budget: BUDGET, views: numbers });
}
