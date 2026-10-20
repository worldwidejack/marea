// I paesani di Borgo Marea: la prima volta si presentano (e il server se lo ricorda), poi chiacchierano con le battute del bacino
// giusto; chi insiste li stanca. I favori: il paesano chiede (VA BENE / NON ORA), il «!» giallo va sopra chi devi trovare, il destinatario
// risponde al messaggio, tornando si riscuote; il pesce chiesto si regala (REGALA) e sparisce dallo zaino; la Bacheca ricorda il favore.
// Telefono 390×844: le scelte stanno nello schermo con bersagli ≥ 44 px. I favori dipendono dalla fascia di 20 minuti: il test cerca,
// fra otto persone di prova, chi ha adesso un messaggio e chi un pesce o un insetto da chiedere (stessa sim del server).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IDS = ['nella', 'tonio', 'bice', 'gaspare', 'ada_fiori'];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WRANGLER_BIN = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const persist = path.join(ctx.OUT, `m3paesani-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER_BIN, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const { PAESANI } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/paesani.ts')).href);
  const SIM = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/economy/paesani.ts')).href);
  const testi = (l) => l.map((b) => (typeof b === 'string' ? b : b.t));

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const persone = Array.from({ length: 8 }, (_, i) => ({ id: `pae${i}`, tok: `tokP${i}`, slot: i }));
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', 'INSERT INTO persone (id, nome, token, slot) VALUES ' + persone.map((p) => `('${p.id}', 'Prova ${p.slot}', '${p.tok}', ${p.slot})`).join(', ') + ';');
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER_BIN, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const api = (tok) => {
      const hdr = { 'x-token': tok, 'content-type': 'application/json', ...(process.platform === 'win32' ? { connection: 'close' } : {}) }; // Windows: wrangler locale lento col keep-alive
      return {
        get: async (p) => { const r = await fetch(BASE + p, { headers: hdr }); return { status: r.status, body: await r.json() }; },
        post: async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; },
      };
    };
    // tutti con monete, canna e retino; tutti conoscono tutti i paesani tranne pae0, che non ha mai visto Bice
    for (const p of persone) {
      const a = api(p.tok);
      await a.get('/api/lot');
      assert((await a.post('/api/test/monete', { n: 3000 })).status === 200, 'monete di prova');
      assert((await a.post('/api/lot/casa/canna')).status === 200, 'canna');
      assert((await a.post('/api/lot/casa/retino')).status === 200, 'retino');
      for (const id of IDS) if (!(p.id === 'pae0' && id === 'bice')) assert((await a.post('/api/lot/paesani/parla', { id })).status === 200, 'parla ' + id);
    }
    assert((await api('tokP0').post('/api/lot/paesani/parla', { id: 'nessuno' })).status === 404, 'paesano sconosciuto: 404');

    /** Chi ha adesso un favore di quel tipo da chiedere (lontano dalla fine della fascia di 20 minuti). */
    async function chiChiede(tipo, salta = []) {
      for (let giro = 0; giro < 2; giro++) {
        const now = Date.now(), finoA = (SIM.slotAt(now) + 1) * SIM.SLOT_MS - now;
        if (finoA < 100_000) { await sleep(finoA + 1500); continue; }
        for (const p of persone) {
          if (salta.includes(p.id)) continue;
          const lot = (await api(p.tok).get('/api/lot')).body;
          for (const id of IDS) { const off = SIM.offertaDi(lot, id, now); if (off?.tipo === tipo) return { p, off }; }
        }
        return null;
      }
      return null;
    }
    const apri = async (tok, viewport = ctx.B.DESKTOP) => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      const page = pg.page;
      if (process.platform === 'win32') await page.route((u) => /^\/(api|chunk|assets)/.test(u.pathname), (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
      await ctx.waitReady(page, 60000);
      await ctx.waitState(page, (s) => s.lot && s.lot.ready && s.porto && s.porto.gente.length > 0, 60000);
      const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page, hook };
    };
    const ui = async (page) => (await ctx.getState(page)).porto.ui;
    /** Apre la chiacchierata e va avanti fino alla pagina con le scelte (o all'ultima). */
    async function parla(page, hook, id) {
      await hook('portoChiudi');
      await sleep(400); // il pannello appena chiuso non si riapre subito
      assert(await hook('portoApri', id), 'apri ' + id);
      await ctx.waitState(page, (s, id) => s.porto.ui && s.porto.ui.kind === 'parla' && s.porto.ui.persona === id, 8000, id);
      for (let i = 0; i < 6; i++) {
        const u = await ui(page);
        if (u.pagine[u.riga].scelte.length || u.riga >= u.pagine.length - 1) return u;
        await page.locator('#mzDialogo [data-act="avanti"]').click();
      }
      return ui(page);
    }

    // ———— chiacchiere ————
    const { page, hook } = await apri('tokP0');
    await ctx.test('1. Primo incontro: si presenta, e il server se lo ricorda', async () => {
      const u = await parla(page, hook, 'bice');
      assert(testi(PAESANI.bice.primo).includes(u.pagine[0].testo), 'non è un primo incontro: ' + u.pagine[0].testo);
      await ctx.shot(page, 'pc_primo_incontro');
      for (let i = 0; i < 20; i++) { if ((await api('tokP0').get('/api/lot')).body.paesani?.conosciuti?.includes('bice')) break; await sleep(300); }
      assert((await api('tokP0').get('/api/lot')).body.paesani.conosciuti.includes('bice'), 'conosciuti senza bice');
    });

    await ctx.test('2. Chiacchiere dal bacino giusto; chi insiste dalla terza volta di fila', async () => {
      const p = PAESANI.nella, ammesse = new Set(testi([...p.base, ...Object.values(p.momenti).flat(), ...Object.values(p.stagioni).flat(), ...p.brutto, ...p.lore, ...p.loreAperto]));
      const u1 = await parla(page, hook, 'nella');
      assert(u1.pagine.length >= 1 && ammesse.has(u1.pagine[0].testo), 'battuta fuori bacino: ' + u1.pagine[0].testo);
      await ctx.shot(page, 'pc_chiacchiera');
      await parla(page, hook, 'nella');
      const u3 = await parla(page, hook, 'nella');
      assert(u3.pagine[0].testo === testi(p.insistente)[0], 'la terza di fila non è insistente: ' + u3.pagine[0].testo);
      const u4 = await parla(page, hook, 'nella');
      assert(u4.pagine[0].testo === testi(p.insistente)[1], 'la quarta: ' + u4.pagine[0].testo);
      await ctx.shot(page, 'pc_insistente');
      await hook('portoChiudi');
      // sotto la pioggia (coi test il meteo parte spento): la scheda sa che piove, niente battute «asciutte», e prima o poi quelle del brutto tempo
      await page.evaluate(async () => { window.__game.test.impostazioni({ meteo: true }); await window.__game.test.aspettoPronto(); });
      await hook('meteo', 'pioggia', 1);
      await sleep(1500);
      let brutto = 0, n = 0;
      for (const id of ['gaspare', 'ada_fiori', 'tonio', 'bice']) {
        const P = PAESANI[id], pioggia = new Set(testi(P.brutto));
        const asciutte = new Set(testi([...P.base, ...Object.values(P.momenti).flat(), ...Object.values(P.stagioni).flat()].filter((b) => typeof b !== 'string' && b.asciutto)));
        for (let i = 0; i < 2; i++) {
          const u = await parla(page, hook, id); n++;
          assert(u.cielo && u.cielo.pioggia >= 0.4, 'la scheda non vede la pioggia: ' + JSON.stringify(u.cielo));
          assert(!u.pagine.some((x) => asciutte.has(x.testo)), 'battuta da bel tempo sotto la pioggia: ' + JSON.stringify(u.pagine));
          if (u.pagine.some((x) => pioggia.has(x.testo))) { brutto++; if (brutto === 1) await ctx.shot(page, 'pc_pioggia'); }
        }
      }
      await hook('meteo', null);
      await hook('portoChiudi');
      ctx.log(`sotto la pioggia, chiacchierate con le battute del brutto tempo: ${brutto}/${n}`);
      ctx.noErrors(pages[0], 'chiacchiere');
    });

    // ———— favore: messaggio ————
    await ctx.test('3. Messaggio: VA BENE, il «!» sul destinatario, la risposta, il premio tornando', async () => {
      const c = await chiChiede('parla', ['pae0']);
      assert(c, 'nessuna persona di prova ha un messaggio da portare in questa fascia');
      const { p, off } = c;
      const { page: pp, hook: ph } = await apri(p.tok);
      const u = await parla(pp, ph, off.da);
      const chiede = SIM.riempi(PAESANI[off.da].favori.messaggi[off.msg].chiede, { a: SIM.chiamato(off.a) });
      const last = u.pagine[u.riga];
      assert(last.testo === chiede && last.scelte.join() === 'accetta,rifiuta', 'la richiesta: ' + JSON.stringify(last));
      await ctx.shot(pp, 'pc_favore_richiesta');
      const m0 = (await api(p.tok).get('/api/lot')).body;
      await pp.locator('#mzDialogo [data-act="accetta"]').click();
      await ctx.waitState(pp, () => { const u = window.__game.state().porto.ui; return u && u.pagine[u.riga].scelte.length === 0 && u.riga > 0; }, 8000).catch(() => {});
      const f = (await api(p.tok).get('/api/lot')).body.paesani.favore;
      assert(f && f.tipo === 'parla' && f.a === off.a && !f.detto, 'favore non accettato: ' + JSON.stringify(f));
      await ctx.waitState(pp, (s, a) => s.porto.gente.find((g) => g.id === a)?.segno === true, 5000, off.a);
      await ph('portoChiudi');
      const g = (await ctx.getState(pp)).porto.gente.find((x) => x.id === off.a);
      await ph('teleport', g.x + 4, g.z + 4);
      await sleep(900);
      await ctx.shot(pp, 'pc_segno_destinatario');
      const r = await parla(pp, ph, off.a);
      assert(r.pagine.some((x) => x.testo === SIM.riempi(PAESANI[off.a].favori.messaggi[off.msg].risponde, { da: SIM.chiamato(off.da) })), 'la risposta: ' + JSON.stringify(r.pagine));
      for (let i = 0; i < 20; i++) { if ((await api(p.tok).get('/api/lot')).body.paesani.favore?.detto) break; await sleep(300); }
      assert((await api(p.tok).get('/api/lot')).body.paesani.favore.detto, 'messaggio non segnato come detto');
      await ctx.waitState(pp, (s, da) => s.porto.gente.find((g) => g.id === da)?.segno === true, 5000, off.da);
      const t = await parla(pp, ph, off.da);
      assert(t.pagine[0].testo === SIM.riempi(PAESANI[off.da].favori.messaggi[off.msg].grazie, { a: SIM.chiamato(off.a) }), 'il grazie: ' + t.pagine[0].testo);
      await ctx.shot(pp, 'pc_favore_premio');
      for (let i = 0; i < 20; i++) { if (!(await api(p.tok).get('/api/lot')).body.paesani.favore) break; await sleep(300); }
      const m1 = (await api(p.tok).get('/api/lot')).body;
      assert(m1.paesani.favore === null, 'favore non chiuso');
      if ('monete' in off.premio) assert(m1.monete === m0.monete + off.premio.monete, `monete ${m1.monete} invece di ${m0.monete + off.premio.monete}`);
      else assert((m1.casa?.magazzino?.[off.premio.mobile] ?? 0) === (m0.casa?.magazzino?.[off.premio.mobile] ?? 0) + 1, 'mobile non arrivato');
      ctx.noErrors(pages[pages.length - 1], 'messaggio');
    });

    // ———— favore: pesce o insetto ————
    await ctx.test('4. Pesce o insetto: VA BENE, la Bacheca lo ricorda, REGALA lo toglie dallo zaino e paga', async () => {
      const c = await chiChiede('porta', ['pae0']);
      assert(c, 'nessuna persona di prova ha un pesce o un insetto da chiedere in questa fascia');
      const { p, off } = c;
      const { page: pp, hook: ph } = await apri(p.tok);
      const u = await parla(pp, ph, off.da);
      assert(u.pagine[u.riga].scelte.join() === 'accetta,rifiuta' && u.pagine[u.riga].testo.includes(SIM.cosaSpecie(off.cosa, off.id)), 'la richiesta: ' + JSON.stringify(u.pagine[u.riga]));
      await ctx.shot(pp, 'pc_porta_richiesta');
      await pp.locator('#mzDialogo [data-act="accetta"]').click();
      for (let i = 0; i < 20; i++) { if ((await api(p.tok).get('/api/lot')).body.paesani.favore) break; await sleep(300); }
      const f = (await api(p.tok).get('/api/lot')).body.paesani.favore;
      assert(f && f.tipo === 'porta' && f.id === off.id && f.scade - Date.now() > 55 * 60_000, 'favore: ' + JSON.stringify(f));
      const pr = await parla(pp, ph, off.da);
      assert(testi(PAESANI[off.da].favori.promemoria).some((x) => pr.pagine[0].testo === SIM.riempi(x, { cosa: SIM.cosaSpecie(off.cosa, off.id), nome: SIM.nomeSpecie(off.cosa, off.id) })), 'promemoria: ' + pr.pagine[0].testo);
      assert((await api(p.tok).post('/api/lot/paesani/dona', { id: off.da })).status === 409, 'regalare senza averlo: 409');
      assert((await api(p.tok).post('/api/test/inv', { item: off.id })).status === 200, 'pesce/insetto di prova nello zaino');
      await ph('portoChiudi');
      await sleep(400);
      await ph('portoApri', 'bacheca'); // la Bacheca rilegge il lotto dal server e ricorda il favore
      await ctx.waitState(pp, () => !!document.querySelector('#mzPortoPanel [data-favore]'), 8000);
      await ctx.shot(pp, 'pc_bacheca_favore');
      await ph('portoChiudi');
      const d = await parla(pp, ph, off.da);
      assert(d.pagine[d.riga].scelte.join() === 'regala,non-ancora', 'niente REGALA: ' + JSON.stringify(d.pagine));
      await ctx.shot(pp, 'pc_regala');
      const m0 = (await api(p.tok).get('/api/lot')).body;
      await pp.locator('#mzDialogo [data-act="regala"]').click();
      for (let i = 0; i < 20; i++) { if (!(await api(p.tok).get('/api/lot')).body.paesani.favore) break; await sleep(300); }
      const m1 = (await api(p.tok).get('/api/lot')).body;
      assert(m1.paesani.favore === null && !(m1.hero.inv[off.id] ?? 0), 'non regalato: ' + JSON.stringify(m1.paesani));
      if ('monete' in off.premio) assert(m1.monete === m0.monete + off.premio.monete, 'monete del regalo');
      else assert((m1.casa?.magazzino?.[off.premio.mobile] ?? 0) === (m0.casa?.magazzino?.[off.premio.mobile] ?? 0) + 1, 'mobile del regalo');
      await ctx.waitState(pp, () => { const u = window.__game.state().porto.ui; return u && u.riga >= 1; }, 5000);
      await ctx.shot(pp, 'pc_regalo_grazie');
      ctx.noErrors(pages[pages.length - 1], 'regalo');
    });

    await ctx.test('5. Telefono 390×844: la scheda e le scelte stanno nello schermo, bersagli ≥ 44 px', async () => {
      const c = await chiChiede('parla', ['pae0']) ?? await chiChiede('porta', ['pae0']);
      assert(c, 'nessun favore da chiedere in questa fascia');
      const { page: tp, hook: th } = await apri(c.p.tok, ctx.B.IPHONE);
      await sleep(7500); // il saluto della guida
      await parla(tp, th, c.off.da);
      const r = await tp.evaluate(() => [...document.querySelectorAll('#mzDialogo button')].map((b) => { const q = b.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, h: q.height, w: q.width }; }));
      const W = 390, H = 844;
      assert(r.length === 2 && r.every((b) => b.l >= 0 && b.r <= W && b.t >= 0 && b.b <= H && b.h >= 44 && b.w >= 44), 'bottoni: ' + JSON.stringify(r));
      await ctx.shot(tp, 'tel_favore_scelte');
      await tp.locator('#mzDialogo [data-act="rifiuta"]').tap();
      await ctx.waitState(tp, () => { const u = window.__game.state().porto.ui; return u && u.pagine[u.riga].scelte.length === 0; }, 5000);
      for (let i = 0; i < 20; i++) { if ((await api(c.p.tok).get('/api/lot')).body.paesani.pausaFino > Date.now()) break; await sleep(300); }
      assert((await api(c.p.tok).get('/api/lot')).body.paesani.pausaFino > Date.now() + 10 * 60_000, 'NON ORA: niente pausa');
      ctx.noErrors(pages[pages.length - 1], 'telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev?.pid) { try { process.kill(-dev.pid, 'SIGKILL'); } catch { try { dev.kill('SIGKILL'); } catch { /* già morto */ } } }
    await sleep(300);
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
