// Flag dall'URL, congelati all'avvio. Contratto: docs/TECH.md §9.
export type Flags = { fps: boolean; test: boolean; seed: number; nosound: boolean; quality: 'low' | 'high'; net: boolean; autopilot: boolean; zone: string; token: string; invito: string; serie: boolean; rientro: boolean; novita: boolean; home: boolean; storia: boolean; templari: boolean; banco: boolean; gara: boolean; adrenalina: boolean; difesa: boolean; arena: '' | 'si' | 'banco'; dipinto: 'si' | 'no' | 'prova'; slot: number | null; ruota: '' | '0' | '1'; finiture: Readonly<Record<string, string>> };
function read(): Flags {
  const q = new URLSearchParams(location.search);
  const on = (k: string) => q.get(k) === '1' || q.get(k) === 'true';
  const s = q.get('slot'), slot = s ? Number(s) : NaN;
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
    // schermata iniziale (avvio/home.ts) a ogni avvio; coi test (?test=1) solo con ?home=1, mai nei banchi e nel link della gara tra amici.
    // La stessa regola sta nello script in index.html, che la toglie prima di disegnarla
    home: (!on('test') || on('home')) && !q.has('banco') && q.get('templari') !== 'banco' && q.get('arena') !== 'banco' && q.get('gara') !== 'amici',
    novita: on('novita'), // coi test (?test=1) la schermata «Dall'ultima volta» (#279) compare solo con ?novita=1
    storia: on('storia'), // coi test (?test=1) la storia delle prime ore (storia/) parte solo con ?storia=1
    rientro: on('rientro'), // coi test (?test=1) la cartolina «Mentre eri via» compare solo con ?rientro=1 (l'orologio di prova la farebbe uscire ovunque)
    serie: on('serie'), // coi test (?test=1) le impostazioni partono spente; ?serie=1 usa quelle di serie vere (#59)
    gara: q.get('gara') === 'amici', // link «gara tra amici» (#204): si apre subito la sala delle Corse
    templari: on('templari') || q.get('templari') === 'banco', // Isola dei Templari per le prove: isola aperta, altare senza reliquia, bottone ⚔ per entrare subito nelle ondate
    banco: q.get('templari') === 'banco', // stanza di prova dei Templari: dentro la chiesa appena si apre, col banco (zombie, armi, ondata, punti), senza server
    arena: q.get('arena') === 'banco' ? 'banco' : on('arena') ? 'si' : '', // Arena: ?arena=1 bottoni di prova (⚔ al colosseo), ?arena=banco subito nel duello contro il bot
    // ombre cotte e cupo dei Templari (templari/ombre.ts) e Alpi dipinte dello snowboard (adrenalina/sfondo.ts): ?dipinto=0 spente,
    // ?dipinto=prova i tasti L/K dei Templari; coi test (?test=1) spente se non si chiede ?dipinto=1: su SwiftShader questi shader
    // rallentano tanto da far scadere le prove a tempo
    dipinto: q.get('dipinto') === '0' ? 'no' : q.get('dipinto') === 'prova' ? 'prova' : q.get('dipinto') === '1' || !on('test') ? 'si' : 'no',
    slot: Number.isInteger(slot) && slot >= 0 ? slot : null, // senza login (test): ?slot=N si nasce davanti alla casa N del Borgo, la barca al molo del Porto
    ruota: q.get('ruota') === '1' ? '1' : q.get('ruota') === '0' ? '0' : '', // Corse sul telefono: ?ruota=1 l'avviso «Ruota il telefono» sempre, ?ruota=0 mai
    adrenalina: on('adrenalina'), // Isola dell'Adrenalina per le prove: liberatoria già firmata, casco non richiesto, bottone 🚡 per andare al cancello
    difesa: on('difesa'), // Isola della Difesa per le prove: bottone 🥕 per andare al cancello dell'orto
    // banco delle finiture (provafiniture.html): ?pav=&carta=&liv=&stanza= la stanza in 3D, ?foglio=pav|muri&min= tutte insieme
    finiture: Object.fromEntries(['pav', 'carta', 'liv', 'stanza', 'foglio', 'min'].flatMap((k) => (q.has(k) ? [[k, q.get(k)!]] : []))),
  };
}
export const FLAGS: Readonly<Flags> = Object.freeze(read());
