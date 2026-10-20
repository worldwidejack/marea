// Isola dell'Adrenalina, la parte del Worker (passo 3b, birbasan 12 ott 2026): le discese a medaglie col fantasma del record.
// - POST /api/solo/play di una discesa: il DO del lotto rigioca e paga la medaglia dalla classifica a tempo della pista, che gli passa il
//   Worker (dal DO Sfide; il client manda `minigame` e `pista` per risparmiare un giro, ma il lotto non si fida: se manca o è di un'altra
//   pista risponde 409 `classifica` e il Worker la rimanda). Poi la discesa va in classifica (se è il tuo miglior tempo) con i suoi input.
// - GET /api/adrenalina/discese?pista= (la classifica coi nomi) · GET /api/adrenalina/fantasma?pista= (il fantasma del primo: input, nome, look).
import type { Env } from './env.ts';
import { elencoPersone } from './db.ts';
import { json } from './http.ts';

type Chiama = (path: string, body?: unknown) => Promise<Response>;

async function classifica(sfide: Chiama, pista: string): Promise<{ pista: string; righe: { chi: string; ms: number }[] }> {
  const r = await sfide('discese?pista=' + encodeURIComponent(pista));
  if (!r.ok) throw new Error('classifica non letta');
  const d = (await r.json()) as { righe: { chi: string; ms: number }[] };
  return { pista, righe: d.righe.map((x) => ({ chi: x.chi, ms: x.ms })) };
}

/** `/api/solo/play` con la classifica per le discese; le altre partite passano dritte. Risponde come il lotto (più `discesa` per le discese). */
export async function giocaSolo(body: Record<string, unknown>, lot: (b: unknown) => Promise<Response>, sfide: Chiama): Promise<Response> {
  const inputs = body['inputs'];
  let cl = body['minigame'] === 'snowboard' && typeof body['pista'] === 'string' ? await classifica(sfide, body['pista']).catch(() => null) : null;
  let res = await lot(cl ? { inputs, classifica: cl } : { inputs });
  if (res.status === 409) {
    const e = (await res.clone().json().catch(() => ({}))) as Record<string, unknown>;
    if (e['code'] === 'classifica' && typeof e['pista'] === 'string') {
      try { cl = await classifica(sfide, e['pista']); } catch { return json({ error: 'La classifica non risponde: riprova tra poco', code: 'classifica' }, 503); }
      res = await lot({ inputs, classifica: cl });
    }
  }
  // è una discesa se lo dice il lotto (il suggerimento del client può mancare)
  if (!res.ok || (body['minigame'] !== 'snowboard' && !cl)) return res;
  const d = (await res.json()) as Record<string, unknown>, det = d['detail'] as Record<string, number> | undefined;
  if (d['minigame'] === 'snowboard' && det?.['arrivato']) {
    try {
      const r = await sfide('discesa', { pista: d['pista'], ms: det['finale'], seed: d['seed'], opzioni: d['opzioni'], inputs });
      d['discesa'] = r.ok ? await r.json() : null;
    } catch { d['discesa'] = null; } // la classifica si aggiorna alla prossima; la partita vale lo stesso
  }
  return json(d);
}

/** Classifica a tempo o fantasma del record di una pista dell'Adrenalina, coi nomi (e il look del fantasma) da D1. */
export async function disceseConNomi(quale: 'discese' | 'fantasma', pista: string, env: Env, sfide: Chiama): Promise<Response> {
  const r = await sfide(quale + '?pista=' + encodeURIComponent(pista));
  if (!r.ok) return r;
  const d = (await r.json()) as { righe?: { chi: string; ms: number; quando: number }[]; fantasma?: { chi: string; ms: number } | null };
  const persone = new Map((await elencoPersone(env)).map((x) => [x.id, x] as const));
  const nome = (id: string) => persone.get(id)?.nome ?? 'Qualcuno';
  if (d.righe) return json({ pista, righe: d.righe.map((x) => ({ ...x, nome: nome(x.chi) })) });
  const f = d.fantasma ?? null;
  let look: unknown = null;
  try { look = f ? JSON.parse(persone.get(f.chi)?.look ?? 'null') : null; } catch { /* look rotto: il fantasma resta coi colori di serie */ }
  return json({ pista, fantasma: f ? { ...f, nome: nome(f.chi), look } : null });
}
