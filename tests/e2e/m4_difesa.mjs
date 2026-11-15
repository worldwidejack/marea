// La pagina della Difesa a corsie alla Plants vs Zombies (difesa.html, #358; docs/DIFESA.md). Cosa si controlla:
// - la pagina si apre senza errori; senza parametri compare il menù dei livelli; con ?livello parte subito;
// - telefono in orizzontale (844×390) e PC (1280×720), nel livello 6 (6 carte) e nel 12 (8 carte scelte su 11): la barra delle carte e la barra
//   delle ondate non si coprono e stanno nello schermo, il campo si vede tutto, disegnare un frame costa poco (meno di 30 ms: sui server di GitHub tutto è molto più lento);
// - si pianta toccando la carta e poi la casella (mouse e tocco) e trascinando la carta sulla casella; senza valuta la carta non va;
// - si raccoglie una moneta toccandola (la valuta sale di 25);
// - il pilota automatico vince il livello 1 e il livello 5; la schermata di vittoria ha il nuovo difensore e AVANTI;
// - chi non difende perde il livello 3: «HANNO SFONDATO!» e RIPROVA ricomincia;
// - col telefono in verticale compare «GIRA IL TELEFONO»;
// - di serie si carica la pelle dell'orto (#379: fotogrammi di Codex, fondale, suoni) e non quella di riserva; chi aveva salvato la
//   segnaposto passa all'orto; ?stile=segnaposto la apre ancora.
// Screenshot in tests/out/shots/m4_difesa_*, numeri in tests/out/m4_difesa.json.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 300000;
const TEL = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const VERT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default async function (ctx) {
  const { assert } = ctx;
  const numeri = {};
  const apri = async (qs, viewport) => {
    for (const x of ctx._pages.splice(0)) await x.close().catch(() => {});
    const p = await ctx.open('difesa.html' + qs, { viewport });
    try { await p.page.waitForFunction(() => window.__difesa && window.__difesa.ready === true, null, { timeout: 60000 }); } catch {
      throw new Error(`non pronta · errori ${p.errors.join(' | ')} · richieste fallite ${p.failed.join(' | ')}`);
    }
    return p;
  };
  const box = (page, sel) => page.evaluate((q) => Array.from(document.querySelectorAll(q)).filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }), sel);
  const stato = (page) => page.evaluate(() => window.__difesa.state());

  let p = await apri('', PC);
  await ctx.test('pc: si apre senza errori col menù dei livelli', async () => {
    assert(p.errors.length === 0, p.errors.join('\n'));
    const st = await stato(p.page);
    assert(st.menu && !st.inGioco, `menù: ${JSON.stringify(st)}`);
    const liv = await box(p.page, '.df-liv');
    assert(liv.length === 12, `livelli: ${liv.length}`);
    await ctx.shot(p.page, 'pc_menu');
  });

  await ctx.test("pc: di serie la pelle dell'orto, con i fotogrammi e i suoni", async () => {
    const st = await stato(p.page);
    assert(st.stile === 'orto' && st.pelle === 'orto', `pelle caricata: ${st.stile} / ${st.pelle} · fallite ${p.failed.join(' | ')}`);
    const pl = await p.page.evaluate(() => window.__difesa.pelle());
    for (const k of ['sparatore', 'produttore', 'bomba', 'muro', 'mina', 'gelo', 'tosaerba', 'base', 'cono', 'secchio', 'secchioNudo', 'bandiera', 'saltatore', 'colpo', 'moneta', 'armaturaCono', 'armaturaSecchio',
      'mangiatutto', 'ripetitore', 'muroAlto', 'potenziatore', 'mortaio', 'scudo', 'scudoNudo', 'volante', 'gigante', 'colpoFuoco', 'palla', 'armaturaFoglia']) assert(pl.sprite[k], `manca lo sprite ${k}`);
    assert(pl.sprite.base.cammina >= 4 && pl.sprite.base.mangia >= 3 && pl.sprite.base.ko === 1, `lumaca: ${JSON.stringify(pl.sprite.base)}`);
    assert(pl.sprite.sparatore.spara >= 1 && pl.sprite.sparatore.carica >= 1, `carota: ${JSON.stringify(pl.sprite.sparatore)}`);
    assert(pl.sprite.secchio.cammina >= 4, `scarabeo col vasetto: ${JSON.stringify(pl.sprite.secchio)}`);
    assert(pl.sprite.scudo.cammina >= 4 && pl.sprite.scudoNudo.corre >= 4 && pl.sprite.volante.cammina >= 3 && pl.sprite.gigante.mangia >= 3 && pl.sprite.mangiatutto.mastica >= 2, `i nuovi: ${JSON.stringify([pl.sprite.scudo, pl.sprite.scudoNudo, pl.sprite.volante, pl.sprite.gigante, pl.sprite.mangiatutto])}`);
    numeri.clip = Object.fromEntries(Object.entries(pl.sprite).map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0)]));
    // i suoni da file partono al primo tocco (regola dei browser)
    await p.page.mouse.click(5, 5);
    await p.page.waitForFunction(() => window.__difesa.state().suoni >= 19, null, { timeout: 20000 }).catch(() => {});
    const sn = (await stato(p.page)).suoni;
    numeri.suoni = sn;
    assert(sn >= 19, `suoni da file pronti: ${sn}`);
  });

  await ctx.test('chi aveva salvato la pelle segnaposto passa all\'orto; ?stile=segnaposto la apre ancora', async () => {
    await p.page.evaluate(() => { localStorage.setItem('marea.difesa', JSON.stringify({ stile: 'segnaposto', sbloccati: 2 })); });
    await p.page.reload();
    await p.page.waitForFunction(() => window.__difesa && window.__difesa.ready === true, null, { timeout: 60000 });
    let st = await stato(p.page);
    assert(st.pelle === 'orto', `dopo la migrazione: ${st.pelle}`);
    p = await apri('?stile=segnaposto&livello=1&prova=1', PC);
    st = await stato(p.page);
    assert(st.pelle === 'segnaposto' && p.errors.length === 0, `segnaposto: ${st.pelle} · ${p.errors.join(' | ')}`);
  });

  for (const [nome, vp, lv] of [['telefono', TEL, 6], ['pc', PC, 6], ['telefono', TEL, 12], ['pc', PC, 12]]) {
    p = await apri(`?livello=${lv}&prova=1&seme=3`, vp);
    await ctx.test(`${nome}: livello ${lv}, barre dentro lo schermo e che non si coprono, campo intero, frame veloce`, async () => {
      assert(p.errors.length === 0, p.errors.join('\n'));
      const [barra] = await box(p.page, '.df-barra'), [onda] = await box(p.page, '.df-onda'), [tasti] = await box(p.page, '.df-tasti');
      for (const b of [barra, onda, tasti]) assert(b[0] >= 0 && b[1] >= 0 && b[2] <= vp.width + 1 && b[3] <= vp.height + 1, `fuori dallo schermo: ${JSON.stringify(b)}`);
      assert(barra[2] <= tasti[0] || barra[3] <= tasti[1], `la barra copre i tasti: ${JSON.stringify([barra, tasti])}`);
      const a = await p.page.evaluate(() => window.__difesa.casella(0, 0)), z = await p.page.evaluate(() => window.__difesa.casella(8, 4));
      assert(a[0] > 0 && a[1] > barra[3] && z[0] < vp.width && z[1] < vp.height, `campo fuori: ${JSON.stringify([a, z])}`);
      const st = await p.page.evaluate(() => { const D = window.__difesa; D.set({ auto: 'bravo' }); D.avanti(60 * 120); D.set({ auto: null }); for (let i = 0; i < 20; i++) D.rendi(); return { st: D.state(), perf: D.perf() }; });
      numeri[`${nome}_livello${lv}`] = st.perf;
      ctx.log(`${nome}: ${st.perf.sprite} sprite, ${st.perf.ms} ms a frame, ${st.st.unita} difensori, ${st.st.nemici} nemici`);
      assert(st.perf.ms < 30, `frame lento: ${st.perf.ms} ms`);
      assert(st.st.unita >= 8, `il pilota ha piantato: ${st.st.unita}`);
      await ctx.shot(p.page, `${nome}_livello${lv}`);
    });
  }

  for (const [nome, vp] of [['telefono', TEL], ['pc', PC]]) {
    await ctx.test(`${nome}: sopra le 8 carte sbloccate si sceglie quali portare (al massimo 8), la scelta resta, la barra ha solo quelle`, async () => {
      p = await apri('?livello=12&seme=3', vp);
      const { page } = p;
      assert((await stato(page)).menu && !(await stato(page)).inGioco, 'prima della partita c\'è la scelta');
      const tessere = () => page.evaluate(() => Array.from(document.querySelectorAll('.df-sc')).map((b) => ({ on: b.classList.contains('on'), nome: b.querySelector('span')?.textContent ?? '', nuova: !!b.querySelector('.df-nuova') })));
      let t = await tessere();
      assert(t.length === 11 && t.filter((x) => x.on).length === 8, `11 carte, 8 già scelte: ${JSON.stringify(t.map((x) => x.on))}`);
      const conta = () => page.textContent('.df-conta');
      assert(/8 \/ 8/.test((await conta()) ?? ''), await conta());
      // il pulsante VIA! sta dentro lo schermo (il pannello scorre se serve)
      const via = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.df-velo.su button')).find((x) => /VIA/.test(x.textContent ?? '')); b?.scrollIntoView({ block: 'nearest' }); const r = b?.getBoundingClientRect(); return r ? [r.left, r.top, r.right, r.bottom] : null; });
      assert(via && via[0] >= 0 && via[2] <= vp.width && via[3] <= vp.height, `VIA! dentro lo schermo: ${JSON.stringify(via)}`);
      await ctx.shot(page, `${nome}_scelta_carte`);
      // una in più non entra; toglierne una e metterne un'altra sì
      const tocca = (i) => page.evaluate((k) => document.querySelectorAll('.df-sc')[k].click(), i);
      const fuori = t.findIndex((x) => !x.on), dentro = t.findIndex((x) => x.on);
      await tocca(fuori);
      assert((await tessere()).filter((x) => x.on).length === 8, 'la nona non entra');
      await tocca(dentro); await tocca(fuori);
      t = await tessere();
      assert(t.filter((x) => x.on).length === 8 && t[fuori].on && !t[dentro].on, 'scambiata');
      const portate = t.filter((x) => x.on).map((x) => x.nome);
      await page.evaluate(() => { Array.from(document.querySelectorAll('.df-velo.su button')).find((x) => /VIA/.test(x.textContent ?? '')).click(); });
      const st = await stato(page);
      assert(st.inGioco && st.carte.length === 8, `parte con 8 carte: ${JSON.stringify(st.carte)}`);
      const barra = await page.evaluate(() => document.querySelectorAll('.df-carta').length);
      assert(barra === 8, `carte nella barra: ${barra}`);
      const [bb] = await box(page, '.df-barra'), [tt] = await box(page, '.df-tasti');
      assert(bb[2] <= tt[0] || bb[3] <= tt[1], `la barra copre i tasti: ${JSON.stringify([bb, tt])}`);
      // la scelta si ricorda: riaprendo il livello è la stessa
      await page.reload();
      await page.waitForFunction(() => window.__difesa && window.__difesa.ready === true, null, { timeout: 60000 });
      const t2 = await p.page.evaluate(() => Array.from(document.querySelectorAll('.df-sc.on span')).map((b) => b.textContent));
      assert(JSON.stringify(t2.slice().sort()) === JSON.stringify(portate.slice().sort()), `scelta ricordata: ${t2} contro ${portate}`);
      assert(p.errors.length === 0, p.errors.join('\n'));
      // ai livelli con poche carte non si sceglie: parte subito
      p = await apri('?livello=5&seme=3', vp);
      assert((await stato(p.page)).inGioco && (await p.page.evaluate(() => document.querySelectorAll('.df-sc').length)) === 0, 'livello 5: niente scelta');
    });
  }

  await ctx.test('telefono: carta e casella col tocco, carta trascinata sulla casella, senza valuta non pianta', async () => {
    p = await apri('?livello=4&prova=1&seme=5', TEL);
    const { page } = p;
    await page.evaluate(() => window.__difesa.set({ valuta: 1000 }));
    const carta = (await box(page, '.df-carta'))[0];
    await page.touchscreen.tap((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
    const c1 = await page.evaluate(() => window.__difesa.casella(2, 1));
    await page.touchscreen.tap(c1[0], c1[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    let st = await stato(page);
    assert(st.unita === 1, `piantato col tocco: ${st.unita}`);
    // trascinata: la seconda carta (produttore) sulla casella (0, 3)
    const c2 = (await box(page, '.df-carta'))[1], d = await page.evaluate(() => window.__difesa.casella(0, 3));
    await page.mouse.move((c2[0] + c2[2]) / 2, (c2[1] + c2[3]) / 2); await page.mouse.down();
    await page.mouse.move(d[0], d[1], { steps: 8 }); await page.mouse.up();
    await page.evaluate(() => window.__difesa.avanti(1));
    st = await stato(page);
    assert(st.unita === 2, `piantato trascinando: ${st.unita}`);
    await page.evaluate(() => window.__difesa.set({ valuta: 0 }));
    const c3 = await page.evaluate(() => window.__difesa.casella(3, 2));
    await page.touchscreen.tap((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
    await page.touchscreen.tap(c3[0], c3[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    st = await stato(page);
    assert(st.unita === 2, `senza valuta non pianta: ${st.unita}`);
    assert(p.errors.length === 0, p.errors.join('\n'));
  });

  await ctx.test('telefono: dopo l\'avviso «ARRIVANO!» (e col consiglio in basso) i tocchi sul campo arrivano ancora', async () => {
    p = await apri('?livello=2&seme=5', TEL);
    const { page } = p;
    await page.evaluate(() => window.__difesa.set({ valuta: 1000 }));
    // sim a passi con gli effetti (premi) finché compare un avviso: gli elementi invisibili non devono rubare i tocchi
    const testo = await page.evaluate(() => { const D = window.__difesa; for (let i = 0; i < 60 * 120 && !document.querySelector('.df-avviso').textContent; i++) D.premi({ t: 'raccogli', id: -1 }); return document.querySelector('.df-avviso').textContent; });
    assert(testo, 'è comparso un avviso');
    await page.evaluate(() => { document.querySelector('.df-avviso').style.transition = 'none'; document.querySelector('.df-avviso').classList.remove('su'); });
    const sopra = await page.evaluate(() => { const D = window.__difesa, r = []; for (let c = 0; c < 9; c++) for (let l = 0; l < 5; l++) { const [x, y] = D.casella(c, l), e = document.elementFromPoint(x, y); if (e?.id !== 'tela') r.push(`${c},${l}: ${e?.className}`); } return r; });
    assert(sopra.length === 0, `elementi che coprono il campo: ${sopra.join(' | ')}`);
    const carta = (await box(page, '.df-carta'))[0], av = (await box(page, '.df-avviso'))[0];
    const c = await page.evaluate((b) => { const D = window.__difesa; for (let l = 0; l < 5; l++) { const [x, y] = D.casella(2, l); if (y > b[1] && y < b[3]) return [x, y, l]; } return null; }, av);
    if (c) {
      await page.touchscreen.tap((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
      await page.touchscreen.tap(c[0], c[1]);
      await page.evaluate(() => window.__difesa.avanti(1));
      assert((await stato(page)).unita >= 1, 'piantato toccando sotto la fascia dell\'avviso');
    }
    assert(p.errors.length === 0, p.errors.join('\n'));
  });

  await ctx.test('pc: col mouse si pianta e si raccoglie una moneta (+25)', async () => {
    p = await apri('?livello=2&prova=1&seme=8', PC);
    const { page } = p;
    await page.evaluate(() => window.__difesa.set({ valuta: 100 }));
    const carta = (await box(page, '.df-carta'))[0], c = await page.evaluate(() => window.__difesa.casella(1, 2));
    await page.mouse.click((carta[0] + carta[2]) / 2, (carta[1] + carta[3]) / 2);
    await page.mouse.click(c[0], c[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    assert((await stato(page)).unita === 1, 'piantato col mouse');
    // aspetta una moneta dal cielo a terra e la tocca
    const m = await page.evaluate(() => { const D = window.__difesa; for (let i = 0; i < 60 * 20; i++) { D.avanti(1); const s = D.partita(); const mm = s.monete.find((x) => s.tick >= x.atterra); if (mm) return { id: mm.id, v: s.valuta }; } return null; });
    assert(m, 'è caduta una moneta');
    await page.evaluate(() => window.__difesa.rendi());
    const dove = await page.evaluate((id) => window.__difesa.moneta(id), m.id);
    await page.mouse.click(dove[0], dove[1]);
    await page.evaluate(() => window.__difesa.avanti(1));
    const st = await stato(page);
    assert(st.valuta === m.v + 25, `valuta ${m.v} → ${st.valuta}`);
    await ctx.shot(page, 'pc_moneta');
  });

  await ctx.test('pc: il pilota automatico vince il livello 1 e il 5, con la schermata di vittoria', async () => {
    for (const lv of [1, 5]) {
      p = await apri(`?livello=${lv}&prova=1&seme=${lv + 10}`, PC);
      const st = await p.page.evaluate(() => { const D = window.__difesa; D.set({ auto: 'bravo' }); return D.avanti(60 * 60 * 12); });
      numeri[`livello${lv}`] = { esito: st.esito, minuti: Math.round(st.tick / 360) / 10, tosaerba: st.tosaerba, uccisi: st.uccisi };
      assert(st.esito === 'vinta', `livello ${lv}: ${st.esito} all'ondata ${st.ondata}`);
      await p.page.waitForSelector('.df-velo.su .df-pan h1', { timeout: 5000 });
      const testo = await p.page.textContent('.df-velo.su .df-pan');
      assert(/DIFESA RIUSCITA/.test(testo ?? '') && /AVANTI/.test(testo ?? ''), testo ?? '');
      assert(/NUOVO DIFENSORE/.test(testo ?? ''), 'il premio: nuovo difensore');
      await ctx.shot(p.page, `pc_vinta_livello${lv}`);
    }
  });

  await ctx.test('pc: chi non difende perde il livello 3; RIPROVA ricomincia', async () => {
    p = await apri('?livello=3&prova=1&seme=2', PC);
    const st = await p.page.evaluate(() => window.__difesa.avanti(60 * 60 * 10));
    assert(st.esito === 'persa', `esito: ${st.esito}`);
    await p.page.waitForSelector('.df-velo.su .df-pan h1', { timeout: 5000 });
    assert(/HANNO SFONDATO/.test((await p.page.textContent('.df-velo.su .df-pan')) ?? ''));
    await ctx.shot(p.page, 'pc_persa');
    await p.page.click('.df-velo.su button:has-text("RIPROVA")');
    const st2 = await stato(p.page);
    assert(st2.esito === '' && st2.tick < 60 && st2.livello === 2, `RIPROVA: ${JSON.stringify(st2)}`);
  });

  await ctx.test('telefono in verticale: «GIRA IL TELEFONO»', async () => {
    p = await apri('?livello=1', VERT);
    const g = await box(p.page, '.df-gira.su');
    assert(g.length === 1, 'manca il cartello');
    await ctx.shot(p.page, 'verticale');
  });

  fs.writeFileSync(path.join(ctx.OUT, 'm4_difesa.json'), JSON.stringify(numeri, null, 1) + '\n');
}
