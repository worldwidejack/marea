export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ZONE: DurableObjectNamespace;
  LOT: DurableObjectNamespace;
  SFIDE: DurableObjectNamespace;
  /** Solo in `wrangler dev` locale (`--var TEST_CLOCK:1`): abilita l'header X-Test-Now-Offset. Mai in produzione. */
  TEST_CLOCK?: string;
};
export type Persona = { id: string; nome: string; admin: number; look: string; slot: number | null };
