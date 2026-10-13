// La casa alla Animal Crossing (#265), senza server (net=0, casa 3 = la tua): si entra camminando contro la porta (velo nero a scalini),
// dentro la camera è fissa sopra l'ingresso (yaw 0) e la minimappa sparisce; in fondo alla stanza si va in giardino camminando contro la
// porta, nel passaggio coperto si torna in casa, in fondo al corridoio si esce in città e tutto torna com'era.
// Screenshot: stanza da telefono e da PC (da confrontare con la reference di Animal Crossing), giardino col passaggio, ritorno in città.
export const timeout = 180000;

export default async function (ctx) {
  const { assert } = ctx;
  const SLOT = 3;
  const st = (page) => ctx.getState(page);
  /** Tiene premute le frecce finché `fatto(stato)` (al massimo `ms`). */
  const cammina = async (page, tasti, fatto, ms = 15000, arg = null) => {
    for (const k of tasti) await page.keyboard.down(k);
    try { await ctx.waitState(page, fatto, ms, arg); } finally { for (const k of tasti) await page.keyboard.up(k); }
  };
  /** Le frecce che, con la camera girata di `yaw`, portano più dritte verso (dx, dz) nel mondo (anche in diagonale). */
  const frecce = (yaw, dx, dz) => {
    const su = [-Math.sin(yaw), -Math.cos(yaw)], dx_ = [Math.cos(yaw), -Math.sin(yaw)];
    let best = null;
    for (const v of [-1, 0, 1]) for (const h of [-1, 0, 1]) {
      if (!v && !h) continue;
      const x = su[0] * v + dx_[0] * h, z = su[1] * v + dx_[1] * h, l = Math.hypot(x, z), d = (x * dx + z * dz) / l;
      if (!best || d > best.d) best = { d, k: [...(v > 0 ? ['ArrowUp'] : v < 0 ? ['ArrowDown'] : []), ...(h > 0 ? ['ArrowRight'] : h < 0 ? ['ArrowLeft'] : [])] };
    }
    return best.k;
  };
  const fine = (page) => page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });

  const giro = async (vp, nome) => {
    const p = await ctx.open(`?test=1&net=0&slot=${SLOT}`, { viewport: vp });
    await ctx.waitReady(p.page, 30000);
    await ctx.waitState(p.page, (s, slot) => s.borgo && s.borgo.porte.some((q) => q.slot === slot), 10000, SLOT); // si nasce 2,5 m fuori dalla porta (#267)
    await ctx.waitState(p.page, (s) => s.mappa && s.mappa.mini, 15000).catch(() => {});

    await ctx.test(`${nome}: contro la porta di casa si entra (velo), camera fissa sopra l'ingresso, niente minimappa`, async () => {
      const s = await st(p.page), porta = s.borgo.porte.find((q) => q.slot === SLOT);
      await p.page.evaluate(([x, z]) => window.__game.test.teleport(x, z), [porta.x, porta.z]);
      await cammina(p.page, frecce(Math.PI / 4, porta.verso.x, porta.verso.z), (q, slot) => q.stanza.dentro === slot, 15000, SLOT);
      await fine(p.page);
      const q = await st(p.page);
      assert(q.velo.passaggi >= 1, 'nessun velo: ' + JSON.stringify(q.velo));
      assert(q.stanza.camera && Math.abs(q.stanza.camera.yaw) < 1e-6, 'camera: ' + JSON.stringify(q.stanza.camera));
      assert(!q.stanza.mini && !q.mappa.mini, 'minimappa in casa: ' + JSON.stringify({ stanza: q.stanza.mini, mappa: q.mappa.mini }));
      await p.page.waitForTimeout(500);
      await ctx.shot(p.page, `${nome}_stanza`);
    });

    await ctx.test(`${nome}: contro la porta in fondo si va in giardino; nel passaggio coperto si torna in casa`, async () => {
      await cammina(p.page, ['ArrowUp'], (q) => q.stanza.dentro === null && q.velo.passaggi >= 2, 20000);
      await fine(p.page);
      let q = await st(p.page);
      assert(q.arch.place === 'lotto' && !q.mappa.mini, 'in giardino: ' + JSON.stringify({ place: q.arch.place, mini: q.mappa.mini }));
      await p.page.waitForTimeout(600);
      await ctx.shot(p.page, `${nome}_giardino`);
      // la bocca del passaggio guarda a est: ci si torna camminando verso ovest
      const torna = await st(p.page);
      await cammina(p.page, frecce(Math.PI / 4, -1, 0), (s, slot) => s.stanza.dentro === slot, 20000, SLOT);
      await fine(p.page);
      q = await st(p.page);
      assert(q.velo.passaggi > torna.velo.passaggi, 'passaggio del giardino senza velo');
    });

    await ctx.test(`${nome}: in fondo al corridoio si esce in città, la camera e la minimappa tornano`, async () => {
      await cammina(p.page, ['ArrowDown'], (q) => q.stanza.dentro === null && q.arch.place === 'porto', 20000);
      await fine(p.page);
      await ctx.waitState(p.page, (q) => q.mappa.mini, 5000);
      const q = await st(p.page), porta = q.borgo.porte.find((x) => x.slot === SLOT);
      assert(Math.hypot(q.avatar.x - porta.x, q.avatar.z - porta.z) < 2.2, 'non sei davanti a casa: ' + JSON.stringify(q.avatar));
      assert(q.stanza.camera === null, 'camera ancora fissa');
      await p.page.waitForTimeout(500);
      await ctx.shot(p.page, `${nome}_ritorno`);
      ctx.noErrors(p, nome);
    });
    await p.page.context().close();
  };
  await giro(ctx.B.IPHONE, 'telefono');
  await giro(ctx.B.DESKTOP, 'pc');
}
