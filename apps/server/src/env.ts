export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ZONE: DurableObjectNamespace;
  LOT: DurableObjectNamespace;
};
export type Persona = { id: string; nome: string; admin: number; look: string };
