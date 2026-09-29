// Isola di un giocatore: LotState in una riga JSON dello storage SQLite del DO, produzione pigra (`advance` a ogni lettura con l'ora del
// server), azioni economiche pure di @marea/sim. Il Worker instrada qui con idFromName(persona.id) e passa il proprietario in `x-persona`.
// Richieste (interne, dal Worker): GET /state · POST /collect {building} · POST /build {building, cell} · POST /upgrade {building}.
// Il DO serializza le richieste (input gate) e lo storage SQL è sincrono: niente corse tra due azioni.
import { DurableObject } from 'cloudflare:workers';
import { BUILDINGS } from '@marea/content';
import { EconomyError, advance, build, collect, newLot, upgrade } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { Env } from '../env.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const isCell = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 256);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;

export class Lot extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS stato (k INTEGER PRIMARY KEY, json TEXT NOT NULL)');
  }
  private load(owner: string, now: number): LotState {
    const rows = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM stato WHERE k = 1').toArray();
    const row = rows[0];
    if (row) return JSON.parse(row.json) as LotState;
    const lot = newLot(owner, now);
    this.save(lot);
    return lot;
  }
  private save(lot: LotState): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO stato (k, json) VALUES (1, ?)', JSON.stringify(lot));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const owner = req.headers.get('x-persona') ?? '';
    if (!owner) return json({ error: 'Manca la persona' }, 400);
    const now = Date.now();
    const act = url.pathname.replace(/^\/+/, '');
    try {
      const lot = this.load(owner, now);
      if (req.method === 'GET' && act === 'state') {
        const next = advance(lot, now);
        this.save(next);
        return json(next);
      }
      if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
      let body: Record<string, unknown>;
      try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: 'Richiesta non valida' }, 400); }
      if (!body || typeof body !== 'object') return json({ error: 'Richiesta non valida' }, 400);
      let next: LotState;
      if (act === 'collect') {
        if (!isId(body['building'])) return json({ error: 'Manca l’edificio' }, 400);
        next = collect(lot, body['building'], now);
      } else if (act === 'upgrade') {
        if (!isId(body['building'])) return json({ error: 'Manca l’edificio' }, 400);
        next = upgrade(lot, body['building'], now);
      } else if (act === 'build') {
        const b = body['building'], cell = body['cell'];
        if (!isId(b) || !BUILDINGS.some((d) => d.id === b)) return json({ error: 'Edificio sconosciuto' }, 400);
        if (!isCell(cell)) return json({ error: 'Cella non valida' }, 400);
        next = build(lot, b, cell, now);
      } else return json({ error: 'Non trovato' }, 404);
      this.save(next);
      return json(next);
    } catch (e) {
      if (e instanceof EconomyError) {
        const status = e.code === 'sconosciuto' ? 404 : 409;
        return json(e.manca ? { error: e.message, manca: e.manca } : { error: e.message }, status);
      }
      console.error('[marea] lot error', e);
      return json({ error: 'Errore interno, riprova tra poco' }, 500);
    }
  }
}
