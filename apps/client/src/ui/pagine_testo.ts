// Un testo lungo in pagine corte, per i dialoghi (Fulvio): al massimo `righe` righe e `caratteri` lettere a pagina (così sul computer, dove le righe
// sono larghe, le pagine restano corte come sul telefono). Si va a capo dove finisce una frase, se la frase è lunga a una virgola, solo alla fine per una parola. Il font è monospazio, quindi le righe si contano senza misurare il DOM: `cpl` sono i caratteri che stanno in una riga.

/** Quante righe occupa il testo andando a capo tra le parole, `cpl` caratteri per riga. */
function righeDi(testo: string, cpl: number): number {
  let righe = 1, w = 0;
  for (const parola of testo.split(/\s+/)) {
    if (!parola) continue;
    if (!w) w = parola.length;
    else if (w + 1 + parola.length <= cpl) w += 1 + parola.length;
    else { righe++; w = parola.length; }
    while (w > cpl) { righe++; w -= cpl; } // una parola più lunga di una riga si spezza da sola
  }
  return righe;
}

/** Frasi, poi pezzi di frase, poi parole. */
const TAGLI = [/(?<=[.!?…]["»”’)]?)\s+/, /(?<=[,;:])\s+/, /\s+/];

/** `testo` in pagine da al massimo `righe` righe di `cpl` caratteri e `caratteri` lettere, di peso simile (niente ultima pagina da due parole); un testo corto resta una pagina sola. */
export function spezza(testo: string, cpl: number, righe: number, caratteri: number): string[] {
  const entra = (t: string, lettere: number) => t.length <= lettere && righeDi(t, cpl) <= righe;
  const pezzi = (t: string, livello: number): string[] => {
    const tagli = TAGLI[livello];
    return entra(t, caratteri) || !tagli ? [t] : t.split(tagli).flatMap((x) => pezzi(x, livello + 1));
  };
  const unita = pezzi(testo.trim(), 0);
  const impagina = (lettere: number): string[] => {
    const pagine: string[] = [];
    for (const u of unita) {
      const ultima = pagine.length - 1;
      if (ultima >= 0 && entra(`${pagine[ultima]} ${u}`, lettere)) pagine[ultima] += ` ${u}`;
      else pagine.push(u);
    }
    return pagine;
  };
  let pagine = impagina(caratteri);
  // le pagine sono quante servono: si stringe il limite finché il numero non cambia, così pesano uguale
  for (let lettere = caratteri - 5; lettere > 20; lettere -= 5) {
    const p = impagina(lettere);
    if (p.length !== pagine.length) break;
    pagine = p;
  }
  return pagine.length ? pagine : [''];
}
