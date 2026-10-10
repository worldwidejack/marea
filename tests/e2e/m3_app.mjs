// App installabile (PWA): manifest dal server con il link personale nello start_url, icone, meta tag;
// nel client il manifest prende il token e l'indirizzo lo tiene (iPhone salva l'URL della pagina).
export const timeout = 150000;

export default async function (ctx) {
  const { assert } = ctx;
  const w = await ctx.startWrangler();
  const man = async (q) => { const r = await fetch(`${w.url}/manifest.webmanifest${q}`); assert.equal(r.status, 200); assert.ok((r.headers.get('content-type') ?? '').includes('manifest+json')); return r.json(); };

  await ctx.test('manifest senza token: si parte da /', async () => {
    const m = await man('');
    assert.equal(m.start_url, '/'); assert.equal(m.name, 'MAREA'); assert.equal(m.display, 'fullscreen');
    assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'manca l\'icona maskable');
  });
  await ctx.test('manifest col token: lo start_url entra come sé', async () => {
    const m = await man('?t=abcDEF_123-xyz');
    assert.equal(m.start_url, '/?t=abcDEF_123-xyz');
    assert.equal(m.id, '/?t=abcDEF_123-xyz', 'ogni persona è un\'app a sé (id)');
  });
  await ctx.test('manifest con un token strano: ignorato', async () => {
    const m = await man('?t=' + encodeURIComponent('<script>'));
    assert.equal(m.start_url, '/');
  });
  await ctx.test('icone servite come PNG', async () => {
    for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png']) {
      const r = await fetch(`${w.url}/${f}`);
      assert.equal(r.status, 200, f); assert.ok((r.headers.get('content-type') ?? '').includes('image/png'), f);
    }
  });
  await ctx.test('il client punta il manifest al proprio link e lo tiene nell\'indirizzo', async () => {
    // prima visita col link, poi si riapre senza: il token arriva dal dispositivo e torna nell'URL
    const p = await ctx.open('?t=provaToken123&net=0&nosound=1');
    await ctx.waitReady(p.page, 60000);
    const p2 = await p.page.context().newPage();
    await p2.goto(ctx.base + '/?net=0&nosound=1');
    await p2.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 60000 });
    const r = await p2.evaluate(() => ({ href: document.getElementById('manifest')?.getAttribute('href'), search: location.search, apple: !!document.querySelector('link[rel=apple-touch-icon]') }));
    await p2.close();
    assert.equal(r.href, '/manifest.webmanifest?t=provaToken123');
    assert.ok(r.search.includes('t=provaToken123'), r.search);
    assert.ok(r.apple, 'manca apple-touch-icon');
    ctx.noErrors(p, 'pagina');
  });
}
