// I colori, il carattere e la cornice del «libro illustrato»: stanno qui (e non in kit.ts) perché li usano anche ui/style.ts e il kit,
// che importa style.ts: un file a parte evita l'import circolare.
/** I colori del libro: carta, oro, inchiostro, verde acqua (il «sì»), rosso (avvisi e A). */
export const LIBRO = {
  carta: '#FAE8C5', cartaChiara: '#FDF2DA', cartaScura: '#EBD5A8', filo: '#D9C08A',
  oro: '#D9AA45', oroChiaro: '#F2CF72', oroScuro: '#A97A22',
  inchiostro: '#2E2118', inchiostro2: '#6B5236',
  acqua: '#0B7896', acquaScura: '#0A4F63', acquaChiara: '#7FC3C9',
  rosso: '#C8423A', rossoScuro: '#8E2A24', blu: '#2F6FC0', foglia: '#5E9A6E', verdeAvviso: '#E6EDC2',
} as const;
/** Serif da libro di fiabe (Alegreya) per titoli, bottoni, numeri e testi. */
export const FONT_LIBRO = "'MzAlegreya', 'Alegreya', Georgia, 'Times New Roman', serif";
const L = LIBRO;
const svg = (dentro: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'>${dentro}</svg>`)}")`;
/** Il rametto accanto ai titoli. */
export const RAMETTO = svg(`<path d='M2 15C12 15 22 12 34 4' fill='none' stroke='${L.acquaScura}' stroke-width='1.6' stroke-linecap='round'/><path d='M14 13.5c-1-4 1-7 5-8-1 4-2 7-5 8zM22 10.5c0-4 3-6 7-6-2 3-3 5-7 6zM12 14c-4 1-7-1-8-4 4 0 6 1 8 4zM21 11c-3 2-7 2-9 0 3-2 6-2 9 0z' fill='${L.foglia}' stroke='${L.acquaScura}' stroke-width='.8'/>`);
/** Cornice del libro: bordo d'oro, filo d'inchiostro fuori, filo d'oro scuro dentro. */
export const CORNICE_LIBRO = (b = 2) => `border: ${b}px solid ${L.oro}; box-shadow: 0 0 0 1.5px ${L.inchiostro}, inset 0 0 0 1.5px ${L.carta}, inset 0 0 0 2.5px ${L.oroScuro}, 0 3px 0 1.5px rgba(46,33,24,.35);`;
