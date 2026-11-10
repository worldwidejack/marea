// Il controller: Gamepad API del browser, quindi vale su computer e su telefono (Bluetooth o cavo). Il ciclo gira solo mentre
// un controller è collegato. Stick sinistro e croce = muoversi (analogico per input.ts, e come WASD sintetici per chi legge i tasti,
// tipo lo snowboard); stick destro = mira nei dungeon e nei Templari (rpg/mira_stick.ts); ogni altro pulsante lancia il tasto di serie
// dell'azione che gli hai dato (mappa.ts), così funziona in tutte le modalità senza che ognuna lo sappia.
import { PULSANTI_ASSEGNABILI, azioneDi } from './azioni.ts';
import { azioneDelPad, inCattura, inviaTasto } from './mappa.ts';

const MORTA = 0.22; // zona morta degli stick (frazione della corsa); oltre, la forza riparte da 0
const SOGLIA_DIR = 0.5; // quanto spingere per far scattare un tasto direzionale sintetico
const DIREZIONI: readonly (readonly [string, 'x' | 'y', 1 | -1])[] = [['sinistra', 'x', -1], ['destra', 'x', 1], ['su', 'y', -1], ['giu', 'y', 1]];

type V = { x: number; y: number };
let connesso = false, nome = '', raf = 0;
let mov: V = { x: 0, y: 0 }, mira: V = { x: 0, y: 0 };
const giu = new Set<number>(); // pulsanti già premuti
const emessi = new Map<number, string>(); // pulsante → tasto sintetico giù
const dirGiu = new Map<string, string>(); // direzione → tasto sintetico giù
let aspetta: ((b: number) => void) | null = null;
const ascoltatori = new Set<() => void>();

const radiale = (x: number, y: number): V => {
  const m = Math.sqrt(x * x + y * y);
  if (m < MORTA) return { x: 0, y: 0 };
  const f = Math.min(1, (m - MORTA) / (1 - MORTA)) / m;
  return { x: x * f, y: y * f };
};

/** Movimento del controller in assi schermo (x destra, y giù), 0..1 di forza; {0,0} a riposo. */
export const padMovimento = (): V => mov;
/** Stick destro: la mira, in assi schermo come il joystick di mira del telefono. */
export const padMira = (): V => mira;
/** Il controller collegato (nome del browser) o null. */
export const padCollegato = (): string | null => (connesso ? nome : null);
export const cambiaPad = (f: () => void): (() => void) => { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; };
/** Il tasto sintetico l'ha fatto il controller, non la tastiera. */
const delPad = new WeakSet<Event>();
export const eDelPad = (e: Event): boolean => delPad.has(e);

/** Il prossimo pulsante premuto (la schermata Comandi, per assegnarlo); `null` annulla. Intanto il controller non muove niente. */
export function aspettaPulsante(cb: ((b: number) => void) | null): void { aspetta = cb; }

function manda(tipo: 'keydown' | 'keyup', code: string): void {
  if (tipo === 'keydown' && document.activeElement instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; // si sta scrivendo
  inviaTasto(tipo, code, false, delPad);
}

function lasciaTutto(): void {
  for (const c of emessi.values()) manda('keyup', c);
  for (const c of dirGiu.values()) manda('keyup', c);
  emessi.clear(); dirGiu.clear(); giu.clear(); mov = { x: 0, y: 0 }; mira = { x: 0, y: 0 };
}

function leggi(): void {
  const gp = (navigator.getGamepads?.() ?? []).find((g) => g && g.connected) ?? null;
  if (!gp) { scollega(); return; }
  if (!connesso) { connesso = true; nome = gp.id.replace(/\s*\(.*$/, '').slice(0, 40) || 'Controller'; ascoltatori.forEach((f) => f()); }
  const bt = (i: number) => !!gp.buttons[i]?.pressed || (gp.buttons[i]?.value ?? 0) > 0.5;
  const sx = radiale(gp.axes[0] ?? 0, gp.axes[1] ?? 0), dx = (bt(15) ? 1 : 0) - (bt(14) ? 1 : 0), dy = (bt(13) ? 1 : 0) - (bt(12) ? 1 : 0);
  mov = dx || dy ? { x: dx * 0.7, y: dy * 0.7 } : sx; // la croce cammina; lo stick sfuma
  mira = radiale(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
  const ferma = aspetta !== null || inCattura();
  // direzioni sintetiche: chi legge i tasti (snowboard…) le vede come WASD
  for (const [id, asse, verso] of DIREZIONI) {
    const on = !ferma && mov[asse] * verso >= SOGLIA_DIR;
    const code = azioneDi(id)!.tasti[0];
    if (on && !dirGiu.has(id)) { dirGiu.set(id, code); manda('keydown', code); }
    else if (!on && dirGiu.has(id)) { manda('keyup', dirGiu.get(id)!); dirGiu.delete(id); }
  }
  for (let b = 0; b < PULSANTI_ASSEGNABILI; b++) {
    const p = bt(b);
    if (p === giu.has(b)) continue;
    if (p) {
      giu.add(b);
      if (aspetta) { const cb = aspetta; aspetta = null; cb(b); continue; }
      const id = ferma ? null : azioneDelPad(b), a = id ? azioneDi(id) : undefined;
      if (a) { emessi.set(b, a.tasti[0]); manda('keydown', a.tasti[0]); }
    } else {
      giu.delete(b);
      const c = emessi.get(b);
      if (c) { manda('keyup', c); emessi.delete(b); }
    }
  }
}

function giro(): void { leggi(); raf = connesso ? requestAnimationFrame(giro) : 0; }
function scollega(): void {
  if (!connesso) return;
  lasciaTutto(); connesso = false; nome = ''; ascoltatori.forEach((f) => f());
}
const parti = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(giro); };

let avviato = false;
export function avviaPad(): void {
  if (avviato || typeof addEventListener === 'undefined') return;
  avviato = true;
  addEventListener('gamepadconnected', () => { leggi(); parti(); });
  addEventListener('gamepaddisconnected', () => { if (raf) cancelAnimationFrame(raf); raf = 0; leggi(); });
  addEventListener('blur', lasciaTutto);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { lasciaTutto(); if (raf) cancelAnimationFrame(raf); raf = 0; } else if (connesso) parti(); });
  if ((navigator.getGamepads?.() ?? []).some((g) => g?.connected)) { leggi(); parti(); } // già collegato prima che la pagina si aprisse
}
