// Comandi a tocco: un dito che il browser non ha mai alzato (pointerup perso) non deve lasciare A o il joystick incollati. Nel dungeon la A
// incollata teneva l'eroe in carica per sempre. Rete di sicurezza in ui/tocchi_su.ts: quando non c'è più nessun dito sullo schermo
// (touchend con `touches` vuoto) i comandi lasciano quello che tengono; con un altro dito ancora giù non lasciano niente.
export const timeout = 90000;
export default async function (ctx) {
  const p = await ctx.open('?test=1&net=0');
  await ctx.waitReady(p.page, 20000);
  const inp = async () => (await ctx.getState(p.page)).wp2_input;
  /** Un evento pointer di tipo touch sul centro dell'elemento (più `dx` px a destra). */
  const tocco = (sel, tipo, id, dx = 0) => p.page.evaluate(([sel, tipo, id, dx]) => {
    const e = document.querySelector(sel), r = e.getBoundingClientRect();
    e.dispatchEvent(new PointerEvent(tipo, { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: true, button: 0, clientX: r.x + r.width / 2 + dx, clientY: r.y + r.height / 2 }));
  }, [sel, tipo, id, dx]);
  /** touchend dal telefono: `n` = quanti dita restano sullo schermo. */
  const touchend = (n) => p.page.evaluate((n) => { const e = new Event('touchend', { bubbles: true }); Object.defineProperty(e, 'touches', { value: Array.from({ length: n }, () => ({})) }); window.dispatchEvent(e); }, n);

  await ctx.test('A: premuto e alzato come sempre', async () => {
    await tocco('#btnA', 'pointerdown', 11);
    ctx.assert((await inp()).a === true, 'A non risulta premuto');
    await tocco('#btnA', 'pointerup', 11);
    ctx.assert((await inp()).a === false, 'A è rimasto premuto dopo il pointerup');
  });
  await ctx.test('A: pointerup perso, nessun dito sullo schermo → A si lascia da solo', async () => {
    await tocco('#btnA', 'pointerdown', 12);
    ctx.assert((await inp()).a === true, 'A non risulta premuto');
    await touchend(1); // un altro dito è ancora giù: A resta
    ctx.assert((await inp()).a === true, 'A lasciato con un altro dito ancora sullo schermo');
    await touchend(0);
    ctx.assert((await inp()).a === false, 'A incollato: il pointerup è perso e nessun dito è sullo schermo');
  });
  await ctx.test('joystick: dito perso → il pomello torna al centro', async () => {
    await tocco('#joystick', 'pointerdown', 13, 30);
    const s = await inp();
    ctx.assert(Math.abs(s.stick[0]) > 0.3, `il joystick non si è mosso: ${JSON.stringify(s.stick)}`);
    await touchend(0);
    const t = await inp();
    ctx.assert(t.stick[0] === 0 && t.stick[1] === 0, `joystick incollato: ${JSON.stringify(t.stick)}`);
    await tocco('#joystick', 'pointerdown', 14, -30); // e si può riprendere
    ctx.assert(Math.abs((await inp()).stick[0]) > 0.3, 'il joystick non riparte dopo il rilascio forzato');
    await tocco('#joystick', 'pointerup', 14, -30);
  });
  await ctx.test('nessun errore', async () => { ctx.noErrors(p, 'tocco'); });
}
