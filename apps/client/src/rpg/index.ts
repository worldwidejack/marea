// Entry del chunk GDR (CONTRACTS §15): si carica con import('../rpg/index.ts') entrando in un dungeon o aprendo la scheda del personaggio.
export { startRun, showResult } from './dungeon_run.ts';
export { openHero, openBuilding, closePanels, isPanelOpen } from './panels.ts';
export type { RunCtx, PanelCtx, DungeonRun, BuildingKind } from './types.ts';
