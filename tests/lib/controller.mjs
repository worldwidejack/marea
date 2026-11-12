/** Controller standard simulato. Aspetta che il ciclo del gioco abbia letto la nuova posizione. */
export async function collegaController(page) {
  await page.evaluate(() => {
    const normale = navigator.getGamepads.bind(navigator);
    const p = { connected: true, id: 'Controller finto (STANDARD GAMEPAD)', mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] };
    const d = window.__padProva = { p, lette: 0, normale, impulso: false };
    navigator.getGamepads = () => {
      d.lette++;
      if (!p.connected) return [];
      if (!d.impulso) return [p];
      const letto = { ...p };
      d.impulso = false; p.buttons = [];
      return [letto];
    };
    dispatchEvent(new Event('gamepadconnected'));
  });
  await page.waitForFunction(() => window.__game.state().comandi.pad === 'Controller finto');
  const stato = async (giu = [], assi = [0, 0, 0, 0], impulso = false) => {
    const letta = await page.evaluate(({ giu, assi, impulso }) => {
      const d = window.__padProva;
      d.p.axes = assi;
      d.p.buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: giu.includes(i), value: giu.includes(i) ? 1 : 0 }));
      d.impulso = impulso;
      return d.lette;
    }, { giu, assi, impulso });
    await page.waitForFunction((n) => window.__padProva.lette > n, letta);
  };
  return {
    stato,
    // Un tocco dura una sola lettura, anche se il browser è lento a tornare al test.
    async premi(b) { await stato([b], [0, 0, 0, 0], true); await stato(); },
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
