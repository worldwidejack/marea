// Comando reale da telefono: ingresso nella sim, costo, ingombri e ritorno alla locomozione.
export async function provaSchivata(ctx, page, dungeon) {
  await ctx.test(`schivata ${dungeon ? 'dungeon' : 'mondo'}: pulsante touch e V, costo e ingombri a 390×844`, async () => {
    if (dungeon) {
      await page.evaluate(() => window.__game.test.dungeonAutopilot(false));
      await ctx.waitState(page, (s) => s.dungeon.hero.anim === 'fermo', 10000);
    }
    const rects = await page.evaluate(() => ['btnSchiva', 'btnA', 'btnB', 'btnD', 'btnF1', 'btnF2', 'btnF3', 'mzDngMira', 'btnE', 'joystick'].map(id => {
      const r = document.getElementById(id)?.getBoundingClientRect();
      return { id, x: r?.x ?? 0, y: r?.y ?? 0, w: r?.width ?? 0, h: r?.height ?? 0 };
    }));
    const vp = page.viewportSize(), b = rects[0]; ctx.assert(b.w >= 56 && b.h >= 56 && b.x >= 0 && b.x + b.w <= vp.width && b.y + b.h <= vp.height, JSON.stringify(rects));
    for (const r of rects.slice(1).filter(r => r.w > 0)) ctx.assert(!(b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y), `Schiva copre ${r.id}`);
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => document.getElementById('btnSchiva').addEventListener('pointerdown', () => {
      window.__rollBefore = window.__game.state().dungeon?.hero?.stamina;
    }, { once: true, capture: true }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 }] });
    try {
      await ctx.waitState(page, s => s.dungeon?.active ? s.dungeon.hero.anim === 'schiva' : s.avatar.anim === 'roll', 8000);
      const during = await ctx.getState(page), before = await page.evaluate(() => window.__rollBefore);
      if (dungeon) ctx.assert(Math.abs(before - during.dungeon.hero.stamina - 24) < 1, `stamina ${before} → ${during.dungeon.hero.stamina}`);
      await ctx.shot(page, dungeon ? 'schivata_dungeon_390' : 'schivata_mondo_390');
    } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); }
    await ctx.waitState(page, s => s.dungeon?.active ? s.dungeon.hero.anim === 'fermo' : s.avatar.anim === 'idle', 10000);
    if (!dungeon) {
      await ctx.waitState(page, s => !s.avatar.rollCd && !s.avatar.prevRoll, 10000);
      await page.keyboard.down('KeyV');
      try { await ctx.waitState(page, s => s.avatar.anim === 'roll', 8000); } finally { await page.keyboard.up('KeyV'); }
      await ctx.waitState(page, s => s.avatar.anim === 'idle', 10000);
    }
  });
}
