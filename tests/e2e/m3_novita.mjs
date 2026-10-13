// «Dall'ultima volta» (#279): la build scrive /novita.json dal git log; all'ingresso, se ci sono lavori nuovi dalla visita scorsa,
// una schermata con due righe per persona. Qui: il file c'è ed è ben fatto; coi lavori di prova la schermata elenca le persone (chi ha
// fatto di più prima, PR solo di test fuori dal riassunto), «tutto ▾» apre l'elenco, «Si gioca» chiude e salva la visita: con gli stessi
// lavori non torna, con uno nuovo sì (solo quello). Screenshot del telefono.
export const timeout = 120000;

const ORA = 1_800_000_000;
const LAVORI = [
  { t: ORA - 3600, chi: 'Riccardo', titolo: 'Borgo Marea a vicoli: città più piccola e viva, case a schiera, arredo e paesani (#265)' },
  { t: ORA - 7200, chi: 'Jack', titolo: 'Corse: menù di scelta alla Mario Kart per pista e veicolo' },
  { t: ORA - 9000, chi: 'Jack', titolo: 'Corse: un fondale dipinto per pista, la Miniera ha il suo' },
  { t: ORA - 9500, chi: 'Jack', titolo: 'Corse: HUD in gara e risultati alla Mario Kart' },
  { t: ORA - 9800, chi: 'Jack', titolo: 'Teletrasporto sulle isole per tutti i giocatori: bottone TP, elenco dalle isole del mondo' },
  { t: ORA - 9900, chi: 'Jack', titolo: 'Test m4_provapiste: una pagina alla volta' },
  { t: ORA - 10000, chi: 'Albi', titolo: 'Discesa in bici, passo 4: tasto SALTO (carica, stacco, impennata), scatto a metà energia' },
  { t: ORA - 30 * 86400, chi: 'Albi', titolo: 'vecchio: non deve comparire' },
];

export default async function (ctx) {
  const { assert } = ctx;
  await ctx.test('la build scrive /novita.json coi lavori di main', async () => {
    const r = await fetch(`${ctx.base}/novita.json`);
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(Array.isArray(d.lavori) && d.lavori.length >= 1, 'nessun lavoro');
    for (const l of d.lavori) { assert.ok(Number.isFinite(l.t) && l.chi && l.titolo, JSON.stringify(l)); assert.ok(!/\(#\d+\)/.test(l.titolo), `riferimento alla PR rimasto: ${l.titolo}`); }
  });

  const p = await ctx.open('?test=1&net=0&nosound=1');
  await ctx.waitReady(p.page, 30000);
  const leggi = () => p.page.evaluate(() => {
    const c = document.getElementById('mzNovita');
    return c ? [...c.querySelectorAll('.chi')].map((b) => ({ nome: b.querySelector('.nome')?.firstChild?.textContent, cosa: b.querySelector('.cosa')?.textContent, n: b.querySelectorAll('li').length })) : null;
  });
  await ctx.test('coi test non compare da sola (serve ?novita=1)', async () => {
    await p.page.waitForTimeout(500);
    assert.equal(await leggi(), null);
  });
  await ctx.test('lavori nuovi: una riga per persona, chi ha fatto di più prima', async () => {
    await p.page.evaluate(([l, o]) => window.__game.test.novitaProva(l, o), [LAVORI, ORA]);
    await p.page.waitForSelector('#mzNovita', { timeout: 10000 });
    const g = await leggi();
    assert.equal(JSON.stringify(g.map((x) => x.nome)), JSON.stringify(['Jack ha fatto', 'Riccardo ha fatto', 'Albi ha fatto']));
    assert.equal(g[0].n, 5, 'Jack: 5 lavori nell\'elenco');
    assert.ok(g[0].cosa.startsWith('Corse (3): menù di scelta alla Mario Kart per pista e veicolo; un fondale dipinto per pista…'), g[0].cosa);
    assert.ok(!g[0].cosa.includes('m4_provapiste'), 'le PR solo di test non vanno nel riassunto');
    assert.equal(g[2].cosa, 'Discesa in bici: tasto SALTO');
    assert.ok(!JSON.stringify(g).includes('vecchio'), 'un lavoro di 30 giorni fa alla prima visita');
  });
  await ctx.shot(p.page, 'iphone_novita');
  await ctx.test('«tutto ▾» apre l\'elenco intero', async () => {
    const vis = await p.page.evaluate(() => { const b = document.querySelector('#mzNovita .chi'); b.querySelector('.tutto').click(); return getComputedStyle(b.querySelector('ul')).display; });
    assert.equal(vis, 'block');
  });
  await ctx.test('«Si gioca» chiude; con gli stessi lavori non torna, con uno nuovo sì', async () => {
    await p.page.click('#mzNovita .ok');
    assert.equal(await leggi(), null);
    await p.page.evaluate(([l, o]) => window.__game.test.novitaProva(l, o), [LAVORI, ORA + 60]);
    await p.page.waitForTimeout(800);
    assert.equal(await leggi(), null, 'tornata senza niente di nuovo');
    const nuovo = [...LAVORI, { t: ORA + 30, chi: 'Riccardo', titolo: 'Dungeon: magie di fuoco ed elettricità differenziate' }];
    await p.page.evaluate(([l, o]) => window.__game.test.novitaProva(l, o), [nuovo, ORA + 60]);
    await p.page.waitForSelector('#mzNovita', { timeout: 10000 });
    const g = await leggi();
    assert.equal(JSON.stringify(g.map((x) => [x.nome, x.cosa])), JSON.stringify([['Riccardo ha fatto', 'Dungeon: magie di fuoco ed elettricità differenziate']]));
    await p.page.keyboard.press('Escape');
    assert.equal(await leggi(), null, 'Esc non chiude');
  });
  ctx.noErrors(p, 'novita');
}
