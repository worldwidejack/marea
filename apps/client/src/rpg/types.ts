// Contesti del chunk GDR (CONTRACTS §15). Solo tipi: li importano anche game/ingressi.ts e ui/eroe.ts (bundle iniziale).
import type { InputFrame, LotState } from '@marea/sim';
import type { DungeonAzione, DungeonAzioni, PackedDungeon } from '@marea/sim/dungeon/types.ts';
import type { HeroState } from '@marea/sim/rpg/types.ts';
import type { SqClientMsg, SqEroe, SqServerMsg } from '@marea/protocol/squadra.ts';
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
  /** Fine della partita: input registrati, azioni dal menu e hash dello stato finale della sim del client. Insieme (#118) sempre
   *  `{ insieme: true }`: l'esito lo calcola il server dal log della squadra (anche uscendo a metà). */
  readonly done: Promise<{ inputs: PackedDungeon; hash: number; azioni: DungeonAzioni } | { insieme: true } | null>;
};
/** Dungeon insieme (#118): il WebSocket della squadra visto dalla spedizione. `turni` = turni arrivati e non ancora giocati (la
 *  spedizione li consuma dalla testa); `chiusa` = connessione persa. */
export type SquadraRete = {
  io: number; eroi: SqEroe[];
  turni: Extract<SqServerMsg, { t: 'T' }>[];
  manda(m: SqClientMsg): void;
  readonly chiusa: boolean;
};
/** Lo zaino della spedizione in corso (dungeon v5): la scheda del personaggio lo mostra al posto di quello di casa e manda equip e butta
 *  alla sim come azioni; il resto (livelli, perk, libri) si fa fuori dal dungeon. */
export type RunBag = {
  /** Il personaggio com'è adesso nel dungeon (zaino col bottino, equipaggiamento); null se la spedizione non lo sa (aperta prima del v5). */
  hero(): HeroState | null;
  /** Peso dello zaino e massimo, come li conta la sim. */
  peso(): { peso: number; max: number };
  /** Azione adesso (la partita è in pausa): null = fatta, altrimenti il motivo in italiano. Insieme: mandata al server, arriva col turno. */
  act(a: DungeonAzione): string | null;
  /** Insieme (#118): il gioco non si ferma mentre la scheda è aperta. */
  insieme?: boolean;
};
export type BuildingKind = 'banco' | 'alchimia' | 'forziere' | 'serra';
export type { DungeonFinish };
