// Flag dall'URL, congelati all'avvio. Contratto: docs/TECH.md §9.
export type Flags = { fps: boolean; test: boolean; seed: number; nosound: boolean; quality: 'low' | 'high'; net: boolean; autopilot: boolean; zone: string; token: string; sfide: boolean; invito: string; serie: boolean; rientro: boolean; novita: boolean; templari: boolean; banco: boolean; gara: boolean; pulito: boolean; adrenalina: boolean; arena: '' | 'si' | 'banco'; dipinto: 'si' | 'no' | 'prova'; nuvole: 'A' | 'B' };
function read(): Flags {
  const q = new URLSearchParams(location.search);
  const on = (k: string) => q.get(k) === '1' || q.get(k) === 'true';
  let token = q.get('t') ?? '';
  try {
    if (token) localStorage.setItem('marea:token', token);
    else token = localStorage.getItem('marea:token') ?? '';
  } catch { /* storage bloccato: si gioca offline */ }
  return {
    fps: on('fps'), test: on('test'), seed: Number(q.get('seed') ?? 1) || 1, nosound: on('nosound'),
    quality: q.get('quality') === 'low' ? 'low' : 'high', net: q.get('net') !== '0', autopilot: on('autopilot'),
    zone: q.get('zone') ?? 'porto', token,
    invito: q.get('invito') ?? '', // link di gruppo: senza token si sceglie il nome (ui/entra.ts)
    novita: on('novita'), // coi test (?test=1) la schermata «Dall'ultima volta» (#279) compare solo con ?novita=1
    rientro: on('rientro'), // coi test (?test=1) la cartolina «Mentre eri via» compare solo con ?rientro=1 (l'orologio di prova la farebbe uscire ovunque)
    serie: on('serie'), // coi test (?test=1) le impostazioni partono spente; ?serie=1 usa quelle di serie vere (#59)
    sfide: on('sfide'), // Tavolo delle Sfide con posta e feed: spenti finché si prova il gioco da soli (?sfide=1 li riaccende)
    gara: q.get('gara') === 'amici', // link «gara tra amici» (#204): si apre subito la sala delle Corse
    templari: on('templari') || q.get('templari') === 'banco', // Isola dei Templari per le prove: isola aperta, altare senza reliquia, bottone ⚔ per entrare subito nelle ondate
    banco: q.get('templari') === 'banco', // stanza di prova dei Templari: dentro la chiesa appena si apre, col banco (zombie, armi, ondata, punti), senza server
    arena: q.get('arena') === 'banco' ? 'banco' : on('arena') ? 'si' : '', // Arena: ?arena=1 bottoni di prova (⚔ al colosseo), ?arena=banco subito nel duello contro il bot
    pulito: q.get('pulito') !== '0', // mondo pulito (#286): texture senza puntini e mare della stampa; ?pulito=0 = com'era prima
    // isola dei Templari dipinta (templari/dipinto.ts): ?dipinto=0 i blocchi di prima, ?dipinto=prova i tasti P/L/K e window.__dipinto; coi test
    // (?test=1) spenta se non si chiede ?dipinto=1: su SwiftShader lo shader del dipinto rallenta tanto da far scadere le prove a tempo
    dipinto: q.get('dipinto') === '0' ? 'no' : q.get('dipinto') === 'prova' ? 'prova' : q.get('dipinto') === '1' || !on('test') ? 'si' : 'no',
    nuvole: (q.get('nuvole') ?? '').toUpperCase() === 'B' ? 'B' : 'A', // meteo a nuvole (#361): ?nuvole=B la variante B per la scelta di Jack (forma, quota, copertura)
    adrenalina: on('adrenalina'), // Isola dell'Adrenalina per le prove: liberatoria già firmata, casco non richiesto, bottone 🚡 per andare al cancello
  };
}
export const FLAGS: Readonly<Flags> = Object.freeze(read());
