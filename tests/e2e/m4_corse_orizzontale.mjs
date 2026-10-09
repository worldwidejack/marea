// Le Corse da telefono si giocano in orizzontale (apps/client/src/corse/avviso_ruota.ts, #182):
// - telefono in verticale: avviso «Ruota il telefono», la gara sta ferma, la scappatoia piccola lo toglie;
// - telefono in orizzontale (844×390): niente avviso, il pannello delle prove è chiuso, HUD e comandi dentro lo schermo, la gara va;
// - PC con la finestra stretta: nessun avviso (il puntatore non è un dito).
// Screenshot in tests/out/shots/m4_corse_orizzontale_*.
export const timeout = 180000;
const TEL_V = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const TEL_O = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC_STRETTO = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

export default async function (ctx) {
  const { assert } = ctx;
  const apri = async (viewport) => {
    const p = await ctx.open('provapiste.html?pista=spiaggia_lungomare&bot=1', { viewport });
    await p.page.waitForFunction(() => window.__provapiste && window.__provapiste.ready === true, null, { timeout: 30000 });
    return p;
  };
  const avviso = (page) => page.evaluate(() => document.querySelector('.pp-ruota')?.classList.contains('on') ?? null);

  await ctx.test('telefono in verticale: avviso «ruota il telefono», gara ferma, scappatoia', async () => {
    const p = await apri(TEL_V);
    assert((await avviso(p.page)) === true, 'l\'avviso non compare col telefono in verticale');
    await ctx.shot(p.page, 'avviso_verticale');
    await p.page.evaluate(() => window.__provapiste.set({ vai: true, auto: true }));
    await p.page.waitForTimeout(1500);
    const ms = (await p.page.evaluate(() => window.__provapiste.state())).ms;
    assert(ms === 0, `la gara è andata avanti sotto l'avviso (ms ${ms})`);
    await p.page.click('.pp-ruota button');
    assert((await avviso(p.page)) === false, 'la scappatoia non toglie l\'avviso');
    await p.page.waitForFunction(() => window.__provapiste.state().ms > 0, null, { timeout: 20000 }).catch(() => assert(false, 'dopo la scappatoia la gara non parte'));
  });

  await ctx.test('telefono in orizzontale: niente avviso, comandi dentro lo schermo, la gara va', async () => {
    const p = await apri(TEL_O);
    assert((await avviso(p.page)) === false, 'l\'avviso compare col telefono in orizzontale');
    await p.page.evaluate(() => window.__provapiste.set({ vai: true, auto: true, cam: 'dietro' }));
    await p.page.evaluate(() => window.__provapiste.avanti(300));
    await p.page.waitForTimeout(800);
    const r = await p.page.evaluate(() => {
      const W = innerWidth, H = innerHeight, fuori = [];
      for (const [nome, sel] of [['hud', '.pp-hud'], ['joystick', '#joyBase, .joy, [id*=joy]'], ['DRIFT', '#btnA'], ['FRENO', '#btnB'], ['prove', '.pp-panel'], ['opzioni', '.pp-ingr']]) {
        const el = document.querySelector(sel); if (!el) continue;
        const b = el.getBoundingClientRect(); if (b.width === 0) continue;
        if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) fuori.push(`${nome} ${Math.round(b.left)},${Math.round(b.top)}→${Math.round(b.right)},${Math.round(b.bottom)}`);
      }
      const prove = document.querySelector('.pp-panel')?.getBoundingClientRect();
      return { fuori, W, H, proveAlto: prove ? Math.round(prove.height) : 0, ms: window.__provapiste.state().ms };
    });
    assert(r.fuori.length === 0, `fuori dallo schermo ${r.W}×${r.H}: ${r.fuori.join(' · ')}`);
    assert(r.proveAlto < r.H * 0.3, `il pannello delle prove copre la pista (${r.proveAlto}px su ${r.H})`);
    assert(r.ms > 0, 'la gara non va');
    await ctx.shot(p.page, 'orizzontale_gara');
    await ctx.noErrors(p, 'banco');
  });

  await ctx.test('PC con la finestra stretta: nessun avviso', async () => {
    const p = await apri(PC_STRETTO);
    assert((await avviso(p.page)) === false, 'l\'avviso compare sul PC');
  });
}
