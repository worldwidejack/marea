// Kit dei comandi a tocco, uguale in tutte le modalità: il bottone da tenere premuto (un set di dita, più dita insieme) e il conto del
// pomello di un joystick (tenuto dentro l'anello). Il joystick di movimento vive in game/input.ts, quello di mira in rpg/mira_stick.ts:
// usano `pomello`. I posti con un tocco tutto loro (lo sparatutto alla COD Mobile in sparo/tocco.ts, lo snowboard in adrenalina/comandi.ts,
// la Difesa a tocchi sulla tela) restano com'erano.

export type Tenuto = {
  /** Almeno un dito (o il mouse) è giù sul bottone. */
  readonly giu: boolean;
  /** Lascia tutte le dita (blur, scheda nascosta, bottone nascosto). */
  lascia(): void;
  /** Toglie gli ascoltatori della finestra (quelli sul bottone se ne vanno col bottone). */
  dispose(): void;
};

/** Bottone tenuto: ogni dito che lo tocca conta finché non si alza; la cattura del puntatore lo segue anche se scivola fuori.
 *  `premi` = a ogni dito che scende (il latch dei tick: anche un tocco più corto di un tick arriva alla sim); `cambia` = quando passa da
 *  libero a premuto e indietro (per ridisegnarlo), `classe` = la classe che ha mentre è premuto. `ferma` = il tocco non arriva a chi sta
 *  sotto (stopPropagation). `finestra` = rete di sicurezza: un dito alzato fuori dal bottone senza cattura lo lascia lo stesso.
 *  `bloccaTocchi` = touchstart e touchmove non scorrono la pagina e non arrivano sotto. */
export function tieniPremuto(b: HTMLElement, o: { premi?(): void; cambia?(giu: boolean): void; classe?: string; ferma?: boolean; finestra?: boolean; bloccaTocchi?: boolean } = {}): Tenuto {
  const dita = new Set<number>();
  const pinta = () => { const g = dita.size > 0; if (o.classe) b.classList.toggle(o.classe, g); o.cambia?.(g); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (o.ferma) e.stopPropagation();
    const nuovo = !dita.size; dita.add(e.pointerId); o.premi?.();
    try { b.setPointerCapture(e.pointerId); } catch { /* pointer sintetico (test): niente cattura, gli eventi arrivano lo stesso */ }
    if (nuovo) pinta();
  });
  const su = (e: PointerEvent) => { if (dita.delete(e.pointerId) && !dita.size) pinta(); };
  for (const ev of ['pointerup', 'pointercancel']) { b.addEventListener(ev, su as EventListener); if (o.finestra) addEventListener(ev, su as EventListener); }
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  if (o.bloccaTocchi) for (const ev of ['touchstart', 'touchmove']) b.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  return {
    get giu() { return dita.size > 0; },
    lascia() { if (!dita.size) return; dita.clear(); pinta(); },
    dispose() { if (o.finestra) for (const ev of ['pointerup', 'pointercancel']) removeEventListener(ev, su as EventListener); },
  };
}

/** Il pomello di un joystick: lo scarto del dito dal centro (px) tenuto dentro la corsa `r` (px). `x`, `y` in −1..1, `len` 0..1. */
export function pomello(dx: number, dy: number, r: number): { x: number; y: number; len: number } {
  const d = Math.sqrt(dx * dx + dy * dy), k = d > r ? r / d : 1;
  return { x: (dx * k) / r, y: (dy * k) / r, len: (d * k) / r };
}
