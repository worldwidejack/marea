// Il cartellino «La tua barca» (game/mia_barca.ts) non copre i comandi a schermo. Senza server (net=0) si nasce al Porto e la tua barca
// sta in basso a sinistra, proprio sotto il joystick: da telefono il cartellino sale sopra il joystick (prima lo copriva). Girando la camera
// non finisce mai sopra joystick, A, B o la scritta sotto la A. Sul PC (niente comandi a schermo) resta sopra la barca.
export const timeout = 120000;

export default async function (ctx) {
  const { assert } = ctx;
  /** Il cartellino e i comandi che tocca (rettangoli a schermo). */
  const guarda = (page) => page.evaluate(() => {
    const s = window.__game.state().miaBarca, t = document.querySelector('#mzMiaBarca .t'), b = s.on && t ? t.getBoundingClientRect() : null;
    const cmd = ['joystick', 'btnA', 'btnB', 'btnAzione'].map((id) => document.getElementById(id)).filter((e) => e && e.offsetParent !== null)
      .map((e) => ({ id: e.id, r: e.getBoundingClientRect() })).filter((c) => c.r.width > 0);
    const sopra = b ? cmd.filter((c) => b.right > c.r.left && b.left < c.r.right && b.bottom > c.r.top && b.top < c.r.bottom).map((c) => c.id) : [];
    return { on: s.on, alzato: s.alzato, box: b && b.toJSON(), sopra, comandi: cmd.map((c) => c.id) };
  });

  const t = await ctx.open('?test=1&net=0', { viewport: ctx.B.IPHONE });
  await ctx.waitReady(t.page, 30000);
  await ctx.test('telefono: all’avvio il cartellino della tua barca sale sopra il joystick invece di coprirlo', async () => {
    await ctx.waitState(t.page, (s) => s.miaBarca && s.miaBarca.on, 10000);
    await t.page.waitForTimeout(800); // i comandi si rileggono ogni ¼ s
    const g = await guarda(t.page);
    ctx.log('avvio: ' + JSON.stringify({ ...g, box: g.box && [Math.round(g.box.left), Math.round(g.box.top), Math.round(g.box.right), Math.round(g.box.bottom)] }));
    assert(g.comandi.includes('joystick'), 'niente joystick sul telefono: ' + JSON.stringify(g.comandi));
    assert(!g.sopra.length, 'il cartellino copre ' + g.sopra.join(', '));
    assert(g.alzato, 'all’avvio la barca sta sotto il joystick: il cartellino doveva salire');
    await ctx.shot(t.page, 'telefono_avvio');
  });
  await ctx.test('telefono: girando la camera il cartellino non copre mai i comandi', async () => {
    for (const y of [Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI / 4]) {
      await t.page.evaluate((v) => window.__game.test.camYaw(v), y);
      await t.page.waitForTimeout(700);
      const g = await guarda(t.page);
      assert(!g.sopra.length, `camera ${y.toFixed(2)}: il cartellino copre ${g.sopra.join(', ')}`);
    }
    ctx.noErrors(t, 'telefono');
  });

  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 30000);
  await ctx.test('PC: il cartellino resta sopra la barca', async () => {
    await ctx.waitState(d.page, (s) => s.miaBarca && s.miaBarca.on, 10000);
    await d.page.waitForTimeout(800);
    const g = await guarda(d.page);
    assert(!g.alzato && !g.sopra.length, 'PC: ' + JSON.stringify({ alzato: g.alzato, sopra: g.sopra }));
    ctx.noErrors(d, 'PC');
  });
}
