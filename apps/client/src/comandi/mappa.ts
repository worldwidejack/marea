import { PROFILI, SLOT, PULSANTI_ASSEGNABILI, azioni, chiaveDi } from './azioni.ts';
import type { Profilo } from './azioni.ts';

const KEY = 'marea:comandi:2', VECCHIA = 'marea:comandi:1';
type Salvato = { k?: Record<string, (string | null)[]>; p?: Record<string, number | null>; s?: true };
const profili = Object.keys(PROFILI) as Profilo[];
const stickScambiati = new Set<Profilo>();
const mappe = new Map<Profilo, {
  tasti: Map<string, (string | null)[]>; pad: Map<string, number | null>;
  traduci: Map<string, string>; originali: Set<string>;
}>();
const serie = (a: { tasti: readonly (string | undefined)[] }, i: number): string | null => a.tasti[i] ?? null;
const valido = (b: unknown): b is number => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b < PULSANTI_ASSEGNABILI;
const leggi = <T>(chiave: string): T | null => {
  try { return JSON.parse(localStorage.getItem(chiave) ?? 'null') as T | null; } catch { return null; }
};

function ricostruisci(p: Profilo): void {
  const m = mappe.get(p)!;
  m.traduci.clear(); m.originali.clear();
  for (const a of azioni(p)) for (let i = 0; i < SLOT; i++) {
    const s = serie(a, i), c = m.tasti.get(a.id)?.[i];
    if (s) m.originali.add(s);
    const code = s ?? a.tasti[0];
    if (c && code) m.traduci.set(c, code);
  }
}

function carica(): void {
  const dati = leggi<Partial<Record<Profilo, Salvato>>>(KEY);
  const vecchi = dati ? null : leggi<Salvato>(VECCHIA);
  for (const p of profili) {
    const tasti = new Map<string, (string | null)[]>(), pad = new Map<string, number | null>();
    const usati = new Set<number>();
    const def = azioni(p), raw = dati?.[p] ?? (p !== 'menu' ? vecchi : null);
    if (raw?.s === true) stickScambiati.add(p);
    // Le assegnazioni esplicite hanno precedenza sui nuovi default durante la migrazione.
    for (const a of def) {
      const v = raw?.p?.[a.id];
      if (v === null || (valido(v) && !usati.has(v))) { pad.set(a.id, v); if (v !== null) usati.add(v); }
    }
    for (const a of def) {
      const k = raw?.k?.[a.id];
      tasti.set(a.id, Array.from({ length: SLOT }, (_, i) => {
        const v = Array.isArray(k) ? k[i] : undefined;
        return typeof v === 'string' || v === null ? v : serie(a, i);
      }));
      if (!pad.has(a.id)) {
        const b = a.pad !== null && !usati.has(a.pad) ? a.pad : null;
        pad.set(a.id, b); if (b !== null) usati.add(b);
      }
    }
    mappe.set(p, { tasti, pad, traduci: new Map(), originali: new Set() });
    ricostruisci(p);
  }
}

function differenze(p: Profilo): Salvato {
  const k: NonNullable<Salvato['k']> = {}, pad: NonNullable<Salvato['p']> = {};
  const m = mappe.get(p)!;
  for (const a of azioni(p)) {
    const t = m.tasti.get(a.id)!;
    if (t.some((c, i) => c !== serie(a, i))) k[a.id] = t;
    const b = m.pad.get(a.id) ?? null;
    if (b !== a.pad) pad[a.id] = b;
  }
  return stickScambiati.has(p) ? { k, p: pad, s: true } : { k, p: pad };
}

function salva(p: Profilo): void {
  ricostruisci(p);
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(profili.map((id) => [id, differenze(id)])))); } catch { /* vale fino a fine sessione */ }
}

carica();

export const tastoDi = (p: Profilo, id: string, slot: number): string | null => mappe.get(p)?.tasti.get(id)?.[slot] ?? null;
export const padDi = (p: Profilo, id: string): number | null => mappe.get(p)?.pad.get(id) ?? null;
export function azioneDelPad(p: Profilo, b: number): string | undefined {
  for (const [id, v] of mappe.get(p)!.pad) if (v === b) return id;
  return undefined;
}

export function impostaTasto(p: Profilo, id: string, slot: number, code: string | null): string | null {
  const m = mappe.get(p), t = m?.tasti.get(id);
  if (!m || !t || !Number.isInteger(slot) || slot < 0 || slot >= SLOT) return null;
  let perso: string | null = null;
  if (code) for (const a of azioni(p)) for (let i = 0; i < SLOT; i++) {
    if ((a.id === id && i === slot) || m.tasti.get(a.id)?.[i] !== code) continue;
    m.tasti.get(a.id)![i] = null; perso ??= a.nome;
  }
  t[slot] = code; salva(p);
  return perso;
}

export function impostaPad(p: Profilo, id: string, b: number | null): string | null {
  const m = mappe.get(p)?.pad;
  if (!m?.has(id) || (b !== null && !valido(b))) return null;
  // Scambia i due pulsanti se possibile: conferma e indietro restano raggiungibili mentre si rimappano.
  const altro = b === null ? undefined : azioneDelPad(p, b);
  const necessario = (azione?: string) => azione === 'conferma' || azione === 'indietro' || azione === 'chiudi';
  if ((p === 'menu' || p === 'scacchi') && ((b === null && necessario(id)) || (m.get(id) === null && necessario(altro)))) return null;
  if (altro && altro !== id) m.set(altro, m.get(id) ?? null);
  m.set(id, b); salva(p);
  return altro && altro !== id ? azioni(p).find((a) => a.id === altro)?.nome ?? null : null;
}

export function azzeraComandi(p: Profilo): void {
  const m = mappe.get(p)!;
  stickScambiati.delete(p);
  for (const a of azioni(p)) { m.tasti.set(a.id, [serie(a, 0), serie(a, 1)]); m.pad.set(a.id, a.pad); }
  salva(p);
}

export function personalizzati(p: Profilo): boolean {
  const d = differenze(p);
  return !!(d.s || Object.keys(d.k ?? {}).length || Object.keys(d.p ?? {}).length);
}

export const stickInvertiti = (p: Profilo): boolean => stickScambiati.has(p);
export function impostaStick(p: Profilo, scambia: boolean): void {
  if (scambia) stickScambiati.add(p); else stickScambiati.delete(p);
  salva(p);
}

let cattura = false;
export const setCattura = (on: boolean): void => { cattura = on; };
export const inCattura = (): boolean => cattura;
let contesto: () => Profilo = () => 'borgo';
export const collegaProfilo = (f: () => Profilo): void => { contesto = f; };
export const profiloAttivo = (): Profilo => contesto();

const sintetici = new WeakSet<Event>();
export function inviaTasto(tipo: 'keydown' | 'keyup', code: string, ripetuto = false, marca?: WeakSet<Event>, doc = document): void {
  const ev = new KeyboardEvent(tipo, { code, key: chiaveDi(code), repeat: ripetuto, bubbles: true, cancelable: true });
  sintetici.add(ev); marca?.add(ev);
  (doc.body ?? doc.documentElement).dispatchEvent(ev);
}

const scrive = (e: KeyboardEvent) => !!(e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
const finestre = new WeakSet<Window>();
export function avviaRimappa(menuAperto: () => boolean, win: Window = window): void {
  if (finestre.has(win)) return;
  finestre.add(win);
  const doc = win.document;
  const premuti = new Map<string, string | null>();
  const giu = (e: KeyboardEvent) => {
    if (sintetici.has(e) || cattura || e.ctrlKey || e.altKey || e.metaKey || scrive(e)) return;
    const m = mappe.get(profiloAttivo())!;
    const a = premuti.has(e.code) ? premuti.get(e.code) : menuAperto() && profiloAttivo() !== 'scacchi' ? undefined : m.traduci.get(e.code) ?? (m.originali.has(e.code) ? null : undefined);
    if (a === undefined || a === e.code) return;
    e.stopImmediatePropagation(); e.preventDefault(); premuti.set(e.code, a);
    if (a !== null) inviaTasto('keydown', a, e.repeat, undefined, doc);
  };
  const su = (e: KeyboardEvent) => {
    if (sintetici.has(e) || !premuti.has(e.code)) return;
    const a = premuti.get(e.code); premuti.delete(e.code); e.stopImmediatePropagation();
    if (a) inviaTasto('keyup', a, false, undefined, doc);
  };
  const lascia = () => { for (const a of premuti.values()) if (a) inviaTasto('keyup', a, false, undefined, doc); premuti.clear(); };
  win.addEventListener('keydown', giu, true); win.addEventListener('keyup', su, true); win.addEventListener('blur', lascia);
}
