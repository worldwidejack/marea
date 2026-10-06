// Pannelli del personaggio e degli edifici GDR (R-pannelli): scheda, abilità e perk, inventario, forgia, alchimia, forziere, serra. STUB di WP0.
import type { BuildingKind, PanelCtx } from './types.ts';

export function openHero(ctx: PanelCtx): void { ctx.hud.toast('Scheda del personaggio: in arrivo'); }
export function openBuilding(ctx: PanelCtx, kind: BuildingKind): void { void kind; ctx.hud.toast('In arrivo'); }
export function closePanels(): void {}
export function isPanelOpen(): boolean { return false; }
