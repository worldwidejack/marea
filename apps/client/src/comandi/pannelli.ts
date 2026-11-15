const PANNELLI = [
  '[role="dialog"]', '[role="menu"]', '[data-pad-menu]', '#mzHome', '#mzCrediti.on', '#mzEntra',
  '#mzDngSquadra', '#mzDngDa', '#mzDngPausa.on', '#mzDngAsk.on', '#mzDngPreferiti.on',
  '#mzDngEsito', '#mzDngLettura.on', '#mzDngVoce.on', '#mzArenaMenu.on', '#mzArenaResa.on', '#mzArenaFine.on',
  '#mzColosseo.on', '#mzArreda.on', '#mzNegozio.on', '#mzGpSala.on', '#mzTplBiglietto.on', '#mzTplScelta.on', '#mzTplPausa.on', '#mzBottega.on', '#mzGpIntro', '#mzEsito.on',
  '.mz-sb-cartello', '#mzScacchi.on', '#mzEmoteRow.on', '.df-velo.su', '.df-prove.su',
].join(',');
export const visibile = (e: Element) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !!e.getClientRects().length;
export function cercaMenu(doc = document): HTMLElement | null {
  let primo: HTMLElement | null = null, z = -Infinity;
  doc.querySelectorAll<HTMLElement>(PANNELLI).forEach((el) => {
    if (!visibile(el)) return;
    const livello = Number(doc.defaultView?.getComputedStyle(el).zIndex) || 0;
    if (livello >= z || primo?.contains(el)) { primo = el; z = livello; }
  });
  return primo;
}
