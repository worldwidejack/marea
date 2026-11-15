// Dungeon in prima persona alla Skyrim (docs/PRIMA_PERSONA.md), su wrangler dev locale come m2_dungeon: si entra nella Grotta e il
// client manda da solo l'azione `fruga`; minimappa in alto a sinistra (niente bussola), barre in basso, mirino; l'autopilota combatte finché un cadavere non sta a portata
// (il bottino non si raccoglie più passandoci sopra); lo si guarda, E apre la finestra (la partita si ferma), R prende tutto; un colpo con
// lo sguardo in basso manda anche l'alzo (log formato 5); poi l'autopilota fino alla scala: il server rigioca input e azioni e l'hash coincide,
// il bottino frugato arriva nel lotto. Screenshot 1280×720 in tests/out/shots/m2_prima_persona_*.png.
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
  const persist = path.join(ctx.OUT, `m2pp-${process.pid}`);
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
    /** Gira lo sguardo sul cadavere `c` a terra: il mirino sta al centro del suo corpo come si vede (occhi a 1,4 m). Il bottino sta dove è caduto, il corpo si stende da lì. */
    const guardaCorpo = async (c) => { const q = await st(), f = q.fp, k = q.fruga.forme?.[c.id] ?? c; await guarda(k.x, k.z, -Math.atan2(1.4, Math.hypot(k.x - f.hero.x, k.z - f.hero.z))); };
    let before = null, preso = null;

    await ctx.test('Grotta in prima persona: si entra frugando a mano; minimappa in alto a sinistra, barre in basso, mirino sempre', async () => {
      before = await getLot('tokA');
      const g = (await st()).ingressi.spots.find((x) => x.id === 'grotta');
      await hook('teleport', g.x, g.z + 3); await sleep(900);
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play' && s.fp && s.fp.fruga, 60000);
      await sleep(600);
      const s = await st();
      assert(s.dungeon.azioni >= 1, `l'azione fruga non è registrata: ${s.dungeon.azioni}`);
      assert(s.mappaFp && s.mappaFp.minimappa && s.mappaFp.viste > 0, 'minimappa senza celle viste: ' + JSON.stringify(s.mappaFp));
      const r = await page.evaluate(() => {
        const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vis: getComputedStyle(e).display !== 'none' }; };
        return { bus: box('.mz-fp-bus'), mini: box('.mz-fp-mini'), hud: box('#mzDngHud'), mir: box('.mz-fp-mirino'), H: innerHeight };
      });
      assert(!r.bus, 'la bussola c’è ancora');
      assert(r.mini?.vis && r.mini.x < 20 && r.mini.y < 20 && r.mini.w <= 130, 'minimappa: ' + JSON.stringify(r.mini));
      assert(r.hud && r.hud.y > r.H * 0.75, 'le barre non sono in basso: ' + JSON.stringify(r.hud));
      assert(r.mir?.vis, 'mirino non visibile');
      await ctx.shot(page, '1_ingresso_1280');
    });

    await ctx.test('un cadavere resta a terra: guardato da vicino compare «Fruga», E apre la finestra (ferma), R prende tutto', async () => {
      // l'autopilota combatte (ma non raccoglie: chi fruga a mano no) finché un cadavere pieno non sta a portata
      await hook('dungeonAutopilot', true, 1);
      await ctx.waitState(page, (s) => s.fp && s.fp.bottini.some((b) => b.tipo === 'cadavere' && !b.vuoto && b.d < 6), 150000);
      await hook('dungeonAutopilot', false); await sleep(300);
      let s = await st();
      const cad = s.fp.bottini.find((b) => b.tipo === 'cadavere' && !b.vuoto && b.d < 6);
      // un passo verso il cadavere, finché la mano ci arriva
      await hook('dungeonVai', Math.floor(cad.x / 2), Math.floor(cad.z / 2));
      await ctx.waitState(page, (s, id) => (s.fp.bottini.find((b) => b.id === id)?.d ?? 99) < 1.6, 15000, cad.id);
      await hook('dungeonVai', null, null); await sleep(500);
      await guardaCorpo(cad);
      await ctx.waitState(page, (s, id) => s.fruga && s.fruga.mira && s.fruga.mira.id === id, 4000, cad.id);
      // e con lo sguardo dritto all'orizzonte il cadavere non è sotto il mirino
      await guarda(cad.x, cad.z, 0);
      await ctx.waitState(page, (s) => s.fruga && !s.fruga.mira, 4000);
      await guardaCorpo(cad);
      await ctx.waitState(page, (s, id) => s.fruga && s.fruga.mira && s.fruga.mira.id === id, 4000, cad.id);
      await ctx.shot(page, '2_cadavere_1280');
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s, id) => s.fruga.aperto === id && s.dungeon.pannello, 3000, cad.id);
      s = await st();
      assert(s.fruga.righe.length > 0, 'finestra vuota');
      const t0 = s.dungeon.tick;
      await sleep(500);
      assert((await st()).dungeon.tick === t0, 'con la finestra aperta la partita va avanti');
      await ctx.shot(page, '3_finestra_1280');
      const zaino0 = s.dungeon.zaino;
      await page.keyboard.press('KeyR');
      await ctx.waitState(page, (s, id) => !s.fruga.aperto && !s.dungeon.pannello && s.fp.bottini.find((b) => b.id === id)?.vuoto, 3000, cad.id);
      s = await st();
      const presi = Object.entries(s.dungeon.zaino.bottino).filter(([k, n]) => n > (zaino0.bottino[k] ?? 0));
      assert(presi.length > 0 || s.dungeon.zaino.monete > zaino0.monete, 'R non ha preso niente: ' + JSON.stringify(s.dungeon.zaino));
      preso = { bottino: Object.fromEntries(presi), monete: s.dungeon.zaino.monete };
    });

    await ctx.test('un colpo con lo sguardo in basso porta l\'alzo; poi alla scala: il server rigioca e l\'hash coincide, il bottino è nel lotto', async () => {
      const f = (await st()).fp;
      await hook('dungeonGuarda', f.yaw, -0.4);
      await page.keyboard.down('Space'); await sleep(120); await page.keyboard.up('Space'); await sleep(700);
      await hook('dungeonAutopilot', true, 12);
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 200000);
      const s = await st(), r = s.ingressi.lastResult;
      ctx.log(`esito ${r.outcome} · tenuto ${JSON.stringify(r.tenuto)} · hash server ${r.hash} client ${r.clientHash}`);
      assert(r.hash === r.clientHash, `hash del server ${r.hash} ≠ client ${r.clientHash}: il replay con fruga, prendi e alzo non coincide`);
      if (r.outcome === 'uscito') {
        const after = await getLot('tokA');
        for (const [id, n] of Object.entries(preso.bottino)) {
          const had = before.hero?.inv?.[id] ?? 0, has = after.hero?.inv?.[id] ?? 0;
          assert(has >= had + n - ((r.usati?.[id] ?? 0) + (r.rotti?.[id] ?? 0)), `${id}: prima ${had}, frugati ${n}, adesso ${has}`);
        }
      }
      await ctx.shot(page, '4_esito_1280');
      await page.locator('#mzDngEsito [data-act="ok"]').click();
      await hook('dungeonAutopilot', false);
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
