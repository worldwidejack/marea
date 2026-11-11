// Catalogo usato sia dal gioco sia dalla schermata dei comandi. I codici tasto sono quelli letti dai controlli della modalità.
type Def = readonly [id: string, nome: string, tasti: readonly [string?, string?], pad: number | null];
const su: Def = ['su', 'Su', ['KeyW', 'ArrowUp'], 12];
const giu: Def = ['giu', 'Giù', ['KeyS', 'ArrowDown'], 13];
const sx: Def = ['sinistra', 'Sinistra', ['KeyA', 'ArrowLeft'], 14];
const dx: Def = ['destra', 'Destra', ['KeyD', 'ArrowRight'], 15];
const movimento = [su, giu, sx, dx];
const azione: Def = ['azione', 'Interagisci', ['Space', 'KeyE'], 0];
const corri: Def = ['corri', 'Corri', ['ShiftLeft', 'ShiftRight'], 5];
const schiva: Def = ['schiva', 'Capriola', ['KeyV'], 1];
const pausa: Def = ['pausa', 'Pausa', ['Escape'], 9];
const esci: Def = ['pausa', 'Esci', ['Escape'], 9];
const eroe: Def = ['eroe', 'Inventario', ['KeyI'], 8];
const hud: Def = ['hud', 'Seleziona i pulsanti a schermo', [], 10];
const attacca: Def = ['attacca', 'Attacca', ['KeyZ'], 7];
const cursore: Def = ['clic', 'Usa il puntatore', [], 0];
const preferiti: Def[] = [
  ['pref1', 'Preferito 1', ['Digit1', 'Numpad1'], 4],
  ['pref2', 'Preferito 2', ['Digit2', 'Numpad2'], 5],
  ['pref3', 'Preferito 3', ['Digit3', 'Numpad3'], 6],
];
const dungeon: Def[] = [
  ...movimento, ['azione', 'Interagisci con scale, valvole e timoni', ['Space'], 0], schiva, attacca, pausa, eroe,
  ['pozione', 'Bevi una pozione', ['KeyR'], 3], ['scarica', 'Scarica di frecce', ['KeyE'], 2],
  ['leggi', 'Leggi', ['KeyL'], 11], ...preferiti,
];
const navigazione: Def[] = [
  ['mappa', 'Mappa', ['KeyM'], 4], ['zoomin', 'Ingrandisci minimappa', ['NumpadAdd', 'Equal'], null],
  ['zoomout', 'Riduci minimappa', ['NumpadSubtract', 'Minus'], null],
  ['emote', 'Ruota delle emote', ['KeyG'], null], ['diario', 'Diario', ['KeyJ'], null],
  ['look', 'Avatar', ['KeyC'], null], ['novita', 'Novità', ['KeyF'], null], ['foto', 'Foto', ['KeyO'], null],
  ['viaggio', 'Viaggio rapido', ['KeyU'], null],
];
const emote: Def[] = Array.from({ length: 8 }, (_, i) => ['emote' + (i + 1), 'Emote ' + (i + 1), ['Digit' + (i + 1), 'Numpad' + (i + 1)], null]);
const tastoUnico = (nome: string): Def => ['azione', nome, ['Space', 'KeyE'], 0];

export const PROFILI = {
  borgo: { nome: 'Borgo e isole a piedi', azioni: [
    ...movimento, azione, corri, schiva, pausa, eroe, hud, ...navigazione, ...emote,
    ['attrezzo', 'Cambia attrezzo', ['KeyQ'], 3], ['pesca', 'Pesca', ['KeyP'], 2],
  ] },
  barca: { nome: 'Barca', azioni: [
    ...movimento, azione, pausa, eroe, hud, ...navigazione, ...emote,
    ['pesca', 'Pesca', ['KeyP'], 2], ['perle', 'Tuffati per le perle', ['KeyT'], 3], ['regata', 'Avvia la Regata', ['KeyR'], 5],
  ] },
  pesca: { nome: 'Pesca', azioni: [...movimento, tastoUnico('Lancia la lenza o ferra'), esci] },
  arreda: { nome: 'Arredamento', azioni: [
    ...movimento, tastoUnico('Sposta o posa un mobile'), ['ruota', 'Annulla o termina il posizionamento', ['ShiftLeft', 'ShiftRight'], 2], hud,
  ] },
  regata: { nome: 'Regata', azioni: [...movimento, tastoUnico('Remata'), esci] },
  consegne: { nome: 'Consegne', azioni: [...movimento, tastoUnico('Consegna'), esci] },
  corse: { nome: 'Gran Premio', azioni: [
    ['su', 'Accelera', ['KeyW', 'ArrowUp'], 7], ['giu', 'Frena', ['KeyS', 'ArrowDown'], 6],
    ['sinistra', 'Sterza a sinistra', ['KeyA', 'ArrowLeft'], 14], ['destra', 'Sterza a destra', ['KeyD', 'ArrowRight'], 15],
    ['azione', 'Gas (interfaccia touch) / Avanza', ['Space', 'KeyE'], 0],
    ['corri', 'Freno e retromarcia', ['ShiftLeft', 'ShiftRight'], 1], esci,
    ['oggetto', 'Usa oggetto', ['KeyQ'], 2], ['retro', 'Visuale posteriore', ['KeyR'], 5],
    ['camera', 'Cambia telecamera', ['KeyC'], 3], ['pixel', 'Cambia nitidezza', ['KeyH'], 11],
  ] },
  snowboard: { nome: 'Snowboard', azioni: [
    ['sinistra', 'Sterza a sinistra', ['KeyA'], 14], ['destra', 'Sterza a destra', ['KeyD'], 15],
    ['trickSu', 'Trick avanti', ['ArrowUp'], 12], ['trickGiu', 'Trick indietro', ['ArrowDown'], 13],
    ['trickSx', 'Trick a sinistra', ['ArrowLeft'], 4], ['trickDx', 'Trick a destra', ['ArrowRight'], 5],
    tastoUnico('Carica il salto / Afferra la tavola'), ['inverti', 'Inverti sterzata e trick', ['KeyP'], null], esci,
  ] },
  dungeon: { nome: 'Dungeon', azioni: [...dungeon, ['salva', 'Salva alla lanterna', ['KeyF'], null], ['esciLanterna', 'Esci dalla lanterna', ['KeyX'], null], hud] },
  dungeonFp: { nome: 'Dungeon in prima persona', azioni: [
    ...dungeon.filter(([id]) => id !== 'scarica' && id !== 'leggi'), ['leggi', 'Leggi', ['KeyL'], 11], ['scarica', 'Scarica di frecce', ['KeyH'], null], ['fruga', 'Fruga nel bottino', ['KeyE'], 2],
    ['salva', 'Salva alla lanterna', ['KeyF'], null], ['esciLanterna', 'Esci dalla lanterna', ['KeyX'], null], hud,
  ] },
  templari: { nome: 'Templari', azioni: [
    ...movimento, attacca, pausa, ['attiva', 'Usa o attiva', ['KeyF'], 0],
    ['scambia', 'Scambia arma', ['KeyQ'], 2], ['super', 'Super', ['KeyR'], 3],
    ['ombre', 'Attiva o disattiva le ombre', ['KeyL'], null], ['luce', 'Cambia luce', ['KeyK'], null], hud,
  ] },
  arena: { nome: 'Arena', azioni: [
    ...movimento, attacca, schiva, pausa, ['interagisci', 'Interagisci o raccogli', ['KeyE'], 0], ['ulti', 'Abilità suprema', ['KeyF'], 3],
    ...Array.from({ length: 9 }, (_, i): Def => ['slot' + (i + 1), 'Slot ' + (i + 1), ['Digit' + (i + 1), 'Numpad' + (i + 1)], [4, 5, 6, 2][i] ?? null]),
  ] },
  difesa: { nome: 'Difesa', azioni: [
    cursore, ['pausa', 'Pausa', ['Space'], 9], ['annulla', 'Deseleziona', ['Escape'], 1], ['esci', 'Torna all’isola', [], 8],
    ['pala', 'Pala', ['KeyE'], 2], ['velocita', 'Cambia velocità', ['KeyF'], 5],
    ['auto', 'Pilota automatico', ['KeyT'], null], ['muto', 'Attiva o disattiva audio', ['KeyM'], null], ['riavvia', 'Ricomincia', ['KeyR'], null],
    ...Array.from({ length: 9 }, (_, i): Def => ['carta' + (i + 1), 'Carta ' + (i + 1), ['Digit' + (i + 1), 'Numpad' + (i + 1)], null]),
  ] },
  ingorgo: { nome: 'Ingorgo', azioni: [cursore, ['riavvia', 'Ricomincia', ['KeyR'], 3], esci] },
  koi: { nome: 'Carpe koi', azioni: [cursore, esci] },
  pinguini: { nome: 'Pinguini', azioni: [
    cursore, esci, ['riavvia', 'Ricomincia', ['KeyR'], 3],
    ['mossaSu', 'Scivola in su', ['ArrowUp', 'KeyW'], 12], ['mossaGiu', 'Scivola in giù', ['ArrowDown', 'KeyS'], 13],
    ['mossaSx', 'Scivola a sinistra', ['ArrowLeft', 'KeyA'], 14], ['mossaDx', 'Scivola a destra', ['ArrowRight', 'KeyD'], 15],
  ] },
  scacchi: { nome: 'Scacco in 3', azioni: [
    su, giu, sx, dx, ['conferma', 'Seleziona o muovi il pezzo', ['Space'], 0], ['indietro', 'Esci', ['Escape'], 1],
    ['annulla', 'Annulla la mossa', ['Backspace', 'KeyZ'], 2], ['riavvia', 'Ricomincia', ['KeyR'], 3],
    ['prossimo', 'Problema successivo', ['Enter'], 9], ['precedente', 'Casella precedente', [], 4], ['avanti', 'Casella successiva', [], 5],
  ] },
  arrembaggio: { nome: 'Arrembaggio', azioni: [['azione', 'Carica e spara', ['Space', 'KeyF'], 0], esci] },
  lava: { nome: 'Fuga dalla lava', azioni: [['azione', 'Salta', ['Space', 'KeyJ'], 0], esci] },
  perle: { nome: 'Perle', azioni: [['azione', 'Immergiti', ['Space', 'KeyT'], 0], esci] },
  menu: { nome: 'Menu e pannelli', azioni: [
    su, giu, sx, dx, ['conferma', 'Conferma', ['Enter'], 0], ['indietro', 'Indietro', ['Escape'], 1],
    ['chiudi', 'Chiudi il pannello', ['Escape'], 9], ['puntatore', 'Clic del puntatore', ['Space'], 7],
    ['avanti', 'Controllo successivo', ['Tab'], 5], ['precedente', 'Controllo precedente', ['Tab'], 4],
    ['rimuovi', 'Svuota il binding selezionato', ['Delete'], 2],
    ['zoomIn', 'Avvicina o scorri su col puntatore', ['PageUp'], 10], ['zoomOut', 'Allontana o scorri giù col puntatore', ['PageDown'], 11],
  ] },
} satisfies Record<string, { nome: string; azioni: readonly Def[] }>;

export type Profilo = keyof typeof PROFILI;
export const CON_STICK = new Set<Profilo>([
  'borgo', 'barca', 'pesca', 'arreda', 'regata', 'consegne', 'corse', 'snowboard',
  'dungeon', 'dungeonFp', 'templari', 'arena', 'menu', 'scacchi',
]);
export type Azione = { id: string; nome: string; tasti: Def[2]; pad: number | null };
const catalogo = new Map((Object.keys(PROFILI) as Profilo[]).map((p) => [
  p, PROFILI[p].azioni.map(([id, nome, tasti, pad]): Azione => ({ id, nome, tasti, pad })),
]));
export const azioni = (profilo: Profilo): readonly Azione[] => catalogo.get(profilo) ?? [];
export const azioneDi = (profilo: Profilo, id: string): Azione | undefined => azioni(profilo).find((a) => a.id === id);
export const SLOT = 2;
const NOMI_PAD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'Croce ↑', 'Croce ↓', 'Croce ←', 'Croce →'];
export const PULSANTI_ASSEGNABILI = NOMI_PAD.length;
export const nomePad = (b: number | null): string => b === null ? '—' : NOMI_PAD[b] ?? '—';

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
  const m = /^Key(.)$/.exec(code) ?? /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (m) return m[1]!.toLowerCase();
  if (code === 'Space') return ' ';
  if (code === 'Equal') return '=';
  if (code === 'Minus') return '-';
  if (code.startsWith('Shift')) return 'Shift';
  return code;
}
