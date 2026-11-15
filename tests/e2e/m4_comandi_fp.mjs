// Controller nel dungeon in prima persona, su wrangler dev locale come m2_prima_persona: lo stick destro gira la visuale (e non
// fa attaccare), X apre il bottino sotto il mirino (come E) e Y lo prende (come R). Controller finto via navigator.getGamepads.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 360000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WIN = process.platform === 'win32';
  const persist = path.join(ctx.OUT, `m4pad-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, shell: WIN }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const sql = path.join(persist, 'persone.sql');
    fs.mkdirSync(persist, { recursive: true });
    fs.writeFileSync(sql, "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0);\n");
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--file', sql);
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: !WIN, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const getLot = async (t) => (await (await fetch(base + '/api/lot', { headers: { 'x-token': t } })).json());

    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1`, { viewport: ctx.B.DESKTOP }); ctx._pages.push(P);
    const page = P.page;
    if (WIN) await page.route(/\/(api|chunk|assets)/, (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.ingressi, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    /** Gira lo sguardo verso (x, z), con la pendenza `pitch` (rad). */
    const guarda = async (x, z, pitch) => { const f = (await st()).fp; await hook('dungeonGuarda', Math.atan2(-(x - f.hero.x), -(z - f.hero.z)), pitch); await sleep(200); };
    const padFinto = (axes, giu = []) => page.evaluate(([a, g]) => {
      window.__pad = { connected: true, id: 'Controller finto (STANDARD GAMEPAD)', axes: a, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: g.includes(i), value: g.includes(i) ? 1 : 0 })) };
      navigator.getGamepads = () => [window.__pad];
      dispatchEvent(new Event('gamepadconnected'));
    }, [axes, giu]);
    /** Tiene il pulsante giù finché il gioco non lo vede (un giro di rAF è lento sotto SwiftShader), poi lo lascia. */
    const premi = async (b) => { await padFinto([0, 0, 0, 0], [b]); await sleep(900); await padFinto([0, 0, 0, 0], []); await sleep(300); };

    await ctx.test('Grotta in prima persona: lo stick destro gira la visuale (su e giù) e non fa attaccare', async () => {
      const g = (await st()).ingressi.spots.find((x) => x.id === 'grotta');
      await hook('teleport', g.x, g.z + 3); await sleep(900);
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play' && s.fp && s.fp.fruga, 60000);
      await sleep(600);
      const a0 = (await st()).fp, ticks0 = (await st()).dungeon.azioni;
      await padFinto([0, 0, 1, 0]); await sleep(1500); await padFinto([0, 0, 0, 0]); await sleep(300);
      const a1 = (await st()).fp;
      assert(a0.yaw - a1.yaw > 0.4, `lo stick destro in avanti non gira a destra: yaw ${a0.yaw} → ${a1.yaw}`);
      await padFinto([0, 0, 0, -1]); await sleep(1200); await padFinto([0, 0, 0, 0]); await sleep(300);
      const a2 = (await st()).fp;
      assert(a2.pitch - a1.pitch > 0.3, `lo stick destro in su non alza lo sguardo: pitch ${a1.pitch} → ${a2.pitch}`);
      assert((await st()).dungeon.azioni === ticks0, 'lo stick destro ha mandato azioni (attacca?)');
      await ctx.shot(page, '1_stick_destro_1280');
    });

    await ctx.test('un cadavere: X apre la finestra (ferma la partita), Y prende tutto', async () => {
      await hook('dungeonAutopilot', true, 1);
      await ctx.waitState(page, (s) => s.fp && s.fp.bottini.some((b) => b.tipo === 'cadavere' && !b.vuoto && b.d < 6), 150000);
      await hook('dungeonAutopilot', false); await sleep(300);
      let s = await st();
      const cad = s.fp.bottini.find((b) => b.tipo === 'cadavere' && !b.vuoto && b.d < 6);
      await hook('dungeonVai', Math.floor(cad.x / 2), Math.floor(cad.z / 2));
      await ctx.waitState(page, (s, id) => (s.fp.bottini.find((b) => b.id === id)?.d ?? 99) < 1.6, 15000, cad.id);
      await hook('dungeonVai', null, null); await sleep(500);
      { const q = await st(), f = q.fp, k = q.fruga.forme?.[cad.id] ?? cad; await guarda(k.x, k.z, -Math.atan2(1.4, Math.hypot(k.x - f.hero.x, k.z - f.hero.z))); } // il mirino sul corpo a terra (il bottino sta dove è caduto, il corpo si stende da lì)
      await ctx.waitState(page, (s, id) => s.fruga && s.fruga.mira && s.fruga.mira.id === id, 4000, cad.id);
      await premi(2); // X = E
      await ctx.waitState(page, (s, id) => s.fruga.aperto === id && s.dungeon.pannello, 6000, cad.id);
      s = await st();
      const t0 = s.dungeon.tick; await sleep(500);
      assert((await st()).dungeon.tick === t0, 'con la finestra aperta la partita va avanti');
      await ctx.shot(page, '2_finestra_pad_1280');
      const zaino0 = s.dungeon.zaino;
      await premi(3); // Y = R
      await ctx.waitState(page, (s, id) => !s.fruga.aperto && !s.dungeon.pannello && s.fp.bottini.find((b) => b.id === id)?.vuoto, 6000, cad.id);
      s = await st();
      const presi = Object.entries(s.dungeon.zaino.bottino).filter(([k, n]) => n > (zaino0.bottino[k] ?? 0));
      assert(presi.length > 0 || s.dungeon.zaino.monete > zaino0.monete, 'Y non ha preso niente: ' + JSON.stringify(s.dungeon.zaino));
    });
    await ctx.test('nessun errore', async () => { ctx.noErrors(P, 'Ada'); });
  } finally {
    if (dev) {
      if (WIN) { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già chiuso */ } }
      else { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    }
    await sleep(WIN ? 1500 : 500);
    try { fs.rmSync(persist, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* ok su windows */ }
    if (/dungeon hash diverso/.test(log)) console.log('    [m2_prima_persona] il server ha registrato un hash diverso:\n' + log.split('\n').filter((l) => /hash diverso/.test(l)).join('\n'));
  }
}
