// M2 · R-pannelli (Mondo Sotterraneo, CONTRACTS §15): scheda del personaggio e pannelli degli edifici GDR sul server locale (wrangler dev, TEST_CLOCK:1).
// (1) tasto I e bottone #mzHeroBtn aprono #mzEroe, Esc chiude, le tre schede si cambiano, un'abilità mostra i suoi perk; (2) Zaino: equipaggia l'arco
// e torna alla katana (salvato sul server); (3) Banco costruito (orologio di test) → dal foglio dell'edificio «Forgia» apre il pannello, compri
// il bronzo in Bottega e forgi un'arma di bronzo; (4) Forziere: deposita 1 / tutti e preleva; (5) Serra: «Raccogli» porta gli ingredienti;
// (6) telefono 390×844: righe ≥ 44 px, testo leggibile, screenshot di ogni pannello. Screenshot in tests/out/shots/m2_eroe_*.png.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m2eroe-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { RPG, PERKS } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/rpg.ts')).href);
  const buildings = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/buildings.json'), 'utf8'));
  const islands = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8'));
  const slots = islands.find((i) => i.id === 'lotto').slots;
  const cellOf = (k) => slots.find((s) => s.kind === k)?.at;
  const secs = (k) => buildings.find((b) => b.id === k).levels[0].seconds;

  let dev = null, log = '', OFF = 0;
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const lot = async () => (await get('/api/lot', 'tokA')).body;
    /** Costruisce col lotto e porta avanti l'orologio di test fino alla fine del cantiere. */
    const build = async (k) => {
      const r = await post('/api/lot/build', 'tokA', { building: k, cell: cellOf(k) });
      assert(r.status === 200, `build ${k}: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
      OFF += (secs(k) + 30) * 1000;
      const l = await lot();
      assert(l.buildings.find((b) => b.building === k)?.level === 1, `${k} non finito col clock di test`);
    };

    const open = async (viewport) => {
      const pg = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-test-now-offset': String(OFF) } }));
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.eroe && s.lot, 15000);
      return pg;
    };
    const st = async (pg) => (await ctx.getState(pg.page)).eroe;
    const waitEroe = (pg, fn, arg = null, ms = 8000) => ctx.waitState(pg.page, `(s, a) => !!s.eroe && (${fn})(s.eroe, a)`, ms, arg);
    const click = async (pg, sel) => { const l = pg.page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 5000 }); await l.scrollIntoViewIfNeeded(); await l.click(); };
    const idle = (pg) => waitEroe(pg, '(e) => !e.busy');
    const refresh = async (pg) => { await pg.page.evaluate(() => window.__game.test.lotRefresh()); };
    /** Dal foglio dell'edificio (#mzSheet) al pannello GDR: tocco sull'edificio, poi il bottone d'azione. */
    const fromSheet = async (pg, k) => {
      await refresh(pg);
      await pg.page.evaluate((b) => window.__game.test.lotTap(b), k);
      await click(pg, '#mzSheet.on [data-act="rpg"]');
      await waitEroe(pg, '(e, k) => e.open && e.view === k', k);
      assert(!(await pg.page.locator('#mzSheet.on').count()), 'il foglio dell’edificio resta aperto sotto il pannello');
    };

    const D = await open(ctx.B.DESKTOP);

    await ctx.test('scheda: tasto I e bottone aprono #mzEroe, Esc chiude, schede Personaggio/Abilità/Zaino, perk di un’abilità', async () => {
      assert(await D.page.locator('#mzHeroBtn').isVisible(), 'manca #mzHeroBtn in topbar');
      await D.page.keyboard.press('KeyI');
      await waitEroe(D, '(e) => e.open && e.loaded && e.view === "eroe" && e.tab === "pg"', null, 15000);
      const e0 = await st(D);
      assert(e0.livello === 1 && e0.carico > 0 && e0.caricoMax > e0.carico, 'numeri della scheda: ' + JSON.stringify(e0));
      assert(await D.page.locator('#mzEroe.on.mz-sheet.mz-side').isVisible(), '#mzEroe non visibile');
      await ctx.shot(D.page, 'desktop_personaggio');
      await D.page.keyboard.press('Escape');
      await waitEroe(D, '(e) => !e.open');
      await click(D, '#mzHeroBtn');
      await waitEroe(D, '(e) => e.open && e.view === "eroe"');
      assert(await D.page.locator('#mzHeroBtn.on').count(), 'bottone non acceso col pannello aperto');
      await click(D, '#mzEroe [data-tab="abilita"]');
      await waitEroe(D, '(e) => e.tab === "abilita"');
      assert((await D.page.locator('#mzEroe [data-skill]').count()) === 7, 'non ci sono 7 abilità');
      await click(D, '#mzEroe [data-skill="armiLeggere"]');
      const n = await D.page.locator('#mzEroe [data-perks="armiLeggere"] [data-perk]').count();
      assert(n === PERKS.filter((p) => p.skill === 'armiLeggere').length, `perk di Armi leggere: ${n}`);
      await ctx.shot(D.page, 'desktop_abilita');
      await D.page.keyboard.press('ArrowRight');
      await waitEroe(D, '(e) => e.tab === "zaino"');
      await ctx.shot(D.page, 'desktop_zaino');
    });

    await ctx.test('Zaino: equipaggia l’arco e torna alla katana (salvato sul server); magia preparata accesa', async () => {
      assert((await st(D)).equip.arma === 'katana_legno', 'arma di partenza');
      await click(D, '#mzEroe [data-item="arco_legno"]');
      await click(D, '#mzEroe [data-det="arco_legno"] [data-act="equipaggia"]');
      await waitEroe(D, '(e) => e.equip.arma === "arco_legno" && !e.busy');
      assert((await lot()).hero.equip.arma === 'arco_legno', 'arco non salvato sul server');
      await ctx.shot(D.page, 'desktop_zaino_arco');
      await click(D, '#mzEroe [data-item="katana_legno"]');
      await click(D, '#mzEroe [data-det="katana_legno"] [data-act="equipaggia"]');
      await waitEroe(D, '(e) => e.equip.arma === "katana_legno" && !e.busy');
      assert((await lot()).hero.equip.arma === 'katana_legno', 'katana non salvata sul server');
      assert(await D.page.locator('#mzEroe [data-magia="fiammata"].on').count(), 'Fiammata non segnata come preparata');
      await D.page.keyboard.press('KeyI');
      await waitEroe(D, '(e) => !e.open');
    });

    await ctx.test('Zaino: Butta via una freccia (due tocchi: il primo chiede conferma), tolta sul server', async () => {
      await click(D, '#mzHeroBtn');
      await waitEroe(D, '(e) => e.open && e.view === "eroe"');
      await click(D, '#mzEroe [data-tab="zaino"]');
      const n0 = (await lot()).hero.inv.frecce_legno;
      await click(D, '#mzEroe [data-item="frecce_legno"]');
      await click(D, '#mzEroe [data-det="frecce_legno"] [data-act="butta"]');
      assert((await lot()).hero.inv.frecce_legno === n0, 'buttata al primo tocco, senza conferma');
      await click(D, '#mzEroe [data-det="frecce_legno"] [data-act="butta-sicuro"]');
      await waitEroe(D, `(e) => e.inv.frecce_legno === ${n0 - 1} && !e.busy`);
      assert((await lot()).hero.inv.frecce_legno === n0 - 1, 'freccia non buttata sul server');
      await D.page.keyboard.press('KeyI');
      await waitEroe(D, '(e) => !e.open');
    });

    await ctx.test('Banco: costruito col clock di test, «Forgia» dal foglio, bronzo comprato in Bottega, arma di bronzo forgiata', async () => {
      await build('banco');
      // monete: la dotazione non basta per 3 lingotti → qualche spedizione nella Grotta giocata in Node con l'autopilot (come m2_server)
      const { dungeon } = await sim('dungeon/dungeon.ts');
      const { autopilot } = await sim('dungeon/autopilot.ts');
      const { packDungeon, quantizeDungeon } = await sim('dungeon/replay.ts');
      const { createRng } = await sim('rng.ts');
      const prezzo = RPG.bottega.lingotto_bronzo;
      const bronzo = (l) => (l.hero?.inv?.lingotto_bronzo ?? 0) + (l.forziere?.lingotto_bronzo ?? 0);
      for (let i = 0; i < 6; i++) {
        const l = await lot();
        const need = Math.max(1, 3 - bronzo(l)); // almeno un lingotto si compra sempre dalla Bottega
        if ((l.hero?.monete ?? RPG.partenza.monete) >= need * prezzo) break;
        const s = (await post('/api/dungeon/start', 'tokA', { dungeon: 'grotta' })).body;
        const g = dungeon.create({ seed: s.seed, dungeon: s.dungeon, hero: s.hero, stato: s.stato, partenza: s.partenza });
        const rng = createRng(s.seed), frames = [];
        while (!g.done && frames.length < dungeon.maxTicks) { const f = quantizeDungeon(autopilot(g, rng)); frames.push(f); dungeon.step(g, f); }
        const r = await post('/api/dungeon/finish', 'tokA', { inputs: packDungeon(frames), hash: dungeon.result(g).hash });
        ctx.log(`spedizione ${i + 1}: ${r.status} ${r.body.result?.outcome} · +${r.body.monete} monete · tenuto ${JSON.stringify(r.body.tenuto)}`);
      }
      const l0 = await lot();
      const comprare = Math.max(1, 3 - bronzo(l0));
      assert((l0.hero?.monete ?? 0) >= comprare * prezzo, `monete insufficienti per il test: ${l0.hero?.monete}`);
      await fromSheet(D, 'banco');
      await ctx.shot(D.page, 'desktop_banco');
      for (let i = 0; i < comprare; i++) {
        await click(D, '#mzEroe [data-k="compra:lingotto_bronzo:1"]');
        await idle(D);
      }
      assert(bronzo(await lot()) >= 3, 'bronzo non comprato: ' + JSON.stringify((await lot()).hero.inv));
      await click(D, '#mzEroe [data-k="mat:bronzo"]');
      await click(D, '#mzEroe [data-k="cat:leggere"]');
      await click(D, '#mzEroe [data-item="nunchaku_bronzo"]');
      await ctx.shot(D.page, 'desktop_banco_bronzo');
      await click(D, '#mzEroe [data-det="nunchaku_bronzo"] [data-act="forgia"]');
      await idle(D);
      const l1 = await lot();
      assert((l1.hero.inv.nunchaku_bronzo ?? 0) + (l1.forziere?.nunchaku_bronzo ?? 0) === 1, 'nunchaku di bronzo non forgiato: ' + JSON.stringify(l1.hero.inv));
      assert(l1.hero.skill.forgiatura.xp > 0 || l1.hero.skill.forgiatura.lv > RPG.livelli.skillIniziale, 'niente xp di Forgiatura');
      // un materiale oltre il livello del Banco è bloccato col motivo
      await click(D, '#mzEroe [data-k="mat:argento"]');
      assert(/livello 2/.test(await D.page.locator('#mzEroe .mz-rp-note').first().innerText()), 'argento senza motivo del blocco');
      await D.page.keyboard.press('Escape');
      await waitEroe(D, '(e) => !e.open');
    });

    await ctx.test('Forziere: deposita 1 e tutti, poi preleva tutti', async () => {
      await build('forziere');
      await fromSheet(D, 'forziere');
      const n0 = (await st(D)).inv.frecce_legno;
      await click(D, '#mzEroe [data-col="zaino"] [data-item="frecce_legno"]');
      await click(D, '#mzEroe [data-act="deposita"]');
      await waitEroe(D, '(e) => e.forziere.frecce_legno === 1 && !e.busy');
      await click(D, '#mzEroe [data-act="deposita-tutti"]');
      await waitEroe(D, '(e) => !e.busy && e.inv.frecce_legno === 1');
      const f = (await st(D)).forziere.frecce_legno;
      assert(f === n0 - 1, `nel Forziere ${f} frecce su ${n0} (una resta: è equipaggiata)`);
      await ctx.shot(D.page, 'desktop_forziere');
      await click(D, '#mzEroe [data-col="forziere"] [data-item="frecce_legno"]');
      await click(D, '#mzEroe [data-act="preleva-tutti"]');
      await waitEroe(D, '(e) => !e.busy && e.inv.frecce_legno === a && !e.forziere.frecce_legno', n0);
      await D.page.keyboard.press('Escape');
    });

    await ctx.test('Serra: «Raccogli» dal foglio porta gli ingredienti nel Forziere e li mostra', async () => {
      await build('serra');
      OFF += 3600 * 1000; // un'ora di produzione
      await fromSheet(D, 'serra');
      await D.page.locator('#mzEroe [data-arrivato]').first().waitFor({ state: 'visible', timeout: 8000 });
      const l = await lot();
      const ing = ['erba_curativa', 'fiore_azzurro', 'radice_vigore'].reduce((a, id) => a + (l.forziere?.[id] ?? 0), 0);
      assert(ing >= 1, 'nessun ingrediente nel Forziere: ' + JSON.stringify(l.forziere));
      await ctx.shot(D.page, 'desktop_serra');
      await D.page.keyboard.press('Escape');
      await build('alchimia');
      await fromSheet(D, 'alchimia');
      await click(D, '#mzEroe [data-ricetta="r_vita_minore"]');
      await ctx.shot(D.page, 'desktop_alchimia');
      await D.page.keyboard.press('Escape');
    });

    await ctx.test('telefono 390×844: righe ≥ 44 px, testo ≥ 13 px, niente uscite a destra; screenshot dei pannelli', async () => {
      await D.close().catch(() => {});
      const T = await open(ctx.B.IPHONE);
      const check = async (name) => {
        const bad = await T.page.evaluate(() => {
          const s = document.getElementById('mzEroe'), out = [];
          const r0 = s.getBoundingClientRect();
          if (r0.right > innerWidth + 1 || r0.left < -1) out.push('foglio fuori schermo');
          for (const b of s.querySelectorAll('button')) {
            const r = b.getBoundingClientRect();
            if (r.height && r.height < 43.5) out.push(`${b.dataset.k || b.textContent.trim().slice(0, 20)} alto ${r.height}`);
            if (r.width && r.right > r0.right + 1) out.push(`${b.dataset.k} esce a destra`);
          }
          for (const t of s.querySelectorAll('span, div, p, b')) {
            if (!t.childNodes.length || ![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const fs = parseFloat(getComputedStyle(t).fontSize);
            if (fs < 13) out.push(`testo ${fs}px: ${t.textContent.trim().slice(0, 20)}`);
          }
          return out;
        });
        assert(!bad.length, `${name}: ` + bad.slice(0, 6).join(' · '));
        await ctx.shot(T.page, `telefono_${name}`);
      };
      await click(T, '#mzHeroBtn');
      await waitEroe(T, '(e) => e.open && e.view === "eroe"', null, 15000);
      await check('personaggio');
      await click(T, '#mzEroe [data-tab="abilita"]'); await click(T, '#mzEroe [data-skill="forgiatura"]'); await check('abilita');
      await click(T, '#mzEroe [data-tab="zaino"]'); await click(T, '#mzEroe [data-item="katana_legno"]'); await check('zaino');
      await click(T, '#mzEroe [data-act="chiudi"]'); await waitEroe(T, '(e) => !e.open');
      for (const k of ['banco', 'forziere', 'alchimia']) {
        await fromSheet(T, k);
        if (k === 'banco') await click(T, '#mzEroe [data-item="katana_legno"]');
        if (k === 'forziere') await click(T, '#mzEroe [data-col="zaino"] [data-item="pozione_vita_minore"]');
        await check(k);
        await click(T, '#mzEroe [data-act="chiudi"]'); await waitEroe(T, '(e) => !e.open');
      }
    });

    await ctx.test('nessun errore in console', async () => {
      for (const pg of pages) {
        pg.consoleErrors.splice(0, pg.consoleErrors.length, ...pg.consoleErrors.filter((e) => !/status of 409/.test(e)));
        ctx.noErrors(pg, 'Ada');
      }
    });
  } finally {
    for (const pg of pages) await pg.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
