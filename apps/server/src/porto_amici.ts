// Porto tra amici, la parte del Worker: il tabellone dei record e i collezionisti coi nomi (le rotte stanno in rotte.ts). Lo stato sta nel DO Sfide (portoStore.ts): qui solo nomi da D1 e piccoli JSON (budget CPU del Worker).
// Il record lo scrive solo il replay: vedi `segnaRecordDa`.
import { DIARIO } from '@marea/content/diario.ts';
import type { RecordVoce } from '@marea/sim/economy/record.ts';
import type { Env } from './env.ts';
import { elencoPersone } from './db.ts';
import { json } from './http.ts';

type Sfide = (path: string, body?: unknown) => Promise<Response>;
type NomeDi = (id: string) => string;

const voce = (v: RecordVoce | undefined, nomeDi: NomeDi) => (v ? { chi: v.chi, nome: nomeDi(v.chi), score: v.score, medal: v.medal, detail: v.detail, quando: v.quando } : null);

async function nomi(env: Env): Promise<{ nomeDi: NomeDi; conIsola: string[] }> {
  const tutte = await elencoPersone(env);
  const m = new Map(tutte.map((x) => [x.id, x.nome] as const));
  return { nomeDi: (id) => m.get(id) ?? 'Qualcuno', conIsola: tutte.filter((x) => x.slot !== null).map((x) => x.id) };
}

/** Tabellone dei record (GET /api/record): per minigioco il migliore di oggi e di sempre tra gli amici, coi nomi. */
export async function recordConNomi(env: Env, sfide: Sfide): Promise<Response> {
  const r = await sfide('record');
  if (!r.ok) return r;
  const { tab } = (await r.json()) as { tab: { oggi: Record<string, RecordVoce>; sempre: Record<string, RecordVoce> } };
  const { nomeDi } = await nomi(env);
  return json({ voci: DIARIO.minigiochi.map((g) => ({ minigame: g.id, nome: g.nome, oggi: voce(tab.oggi[g.id], nomeDi), sempre: voce(tab.sempre[g.id], nomeDi) })) });
}
/** I collezionisti (GET /api/collezione): chi ha consegnato più pesci e insetti al mobiliere, tra chi ha un'isola. */
export async function collezioneConNomi(env: Env, sfide: Sfide): Promise<Response> {
  const r = await sfide('collezione');
  if (!r.ok) return r;
  const { collezione } = (await r.json()) as { collezione: Record<string, { pesci: number; insetti: number }> };
  const { nomeDi, conIsola } = await nomi(env);
  return json({ righe: classificaCollezione(collezione, conIsola).map((x) => ({ ...x, nome: nomeDi(x.id) })) });
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
