// Contesti del chunk delle ondate dei Templari. Solo tipi: li importa anche game/templari.ts (bundle iniziale).
import type { InputFrame, Resources } from '@marea/sim';
import type { TAzioni, TRisultato } from '@marea/sim/templari/types.ts';
import type { GameWorld } from '../game/world.ts';
import type { Renderer } from '../render/scene.ts';
import type { Loader } from '../render/loader.ts';
import type { Hud } from '../ui/hud.ts';

export type TemplariCtx = { world: GameWorld; renderer: Renderer; loader: Loader; hud: Hud; root: HTMLElement; canvas: HTMLCanvasElement };
/** Fine partita: input compressi (encodeDungeon), hash della sim del client, azioni dal menu, risultato del client (per giocare senza server). */
export type TemplariFine = { inputs: string; hash: number; azioni: TAzioni; result: TRisultato };
export type TemplariRun = {
  readonly active: boolean;
  /** Un tick (60 Hz) con l'input base (joystick, A, B); AZIONE, SCAMBIA e la pausa li legge il chunk dai suoi bottoni e tasti. */
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Via senza consegnare (errore di caricamento): `done` risolve null. */
  abort(): void;
  readonly done: Promise<TemplariFine | null>;
};
/** Scheda dell'esito: il risultato (del server, o del client senza link) e il premio (null = senza server). */
export type EsitoVista = { result: TRisultato; premio: Resources | null; tetto?: boolean; record?: boolean };
