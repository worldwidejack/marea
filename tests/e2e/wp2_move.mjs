// WP2 · input, avatar, barca. Viewport iPhone; pagina ?test=1&net=0.
// (a) le frecce muovono nel diorama nel verso giusto (su = nord-ovest = −x −z)  (b) joystick touch con eventi pointer (anche CDP reali)
// (c) barca: ArrowDown → speed > 2 in 1,5 s  (d) screenshot a piedi e in barca  (e) salita in barca con un tap di A + guidatore + scia.
export const timeout = 240000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  const page = p.page;
  await ctx.waitReady(page);
  const S = () => ctx.getState(page);
  const spawn = async () => { await page.evaluate(() => { const s = window.__game.state().island.spawn; window.__game.test.teleport(s.x, s.z); }); await waitTicks(page, 8); };
  // Il tempo è misurato in TICK di sim (60 Hz), non in ms: sotto carico il render va più piano e i test a tempo diventerebbero flaky.
  const ticksOf = (pg) => pg.evaluate(() => window.__game.state().wp2_boat.ticks);
  const waitTicks = async (pg, n) => { const t0 = await ticksOf(pg); await pg.waitForFunction(([t0, n]) => window.__game.state().wp2_boat.ticks - t0 >= n, [t0, n], { timeout: 40000, polling: 40 }); };
  const holdT = async (key, n, pg = page) => { await pg.keyboard.down(key); await waitTicks(pg, n); await pg.keyboard.up(key); await waitTicks(pg, 3); };
  const hold = (key, ms) => holdT(key, Math.round(ms * 0.06));
  const delta = async (fn) => { const a = (await S()).avatar; await fn(); const b = (await S()).avatar; return { dx: b.x - a.x, dz: b.z - a.z, a, b }; };
  const joy = (type, dx, dy, id = 7) => page.evaluate(([type, dx, dy, id]) => {
    const j = document.getElementById('joystick'); const r = j.getBoundingClientRect();
    j.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy }));
  }, [type, dx, dy, id]);

  await ctx.test('(0) controlli creati: #joystick #btnA #btnB grandi, pagina senza scroll', async () => {
    const r = await page.evaluate(() => Object.fromEntries(['joystick', 'btnA', 'btnB'].map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return [id, [Math.round(b.width), Math.round(b.height), Math.round(b.left), Math.round(b.top)]]; })));
    ctx.log('controlli [w,h,left,top]', JSON.stringify(r));
    ctx.assert(r.joystick[0] >= 120 && r.btnA[0] >= 72 && r.btnB[0] >= 60, 'controlli troppo piccoli');
    ctx.assert(r.btnA[2] + r.btnA[0] <= 390 && r.btnB[2] >= 0 && r.joystick[2] >= 0, 'fuori schermo');
    ctx.assert(await page.evaluate(() => getComputedStyle(document.getElementById('joystick')).touchAction === 'none'), 'touch-action non none');
  });

  await ctx.test('(a) frecce: ↑ → x e z diminuiscono; → x+ z−; ↓ x+ z+; ← x− z+ (assi mondo, camera a 45°)', async () => {
    await spawn(); const up = await delta(() => hold('ArrowUp', 600));
    ctx.log('ArrowUp', up.dx.toFixed(2), up.dz.toFixed(2), 'anim', up.b.anim);
    ctx.assert(up.dx < -0.5 && up.dz < -0.5, `ArrowUp: dx=${up.dx.toFixed(2)} dz=${up.dz.toFixed(2)}`);
    ctx.assert(Math.abs(up.dx - up.dz) < 0.35, 'la diagonale non è a 45°');
    await spawn(); const rt = await delta(() => hold('KeyD', 500)); ctx.assert(rt.dx > 0.3 && rt.dz < -0.3, `→: ${rt.dx.toFixed(2)},${rt.dz.toFixed(2)}`);
    await spawn(); const dn = await delta(() => hold('ArrowDown', 400)); ctx.assert(dn.dx > 0.3 && dn.dz > 0.3, `↓: ${dn.dx.toFixed(2)},${dn.dz.toFixed(2)}`);
    await spawn(); const lf = await delta(() => hold('KeyA', 400)); ctx.assert(lf.dx < -0.3 && lf.dz > 0.3, `←: ${lf.dx.toFixed(2)},${lf.dz.toFixed(2)}`);
  });
  await ctx.test('tastiera: Shift = corsa (anim run, ~5 m/s), senza = camminata (~3 m/s)', async () => {
    await spawn(); await page.keyboard.down('ArrowUp'); await waitTicks(page, 20);
    const w = (await S()).avatar; await page.keyboard.down('Shift'); await waitTicks(page, 20); const r = (await S()).avatar; await page.keyboard.up('Shift'); await page.keyboard.up('ArrowUp');
    ctx.log('walk', w.anim, Math.hypot(w.vx, w.vz).toFixed(2), 'run', r.anim, Math.hypot(r.vx, r.vz).toFixed(2));
    ctx.assert(w.anim === 'walk' && Math.abs(Math.hypot(w.vx, w.vz) - 3) < 0.3, 'camminata'); ctx.assert(r.anim === 'run' && Math.hypot(r.vx, r.vz) > 4.5, 'corsa');
  });

  await ctx.test('l’avatar GUARDA dove va (yaw della sim → rotazione three con segno giusto)', async () => {
    for (const [key, ex, ez] of [['ArrowRight', 0.707, -0.707], ['ArrowDown', 0.707, 0.707], ['ArrowLeft', -0.707, 0.707]]) {
      await spawn(); await page.keyboard.down(key); await waitTicks(page, 25); const s = await S(); await page.keyboard.up(key); await waitTicks(page, 5);
      const f = s.wp2_avatar.facing, d = f[0] * ex + f[1] * ez;
      ctx.log(key, 'facing', f.map((v) => v.toFixed(2)).join(','), 'dot', d.toFixed(2)); ctx.assert(d > 0.9, `${key}: guarda ${f} invece di ${ex},${ez}`);
    }
  });

  await ctx.test('(b) joystick con pointer sintetici su #joystick: su → si muove nord-ovest; zona morta; camminata < 0,8 < corsa; rilascio ferma', async () => {
    await spawn();
    await joy('pointerdown', 0, 0); await joy('pointermove', 3, 2); await waitTicks(page, 15);
    let s = await S(); ctx.assert(Math.hypot(s.avatar.vx, s.avatar.vz) < 0.01 && s.wp2_input.src === 'none', 'la zona morta lascia passare ' + JSON.stringify(s.wp2_input));
    await joy('pointermove', 0, -22); await waitTicks(page, 25); s = await S();
    ctx.log('stick metà', JSON.stringify(s.wp2_input), 'anim', s.avatar.anim);
    ctx.assert(s.avatar.anim === 'walk' && s.wp2_input.mag > 0.2 && s.wp2_input.mag < 0.8, 'metà corsa deve essere camminata');
    const a0 = s.avatar; await joy('pointermove', 0, -60); await waitTicks(page, 30); s = await S();
    ctx.log('stick pieno', JSON.stringify(s.wp2_input), 'anim', s.avatar.anim, 'Δ', (s.avatar.x - a0.x).toFixed(2), (s.avatar.z - a0.z).toFixed(2));
    ctx.assert(s.avatar.anim === 'run' && s.wp2_input.mag > 0.95, 'stick a fondo = corsa');
    ctx.assert(s.avatar.x - a0.x < -0.5 && s.avatar.z - a0.z < -0.5, 'su sullo stick non porta a nord-ovest');
    await ctx.shot(page, 'joystick_su');
    await joy('pointerup', 0, -60); await waitTicks(page, 15); s = await S();
    ctx.assert(s.avatar.anim === 'idle' && s.wp2_input.src === 'none', 'rilascio non ferma');
    // niente doppio evento: un secondo pointerdown mentre il dito è già giù non deve azzerare o riposizionare
    await joy('pointerdown', 0, 0, 1); await joy('pointerdown', 40, 0, 2); await joy('pointermove', 44, 0, 1); await waitTicks(page, 5);
    s = await S(); ctx.assert(s.wp2_input.stick[0] > 0.9 && Math.abs(s.wp2_input.stick[1]) < 0.1, 'secondo dito ha interferito ' + JSON.stringify(s.wp2_input.stick));
    await joy('pointerup', 0, 0, 2); await waitTicks(page, 5); s = await S(); ctx.assert(s.wp2_input.stick[0] > 0.9, 'il pointerup del secondo dito ha rilasciato lo stick');
    await joy('pointerup', 0, 0, 1);
  });
  await ctx.test('(b2) tocco reale via CDP (pointer capture vera): trascina lo stick a destra → sud-est... poi rilascia', async () => {
    await spawn();
    const cdp = await page.context().newCDPSession(page);
    const c = await page.evaluate(() => { const r = document.getElementById('joystick').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const touch = (type, dx, dy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: c.x + dx, y: c.y + dy, id: 1 }] });
    await touch('touchStart', 0, 0); await touch('touchMove', 50, 0); await waitTicks(page, 30);
    const s = await S(); ctx.log('CDP', JSON.stringify(s.wp2_input), 'v', s.avatar.vx.toFixed(2), s.avatar.vz.toFixed(2));
    await touch('touchEnd'); await waitTicks(page, 15); const e = await S();
    ctx.assert(s.avatar.vx > 1 && s.avatar.vz < -1, 'destra sullo schermo = +x −z'); ctx.assert(e.wp2_input.src === 'none' && e.avatar.anim === 'idle', 'touchEnd non ferma');
  });
  await ctx.test('bottoni A/B: tocco più corto di un tick viene visto (latch); tenuto premuto = held', async () => {
    const ev = (id, type) => page.evaluate(([id, type]) => document.getElementById(id).dispatchEvent(new PointerEvent(type, { pointerId: 3, pointerType: 'touch', bubbles: true, cancelable: true })), [id, type]);
    await page.evaluate(() => window.__seen = 0);
    // A giù+su nello stesso frame: il mondo deve comunque registrare un fronte (sale in barca dal molo)
    await page.evaluate(() => { const s = window.__game.state(); window.__game.test.teleport(33, 39.2); });
    await waitTicks(page, 12);
    const before = (await S()).mode;
    await ev('btnA', 'pointerdown'); await ev('btnA', 'pointerup'); await waitTicks(page, 10);
    const after = (await S()).mode;
    ctx.log('mode', before, '→', after);
    ctx.assert(before === 'walk' && after === 'boat', 'il tap veloce su A non è stato visto');
    await ev('btnB', 'pointerdown'); await waitTicks(page, 8); const held = (await S()).wp2_input.b; await ev('btnB', 'pointerup'); await waitTicks(page, 8);
    ctx.assert(held === true && (await S()).wp2_input.b === false, 'B held/rilascio');
  });
  await ctx.test('(e) a bordo: guidatore seduto visibile, scia che nasce a poppa, remi', async () => {
    await page.keyboard.down('ArrowDown'); await waitTicks(page, 100);
    const s = await S(); ctx.log('boat', JSON.stringify(s.boat), 'fx', JSON.stringify(s.wp2_boat));
    await ctx.shot(page, 'barca_guidatore');
    ctx.assert(s.wp2_boat.driverVisible && s.wp2_boat.driverAnim, 'guidatore non seduto a bordo');
    { const f = s.wp2_boat.facing, d = f[0] * Math.sin(s.boat.yaw) - f[1] * Math.cos(s.boat.yaw); ctx.assert(d > 0.97, `la barca non guarda dove va: facing ${f} yaw ${s.boat.yaw} dot ${d}`); }
    ctx.assert(s.wp2_boat.wake > 3, 'scia assente: ' + s.wp2_boat.wake);
    await page.evaluate(() => window.__game.test.setZoom(0.6)); await waitTicks(page, 40); await ctx.shot(page, 'barca_zoom');
    await page.keyboard.up('ArrowDown');
    await page.waitForFunction(() => window.__game.state().boat.wake < 0.05 && window.__game.state().wp2_boat.wake === 0, null, { timeout: 60000, polling: 200 }).catch(() => {});
    const e = await S();
    ctx.log('scia da ferma', e.wp2_boat.wake, 'speed', e.boat.speed.toFixed(2));
    ctx.assert(e.wp2_boat.wake < s.wp2_boat.wake, 'la scia non sbiadisce da ferma: ' + e.wp2_boat.wake);
    await page.evaluate(() => window.__game.test.setZoom(1));
  });

  // ---- (c) barca con setMode, su pagina nuova per stato pulito ----
  const q = await ctx.open('?test=1&net=0'); await ctx.waitReady(q.page);
  await ctx.test('(c) setMode(boat) + ArrowDown 1,5 s → boat.speed > 2', async () => {
    await q.page.evaluate(() => window.__game.test.setMode('boat'));
    await q.page.keyboard.down('ArrowDown'); await waitTicks(q.page, 90);
    const st = await ctx.getState(q.page); await q.page.keyboard.up('ArrowDown');
    ctx.log('speed', st.boat.speed.toFixed(2), 'wake', st.boat.wake.toFixed(2), 'fx', JSON.stringify(st.wp2_boat));
    ctx.assert(st.mode === 'boat' && st.boat.speed > 2, `speed ${st.boat.speed}`);
    ctx.assert(Math.abs(st.wp2_boat.pitch) < 0.2 && Math.abs(st.wp2_boat.roll) < 0.3, 'beccheggio/rollio fuori scala');
  });
  await ctx.shot(q.page, 'in_barca');

  // ---- (d) screenshot a piedi: zoom ravvicinato per vedere il segnaposto ----
  await ctx.test('(d) screenshot a piedi (fermo, cammina, corre) e zoom ravvicinato', async () => {
    await page.evaluate(() => { window.__game.test.setMode('walk'); window.__game.test.setZoom(0.6); });
    await spawn(); await waitTicks(page, 60); await ctx.shot(page, 'a_piedi_fermo');
    await page.keyboard.down('ArrowRight'); await waitTicks(page, 30); await ctx.shot(page, 'a_piedi_cammina');
    await page.keyboard.down('Shift'); await waitTicks(page, 30); await ctx.shot(page, 'a_piedi_corre');
    await page.keyboard.up('Shift'); await page.keyboard.up('ArrowRight');
    await page.evaluate(() => window.__game.test.setZoom(1)); await waitTicks(page, 50); await ctx.shot(page, 'a_piedi_zoom1');
    ctx.assert(await page.evaluate(() => scrollX === 0 && scrollY === 0), 'la pagina è scrollata');
  });
  await ctx.test('nessun pageerror', async () => {
    ctx.assert(p.errors.length === 0 && q.errors.length === 0, 'pageerror: ' + [...p.errors, ...q.errors].slice(0, 3).join(' | '));
    const other = [...p.consoleErrors, ...q.consoleErrors, ...p.failed, ...q.failed]; if (other.length) ctx.warn('altri errori (non WP2?)', other.slice(0, 3).join(' | '));
  });
}
