// Look: viste fisse per il contact sheet di Jack. Ogni vista: canvas vivo (varianza > 50), nessun errore di pagina, palette rispettata (≥ 80 % dei pixel campionati entro distanza 40 RGB (i colori illuminati scuriscono) dalla palette di ART_BIBLE §2).
// Screenshot: tests/out/shots/look_<n>_<vista>.png (il numero fissa l'ordine nel contact sheet) · numeri: tests/out/look.json
import { paletteDistance, nearestHex } from '../lib/palette.mjs';
export const timeout = 150000;
const PALETTE_MIN = 0.8, PALETTE_DIST = 40, SAMPLES = 2000, VARIANCE_MIN = 50;

export default async function (ctx) {
  const { assert } = ctx;
  const numbers = {};
  // Palette: sempre bloccante (ART_BIBLE §2). `--palette-warn` la declassa ad avviso mentre si tara la luce.
  const strict = !ctx.opts.has('--palette-warn');
  const check = async (p, view) => {
    ctx.noErrors(p, view);
    const st = await ctx.screenStats(p.page);
    assert(st.variance > VARIANCE_MIN, `${view}: varianza ${st.variance.toFixed(1)} ≤ ${VARIANCE_MIN} (schermo vuoto o piatto)`);
    const px = await ctx.B.samplePixels(p.page, SAMPLES);
    let ok = 0; const off = new Map(); // colori fuori palette, raggruppati a passi di 16
    for (let i = 0; i < px.length; i += 3) {
      if (paletteDistance(px[i], px[i + 1], px[i + 2]) <= PALETTE_DIST) { ok++; continue; }
      const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4); const e = off.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2]; off.set(k, e);
    }
    const frac = ok / (px.length / 3);
    const top = [...off.values()].sort((a, b) => b.n - a.n).slice(0, 3).map((e) => {
      const r = Math.round(e.r / e.n), g = Math.round(e.g / e.n), b = Math.round(e.b / e.n);
      return `rgb(${r},${g},${b}) ${(e.n / (px.length / 3) * 100).toFixed(0)} % (più vicino ${nearestHex(r, g, b)})`;
    });
    numbers[view] = { variance: +st.variance.toFixed(1), mean: +st.mean.toFixed(1), palette: +(frac * 100).toFixed(1) };
    ctx.log(`${view}: palette ${(frac * 100).toFixed(1)} % · varianza ${st.variance.toFixed(0)}`);
    if (frac < PALETTE_MIN) {
      const msg = `${view}: solo ${(frac * 100).toFixed(1)} % dei pixel è nella palette (serve ≥ ${PALETTE_MIN * 100} %, distanza RGB ≤ ${PALETTE_DIST}). Fuori palette: ${top.join('; ')}`;
      if (strict) throw new assert.TestFail(msg);
      numbers[view].paletteWarn = true; return msg;
    }
  };
  const view = async (p, name, prep) => {
    let warn = null;
    await ctx.test(`vista ${name}`, async () => {
      if (prep) await prep();
      await p.page.waitForTimeout(500);
      await ctx.shot(p.page, name);
      warn = await check(p, name);
    });
    if (warn) ctx.warn(`palette ${name}`, warn);
  };
  const hook = (p, fn, ...args) => p.page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const hold = async (p, key, ms) => { await p.page.keyboard.down(key); await p.page.waitForTimeout(ms); await p.page.keyboard.up(key); };

  // --- telefono ---
  const ph = await ctx.open('?test=1&net=0', { viewport: ctx.B.IPHONE });
  await ctx.waitReady(ph.page, 30000);
  await view(ph, '1_iphone_spawn', () => ph.page.waitForTimeout(600));
  await view(ph, '3_zoom_min', async () => { await hook(ph, 'setZoom', 0.6); await ph.page.waitForTimeout(400); });
  await view(ph, '4_zoom_max', async () => { await hook(ph, 'setZoom', 1.6); await ph.page.waitForTimeout(400); });
  await view(ph, '6_isola_dall_alto', async () => {
    const isl = (await ctx.getState(ph.page)).island;
    const tile = isl.tile || 2; // 1 cella = 2 m (islands.json)
    await hook(ph, 'setZoom', 1.6);
    await hook(ph, 'teleport', (isl.w * tile) / 2, (isl.h * tile) / 2);
    await ph.page.waitForTimeout(600);
  });
  await view(ph, '5_barca_mare_aperto', async () => {
    await hook(ph, 'setZoom', 1.0);
    await hook(ph, 'setMode', 'boat');
    await hold(ph, 'ArrowDown', 2000);
    const st = await ctx.getState(ph.page);
    assert(st.mode === 'boat', 'non è in barca');
    ctx.log(`barca: x=${st.boat.x.toFixed(1)} z=${st.boat.z.toFixed(1)} v=${st.boat.speed.toFixed(1)}`);
  });
  ctx.noErrors(ph, 'telefono (fine)');

  // --- desktop ---
  const dk = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(dk.page, 30000);
  await view(dk, '2_desktop_spawn', () => dk.page.waitForTimeout(600));
  ctx.noErrors(dk, 'desktop (fine)');

  ctx.writeOut('look.json', { when: new Date().toISOString(), strict, paletteMin: PALETTE_MIN, paletteDist: PALETTE_DIST, samples: SAMPLES, views: numbers });
}
