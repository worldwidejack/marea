// Contesti del chunk GDR (CONTRACTS §15). Solo tipi: li importano anche game/ingressi.ts e ui/eroe.ts (bundle iniziale).
import type { InputFrame, LotState } from '@marea/sim';
import type { DungeonAzione, DungeonAzioni, PackedDungeon } from '@marea/sim/dungeon/types.ts';
import type { HeroState } from '@marea/sim/rpg/types.ts';
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
  /** Fine della partita: input registrati, azioni dal menu e hash dello stato finale della sim del client. */
  readonly done: Promise<{ inputs: PackedDungeon; hash: number; azioni: DungeonAzioni } | null>;
};
/** Lo zaino della spedizione in corso (dungeon v5): la scheda del personaggio lo mostra al posto di quello di casa e manda equip e butta
 *  alla sim come azioni; il resto (livelli, perk, libri) si fa fuori dal dungeon. */
export type RunBag = {
  /** Il personaggio com'è adesso nel dungeon (zaino col bottino, equipaggiamento); null se la spedizione non lo sa (aperta prima del v5). */
  hero(): HeroState | null;
  /** Peso dello zaino e massimo, come li conta la sim. */
  peso(): { peso: number; max: number };
  /** Azione adesso (la partita è in pausa): null = fatta, altrimenti il motivo in italiano. */
  act(a: DungeonAzione): string | null;
};
export type BuildingKind = 'banco' | 'alchimia' | 'forziere' | 'serra';
export type { DungeonFinish };
