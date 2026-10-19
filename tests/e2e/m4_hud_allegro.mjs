// HUD «Allegro» (#417, scelto da Jack e dal gruppo il 18 ott 2026: assets/concept/ui/hud2_3_mario.jpg). Server locale pulito, Luca entra
// col suo link su iPhone 390×844 e poi sul PC 1280×720. Si controlla: il bottone AVATAR col ritratto della testa; il menù a tutto schermo
// con Aspetto, Personaggio e Foto, che aprono i pannelli di sempre; i bottoni tolti (maglietta, faccina, scudo, libro, macchina foto) non
// si vedono; B non c'è nel mondo; accanto a Nonna Pina sotto A compare «Parla» (il bottone PARLA che diventa la scritta, niente in mezzo
// allo schermo); quando Mia entra, accanto alla campanella «Mia è online».
// Screenshot per il confronto con l'immagine scelta (iphone_hud, iphone_menu, iphone_parla, iphone_online, pc_hud).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VISIBILI = ['#mzAvatarBtn', '#mzFeedBtn', '#mzSetBtn', '#mzTeleBtn', '#mzMini', '#mzMiniMete', '#mzBar', '#compass', '#btnA'];
const NASCOSTI = ['#mzEditorBtn', '#mzEmoteBtn', '#mzHeroBtn', '#mzDiarioBtn', '#mzFotoBtn', '#btnB'];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4hud-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1);");
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
      await ctx.waitState(P.page, (s) => s.lot && s.lot.ready === true && s.hudAllegro, 40000);
      return P;
    };
    const hook = (page, n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const vede = (page, sel) => page.evaluate((sel) => {
      const e = document.querySelector(sel); if (!e) return false;
      for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
      const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2;
    }, sel);
    const bottoni = async (P, tag) => {
      for (const s of VISIBILI) assert(await vede(P.page, s), `${tag}: ${s} non si vede`);
      for (const s of NASCOSTI) assert(!(await vede(P.page, s)), `${tag}: ${s} si vede ancora (#417 lo toglie)`);
    };

    const L = await apri('tokL', ctx.B.IPHONE);
    await ctx.test('iphone: monete, campanella, AVATAR col ritratto, ingranaggio, viaggio rapido, minimappa con la bandierina; niente bottoni vecchi né B', async () => {
      await bottoni(L, 'iphone');
      await ctx.waitState(L.page, (s) => s.hudAllegro.ritratto === true, 20000);
      await sleep(500);
      await ctx.shot(L.page, 'iphone_hud');
      ctx.noErrors(L, 'iphone');
    });
    await ctx.test('iphone: AVATAR apre il menù a tutto schermo (Aspetto, Personaggio, Foto); Aspetto apre l\'editor', async () => {
      await L.page.locator('#mzAvatarBtn').tap();
      await ctx.waitState(L.page, (s) => s.hudAllegro.menu === true, 3000);
      const voci = (await ctx.getState(L.page)).hudAllegro.voci;
      assert(voci.join() === 'aspetto,personaggio,foto', 'voci del menù: ' + voci.join());
      await sleep(300);
      await ctx.shot(L.page, 'iphone_menu');
      await L.page.locator('#mzAvatarMenu [data-voce="aspetto"]').tap();
      await ctx.waitState(L.page, (s) => s.hudAllegro.menu === false && s.editor.open === true, 8000);
      await L.page.keyboard.press('Escape');
      await ctx.waitState(L.page, (s) => s.editor.open === false, 5000);
    });
    await ctx.test('iphone: accanto a Nonna Pina sotto A c\'è «Parla»; lontano niente scritta', async () => {
      const g = (await ctx.getState(L.page)).porto.gente.find((n) => n.nome === 'Nonna Pina');
      assert(g, 'Nonna Pina non c\'è');
      await hook(L.page, 'teleport', g.x + 1.2, g.z + 1.2);
      await ctx.waitState(L.page, (s) => s.wp2_input.azione === 'Parla', 6000);
      // sul telefono la scritta sotto A è il bottone PARLA stesso (.mz-in-a, verbo nel ::before) e in mezzo allo schermo non resta niente
      const sotto = await L.page.evaluate(() => {
        const b = document.querySelector('.mz-play.on.mz-in-a'), a = document.getElementById('btnA');
        if (!b || !a) return null;
        const r = b.getBoundingClientRect(), ra = a.getBoundingClientRect();
        return { verbo: getComputedStyle(b, '::before').content, cx: r.left + r.width / 2, sotto: r.top >= ra.bottom - 2, aCx: ra.left + ra.width / 2 };
      });
      assert(sotto && sotto.verbo === '"Parla"' && sotto.sotto && Math.abs(sotto.cx - sotto.aCx) < 4, 'la scritta «Parla» non sta sotto A: ' + JSON.stringify(sotto));
      assert(await vede(L.page, '.mz-play.on.mz-in-a') && !(await vede(L.page, '#btnAzione')), 'sotto A una scritta sola');
      await sleep(400);
      await ctx.shot(L.page, 'iphone_parla');
      await hook(L.page, 'teleport', g.x + 25, g.z + 25);
      await ctx.waitState(L.page, (s) => s.wp2_input.azione === null, 6000);
    });
    await ctx.test('iphone: quando Mia entra, accanto alla campanella «Mia è online»', async () => {
      // la bolla dura 5 s e la pagina di Mia ne mette quasi altrettanti a partire (col disegno software dei test): la si guarda da prima che Mia entri
      await L.page.evaluate(() => { const b = document.getElementById('mzOnline'); window.__visteOnline = []; new MutationObserver(() => { if (b.classList.contains('on')) window.__visteOnline.push(b.textContent); }).observe(b, { attributes: true, childList: true }); });
      const M = await apri('tokM', ctx.B.DESKTOP);
      await L.page.bringToFront();
      await L.page.waitForFunction(() => window.__visteOnline.some((t) => t.includes('Mia è online')), null, { timeout: 15000 });
      if ((await ctx.getState(L.page)).hudAllegro.online !== 'Mia') await hook(L.page, 'hudAllegroOnline', 'Mia'); // per la foto, se è già sparita
      await sleep(600);
      await ctx.shot(L.page, 'iphone_online');
      await M.page.close(); ctx._pages.splice(ctx._pages.indexOf(M), 1);
      ctx.noErrors(L, 'iphone');
    });
    await L.page.close(); ctx._pages.splice(ctx._pages.indexOf(L), 1);

    const D = await apri('tokL', ctx.B.DESKTOP);
    await ctx.test('pc 1280×720: stessi bottoni, un po\' più grandi', async () => {
      await bottoni(D, 'pc');
      await ctx.waitState(D.page, (s) => s.hudAllegro.ritratto === true, 20000);
      await sleep(500);
      await ctx.shot(D.page, 'pc_hud');
      await D.page.locator('#mzAvatarBtn').click();
      await ctx.waitState(D.page, (s) => s.hudAllegro.menu === true, 3000);
      await sleep(300);
      await ctx.shot(D.page, 'pc_menu');
      await D.page.keyboard.press('Escape');
      await ctx.waitState(D.page, (s) => s.hudAllegro.menu === false, 3000);
      ctx.noErrors(D, 'pc');
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
