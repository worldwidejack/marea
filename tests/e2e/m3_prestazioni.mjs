// Prestazioni con le impostazioni di serie (?serie=1: camera 22°, ciclo, contorni; animali e scenografia delle isole a tema caricati):
// giro di tutto l'arcipelago (Porto, molo, Laguna, Neon, Selvaggia, ogni lotto, le 4 isole a tema aperte e chiuse viste dal mare,
// mare aperto verso le isole lontane), a 22° e a 45°, zoom di partenza e zoom massimo, giorno e notte, telefono 390×844 e PC 1280×720.
// FALLISCE se in un qualsiasi punto draw call > 100 o triangoli > 150.000 (TECH §5). Numeri: tests/out/m3_prestazioni.json
// Screenshot (22°): Porto, molo, Vulcano, Laguna, mare aperto verso le isole, Porto di notte.
export const timeout = 420000;
const MAX_DRAW = 100, MAX_TRIS = 150000;
const SHOTS = new Set(['porto', 'molo', 'laguna', 'vulcano', 'vulcano_chiusa', 'mare_sudest', 'mare_est']);

/** Punti del giro: come arrivarci (hook di test). */
const PUNTI = [
  ['porto', [['temiProva', null], ['goto', 'porto']]],
  ['molo', [['goto', 'porto'], ['molo']]],
  ['laguna', [['goto', 'laguna']]],
  ['neon', [['goto', 'neon']]],
  ['selvaggia', [['goto', 'selvaggia']]],
  ...Array.from({ length: 8 }, (_, i) => [`lotto${i}`, [['goto', `lotto:${i}`]]]),
  ...['tempesta', 'ghiacci', 'vulcano', 'giardino'].flatMap((id) => [
    [id, [['temiProva', 'tutte'], ['goto', id]]],
    [`${id}_chiusa`, [['temiProva', null], ['temiVerso', id, 6]]],
  ]),
  ['mare_sudest', [['temiProva', null], ['temiBarca', 450, 470, -Math.PI * 0.75]]], // sotto Porto e lotti, la camera guarda a nord-ovest: mezzo arcipelago davanti
  ['mare_est', [['temiBarca', 600, 330, -Math.PI * 0.75]]], // tra Laguna, Tempesta e Vulcano
  ['mare_ovest', [['temiBarca', 150, 470, -Math.PI * 0.75]]], // sopra il Giardino, verso lotti 6, 3, Selvaggia
];
/** Varianti per ogni punto: camera (indice VISTE), zoom (null = quello di partenza), fase del ciclo (0,3 giorno, 0,75 notte). */
const VARIANTI = [
  { nome: '22', cam: 3, zoom: null, fase: 0.3 },
  { nome: '22_zoom', cam: 3, zoom: 2.2, fase: 0.3 },
  { nome: '22_notte', cam: 3, zoom: null, fase: 0.75 },
  { nome: '45', cam: 0, zoom: null, fase: 0.3 },
];

export default async function (ctx) {
  const { assert } = ctx;
  const righe = [], diag = {};
  const giro = async (vp, nome) => {
    const p = await ctx.open('?test=1&net=0&serie=1', { viewport: vp });
    await ctx.waitReady(p.page, 30000);
    const hook = (fn, ...args) => p.page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
    await hook('aspettoPronto');
    await hook('temiFx');
    await p.page.waitForFunction(() => !!window.__game.state().animali, null, { timeout: 15000 }).catch(() => ctx.warn('animali', 'chunk degli animali non arrivato'));
    const zoom0 = (await ctx.getState(p.page)).camera.zoom;
    /** Massimo di draw call e triangoli su 3 frame (dopo 3 di assestamento). */
    const misura = () => p.page.evaluate(() => new Promise((res) => {
      let n = 0, calls = 0, tris = 0;
      const f = () => { n++; if (n > 3) { const s = window.__game.perf(); calls = Math.max(calls, s.drawCalls); tris = Math.max(tris, s.triangles); } if (n >= 6) res({ calls, tris }); else requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }));
    const solo = process.env.PREST_PUNTI?.split(','); // per provare a mano solo alcuni punti
    for (const [punto, passi] of PUNTI.filter(([q]) => !solo || solo.includes(q))) {
      for (const v of VARIANTI) {
        const t0 = Date.now();
        await hook('impostazioni', { cam: v.cam });
        await hook('ciclo', v.fase);
        for (const [h, ...a] of passi) {
          if (h === 'molo') { const d = (await ctx.getState(p.page)).island.dock; await hook('teleport', d.x, d.z); }
          else await hook(h, ...a);
        }
        await hook('setZoom', v.zoom ?? zoom0);
        await p.page.waitForTimeout(250); // ciclo (½ s), chunk della scenografia, passata finale
        const m = await misura();
        righe.push({ vp: nome, punto, vista: v.nome, drawCalls: m.calls, triangles: m.tris, ms: Date.now() - t0 });
        if (process.env.PREST_LOG) ctx.log(JSON.stringify(righe.at(-1)));
        if (process.env.PREST_DIAG && v.nome === '22' && SHOTS.has(punto)) diag[`${nome}_${punto}`] = await hook('disegnati');
        if (v.nome === '22' && SHOTS.has(punto)) await ctx.shot(p.page, `${nome}_${punto}`);
        if (v.nome === '22_notte' && punto === 'porto') await ctx.shot(p.page, `${nome}_porto_notte`);
      }
    }
    ctx.noErrors(p, nome);
    await p.page.context().close();
  };

  await ctx.test('giro dell\'arcipelago: telefono 390×844 e PC 1280×720', async () => {
    await giro(ctx.B.IPHONE, 'telefono');
    await giro(ctx.B.DESKTOP, 'pc');
    const peggio = (k) => righe.reduce((a, b) => (b[k] > a[k] ? b : a));
    const sopra = righe.filter((r) => r.drawCalls > MAX_DRAW || r.triangles > MAX_TRIS);
    const file = ctx.writeOut('m3_prestazioni.json', { when: new Date().toISOString(), limiti: { drawCalls: MAX_DRAW, triangoli: MAX_TRIS }, peggioDraw: peggio('drawCalls'), peggioTri: peggio('triangles'), sopra, righe, diag });
    ctx.log(`${righe.length} misure · peggio draw call ${JSON.stringify(peggio('drawCalls'))} · peggio triangoli ${JSON.stringify(peggio('triangles'))} · fuori budget ${sopra.length}`);
    ctx.log('→ ' + file.replace(ctx.ROOT + '/', ''));
    assert(righe.every((r) => r.drawCalls > 0), 'draw call = 0: perf() non legge il renderer');
    assert(!sopra.length, `fuori budget in ${sopra.length} punti: ${sopra.slice(0, 8).map((r) => `${r.vp}/${r.punto}/${r.vista} ${r.drawCalls} dc ${r.triangles} tri`).join(' · ')}`);
  });
}
