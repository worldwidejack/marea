// M2-server (Mondo Sotterraneo, CONTRACTS §15): personaggio nel lotto, POST /api/rpg (equip, leggi, perk, compra, forgia, deposita),
// spedizioni POST /api/dungeon/start|finish con replay nel DO (input giocati qui in Node con l'autopilot della sim: stesso esito e
// stesso bottino), errori 409/400/413, hash diverso = solo un avviso nel log, la Regata da solo non tocca il personaggio.
// wrangler dev locale con `--var TEST_CLOCK:1`: l'header X-Test-Now-Offset fa finire il cantiere del Banco (solo qui, mai in produzione).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, n]) => n > 0).sort(([a], [b]) => (a < b ? -1 : 1)));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m2server-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const { dungeon } = await sim('dungeon/dungeon.ts');
  const { autopilot } = await sim('dungeon/autopilot.ts');
  const { encodeDungeon, packDungeon, quantizeDungeon, replayDungeon } = await sim('dungeon/replay.ts');
  const { bfs, cellCenter, cellOf, stepDown } = await sim('dungeon/map.ts');
  const { newHero } = await sim('rpg/hero.ts');
  const { finishDungeon } = await sim('rpg/run.ts');
  const { RPG } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/rpg.ts')).href);
  const items = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/rpg/items.json'), 'utf8'));
  const banco = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/buildings.json'), 'utf8')).find((b) => b.id === 'banco');
  const islands = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8'));
  const bancoCell = islands.find((i) => i.id === 'lotto')?.slots?.find((s) => s.kind === 'banco')?.at ?? [14, 14];

  let dev = null, log = '', OFF = 0;
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0), ('bea', 'Bea', 'tokB', 1);");
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
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: typeof b === 'string' ? b : JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const rpg = (t, azione) => post('/api/rpg', t, { azione });
    const lot = async (t) => (await get('/api/lot', t)).body;
    const P = RPG.partenza;

    await ctx.test('personaggio nuovo: /api/lot senza hero (= newHero), la prima azione lo scrive con la dotazione di partenza', async () => {
      const l = await lot('tokA');
      assert(l.hero === undefined || same(l.hero, newHero()), 'hero iniziale: ' + String(JSON.stringify(l.hero)).slice(0, 200));
      const r = await rpg('tokA', { t: 'equip', slot: 'arma', item: 'arco_legno' });
      assert(r.status === 200 && r.body.hero?.equip?.arma === 'arco_legno', 'equip arco: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
      assert(same(sorted(r.body.hero.inv), sorted(P.inv)) && r.body.hero.monete === P.monete, 'dotazione: ' + JSON.stringify(r.body.hero.inv));
      const back = await rpg('tokA', { t: 'equip', slot: 'arma', item: 'katana_legno' });
      assert(back.status === 200 && back.body.hero.equip.arma === 'katana_legno' && back.body.version > r.body.version, 'equip katana');
      const me = (await get('/api/me', 'tokA')).body;
      assert(me.lotto?.hero?.equip?.arma === 'katana_legno', '/api/me senza il personaggio');
    });

    await ctx.test('errori di /api/rpg: forma rotta 400, perk senza punti 409, libro che non hai 409, equip di un oggetto non tuo 409, deposita senza Forziere 409', async () => {
      for (const bad of [null, 'equip', { t: 'boh' }, { t: 'equip', slot: 'testa', item: 'x' }, { t: 'compra', item: 'lingotto_ferro', n: 0 }]) {
        const r = await rpg('tokA', bad);
        assert(r.status === 400 && typeof r.body.error === 'string', `forma ${JSON.stringify(bad)}: ${r.status}`);
      }
      const perk = await rpg('tokA', { t: 'perk', perk: 'fo_parsimonia' });
      assert(perk.status === 409 && perk.body.code === 'perk', 'perk senza punti: ' + JSON.stringify(perk));
      const libro = items.find((i) => i.kind === 'libro')?.id ?? 'libro_fiammata';
      const leggi = await rpg('tokA', { t: 'leggi', item: libro });
      assert(leggi.status === 409 && leggi.body.code === 'oggetto', 'leggi senza libro: ' + JSON.stringify(leggi));
      const eq = await rpg('tokA', { t: 'equip', slot: 'arma', item: 'katana_bronzo' });
      assert(eq.status === 409 && eq.body.code === 'oggetto', 'equip non tuo: ' + JSON.stringify(eq));
      const dep = await rpg('tokA', { t: 'deposita', item: 'frecce_legno', n: 5 });
      assert(dep.status === 409 && dep.body.code === 'edificio', 'deposita senza Forziere: ' + JSON.stringify(dep));
      const ign = await rpg('tokA', { t: 'perk', perk: 'non_esiste' });
      assert(ign.status === 404 && ign.body.code === 'sconosciuto', 'perk sconosciuto: ' + JSON.stringify(ign));
    });

    await ctx.test('Banco: si costruisce col lotto; in cantiere compra 409; finito (orologio di test) compra e forgia; monete finite 409', async () => {
      const b = await post('/api/lot/build', 'tokA', { building: 'banco', cell: bancoCell });
      assert(b.status === 200 && b.body.construction?.building === 'banco', 'build banco: ' + b.status + ' ' + JSON.stringify(b.body).slice(0, 200));
      const early = await rpg('tokA', { t: 'compra', item: 'lingotto_bronzo', n: 1 });
      assert(early.status === 409 && early.body.code === 'edificio', 'compra in cantiere: ' + JSON.stringify(early));
      OFF = (banco.levels[0].seconds + 60) * 1000;
      const l0 = await lot('tokA');
      assert(l0.buildings.find((x) => x.building === 'banco')?.level === 1, 'Banco non finito col clock di test');
      const prezzo = RPG.bottega.lingotto_bronzo;
      const c = await rpg('tokA', { t: 'compra', item: 'lingotto_bronzo', n: 1 });
      assert(c.status === 200 && c.body.hero.inv.lingotto_bronzo === 1 && c.body.hero.monete === P.monete - prezzo, 'compra: ' + JSON.stringify(c.body.hero ?? c.body).slice(0, 200));
      const f = await rpg('tokA', { t: 'forgia', item: 'nunchaku_legno' });
      assert(f.status === 200 && f.body.hero.inv.nunchaku_legno === 1, 'forgia: ' + f.status + ' ' + JSON.stringify(f.body).slice(0, 200));
      assert(f.body.resources.legno < c.body.resources.legno, `forgia senza Legno: ${c.body.resources.legno} → ${f.body.resources.legno}`);
      assert(f.body.hero.skill.forgiatura.xp > c.body.hero.skill.forgiatura.xp || f.body.hero.skill.forgiatura.lv > c.body.hero.skill.forgiatura.lv, 'forgia senza xp');
      if (P.monete - prezzo < prezzo) {
        const poor = await rpg('tokA', { t: 'compra', item: 'lingotto_bronzo', n: 1 });
        assert(poor.status === 409 && poor.body.code === 'risorse', 'compra senza monete: ' + JSON.stringify(poor));
      }
      const nonVende = await rpg('tokA', { t: 'compra', item: 'katana_bronzo', n: 1 });
      assert(nonVende.status === 409 && nonVende.body.code === 'oggetto', 'compra fuori bottega: ' + JSON.stringify(nonVende));
    });

    await ctx.test('spedizione: finish senza start 409; dungeon sconosciuto 400; start → seed e hero; input malformati 400; corpo > 512 KB 413', async () => {
      const no = await post('/api/dungeon/finish', 'tokB', { inputs: [[10, 0, 0, 0]], hash: 1 });
      assert(no.status === 409 && no.body.code === 'spedizione', 'finish senza start: ' + JSON.stringify(no));
      const bad = await post('/api/dungeon/start', 'tokB', { dungeon: 'atlantide' });
      assert(bad.status === 400, 'dungeon sconosciuto: ' + bad.status);
      const s = await post('/api/dungeon/start', 'tokB', { dungeon: 'grotta' });
      assert(s.status === 200 && s.body.dungeon === 'grotta' && Number.isInteger(s.body.seed) && s.body.hero?.arma && s.body.hero?.max?.vita > 0, 'start: ' + JSON.stringify(s.body).slice(0, 200));
      assert(s.body.lot?.dungeon?.pending?.seed === s.body.seed && same(s.body.lot.dungeon.pending.hero, s.body.hero), 'pending nel lotto');
      for (const inputs of ['rotto', [[0, 0, 0, 0]], [[5, 9, 0, 0]], [[5, 0, 0, 16]], [[dungeon.maxTicks + 1, 0, 0, 0]], [[1, 0.5, 0, 0]]]) {
        const r = await post('/api/dungeon/finish', 'tokB', { inputs, hash: 0 });
        assert(r.status === 400, `input ${JSON.stringify(inputs).slice(0, 40)}: ${r.status}`);
      }
      const big = await post('/api/dungeon/finish', 'tokB', '{"inputs":"' + 'x'.repeat(530_000) + '","hash":0}');
      assert(big.status === 413, 'corpo grande: ' + big.status);
      assert((await lot('tokB')).dungeon?.pending?.seed === s.body.seed, 'gli errori non devono chiudere la spedizione');
    });

    await ctx.test('spedizione giocata in Node (autopilot) → il DO rigioca: stesso esito, bottino e hash; bottino nello zaino come finishDungeon', async () => {
      const s = (await post('/api/dungeon/start', 'tokA', { dungeon: 'grotta' })).body;
      const st = dungeon.create({ seed: s.seed, dungeon: s.dungeon, hero: s.hero });
      const rng = createRng(s.seed), frames = [];
      while (!st.done && frames.length < dungeon.maxTicks) { const f = quantizeDungeon(autopilot(st, rng)); frames.push(f); dungeon.step(st, f); }
      const live = dungeon.result(st), inputs = packDungeon(frames);
      let t0 = performance.now();
      const expect = replayDungeon(s.seed, s.dungeon, s.hero, inputs);
      const nodeMs = performance.now() - t0;
      assert(expect.hash === live.hash, 'replay in Node diverso dalla partita in Node');
      const before = await lot('tokA');
      t0 = performance.now();
      const r = await post('/api/dungeon/finish', 'tokA', { inputs, hash: live.hash });
      const httpMs = performance.now() - t0;
      ctx.log(`dungeon ${s.dungeon} seed ${s.seed}: ${frames.length} tick, ${inputs.length} righe, ${JSON.stringify({ inputs }).length} B · replay Node ${nodeMs.toFixed(1)} ms · finish HTTP ${httpMs.toFixed(0)} ms · ${r.body.result?.outcome} · bottino ${JSON.stringify(r.body.result?.bottino)} · monete ${r.body.monete}`);
      assert(r.status === 200, 'finish: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
      const res = r.body.result;
      assert(res.outcome === expect.outcome && res.hash === expect.hash && res.ticks === expect.ticks, `esito ${res.outcome}/${res.hash} ≠ ${expect.outcome}/${expect.hash}`);
      assert(same(sorted(res.bottino), sorted(expect.bottino)) && res.monete === expect.monete, 'bottino diverso: ' + JSON.stringify(res.bottino) + ' vs ' + JSON.stringify(expect.bottino));
      assert(Object.keys(expect.bottino).length > 0, 'l’autopilot non ha raccolto niente: test debole');
      const want = finishDungeon(before, expect, before.nowMs);
      assert(same(sorted(r.body.tenuto), sorted(want.tenuto)) && r.body.monete === want.monete && r.body.livelliSu === want.livelliSu, 'tenuto/monete diversi da finishDungeon: ' + JSON.stringify(r.body.tenuto));
      assert(same(sorted(r.body.lot.hero.inv), sorted(want.lot.hero.inv)), 'zaino diverso: ' + JSON.stringify(r.body.lot.hero.inv));
      assert(r.body.lot.hero.monete === before.hero.monete + r.body.monete && r.body.lot.hero.discese === (before.hero.discese ?? 0) + 1, 'monete/discese');
      if (res.outcome === 'uscito') for (const [id, n] of Object.entries(r.body.tenuto)) assert(n > 0 && n <= res.bottino[id], `tenuto ${id} ${n} > ${res.bottino[id]}`);
      assert(r.body.lot.dungeon?.pending === null, 'la spedizione resta aperta');
      const again = await post('/api/dungeon/finish', 'tokA', { inputs, hash: live.hash });
      assert(again.status === 409 && again.body.code === 'spedizione', 'secondo finish: ' + again.status);
    });

    await ctx.test('hash del client diverso: risponde lo stesso con l’esito del server e lo scrive nel log', async () => {
      const s = (await post('/api/dungeon/start', 'tokB', { dungeon: 'grotta' })).body;
      const inputs = [[90, 0, -8, 0], [30, 8, 0, 2]];
      const expect = replayDungeon(s.seed, s.dungeon, s.hero, inputs);
      const r = await post('/api/dungeon/finish', 'tokB', { inputs, hash: (expect.hash ^ 12345) >>> 0 });
      assert(r.status === 200 && r.body.result.hash === expect.hash && r.body.result.outcome === expect.outcome, 'finish con hash sbagliato: ' + JSON.stringify(r.body).slice(0, 200));
      if (expect.outcome !== 'uscito') assert(Object.keys(r.body.tenuto).length === 0 && r.body.monete === 0, 'spedizione non finita: niente bottino');
      for (let i = 0; i < 20 && !log.includes('dungeon hash diverso'); i++) await sleep(100);
      assert(log.includes('[marea] dungeon hash diverso'), 'manca l’avviso nel log di wrangler');
    });

    await ctx.test('altare: save senza altare 409; input fino all’altare → save ok (uno più vecchio non lo copre); la discesa dopo chiude la spedizione interrotta', async () => {
      const s = (await post('/api/dungeon/start', 'tokB', { dungeon: 'grotta' })).body;
      const no = await post('/api/dungeon/save', 'tokB', { inputs: [[30, 0, 0, 0]], hash: 0 });
      assert(no.status === 409 && no.body.code === 'altare', 'save senza altare: ' + JSON.stringify(no));
      // in Node: dall'uscita all'altare più vicino lungo le distanze BFS, input quantizzati come il client
      const st = dungeon.create({ seed: s.seed, dungeon: s.dungeon, hero: s.hero }), m = st.map, frames = [];
      const fromExit = bfs(m, m.exit.cz * m.w + m.exit.cx);
      const alt = [...m.altari].sort((a, b) => fromExit[a.cz * m.w + a.cx] - fromExit[b.cz * m.w + b.cx])[0];
      const to = alt.cz * m.w + alt.cx, field = bfs(m, to);
      while (!st.salvato && !st.done && frames.length < 60 * 60) {
        const c = cellOf(m, st.hero.x, st.hero.z), next = c === to ? to : stepDown(m, field, c), p = cellCenter(m, next >= 0 ? next : to);
        const dx = p.x - st.hero.x, dz = p.z - st.hero.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
        const f = quantizeDungeon({ mx: dx / d, my: dz / d, a: false, b: false, c: false, d: false });
        frames.push(f); dungeon.step(st, f);
      }
      assert(st.salvato, `l’eroe non è arrivato all’altare (${frames.length} tick, ${st.outcome})`);
      const inputs = encodeDungeon(packDungeon(frames)), hash = dungeon.result(st).hash;
      const ok = await post('/api/dungeon/save', 'tokB', { inputs, hash });
      assert(ok.status === 200 && ok.body.ok && ok.body.ticks === frames.length && same(ok.body.salvato, dungeon.result(st).salvato), 'save: ' + JSON.stringify(ok.body).slice(0, 200));
      const old = await post('/api/dungeon/save', 'tokB', { inputs: encodeDungeon(packDungeon(frames.slice(0, -1).concat([frames.at(-1)]))), hash });
      assert(old.status === 200 && old.body.ticks === frames.length, 'secondo save uguale: ' + JSON.stringify(old.body).slice(0, 120));
      const l1 = await lot('tokB');
      assert(l1.dungeon?.pending?.salvataggio?.ticks === frames.length, 'salvataggio nel lotto');
      // scheda chiusa: niente finish; la discesa dopo chiude quella spedizione col bottino dell'altare e ne apre una nuova
      const again = (await post('/api/dungeon/start', 'tokB', { dungeon: 'grotta' })).body;
      assert(again.recuperato && same(sorted(again.recuperato.tenuto), sorted(dungeon.result(st).salvato.bottino)) && again.recuperato.monete === dungeon.result(st).salvato.monete, 'recuperato: ' + JSON.stringify(again.recuperato));
      assert(again.lot.hero.discese === (l1.hero.discese ?? 0) + 1 && again.lot.dungeon.pending.seed === again.seed && !again.lot.dungeon.pending.salvataggio, 'spedizione vecchia chiusa, nuova aperta');
    });

    await ctx.test('Regata da solo: solo il premio, il personaggio non cambia (Navigazione tolta)', async () => {
      const h0 = (await lot('tokB')).hero;
      const s = (await post('/api/solo/start', 'tokB', { minigame: 'regata' })).body;
      const st = regata.create({ seed: s.seed, difficulty: s.difficulty });
      const rng = createRng(s.seed), frames = [];
      while (!st.done) { const f = quantize(regata.autopilot(st, rng)); frames.push(f); regata.step(st, f); }
      const r = await post('/api/solo/play', 'tokB', { inputs: packInputs(frames) });
      assert(r.status === 200, 'solo play: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
      ctx.log(`regata ${r.body.medal} → premio ${JSON.stringify(r.body.premio)}`);
      assert(same(r.body.lot.hero, h0), 'la Regata ha cambiato il personaggio: ' + JSON.stringify(r.body.lot.hero?.skill));
      assert(!('navigazione' in (h0?.skill ?? {})), 'abilità Navigazione ancora nel personaggio');
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
