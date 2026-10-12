// Le discese dell'Isola dell'Adrenalina nel registro dei minigiochi (passo 3b): il server apre e rigioca le partite `snowboard` col modulo
// della sim. Va importato SOLO dal server (e dai test): il registro `minigames/registry.ts` finisce nel client iniziale e lo snowboard coi
// suoi dati (`@marea/content/adrenalina.ts`, le piste) deve restare nel chunk delle discese (regola di check_static), come le Corse.
import { MINIGAMES } from '../minigames/registry.ts';
import type { MinigameModule } from '../minigames/types.ts';
import { snowboard } from '../minigames/snowboard.ts';

MINIGAMES['snowboard'] = snowboard as unknown as MinigameModule<unknown>;
