// Ponte leggero verso suoni e musica (sta nel JS iniziale: poche righe, niente WebAudio). Gli altri moduli chiamano queste funzioni
// con UNA riga dove serve (`suona('moneta')`); finché il motore (audio/index.ts, chunk a parte) non è caricato non fanno niente.
// Il motore si scarica al primo gesto (tasto, tocco, clic: regola dei browser) se Musica o Effetti sono accesi nelle Impostazioni.
// ?nosound=1: mai. Coi test (?test=1) Musica ed Effetti partono spenti (render/viste.ts SPENTO), così i test di prima non cambiano.
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { GameWorld } from '../game/world.ts';

/** I suoni del gioco (audio/effetti.ts). */
export type SuonoId =
  | 'passo_sabbia' | 'passo_erba' | 'passo_legno' | 'passo_pietra' | 'passo_acqua' | 'passo_dungeon'
  | 'barca_su' | 'barca_giu' | 'remata'
  | 'moneta' | 'martello'
  | 'medaglia_oro' | 'medaglia_argento' | 'medaglia_bronzo' | 'fine'
  | 'boa' | 'bip' | 'via' | 'arrivo' | 'raffica'
  | 'apri' | 'chiudi' | 'click' | 'emote' | 'notifica'
  | 'lancio' | 'plop' | 'abbocca' | 'pesce' | 'scappato'
  | 'colpo_dato' | 'colpo_critico' | 'colpo_preso' | 'schivato' | 'nemico_ko' | 'raccolto' | 'pozione' | 'magia' | 'altare' | 'vuoto' | 'goccia'
  | 'cannone' | 'tuono' // Tempesta: Arrembaggio
  | 'salto' | 'sfrigola' // Vulcano: Fuga dalla lava
  | 'altoparlante' | 'pagina'; // lore nei dungeon (rpg/dungeon_testi.ts)
export type MusicaModo = 'giorno' | 'notte' | 'gara' | 'dungeon' | 'silenzio';
export type Meteo = 'sereno' | 'pioggia' | 'vento';
/** Quello che il motore legge dal gioco a ogni frame (main.ts lo passa una volta con collegaAudio). */
export type AudioMondo = {
  world: Pick<GameWorld, 'map' | 'avatar' | 'boat' | 'mode' | 'frozen' | 'race' | 'archipelago'>;
  root: HTMLElement;
  /** 'giorno' | 'tramonto' | 'notte' | 'alba' (render/aspetto.ts; col ciclo spento sempre 'giorno'). */
  momento(): string;
  /** Un minigioco a schermo o la sua scheda: la musica si abbassa. */
  gioco(): boolean;
  /** Nel Mondo Sotterraneo: niente mare, musica scura, passi sulla pietra. */
  dungeon(): boolean;
};
/** Il motore caricato (audio/index.ts). */
export type Audio = {
  suona(id: SuonoId, k?: number): void;
  volumi(musica: number, effetti: number): void;
  musica(m: MusicaModo | 'auto'): void;
  meteo(t: Meteo, k: number): void;
  vento(g: number): void;
  collega(m: AudioMondo): void;
  dungeonPasso(x: number, z: number): void;
  dungeonEvento(e: { t: string; su?: string; critico?: boolean }): void;
  resume(): void;
  stato(): Record<string, unknown>;
};

let motore: Audio | null = null, modulo: typeof import('./index.ts') | null = null, loading: Promise<void> | null = null, errore: string | null = null;
let mondo: AudioMondo | null = null, gesto = false, ascolto = false;
let vol = { musica: 0, effetti: 0 }, forzata: MusicaModo | 'auto' = 'auto', meteo: { t: Meteo; k: number } = { t: 'sereno', k: 0 };

/** Un suono una volta (variazione leggera di tono e volume già nel motore). `k` 0..1: intensità o indice (es. monete in fila). */
export function suona(id: SuonoId, k?: number): void { motore?.suona(id, k); }
/** Musica: 'auto' (di serie) la sceglie il gioco (giorno, notte, gara, dungeon); le altre la forzano. */
export const musica = { set(m: MusicaModo | 'auto'): void { forzata = m; motore?.musica(m); } };
/** Meteo vicino a un'isola a tema (futuro): pioggia o vento, k 0..1. */
export function setMeteo(t: Meteo, k: number): void { meteo = { t, k }; motore?.meteo(t, k); }
/** Raffica della Regata (0..1, ogni tick): soffio di vento, più forte quanto più è forte. */
export function vento(g: number): void { motore?.vento(g); }
/** Dungeon: posizione dell'eroe a ogni tick (i passi li conta il motore) ed eventi della sim (colpi, monete, altari). */
export function dungeonPasso(x: number, z: number): void { motore?.dungeonPasso(x, z); }
export function dungeonEvento(e: { t: string; su?: string; critico?: boolean }): void { motore?.dungeonEvento(e); }
/** Pesca (ui/pesca.ts, a ogni disegno): quando cambia fase, il suo suono (lancio, galleggiante in acqua, abbocca, preso, scappato). */
let faseWas: string | null = null;
const FASI: Record<string, SuonoId> = { lancio: 'lancio', attesa: 'plop', abbocca: 'abbocca', preso: 'pesce', scappato: 'scappato' };
export function pescaFase(f: string | null): void { if (f === faseWas) return; faseWas = f; const id = f ? FASI[f] : undefined; if (id) suona(id); }
/** Volumi dalle Impostazioni: livelli 0 (spento) … 3. */
export function setVolumi(m: number, e: number): void { vol = { musica: m, effetti: e }; motore?.volumi(m, e); carica(); }

/** Il codice del motore si scarica appena l'audio è acceso (pochi KB, dopo l'avvio); il contesto WebAudio nasce al primo gesto,
 *  dentro il gestore dell'evento: Safari su iPhone sblocca l'audio solo lì. */
function carica(): void {
  if (FLAGS.nosound || (vol.musica <= 0 && vol.effetti <= 0)) return;
  loading ??= import('./index.ts').then((m) => { modulo = m; if (gesto) crea(); }).catch((e: unknown) => { errore = String(e); loading = null; console.warn('[marea] audio non caricato', e); });
  if (gesto) crea();
}
function crea(): void {
  if (motore || !modulo) return;
  try {
    motore = modulo.createAudio();
    motore.volumi(vol.musica, vol.effetti); motore.musica(forzata); motore.meteo(meteo.t, meteo.k);
    if (mondo) motore.collega(mondo);
  } catch (e) { errore = String(e); console.warn('[marea] audio non partito', e); }
}
const onGesto = () => { gesto = true; motore?.resume(); carica(); };

/** main.ts, una volta: cosa ascoltare nel mondo. Da qui il primo gesto scarica il motore (se l'audio è acceso). */
export function collegaAudio(m: AudioMondo): void {
  mondo = m; motore?.collega(m); carica();
  if (!ascolto && typeof addEventListener === 'function') {
    ascolto = true;
    for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, onGesto, { capture: true, passive: true });
    registraTest();
  }
}

function registraTest(): void {
  registerStateProvider('audio', () => ({ nosound: FLAGS.nosound, gesto, caricato: !!motore, errore, volumi: { ...vol }, ...(motore?.stato() ?? {}) }));
  registerTestHook('suona', (id, k) => { suona(String(id) as SuonoId, k === undefined ? undefined : Number(k)); return !!motore; });
  registerTestHook('musica', (m) => musica.set(String(m) as MusicaModo | 'auto'));
  registerTestHook('audioPronto', () => loading ?? Promise.resolve());
  /** 10 s (o `s`) registrati senza altoparlanti con OfflineAudioContext: picco, RMS e un WAV mono 16 bit in base64 per ascoltarlo. */
  registerTestHook('audioOffline', async (modo, s) => (await import('./index.ts')).registraOffline(String(modo ?? 'giorno') as MusicaModo, Number(s ?? 10)));
}

