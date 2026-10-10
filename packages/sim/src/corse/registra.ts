// Il Gran Premio nel gioco gira sul motore v2 (docs/CORSE.md A11/A12, #173): il server rigioca le partite `corse` con `garaCorse`.
// Va importato SOLO dal server (e dai test che vogliono quel replay): il registro `minigames/registry.ts` finisce nel client iniziale
// e il motore v2 coi suoi dati (`@marea/content/corse.ts`, le piste) deve restare nel chunk delle Corse (regola di check_static).
// Il vecchio modulo `minigames/corse.ts` resta com'era per i suoi test; l'id è lo stesso (`corse`), la versione sale a 2.
import { MINIGAMES } from '../minigames/registry.ts';
import type { MinigameModule } from '../minigames/types.ts';
import { garaCorse } from './gara.ts';

MINIGAMES['corse'] = garaCorse as unknown as MinigameModule<unknown>;
