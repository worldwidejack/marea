// Ingressi dei dungeon nel mondo (R-scena, bundle iniziale: piccolo). Modello `prop_ingresso_<stile>`, cartello, ENTRA vicino;
// entrando: POST /api/dungeon/start, import('../rpg/index.ts'), startRun; alla fine POST /api/dungeon/finish e scheda dell'esito. STUB di WP0.
import type { InputFrame, LotState } from '@marea/sim';
import type { GameWorld } from './world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';
import type { Api } from '../net/api.ts';
import type { PixId } from '../ui/icons.ts';

export type Ingressi = {
  readonly spots: readonly { id: string; nome: string; x: number; z: number; icon: PixId }[];
  /** Fuori dal dungeon, un tick: vicino a un ingresso il fronte di A entra. */
  tick(a: boolean): void;
  /** Nel dungeon, un tick (al posto di world.step). */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  readonly active: boolean;
  /** Spedizione che parte o scheda dell'esito aperta: il mondo sta fermo. */
  isBusy(): boolean;
};
export function createIngressi(o: { world: GameWorld; renderer: Renderer; loader: Loader; api: Api | null; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement; getLot(): LotState | null; setLot(l: LotState): void }): Ingressi {
  void o;
  return { spots: [], tick() {}, step() {}, update() {}, active: false, isBusy: () => false };
}
