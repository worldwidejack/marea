// La mappa dei comandi: quali tasti e quale pulsante del controller fanno cosa, salvata su questo dispositivo (localStorage).
// Il gioco legge i codici di serie (KeyE, Space…) in una cinquantina di posti: invece di toccarli tutti, un ascoltatore in capture
// (`avviaRimappa`, il primo della finestra) traduce i tasti veri nel codice di serie dell'azione e rilancia un tasto sintetico.
// Un tasto di serie che hai cambiato non fa più niente (se nessun'altra azione lo usa). Con Ctrl/Alt/Cmd, in un campo di testo o mentre
// la schermata Comandi aspetta un tasto, i tasti passano com'erano.
import { AZIONI, SLOT, chiaveDi } from './azioni.ts';
import type { Azione } from './azioni.ts';

const KEY = 'marea:comandi:1';
type Salvato = { k?: Record<string, (string | null)[]>; p?: Record<string, number | null> };

const serie = (a: Azione, i: number): string | null => a.tasti[i] ?? null;
let tasti = new Map<string, (string | null)[]>(); // id → codice per slot (null = nessuno)
let pulsanti = new Map<string, number | null>(); // id → pulsante del controller
let emetti = new Map<string, string>(); // codice premuto → codice di serie da rilanciare
let morti = new Set<string>(); // codici di serie che nessuno usa più
let cattura = false;
const sintetici = new WeakSet<Event>();

function ricostruisci(): void {
  emetti = new Map(); morti = new Set();
  const usati = new Set<string>();
  for (const a of AZIONI) for (let i = 0; i < SLOT; i++) { const c = tasti.get(a.id)?.[i]; if (c) usati.add(c); }
  for (const a of AZIONI) for (let i = 0; i < SLOT; i++) {
    const c = tasti.get(a.id)?.[i] ?? null, s = serie(a, i);
    if (c === s) continue;
    if (c) emetti.set(c, s ?? a.tasti[0]);
    if (s && !usati.has(s)) morti.add(s);
  }
}

function carica(): void {
  tasti = new Map(); pulsanti = new Map();
  let raw: Salvato = {};
  try { raw = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Salvato | null) ?? {}; } catch { /* storage non leggibile: valgono i tasti di serie */ }
  for (const a of AZIONI) {
    const k = raw.k?.[a.id], p = raw.p?.[a.id];
    tasti.set(a.id, Array.from({ length: SLOT }, (_, i) => {
      const v = k?.[i];
      return v === undefined ? serie(a, i) : typeof v === 'string' || v === null ? v : serie(a, i);
    }));
    pulsanti.set(a.id, a.senzaPad ? null : p === undefined ? a.pad : typeof p === 'number' || p === null ? p : a.pad);
  }
  ricostruisci();
}

function salva(): void {
  const k: Record<string, (string | null)[]> = {}, p: Record<string, number | null> = {};
  for (const a of AZIONI) {
    const t = tasti.get(a.id)!;
    if (t.some((c, i) => c !== serie(a, i))) k[a.id] = t;
    if (!a.senzaPad && pulsanti.get(a.id) !== a.pad) p[a.id] = pulsanti.get(a.id) ?? null;
  }
  try { localStorage.setItem(KEY, JSON.stringify({ k, p })); } catch { /* navigazione privata: vale fino a fine sessione */ }
  ricostruisci();
}

carica();

export const tastoDi = (id: string, slot: number): string | null => tasti.get(id)?.[slot] ?? null;
export const padDi = (id: string): number | null => pulsanti.get(id) ?? null;
export const azioneDelPad = (b: number): string | null => { for (const [id, v] of pulsanti) if (v === b) return id; return null; };

/** Dà un tasto a un'azione; se un'altra azione lo aveva, lo perde (un tasto, un'azione). Restituisce il nome di chi l'ha perso. */
export function impostaTasto(id: string, slot: number, code: string | null): string | null {
  const a = AZIONI.find((x) => x.id === id);
  if (!a || slot < 0 || slot >= SLOT) return null;
  let perso: string | null = null;
  if (code) for (const b of AZIONI) for (let i = 0; i < SLOT; i++) {
    if ((b.id === id && i === slot) || tasti.get(b.id)?.[i] !== code) continue;
    tasti.get(b.id)![i] = null; perso ??= b.nome;
  }
  tasti.get(id)![slot] = code; salva();
  return perso;
}

export function impostaPad(id: string, b: number | null): string | null {
  const a = AZIONI.find((x) => x.id === id);
  if (!a || a.senzaPad) return null;
  let perso: string | null = null;
  if (b !== null) for (const [altro, v] of pulsanti) if (altro !== id && v === b) { pulsanti.set(altro, null); perso ??= AZIONI.find((x) => x.id === altro)?.nome ?? null; }
  pulsanti.set(id, b); salva();
  return perso;
}

export function azzeraComandi(): void { try { localStorage.removeItem(KEY); } catch { /* niente */ } carica(); }
export const personalizzati = (): boolean => emetti.size > 0 || morti.size > 0 || AZIONI.some((a) => pulsanti.get(a.id) !== (a.senzaPad ? null : a.pad));

/** La schermata Comandi sta aspettando un tasto: la rimappa e il tasto Esc delle Impostazioni si fanno da parte. */
export const setCattura = (on: boolean): void => { cattura = on; };
export const inCattura = (): boolean => cattura;

/** Un tasto sintetico (rimappa e controller): lo vede tutto il gioco come un tasto vero. Non entra in campi di testo. */
export function inviaTasto(tipo: 'keydown' | 'keyup', code: string, ripetuto = false, marca?: WeakSet<Event>): void {
  const ev = new KeyboardEvent(tipo, { code, key: chiaveDi(code), repeat: ripetuto, bubbles: true, cancelable: true });
  sintetici.add(ev); marca?.add(ev); // marcato prima di partire: chi lo riceve deve già poter dire da dove viene
  (document.body ?? document.documentElement).dispatchEvent(ev);
}

const scrive = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLElement && e.target.isContentEditable);

let avviata = false;
/** Da chiamare una volta, per primi: gli ascoltatori della finestra vengono dopo. */
export function avviaRimappa(): void {
  if (avviata || typeof addEventListener === 'undefined') return;
  avviata = true;
  const premuti = new Map<string, string>(); // tasto vero → codice rilanciato, finché è giù
  const giu = (e: KeyboardEvent) => {
    if (sintetici.has(e) || cattura || e.ctrlKey || e.altKey || e.metaKey || scrive(e)) return;
    const a = emetti.get(e.code);
    if (a === undefined && !morti.has(e.code)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (a !== undefined) { premuti.set(e.code, a); inviaTasto('keydown', a, e.repeat); }
  };
  const su = (e: KeyboardEvent) => {
    if (sintetici.has(e)) return;
    const a = premuti.get(e.code);
    if (a === undefined) { if (morti.has(e.code) && !cattura) { e.stopImmediatePropagation(); } return; }
    e.stopImmediatePropagation(); premuti.delete(e.code); inviaTasto('keyup', a);
  };
  const lascia = () => { for (const a of premuti.values()) inviaTasto('keyup', a); premuti.clear(); };
  addEventListener('keydown', giu, true); addEventListener('keyup', su, true); addEventListener('blur', lascia);
}
