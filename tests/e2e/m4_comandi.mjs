// Comandi (#698): controller e tasti rimappabili. Un controller finto (navigator.getGamepads) muove l'eroe in analogico, i suoi pulsanti
// arrivano come tasti del gioco, e un tasto cambiato nella schermata «Comandi e controller» (Impostazioni) fa quello che ha preso, mentre
// il vecchio non fa più niente. Le scelte restano dopo il ricaricamento. Screenshot a 390×844 e su desktop.
export const timeout = 240000;

export default async function (ctx) {
  const { assert } = ctx;
  const p = await ctx.open('?test=1&net=0');
  const page = p.page;
  await ctx.waitReady(page, 20000);
  const st = async () => (await ctx.getState(page)).comandi;
  /** I tasti che il gioco vede (in ordine), dopo la rimappa. */
  const registra = () => page.evaluate(() => { window.__k = []; for (const t of ['keydown', 'keyup']) addEventListener(t, (e) => window.__k.push(`${t === 'keydown' ? '+' : '-'}${e.code}`)); });
  const visti = () => page.evaluate(() => { const k = window.__k; window.__k = []; return k; });
  const tasto = (id, slot, code) => page.evaluate((a) => window.__game.test.comandi_tasto(a), { id, slot, code });
  const pulsante = (id, b) => page.evaluate((a) => window.__game.test.comandi_pad(a), { id, b });
  const padFinto = (axes, giu = []) => page.evaluate(([a, g]) => {
    window.__pad = { connected: true, id: 'Controller finto (STANDARD GAMEPAD)', axes: a, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: g.includes(i), value: g.includes(i) ? 1 : 0 })) };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event('gamepadconnected')); // come fa il browser alla prima pressione (dopo un ricaricamento serve di nuovo)
  }, [axes, giu]);
  await registra();

  await ctx.test('senza controller: niente collegato, i tasti di serie passano', async () => {
    ctx.assert((await st()).pad === null, 'pad già collegato');
    await page.keyboard.press('Space');
    const k = await visti();
    assert(k.includes('+Space') && k.includes('-Space'), `Space non arriva: ${k}`);
  });

  await ctx.test('il controller si collega e lo stick sinistro muove in analogico', async () => {
    await padFinto([0.9, 0, 0, 0]);
    await ctx.waitState(page, (s) => s.comandi && s.comandi.pad && s.comandi.mov.x > 0.5, 8000).catch(async (e) => { throw new Error(`${e.message.slice(0, 60)} · stato ${JSON.stringify(await st())} · pad ${await page.evaluate(() => JSON.stringify(navigator.getGamepads().map((g) => g && g.connected)))}`); });
    const k = (await visti()).join(' ');
    assert(k.includes('+KeyD'), `la destra non è arrivata come tasto: ${k}`);
    const s = await ctx.waitState(page, (g) => g.wp2_input && g.wp2_input.src === 'pad', 8000).then(() => ctx.getState(page));
    assert(s.wp2_input.mag > 0.5, `forza ${s.wp2_input.mag}`);
    await padFinto([0, 0, 0, 0]);
    await ctx.waitState(page, (g) => g.comandi.mov.x === 0, 8000);
    assert((await visti()).join(' ').includes('-KeyD'), 'KeyD non rilasciato');
  });

  await ctx.test('A del controller = Spazio, Start = Esc; un pulsante tolto non fa più niente', async () => {
    await padFinto([0, 0, 0, 0], [0]);
    await page.waitForFunction(() => window.__k.includes('+Space'), null, { timeout: 8000 });
    await padFinto([0, 0, 0, 0], []);
    await page.waitForFunction(() => window.__k.includes('-Space'), null, { timeout: 8000 });
    await visti();
    await padFinto([0, 0, 0, 0], [9]);
    await page.waitForFunction(() => window.__k.includes('+Escape'), null, { timeout: 8000 });
    await padFinto([0, 0, 0, 0], []);
    await pulsante('azione', 3); // A passa a Y: Y prende il posto della pozione, che resta senza
    assert((await st()).azione.pad === 3, 'A non è passata a Y');
    await visti();
    await padFinto([0, 0, 0, 0], [0]);
    await page.waitForTimeout(600);
    assert(!(await visti()).includes('+Space'), 'A ha ancora un tasto');
    await padFinto([0, 0, 0, 0], []); await page.waitForTimeout(300); await visti();
    await padFinto([0, 0, 0, 0], [3]);
    await page.waitForFunction(() => window.__k.includes('+Space'), null, { timeout: 8000 });
    await padFinto([0, 0, 0, 0], []);
    assert((await st()).pozione.pad === null, 'la pozione teneva ancora Y');
    await pulsante('azione', 0);
  });

  await ctx.test('tasto cambiato: Q fa da A, Spazio e il resto non più; E (serie di un altro slot) resta', async () => {
    await visti();
    await tasto('azione', 0, 'KeyQ');
    await page.keyboard.press('KeyQ');
    let k = await visti();
    assert(k.includes('+Space') && k.includes('-Space') && !k.includes('+KeyQ'), `Q non è diventato Spazio: ${k}`);
    await page.keyboard.press('Space');
    k = await visti();
    assert(!k.includes('+Space'), `Spazio fa ancora qualcosa: ${k}`);
    await page.keyboard.press('KeyE');
    assert((await visti()).includes('+KeyE'), 'E (secondo slot di A) non passa più');
    await tasto('azione', 0, 'Space'); // riportato
  });

  await ctx.test('un tasto, un’azione: darlo a un’altra lo toglie alla prima', async () => {
    const perso = await tasto('pozione', 0, 'KeyM'); // M era la mappa
    assert(perso === 'Mappa', `perso: ${perso}`);
    await page.keyboard.press('KeyM');
    const k = await visti();
    assert(k.includes('+KeyR') && !k.includes('+KeyM'), `M non fa la pozione: ${k}`);
  });

  await ctx.test('le scelte restano dopo il ricaricamento', async () => {
    const salvato = await page.evaluate(() => localStorage.getItem('marea:comandi:1'));
    assert(salvato && salvato.includes('KeyM'), `non salvato: ${salvato}`);
    await page.reload(); await ctx.waitReady(page, 20000); await registra();
    await page.keyboard.press('KeyM');
    assert((await visti()).includes('+KeyR'), 'dopo il ricaricamento M non fa più la pozione');
  });

  await ctx.test('schermata Comandi: tocchi uno slot, premi un tasto, cambia; Ripristina rimette tutto', async () => {
    await page.click('#mzSetBtn');
    await page.click('#mzSet [data-set="comandi"]');
    await ctx.shot(page, 'schermata');
    await page.click('#mzSet [data-cmd="foto:k0"]');
    await page.keyboard.press('KeyZ');
    const t = await page.textContent('#mzSet [data-cmd="foto:k0"]');
    assert(t === 'Z', `slot foto: «${t}»`);
    await page.click('#mzSet [data-cmd="foto:k0"]'); await page.keyboard.press('Escape'); // Esc annulla senza chiudere le Impostazioni
    assert(await page.evaluate(() => document.getElementById('mzSet').classList.contains('on')), 'Esc ha chiuso le Impostazioni');
    await page.click('#mzSet [data-cmd="foto:k0"]'); await page.keyboard.press('Backspace');
    assert((await page.textContent('#mzSet [data-cmd="foto:k0"]')) === '—', 'slot non svuotato');
    await padFinto([0, 0, 0, 0], []);
    await page.click('#mzSet [data-cmd="diario:p0"]');
    await padFinto([0, 0, 0, 0], [5]);
    await page.waitForFunction(() => document.querySelector('#mzSet [data-cmd="diario:p0"]').textContent === 'RB', null, { timeout: 8000 });
    await padFinto([0, 0, 0, 0], []);
    await ctx.shot(page, 'schermata_modificata');
    await page.click('#mzSet .mz-cmd-top .mz-set-cam:nth-child(2)'); // Ripristina
    assert((await page.textContent('#mzSet [data-cmd="foto:k0"]')) === 'O', 'foto non ripristinata');
    assert((await page.textContent('#mzSet [data-cmd="azione:p0"]')) === 'A', 'A del controller non ripristinata');
    await page.click('#mzSet .mz-x');
  });

  ctx.noErrors(p, 'comandi');
}
