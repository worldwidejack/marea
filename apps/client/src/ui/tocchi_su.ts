// Rete di sicurezza dei comandi a tocco: un dito che il browser non ha mai «alzato» (pointerup perso: cattura saltata, gesto di sistema,
// tendina delle notifiche, cambio di app) lasciava il bottone, il joystick o la mira incollati. Nel dungeon la A incollata tiene l'eroe
// in carica o con l'arco teso per sempre: non risponde più a niente finché qualcosa non gli azzera l'azione. Qui si ascolta la verità del
// telefono: quando non c'è più nessun dito sullo schermo (touchend/touchcancel con `touches` vuoto), o la pagina va via o in secondo
// piano, tutti i comandi registrati lasciano quello che tengono. Un pointerup normale ha già fatto il suo lavoro prima, quindi di
// solito non c'è niente da lasciare.
const chi = new Set<() => void>();
let attaccato = false;

function tutti(): void { for (const f of [...chi]) f(); }

function attacca(): void {
  if (attaccato || typeof addEventListener !== 'function') return;
  attaccato = true;
  const su = (e: TouchEvent) => { if (e.touches.length === 0) tutti(); };
  addEventListener('touchend', su, true); addEventListener('touchcancel', su, true);
  addEventListener('pagehide', tutti);
  document.addEventListener('visibilitychange', () => { if (document.hidden) tutti(); });
}

/** `lascia` viene chiamata quando nessun dito è più sullo schermo (o la pagina si nasconde): deve lasciare tutto quello che tiene, e
 *  non fare niente se non tiene niente. Ritorna chi la toglie. */
export function alTuttiSu(lascia: () => void): () => void {
  attacca(); chi.add(lascia);
  return () => { chi.delete(lascia); };
}
