// Borgo Marea a vicoli (#265), senza server (net=0): si nasce davanti alla porta di casa e la porta più vicina è la tua; i paesani
// passeggiano per il borgo e niente si attraversa (case, arredo, gente: content/collisioni.json); l'arredo (lampioncini, festoni, vasi, cassette, siepi, fontane, panchine) c'è e sta nel budget (TECH §5).
// Screenshot: telefono davanti a casa, PC dentro un rione, uno slargo con la fontana, il borgo dall'alto, un vicolo di notte.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 180000;
// draw call: 100 dove gioca il telefono; il PC a zoom massimo sopra la piazza vede tutto il borgo e le isole (TECH.md §5): 110
const MAX_DRAW = 100, MAX_DRAW_PC_ALTO = 110, MAX_TRIS = 215000; // TECH §5

export default async function (ctx) {
  const { assert } = ctx;
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const borgo = read('borgo.json'), gente = read('gente.json'), arch = read('archipelago.json'), islands = read('islands.json');
  const porto = arch.islands.find((p) => p.role === 'porto'), T = 2;
  const tpl = islands.find((i) => i.id === 'porto');
  const mondo = (cx, cz) => ({ x: (porto.at[0] + cx) * T, z: (porto.at[1] + cz) * T }); // celle del template (anche frazionarie) → m
  const fontane = tpl.props.filter((p) => p.k === 'fontana');
  const SLOT = 3;

  const hook = (page, fn, ...args) => page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const misura = (page) => page.evaluate(() => new Promise((res) => {
    let n = 0, calls = 0, tris = 0;
    const f = () => { n++; if (n > 3) { const s = window.__game.perf(); calls = Math.max(calls, s.drawCalls); tris = Math.max(tris, s.triangles); } if (n >= 6) res({ calls, tris }); else requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }));
  const vai = async (page, x, z, zoom = null) => { await hook(page, 'teleport', x, z); if (zoom !== null) await hook(page, 'setZoom', zoom); await page.waitForTimeout(900); };

  const t = await ctx.open(`?test=1&net=0&serie=1&slot=${SLOT}`, { viewport: ctx.B.IPHONE });
  await ctx.waitReady(t.page, 30000);

  await ctx.test('telefono: si nasce davanti alla porta di casa (fuori dal raggio del bottone), ed è la porta più vicina', async () => {
    await ctx.waitState(t.page, (s) => s.borgo && s.borgo.porte.length > 0, 10000);
    let s = await ctx.getState(t.page);
    const mia = s.borgo.porte.find((p) => p.slot === SLOT), d = (p) => Math.hypot(s.avatar.x - p.x, s.avatar.z - p.z);
    assert(s.borgo.near === null, 'allo spawn il bottone della porta copre la guida: ' + JSON.stringify(s.borgo.near));
    assert(s.borgo.porte.every((p) => p.slot === SLOT || d(p) > d(mia)) && d(mia) < 3, 'la porta più vicina non è la tua: ' + d(mia).toFixed(2));
    await hook(t.page, 'teleport', (s.avatar.x + mia.x) / 2, (s.avatar.z + mia.z) / 2);
    await ctx.waitState(t.page, (q, slot) => q.borgo.near && q.borgo.near.slot === slot && q.borgo.near.dove === 'entra', 5000, SLOT);
    s = await ctx.getState(t.page);
    assert(s.borgo.porte.length === borgo.case.length, 'porte: ' + s.borgo.porte.length);
    await t.page.waitForTimeout(600);
    await ctx.shot(t.page, 'telefono_davanti_a_casa');
  });

  await ctx.test('i paesani del borgo ci sono, con le battute', async () => {
    const paesani = gente.gente.filter((g) => g.ruolo === 'paesano');
    assert(paesani.length >= 5, 'paesani in gente.json: ' + paesani.length);
    const s = await ctx.getState(t.page);
    for (const p of paesani) assert(s.porto.gente.some((g) => g.id === p.id), 'manca ' + p.id);
  });

  await ctx.test('niente si attraversa: contro una casa ti fermi, e la gente passeggia senza entrare in niente né in nessuno', async () => {
    await ctx.waitState(t.page, (s) => s.porto && s.porto.passeggio === true && s.solidi.fissi > 150, 20000);
    const dentro = (x, z, r) => t.page.evaluate(([x, z, r]) => Math.max(0, ...window.__game.test.solidi(x, z, r, true).map((q) => q.d)), [x, z, r]);
    // da dove porta la freccia → (verso +x nel mondo): si misura con un passo nel prato, poi si cammina 3 s verso la casa da 5 m
    const c = borgo.case[12], casa = mondo(c.at[0] + 0.5, c.at[1] + 0.5), lontano = mondo(44.5, 51);
    await hook(t.page, 'teleport', lontano.x, lontano.z); await t.page.waitForTimeout(200);
    await t.page.keyboard.down('ArrowRight'); await t.page.waitForTimeout(300); await t.page.keyboard.up('ArrowRight'); await t.page.waitForTimeout(150);
    let s = await ctx.getState(t.page);
    const l = Math.hypot(s.avatar.x - lontano.x, s.avatar.z - lontano.z), ux = (s.avatar.x - lontano.x) / l, uz = (s.avatar.z - lontano.z) / l;
    await hook(t.page, 'teleport', casa.x - ux * 5, casa.z - uz * 5); await t.page.waitForTimeout(200);
    await t.page.keyboard.down('ArrowRight');
    let peggio = 0;
    for (let i = 0; i < 25; i++) { s = await ctx.getState(t.page); peggio = Math.max(peggio, await dentro(s.avatar.x, s.avatar.z, 0.35)); await t.page.waitForTimeout(120); }
    await t.page.keyboard.up('ArrowRight');
    s = await ctx.getState(t.page);
    assert(peggio < 0.03 && Math.hypot(s.avatar.x - casa.x, s.avatar.z - casa.z) > 1.3, `la casa si attraversa: dentro ${peggio.toFixed(2)} m, a ${Math.hypot(s.avatar.x - casa.x, s.avatar.z - casa.z).toFixed(2)} m dal centro`);
    // 12 s di passeggio: chi passeggia non entra mai in un solido fisso né in un altro, e quasi tutti si muovono
    const molo = mondo(44.5, 61.5); await hook(t.page, 'teleport', molo.x, molo.z); // in fondo al molo: nessuno si ferma per parlarti
    const strada = new Map();
    for (let k = 0; k < 30; k++) {
      const g = (await ctx.getState(t.page)).porto.gente;
      for (const a of g) for (const b of g) if (a.id < b.id) assert(Math.hypot(a.x - b.x, a.z - b.z) > 0.58, `${a.id} e ${b.id} uno dentro l'altro`);
      for (const n of g.filter((q) => q.passeggia)) {
        const d = await dentro(n.x, n.z, 0.3);
        assert(d < 0.02, `${n.id} entra in un solido di ${d.toFixed(2)} m in ${n.x.toFixed(1)},${n.z.toFixed(1)}`);
        const m = strada.get(n.id) ?? { x: n.x, z: n.z, m: 0 }; m.m += Math.hypot(n.x - m.x, n.z - m.z); m.x = n.x; m.z = n.z; strada.set(n.id, m);
      }
      await t.page.waitForTimeout(400);
    }
    const mossi = [...strada.values()].filter((m) => m.m > 2).length;
    ctx.log('strada in 12 s: ' + [...strada].map(([k, m]) => `${k} ${m.m.toFixed(1)} m`).join(', '));
    assert(strada.size >= 8 && mossi >= 5, `passeggiano ${strada.size}, si sono mossi ${mossi}`);
  });

  await ctx.test('telefono: uno slargo con la fontana, nel budget', async () => {
    const f = fontane[0]; assert(f, 'nessuna fontana nel template porto');
    const w = mondo(f.at[0], f.at[1] + 2.2);
    await vai(t.page, w.x, w.z);
    const m = await misura(t.page);
    assert(m.calls <= MAX_DRAW && m.tris <= MAX_TRIS, 'slargo: ' + JSON.stringify(m));
    await ctx.shot(t.page, 'telefono_slargo');
    ctx.noErrors(t, 'telefono');
  });
  await t.page.context().close();

  const d = await ctx.open(`?test=1&net=0&serie=1&slot=${SLOT}`, { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 30000);
  const zoom0 = (await ctx.getState(d.page)).camera.zoom;

  await ctx.test('PC: dentro un rione (case a schiera, vasi, cassette, lampioncini), nel budget anche di notte', async () => {
    const c = borgo.case[12], w = mondo(c.porta[0] + 0.5, c.porta[1] + 0.5);
    await vai(d.page, w.x, w.z);
    let m = await misura(d.page);
    assert(m.calls <= MAX_DRAW && m.tris <= MAX_TRIS, 'rione: ' + JSON.stringify(m));
    await ctx.shot(d.page, 'pc_rione');
    await hook(d.page, 'ciclo', 0.75); await d.page.waitForTimeout(700);
    m = await misura(d.page);
    assert(m.calls <= MAX_DRAW && m.tris <= MAX_TRIS, 'rione di notte: ' + JSON.stringify(m));
    await ctx.shot(d.page, 'pc_rione_notte');
    await hook(d.page, 'ciclo', null);
  });

  await ctx.test('PC: il borgo dall\'alto (zoom massimo dalla piazza), nel budget', async () => {
    const w = mondo(44.5, 44.5);
    await vai(d.page, w.x, w.z + 6, 2.2);
    const m = await misura(d.page);
    ctx.log(`dall'alto: ${m.calls} draw call, ${m.tris} triangoli`);
    if (process.env.BORGO_DIAG) { const q = await hook(d.page, 'disegnati'); ctx.log(JSON.stringify({ vista: q.vista.length, ombra: q.ombra.length, v: q.vista.map((x) => x.k + ':' + x.t), o: q.ombra.map((x) => x.k + ':' + x.t) })); }
    assert(m.calls <= MAX_DRAW_PC_ALTO && m.tris <= MAX_TRIS, 'dall\'alto: ' + JSON.stringify(m));
    await ctx.shot(d.page, 'pc_borgo_dall_alto');
    await hook(d.page, 'setZoom', zoom0);
    ctx.noErrors(d, 'pc');
  });
  await d.page.context().close();
}
