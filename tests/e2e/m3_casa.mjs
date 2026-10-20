// La casa alla Animal Crossing (#265), senza server (net=0, casa 3 = la tua): si entra camminando contro la porta (velo nero a scalini),
// dentro la camera è fissa sopra l'ingresso (yaw 0) e la minimappa sparisce; in fondo alla stanza si va in giardino camminando contro il
// portale, nel portale sul pontile si torna in casa, in fondo al corridoio si esce in città e tutto torna com'era.
// Screenshot: stanza da telefono e da PC (da confrontare con la reference di Animal Crossing), giardino col portale, ritorno in città.
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

    await ctx.test(`${nome}: camminando contro la porta di casa NON si entra; con A sì (velo), camera fissa sopra l'ingresso, niente minimappa`, async () => {
      const s = await st(p.page), porta = s.borgo.porte.find((q) => q.slot === SLOT);
      await p.page.evaluate(([x, z]) => window.__game.test.teleport(x, z), [porta.x, porta.z]);
      // si cammina contro la facciata per qualche secondo: resta in città
      for (const k of frecce(Math.PI / 4, porta.verso.x, porta.verso.z)) await p.page.keyboard.down(k);
      await p.page.waitForTimeout(2500);
      for (const k of frecce(Math.PI / 4, porta.verso.x, porta.verso.z)) await p.page.keyboard.up(k);
      let q = await st(p.page);
      assert(q.stanza.dentro === null && q.velo.passaggi === 0, 'entrato camminando: ' + JSON.stringify({ stanza: q.stanza.dentro, velo: q.velo }));
      await p.page.evaluate(([x, z]) => window.__game.test.teleport(x, z), [porta.x, porta.z]); // camminando può scivolare lungo il muro: si torna sulla porta
      await ctx.waitState(p.page, (r, slot) => r.borgo.near && r.borgo.near.slot === slot && r.borgo.near.dove === 'entra', 5000, SLOT);
      await p.page.keyboard.press('KeyE');
      await ctx.waitState(p.page, (r, slot) => r.stanza.dentro === slot, 15000, SLOT);
      await fine(p.page);
      q = await st(p.page);
      assert(q.velo.passaggi >= 1, 'nessun velo: ' + JSON.stringify(q.velo));
      assert(q.stanza.camera && Math.abs(q.stanza.camera.yaw) < 1e-6, 'camera: ' + JSON.stringify(q.stanza.camera));
      assert(!q.stanza.mini && !q.mappa.mini, 'minimappa in casa: ' + JSON.stringify({ stanza: q.stanza.mini, mappa: q.mappa.mini }));
      assert(q.aspetto && q.aspetto.momento === 'interno' && q.aspetto.chiuso, 'illuminazione interna non attiva in casa: ' + JSON.stringify(q.aspetto));
      await p.page.evaluate(() => window.__game.test.ciclo(0.78));
      await p.page.waitForTimeout(100);
      let qNotte = await st(p.page);
      assert(qNotte.aspetto && qNotte.aspetto.momento === 'interno', 'il ciclo esterno ha alterato la luce interna: ' + JSON.stringify(qNotte.aspetto));
      await p.page.evaluate(() => window.__game.test.ciclo(null));
      await p.page.waitForTimeout(500);
      await ctx.shot(p.page, `${nome}_stanza`);
    });

    await ctx.test(`${nome}: in casa la modalità foto gira l'inquadratura e la riporta com'era`, async () => {
      const yaw0 = (await st(p.page)).stanza.camera.yaw;
      await p.page.evaluate(() => window.__game.test.foto('apri'));
      await p.page.evaluate(() => window.__game.test.foto('gira', 0.5, 0));
      let q = await st(p.page);
      assert(Math.abs(q.stanza.camera.yaw - (yaw0 + 0.5)) < 1e-6, 'la camera in casa non gira: ' + JSON.stringify(q.stanza.camera));
      await p.page.evaluate(() => window.__game.test.foto('chiudi'));
      q = await st(p.page);
      assert(Math.abs(q.stanza.camera.yaw - yaw0) < 1e-6, 'camera non tornata com\'era: ' + JSON.stringify(q.stanza.camera));
    });

    await ctx.test(`${nome}: contro il portale in fondo si va in giardino; nel portale sul pontile si torna in casa`, async () => {
      await cammina(p.page, ['ArrowUp'], (q) => q.velo.attivo, 20000);
      await fine(p.page);
      let q = await st(p.page);
      assert(q.arch.place === 'lotto' && !q.mappa.mini, 'in giardino: ' + JSON.stringify({ place: q.arch.place, mini: q.mappa.mini }));
      assert(q.aspetto && !q.aspetto.chiuso && q.aspetto.momento !== 'interno', 'in giardino chiuso non falso: ' + JSON.stringify(q.aspetto));
      await p.page.waitForTimeout(600);
      await ctx.shot(p.page, `${nome}_giardino`);
      // il portale sta a sud sul pontile: ci si torna camminando verso il portale
      const torna = await st(p.page), porta = torna.borgo.porte.find((x) => x.slot === SLOT);
      const dx = porta.giardino.x - torna.avatar.x, dz = porta.giardino.z - torna.avatar.z;
      await cammina(p.page, frecce(Math.PI / 4, dx, dz), (s, slot) => s.stanza.dentro === slot, 20000, SLOT);
      await fine(p.page);
      q = await st(p.page);
      assert(q.velo.passaggi > torna.velo.passaggi, 'portale del giardino senza velo');
      assert(q.aspetto && q.aspetto.momento === 'interno' && q.aspetto.chiuso, 'tornato in casa aspetto: ' + JSON.stringify(q.aspetto));
    });

    await ctx.test(`${nome}: in fondo al corridoio si esce in città, la camera e la minimappa tornano`, async () => {
      await cammina(p.page, ['ArrowDown'], (q) => q.velo.attivo, 20000);
      await fine(p.page);
      await ctx.waitState(p.page, (q) => q.mappa.mini, 5000);
      const q = await st(p.page), porta = q.borgo.porte.find((x) => x.slot === SLOT);
      assert(Math.hypot(q.avatar.x - porta.x, q.avatar.z - porta.z) < 2.2, 'non sei davanti a casa: ' + JSON.stringify(q.avatar));
      assert(q.stanza.camera === null, 'camera ancora fissa');
      assert(q.aspetto && !q.aspetto.chiuso && q.aspetto.momento !== 'interno', 'in città chiuso non falso: ' + JSON.stringify(q.aspetto));
      assert(Math.abs(q.foto.yaw - Math.PI / 4) < 1e-6, 'la camera dell\'overworld si è spostata: yaw ' + q.foto.yaw);
      await p.page.waitForTimeout(500);
      await ctx.shot(p.page, `${nome}_ritorno`);
      ctx.noErrors(p, nome);
    });
    await p.page.context().close();
  };
  await giro(ctx.B.IPHONE, 'telefono');
  await giro(ctx.B.DESKTOP, 'pc');
}
