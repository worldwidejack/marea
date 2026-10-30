// Tipi dei nemici del Tempio della «Doppia Nera» (docs/BAITA.md): i campi di EnemyDef (rpg_types.ts) che descrivono l'Acrobata del Fuoripista,
// l'Alchimista del Bombardino, lo Sparaneve Automatico e il capo Jean-Claude «Valanga». Le formule stanno in @marea/sim/dungeon (baita.ts, jean_claude.ts).

/** L'Acrobata del Fuoripista (`trottola`): se ti vede entro `vede` m prepara per `prep` s (un anello rosso di `raggio` m gli si accende attorno), poi gira
 *  come una trottola per `durata` s inseguendoti a `velocita` m/s: ogni `ogni` s fa `danno` a chi sta dentro l'anello. Finito il giro gli gira la testa:
 *  per `capogiro` s sta fermo (stelline gialle) e i colpi che prende valgono × `molt`. */
export type TrottolaDef = { vede: number; prep: number; durata: number; velocita: number; raggio: number; ogni: number; danno: number; capogiro: number; molt: number };
/** L'Alchimista del Bombardino (`fiasche`): tiene `distanza` m (se gli vai più vicino di `vicino` m arretra); per `prep` s un cerchio di `raggio` m sul pavimento
 *  (dove eri) si riempie, poi la fiasca cade: `impatto` a chi è dentro e una chiazza per `durata` s. A giro: sciolina (chi sta dentro va a `lento` × la velocità,
 *  e per `coda` s dopo essere uscito) e bombardino (`dps` al secondo). Dopo il lancio `pausa` s. */
export type FiascheDef = { distanza: number; vicino: number; prep: number; raggio: number; impatto: number; durata: number; pausa: number; sciolina: { lento: number; coda: number }; bombardino: { dps: number } };
/** Il fusto giallo sulla schiena dell'Alchimista (`debolezzaRetro`): un colpo da dietro (coseno ≤ `cono`) vale × `molt`, lo stordisce `stordisce` s e il fusto scoppia:
 *  `danno` a chi sta entro `raggio` m (anche agli altri nemici). */
export type RetroDef = { cono: number; molt: number; stordisce: number; raggio: number; danno: number };
/** Lo Sparaneve Automatico (`raffica`): appena ti vede avvisa per `avviso` s (tre linee a terra, ferme fin dall'inizio), poi spara `n` palle di neve a ventaglio
 *  (ogni linea dista dalla vicina `angolo` di spostamento laterale per metro) a `velocita` m/s, `danno` e `spinta` m a chi prendono, lunghe al massimo `gittata` m. Poi
 *  ricarica `ricarica` s. Un colpo caricato di mischia mentre ricarica lo ribalta: la raffica dopo la spara contro l'altro nemico più vicino (`ribalta` m al massimo). */
export type RafficaDef = { n: number; angolo: number; velocita: number; danno: number; spinta: number; ricarica: number; avviso: number; gittata: number; ribalta: number };
/** Il capo del Tempio: Jean-Claude «Valanga». Due fasi (la seconda sotto `soglia` della vita); ogni fase gira il suo ciclo (`cicli`) con `pausa` s dopo ogni attacco.
 *  `frenata`: cono davanti a lui lungo `gittata` m (coseno `cono`) che si vede per `avviso` s: `danno` e `spinta` m. `salto`: spicca un salto di `volo` s (in aria è
 *  intoccabile); il quadrato di `lato` m a terra ti segue e si blocca `blocco` s prima dell'atterraggio: `danno` a chi c'è dentro; se atterra a vuoto resta in bilico `stordito` s
 *  (i colpi valgono × `molt`). `slalom`: pianta `n` bandierine da `hp` di vita e dopo `avviso` s corre 1 → 2 → 3 a `velocita` m/s: passata una porta, dopo `onda.avviso` s
 *  il gelo scoppia in un cerchio di `onda.raggio` m (`onda.danno`). Se hai spaccato la bandierina a cui arriva, ci si pianta e per `urlo` s protesta (colpi × `molt`).
 *  `lamina`: una X di `lato` m davanti a lui che si vede `avviso` s: `danno`. */
export type ClaudeDef = {
  soglia: number; pausa: number[]; cicli: ('frenata' | 'salto' | 'slalom' | 'lamina')[][];
  frenata: { avviso: number; danno: number; spinta: number; gittata: number; cono: number };
  salto: { volo: number; blocco: number; danno: number; lato: number; stordito: number; molt: number };
  slalom: { n: number; hp: number; avviso: number; velocita: number; onda: { avviso: number; raggio: number; danno: number }; urlo: number; molt: number };
  lamina: { avviso: number; danno: number; lato: number };
};
