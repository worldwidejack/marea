// Contesti del chunk GDR (CONTRACTS §15). Solo tipi: li importano anche game/ingressi.ts e ui/eroe.ts (bundle iniziale).
import type { InputFrame, LotState } from '@marea/sim';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import type { GameWorld } from '../game/world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api, DungeonFinish } from '../net/api.ts';

export type RunCtx = { world: GameWorld; renderer: Renderer; loader: Loader; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement };
export type PanelCtx = { api: Api; hud: Hud; root: HTMLElement; getLot(): LotState | null; setLot(l: LotState): void };
export type DungeonRun = {
  readonly active: boolean;
  /** Un tick (60 Hz) con l'input base (joystick, A, B); C e D li legge il chunk dai suoi bottoni/tasti. */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Esce senza consegnare (Esc lungo, errore): `done` risolve null. */
  abort(): void;
  /** Fine della partita: input registrati e hash dello stato finale della sim del client. */
  readonly done: Promise<{ inputs: PackedDungeon; hash: number } | null>;
};
export type BuildingKind = 'banco' | 'alchimia' | 'forziere' | 'serra';
export type { DungeonFinish };
