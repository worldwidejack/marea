// Tipi dei nemici del Santuario del Capo Ardente (docs/SANTUARIO.md): i campi di EnemyDef (rpg_types.ts) che descrivono il Lanciatore di Lava, il Guerriero
// Colossale, lo Sciamano del Fumo, le micce (fuoco fatuo, Mite di lava) e il capo Korok. Le formule stanno in @marea/sim/dungeon (ceneri.ts, korok.ts).

/** Il Lanciatore di Lava (`lanciatore`): tiene `distanza` m e, entro `gittata`, carica per `carica` s con la lanterna che brilla: sul pavimento compaiono
 *  `n` cerchi (il primo dove sei, gli altri attorno a `sparpaglia` m), poi i globi cadono: `danno` entro `raggio` m e una pozza di lava (`fuoco`). Colpito in
 *  mischia mentre carica sta stordito `stordito` s e i globi si dissolvono. Dopo il lancio `pausa` s. */
export type LanciatoreDef = { distanza: number; gittata: number; carica: number; n: number; sparpaglia: number; raggio: number; danno: number; stordito: number; pausa: number;
  fuoco: { durata: number; dps: number; secondi: number } };
/** Il Guerriero Colossale (`colosso`): il colpo di clava cade su una corsia lunga `lungo` m e larga `largo` m per lato davanti a lui (avviso = `preparazione`);
 *  dopo il colpo la clava resta incastrata `incastrata` s: da dietro un colpo di mischia lo stordisce `stordito` s e fa × `retro`. Ogni `calcio.ogni` s, se un
 *  braciere acceso è entro `calcio.cerca` m, ci va e lo spegne con un calcio (preparazione `calcio.prep`). */
export type ColossoDef = { lungo: number; largo: number; incastrata: number; stordito: number; retro: number; calcio: { ogni: number; cerca: number; prep: number } };
/** Lo Sciamano del Fumo (`sciamano`): invisibile e intoccabile se non è entro `rivela` m da un braciere acceso. Tiene `distanza` m; ogni `ogni` s una linea ti
 *  collega a lui per `avviso` s, poi evoca `n` `fatuo` (nemici di enemies.json; al massimo 2 × `n` vivi). Colpito in mischia (visibile) sta stordito `stordito` s
 *  e resta visibile per sempre. */
export type SciamanoDef = { rivela: number; distanza: number; ogni: number; avviso: number; n: number; fatuo: string; stordito: number };
/** Fuoco fatuo e Mite di lava (`miccia`): inseguono l'eroe; a contatto (o, se `scoppia`, allo scadere dei `durata` s) esplodono: `danno` entro `raggio` m.
 *  Senza `scoppia` allo scadere si dissolvono e basta. */
export type MicciaDef = { durata: number; raggio: number; danno: number; scoppia: boolean };
/** Il capo del Santuario: Korok, il Cuore di Lava. Fase 0 sopra `soglie[0]` della vita, 1 sotto, 2 sotto `soglie[1]`; ogni fase gira il suo ciclo (`cicli`) con `pausa` s
 *  dopo ogni attacco; a ogni cambio di fase ruggisce `cambio` s intoccabile. Fuori dalle finestre di punizione il nucleo è coperto e i colpi valgono × `corazza`;
 *  nelle finestre i colpi di mischia valgono × `molt` dell'attacco. `sputo`: `n` globi uno ogni `ogni` s, il primo dove sei (entro `gittata` m da lui). `mites`:
 *  `n` cerchi attorno all'eroe a `distanza` m, da cui nascono i `tipo`. `onda`: cerchio di `raggio` m che si riempie in `caduta` s e prende chi non sta al riparo
 *  di un braciere acceso. `schianto`: cerchio di `raggio` m e poi crepe di fuoco (`crepe`); resta incastrato `fermo` s. `pioggia`: `n` cerchi (`vicine` sull'eroe,
 *  gli altri a caso nell'arena). */
export type KorokDef = {
  soglie: number[]; cambio: number; pausa: number[]; corazza: number; velocita: number;
  cicli: ('sputo' | 'mites' | 'onda' | 'schianto' | 'pioggia')[][];
  sputo: { gittata: number; n: number; ogni: number; raggio: number; caduta: number; danno: number; fuoco: { durata: number; dps: number; secondi: number }; fermo: number; molt: number };
  mites: { tipo: string; n: number; distanza: number; caduta: number; fermo: number; molt: number };
  onda: { raggio: number; caduta: number; danno: number };
  schianto: { raggio: number; caduta: number; danno: number; crepe: { durata: number; dps: number; secondi: number }; fermo: number; molt: number };
  pioggia: { n: number; vicine: number; raggio: number; caduta: number; danno: number; fermo: number; molt: number };
};
/** Un'ondata di calore (`DungeonDef.ondate`): dentro la zona [x0, z0, x1, z1] (celle, estremi compresi) ogni `ogni` s, dopo `avviso` s di aria che scalda, `danno` a chi
 *  non sta nell'area 3×3 di un braciere acceso (né indossa il Manto del Primo Lucignolo); sfasata di `fase` s. */
export type OndataDef = { n: number; zona: [number, number, number, number]; ogni: number; avviso: number; danno: number; fase?: number };
