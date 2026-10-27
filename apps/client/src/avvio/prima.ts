// Prima la storia: quando tocca a un personaggio (Fulvio al banco, Bepi al Cantiere, il Furetto, Gigi…), la storia delle prime ore
// (storia/, chunk a parte) parla lei al posto della scheda di sempre. Chi apre la sua scheda chiede qui prima; `poi` è la scheda di sempre
// (con la frase del personaggio, se la storia gliene dà una), che la storia può aprire quando ha finito.
type Gancio = (chi: string, poi: (frase?: string) => void) => boolean;
let gancio: Gancio | null = null;

/** true = ci pensa la storia (la scheda di sempre non si apre, o la apre lei con `poi`). */
export const primaLaStoria = (chi: string, poi: (frase?: string) => void): boolean => gancio?.(chi, poi) ?? false;
/** La storia si mette davanti (null = toglie il gancio). */
export const setPrimaLaStoria = (g: Gancio | null): void => { gancio = g; };
