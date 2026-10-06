// Scheda del personaggio (R-pannelli, bundle iniziale: piccolo): bottone #mzHeroBtn in topbar e tasto I; il pannello vero sta nel chunk GDR. STUB di WP0.
import type { BuildingKind, PanelCtx } from '../rpg/types.ts';

export type Eroe = { open(): void; close(): void; isOpen(): boolean; openBuilding(kind: BuildingKind): void };
export function createEroe(o: PanelCtx): Eroe {
  const load = () => import('../rpg/index.ts');
  return {
    open() { void load().then((m) => m.openHero(o)); },
    close() { void load().then((m) => m.closePanels()); },
    isOpen: () => false,
    openBuilding(kind) { void load().then((m) => m.openBuilding(o, kind)); },
  };
}
