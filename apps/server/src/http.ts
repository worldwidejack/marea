// Risposte HTTP del server: una sola forma per tutte le rotte e tutti i Durable Object.

/** Risposta JSON, mai in cache. */
export const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
