// Porto tra amici, la parte del Worker: GET /api/record (tabellone dei record coi nomi), GET /api/collezione (i collezionisti),
// le buche della pala del Borgo. Lo stato sta nel DO Sfide (portoStore.ts): qui solo nomi da D1 e piccoli JSON (budget CPU del Worker).
// Il record lo scrive solo il replay: vedi `segnaRecordDa`.
import { DIARIO } from '@marea/content/diario.ts';
import type { RecordVoce } from '@marea/sim/economy/record.ts';
import type { Env } from './env.ts';
import { elencoPersone } from './db.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
type Sfide = (path: string, body?: unknown) => Promise<Response>;
type NomeDi = (id: string) => string;

const voce = (v: RecordVoce | undefined, nomeDi: NomeDi) => (v ? { chi: v.chi, nome: nomeDi(v.chi), score: v.score, medal: v.medal, detail: v.detail, quando: v.quando } : null);

async function nomi(env: Env): Promise<{ nomeDi: NomeDi; conIsola: string[] }> {
  const tutte = await elencoPersone(env);
  const m = new Map(tutte.map((x) => [x.id, x.nome] as const));
  return { nomeDi: (id) => m.get(id) ?? 'Qualcuno', conIsola: tutte.filter((x) => x.slot !== null).map((x) => x.id) };
}

/** Le rotte del Porto tra amici; null = non è una di queste. */
export async function rottePortoAmici(path: string, req: Request, env: Env, sfide: Sfide, corpo: () => Promise<Record<string, unknown> | Response>): Promise<Response | null> {
  if (path === '/api/record' && req.method === 'GET') {
    const r = await sfide('record');
    if (!r.ok) return r;
    const { tab } = (await r.json()) as { tab: { oggi: Record<string, RecordVoce>; sempre: Record<string, RecordVoce> } };
    const { nomeDi } = await nomi(env);
    return json({ voci: DIARIO.minigiochi.map((g) => ({ minigame: g.id, nome: g.nome, oggi: voce(tab.oggi[g.id], nomeDi), sempre: voce(tab.sempre[g.id], nomeDi) })) });
  }
  // i collezionisti (#457): chi ha consegnato più pesci e insetti al mobiliere, tra chi ha un'isola
  if (path === '/api/collezione' && req.method === 'GET') {
    const r = await sfide('collezione');
    if (!r.ok) return r;
    const { collezione } = (await r.json()) as { collezione: Record<string, { pesci: number; insetti: number }> };
    const { nomeDi, conIsola } = await nomi(env);
    return json({ righe: classificaCollezione(collezione, conIsola).map((x) => ({ ...x, nome: nomeDi(x.id) })) });
  }
  if (path === '/api/borgo/buche' && req.method === 'GET') return sfide('buche');
  if (path === '/api/borgo/buca' && req.method === 'POST') {
    const body = await corpo();
    if (body instanceof Response) return body;
    return sfide('buca', { op: body['op'], cell: body['cell'], dono: body['dono'] });
  }
  return null;
}

/** La classifica dei collezionisti: tutti quelli con un'isola (anche a zero), prima chi ha più pesci + insetti, a pari chi ha più pesci. */
export function classificaCollezione(c: Record<string, { pesci: number; insetti: number }>, conIsola: readonly string[]): { id: string; pesci: number; insetti: number }[] {
  return conIsola.map((id) => ({ id, pesci: c[id]?.pesci ?? 0, insetti: c[id]?.insetti ?? 0 }))
    .sort((a, b) => b.pesci + b.insetti - (a.pesci + a.insetti) || b.pesci - a.pesci || a.id.localeCompare(b.id));
}

/** Dopo una consegna al mobiliere (insetto o pesce) andata a buon fine: i numeri della collezione del lotto vanno alla classifica dei
 *  collezionisti. Best-effort come il record: se non risponde, la consegna vale lo stesso. Risponde col corpo del lotto com'era. */
export async function segnaCollezioneDa(lotRes: Response, sfide: Sfide): Promise<Response> {
  if (!lotRes.ok) return lotRes;
  const testo = await lotRes.text();
  try {
    const lot = JSON.parse(testo) as { pesci?: { posseduti?: unknown[] }; insetti?: { posseduti?: unknown[] } };
    const r = await sfide('collezione', { pesci: lot.pesci?.posseduti?.length ?? 0, insetti: lot.insetti?.posseduti?.length ?? 0 });
    await r.body?.cancel();
  } catch { /* la classifica si aggiorna alla prossima consegna */ }
  return new Response(testo, { status: lotRes.status, headers: lotRes.headers });
}

/**
 * Dopo una partita da solo andata a buon fine (il DO del lotto l'ha rigiocata): il punteggio vero va al tabellone. Best-effort: se il
 * tabellone non risponde la partita vale lo stesso. Risponde col corpo del lotto più `record: { oggi, sempre }` (record battuti).
 */
export async function segnaRecordDa(lotRes: Response, sfide: Sfide): Promise<Response> {
  if (!lotRes.ok) return lotRes;
  const d = (await lotRes.json()) as Record<string, unknown>;
  let record: unknown = null;
  try {
    const r = await sfide('record', { minigame: d['minigame'], score: d['score'], medal: d['medal'] ?? null, detail: d['detail'] });
    if (r.ok) record = await r.json(); else await r.body?.cancel();
  } catch { /* il tabellone si aggiorna alla prossima */ }
  return json({ ...d, record });
}
