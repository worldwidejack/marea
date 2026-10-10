// Isola dell'Adrenalina (docs/ADRENALINA.md §2-3, passo 2 di #189). Senza server (net=0), telefono 390×844: l'isola c'è, chiusa col motivo
// del guardiano e il lucchetto; ci si sbarca senza essere cacciati (niente barriera, niente cacciata come al Vulcano); la funivia (chunk a
// parte) ha cavi e due cabine che si muovono; al cancello A → la liberatoria, FIRMA, senza casco il guardiano non fa salire, col casco sì.
// PC 1280×720 con ?adrenalina=1: isola aperta, bottone 🚡 che porta al cancello. Lato server (wrangler dev locale come m4_templari_server):
// POST /api/adrenalina/liberatoria firma una volta sola e la firma resta nel lotto. Screenshot in tests/out/shots/m4_adrenalina_*.png.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CASCO = JSON.parse(fs.readFileSync(new URL('../../packages/content/src/avatar.json', import.meta.url), 'utf8')).cappelli.findIndex((h) => h.id === 'casco');

export default async function (ctx) {
  const { assert } = ctx;
  const hook = (page, fn, ...args) => page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
  const adr = async (page) => (await ctx.getState(page)).adrenalina ?? {};
  const budget = async (page, name) => {
    const perf = await ctx.getPerf(page);
    ctx.log(name, JSON.stringify({ drawCalls: perf.drawCalls, triangles: perf.triangles }));
    assert(perf.drawCalls > 0 && perf.drawCalls <= 100, `${name}: draw call ${perf.drawCalls}`);
    assert(perf.triangles <= 150000, `${name}: triangoli ${perf.triangles}`);
  };

  // ---------------- telefono ----------------
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  const page = p.page;
  assert(CASCO > 0, 'il casco non è in avatar.json');

  await ctx.test('telefono: l’isola c’è, chiusa col motivo del guardiano; si sbarca senza essere cacciati', async () => {
    const st = await ctx.getState(page);
    const i = st.temi.isole.find((x) => x.id === 'adrenalina');
    assert(i && !i.aperta && i.barriera === 0, `isola: ${JSON.stringify(i)}`);
    assert(/guardiano della funivia.*liberatoria/.test(i.motivo) && /Casco \(35 Perle\)/.test(i.manca), `motivo: ${i.motivo} · ${i.manca}`);
    const c0 = st.temi.cacce;
    await hook(page, 'goto', 'adrenalina');
    await page.waitForTimeout(3500);
    const s = await ctx.getState(page);
    assert(s.mode === 'walk' && s.temi.cacce === c0, `cacciato dall'isola: modo ${s.mode}, cacce ${s.temi.cacce}`);
    await hook(page, 'setZoom', 1.6);
    await page.waitForTimeout(800);
    await ctx.shot(page, 'molo');
    await budget(page, 'iphone_molo');
  });

  await ctx.test('telefono: la funivia si scarica, cavi tra le stazioni e due cabine che si muovono', async () => {
    assert(await hook(page, 'adrenalinaCarica') === true, 'funivia non scaricata');
    const a0 = await adr(page);
    assert(a0.caricata && a0.cavo && a0.cavo.a[1] > a0.cavo.da[1] + 10, `cavo: ${JSON.stringify(a0.cavo)}`);
    await page.waitForTimeout(1500);
    const a1 = await adr(page);
    assert(a1.cabine.length === 2 && a1.cabine.some((c, k) => c.join() !== a0.cabine[k].join()), `cabine ferme: ${JSON.stringify(a1.cabine)}`);
    for (const c of a1.cabine) assert(c[1] >= a0.cavo.da[1] - 0.1 && c[1] <= a0.cavo.a[1] + 0.1, `cabina fuori dal cavo: ${c}`);
  });

  await ctx.test('telefono: al cancello A apre la liberatoria, FIRMA, senza casco non si sale, col casco sì', async () => {
    await hook(page, 'adrenalinaCancello');
    await ctx.waitState(page, (st) => st.adrenalina.near === true, 10000);
    await page.waitForSelector('#mzFunivia.on', { timeout: 8000 });
    await ctx.shot(page, 'cancello');
    await page.click('#mzFunivia');
    await ctx.waitState(page, (st) => st.adrenalina.liberatoria === true, 5000);
    const testo = await page.textContent('#mzLiberatoria');
    assert(testo.includes('ossa rotte, orgoglio ferito e Perle perse'), 'liberatoria senza il testo');
    await ctx.shot(page, 'liberatoria');
    await page.click('#mzLiberatoria [data-act=firma]');
    await ctx.waitState(page, (st) => st.adrenalina.firmata === true && st.adrenalina.liberatoria === false && st.adrenalina.firme === 1, 5000);
    await page.waitForSelector('#mzFunivia.on', { timeout: 8000 });
    await page.click('#mzFunivia');
    await ctx.waitState(page, (st) => st.adrenalina.rifiuti === 1, 5000);
    assert(/Senza casco qui non sale nessuno/.test((await adr(page)).ultimo), `guardiano: ${(await adr(page)).ultimo}`);
    await hook(page, 'portoCappello', CASCO);
    await hook(page, 'setZoom', 0.7);
    await page.waitForTimeout(600);
    await page.click('#mzFunivia');
    await ctx.waitState(page, (st) => st.adrenalina.salite === 1, 5000);
    assert(/Le piste aprono a giorni/.test((await adr(page)).ultimo), `guardiano: ${(await adr(page)).ultimo}`);
    await ctx.shot(page, 'casco');
    await budget(page, 'iphone_cancello');
    ctx.noErrors(p, 'telefono');
  });

  // ---------------- PC, prove ----------------
  const d = await ctx.open('?test=1&net=0&adrenalina=1', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(d.page, 20000);
  await ctx.test('PC con ?adrenalina=1: isola aperta, il bottone 🚡 porta al cancello', async () => {
    await d.page.waitForSelector('#mzAdrenalinaVai', { timeout: 10000 });
    const i = (await ctx.getState(d.page)).temi.isole.find((x) => x.id === 'adrenalina');
    assert(i.aperta, 'con ?adrenalina=1 l’isola è chiusa');
    await d.page.click('#mzAdrenalinaVai');
    await ctx.waitState(d.page, (st) => st.adrenalina.near === true, 10000);
    await hook(d.page, 'setZoom', 1.6);
    await d.page.waitForTimeout(900);
    await ctx.shot(d.page, 'desktop_cancello');
    await budget(d.page, 'desktop_cancello');
    await d.page.keyboard.down('KeyE'); await d.page.waitForTimeout(80); await d.page.keyboard.up('KeyE'); // A sul PC
    await ctx.waitState(d.page, (st) => st.adrenalina.salite >= 1 || st.adrenalina.liberatoria, 5000).catch(() => {});
    ctx.noErrors(d, 'desktop');
  });

  // ---------------- server ----------------
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4adr-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (x) => (log += x)); dev.stderr.on('data', (x) => (log += x));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = { 'x-token': 'tokA', 'content-type': 'application/json' };
    const post = async (pp, b) => { const r = await fetch(base + pp, { method: 'POST', headers: hdr, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const lot = async () => (await (await fetch(base + '/api/lot', { headers: hdr })).json());

    await ctx.test('server: la liberatoria si firma una volta sola e resta nel lotto; senza token 401', async () => {
      assert(!((await lot()).liberatorie ?? []).includes('adrenalina'), 'firmata prima di firmare');
      const r1 = await post('/api/adrenalina/liberatoria');
      assert(r1.status === 200 && r1.body.nuova === true && r1.body.lot.liberatorie.includes('adrenalina'), 'prima firma: ' + JSON.stringify(r1.body).slice(0, 200));
      const r2 = await post('/api/adrenalina/liberatoria');
      assert(r2.status === 200 && r2.body.nuova === false, 'seconda firma: ' + JSON.stringify(r2.body).slice(0, 200));
      const l = await lot();
      assert(l.liberatorie.filter((x) => x === 'adrenalina').length === 1, `lotto dopo due firme: ${JSON.stringify(l.liberatorie)}`); // la versione no: la lettura del lotto fa avanzare la produzione
      const anon = await fetch(base + '/api/adrenalina/liberatoria', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      assert(anon.status === 401, 'senza token: ' + anon.status);
    });
    await ctx.test('server: nessun errore interno nel log di wrangler', async () => {
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
