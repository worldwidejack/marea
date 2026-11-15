// La mappa del dungeon con la nebbia (docs/PRIMA_PERSONA.md §7), senza server (?test=1&net=0), telefono in orizzontale: niente bussola in alto,
// una minimappa piccola in alto a sinistra che scopre solo quello che si vede, un tocco apre la mappa grande (la partita si ferma), da lì
// si sceglie se lasciare la minimappa o il solo pulsante (e resta anche dopo aver ricaricato); M apre e chiude, Esc chiude senza aprire la Pausa.
// Screenshot in tests/out/shots/m2_mappa_dungeon_*.png.
export const timeout = 240000;
const TELEFONO = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default async function (ctx) {
  const { assert } = ctx;
  const p = await ctx.open('?test=1&net=0', { viewport: TELEFONO });
  const page = p.page;
  await ctx.waitReady(page, 30000);
  const st = () => ctx.getState(page);
  const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
  const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(), vis = getComputedStyle(e).display !== 'none'; return { x: b.x, y: b.y, w: b.width, h: b.height, vis }; }, sel);
  const tocca = async (sel) => { const r = await rect(sel); await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); };
  const entra = async () => {
    await hook('enterDungeon', 'grotta');
    await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play' && s.mappaFp, 60000);
    await page.waitForTimeout(500);
  };

  await ctx.test('nel dungeon non c’è la bussola; la minimappa è piccola, in alto a sinistra, e la nebbia nasconde quasi tutto', async () => {
    await entra();
    const s = await st();
    assert(s.mappaFp.modo === 'mini' && s.mappaFp.minimappa && !s.mappaFp.pulsante && !s.mappaFp.aperta, 'stato iniziale: ' + JSON.stringify(s.mappaFp));
    assert(s.mappaFp.viste > 0 && s.mappaFp.viste < s.mappaFp.pavimento * 0.25, `nebbia: viste ${s.mappaFp.viste} su ${s.mappaFp.pavimento}`);
    assert(!(await rect('.mz-fp-bus')), 'la bussola c’è ancora');
    const m = await rect('.mz-fp-mini'), top = await rect('#mzDngTop');
    assert(m && m.vis && m.x < 20 && m.y < 20 && m.w <= 110 && m.h <= 110, 'minimappa: ' + JSON.stringify(m));
    assert(top && m.x + m.w < top.x, 'la minimappa copre ZAINO e PAUSA: ' + JSON.stringify({ m, top }));
    await ctx.shot(page, '1_mini');
  });

  await ctx.test('un tocco apre la mappa grande (la partita si ferma); si sceglie «Pulsante» e resta solo il pulsante', async () => {
    await tocca('.mz-fp-mini');
    await ctx.waitState(page, (s) => s.mappaFp.aperta && s.dungeon.pannello, 4000);
    const g = await rect('.mz-fp-mapp'), cv = await rect('.mz-fp-mapp canvas');
    assert(g && g.x >= 0 && g.y >= 0 && g.x + g.w <= 844 && g.y + g.h <= 390, 'la mappa esce dallo schermo: ' + JSON.stringify(g));
    assert(cv.w >= 380 && cv.h >= 250, 'tela troppo piccola: ' + JSON.stringify(cv));
    const t0 = (await st()).dungeon.tick;
    await page.waitForTimeout(500);
    assert((await st()).dungeon.tick === t0, 'con la mappa aperta la partita va avanti');
    await ctx.shot(page, '2_grande');
    await tocca('.mz-fp-mapp [data-modo="pulsante"]');
    await ctx.waitState(page, (s) => !s.mappaFp.aperta && s.mappaFp.modo === 'pulsante' && s.mappaFp.pulsante && !s.mappaFp.minimappa, 4000);
    assert(!(await st()).dungeon.pannello, 'la partita è rimasta ferma');
    await ctx.shot(page, '3_pulsante');
  });

  await ctx.test('il pulsante riapre la mappa; «Minimappa» la rimette; M apre, M e Esc chiudono, e la Pausa non si apre', async () => {
    await tocca('.mz-fp-pul');
    await ctx.waitState(page, (s) => s.mappaFp.aperta, 4000);
    await tocca('.mz-fp-mapp [data-modo="mini"]');
    await ctx.waitState(page, (s) => !s.mappaFp.aperta && s.mappaFp.modo === 'mini' && s.mappaFp.minimappa, 4000);
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => s.mappaFp.aperta, 4000);
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => !s.mappaFp.aperta, 4000);
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => s.mappaFp.aperta, 4000);
    await page.keyboard.press('Escape');
    await ctx.waitState(page, (s) => !s.mappaFp.aperta, 4000);
    assert(!(await st()).dungeon.paused, 'Esc ha aperto anche la Pausa');
  });

  await ctx.test('camminando la nebbia si apre (e resta aperta), la mappa grande mostra quello che hai visto', async () => {
    const prima = (await st()).mappaFp.viste;
    await hook('dungeonAutopilot', true, 8);
    await ctx.waitState(page, (s, v) => s.mappaFp.viste > v + 40, 60000, prima);
    await hook('dungeonAutopilot', false);
    await page.waitForTimeout(300);
    const dopo = (await st()).mappaFp;
    assert(dopo.viste <= dopo.pavimento, 'più celle viste dei pavimenti');
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => s.mappaFp.aperta, 4000);
    await ctx.shot(page, '4_esplorata');
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => !s.mappaFp.aperta, 4000);
    assert((await st()).mappaFp.viste >= dopo.viste, 'la nebbia si è richiusa');
    await hook('dungeonMappa', 'tutto'); await page.waitForTimeout(300);
    const tutto = (await st()).mappaFp;
    assert(tutto.viste === tutto.pavimento, `visto tutto ma ${tutto.viste} su ${tutto.pavimento}`);
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => s.mappaFp.aperta, 4000);
    await ctx.shot(page, '5_tutto');
    await page.keyboard.press('KeyM');
    await ctx.waitState(page, (s) => !s.mappaFp.aperta, 4000);
  });

  await ctx.test('la scelta «solo pulsante» resta dopo aver ricaricato', async () => {
    await hook('dungeonMappa', 'pulsante');
    await page.reload({ waitUntil: 'load' });
    await ctx.waitReady(page, 30000);
    await entra();
    const s = (await st()).mappaFp;
    assert(s.modo === 'pulsante' && s.pulsante && !s.minimappa, 'dopo il reload: ' + JSON.stringify(s));
    await hook('dungeonMappa', 'mini');
  });

  ctx.noErrors(p, 'mappa del dungeon (telefono)');
  await p.close();

  await ctx.test('da PC: la minimappa porta la «M», M apre e chiude la mappa grande', async () => {
    const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
    await ctx.waitReady(d.page, 30000);
    await d.page.evaluate(() => window.__game.test.enterDungeon('grotta'));
    await ctx.waitState(d.page, (s) => s.dungeon.active && s.dungeon.phase === 'play' && s.mappaFp, 60000);
    await d.page.waitForTimeout(500);
    const m = await d.page.evaluate(() => { const e = document.querySelector('.mz-fp-mini'), b = e.getBoundingClientRect(); return { w: b.width, h: b.height, tasto: e.querySelector('i')?.textContent }; });
    assert(m.w > 100 && m.w <= 140 && m.tasto === 'M', 'minimappa da PC: ' + JSON.stringify(m));
    await ctx.shot(d.page, '6_pc_mini');
    await d.page.keyboard.press('KeyM');
    await ctx.waitState(d.page, (s) => s.mappaFp.aperta && s.dungeon.pannello, 4000);
    await ctx.shot(d.page, '6_pc');
    await d.page.keyboard.press('KeyM');
    await ctx.waitState(d.page, (s) => !s.mappaFp.aperta && !s.dungeon.pannello, 4000);
    ctx.noErrors(d, 'mappa del dungeon (PC)');
  });
}
