// Interfaccia con tutto acceso (bussola, guida, minimappa, barra risorse, bottoni): server locale pulito, Luca entra col suo link con le
// impostazioni di serie su iPhone 390×844, Android piccolo 360×740 e PC 1280×720. Mete aperte e tutte accese, isole a tema scoperte (14
// mete), guida «Primi passi» al primo passo; poi al Porto accanto al Mercante (bottone del Porto) e in barca sul mare da pesca (PESCA).
// In ogni posa: i rettangoli degli elementi fissi non si sovrappongono e stanno dentro lo schermo. Più la guida: si chiude con ×, resta
// chiusa al ricaricamento, e chi aveva fatto i 4 passi vecchi (progresso numerico in localStorage) riparte dai passi nuovi, non da capo.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ANDROID = { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Elementi fissi dell'interfaccia (selettori → nome leggibile). Ognuno conta solo se si vede. */
const FISSI = [
  ['#mzBar > *', 'risorsa'], ['#mzWork', 'cantiere'], ['#mzTop > *', 'bottone in alto'], ['#compass > *', 'bussola'], ['#mzMini', 'minimappa'],
  ['#mzGuida', 'guida'], ['#btnA', 'A'], ['#btnB', 'B'], ['#joystick', 'joystick'], ['#mzPlay', 'GIOCA'], ['#mzPortoBtn', 'Porto'], ['#mzPesca', 'PESCA'], ['#mzPerle', 'TUFFATI'],
];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3interfaccia-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1), ('ugo', 'Ugo', 'tokU', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const apri = async (tok, viewport) => {
      const P = await ctx.B.openPage(ctx.browser, `${base}/?t=${tok}&test=1`, { viewport }); ctx._pages.push(P);
      await ctx.waitReady(P.page, 30000);
      await ctx.waitState(P.page, (s) => s.lot && s.lot.ready === true && s.guida && s.mappa, 40000);
      return P;
    };
    const hook = (page, n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    /** Rettangoli visibili degli elementi fissi + coppie che si sovrappongono (più di 2 px per lato: bordi e ombre a contatto vanno bene). */
    const misura = (page) => page.evaluate((FISSI) => {
      const vw = innerWidth, vh = innerHeight, out = [];
      for (const [sel, nome] of FISSI) for (const e of document.querySelectorAll(sel)) {
        let vis = true;
        for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) { vis = false; break; } }
        const r = e.getBoundingClientRect();
        if (!vis || r.width < 2 || r.height < 2) continue;
        out.push({ nome: `${nome}${e.id ? '#' + e.id : e.dataset.id ? '[' + e.dataset.id + ']' : ''}`, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      }
      const sopra = [];
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 2 && oy > 2) sopra.push(`${a.nome} × ${b.nome} (${ox}×${oy})`);
      }
      const fuori = out.filter((r) => r.x < -1 || r.y < -1 || r.x + r.w > vw + 1 || r.y + r.h > vh + 1).map((r) => r.nome);
      return { vw, vh, rects: out, sopra, fuori };
    }, FISSI);
    const controlla = async (P, tag, devono) => {
      await sleep(700); // un paio di frame anche a 2-4 fps
      const m = await misura(P.page);
      await ctx.shot(P.page, tag);
      ctx.log(`${tag}: ${m.rects.length} elementi · ${m.rects.map((r) => r.nome).join(', ')}`);
      for (const d of devono) assert(m.rects.some((r) => r.nome.startsWith(d)), `${tag}: manca «${d}» (${m.rects.map((r) => r.nome).join(', ')})`);
      assert(m.sopra.length === 0, `${tag}: sovrapposti ${m.sopra.join(' · ')}`);
      assert(m.fuori.length === 0, `${tag}: fuori dallo schermo ${m.fuori.join(', ')}`);
      // la guida manca solo se si è fatta da parte per un bottone GIOCA / PESCA / Porto che le starebbe sotto
      const g = (await ctx.getState(P.page)).guida;
      if (g.current && !m.rects.some((r) => r.nome.startsWith('guida'))) { ctx.log(`${tag}: la guida cede il posto`); assert(g.cede, `${tag}: guida sparita senza motivo ${JSON.stringify(g)}`); }
      return m;
    };
    /** Tutto acceso: mete aperte e tutte accese, isole scoperte (in bussola anche le isole a tema), sezione del Porto aperta (la più lunga). */
    const accendi = async (P) => {
      await hook(P.page, 'mappaScopri');
      const s = await ctx.getState(P.page);
      if (!s.compass.open) await P.page.locator('#mzMete').click();
      await ctx.waitState(P.page, (s) => s.compass.open === true, 3000);
      await P.page.locator('#compass [data-act="tutte"]').click();
      await ctx.waitState(P.page, (s) => s.compass.shown.length >= 12 && s.compass.on.length === s.compass.shown.length, 5000);
      await ctx.waitState(P.page, (s) => s.compass.sezioni.every((z) => z.mode === 'sez'), 5000);
    };
    const apriSezione = async (P, id) => {
      if ((await ctx.getState(P.page)).compass.aperta !== id) await P.page.locator(`#compass [data-sez="${id}"] [data-act="apri"]`).click();
      await ctx.waitState(P.page, (s, id) => s.compass.aperta === id, 3000, id);
    };

    const pose = [['iphone', ctx.B.IPHONE, 'tokL'], ['android', ANDROID, 'tokM'], ['pc', ctx.B.DESKTOP, 'tokU']];
    for (const [nome, vp, tok] of pose) {
      const P = await apri(tok, vp);
      const touch = !!vp.hasTouch;
      await ctx.test(`${nome} ${vp.width}×${vp.height}: sull'isola con mete aperte, guida e minimappa niente si sovrappone`, async () => {
        const s0 = await ctx.getState(P.page);
        assert(s0.guida.current === 'segheria' && s0.guida.total === 8 && s0.guida.done === 0, 'guida all\'inizio: ' + JSON.stringify(s0.guida));
        await accendi(P);
        const s = await ctx.getState(P.page);
        ctx.log(`${nome}: mete ${s.compass.shown.length} (${s.compass.shown.join(',')}) · sezioni ${JSON.stringify(s.compass.sezioni)} · guida ${JSON.stringify(s.guida)}`);
        // 13 mete in 5 righe: Casa, Porto ▸ (6), Regata, Grotta, Isole ▸ (4)
        const righe = await P.page.evaluate(() => [...document.querySelectorAll('#compass .mz-mete-row')].filter((r) => r.style.display !== 'none').map((r) => r.dataset.id ?? 'sez:' + r.dataset.sez));
        ctx.log(`${nome}: righe chiuse ${righe.join(', ')}`);
        assert(righe.length <= 6 && righe.includes('sez:porto') && righe.includes('sez:isole') && !righe.includes('mercante'), 'righe: ' + righe.join(','));
        await controlla(P, `${nome}_isola`, ['risorsa', 'bussola', 'minimappa', 'guida', 'bottone in alto', ...(touch ? ['A', 'B', 'joystick'] : [])]);
        await apriSezione(P, 'porto');
        await P.page.waitForFunction(() => document.querySelector('#compass [data-id="mercante"]')?.style.display === 'flex', null, { timeout: 5000 });
        const aperte = await P.page.evaluate(() => { const l = document.querySelector('#compass .mz-mete-list'); return { righe: [...l.querySelectorAll('.mz-mete-row')].filter((r) => r.style.display !== 'none').map((r) => r.dataset.id ?? 'sez:' + r.dataset.sez), scorre: l.scrollHeight > l.clientHeight + 2 }; });
        ctx.log(`${nome}: Porto aperto ${aperte.righe.join(', ')} · scorre ${aperte.scorre}`);
        assert(['mercante', 'bacheca', 'consegne:porto', 'ingorgo:porto'].every((id) => aperte.righe.includes(id)), 'sezione Porto: ' + aperte.righe.join(','));
        await controlla(P, `${nome}_isola_porto_aperto`, ['bussola', 'minimappa', 'guida']);
      });
      await ctx.test(`${nome}: cantiere in corso (chip in alto) e guida al passo 2/8`, async () => {
        const seg = await P.page.evaluate(() => window.__game.state().lot.slotSigns.find((x) => x.hint)?.cell);
        const r = await hook(P.page, 'lotAct', 'build', 'segheria', seg);
        assert(r.ok, 'Segheria: ' + JSON.stringify(r));
        await ctx.waitState(P.page, (s) => s.guida.current === 'barca' && s.guida.fatti.includes('segheria'), 8000);
        await P.page.waitForFunction(() => document.getElementById('mzWork')?.classList.contains('on'), null, { timeout: 8000 });
        await sleep(1600); // finisce il «FATTO!»
        await controlla(P, `${nome}_cantiere`, ['cantiere', 'guida', 'bussola', 'minimappa']);
      });
      await ctx.test(`${nome}: al Porto accanto al Mercante (bottone del Porto) niente si sovrappone`, async () => {
        await hook(P.page, 'goto', 'porto'); await sleep(400);
        const posti = (await ctx.getState(P.page)).porto.posti, m = posti.find((x) => x.id === 'mercante');
        await hook(P.page, 'teleport', m.fronte?.x ?? m.x, m.fronte?.z ?? m.z + 1.5);
        await ctx.waitState(P.page, (s) => !!s.porto.near, 6000);
        await controlla(P, `${nome}_porto`, ['Porto', 'bussola', 'minimappa']);
      });
      await ctx.test(`${nome}: in barca sul mare da pesca (PESCA) niente si sovrappone`, async () => {
        await hook(P.page, 'goto', 'porto'); await sleep(300);
        await hook(P.page, 'setMode', 'boat'); await sleep(300);
        await hook(P.page, 'pescaVai', 'porto');
        await ctx.waitState(P.page, (s) => !!s.pescaPosto?.ok, 8000);
        await controlla(P, `${nome}_pesca`, ['PESCA', 'bussola', 'minimappa']);
        ctx.noErrors(P, nome);
      });
      await P.page.context().close().catch(() => {});
    }

    await ctx.test('guida: SALTA passa al passo dopo, × la chiude e resta chiusa al ricaricamento, dalle Impostazioni si riaccende', async () => {
      const P = await apri('tokU', ctx.B.DESKTOP), page = P.page;
      const g0 = (await ctx.getState(page)).guida;
      await page.locator('#mzGuida [data-act="salta"]').click();
      await ctx.waitState(page, (s, g0) => s.guida.done === g0.done + 1 && s.guida.current !== g0.current, 3000, g0);
      await page.locator('#mzGuida [data-act="chiudi"]').click();
      await ctx.waitState(page, (s) => s.guida.chiusa === true && s.guida.current === null, 3000);
      await page.waitForFunction(() => /chiusa/i.test(document.getElementById('mzGuida').textContent) && document.getElementById('mzGuida').classList.contains('on'), null, { timeout: 5000 });
      await ctx.shot(page, 'guida_chiusa');
      await page.waitForFunction(() => !document.getElementById('mzGuida').classList.contains('on'), null, { timeout: 8000 });
      await page.reload(); await ctx.waitReady(page, 30000); await ctx.waitState(page, (s) => !!s.guida, 20000);
      const g1 = (await ctx.getState(page)).guida;
      assert(g1.chiusa === true && g1.current === null && g1.done === g0.done + 1, 'dopo il ricaricamento: ' + JSON.stringify(g1));
      await page.locator('#mzSetBtn').click();
      await page.locator('#mzSet [data-set="guida"]').click();
      await ctx.waitState(page, (s) => s.guida.chiusa === false && s.guida.current !== null, 3000);
      await ctx.shot(page, 'guida_impostazioni');
      ctx.noErrors(P, 'guida');
      await page.context().close().catch(() => {});
    });
    await ctx.test('guida: chi aveva fatto i 4 passi di prima (progresso «4» salvato) riparte da «Fai due chiacchiere al Porto», non da capo', async () => {
      const P = await apri('tokL', ctx.B.IPHONE), page = P.page;
      await page.evaluate(() => localStorage.setItem('marea:guida:luca', '4'));
      await page.reload(); await ctx.waitReady(page, 30000);
      try { await ctx.waitState(page, (s) => !!s.guida, 20000); } catch (e) { ctx.log('state: ' + await page.evaluate(() => { try { return Object.keys(window.__game.state()).join(','); } catch (x) { return 'ERR ' + x.stack; } })); throw e; }
      const g = (await ctx.getState(page)).guida;
      ctx.log('guida da «4»: ' + JSON.stringify(g));
      assert(g.current === 'parla' && g.done >= 4 && ['segheria', 'barca', 'regata', 'costruisci'].every((id) => g.fatti.includes(id)), 'guida: ' + JSON.stringify(g));
      await sleep(600);
      await ctx.shot(page, 'guida_passi_nuovi');
      ctx.noErrors(P, 'guida vecchia');
      await page.context().close().catch(() => {});
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
