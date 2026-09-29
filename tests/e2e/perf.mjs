// Perf: 20 s di navigazione guidata (frecce alternate a piedi, salita in barca, zoom) con perf() letto ogni secondo.
// Vincoli (TECH §5): drawCalls ≤ 100, triangoli ≤ 150.000. FPS e memoria JS solo riportati (Chrome headless usa SwiftShader: gli fps non dicono nulla di un telefono vero).
// Uscita: tests/out/perf.json
export const timeout = 90000;
const MAX_DRAW = 100, MAX_TRIS = 150000, SECONDS = 20, MAX_HEAP_MB = 400;
// Copione: ogni secondo `t` una lista di azioni. Frecce a piedi per 8 s, poi barca (hook setMode: la salita reale richiede A vicino al molo, la copre boot.mjs).
const KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
const BOAT_KEYS = ['ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']; // in barca: cambia rotta ogni secondo

export default async function (ctx) {
  const { assert } = ctx;
  const p = await ctx.open('?test=1&net=0', { viewport: ctx.viewport });
  await ctx.waitReady(p.page, 30000);
  const samples = []; let held = null;
  const press = async (k) => { if (held) await p.page.keyboard.up(held); held = k; if (k) await p.page.keyboard.down(k); };
  const hook = (fn, ...args) => p.page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);

  await ctx.test(`navigazione guidata ${SECONDS} s, budget draw call e triangoli`, async () => {
    const t0 = Date.now();
    for (let s = 0; s < SECONDS; s++) {
      if (s < 8) await press(KEYS[Math.floor(s / 2) % 4]);              // 0-8 s: a piedi, cambia direzione ogni 2 s
      else {
        if (s === 8) { await press(null); await hook('setMode', 'boat'); }
        await press(BOAT_KEYS[(s - 8) % BOAT_KEYS.length]);
      }
      if (s % 3 === 0) await hook('setZoom', [0.6, 1.0, 1.6, 1.0][(s / 3) % 4 | 0]);       // zoom min → normale → max → normale
      await p.page.waitForTimeout(1000);
      const perf = await ctx.getPerf(p.page);
      const mem = await p.page.evaluate(() => (performance.memory ? { usedMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), totalMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(1) } : null));
      const st = await ctx.getState(p.page);
      samples.push({ t: s + 1, mode: st.mode, zoom: +(st.camera?.zoom ?? 0).toFixed(2), ...perf, mem });
    }
    await press(null);
    ctx.log(`${SECONDS} s in ${((Date.now() - t0) / 1000).toFixed(1)} s reali`);
    ctx.noErrors(p, 'perf');
    const draws = samples.map((x) => x.drawCalls), tris = samples.map((x) => x.triangles), fps = samples.map((x) => x.fps).filter((x) => x > 0);
    const heaps = samples.map((x) => x.mem?.usedMB).filter((x) => x != null);
    const sum = {
      drawCallsMax: Math.max(...draws), drawCallsAvg: +(draws.reduce((a, b) => a + b, 0) / draws.length).toFixed(1),
      trianglesMax: Math.max(...tris), fpsMin: fps.length ? +Math.min(...fps).toFixed(1) : null, fpsAvg: fps.length ? +(fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(1) : null,
      heapMBMax: heaps.length ? Math.max(...heaps) : null, heapMBFirst: heaps[0] ?? null, heapMBLast: heaps.at(-1) ?? null,
    };
    const file = ctx.writeOut('perf.json', { when: new Date().toISOString(), viewport: ctx.viewportName, limits: { drawCalls: MAX_DRAW, triangles: MAX_TRIS, heapMB: MAX_HEAP_MB }, summary: sum, samples });
    ctx.log(`draw call max ${sum.drawCallsMax} (media ${sum.drawCallsAvg}) · triangoli max ${sum.trianglesMax} · fps min/media ${sum.fpsMin}/${sum.fpsAvg} (SwiftShader: solo indicativi) · heap ${sum.heapMBFirst ?? 'n/d'} → ${sum.heapMBLast ?? 'n/d'} MB`);
    ctx.log('→ ' + file.replace(ctx.ROOT + '/', ''));
    assert(sum.drawCallsMax > 0, 'draw call = 0: perf() non legge il renderer');
    assert(sum.drawCallsMax <= MAX_DRAW, `draw call ${sum.drawCallsMax} > ${MAX_DRAW}`);
    assert(sum.trianglesMax <= MAX_TRIS, `triangoli ${sum.trianglesMax} > ${MAX_TRIS}`);
    if (sum.heapMBMax != null) assert(sum.heapMBMax <= MAX_HEAP_MB, `heap JS ${sum.heapMBMax} MB > ${MAX_HEAP_MB} MB (perdita di memoria?)`);
    if (sum.fpsMin != null && sum.fpsMin < 30) ctx.warn('fps', `min ${sum.fpsMin} (SwiftShader software, non giudicabile; controlla su un telefono con ?fps=1)`);
    if (sum.heapMBFirst != null && sum.heapMBLast > sum.heapMBFirst * 2 + 20) ctx.warn('memoria', `heap cresciuto ${sum.heapMBFirst} → ${sum.heapMBLast} MB in ${SECONDS} s`);
  });
}
