// Le azioni che si possono rimappare: per ognuna i tasti di serie sulla tastiera (fino a due) e il pulsante di serie del controller.
// Il gioco continua a leggere i codici di sempre (KeyE, Space…): la mappa (mappa.ts) traduce quello che premi nel codice di serie dell'azione.
// Per questo `tasti[0]` e `tasti[1]` sono i codici che il resto del codice si aspetta, e non vanno cambiati senza cambiare chi li legge.
// Pulsanti del controller = indici della mappatura «standard» del browser (Xbox: A B X Y; PlayStation: ✕ ○ □ △ negli stessi posti).

export type Gruppo = 'Movimento' | 'Nel mondo' | 'Dungeon' | 'Schede';
export type Azione = {
  readonly id: string; readonly nome: string; readonly gruppo: Gruppo;
  /** Tasti di serie: il primo e (se c'è) il secondo. */
  readonly tasti: readonly [string, string?];
  /** Pulsante di serie del controller (null = nessuno); `senzaPad` = ci pensano lo stick e la croce, il pulsante non si assegna. */
  readonly pad: number | null;
  readonly senzaPad?: true;
};

export const AZIONI: readonly Azione[] = [
  { id: 'su', nome: 'Su', gruppo: 'Movimento', tasti: ['KeyW', 'ArrowUp'], pad: null, senzaPad: true },
  { id: 'giu', nome: 'Giù', gruppo: 'Movimento', tasti: ['KeyS', 'ArrowDown'], pad: null, senzaPad: true },
  { id: 'sinistra', nome: 'Sinistra', gruppo: 'Movimento', tasti: ['KeyA', 'ArrowLeft'], pad: null, senzaPad: true },
  { id: 'destra', nome: 'Destra', gruppo: 'Movimento', tasti: ['KeyD', 'ArrowRight'], pad: null, senzaPad: true },
  { id: 'azione', nome: 'A · azione', gruppo: 'Nel mondo', tasti: ['Space', 'KeyE'], pad: 0 },
  { id: 'corri', nome: 'B · corri', gruppo: 'Nel mondo', tasti: ['ShiftLeft', 'ShiftRight'], pad: 1 },
  { id: 'schiva', nome: 'Schiva', gruppo: 'Nel mondo', tasti: ['KeyV'], pad: 7 },
  { id: 'pozione', nome: 'Pozione', gruppo: 'Dungeon', tasti: ['KeyR'], pad: 3 },
  { id: 'fruga', nome: 'Fruga · apri (1ª persona)', gruppo: 'Dungeon', tasti: ['KeyE'], pad: 2 },
  { id: 'salva', nome: 'Salva alla lanterna (1ª persona)', gruppo: 'Dungeon', tasti: ['KeyF'], pad: 10 },
  { id: 'esciLanterna', nome: 'Esci dalla lanterna (1ª persona)', gruppo: 'Dungeon', tasti: ['KeyX'], pad: 11 },
  { id: 'scarica', nome: 'Scarica di frecce', gruppo: 'Dungeon', tasti: ['KeyE'], pad: null },
  { id: 'pref1', nome: 'Preferito 1', gruppo: 'Dungeon', tasti: ['Digit1'], pad: 4 },
  { id: 'pref2', nome: 'Preferito 2', gruppo: 'Dungeon', tasti: ['Digit2'], pad: 5 },
  { id: 'pref3', nome: 'Preferito 3', gruppo: 'Dungeon', tasti: ['Digit3'], pad: 6 },
  { id: 'pausa', nome: 'Pausa · indietro', gruppo: 'Schede', tasti: ['Escape'], pad: 9 },
  { id: 'eroe', nome: 'Eroe · zaino', gruppo: 'Schede', tasti: ['KeyI'], pad: 8 },
  { id: 'mappa', nome: 'Mappa', gruppo: 'Schede', tasti: ['KeyM'], pad: null },
  { id: 'emote', nome: 'Ruota delle emote', gruppo: 'Schede', tasti: ['KeyG'], pad: null },
  { id: 'diario', nome: 'Diario', gruppo: 'Schede', tasti: ['KeyJ'], pad: null },
  { id: 'look', nome: 'Look', gruppo: 'Schede', tasti: ['KeyC'], pad: null },
  { id: 'novita', nome: 'Novità', gruppo: 'Schede', tasti: ['KeyF'], pad: null },
  { id: 'foto', nome: 'Foto', gruppo: 'Schede', tasti: ['KeyO'], pad: null },
];

export const GRUPPI: readonly Gruppo[] = ['Movimento', 'Nel mondo', 'Dungeon', 'Schede'];
export const SLOT = 2; // due tasti per azione

const NOMI_PAD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Indietro', 'Start', 'L3', 'R3'];
/** I pulsanti che si possono assegnare: i 12 della mappatura standard (la croce e gli stick servono a muoversi). */
export const PULSANTI_ASSEGNABILI = NOMI_PAD.length;
export const nomePad = (b: number | null): string => (b === null ? '—' : NOMI_PAD[b] ?? `Tasto ${b}`);

const NOMI_TASTO: Record<string, string> = {
  Space: 'Spazio', Escape: 'Esc', Enter: 'Invio', Tab: 'Tab', Backspace: '⌫', ShiftLeft: 'Maiusc sx', ShiftRight: 'Maiusc dx',
  ControlLeft: 'Ctrl sx', ControlRight: 'Ctrl dx', AltLeft: 'Alt sx', AltRight: 'Alt dx', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']',
};
export const nomeTasto = (c: string | null): string => {
  if (!c) return '—';
  const n = NOMI_TASTO[c];
  if (n) return n;
  const m = /^(?:Key|Digit)(.)$/.exec(c) ?? /^Numpad(.+)$/.exec(c);
  return m ? (c.startsWith('Numpad') ? `Num ${m[1]}` : m[1]!) : c;
};

/** Il `key` che accompagna un codice nei tasti sintetici (alcuni pezzi del gioco leggono `key`, non `code`). */
export function chiaveDi(code: string): string {
  const m = /^Key(.)$/.exec(code) ?? /^Digit(.)$/.exec(code);
  if (m) return m[1]!.toLowerCase();
  if (code === 'Space') return ' ';
  if (code.startsWith('Shift')) return 'Shift';
  return code;
}

export const azioneDi = (id: string): Azione | undefined => AZIONI.find((a) => a.id === id);
