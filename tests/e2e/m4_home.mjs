// Schermata iniziale (#615, avvio/home.ts): coi test compare solo con ?home=1. Si vede subito (markup in index.html), sta sopra il mondo che
// carica dietro (fermo), IMPOSTAZIONI apre il pannello sopra di lei, CREDITI il suo chunk, GIOCA entra col velo; toccato GIOCA prima che il
// mondo sia pronto, «Carico… N%» ed entra da sola. Senza ?home=1 non c'è. Screenshot: telefono 390×844 e PC 1920×1080, crediti.
export const timeout = 240000;

export default async function (ctx) {
  const { assert } = ctx;
  const sopra = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!x && (x === e || e.contains(x)); }, sel);
  const homeAperta = (page) => page.evaluate(() => !!document.getElementById('mzHome'));

  await ctx.test('coi test senza ?home=1 la home non c\'è', async () => {
    const p = await ctx.open('?test=1&net=0&nosound=1');
    assert.ok(!(await homeAperta(p.page)), 'la home è rimasta');
    await ctx.waitReady(p.page, 60000);
    await p.close();
  });

  const p = await ctx.open('?test=1&net=0&nosound=1&home=1');
  await ctx.test('si vede subito, sopra il gioco, col disegno', async () => {
    assert.ok(await homeAperta(p.page), 'home assente');
    assert.ok(await sopra(p.page, '#mzHome [data-home="gioca"]'), 'GIOCA coperto');
    const img = await p.page.evaluate(() => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r(null); i.src = '/assets/home/sfondo.webp'; }));
    assert.equal(JSON.stringify(img), '[571,1056]', 'misure dello sfondo');
  });
  await ctx.test('il mondo carica dietro e sta fermo', async () => {
    await ctx.waitReady(p.page, 60000);
    const st = await ctx.getState(p.page);
    assert.ok(st.home?.aperta && st.home.pronto, `home ${JSON.stringify(st.home)}`);
    assert.ok(await homeAperta(p.page), 'la home se n\'è andata da sola');
    await p.page.evaluate(() => document.fonts.ready);
    await p.page.waitForTimeout(300);
    await ctx.shot(p.page, 'iphone');
  });
  await ctx.test('IMPOSTAZIONI apre il pannello sopra la home', async () => {
    await p.page.waitForFunction(() => !document.querySelector('#mzHome [data-home="impostazioni"]')?.disabled, null, { timeout: 5000 });
    await p.page.click('#mzHome [data-home="impostazioni"]');
    await p.page.waitForFunction(() => document.getElementById('mzSet')?.classList.contains('on'), null, { timeout: 5000 });
    assert.ok(await sopra(p.page, '#mzSet .mz-head'), 'il pannello resta sotto la home');
    await ctx.shot(p.page, 'iphone_impostazioni');
    await p.page.keyboard.press('Escape');
    await p.page.waitForFunction(() => !document.getElementById('mzSet')?.classList.contains('on'), null, { timeout: 5000 });
    assert.ok(await homeAperta(p.page), 'Esc ha chiuso anche la home');
  });
  await ctx.test('CREDITI: autori, caratteri, asset', async () => {
    await p.page.click('#mzHome [data-home="crediti"]');
    await p.page.waitForFunction(() => document.getElementById('mzCrediti')?.classList.contains('on'), null, { timeout: 10000 });
    const testo = await p.page.evaluate(() => document.getElementById('mzCrediti').innerText);
    for (const t of ['Riccardo', 'Jack', 'Alegreya', 'Open Font License', 'schermata iniziale']) assert.ok(testo.includes(t), `manca «${t}» nei crediti`);
    assert.ok(await sopra(p.page, '#mzCrediti .mk-titolo'), 'crediti coperti');
    await ctx.shot(p.page, 'iphone_crediti');
    await p.page.click('#mzCrediti [data-act="chiudi"]');
    assert.ok(!(await p.page.evaluate(() => document.getElementById('mzCrediti').classList.contains('on'))), 'crediti ancora aperti');
  });
  await ctx.test('GIOCA entra nel mondo', async () => {
    await p.page.click('#mzHome [data-home="gioca"]');
    await p.page.waitForFunction(() => !document.getElementById('mzHome'), null, { timeout: 5000 });
    await ctx.waitState(p.page, (s) => s.home.aperta === false && s.velo.passaggi >= 1, 5000);
    ctx.noErrors(p, 'home');
  });
  await p.close();

  await ctx.test('GIOCA prima del mondo: «Carico… N%», poi entra da sola', async () => {
    const q = await ctx.open('?test=1&net=0&nosound=1&home=1');
    // il primo tocco arriva prima che il mondo sia pronto (sul runner lento lo è quasi sempre; se no la prova non dice niente)
    const presto = await q.page.evaluate(() => !window.__game?.ready);
    await q.page.click('#mzHome [data-home="gioca"]');
    if (presto) {
      const vista = await q.page.evaluate(() => ({ carica: document.getElementById('mzHome')?.classList.contains('carica') ?? false, scritta: document.querySelector('#mzHome .carico span')?.textContent ?? '' }));
      assert.ok(vista.carica || !(await homeAperta(q.page)), 'niente barra');
      if (vista.carica) assert.ok(/^Carico… \d+%$/.test(vista.scritta), vista.scritta);
    } else ctx.log('mondo già pronto al primo tocco: barra non provata');
    await ctx.waitReady(q.page, 60000);
    await q.page.waitForFunction(() => !document.getElementById('mzHome'), null, { timeout: 10000 });
    ctx.noErrors(q, 'home presto');
    await q.close();
  });

  await ctx.test('PC 1920×1080: disegno al centro, bordi stirati ai lati', async () => {
    const d = await ctx.open('?test=1&net=0&nosound=1&home=1', { viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false } });
    await ctx.waitReady(d.page, 60000);
    await d.page.evaluate(() => document.fonts.ready);
    const r = await d.page.evaluate(() => { const q = document.querySelector('#mzHome .q').getBoundingClientRect(), l = document.querySelector('#mzHome .lato.sx').getBoundingClientRect(); return { qx: q.x, qw: q.width, qh: q.height, lw: l.width }; });
    assert.ok(Math.abs(r.qh - 1080) < 1 && Math.abs(r.qw - 1080 * 571 / 1056) < 2, `disegno ${JSON.stringify(r)}`);
    assert.ok(r.lw >= r.qx - 1, `lato ${JSON.stringify(r)}`);
    await d.page.waitForTimeout(300);
    await ctx.shot(d.page, 'pc');
    await d.page.keyboard.press('Enter'); // Invio = GIOCA
    await d.page.waitForFunction(() => !document.getElementById('mzHome'), null, { timeout: 5000 });
    ctx.noErrors(d, 'home pc');
    await d.close();
  });
}
