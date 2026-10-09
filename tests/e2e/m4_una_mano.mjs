// «Una mano» (#143): sul telefono le Impostazioni hanno «Una mano» (SÌ/NO) e «Il joystick resta» 1/2/3/5 s; sul PC la voce non c'è.
// Acceso: niente joystick fisso; un dito vero (tocchi CDP) sul canvas fa nascere il joystick lì e l'eroe va dove spingi; al rilascio
// si ferma e il joystick resta fermo (più chiaro) per i secondi scelti, poi sparisce; un tocco sopra o appena fuori lo riprende col
// centro di prima, lontano ne nasce uno nuovo; un secondo dito (pizzico) lo lascia. Spento: torna il joystick fisso. Resta dopo il ricaricamento.
export const timeout = 180000;
export default async function (ctx) {
  const { assert } = ctx;
  const p = await ctx.open('?test=1&net=0');
  const page = p.page;
  await ctx.waitReady(page, 20000);
  const S = () => ctx.getState(page);
  const ticks = () => page.evaluate(() => window.__game.state().wp2_boat.ticks);
  const waitTicks = async (n) => { const t0 = await ticks(); await page.waitForFunction(([t0, n]) => window.__game.state().wp2_boat.ticks - t0 >= n, [t0, n], { timeout: 40000, polling: 40 }); };
  const spawn = async () => { await page.evaluate(() => { const s = window.__game.state().island.spawn; window.__game.test.teleport(s.x, s.z); }); await waitTicks(8); };
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const joyBox = () => page.evaluate(() => { const j = document.getElementById('joystick'), r = j.getBoundingClientRect(), cs = getComputedStyle(j); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, vis: cs.display !== 'none', op: Number(cs.opacity) }; });
  /** Un punto dove sotto il dito c'è solo il canvas, con margine: il browser aggancia il dito al bottone più vicino (SALTA della guida). */
  const libero = (x0, y0) => page.evaluate(([x0, y0]) => {
    for (let r = 0; r < 200; r += 10) for (let a = 0; a < 6.28; a += 0.5) {
      const x = Math.round(x0 + r * Math.cos(a)), y = Math.round(y0 + r * Math.sin(a));
      const ok = [[0, 0], [-36, 0], [36, 0], [0, -36], [0, 36], [-26, -26], [26, -26], [-26, 26], [26, 26], [-60, 0], [60, 0], [0, -60], [0, 60]].every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy)?.id === 'gl');
      if (ok) return [x, y];
    }
    return null;
  }, [x0, y0]);

  await ctx.test('telefono: «Una mano» nelle Impostazioni, con la durata 1/2/3/5 s', async () => {
    let st = await S();
    assert(st.impostazioni.unaMano === false && st.wp2_input.pad === 'fisso', `di serie spento: ${JSON.stringify(st.wp2_input)}`);
    await page.click('#mzSetBtn'); await page.waitForTimeout(200);
    assert(await page.isVisible('#mzSet [data-set="unaMano"]'), 'la voce «Una mano» non c\'è sul telefono');
    assert(!(await page.isVisible('#mzSet [data-pad]')), 'la durata si vede già con «Una mano» spento');
    await page.click('#mzSet [data-set="unaMano"]');
    const durate = await page.$$eval('#mzSet [data-pad]', (b) => b.map((x) => x.textContent));
    ctx.log('durate', durate.join(' · '));
    assert(durate.join('|') === '1 s|2 s|3 s|5 s', `durate ${durate}`);
    await page.click('#mzSet [data-pad="3"]');
    await page.$eval('#mzSet [data-set="unaMano"]', (b) => b.scrollIntoView({ block: 'center' }));
    await ctx.shot(page, 'pannello');
    st = await S();
    assert(st.impostazioni.unaMano === true && st.impostazioni.padSec === 3, `impostazioni ${JSON.stringify(st.impostazioni)}`);
    assert(st.wp2_input.unaMano === true && st.wp2_input.pad === 'via' && st.wp2_input.restaMs === 3000, `input ${JSON.stringify(st.wp2_input)}`);
    await page.keyboard.press('Escape');
    assert(!(await joyBox()).vis, 'il joystick fisso si vede ancora');
  });

  let P = null;
  await ctx.test('il dito sul canvas fa nascere il joystick lì; su = nord-ovest; al rilascio si ferma e il joystick resta', async () => {
    await spawn(); await page.evaluate(() => window.__game.test.setZoom(1));
    P = await libero(270, 560); assert(P, 'nessun punto libero sul canvas');
    await touch('touchStart', [P]); await waitTicks(3);
    let st = await S(), j = await joyBox();
    ctx.log('tocco', P.join(','), 'joystick', JSON.stringify(j), 'pad', st.wp2_input.pad, st.wp2_input.padAt.join(','));
    assert(st.wp2_input.pad === 'su' && j.vis && Math.hypot(j.x - P[0], j.y - P[1]) < 2, `il joystick non è nato sotto il dito: ${JSON.stringify(j)}`);
    assert(st.wp2_input.src === 'none', 'appena toccato si muove già');
    const a0 = st.avatar;
    await touch('touchMove', [[P[0], P[1] - 50]]); await waitTicks(30);
    st = await S();
    ctx.log('su', JSON.stringify(st.wp2_input), 'Δ', (st.avatar.x - a0.x).toFixed(2), (st.avatar.z - a0.z).toFixed(2), st.avatar.anim);
    assert(st.wp2_input.src === 'stick' && st.wp2_input.mag > 0.95 && st.avatar.anim === 'run', 'stick a fondo non è corsa');
    assert(st.avatar.x - a0.x < -0.5 && st.avatar.z - a0.z < -0.5, 'su non porta a nord-ovest');
    await ctx.shot(page, 'joystick_dito');
    await touch('touchEnd', []); await waitTicks(12);
    st = await S(); j = await joyBox();
    assert(st.avatar.anim === 'idle' && st.wp2_input.src === 'none', 'il rilascio non ferma');
    assert(st.wp2_input.pad === 'riposo' && j.vis && j.op < 0.8, `il joystick non è rimasto (più chiaro): ${st.wp2_input.pad} ${JSON.stringify(j)}`);
    await ctx.shot(page, 'joystick_resta');
  });

  await ctx.test('un tocco sopra il joystick fermo lo riprende col centro di prima; lontano ne nasce uno nuovo', async () => {
    let st = await S(); assert(st.wp2_input.pad === 'riposo', 'il joystick è già sparito');
    const c = st.wp2_input.padAt;
    await touch('touchStart', [[c[0] + 40, c[1]]]); await waitTicks(20);
    st = await S();
    ctx.log('ripreso', JSON.stringify(st.wp2_input), 'v', st.avatar.vx.toFixed(2), st.avatar.vz.toFixed(2));
    assert(st.wp2_input.padAt[0] === c[0] && st.wp2_input.padAt[1] === c[1], `il centro si è spostato: ${st.wp2_input.padAt} invece di ${c}`);
    assert(st.wp2_input.stick[0] > 0.85 && st.avatar.vx > 1 && st.avatar.vz < -1, 'ripreso a destra: deve andare a +x −z subito');
    await touch('touchEnd', []); await waitTicks(5);
    const Q = await libero(c[0], c[1] - 260); assert(Q && Math.hypot(Q[0] - c[0], Q[1] - c[1]) > 150, 'nessun punto libero lontano');
    await touch('touchStart', [Q]); await waitTicks(3);
    st = await S();
    assert(st.wp2_input.padAt[0] === Q[0] && st.wp2_input.padAt[1] === Q[1] && st.wp2_input.src === 'none', `lontano non è nato lì: ${st.wp2_input.padAt}`);
    await touch('touchEnd', []); await waitTicks(3);
  });

  await ctx.test('dopo i secondi scelti il joystick sparisce (1 s e 3 s)', async () => {
    const prova = async (sec) => {
      await page.evaluate((sec) => window.__game.test.impostazioni({ padSec: sec }), sec);
      await touch('touchStart', [P]); await touch('touchMove', [[P[0] + 10, P[1]]]); await waitTicks(3);
      await touch('touchEnd', []); const t0 = Date.now();
      await page.waitForFunction(() => window.__game.state().wp2_input.pad === 'via', null, { timeout: 15000, polling: 50 });
      const ms = Date.now() - t0, vis = (await joyBox()).vis;
      ctx.log(`${sec} s → sparito dopo ${ms} ms`);
      assert(ms >= sec * 1000 - 150, `${sec} s: sparito troppo presto (${ms} ms)`);
      assert(!vis, `${sec} s: «via» ma ancora visibile`);
    };
    await prova(1); await prova(3);
  });

  await ctx.test('pizzico: il secondo dito sul canvas lascia il joystick, l\'eroe non cammina', async () => {
    await spawn();
    await touch('touchStart', [P]); await touch('touchMove', [[P[0], P[1] - 30]]); await waitTicks(3);
    const Q = [P[0] - 120, P[1] - 200];
    await touch('touchStart', [[P[0], P[1] - 30], Q]); await waitTicks(2);
    await touch('touchMove', [[P[0], P[1] - 60], [Q[0] - 30, Q[1] - 30]]); await waitTicks(15);
    const st = await S();
    ctx.log('pizzico', JSON.stringify(st.wp2_input), st.avatar.anim);
    await touch('touchEnd', []); await waitTicks(3);
    assert(st.wp2_input.pad === 'via' && st.wp2_input.src === 'none' && st.avatar.anim === 'idle', `col pizzico cammina: ${JSON.stringify(st.wp2_input)}`);
  });

  await ctx.test('resta dopo il ricaricamento; spento torna il joystick fisso', async () => {
    await page.reload(); await ctx.waitReady(page, 20000);
    let st = await S();
    assert(st.impostazioni.unaMano === true && st.impostazioni.padSec === 3 && st.wp2_input.pad === 'via', `dopo reload: ${JSON.stringify(st.impostazioni)}`);
    await page.click('#mzSetBtn'); await page.waitForTimeout(150); await page.click('#mzSet [data-set="unaMano"]'); await page.keyboard.press('Escape');
    st = await S(); const j = await joyBox();
    assert(st.wp2_input.pad === 'fisso' && j.vis && j.x < 120 && j.y > 650, `joystick fisso non tornato: ${JSON.stringify(j)}`);
    const R = await libero(270, 560);
    await touch('touchStart', [R]); await touch('touchMove', [[R[0], R[1] - 50]]); await waitTicks(10);
    st = await S(); await touch('touchEnd', []);
    assert(st.wp2_input.src === 'none', 'spento: il canvas muove ancora l\'eroe');
  });

  await ctx.test('PC: la voce «Una mano» non c\'è', async () => {
    const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
    await ctx.waitReady(d.page, 20000);
    await d.page.click('#mzSetBtn'); await d.page.waitForTimeout(150);
    assert(await d.page.isVisible('#mzSet [data-set="ciclo"]'), 'pannello non aperto');
    assert(!(await d.page.isVisible('#mzSet [data-set="unaMano"]')), '«Una mano» sul PC');
    ctx.noErrors(d, 'PC');
  });
  await ctx.test('nessun errore', async () => { ctx.noErrors(p, 'una mano'); });
}
