// WP4 rete: wrangler dev locale (D1 + DO Zone/Lot) con il client costruito, API HTTP, WebSocket grezzi (limiti) e due browser che si vedono.
// Stato locale isolato in tests/out/wp4-<pid> (niente collisioni con altri agenti né con `npm run dev:server`).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 240000;

/** Celle `L` (slot edificio) del template `lotto` (islands.json); senza template due celle qualsiasi. */
function slotCells(root) {
  const isl = JSON.parse(fs.readFileSync(path.join(root, 'packages/content/src/islands.json'), 'utf8')).find((i) => i.id === 'lotto');
  if (!isl) return [[3, 4], [5, 4]];
  const out = [];
  isl.rows.forEach((row, z) => { for (let x = 0; x < row.length; x++) if (row[x] === 'L') out.push([x, z]); });
  return out;
}
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `wp4-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token) VALUES ('uno', 'Uno', 'tok1'), ('due', 'Due', 'tok2');");

    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    await ctx.test('api: me, look, lot, token sbagliato, no-store', async () => {
      const r = await fetch(base + '/api/me', { headers: { 'x-token': 'tok1' } });
      ctx.assert(r.headers.get('cache-control') === 'no-store', 'manca cache-control no-store');
      const me = await r.json();
      ctx.assert(me.id === 'uno' && me.lotto && me.lotto.owner === 'uno', 'me incompleto: ' + JSON.stringify(me).slice(0, 200));
      ctx.assert((await fetch(base + '/api/me', { headers: { 'x-token': 'no' } })).status === 401, 'token sbagliato accettato');
      const post = (p, b, t = 'tok1') => fetch(base + p, { method: 'POST', headers: { 'x-token': t, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      ctx.assert((await post('/api/look', { pelle: 1, capelli: 2, coloreCapelli: 3, vestito: 4, cappello: 0 })).status === 200, 'look valido rifiutato');
      ctx.assert((await post('/api/look', { pelle: 99, capelli: 2, coloreCapelli: 3, vestito: 4, cappello: 0 })).status === 400, 'look fuori indice accettato');
      ctx.assert((await (await fetch(base + '/api/me', { headers: { 'x-token': 'tok1' } })).json()).look.pelle === 1, 'look non salvato');
      const [c1, c2] = slotCells(ctx.ROOT);
      const b1 = await post('/api/lot/build', { building: 'segheria', cell: c1 });
      ctx.assert(b1.status === 200 && (await b1.json()).construction, 'build non avviata');
      const b2 = await post('/api/lot/build', { building: 'cava', cell: c2 });
      ctx.assert(b2.status === 409 && (await b2.json()).error, 'secondo cantiere non rifiutato con 409');
      ctx.assert((await fetch(base + '/api/lot/due', { headers: { 'x-token': 'tok1' } })).status === 200, 'isola altrui non leggibile');
      // senza TEST_CLOCK (come in produzione) l'orologio di test è ignorato
      const ping = await (await fetch(base + '/api/ping', { headers: { 'x-test-now-offset': String(10 * 86_400_000) } })).json();
      ctx.assert(Math.abs(ping.now - Date.now()) < 60_000, 'X-Test-Now-Offset accettato senza TEST_CLOCK');
    });

    const wsUrl = (t) => `ws://127.0.0.1:${port}/ws/zone/porto?t=${t}`;
    const openWs = (t) => new Promise((res, rej) => {
      const w = new WebSocket(wsUrl(t)); w.msgs = []; w.closed = null;
      w.onmessage = (e) => w.msgs.push(JSON.parse(e.data)); w.onclose = (e) => (w.closed = e.code); w.onerror = () => {};
      w.onopen = () => { w.send(JSON.stringify({ t: 'hello', v: 1, build: 'test' })); res(w); };
      setTimeout(() => rej(new Error('ws timeout')), 5000);
    });
    await ctx.test('ws: token sbagliato → error token', async () => {
      const w = await openWs('sbagliato'); await sleep(400);
      ctx.assert(w.msgs[0]?.t === 'error' && w.msgs[0].code === 'token', 'atteso error token: ' + JSON.stringify(w.msgs));
    });
    await ctx.test('ws: snap a ~10 Hz con delta, now ovunque, >2 KB chiude, doppia connessione chiude la vecchia', async () => {
      const a = await openWs('tok1'); await sleep(200); const b = await openWs('tok2'); await sleep(300);
      ctx.assert(b.msgs[0]?.t === 'welcome' && b.msgs[0].peers.length === 1, 'welcome senza peer');
      ctx.assert(a.msgs.some((m) => m.t === 'join' && typeof m.now === 'number'), 'join senza now');
      b.msgs.length = 0;
      for (let i = 0; i < 50; i++) { a.send(JSON.stringify({ t: 'pos', x: 10 + i * 0.1, z: 10, yaw: 0, mode: 'walk', anim: 'walk' })); await sleep(20); }
      await sleep(250);
      const snaps = b.msgs.filter((m) => m.t === 'snap');
      ctx.log(`snap ricevuti in ~1,2 s: ${snaps.length}`);
      ctx.assert(snaps.length >= 7 && snaps.length <= 15, `snap non a 10 Hz: ${snaps.length}`);
      ctx.assert(snaps.every((s) => s.peers.length === 1 && s.peers[0].id === 'uno'), 'snap con peer non cambiati');
      ctx.assert(Math.abs(snaps.at(-1).peers[0].x - 14.9) < 0.3, 'ultima x sbagliata ' + snaps.at(-1).peers[0].x);
      b.msgs.length = 0; await sleep(400);
      ctx.assert(!b.msgs.some((m) => m.t === 'snap'), 'snap senza cambiamenti');
      const a2 = await openWs('tok1'); await sleep(400);
      ctx.assert(a.closed === 4000, 'vecchia connessione non chiusa: ' + a.closed);
      ctx.assert(!b.msgs.some((m) => m.t === 'leave'), 'leave spurio alla sostituzione');
      a2.send(JSON.stringify({ t: 'ping', c: 1, pad: 'x'.repeat(3000) })); await sleep(400);
      ctx.assert(a2.closed === 1009, 'messaggio da 3 KB non ha chiuso: ' + a2.closed);
      ctx.assert(b.msgs.some((m) => m.t === 'leave' && m.id === 'uno'), 'manca leave');
      b.close(); await sleep(200);
    });

    const pa = await ctx.B.openPage(ctx.browser, `${base}/?t=tok1&test=1`); pages.push(pa);
    const pb = await ctx.B.openPage(ctx.browser, `${base}/?t=tok2&test=1`); pages.push(pb);
    await ctx.test('due browser: net on e si vedono', async () => {
      await ctx.waitReady(pa.page, 15000); await ctx.waitReady(pb.page, 15000);
      await ctx.waitState(pa.page, (s) => s.net.status === 'on' && s.net.peers === 1, 10000);
      await ctx.waitState(pb.page, (s) => s.net.status === 'on' && s.net.peers === 1, 10000);
    });
    await ctx.test('A cammina, B vede la posizione cambiare (interpolata)', async () => {
      await pa.page.evaluate(() => { const s = window.__game.state().island.spawn; window.__game.test.teleport(s.x, s.z); });
      await sleep(400);
      const before = (await ctx.getState(pb.page)).netPeers[0];
      // tasto premuto finché A non ha fatto 1,5 m (non un tempo fisso: con due browser in SwiftShader si va a 1-2 fps), poi B deve raggiungerlo
      await pa.page.bringToFront(); // la scheda in secondo piano ha requestAnimationFrame fermo: la sim di A non girerebbe
      const start = (await ctx.getState(pa.page)).avatar;
      await pa.page.keyboard.down('ArrowUp');
      try { await ctx.waitState(pa.page, (s, o) => Math.hypot(s.avatar.x - o.x, s.avatar.z - o.z) > 1.5, 20000, { x: start.x, z: start.z }); } finally { await pa.page.keyboard.up('ArrowUp'); }
      await ctx.waitState(pa.page, (s) => Math.hypot(s.avatar.vx, s.avatar.vz) < 0.01, 10000); // A ha finito di frenare
      const me = (await ctx.getState(pa.page)).avatar;
      await ctx.waitState(pb.page, (s, o) => { const p = s.netPeers[0]; return !!p && Math.hypot(p.x - o.x, p.z - o.z) < 0.2; }, 10000, { x: me.x, z: me.z }).catch(() => {});
      const after = (await ctx.getState(pb.page)).netPeers[0];
      ctx.log(`B vede A: (${before.x},${before.z}) → (${after.x},${after.z}); A è a (${me.x.toFixed(2)},${me.z.toFixed(2)}); interpolata ${JSON.stringify(after.at)}`);
      ctx.assert(Math.hypot(after.x - before.x, after.z - before.z) > 0.5, 'B non vede A muoversi');
      ctx.assert(Math.hypot(after.x - me.x, after.z - me.z) < 0.2, 'posizione vista da B lontana da quella vera');
      ctx.assert(after.at && Math.hypot(after.at.x - me.x, after.at.z - me.z) < 0.5, 'peerAt non converge');
      const drawn = (await ctx.getState(pb.page)).peersDrawn ?? [];
      ctx.log('B disegna: ' + JSON.stringify(drawn));
      ctx.assert(drawn.length === 1 && drawn[0].walk && Math.hypot(drawn[0].x - after.at.x, drawn[0].z - after.at.z) < 0.5, 'B non disegna l\'avatar di A dove dovrebbe');
      ctx.noErrors(pa, 'A'); ctx.noErrors(pb, 'B');
    });
    await ctx.shot(pb.page, 'b_vede_a');
    await ctx.test('A sale in barca, B vede la barca col guidatore', async () => {
      await pa.page.bringToFront();
      await pa.page.evaluate(() => window.__game.test.setMode('boat'));
      await pa.page.keyboard.down('ArrowUp'); await sleep(1500); await pa.page.keyboard.up('ArrowUp');
      await ctx.waitState(pb.page, (s) => (s.peersDrawn ?? [])[0]?.boat === true && (s.peersDrawn ?? [])[0]?.walk === false, 10000);
      const b = (await ctx.getState(pa.page)).boat;
      await pb.page.evaluate((p) => window.__game.test.teleport(p.x + 3, p.z + 3), { x: b.x, z: b.z }); await sleep(800);
      ctx.noErrors(pa, 'A'); ctx.noErrors(pb, 'B');
    });
    await ctx.shot(pb.page, 'b_vede_a_in_barca');
    await ctx.test('A chiude, B riceve leave', async () => {
      await pa.close(); pages.splice(pages.indexOf(pa), 1);
      await ctx.waitState(pb.page, (s) => s.net.peers === 0, 5000);
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
