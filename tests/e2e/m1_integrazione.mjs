// M1 · Fetta 1, integrazione (WP0): il client vero (main.ts) col server vero. Una persona col suo slot entra dal link, nasce sulla
// propria isola, vede la barra risorse e la bussola, costruisce; l'isola di un'altra persona si vede in sola lettura.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1int-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 2), ('bea', 'Bea', 'tokB', 3);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    // Bea costruisce una Segheria via API, così Ada ha qualcosa da vedere sulla sua isola
    const me = await (await fetch(base + '/api/me', { headers: { 'x-token': 'tokB' } })).json();
    const cell = me.lotto && (await fetch(base + '/api/lot/build', { method: 'POST', headers: { 'x-token': 'tokB', 'content-type': 'application/json' }, body: JSON.stringify({ building: 'segheria', cell: [6, 10] }) })).status;
    ctx.log(`Bea: slot ${me.slot}, build segheria → ${cell}`);

    const pa = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1`); pages.push(pa);
    await ctx.test('Ada entra dal link e nasce sulla sua isola (slot 2)', async () => {
      await ctx.waitReady(pa.page, 20000);
      const s = await ctx.getState(pa.page);
      ctx.log(`arch ${JSON.stringify(s.arch)} · avatar (${s.avatar.x.toFixed(1)}, ${s.avatar.z.toFixed(1)})`);
      ctx.assert(s.arch && s.arch.slot === 2, 'slot sbagliato: ' + JSON.stringify(s.arch));
      ctx.assert(s.arch.place && String(JSON.stringify(s.arch.place)).includes('lotto'), 'non è su un lotto: ' + JSON.stringify(s.arch.place));
    });
    await ctx.test('barra risorse e lotto pronti, bussola verso Porto', async () => {
      await ctx.waitState(pa.page, (s) => s.lot && s.lot.ready === true, 15000);
      const s = await ctx.getState(pa.page);
      ctx.assert(s.lot.resources.legno > 0, 'risorse assenti: ' + JSON.stringify(s.lot.resources));
      const txt = await pa.page.evaluate(() => document.getElementById('compass')?.innerText ?? '');
      ctx.log('bussola: ' + txt.replace(/\n/g, ' · '));
      ctx.assert(/Porto \d+ m/.test(txt), 'bussola senza Porto');
    });
    await ctx.shot(pa.page, 'm1_int_spawn_lotto');
    await ctx.test('l\'isola di Bea (slot 3) si vede in sola lettura con la sua Segheria', async () => {
      await ctx.waitState(pa.page, (s) => { const v = s['lot:bea']; return !!v && v.ready === true; }, 15000);
      const v = (await ctx.getState(pa.page))['lot:bea'];
      ctx.log(`lot:bea ${JSON.stringify(v.buildings.map((b) => b.building))}`);
      ctx.assert(v.buildings.some((b) => b.building === 'segheria'), 'la Segheria di Bea non si vede');
      await pa.page.evaluate(() => window.__game.test.goto('lotto:3')); await sleep(1500);
    });
    await ctx.shot(pa.page, 'm1_int_isola_di_bea');
    await ctx.test('in mare la bussola indica Casa e Porto', async () => {
      await pa.page.evaluate(() => window.__game.test.goto('laguna')); await sleep(800);
      const txt = await pa.page.evaluate(() => document.getElementById('compass')?.innerText ?? '');
      ctx.log('bussola in laguna: ' + txt.replace(/\n/g, ' · '));
      ctx.assert(/Casa \d+ m/.test(txt) && /Porto \d+ m/.test(txt), 'bussola incompleta: ' + txt);
      ctx.noErrors(pa, 'Ada');
    });
    await ctx.shot(pa.page, 'm1_int_bussola');
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
