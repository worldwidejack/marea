// Minimappa (#62, rifatta con #360): il cerchio c'è (telefono in alto a destra, PC in basso a destra), col nord sempre in alto (girando la
// camera non gira: gira solo la freccia, con te); zoom a scatti con + e −, rotella e bottoni; M e il tocco aprono la mappa intera, Esc e ×
// la chiudono; nella mappa zoom a scatti (+ e −, bottoni, rotella, pizzico) e trascinando si sposta. Porto scoperto da subito, le altre isole
// non si vedono proprio (solo mare) finché non ci passi vicino; le isole a tema chiuse restano invisibili anche scoperte.
// Segnalino del navigatore (#144): un tocco sulla mappa lo mette (sull'icona di una meta si aggancia a lei), METE e freccia ti ci portano,
// resta dopo il ricaricamento, si toglie con × in METE, con TOGLI o da solo quando ci arrivi.
// Foto della mappa al telefono e al PC (#360): foto_* in tests/out/shots.
export const timeout = 300000;
export default async function (ctx) {
  const { assert } = ctx;
  const hook = (page, n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
  const mappa = async (page) => (await ctx.getState(page)).mappa;
  const pronta = async (page) => { await ctx.waitReady(page, 20000); await page.waitForFunction(() => !!document.getElementById('mzMini') && !!window.__game.state().mappa, null, { timeout: 40000 }); };
  /** Impronta dei pixel della minimappa (per vedere se il disegno cambia). */
  const impronta = (page) => page.evaluate(() => { const c = document.querySelector('#mzMini canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16)), 16777619); return `${c.width}:${h >>> 0}`; });
  const tela = (page) => page.evaluate(() => { const b = document.querySelector('#mzMappa canvas').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const pie = (page) => page.evaluate(() => ({ testo: document.querySelector('#mzMappa .pie').textContent, togli: getComputedStyle(document.querySelector('#mzMappa .pie [data-act=togli]')).display !== 'none' }));
  /** Pizzico con due dita vere (CDP): da `d0` a `d1` px di distanza attorno a (cx, cy). */
  const pizzico = async (page, cx, cy, d0, d1) => {
    const cdp = await page.context().newCDPSession(page), dita = (d) => [{ x: cx - d / 2, y: cy, id: 0 }, { x: cx + d / 2, y: cy, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dita(d0) });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dita(d0 + ((d1 - d0) * i) / 8) }); await page.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  };
  const trascina = async (page, x0, y0, dx, dy) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 0 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 8, y: y0 + (dy * i) / 8, id: 0 }] }); await page.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  };

  const p = await ctx.open('?test=1&net=0');
  await pronta(p.page);
  await ctx.test('il cerchio c’è; Porto scoperto, le altre isole non si vedono', async () => {
    await p.page.waitForTimeout(600);
    const st = await mappa(p.page);
    assert(st && st.mini, `minimappa non visibile: ${JSON.stringify(st)}`);
    assert(st.viste.some((v) => v.startsWith('porto')), `Porto non scoperto: ${JSON.stringify(st.viste)}`);
    assert(st.coperte.length > 0 && st.coperte.every((id) => st.nascoste.includes(id)), `isole da scoprire: ${JSON.stringify(st)}`);
    const laguna = st.coperte.find((id) => id.startsWith('laguna')), t = await hook(p.page, 'mappaTerra', laguna);
    assert(t && t.base === 0, `la Laguna non scoperta si vede: ${JSON.stringify(t)}`);
    const box = await p.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth }; });
    assert(box.w >= 80 && box.x + box.w <= box.vw && box.y < 200, `posto del cerchio: ${JSON.stringify(box)}`);
    await ctx.shot(p.page, 'iphone_mini');
  });
  await ctx.test('nord fisso: girando la camera la minimappa non gira (gira solo la freccia, con te)', async () => {
    const yaw0 = await hook(p.page, 'camYaw');
    const prima = await impronta(p.page);
    await hook(p.page, 'camYaw', yaw0 + Math.PI / 2); await p.page.waitForTimeout(700);
    const dopo = await impronta(p.page), st = await ctx.getState(p.page);
    await hook(p.page, 'camYaw', yaw0); await p.page.waitForTimeout(300);
    assert(Math.abs((await hook(p.page, 'camYaw')) - yaw0) < 1e-6, 'camera non rimessa a posto');
    assert(prima === dopo, `la minimappa è girata con la camera (${prima} → ${dopo})`);
    assert(st.mappa.nord === 0 && Math.abs(st.mappa.freccia - st.avatar.yaw) < 1e-6, `freccia ${st.mappa.freccia}, avatar ${st.avatar.yaw}`);
    const n = await p.page.evaluate(() => { const c = document.getElementById('mzMini').getBoundingClientRect(), r = document.querySelector('#mzMini .n').getBoundingClientRect(); return { dx: r.x + r.width / 2 - (c.x + c.width / 2), dy: r.y + r.height / 2 - c.y }; });
    assert(Math.abs(n.dx) < 2 && Math.abs(n.dy) < 4, `la N non sta in alto al centro: ${JSON.stringify(n)}`);
  });
  await ctx.test('zoom della minimappa: + e − da tastiera, rotella, bottoni; ai capi i bottoni si spengono', async () => {
    const z0 = (await mappa(p.page)).zoomMini;
    assert(z0.n >= 3 && z0.raggio === 100, `scatti della minimappa: ${JSON.stringify(z0)}`);
    for (let i = 0; i < z0.n; i++) { await p.page.keyboard.press('+'); await p.page.waitForTimeout(60); }
    const vicino = (await mappa(p.page)).zoomMini;
    assert(vicino.i === 0 && vicino.raggio < 100, `+ non avvicina: ${JSON.stringify(vicino)}`);
    await p.page.waitForTimeout(300);
    assert(await p.page.locator('#mzMiniZoom [data-zoom="+"]').isDisabled(), 'al più vicino il + resta acceso');
    await ctx.shot(p.page, 'iphone_mini_vicino');
    await p.page.keyboard.press('-'); await p.page.waitForTimeout(60);
    assert((await mappa(p.page)).zoomMini.i === 1, '− non allontana');
    await p.page.locator('#mzMiniZoom [data-zoom="-"]').tap(); await p.page.waitForTimeout(100);
    const box = await p.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.page.mouse.move(box.x, box.y);
    for (let i = 0; i < z0.n; i++) { await p.page.mouse.wheel(0, 120); await p.page.waitForTimeout(250); }
    const lontano = (await mappa(p.page)).zoomMini;
    assert(lontano.i === z0.n - 1 && lontano.raggio > 100, `rotella e − non allontanano: ${JSON.stringify(lontano)}`);
    await p.page.waitForTimeout(300);
    await ctx.shot(p.page, 'iphone_mini_lontano');
    await p.page.mouse.wheel(0, -120); await p.page.waitForTimeout(250);
    assert((await mappa(p.page)).zoomMini.i === z0.n - 2, 'la rotella in su non avvicina');
    await p.page.locator('#mzMiniZoom [data-zoom="+"]').tap(); await p.page.waitForTimeout(100);
    assert((await mappa(p.page)).zoomMini.i === z0.n - 3, 'il bottone + non avvicina');
    for (let i = 0; i < 6 && (await mappa(p.page)).zoomMini.raggio !== 100; i++) { await p.page.keyboard.press((await mappa(p.page)).zoomMini.raggio < 100 ? '-' : '+'); await p.page.waitForTimeout(60); }
    assert((await mappa(p.page)).zoomMini.raggio === 100, 'zoom di serie non ritrovato');
    assert(!(await mappa(p.page)).open, 'lo zoom della minimappa ha aperto la mappa');
  });
  await ctx.test('M apre la mappa intera, Esc la chiude', async () => {
    await p.page.keyboard.press('KeyM'); await p.page.waitForTimeout(300);
    const st = await mappa(p.page);
    assert(st.open, 'M non ha aperto la mappa');
    assert(st.zoomMappa.i === 1 && st.zoomMappa.x > 2, `al telefono la mappa si apre allo scatto di mezzo: ${JSON.stringify(st.zoomMappa)}`);
    await ctx.shot(p.page, 'iphone_mappa');
    await p.page.keyboard.press('Escape'); await p.page.waitForTimeout(200);
    assert(!(await mappa(p.page)).open, 'Esc non ha chiuso la mappa');
  });
  await ctx.test('il tocco sul cerchio apre, × chiude', async () => {
    await p.page.click('#mzMini'); await p.page.waitForTimeout(300);
    assert((await mappa(p.page)).open, 'il tocco non ha aperto la mappa');
    await p.page.click('#mzMappa [data-act=chiudi]'); await p.page.waitForTimeout(200);
    assert(!(await mappa(p.page)).open, '× non ha chiuso la mappa');
  });
  await ctx.test('mappa grande: zoom a scatti con + e −, bottoni e pizzico; trascinando si sposta e non mette il segnalino', async () => {
    await hook(p.page, 'mappa', 'apri'); await p.page.waitForTimeout(300);
    const z0 = (await mappa(p.page)).zoomMappa;
    assert(z0.n >= 3, `scatti della mappa: ${JSON.stringify(z0)}`);
    await p.page.keyboard.press('+'); await p.page.waitForTimeout(150);
    assert((await mappa(p.page)).zoomMappa.i === z0.i + 1, '+ non avvicina la mappa');
    assert(await p.page.locator('#mzMappa .zoom [data-zoom="+"]').isDisabled() === (z0.i + 1 === z0.n - 1), 'bottone + acceso o spento a torto');
    await p.page.locator('#mzMappa .zoom [data-zoom="-"]').tap(); await p.page.waitForTimeout(150);
    await p.page.locator('#mzMappa .zoom [data-zoom="-"]').tap(); await p.page.waitForTimeout(150);
    assert((await mappa(p.page)).zoomMappa.i === z0.i - 1, 'il bottone − non allontana');
    const r = await tela(p.page);
    await pizzico(p.page, r.x + r.w / 2, r.y + r.h / 2, 60, 200); await p.page.waitForTimeout(300);
    const zp = (await mappa(p.page)).zoomMappa;
    assert(zp.i > z0.i - 1, `il pizzico non avvicina: ${JSON.stringify(zp)}`);
    await pizzico(p.page, r.x + r.w / 2, r.y + r.h / 2, 260, 60); await p.page.waitForTimeout(300);
    assert((await mappa(p.page)).zoomMappa.i < zp.i, 'il pizzico al contrario non allontana');
    while ((await mappa(p.page)).zoomMappa.i < z0.n - 1) { await p.page.keyboard.press('+'); await p.page.waitForTimeout(100); }
    const c0 = (await mappa(p.page)).zoomMappa.centro;
    await trascina(p.page, r.x + r.w / 2, r.y + r.h / 2, -120, 80); await p.page.waitForTimeout(300);
    const s = await ctx.getState(p.page), c1 = s.mappa.zoomMappa.centro;
    assert(c1.x > c0.x + 10 && c1.z < c0.z - 10, `il trascinamento non sposta la mappa: ${JSON.stringify({ c0, c1 })}`);
    assert(s.segno === null, `trascinare ha messo il segnalino: ${JSON.stringify(s.segno)}`);
    await ctx.shot(p.page, 'iphone_mappa_vicino');
    while ((await mappa(p.page)).zoomMappa.i > z0.i) { await p.page.keyboard.press('-'); await p.page.waitForTimeout(100); }
    await hook(p.page, 'mappa', 'chiudi');
  });
  await ctx.test('isole chiuse invisibili (niente nebbia né lucchetto, solo mare); scoperte e aperte compaiono; la scelta resta dopo il ricaricamento', async () => {
    await hook(p.page, 'mappaScopri');
    const st = await mappa(p.page);
    assert(st.coperte.length === 0, 'isole ancora da scoprire');
    assert(st.chiuse.length === 5 && st.nascoste.length === 5, `isole a tema chiuse: ${JSON.stringify(st.chiuse)}`);
    await hook(p.page, 'mappa', 'apri'); await p.page.waitForTimeout(200);
    while ((await mappa(p.page)).zoomMappa.i > 0) { await p.page.keyboard.press('-'); await p.page.waitForTimeout(100); }
    for (const id of st.chiuse) {
      const t = await hook(p.page, 'mappaTerra', id);
      assert(t.base === 0 && t.grande === 0, `${id} chiusa ma si vede: ${JSON.stringify(t)}`);
    }
    const aperta = st.viste.find((id) => id.startsWith('tema') && !st.chiuse.includes(id)), ta = await hook(p.page, 'mappaTerra', aperta);
    assert(ta.base > 50 && ta.grande > 50, `${aperta} aperta e scoperta ma non si vede: ${JSON.stringify(ta)}`);
    assert((await mappa(p.page)).icone.includes('porto'), 'l’icona del Porto non c’è');
    await ctx.shot(p.page, 'iphone_mappa_scoperta');
    await hook(p.page, 'temiProva', 'tutte');
    await ctx.waitState(p.page, (s) => s.mappa.chiuse.length === 0, 4000);
    await p.page.waitForTimeout(700); // la base si ridisegna al giro dopo (½ s)
    for (const id of st.chiuse) { const t = await hook(p.page, 'mappaTerra', id); assert(t.base > 50 && t.grande > 50, `${id} aperta ma non si vede: ${JSON.stringify(t)}`); }
    await ctx.shot(p.page, 'iphone_mappa_aperte');
    await hook(p.page, 'temiProva', null); await hook(p.page, 'mappa', 'chiudi');
    await p.page.reload(); await pronta(p.page); await p.page.waitForTimeout(400);
    assert((await mappa(p.page)).coperte.length === 0, 'le scoperte non sono rimaste');
    ctx.noErrors(p, 'minimappa');
  });
  // Segnalino del navigatore (#144)
  await ctx.test('segnalino: un tocco sulla mappa lo mette, METE e la freccia sullo schermo ti ci portano', async () => {
    await hook(p.page, 'mappa', 'apri'); await p.page.waitForTimeout(300);
    assert((await ctx.getState(p.page)).segno === null, 'segnalino già messo all\'inizio');
    const pie0 = await pie(p.page);
    assert(/navigatore/.test(pie0.testo) && !pie0.togli, `riga in fondo senza segnalino: ${JSON.stringify(pie0)}`);
    while ((await mappa(p.page)).zoomMappa.i > 0) { await p.page.keyboard.press('-'); await p.page.waitForTimeout(100); }
    const at = await hook(p.page, 'mappaSchermo', 40, 400); // mare aperto a ovest, niente mete
    await p.page.touchscreen.tap(at.x, at.y); await p.page.waitForTimeout(300);
    const s = await ctx.getState(p.page);
    assert(s.segno && !s.segno.su && Math.hypot(s.segno.x - 40, s.segno.z - 400) < 8, `segnalino libero non messo: ${JSON.stringify(s.segno)}`);
    assert(s.mappa.open, 'il tocco ha chiuso la mappa');
    assert(s.compass.navi === 'segno' && s.compass.shown.includes('segno'), `bussola: ${JSON.stringify(s.compass)}`);
    const pie1 = await pie(p.page);
    assert(/Segnalino · \d+ m/.test(pie1.testo) && pie1.togli, `riga in fondo col segnalino: ${JSON.stringify(pie1)}`);
    await ctx.shot(p.page, 'iphone_mappa_segno');
    await p.page.keyboard.press('Escape');
    await ctx.waitState(p.page, (s) => !s.mappa.open && s.compass.pointer !== 'off', 4000);
    await p.page.waitForTimeout(200);
    await ctx.shot(p.page, 'iphone_segno');
  });
  await ctx.test('segnalino: resta dopo il ricaricamento; sull\'icona di una meta (anche con lo zoom) si aggancia a lei; × in METE lo toglie', async () => {
    const prima = (await ctx.getState(p.page)).segno;
    await p.page.reload(); await pronta(p.page); await p.page.waitForTimeout(400);
    const dopo = (await ctx.getState(p.page)).segno;
    assert(dopo && Math.abs(dopo.x - prima.x) < 0.01 && Math.abs(dopo.z - prima.z) < 0.01, `segnalino non rimasto: ${JSON.stringify({ prima, dopo })}`);
    const reg = (await ctx.getState(p.page)).minigiochi.spots.find((x) => x.id === 'regata');
    await hook(p.page, 'mappa', 'apri'); await p.page.waitForTimeout(300);
    await p.page.keyboard.press('+'); await p.page.waitForTimeout(200); // uno scatto più vicino: se la Regata esce dalla vista la si porta al centro trascinando
    let at = await hook(p.page, 'mappaSchermo', reg.x, reg.z);
    const r = await tela(p.page);
    if (at.x < r.x + 20 || at.x > r.x + r.w - 20 || at.y < r.y + 20 || at.y > r.y + r.h - 20) { await trascina(p.page, r.x + r.w / 2, r.y + r.h / 2, r.x + r.w / 2 - at.x, r.y + r.h / 2 - at.y); await p.page.waitForTimeout(300); at = await hook(p.page, 'mappaSchermo', reg.x, reg.z); }
    assert((await mappa(p.page)).icone.includes('regata'), `icona della Regata non disegnata: ${JSON.stringify((await mappa(p.page)).icone)}`);
    await p.page.touchscreen.tap(at.x, at.y); await p.page.waitForTimeout(300);
    const s = await ctx.getState(p.page);
    assert(s.segno?.su === 'regata' && s.segno.x === reg.x && s.segno.z === reg.z, `non agganciato alla Regata: ${JSON.stringify(s.segno)}`);
    assert(/^Regata · \d+ m/.test((await pie(p.page)).testo), 'riga in fondo: ' + (await pie(p.page)).testo);
    await ctx.shot(p.page, 'iphone_mappa_segno_regata');
    await p.page.keyboard.press('Escape'); await p.page.waitForTimeout(200);
    if (!(await ctx.getState(p.page)).compass.open) await p.page.locator('#mzMete').click();
    await ctx.waitState(p.page, (s) => s.compass.open, 3000);
    await p.page.locator('#compass [data-act="nessuna"]').click(); // NESSUNA spegne le altre mete, non il navigatore
    await ctx.waitState(p.page, (s) => s.compass.on.length === 1 && s.compass.on[0] === 'segno', 3000);
    await p.page.waitForTimeout(200);
    await ctx.shot(p.page, 'iphone_mete_segno');
    await p.page.locator('#compass .mz-mete-row.navi').click();
    await ctx.waitState(p.page, (s) => s.segno === null && s.compass.navi === null && !s.compass.shown.includes('segno'), 3000);
  });
  await ctx.test('segnalino: quando ci arrivi sparisce da solo', async () => {
    const reg = (await ctx.getState(p.page)).minigiochi.spots.find((x) => x.id === 'regata');
    await p.page.evaluate(([x, z]) => window.__game.test.segno(x, z), [reg.x, reg.z]);
    await p.page.waitForTimeout(300); // lontano: il segnalino si «arma»
    assert((await ctx.getState(p.page)).segno, 'segnalino non messo dal test');
    await p.page.evaluate(() => window.__game.test.spotVai('regata'));
    await ctx.waitState(p.page, (s) => s.segno === null, 4000);
    ctx.noErrors(p, 'segnalino');
  });
  // Foto della mappa scelta da Jack (#360): stessa posa (Porto, isole scoperte, le 5 a tema chiuse), minimappa, mappa di serie, mappa intera e Porto da vicino
  const foto = async (P, dove) => {
    await hook(P.page, 'goto', 'porto'); await hook(P.page, 'mappaScopri');
    await P.page.waitForTimeout(3000); // passano gli avvisi dei test di prima («Sei arrivato»)
    await ctx.shot(P.page, `foto_${dove}_mini`);
    await hook(P.page, 'mappa', 'apri'); await P.page.waitForTimeout(300);
    const z = (await mappa(P.page)).zoomMappa, serie = dove === 'iphone' ? Math.round((z.n - 1) / 2) : 0; // come si apre la prima volta
    while ((await mappa(P.page)).zoomMappa.i !== serie) { await P.page.keyboard.press((await mappa(P.page)).zoomMappa.i < serie ? '+' : '-'); await P.page.waitForTimeout(100); }
    await hook(P.page, 'mappa', 'chiudi'); await hook(P.page, 'mappa', 'apri'); await P.page.waitForTimeout(300); // riaperta: centrata su di te
    await ctx.shot(P.page, `foto_${dove}_mappa`);
    while ((await mappa(P.page)).zoomMappa.i > 0) { await P.page.keyboard.press('-'); await P.page.waitForTimeout(100); }
    await ctx.shot(P.page, `foto_${dove}_mappa_tutta`);
    await hook(P.page, 'mappa', 'chiudi'); await hook(P.page, 'mappa', 'apri'); // si riapre centrata su di te
    while ((await mappa(P.page)).zoomMappa.i < z.n - 1) { await P.page.keyboard.press('+'); await P.page.waitForTimeout(100); }
    await P.page.waitForTimeout(200);
    await ctx.shot(P.page, `foto_${dove}_mappa_porto`);
    while ((await mappa(P.page)).zoomMappa.i > 0) { await P.page.keyboard.press('-'); await P.page.waitForTimeout(100); }
    await hook(P.page, 'mappa', 'chiudi');
  };
  await ctx.test('foto della mappa al telefono', async () => { await foto(p, 'iphone'); ctx.noErrors(p, 'foto telefono'); });

  const d = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await pronta(d.page);
  await ctx.test('PC: cerchio in basso a destra, mappa grande col mouse (clic = segnalino, rotella = zoom sul punto, trascinare = spostare)', async () => {
    await d.page.waitForTimeout(600);
    await ctx.shot(d.page, 'desktop_mini');
    const box = await d.page.evaluate(() => { const r = document.getElementById('mzMini').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, vw: innerWidth, vh: innerHeight }; });
    assert(box.x > box.vw / 2 && box.y > box.vh / 2, `posto del cerchio: ${JSON.stringify(box)}`);
    await d.page.keyboard.press('KeyM'); await d.page.waitForTimeout(300);
    assert((await mappa(d.page)).zoomMappa.i === 0 && (await mappa(d.page)).zoomMappa.x === 1, 'al PC la mappa si apre intera');
    const at = await hook(d.page, 'mappaSchermo', 40, 400);
    await d.page.mouse.click(at.x, at.y); await d.page.waitForTimeout(300); // col mouse come col dito
    assert((await ctx.getState(d.page)).segno, 'il clic non ha messo il segnalino');
    await ctx.shot(d.page, 'desktop_mappa');
    await d.page.locator('#mzMappa .pie [data-act=togli]').click(); await d.page.waitForTimeout(200);
    assert((await ctx.getState(d.page)).segno === null, 'TOGLI non ha tolto il segnalino');
    const sp = await hook(d.page, 'mappaSchermo', 360, 150); // mare a nord, lontano dai bordi della vista: lo zoom sul punto non lo sposta
    await d.page.mouse.move(sp.x, sp.y); await d.page.mouse.wheel(0, -120); await d.page.waitForTimeout(300);
    const z1 = (await mappa(d.page)).zoomMappa, sp1 = await hook(d.page, 'mappaSchermo', 360, 150);
    assert(z1.i === 1 && Math.hypot(sp1.x - sp.x, sp1.y - sp.y) < 6, `la rotella non avvicina sul punto: ${JSON.stringify({ z1, sp, sp1 })}`);
    const r = await tela(d.page);
    await d.page.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await d.page.mouse.down();
    await d.page.mouse.move(r.x + r.w / 2 + 150, r.y + r.h / 2 + 60, { steps: 6 }); await d.page.mouse.up(); await d.page.waitForTimeout(300);
    const s = await ctx.getState(d.page);
    assert(s.mappa.zoomMappa.centro.x < z1.centro.x - 10 && s.segno === null, `trascinare col mouse: ${JSON.stringify({ prima: z1.centro, dopo: s.mappa.zoomMappa.centro, segno: s.segno })}`);
    await d.page.keyboard.press('Escape'); await d.page.waitForTimeout(200);
    await d.page.keyboard.press('-'); await d.page.waitForTimeout(100);
    assert((await mappa(d.page)).zoomMini.raggio > 100, '− da tastiera non allontana la minimappa al PC');
    await d.page.keyboard.press('+'); await d.page.waitForTimeout(100);
    const perf = await ctx.getPerf(d.page); ctx.log('perf', JSON.stringify(perf));
    assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls}`);
    ctx.noErrors(d, 'desktop');
  });
  await ctx.test('foto della mappa al PC', async () => { await foto(d, 'desktop'); ctx.noErrors(d, 'foto PC'); });
}
