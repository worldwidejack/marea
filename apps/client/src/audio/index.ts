// Entrata del chunk audio (caricato da audio/ponte.ts al primo gesto, se Musica o Effetti sono accesi). Crea contesto, bus, musica e
// ambiente, e ascolta il mondo a ogni frame: passi in base alla tile sotto i piedi, salire e scendere dalla barca, remate e scia,
// musica di giorno / notte / gara / dungeon, musica più bassa nei minigiochi. I pannelli (.mz-sheet che prende o perde «on») fanno
// il loro clic di legno da soli, i bottoni dell'interfaccia un tic. Gli altri suoni arrivano dal ponte (suona).
import type { Audio, AudioMondo, Meteo, MusicaModo, SuonoId } from './ponte.ts';
import { BASE, LIVELLI, createMotore } from './motore.ts';
import type { Motore } from './motore.ts';
import { SUONI } from './effetti.ts';
import { createMusica } from './musica.ts';
import type { Musica } from './musica.ts';
import { createAmbiente } from './ambiente.ts';
import type { Ambiente, Scena } from './ambiente.ts';

const ACQUA = new Set([',', '~', 'B']);
/** La tile sotto i piedi → il passo. */
function passoDi(tile: string, lastricato: boolean): SuonoId {
  if (lastricato) return 'passo_pietra';
  if (tile === 'd') return 'passo_legno';
  if (tile === 'r') return 'passo_pietra';
  if (tile === 'g' || tile === 'L') return 'passo_erba';
  if (ACQUA.has(tile)) return 'passo_acqua';
  return 'passo_sabbia';
}
const livello = (n: number) => LIVELLI[Math.max(0, Math.min(3, Math.round(n)))] ?? 0;

export function createAudio(): Audio {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC({ latencyHint: 'interactive' });
  const mt = createMotore(ctx), mu = createMusica(mt), amb = createAmbiente(mt);
  const ultimi: { id: string; t: number }[] = [], quando = new Map<string, number>(), visti = new Set<string>();
  let mondo: AudioMondo | null = null, forzata: MusicaModo | 'auto' = 'auto', vol = { musica: 0, effetti: 0 };
  let raffica = 0, rafficaT = 0, notte = 0, terra = 0.5, terraT = 0, ambT = 0, contati = 0;
  let modoWas: string | null = null, px = NaN, pz = NaN, strada = 0, dx = NaN, dz = NaN, dStrada = 0, remo = 0, lastFrame = 0;
  let lastricati: Set<number> | null = null, osservatore: MutationObserver | null = null, pannelloT = 0;

  const suona = (id: SuonoId, k = 0) => {
    const r = SUONI[id]; if (!r || vol.effetti <= 0 || ctx.state !== 'running') return;
    const now = ctx.currentTime, prima = quando.get(id) ?? -1;
    if (now - prima < 0.035) return; // lo stesso suono due volte nello stesso istante: uno basta
    // niente valanghe: al massimo 14 suoni in 0,2 s
    while (ultimi.length && performance.now() - ultimi[0]!.t > 4000) ultimi.shift();
    if (ultimi.filter((u) => performance.now() - u.t < 200).length >= 14) return;
    quando.set(id, now); ultimi.push({ id, t: performance.now() }); visti.add(id); contati++;
    r(mt, now + 0.005, Math.max(0, Math.min(1, k)));
  };

  // ---- pannelli e bottoni: nessuna riga negli altri file ----
  const guardaPannelli = (root: HTMLElement) => {
    osservatore?.disconnect();
    osservatore = new MutationObserver((recs) => {
      for (const r of recs) {
        const el = r.target as HTMLElement;
        if (!el.classList?.contains('mz-sheet')) continue;
        const prima = ` ${r.oldValue ?? ''} `.includes(' on '), ora = el.classList.contains('on');
        if (prima !== ora) { suona(ora ? 'apri' : 'chiudi'); pannelloT = performance.now(); }
      }
    });
    osservatore.observe(root, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  };
  addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('button');
    if (!b || b.closest('#btnA, #btnB, #joystick')) return;
    setTimeout(() => { if (performance.now() - pannelloT > 80) suona('click'); }, 0); // se il bottone apre un pannello basta il suo suono
  }, true);
  // scheda nascosta: il contesto si ferma (batteria del telefono), e riparte quando torni
  document.addEventListener('visibilitychange', () => { if (document.hidden) void ctx.suspend(); else if (vol.musica > 0 || vol.effetti > 0) void ctx.resume(); });

  const applicaVolumi = () => {
    const t = ctx.currentTime;
    mt.musica.gain.setTargetAtTime(BASE.musica * livello(vol.musica), t, 0.3);
    mt.effetti.gain.setTargetAtTime(BASE.effetti * livello(vol.effetti), t, 0.1);
    if (vol.musica <= 0 && vol.effetti <= 0) void ctx.suspend(); else if (!document.hidden) void ctx.resume();
  };

  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
    if (ctx.state !== 'running') return;
    const t = ctx.currentTime, m = mondo;
    const tpl = !!m?.templari?.(), dng = !!m?.dungeon() && !tpl, w = m?.world;
    const mom = m?.momento() ?? 'giorno', nt = tpl || mom === 'notte' ? 1 : mom === 'tramonto' || mom === 'alba' ? 0.35 : 0; // nelle ondate dei Templari è sempre notte
    notte += (nt - notte) * Math.min(1, dt * 0.5);
    if (performance.now() - rafficaT > 300) raffica = 0; // la Regata la manda a ogni tick: se smette, è finita
    // musica: scelta dal gioco (o forzata), più bassa nei minigiochi a schermo
    const auto: MusicaModo = tpl ? 'templari' : dng ? 'dungeon' : w?.race.on ? 'gara' : mom === 'notte' ? 'notte' : 'giorno';
    mu.set(forzata === 'auto' ? auto : forzata);
    mt.duck.gain.setTargetAtTime(m?.gioco() && !w?.race.on ? 0.3 : 1, t, 0.4);
    if (vol.musica > 0) mu.programma(t + 0.35);
    let inBarca = false, velocita = 0;
    if (tpl) terra = 0.7; // la chiesa sul mare: un po' di onde lontane
    if (w && !dng && !tpl) {
      // salire e scendere dalla barca
      if (modoWas !== null && w.mode !== modoWas) suona(w.mode === 'boat' ? 'barca_su' : 'barca_giu');
      modoWas = w.mode;
      if (w.mode === 'walk') {
        // passi: ogni ~1 m (1,5 m di corsa) mentre l'avatar si muove; un salto (teleport) non conta
        const s = w.avatar.state, d = Number.isNaN(px) ? 0 : Math.hypot(s.x - px, s.z - pz);
        px = s.x; pz = s.z;
        if (d > 3 || w.frozen || s.anim === 'idle') strada = 0;
        else if ((strada += d) >= (s.anim === 'run' ? 1.5 : 1.05)) {
          strada = 0;
          const c = w.map.worldToCell(s.x, s.z);
          if (!lastricati) { lastricati = new Set(); for (const [x0, z0, x1, z1] of w.archipelago.paved) for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) lastricati.add(cz * 100000 + cx); }
          suona(passoDi(w.map.at(c.cx, c.cz), lastricati.has(c.cz * 100000 + c.cx)));
        }
      } else {
        // remate al ritmo dei remi (game/boat.ts: 0,65 + 0,85 × velocità colpi al secondo)
        inBarca = true; velocita = Math.max(0, Math.min(1, w.boat.state.wake));
        px = NaN;
        if (velocita > 0.05) { remo += dt * (0.65 + 0.85 * velocita); if (remo >= 1) { remo -= 1; suona('remata', velocita); } } else remo = 0.7;
      }
      // quanta terra c'è attorno (7×7 celle ogni 2): ogni 0,4 s
      if (now - terraT > 400) {
        terraT = now;
        const f = w.mode === 'walk' ? w.avatar.state : w.boat.state, c = w.map.worldToCell(f.x, f.z);
        let n = 0;
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (!ACQUA.has(w.map.at(c.cx + i * 2, c.cz + j * 2))) n++;
        terra = n / 49;
      }
    }
    // ambiente a 20 Hz
    if (now - ambT > 50) { ambT = now; const sc: Scena = { terra: dng ? 1 : terra, inBarca, velocita, notte, dungeon: dng, raffica }; amb.aggiorna(sc, t); }
  }
  requestAnimationFrame(frame);

  return {
    suona,
    volumi(m, e) { vol = { musica: m, effetti: e }; applicaVolumi(); },
    musica(m) { forzata = m; },
    meteo(tp: Meteo, k: number) { amb.meteo(tp, k); },
    vento(g) { raffica = Math.max(0, Math.min(1, g)); rafficaT = performance.now(); },
    collega(m) { mondo = m; modoWas = null; guardaPannelli(m.root); },
    dungeonPasso(x, z) {
      const d = Number.isNaN(dx) ? 0 : Math.hypot(x - dx, z - dz); dx = x; dz = z;
      if (d > 3) { dStrada = 0; return; }
      if ((dStrada += d) >= 1.1) { dStrada = 0; suona('passo_dungeon'); }
    },
    tensione(k) { mu.tensione(k); },
    dungeonEvento(e) {
      const id: SuonoId | null = e.t === 'colpo' ? (e.su === 'eroe' ? 'colpo_preso' : e.critico ? 'colpo_critico' : 'colpo_dato')
        : e.t === 'schivato' ? 'schivato' : e.t === 'morte' ? 'nemico_ko' : e.t === 'raccolto' ? 'raccolto' : e.t === 'monete' ? 'moneta'
        : e.t === 'pozione' ? 'pozione' : e.t === 'magia' ? 'magia' : e.t === 'altare' || e.t === 'risveglio' ? 'altare'
        : e.t === 'senzaMagicka' || e.t === 'senzaFrecce' || e.t === 'rotto' || e.t === 'pieno' ? 'vuoto' : null;
      if (id) suona(id);
    },
    resume() { if (vol.musica > 0 || vol.effetti > 0) void ctx.resume(); },
    stato: () => ({
      contesto: ctx.state, tempo: Math.round(ctx.currentTime * 10) / 10,
      bus: { musica: mt.musica.gain.value, effetti: mt.effetti.gain.value, duck: mt.duck.gain.value, ambiente: mt.ambiente.gain.value },
      musica: mu.modo, forzata, ultimi: ultimi.slice(-30).map((u) => u.id), visti: [...visti], suonati: contati, ambiente: amb.stato,
      terra: Math.round(terra * 100) / 100, notte: Math.round(notte * 100) / 100,
    }),
  };
}

/** Prova senza altoparlanti: `secs` di gioco (musica, ambiente in costa, una scaletta di effetti) in un OfflineAudioContext.
 *  Restituisce picco, RMS e un WAV mono 16 bit in base64 (per ascoltarlo: tests/out/). */
export async function registraOffline(modo: MusicaModo, secs: number): Promise<{ modo: string; secs: number; picco: number; rms: number; silenzio: number; wav: string }> {
  const sr = 22050, ctx = new OfflineAudioContext(1, Math.floor(sr * secs), sr);
  const mt: Motore = createMotore(ctx);
  mt.musica.gain.value = BASE.musica * (LIVELLI[3] ?? 1); mt.effetti.gain.value = BASE.effetti * (LIVELLI[3] ?? 1);
  const mu: Musica = createMusica(mt), amb: Ambiente = createAmbiente(mt);
  mu.set(modo, 0); mu.programma(secs);
  const tpl = modo === 'templari', notte = modo === 'notte' || tpl ? 1 : 0, dng = modo === 'dungeon', gara = modo === 'gara';
  if (tpl) mu.tensione(0.8);
  for (let t = 0; t < secs; t += 0.05) amb.aggiorna({ terra: dng ? 1 : gara ? 0.1 : 0.4, inBarca: gara, velocita: gara ? 0.8 : 0, notte, dungeon: dng, raffica: gara && t > 4 && t < 6 ? 0.6 : 0 }, t);
  // scaletta: passi, barca, monete in fila, martello, medaglia, pannelli, boa, emote
  const at = (t: number, id: SuonoId, k = 0) => { if (t < secs) SUONI[id](mt, t, k); };
  const passo: SuonoId = dng ? 'passo_dungeon' : notte ? 'passo_erba' : 'passo_sabbia';
  for (let i = 0; i < 8; i++) at(0.3 + i * 0.33, passo);
  at(3, 'barca_su'); for (let i = 0; i < 6; i++) at(4 + i * 0.06, 'moneta', i / 7);
  if (tpl) { // un'ondata in 10 s: lo stacco, i versi, le assi, gli spari, il corno, la risata, la campana, un power-up
    at(0.1, 'tpl_ondata'); at(2.2, 'tpl_sorge'); at(2.6, 'tpl_deus', 0.8); at(3.1, 'tpl_rantolo', 0.6); at(3.6, 'tpl_asse', 0.7); at(4.0, 'tpl_urlo', 0.7);
    at(4.4, 'tpl_fendente'); at(4.5, 'colpo_dato'); at(4.9, 'tpl_pistola'); at(5.4, 'tpl_moschetto'); at(5.9, 'tpl_trombone'); at(6.3, 'tpl_freccia');
    at(6.7, 'tpl_corno', 0.9); at(7.6, 'tpl_risata', 0.9); at(8.4, 'tpl_campana', 0.8); at(9.0, 'tpl_potere_preso', 0.3); at(9.5, 'tpl_porta');
  } else { at(5, 'martello'); at(6, 'medaglia_oro'); at(7.2, 'apri'); at(7.6, 'click'); at(8, 'chiudi'); at(8.4, 'boa'); at(9, 'emote'); at(9.4, dng ? 'colpo_critico' : 'notifica'); }
  if (gara) for (let i = 0; i < 12; i++) at(0.2 + i * 0.7, 'remata', 0.8);
  const buf = await ctx.startRendering(), d = buf.getChannelData(0);
  let picco = 0, sq = 0, zitti = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]!); if (v > picco) picco = v; sq += v * v; if (v < 1e-4) zitti++; }
  // WAV 16 bit
  const out = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i]!)) * 32767, true);
  const bytes = new Uint8Array(out.buffer);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { modo, secs, picco, rms: Math.sqrt(sq / d.length), silenzio: zitti / d.length, wav: btoa(bin) };
}
