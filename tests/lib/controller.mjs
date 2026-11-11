/** Controller standard simulato. Aspetta che il ciclo del gioco abbia letto la nuova posizione. */
export async function collegaController(page) {
  await page.evaluate(() => {
    const normale = navigator.getGamepads.bind(navigator);
    const p = { connected: true, id: 'Controller finto (STANDARD GAMEPAD)', mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] };
    window.__padProva = { p, lette: 0, normale };
    navigator.getGamepads = () => { window.__padProva.lette++; return p.connected ? [p] : []; };
    dispatchEvent(new Event('gamepadconnected'));
  });
  await page.waitForFunction(() => window.__game.state().comandi.pad === 'Controller finto');
  const stato = async (giu = [], assi = [0, 0, 0, 0]) => {
    const letta = await page.evaluate(({ giu, assi }) => {
      const d = window.__padProva;
      d.p.axes = assi;
      d.p.buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: giu.includes(i), value: giu.includes(i) ? 1 : 0 }));
      return d.lette;
    }, { giu, assi });
    await page.waitForFunction((n) => window.__padProva.lette > n, letta);
  };
  return {
    stato,
    async premi(b) { await stato([b]); await stato(); },
    async scollega() {
      await page.evaluate(() => {
        window.__padProva.p.connected = false;
        navigator.getGamepads = window.__padProva.normale;
        dispatchEvent(new Event('gamepaddisconnected'));
      });
      await page.waitForFunction(() => window.__game.state().comandi.pad === null);
    },
  };
}
