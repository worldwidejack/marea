// «Ruota il telefono» (#182): le Corse si giocano con il telefono in orizzontale. Su un telefono (puntatore a dito, schermo piccolo)
// tenuto in verticale compare un avviso a tutto schermo e la gara sta ferma; con una scappatoia piccola per giocare lo stesso in verticale.
// Sul PC non compare mai. `?ruota=1` lo forza (per provarlo), `?ruota=0` lo toglie.
import { P } from '../render/island_parts.ts';

export type AvvisoRuota = { visibile(): boolean; chiudi(): void; /** Acceso solo mentre si gioca (nel gioco, schermo delle Corse aperto); sul banco di prova sempre. */ attiva(on: boolean): void };

export function avvisoRuota(root: HTMLElement, attivoDaSubito = true): AvvisoRuota {
  const q = new URLSearchParams(location.search).get('ruota');
  const verticale = matchMedia('(orientation: portrait)'), dito = matchMedia('(pointer: coarse)');
  let scappato = false, attivo = attivoDaSubito;
  const css = document.createElement('style');
  css.textContent = `
.pp-ruota { position: fixed; inset: 0; z-index: 50; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px;
  background: ${P.abisso}; color: ${P.sabbiaChiara}; font: bold 22px ui-monospace, Menlo, monospace; text-align: center; touch-action: none; }
.pp-ruota.on { display: flex; }
.pp-ruota small { font-size: 13px; color: ${P.sabbia}; max-width: 18em; line-height: 1.4; }
.pp-ruota .tel { width: 46px; height: 80px; border: 5px solid ${P.sabbiaChiara}; border-radius: 8px; background: ${P.acquaProfonda}; position: relative; animation: pp-gira 2.4s ease-in-out infinite; }
.pp-ruota .tel::after { content: ''; position: absolute; left: 50%; bottom: 5px; width: 12px; height: 4px; margin-left: -6px; background: ${P.sabbiaChiara}; }
@keyframes pp-gira { 0%, 18% { transform: rotate(0); } 55%, 100% { transform: rotate(-90deg); } }
.pp-ruota button { margin-top: 10px; border: 2px solid ${P.legno}; background: transparent; color: ${P.sabbia}; font: 12px ui-monospace, Menlo, monospace; padding: 6px 10px; border-radius: 6px; }
`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.className = 'pp-ruota';
  el.innerHTML = '<div class="tel"></div><div>Ruota il telefono</div><small>Le corse si giocano in orizzontale: così vedi la pista e hai i comandi sotto i pollici.</small><button type="button">gioca in verticale lo stesso</button>';
  el.querySelector('button')!.addEventListener('click', () => { scappato = true; agg(); });
  for (const t of ['pointerdown', 'touchstart', 'touchmove']) el.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  root.appendChild(el);
  const serve = () => q === '1' ? verticale.matches : q === '0' ? false : verticale.matches && dito.matches && Math.min(innerWidth, innerHeight) < 700;
  function agg() {
    const on = attivo && !scappato && serve();
    el.classList.toggle('on', on);
    if (!serve()) scappato = false; // girato in orizzontale: la prossima volta in verticale riavvisa
  }
  verticale.addEventListener('change', agg); addEventListener('resize', agg); agg();
  // su Android, da schermo intero o app installata, il blocco in orizzontale funziona; altrove si ignora in silenzio
  try { (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')?.catch(() => {}); } catch { /* niente */ }
  return { visibile: () => el.classList.contains('on'), chiudi: () => { scappato = true; agg(); }, attiva: (on) => { attivo = on; if (!on) scappato = false; agg(); } };
}
