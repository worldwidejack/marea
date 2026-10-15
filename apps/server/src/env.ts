export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ZONE: DurableObjectNamespace;
  LOT: DurableObjectNamespace;
  SFIDE: DurableObjectNamespace;
  /** Dungeon insieme (#118): squadre e spedizioni in tempo reale, un'istanza sola (idFromName('spedizioni')). */
  SPEDIZIONI: DurableObjectNamespace;
  /** Corse tra amici (PROTOCOL §8): la sala e la gara a fantasmi, un'istanza sola (idFromName('garaamici')). */
  GARA_AMICI: DurableObjectNamespace;
  /** Templari insieme (PROTOCOL §9): la sala alla porta della chiesa e le partite in tempo reale, un'istanza sola (idFromName('templari')). */
  TEMPLARI_INSIEME: DurableObjectNamespace;
  /** Solo in `wrangler dev` locale (`--var TEST_CLOCK:1`): abilita l'header X-Test-Now-Offset. Mai in produzione. */
  TEST_CLOCK?: string;
};
export type Persona = { id: string; nome: string; admin: number; look: string; slot: number | null };
