// Cantina e secondo piano (#386) sul server locale (wrangler dev, TEST_CLOCK:1). Il lotto di Luca viene portato al livello giusto scrivendo lo stato nel
// DO (node:sqlite, a server fermo: comprare tutti gli ampliamenti con le Regate richiederebbe centinaia di partite) e con un mobile per piano.
// Poi, nel browser: le scale si prendono camminandoci sopra (velo): dal piano terra si scende nella cantina e si risale, si sale al secondo piano e
// si torna giù; ogni stanza ha la sua inquadratura fissa e i suoi mobili (quelli degli altri piani non si vedono).
// Screenshot: la scala giù e su nel piano terra, la cantina arredata, il secondo piano (PC e telefono).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Tutti i file .sqlite sotto una cartella. */
const sqlites = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sqlites(path.join(d, e.name)) : e.name.endsWith('.sqlite') ? [path.join(d, e.name)] : []));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3cantina-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const borgo = read('borgo.json'), arch = read('archipelago.json'), mobili = read('mobili.json').mobili;
  const SLOT = 0, ORIG = arch.islands.find((i) => i.role === 'lotto' && i.slot === SLOT).at;
  const mondo = (cx, cz) => ({ x: (ORIG[0] + cx + 0.5) * 2, z: (ORIG[1] + cz + 0.5) * 2 });
  const livelli = borgo.casa.livelli, scale = borgo.casa.scale, MAX = livelli.length;
  const rect = (id, liv) => { let r = id === 'terra' ? borgo.stanza.pavimento : null; for (const l of livelli.slice(0, liv)) if (l.stanza === id) r = l.pavimento; return r; };
  const giu = scale.find((s) => s.stanza === 'terra' && s.verso === 'giu'), su = scale.find((s) => s.stanza === 'terra' && s.verso === 'su');
  const suCantina = scale.find((s) => s.stanza === 'cantina'), giuPiano = scale.find((s) => s.stanza === 'piano');
  const mobile = mobili.find((m) => m.posto === 'terra' && !m.celle);

  let dev = null, log = '';
  const pages = [];
  const parti = async () => {
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    return base;
  };
  const ferma = async () => {
    if (!dev) return;
    try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ }
    await sleep(800);
    try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ }
    await sleep(800);
    dev = null;
  };
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0);");
    // 1) il lotto nasce (primo GET), 2) a server fermo gli si scrive la casa al livello massimo con un mobile per piano, 3) si riparte
    let BASE = await parti();
    assert((await fetch(BASE + '/api/lot', { headers: { 'x-token': 'tokL' } })).ok, 'primo /api/lot');
    await ferma();
    const arredi = [
      { id: 'prova-1', mobile: mobile.id, cell: [rect('cantina', MAX)[0] + 1, rect('cantina', MAX)[1] + 1] },
      { id: 'prova-2', mobile: mobile.id, cell: [rect('piano', MAX)[0] + 1, rect('piano', MAX)[1] + 1] },
      { id: 'prova-3', mobile: mobile.id, cell: [rect('terra', MAX)[0] + 1, rect('terra', MAX)[1] + 1] },
    ];
    let fatto = 0;
    for (const f of sqlites(persist)) {
      const db = new DatabaseSync(f);
      try {
        if (!db.prepare("SELECT name FROM sqlite_master WHERE name = 'stato'").get()) continue;
        const riga = db.prepare('SELECT json FROM stato WHERE k = 1').get();
        if (!riga) continue;
        const lot = JSON.parse(riga.json);
        lot.casa = { ...(lot.casa ?? {}), livello: MAX, arredi };
        db.prepare('UPDATE stato SET json = ? WHERE k = 1').run(JSON.stringify(lot));
        fatto++;
      } finally { db.close(); }
    }
    assert(fatto >= 1, 'nessun lotto trovato nei file del DO');
    BASE = await parti();
    const lotSrv = await (await fetch(BASE + '/api/lot', { headers: { 'x-token': 'tokL' } })).json();
    assert(lotSrv.casa?.livello === MAX && lotSrv.casa.arredi.length === 3, 'stato scritto: ' + JSON.stringify(lotSrv.casa));

    const st = (page) => ctx.getState(page);
    const fine = (page) => page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 8000 });
    const hook = (page, n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const giro = async (vp, nome) => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=tokL&test=1`, { viewport: vp });
      pages.push(pg); ctx._pages.push(pg);
      const page = pg.page;
      await ctx.waitReady(page, 30000);
      await ctx.waitState(page, (s) => s.lot && s.lot.ready, 30000);

      await ctx.test(`${nome}: la casa è al livello del secondo piano; si entra e nel piano terra si vedono le scale`, async () => {
        await hook(page, 'porta', SLOT);
        await ctx.waitState(page, (s, slot) => s.stanza.dentro === slot, 15000, SLOT);
        await fine(page);
        const q = await st(page);
        assert(q.stanza.stanza === 'terra' && q.stanza.livello === MAX, 'stanza: ' + JSON.stringify(q.stanza));
        assert(JSON.stringify(q.stanza.pianta) === JSON.stringify(rect('terra', MAX)), 'pianta: ' + JSON.stringify(q.stanza.pianta));
        assert(q.stanza.camera && Math.abs(q.stanza.camera.yaw) < 1e-6, 'camera fissa: ' + JSON.stringify(q.stanza.camera));
        await ctx.waitState(page, (s) => s.stanza.arrediVisibili.length > 0, 10000); // le forme dei mobili si caricano a parte
        assert((await st(page)).stanza.arrediVisibili.every((x) => x === 'terra'), 'mobili visibili al piano terra: ' + JSON.stringify((await st(page)).stanza.arrediVisibili));
        await page.waitForTimeout(800);
        await ctx.shot(page, `${nome}_terra`);
      });

      await ctx.test(`${nome}: camminando sulla scala giù si scende in cantina (velo, altra stanza, camera fissa) e lì c’è solo il suo mobile`, async () => {
        const c = mondo(giu.cell[0], giu.cell[1]);
        await hook(page, 'teleport', c.x, c.z);
        await ctx.waitState(page, (s) => s.stanza.stanza === 'cantina', 10000);
        await fine(page);
        await page.waitForTimeout(1500); // niente rimbalzo: si resta giù
        const q = await st(page), arrivo = mondo(giu.arrivo[0], giu.arrivo[1]);
        assert(q.stanza.stanza === 'cantina' && q.velo.passaggi >= 1, 'in cantina: ' + JSON.stringify({ s: q.stanza.stanza, v: q.velo }));
        assert(Math.hypot(q.avatar.x - arrivo.x, q.avatar.z - arrivo.z) < 1.2, 'arrivo davanti alla scala: ' + JSON.stringify(q.avatar));
        assert(JSON.stringify(q.stanza.pianta) === JSON.stringify(rect('cantina', MAX)), 'pianta cantina: ' + JSON.stringify(q.stanza.pianta));
        assert(q.stanza.camera && Math.abs(q.stanza.camera.yaw) < 1e-6, 'camera fissa in cantina: ' + JSON.stringify(q.stanza.camera));
        await ctx.waitState(page, (s) => s.stanza.arrediVisibili.length > 0, 10000);
        assert((await st(page)).stanza.arrediVisibili.every((x) => x === 'cantina'), 'mobili visibili in cantina: ' + JSON.stringify((await st(page)).stanza.arrediVisibili));
        await ctx.shot(page, `${nome}_cantina`);
      });

      await ctx.test(`${nome}: dalla scala su della cantina si risale nel piano terra, davanti alla scala giù`, async () => {
        const c = mondo(suCantina.cell[0], suCantina.cell[1]);
        await hook(page, 'teleport', c.x, c.z);
        await ctx.waitState(page, (s) => s.stanza.stanza === 'terra', 10000);
        await fine(page);
        await page.waitForTimeout(1200);
        const q = await st(page), arrivo = mondo(suCantina.arrivo[0], suCantina.arrivo[1]);
        assert(q.stanza.stanza === 'terra' && Math.hypot(q.avatar.x - arrivo.x, q.avatar.z - arrivo.z) < 1.2, 'di nuovo su: ' + JSON.stringify({ s: q.stanza.stanza, a: q.avatar }));
      });

      await ctx.test(`${nome}: la scala su porta al secondo piano e lì si torna giù`, async () => {
        const c = mondo(su.cell[0], su.cell[1]);
        await hook(page, 'teleport', c.x, c.z);
        await ctx.waitState(page, (s) => s.stanza.stanza === 'piano', 10000);
        await fine(page);
        await page.waitForTimeout(1200);
        let q = await st(page);
        assert(q.stanza.stanza === 'piano' && JSON.stringify(q.stanza.pianta) === JSON.stringify(rect('piano', MAX)), 'secondo piano: ' + JSON.stringify(q.stanza));
        await ctx.waitState(page, (s) => s.stanza.arrediVisibili.length > 0, 10000);
        assert((await st(page)).stanza.arrediVisibili.every((x) => x === 'piano'), 'mobili visibili al secondo piano: ' + JSON.stringify((await st(page)).stanza.arrediVisibili));
        await ctx.shot(page, `${nome}_piano`);
        const d = mondo(giuPiano.cell[0], giuPiano.cell[1]);
        await hook(page, 'teleport', d.x, d.z);
        await ctx.waitState(page, (s) => s.stanza.stanza === 'terra', 10000);
        await fine(page);
        q = await st(page);
        assert(q.stanza.stanza === 'terra', 'tornato al piano terra: ' + q.stanza.stanza);
      });
      ctx.noErrors(pg, nome);
    };
    await giro(ctx.B.DESKTOP, 'pc');
    await giro(ctx.B.IPHONE, 'telefono');
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    await ferma();
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
