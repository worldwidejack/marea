// Flag dall'URL, congelati all'avvio. Contratto: docs/TECH.md §9.
export type Flags = { fps: boolean; test: boolean; seed: number; nosound: boolean; quality: 'low' | 'high'; net: boolean; autopilot: boolean; zone: string; token: string; sfide: boolean; invito: string; serie: boolean; rientro: boolean };
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
    rientro: on('rientro'), // coi test (?test=1) la cartolina «Mentre eri via» compare solo con ?rientro=1 (l'orologio di prova la farebbe uscire ovunque)
    serie: on('serie'), // coi test (?test=1) le impostazioni partono spente; ?serie=1 usa quelle di serie vere (#59)
    sfide: on('sfide'), // Tavolo delle Sfide con posta e feed: spenti finché si prova il gioco da soli (?sfide=1 li riaccende)
  };
}
export const FLAGS: Readonly<Flags> = Object.freeze(read());
