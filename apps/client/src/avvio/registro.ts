// Il registro delle modalità: ogni pannello o gioco del mondo dichiara una volta sola a che gruppo appartiene, quando è aperto e come si
// chiude. Da qui si calcola chi copre le frecce, chi ferma il mondo, chi blocca i tasti: una modalità nuova è una riga in main.ts, non sei.
//  - pannello: sta sopra il mondo (Diario, Porto, Record, botteghe, libro degli ospiti)
//  - personale: i pannelli tuoi (look, novità, scheda dell'eroe)
//  - gioco: una partita o un posto chiuso (Regata, minigiochi, dungeon, chiesa dei Templari, Arena, Difesa)
//  - ferma: ferma il mondo e basta (funivia dell'Adrenalina, modalità foto, pesca dal negozio)
export type Gruppo = 'pannello' | 'personale' | 'gioco' | 'ferma';
export type Voce = { id: string; gruppo: Gruppo; aperto(): boolean; chiudi?(): void };

export function creaRegistro(voci: readonly Voce[]) {
  const foglio = () => !!document.querySelector('#mzSheet.on'); // il foglio di un edificio dell'isola
  const aperto = (gruppi: readonly Gruppo[], tranne?: string) => voci.some((v) => v.id !== tranne && gruppi.includes(v.gruppo) && v.aperto());
  return {
    foglio,
    /** Qualcosa di aperto nei gruppi dati (senza `tranne`). */
    aperto,
    /** Gara, minigioco, dungeon o un pannello aperto: le frecce sullo schermo (guida, mete) si tolgono e le decorazioni non rispondono ad A. */
    coperto: () => aperto(['pannello', 'personale', 'gioco']),
    /** Un pannello del mondo, il foglio di un edificio o una partita: niente editor, feed, mappa, emote. */
    occupato: () => aperto(['pannello', 'gioco']) || foglio(),
    /** Chiude i pannelli (del mondo e personali), tranne quelli in `tranne`; il foglio di un edificio con `foglio`. */
    chiudi(tranne: readonly string[] = [], conFoglio = false) {
      for (const v of voci) if ((v.gruppo === 'pannello' || v.gruppo === 'personale') && !tranne.includes(v.id)) v.chiudi?.();
      if (conFoglio) document.querySelector<HTMLElement>('#mzSheet.on .mz-x')?.click();
    },
  };
}
export type Registro = ReturnType<typeof creaRegistro>;
