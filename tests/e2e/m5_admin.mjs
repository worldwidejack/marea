// Inviti e link personali per chi sviluppa: rotte /api/admin/* e script admin.mjs sul server locale vero (wrangler dev, niente browser).
// Chi non è admin viene respinto; un admin crea un invito di gruppo che funziona, ritrova (e se serve cambia) il link di un personaggio,
// promuove un altro dev; nome doppio → scelta per id; non ci si toglie da soli il ruolo.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m5admin-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const invita = (nome, id, token, ...extra) => execFileSync(process.execPath, [path.join(SERVER, 'scripts/invita.mjs'), nome, '--id', id, '--token', token, ...extra, '--persist-to', persist], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
    invita('Dev', 'dev', 'tokDev', '--admin'); invita('Helga', 'helga-1', 'tokHelga'); invita('Gio', 'gio-1', 'tokGio1'); invita('Gio', 'gio-2', 'tokGio2'); invita('Albi', 'albi', 'tokAlbi');

    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { 'x-token': t } : {}) }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const tokenDi = (url) => new URL(url).searchParams.get('t');

    await ctx.test('chi non è admin (o senza link) è respinto', async () => {
      assert((await post('/api/admin/invito', 'tokHelga', {})).status === 403, 'non admin: invito');
      assert((await post('/api/admin/link', 'tokHelga', { persona: 'dev' })).status === 403, 'non admin: link');
      assert((await post('/api/admin/admin', 'tokHelga', { persona: 'helga-1' })).status === 403, 'non admin: autopromozione');
      assert((await post('/api/admin/invito', null, {})).status === 401, 'senza token');
    });

    await ctx.test('invito di gruppo: l\'admin lo crea, un amico entra col nome e ha la sua isola; oltre gli usi si ferma', async () => {
      assert((await post('/api/admin/invito', 'tokDev', { usi: 0 })).status === 400 && (await post('/api/admin/invito', 'tokDev', { usi: 51 })).status === 400, 'usi fuori range accettati');
      const r = await post('/api/admin/invito', 'tokDev', { usi: 1 });
      assert(r.status === 200 && r.body.url.startsWith(base + '/?invito='), 'invito: ' + JSON.stringify(r.body));
      const e = await post('/api/entra', null, { invito: r.body.codice, nome: 'Nuova' });
      assert(e.status === 200 && e.body.token, 'entra: ' + JSON.stringify(e.body));
      assert((await post('/api/entra', null, { invito: r.body.codice, nome: 'Altra' })).status === 403, 'invito da 1 uso valso due volte');
    });

    await ctx.test('link: l\'admin ritrova quello di Helga (nome senza maiuscole), che apre davvero; --ruota lo cambia e il vecchio non vale più', async () => {
      const r = await post('/api/admin/link', 'tokDev', { persona: 'helga' });
      assert(r.status === 200 && tokenDi(r.body.url) === 'tokHelga' && r.body.id === 'helga-1', 'link: ' + JSON.stringify(r.body));
      const nuovo = await post('/api/admin/link', 'tokDev', { persona: 'helga-1', ruota: true });
      const t = tokenDi(nuovo.body.url);
      assert(nuovo.status === 200 && t && t !== 'tokHelga', 'token non cambiato');
      const me = await fetch(base + '/api/me', { headers: { 'x-token': t } });
      assert(me.status === 200, '/api/me col link nuovo: ' + me.status);
      assert((await fetch(base + '/api/me', { headers: { 'x-token': 'tokHelga' } })).status === 401, 'il vecchio link vale ancora');
    });

    await ctx.test('nomi: sconosciuto 404, doppio 409 con la lista, id esatto funziona', async () => {
      assert((await post('/api/admin/link', 'tokDev', { persona: 'Nessuno' })).status === 404, 'sconosciuto');
      const d = await post('/api/admin/link', 'tokDev', { persona: 'gio' });
      assert(d.status === 409 && d.body.scelte.length === 2, 'doppio: ' + JSON.stringify(d.body));
      assert((await post('/api/admin/link', 'tokDev', { persona: 'gio-2' })).status === 200, 'id esatto');
    });

    await ctx.test('admin: promuovere Albi gli dà gli stessi poteri; non ci si toglie da soli; togliere funziona', async () => {
      assert((await post('/api/admin/invito', 'tokAlbi', {})).status === 403, 'Albi già admin?');
      assert((await post('/api/admin/admin', 'tokDev', { persona: 'albi' })).body.admin === true, 'promozione');
      assert((await post('/api/admin/invito', 'tokAlbi', {})).status === 200, 'Albi non può creare inviti');
      assert((await post('/api/admin/admin', 'tokAlbi', { persona: 'albi', admin: false })).status === 400, 'si è tolto da solo');
      assert((await post('/api/admin/admin', 'tokDev', { persona: 'albi', admin: false })).body.admin === false, 'revoca');
      assert((await post('/api/admin/invito', 'tokAlbi', {})).status === 403, 'revoca non efficace');
    });

    await ctx.test('script admin.mjs: stampa il link, e dice chiaro cosa manca', async () => {
      const run = (extra, home, daFile = false) => { try { return { ok: true, out: execFileSync(process.execPath, [path.join(SERVER, 'scripts/admin.mjs'), ...extra, '--url', base], { env: { ...env, HOME: home, MAREA_TOKEN: home === '/nonexistent' || daFile ? '' : `${base}/?t=tokDev` }, stdio: ['ignore', 'pipe', 'pipe'] }).toString() }; } catch (e) { return { ok: false, out: String(e.stderr) }; } };
      const ok = run(['link', 'Helga'], ctx.OUT);
      assert(ok.ok && ok.out.includes('/?t='), 'script link: ' + ok.out);
      fs.mkdirSync(path.join(ctx.OUT, 'casa/.config/marea'), { recursive: true });
      fs.writeFileSync(path.join(ctx.OUT, 'casa/.config/marea/link.txt'), `MAREA — link personale (commento)\n${base}/?t=tokDev\n`);
      const daFile = run(['link', 'Helga'], path.join(ctx.OUT, 'casa'), true);
      assert(daFile.ok && daFile.out.includes('/?t='), 'file con riga di commento: ' + daFile.out);
      const senza = run(['link', 'Helga'], '/nonexistent');
      assert(!senza.ok && senza.out.includes('link personale'), 'senza link: ' + senza.out);
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* già fermo */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
