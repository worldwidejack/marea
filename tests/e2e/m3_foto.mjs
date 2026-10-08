// Modalità foto (#109). Telefono 390×844: la macchina fotografica nella barra in alto apre la modalità foto (il codice si scarica solo
// adesso), tutta l'interfaccia sparisce (barra, bussola, minimappa, joystick, bottoni: state().foto.visibili vuoto), l'avatar sta fermo
// anche col joystick spinto, la camera gira attorno e zooma (entro i limiti), SCATTA → anteprima con la cornice; il PNG è la foto del
// gioco ingrandita ×N nearest (dimensioni = cornice × N, foto = canvas a pixel) con pixel diversi, SALVA scarica marea-AAAA-MM-GG-hhmm.png;
// × torna alla foto, × esce: interfaccia e camera tornano come prima. PC 1280×720: O entra, trascinare col mouse gira, la rotella zooma,
// Spazio scatta, Esc torna alla foto ed Esc esce. Gli scatti finiscono in tests/out/m3_foto_scatto_*.png (da guardare).
import fs from 'node:fs';
import path from 'node:path';
export const timeout = 240000;

const CAM_YAW = Math.PI / 4;
const NOME = /^marea-\d{4}-\d{2}-\d{2}-\d{4}\.png$/;

export default async function (ctx) {
  const { assert } = ctx;
  const salva = (dataUrl, nome) => { const f = path.join(ctx.OUT, nome); fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64')); ctx.log('scatto →', f); return f; };
  /** Giorno sereno con le impostazioni di serie (camera 22°, contorni): gli scatti non dipendono dall'ora vera. */
  const giorno = async (page) => {
    await page.evaluate(() => window.__game.test.aspettoPronto());
    await page.evaluate(() => { window.__game.test.ciclo(0.2); window.__game.test.meteo('sereno', 0); });
    await ctx.waitState(page, (st) => st.aspetto.momento === 'giorno', 10000).catch(() => {});
  };
  /** Controlli comuni sullo scatto: dimensioni, ingrandimento intero, foto = canvas del gioco, pixel diversi, nome del file. */
  const controllaScatto = async (page, nomeOut) => {
    const d = await page.evaluate(() => window.__game.test.foto('dati'));
    assert(d, 'nessuno scatto');
    const perf = await ctx.getPerf(page);
    ctx.log('scatto', JSON.stringify({ ...d, dataUrl: `${(d.dataUrl.length / 1024).toFixed(0)} KB` }), 'canvas', perf.width, perf.height);
    const f = d.w / d.piccola[0];
    assert(Number.isInteger(f) && f >= 2 && f <= 6 && d.h === d.piccola[1] * f, `ingrandimento non intero: ${d.w}×${d.h} da ${d.piccola}`);
    assert(d.foto[0] === perf.width && d.foto[1] === perf.height, `la foto non è il canvas a pixel: ${d.foto} invece di ${perf.width}×${perf.height}`);
    assert(d.piccola[0] > d.foto[0] && d.piccola[1] > d.foto[1] + 20, `cornice assente: ${d.piccola} attorno a ${d.foto}`);
    assert(d.coloriFoto >= 20, `foto quasi uniforme: ${d.coloriFoto} colori`);
    assert(d.coloriCornice >= 4, `cornice senza dettagli: ${d.coloriCornice} colori`);
    assert(d.blob > 5000 && d.dataUrl.startsWith('data:image/png;base64,'), `PNG troppo piccolo: ${d.blob} byte`);
    assert(NOME.test(d.nome), `nome del file: ${d.nome}`);
    const out = salva(d.dataUrl, nomeOut);
    // il PNG scritto ha davvero quelle dimensioni (intestazione IHDR)
    const png = fs.readFileSync(out);
    assert(png.readUInt32BE(16) === d.w && png.readUInt32BE(20) === d.h, `IHDR ${png.readUInt32BE(16)}×${png.readUInt32BE(20)} invece di ${d.w}×${d.h}`);
    return d;
  };

  // ---------------- telefono ----------------
  const p = await ctx.open('?test=1&net=0&serie=1');
  await ctx.waitReady(p.page, 20000);
  await giorno(p.page);
  const page = p.page;
  await ctx.test('telefono: il bottone c’è e il codice della foto non è ancora scaricato', async () => {
    assert(await page.isVisible('#mzFotoBtn'), 'bottone della macchina fotografica assente');
    const st = await ctx.getState(page);
    assert(st.foto && st.foto.caricata === false && st.foto.aperta === false, `foto: ${JSON.stringify(st.foto)}`);
  });
  let avatar0 = null;
  await ctx.test('telefono: si entra, l’interfaccia sparisce, restano SCATTA e ×', async () => {
    await page.click('#mzFotoBtn');
    await ctx.waitState(page, (st) => st.foto.aperta === true, 15000);
    const st = await ctx.getState(page);
    assert(st.foto.visibili.length === 0, `ancora visibili: ${st.foto.visibili.join(', ')}`);
    for (const id of ['#mzTop', '#joystick', '#btnA', '#mzBar', '#mzMini']) assert(!(await page.isVisible(id)), `${id} ancora visibile`);
    assert(await page.isVisible('#mzFotoScatta'), 'SCATTA non visibile');
    assert(await page.isVisible('#mzFoto .mz-x'), '× non visibile');
    avatar0 = st.avatar;
  });
  await ctx.test('telefono: col joystick spinto l’avatar resta fermo', async () => {
    await page.evaluate(() => window.__game.test.wp2_inject({ mx: 1, my: 0 }));
    // si aspetta che passino davvero dei fotogrammi (il mondo resta vivo), poi si guarda la posizione
    await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n >= 30 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const a = (await ctx.getState(page)).avatar;
    await page.evaluate(() => window.__game.test.wp2_inject(null));
    assert(Math.hypot(a.x - avatar0.x, a.z - avatar0.z) < 0.05, `l'avatar si è mosso: ${JSON.stringify(avatar0)} → ${JSON.stringify(a)}`);
  });
  await ctx.test('telefono: la camera gira e zooma entro i limiti', async () => {
    const z0 = (await ctx.getState(page)).foto.zoom;
    await page.evaluate(() => window.__game.test.foto('gira', 10, 0, 0.1)); // molto oltre i limiti: si ferma lì
    const st = (await ctx.getState(page)).foto;
    ctx.log('camera', JSON.stringify({ yaw: st.yaw, pitch: st.pitch, zoom: st.zoom, z0 }));
    assert(Math.abs(st.yaw - (CAM_YAW + Math.PI / 2)) < 1e-6, `yaw oltre il limite (±90°): ${st.yaw}`);
    assert(Math.abs(st.zoom - 0.6) < 1e-6, `zoom oltre il limite (0,6): ${z0} → ${st.zoom}`);
    await page.evaluate(() => window.__game.test.foto('gira', -Math.PI / 2 - Math.PI / 8, 0.1, 2.4)); // un po' girata e più larga, per lo screenshot
    const s2 = (await ctx.getState(page)).foto;
    assert(Math.abs(s2.yaw - (CAM_YAW - Math.PI / 8)) < 1e-6 && s2.zoom > 1.3, `seconda vista: ${JSON.stringify(s2)}`);
  });
  await ctx.test('telefono: screenshot della modalità foto', async () => {
    await ctx.shot(page, 'iphone_modo_foto');
  });
  let dPhone = null;
  await ctx.test('telefono: SCATTA → lampo e anteprima con la cornice', async () => {
    await page.click('#mzFotoScatta');
    await ctx.waitState(page, (st) => st.foto.anteprima === true, 20000);
    assert(await page.isVisible('#mzFotoAnt canvas'), 'anteprima senza immagine');
    assert(await page.isVisible('#mzFotoSalva'), 'SALVA non visibile');
    const box = await page.locator('#mzFotoAnt canvas').boundingBox();
    assert(box && box.width > 200 && box.height > 300 && box.x >= 0 && box.x + box.width <= 390 + 1 && box.y + box.height <= 844, `anteprima fuori misura: ${JSON.stringify(box)}`);
    await ctx.shot(page, 'iphone_anteprima');
    dPhone = await controllaScatto(page, 'm3_foto_scatto_iphone.png');
    assert(dPhone.posto === 'Porto', `posto: ${dPhone.posto}`);
  });
  await ctx.test('telefono: SALVA scarica il PNG col nome giusto', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#mzFotoSalva')]);
    assert(NOME.test(dl.suggestedFilename()) && dl.suggestedFilename() === dPhone.nome, `download: ${dl.suggestedFilename()}`);
  });
  await ctx.test('telefono: × torna alla foto, × esce e tutto torna com’era', async () => {
    await page.click('#mzFoto .mz-x');
    await ctx.waitState(page, (st) => st.foto.anteprima === false && st.foto.aperta === true, 5000);
    await page.click('#mzFoto .mz-x');
    await ctx.waitState(page, (st) => st.foto.aperta === false, 5000);
    const st = await ctx.getState(page);
    for (const id of ['mzTop', 'joystick', 'btnA']) assert(st.foto.visibili.includes(id), `${id} non è tornato: ${st.foto.visibili.join(', ')}`);
    assert(await page.isVisible('#mzFotoBtn'), 'bottone della foto sparito');
    assert(Math.abs(st.foto.yaw - CAM_YAW) < 1e-6, `camera non tornata: yaw ${st.foto.yaw}`);
    ctx.noErrors(p, 'telefono');
  });

  // ---------------- PC ----------------
  const d = await ctx.open('?test=1&net=0&serie=1', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await giorno(d.page);
  const pc = d.page;
  await ctx.test('PC: O entra, il mouse gira, la rotella zooma', async () => {
    await pc.mouse.click(640, 360); await pc.keyboard.press('KeyO');
    await ctx.waitState(pc, (st) => st.foto.aperta === true, 15000);
    const s0 = (await ctx.getState(pc)).foto;
    assert(s0.visibili.length === 0, `ancora visibili: ${s0.visibili.join(', ')}`);
    await pc.mouse.move(700, 420); await pc.mouse.down();
    for (let i = 1; i <= 8; i++) await pc.mouse.move(700 - i * 25, 420 + i * 3);
    await pc.mouse.up();
    await pc.mouse.move(640, 360); await pc.mouse.wheel(0, -300);
    await ctx.waitState(pc, (st, a) => Math.abs(st.foto.yaw - a.yaw) > 0.2 && st.foto.zoom < a.zoom - 0.05, 5000, { yaw: s0.yaw, zoom: s0.zoom });
    const s1 = (await ctx.getState(pc)).foto;
    ctx.log('PC camera', JSON.stringify({ da: [s0.yaw, s0.pitch, s0.zoom], a: [s1.yaw, s1.pitch, s1.zoom] }));
    await ctx.shot(pc, 'desktop_modo_foto');
  });
  await ctx.test('PC: Spazio scatta, anteprima con la cornice, PNG giusto', async () => {
    await pc.keyboard.press('Space');
    await ctx.waitState(pc, (st) => st.foto.anteprima === true, 20000);
    await ctx.shot(pc, 'desktop_anteprima');
    const dd = await controllaScatto(pc, 'm3_foto_scatto_desktop.png');
    assert(Math.max(dd.w, dd.h) >= 1600, `foto da PC troppo piccola: ${dd.w}×${dd.h}`);
  });
  await ctx.test('PC: Esc torna alla foto, Esc esce', async () => {
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (st) => st.foto.anteprima === false && st.foto.aperta === true, 5000);
    await pc.keyboard.press('Escape');
    await ctx.waitState(pc, (st) => st.foto.aperta === false, 5000);
    const st = await ctx.getState(pc);
    assert(st.foto.visibili.includes('mzTop'), `barra non tornata: ${st.foto.visibili.join(', ')}`);
    ctx.noErrors(d, 'PC');
  });
}
