// Porto tra amici (#110 #111), la parte del Worker: GET /api/record (tabellone dei record coi nomi), GET /api/faro (Faro comune coi nomi
// della classifica), POST /api/faro/versa {legno, pietra} (il DO Sfide coordina: il lotto paga, il faro conta). Lo stato sta nel DO Sfide
// (portoStore.ts): qui solo nomi da D1 e piccoli JSON (budget CPU del Worker). Il record lo scrive solo il replay: vedi `segnaRecordDa`.
import { DIARIO } from '@marea/content/diario.ts';
import { FARO } from '@marea/content/porto_amici.ts';
import { classificaFaro, faroLivello, faroProssimo } from '@marea/sim/economy/faro.ts';
import type { FaroStato } from '@marea/sim/economy/faro.ts';
import type { RecordVoce } from '@marea/sim/economy/record.ts';
import type { Env } from './env.ts';
import { elencoPersone } from './db.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
type Sfide = (path: string, body?: unknown) => Promise<Response>;
type NomeDi = (id: string) => string;

/** Il faro come lo vede il client: totali, livello, prossima soglia, bonus attuale, chi ha versato di più coi nomi. */
export function faroVista(f: FaroStato, nomeDi: NomeDi): Record<string, unknown> {
  const lv = faroLivello(f);
  return {
    legno: f.legno, pietra: f.pietra, livello: lv, max: FARO.livelli.length, livelli: f.livelli, prossimo: faroProssimo(f),
    bonus: FARO.livelli[lv - 1]?.bonus ?? 0,
    classifica: classificaFaro(f).map((x) => ({ id: x.chi, nome: nomeDi(x.chi), legno: x.legno, pietra: x.pietra })),
  };
}
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
  if (path === '/api/faro' && req.method === 'GET') {
    const r = await sfide('faro');
    if (!r.ok) return r;
    const { faro } = (await r.json()) as { faro: FaroStato };
    return json({ faro: faroVista(faro, (await nomi(env)).nomeDi) });
  }
  if (path === '/api/faro/versa' && req.method === 'POST') {
    const body = await corpo();
    if (body instanceof Response) return body;
    const { nomeDi, conIsola } = await nomi(env);
    const r = await sfide('faro_versa', { legno: body['legno'], pietra: body['pietra'], tutti: conIsola });
    if (!r.ok) return r;
    const d = (await r.json()) as { faro: FaroStato; saliti: number[]; dono: unknown; lot: unknown };
    return json({ faro: faroVista(d.faro, nomeDi), saliti: d.saliti, dono: d.dono, lot: d.lot });
  }
  return null;
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
