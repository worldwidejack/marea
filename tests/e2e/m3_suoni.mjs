// Suoni e musica (audio/, tutto sintetizzato in WebAudio): con ?nosound=1 il motore non si scarica mai; coi test (?test=1) si parte
// muti; accesi dalle Impostazioni, al primo gesto il contesto parte e i bus hanno volume. Camminare fa i passi (in base alla tile),
// salire e scendere dalla barca fa il tonfo, i pannelli fanno il clic di legno, la musica passa da giorno a notte col ciclo e a «gara»
// quando la si forza. 10 s registrati offline (OfflineAudioContext) per ogni musica: picco < 1 (niente clipping), non silenzio;
// i WAV restano in tests/out/suoni_<musica>.wav per ascoltarli.
import fs from 'node:fs';
import path from 'node:path';

export const timeout = 300000;
export default async function (ctx) {
  const hook = (p, name, ...a) => p.page.evaluate(([n, args]) => window.__game.test[n](...args), [name, a]);
  const audio = async (p) => (await ctx.getState(p.page)).audio;
  const waitAudio = (p, fn, ms = 8000) => ctx.waitState(p.page, `(s) => (${fn})(s.audio || {})`, ms);

  const q = await ctx.open('?test=1&net=0&nosound=1');
  await ctx.waitReady(q.page, 20000);
  await ctx.test('?nosound=1: il motore non si scarica nemmeno con l’audio acceso', async () => {
    await hook(q, 'impostazioni', { musica: 3, effetti: 3 });
    await q.page.keyboard.press('Shift'); await q.page.waitForTimeout(800);
    const a = await audio(q);
    ctx.assert(a && a.nosound === true && a.caricato === false, `audio con nosound: ${JSON.stringify(a)}`);
    ctx.noErrors(q, 'nosound');
  });
  await q.page.close();

  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  await ctx.test('coi test si parte muti: niente motore', async () => {
    const st = await ctx.getState(p.page);
    ctx.assert(st.impostazioni.musica === 0 && st.impostazioni.effetti === 0, `impostazioni ${JSON.stringify(st.impostazioni)}`);
    await p.page.keyboard.press('Shift'); await p.page.waitForTimeout(500);
    const a = await audio(p);
    ctx.assert(a && a.caricato === false && a.gesto === true, `audio: ${JSON.stringify(a)}`);
  });
  await ctx.test('accesi dalle Impostazioni: al gesto il contesto parte, bus con volume', async () => {
    await hook(p, 'impostazioni', { musica: 2, effetti: 3 });
    await hook(p, 'audioPronto');
    await p.page.keyboard.press('Shift');
    await waitAudio(p, (a) => a.caricato && a.contesto === 'running' && a.bus.effetti > 0.5 && a.bus.musica > 0.1);
    const a = await audio(p); ctx.log('audio', JSON.stringify({ contesto: a.contesto, bus: a.bus, musica: a.musica }));
    ctx.assert(a.musica === 'giorno', `musica ${a.musica}`);
  });
  await ctx.test('camminare fa i passi', async () => {
    await hook(p, 'teleport', 265, 275); await p.page.waitForTimeout(200);
    for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowDown']) { await p.page.keyboard.down(k); await p.page.waitForTimeout(900); await p.page.keyboard.up(k); }
    const a = await audio(p);
    const passi = a.visti.filter((id) => id.startsWith('passo_'));
    ctx.log('passi', passi.join(' '), '· suonati', a.suonati);
    ctx.assert(passi.length > 0, `nessun passo: ${JSON.stringify(a.visti)}`);
  });
  await ctx.test('salire e scendere dalla barca', async () => {
    await hook(p, 'setMode', 'boat'); await waitAudio(p, (a) => a.visti.includes('barca_su'), 3000);
    await hook(p, 'setMode', 'walk'); await waitAudio(p, (a) => a.visti.includes('barca_giu'), 3000);
  });
  await ctx.test('aprire e chiudere un pannello', async () => {
    await p.page.click('#mzSetBtn'); await waitAudio(p, (a) => a.visti.includes('apri'), 3000);
    await ctx.shot(p.page, 'iphone_impostazioni_audio');
    await p.page.click('#mzSet [data-musica="3"]');
    ctx.assert((await ctx.getState(p.page)).impostazioni.musica === 3, 'clic su Musica ALTA non salvato');
    await p.page.keyboard.press('Escape'); await waitAudio(p, (a) => a.visti.includes('chiudi'), 3000);
  });
  await ctx.test('i suoni chiamati dal ponte (monete, martello, medaglie, boa, emote)', async () => {
    for (const id of ['moneta', 'martello', 'medaglia_oro', 'medaglia_argento', 'medaglia_bronzo', 'boa', 'raffica', 'notifica']) { await hook(p, 'suona', id, 0.5); await p.page.waitForTimeout(60); }
    await hook(p, 'emote', 'saluto').catch(() => null);
    const a = await audio(p);
    for (const id of ['moneta', 'martello', 'medaglia_oro', 'medaglia_argento', 'medaglia_bronzo', 'boa', 'raffica', 'notifica']) ctx.assert(a.visti.includes(id), `${id} non suonato`);
  });
  await ctx.test('musica: di notte cambia, gara forzata, ambiente coi grilli', async () => {
    await hook(p, 'impostazioni', { ciclo: true }); await hook(p, 'aspettoPronto');
    await hook(p, 'ciclo', 0.78);
    await waitAudio(p, (a) => a.musica === 'notte', 5000);
    await waitAudio(p, (a) => a.ambiente.grilli > 0, 6000);
    await hook(p, 'musica', 'gara'); await waitAudio(p, (a) => a.musica === 'gara', 3000);
    await hook(p, 'musica', 'auto'); await hook(p, 'ciclo', 0.2); await waitAudio(p, (a) => a.musica === 'giorno', 5000);
    const a = await audio(p); ctx.log('ambiente', JSON.stringify(a.ambiente), 'terra', a.terra);
    ctx.assert(a.ambiente.onde > 0, 'le onde non respirano');
  });
  await ctx.test('nelle ondate dei Templari: la loro musica, lo stacco d’ondata e i versi; fuori torna quella di prima', async () => {
    await hook(p, 'templariEntra', true);
    await ctx.waitState(p.page, (st) => st.templari?.active === true && st.templari.fase === 'gioca', 30000);
    await waitAudio(p, (a) => a.musica === 'templari', 8000);
    await waitAudio(p, (a) => a.visti.includes('tpl_ondata'), 15000);
    await hook(p, 'templariAutopilot', true, 4);
    await waitAudio(p, (a) => a.visti.some((x) => x === 'tpl_deus' || x === 'tpl_rantolo' || x === 'tpl_urlo' || x === 'tpl_sorge'), 30000);
    await hook(p, 'templariAutopilot', false);
    await p.page.keyboard.press('Escape');
    await p.page.click('#mzTplPausa [data-act=esci]'); await p.page.click('#mzTplPausa [data-act=esci]');
    await ctx.waitState(p.page, (st) => !!st.templariEsito?.aperto, 20000);
    await hook(p, 'chiudiTemplariEsito');
    await ctx.waitState(p.page, (st) => !st.templari.active && !st.templari.busy, 10000);
    await waitAudio(p, (a) => a.musica !== 'templari', 8000);
    const a = await audio(p); ctx.log('templari', JSON.stringify(a.visti.filter((x) => x.startsWith('tpl_'))));
  });
  await ctx.test('10 s registrati offline: niente clipping, niente silenzio (WAV in tests/out)', async () => {
    for (const modo of ['giorno', 'notte', 'gara', 'dungeon', 'templari']) { // templari: un'ondata intera di versi, spari, corno, risata e campana
      const r = await hook(p, 'audioOffline', modo, 10);
      fs.writeFileSync(path.join(ctx.OUT, `suoni_${modo}.wav`), Buffer.from(r.wav, 'base64'));
      ctx.log(`${modo}: picco ${r.picco.toFixed(3)} · rms ${r.rms.toFixed(4)} · silenzio ${(r.silenzio * 100).toFixed(1)}%`);
      ctx.assert(r.picco < 1, `${modo}: clipping, picco ${r.picco}`);
      ctx.assert(r.picco > 0.05 && r.rms > 0.004, `${modo}: quasi silenzio (picco ${r.picco}, rms ${r.rms})`);
      ctx.assert(r.silenzio < 0.5, `${modo}: silenzio per ${(r.silenzio * 100).toFixed(0)}% del tempo`);
    }
  });
  await ctx.test('spenti dalle Impostazioni: bus a zero, nessun errore', async () => {
    await hook(p, 'impostazioni', { musica: 0, effetti: 0 });
    await p.page.waitForTimeout(400);
    const a = await audio(p);
    ctx.assert(a.bus.musica < 0.05 && a.bus.effetti < 0.05 || a.contesto === 'suspended', `bus ancora accesi: ${JSON.stringify(a.bus)} ${a.contesto}`);
    ctx.noErrors(p, 'suoni');
  });
}
