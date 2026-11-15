// Sala e ciclo della partita dell’Arena (docs/ARENA.md).
import { createRng } from '@marea/sim';
import type { InputFrame, LotState } from '@marea/sim';
import type { Look } from '@marea/protocol';
import { ARENA, arenaModo, eroiDi } from '@marea/content/arena.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import { formatoDi } from '@marea/sim/arena/partita.ts';
import { botBuildCasuale } from '@marea/sim/rpg/arena_bot.ts';
import { buildArenaEroe, buildsDi, erroreBuild, erroreBuilds } from '@marea/sim/rpg/arena.ts';
import { newHero } from '@marea/sim/rpg/hero.ts';
import type { ArenaBuild, ArenaBuilds, HeroState } from '@marea/sim/rpg/types.ts';
import { parseArServer } from '@marea/protocol/arena.ts';
import type { ArClientMsg, ArMembroSala, ArServerMsg, ArTurno } from '@marea/protocol/arena.ts';
import type { Api } from '../net/api.ts';
import { ApiError } from '../net/api.ts';
import { el, injectUiStyle } from '../ui/style.ts';
import { FLAGS } from '../flags.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { RunCtx } from './types.ts';
import { editorBuild, schedeBuild } from './arena_build_ui.ts';
import type { SceltaBuild } from './arena_build_ui.ts';
import { arenaLink, startArenaRun } from './arena_run.ts';
import type { ArenaDuellante, ArenaRete, ArenaRun } from './arena_run.ts';
import { CSS_COLOSSEO } from './arena_menu_css.ts';
import { CSS_SALA } from './arena_lobby_css.ts';
import { arenaButton, opzioniArena, squadreArena } from './arena_lobby_ui.ts';
import { avvisoRuota } from '../corse/avviso_ruota.ts';
import { pixIcon } from '../ui/icons.ts';
import { ritrattoAvatar } from '../ui/ritratto_avatar.ts';

export type ColosseoCtx = RunCtx & { api: Api | null; getLot(): LotState | null; setLot(l: LotState): void; nome(): string; look(): Look; tornaAllIngresso(): void };
export type Colosseo = {
  apri(): void;
  readonly aperto: boolean;
  /** Partita in corso (il ciclo chiama step e update al posto del mondo). */
  readonly active: boolean;
  step(f: InputFrame): void;
  update(alpha: number, dt: number, t: number): void;
  /** Stanza di prova (?arena=banco): subito nell'allenamento coi gladiatori. */
  allenamento(): void;
};

/** Come si chiama sul bottone una grandezza di squadra della modalità. */
export function createColosseo(c: ColosseoCtx): Colosseo {
  injectUiStyle();
  if (!document.getElementById('mz-colosseo-style')) { const st = document.createElement('style'); st.id = 'mz-colosseo-style'; st.textContent = CSS_COLOSSEO + CSS_SALA; document.head.appendChild(st); }
  const online = () => !!c.api && FLAGS.net && !!FLAGS.token;
  // il personaggio di adesso (senza lotto, la stanza di prova: uno nuovo, tenuto qui)
  let eroeProva: HeroState | null = null;
  const eroe = (): HeroState => c.getLot()?.hero ?? (eroeProva ??= newHero());
  let builds: ArenaBuilds = buildsDi(eroe()), salvato = JSON.stringify(builds), scelta: SceltaBuild | null = null;
  // allenamento a squadre: le build dei gladiatori (null = casuale a ogni partita) e quello che si sta vestendo adesso (null = io)
  const bots: (ArenaBuild | null)[] = [];
  let bot: number | null = null;
  /** La build che il pannello sta modificando: la mia scelta, o quella del gladiatore aperto (l'editor è lo stesso). */
  const corr = (): ArenaBuild => (bot === null ? builds.build[builds.scelta]! : bots[bot]!);
  const nomeBot = (k: number): string => ARENA.gladiatori[k % ARENA.gladiatori.length]!.nome;

  // ---- pannello ----
  const box = el('div', 'mz mz-col mz-ar-lobby'); box.id = 'mzColosseo';
  const chiudiBtn = el('button', 'mz-x', '×'); chiudiBtn.type = 'button'; chiudiBtn.setAttribute('aria-label', 'Esci dall’Arena');
  const testa = el('header', 'testa');
  const identita = el('div', 'arena-identita'); identita.append(pixIcon('arena', 36), el('h2', '', 'Arena'));
  testa.append(identita, chiudiBtn);
  const palco = el('section', 'arena-palco');
  const figura = el('img', 'arena-figura'); figura.alt = '';
  const targhetta = el('b', 'arena-nome');
  palco.append(figura, targhetta);
  const lato = el('aside', 'arena-lato'), nav = el('nav', 'arena-nav');
  const corpo = el('div', 'corpo'), gioca = el('footer', 'gioca');
  lato.append(nav, corpo);
  box.append(testa, palco, lato, gioca);
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) box.addEventListener(ev, (x) => x.stopPropagation(), { passive: true });
  c.root.append(box);
  const ruota = avvisoRuota(c.root, false, 'Gira il telefono in orizzontale per entrare nella sala dell’Arena.');
  const err = el('div', 'err'); err.setAttribute('role', 'status');
  let aperto = false, inAttesa = false, conferma = false, ciclo = 0, codice = '', ingresso = false, senzaCompagno = false;
  let pagina: 'lobby' | 'partita' | 'build' = 'lobby';
  function vai(p: typeof pagina): void { pagina = p; conferma = false; err.textContent = ''; disegna(); corpo.scrollTop = 0; }
  function invia(m: ArClientMsg): void {
    if (inAttesa && m.t !== 'via') return;
    if (sess?.ws.readyState === WebSocket.OPEN) sess.ws.send(JSON.stringify(m));
  }
  function formato(m: ArenaModo, f: number, mappa: string): void {
    if (inAttesa) return;
    conferma = false;
    if (sess) { invia({ t: 'formato', m, f, mappa }); return; }
    if (modo !== m || per !== f) { bots.length = 0; senzaCompagno = false; }
    modo = m; per = f; mappaScelta = mappa; disegna();
  }

  /** In testa al pannello di un gladiatore: chi è, e i modi di tornare indietro (alla mia build, o alla build casuale). */
  function testaBot(k: number): Node[] {
    const vai = (testo: string, fn: () => void) => { const b = el('button', 'cella', testo) as HTMLButtonElement; b.type = 'button'; b.dataset['act'] = testo.startsWith('‹') ? 'mio' : 'casuale'; b.addEventListener('click', () => { fn(); bot = null; scelta = null; err.textContent = ''; disegna(); }); return b; };
    const riga = el('div', 'riga d');
    riga.append(vai('‹ LA TUA BUILD', () => {}), vai('BUILD CASUALE', () => { bots[k] = null; }));
    return [el('h4', '', `GLADIATORE: ${nomeBot(k).toUpperCase()}`), riga];
  }
  /** I gladiatori dell'allenamento (compagni, poi avversari): casuali di default, un tocco per sceglier loro la build. */
  function sezBot(): Node[] {
    const riga = el('div', 'riga d'), n = eroiDi(arenaModo(modo), per) - Number(senzaCompagno);
    for (let k = 0; k < n - 1; k++) {
      const b = el('button', 'cella') as HTMLButtonElement; b.type = 'button'; b.dataset['bot'] = String(k);
      b.append(el('span', '', nomeBot(k)), el('small', '', `${k < per - 1 && !senzaCompagno ? 'compagno' : 'avversario'} · ${bots[k] ? 'a scelta' : 'casuale'}`));
      b.addEventListener('click', () => { bots[k] ??= botBuildCasuale(createRng((Date.now() >>> 0) % 1_000_000).fork('bot' + k), per > 1); bot = k; scelta = null; err.textContent = ''; disegna(); });
      riga.append(b);
    }
    return [el('h4', '', 'GLADIATORI DELL’ALLENAMENTO'), el('div', 'stat', 'Solo per ALLENAMENTO: build casuale a ogni partita. Tocca un gladiatore per scegliergli la build.'), riga];
  }
  /** La build cambiata (la mia scelta, o quella del gladiatore aperto). */
  function metti(b: ArenaBuild): void {
    if (bot === null) builds = { build: builds.build.map((x, n) => (n === builds.scelta ? b : x)), scelta: builds.scelta };
    else bots[bot] = b;
    err.textContent = '';
    disegna();
  }

  function disegna(): void {
    const s = sess, ospita = !s || s.host, attuale = s?.m ?? modo, f = s?.f ?? per;
    nav.replaceChildren(...(['lobby', 'partita', 'build'] as const).map((p) => {
      const b = arenaButton(p, { lobby: 'Lobby', partita: 'Partita', build: 'Build' }[p], () => vai(p));
      b.setAttribute('aria-pressed', String(pagina === p)); return b;
    }));
    if (pagina === 'lobby') {
      const titolo = el('h3', '', s ? s.codice ? 'Lobby con amici' : 'Connessione…' : 'Gioco in solitaria');
      const kids: Node[] = [titolo];
      if (s?.codice) {
        kids.push(el('div', 'arena-codice', s.codice), el('p', '', 'Condividi il codice con chi vuoi invitare.'));
        const roster = el('ul', 'arena-roster');
        for (const [i, m] of s.membri.entries()) roster.append(el('li', '', i === 0 ? m.nome + ' · Host' : m.nome));
        kids.push(roster, arenaButton('annulla', 'Lascia la lobby', esci));
      } else if (!s) {
        const azioni = el('div', 'due');
        azioni.append(arenaButton('sala', 'Crea lobby', () => { ingresso = false; void entra('sala'); }, !online() || inAttesa),
          arenaButton('mostra-codice', 'Entra con codice', () => { ingresso = !ingresso; disegna(); if (ingresso) corpo.querySelector('input')?.focus(); }, !online() || inAttesa));
        kids.push(azioni);
        if (!online()) kids.push(el('p', '', 'Accedi con il tuo link personale per giocare con gli amici.'));
        if (ingresso && online()) {
          const form = el('form', 'codiceIn');
          const input = el('input');
          input.maxLength = ARENA.rete.codice; input.placeholder = 'Codice lobby'; input.autocomplete = 'off';
          input.setAttribute('aria-label', 'Codice lobby'); input.autocapitalize = 'characters'; input.spellcheck = false; input.value = codice;
          input.addEventListener('input', () => { codice = input.value; });
          input.addEventListener('keydown', (e) => e.stopPropagation());
          const entraBtn = arenaButton('codice', 'Entra', () => {}, inAttesa); entraBtn.type = 'submit';
          form.addEventListener('submit', (e) => { e.preventDefault(); void entra('sala', codice); });
          form.append(input, entraBtn); kids.push(form);
        }
      } else kids.push(arenaButton('annulla', 'Annulla', esci));
      const record = c.getLot()?.arena;
      if (record) {
        const oggi = record.giorno === Math.floor(Date.now() / 86_400_000) ? record.preso : 0;
        kids.push(el('p', '', `Vinte ${record.vinte} · Perse ${record.perse} · Pari ${record.pari} · Monete oggi ${oggi}/${ARENA.premio.tetto}`));
      }
      corpo.replaceChildren(...kids);
    } else if (pagina === 'partita') {
      const kids = opzioniArena({ modo: attuale, per: f, mappa: s?.mappa ?? mappaScelta, n: s?.dentro || 1, ospita, scegli: formato });
      if (s?.membri.length) kids.push(...squadreArena({ membri: s.membri, modo: attuale, per: f, soli: s.soli, ospita, invia }));
      if (!s && modo === 'sopravvivenza' && per === 2) {
        const b = arenaButton('solo', senzaCompagno ? 'Compagno bot: no' : 'Compagno bot: sì', () => { senzaCompagno = !senzaCompagno; bots.length = 0; disegna(); });
        b.setAttribute('aria-pressed', String(senzaCompagno)); kids.push(b);
      }
      corpo.replaceChildren(...kids);
    } else {
      const kids: Node[] = bot !== null ? testaBot(bot) : [
        el('h3', '', 'Le tue build'),
        schedeBuild(builds, (n) => { builds = { ...builds, scelta: n }; scelta = null; disegna(); }, () => { builds = { build: [...builds.build, corr()], scelta: builds.build.length }; scelta = null; disegna(); }),
      ];
      kids.push(...editorBuild({ build: corr(), scelta, squadre: f > 1, apri: (sc) => { scelta = sc; disegna(); }, metti }));
      if (bot === null && online()) kids.push(arenaButton('salva-build', 'Salva build', () => void salvaBuild(), inAttesa || JSON.stringify(builds) === salvato));
      if (!s && bot === null) kids.push(...sezBot());
      corpo.replaceChildren(...kids);
    }
    disegnaGioca();
  }

  type Sessione = { ws: WebSocket; modo: 'coda' | 'sala'; codice: string; rete: (ArenaRete & { turni: ArTurno[]; ricevuti: number; attesaV: { chi: number; fino: number } | null; fineV: ArenaRete['fine']; chiusaV: boolean }) | null; run: string; idx: number; voluta: boolean; m: ArenaModo; f: number; dentro: number; serve: number; host: boolean; membri: ArMembroSala[]; soli: number[]; mappa: string };
  let sess: Sessione | null = null, run: ArenaRun | null = null, ultimo: unknown = null;
  let modo: ArenaModo = 'stelle', per = 3, mappaScelta = '';
  function disegnaGioca(): void {
    const s = sess, m = arenaModo(s?.m ?? modo);
    const card = arenaButton('partita-rapida', m.nome, () => vai('partita'));
    card.prepend(pixIcon('arena', 24));
    const pronto = !s || (s.host && s.serve >= s.dentro && !s.membri.some((x) => x.q < 0));
    const vuoti = s ? Math.max(0, s.serve - s.dentro) : eroiDi(m, per) - 1 - Number(senzaCompagno);
    const attesa = s && !pronto ? (s.host ? 'Scegli un formato con un posto per tutti' : 'L’host avvia la partita') : '';
    const kids: Node[] = [card, err];
    if (conferma && pronto) {
      const fill = el('div', 'arena-fill');
      fill.append(arenaButton('indietro', '‹', () => { conferma = false; disegnaGioca(); }),
        arenaButton(s ? 'via' : 'allenamento', vuoti ? 'Riempi con i bot' : 'Avvia partita', () => void avvia(), inAttesa),
        arenaButton('players', 'Riempi con players · Presto', () => {}, true));
      fill.firstElementChild?.setAttribute('aria-label', 'Torna alla lobby'); kids.push(fill);
    } else if (attesa) kids.push(el('span', 'arena-attesa', attesa));
    else kids.push(arenaButton('avvia', 'Avvia', () => { conferma = true; err.textContent = ''; disegnaGioca(); gioca.querySelector<HTMLElement>('[data-act=via], [data-act=allenamento]')?.focus(); }, inAttesa));
    gioca.replaceChildren(...kids);
  }

  /** Le build vanno bene e sono salvate (online: sul server, col personaggio). null = sì, altrimenti il motivo. */
  async function salva(): Promise<string | null> {
    const why = erroreBuilds(builds);
    if (why) return `Build ${builds.scelta + 1}: ${why}`;
    if (JSON.stringify(builds) === salvato) return null;
    if (!online()) { eroeProva = { ...eroe(), arena: builds }; salvato = JSON.stringify(builds); return null; }
    const inviate = builds;
    try { c.setLot(await c.api!.rpg({ t: 'arena', builds: inviate })); salvato = JSON.stringify(inviate); return null; } catch (e) { return e instanceof ApiError ? e.message : 'Build non salvata: riprova'; }
  }

  async function salvaBuild(): Promise<void> {
    if (inAttesa) return;
    const visita = ciclo;
    inAttesa = true; disegna();
    const why = await salva();
    if (visita !== ciclo) return;
    inAttesa = false; err.textContent = why ?? 'Build salvata'; disegna();
  }

  function socketArena(dati: Record<string, string>): WebSocket {
    const u = new URL('/ws/arena', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.searchParams.set('t', FLAGS.token);
    for (const [k, v] of Object.entries(dati)) u.searchParams.set(k, v);
    return new WebSocket(u);
  }

  async function entra(come: 'coda' | 'sala', codice = ''): Promise<void> {
    if (sess || run || !online() || inAttesa) return;
    const k = codice.trim().toUpperCase();
    if ((ingresso || codice) && k.length !== ARENA.rete.codice) { err.textContent = `Il codice ha ${ARENA.rete.codice} lettere`; return; }
    const tentativo = ciclo;
    inAttesa = true; disegna();
    const why = await salva();
    if (tentativo !== ciclo) return;
    inAttesa = false;
    if (why) { err.textContent = why; disegna(); return; }
    const dati = { modo: come, m: modo, f: String(per), ...(k ? { codice: k } : mappaScelta ? { mappa: mappaScelta } : {}) };
    let ws: WebSocket;
    try { ws = socketArena(dati); } catch { err.textContent = 'Arena non disponibile, riprova'; disegna(); return; }
    const s: Sessione = { ws, modo: come, codice: '', rete: null, run: '', idx: 0, voluta: false, m: modo, f: per, dentro: 0, serve: 0, host: false, membri: [], soli: [], mappa: '' };
    sess = s; conferma = false; ingresso = false; disegna();
    collega(s, ws);
  }
  /** I messaggi del server su questa socket (anche quella di una ripresa dopo una linea persa). */
  function collega(s: Sessione, ws: WebSocket): void {
    ws.onmessage = (ev) => {
      const m = parseArServer(String(ev.data));
      if (m) onMsg(s, m);
    };
    ws.onclose = () => {
      if (sess !== s) return;
      if (!s.rete) { if (!s.voluta) c.hud.toast('Connessione all’Arena chiusa', 2000); sess = null; inAttesa = false; conferma = false; disegna(); return; }
      if (s.rete.fineV || s.voluta) { s.rete.chiusaV = true; return; }
      riprova(s, Date.now() + ARENA.rete.staccatoSecondi * 1000);
    };
  }
  /** Linea persa in partita: ci si ricollega col numero del prossimo turno che si aspetta, finché c'è tempo. */
  function riprova(s: Sessione, fino: number): void {
    if (sess !== s || !s.rete || s.rete.fineV) return;
    if (Date.now() > fino) { s.rete.chiusaV = true; return; }
    c.hud.toast('Linea persa: mi ricollego…', 1500);
    window.setTimeout(() => {
      if (sess !== s || !s.rete) return;
      let ws: WebSocket;
      try { ws = socketArena({ run: s.run, idx: String(s.idx), n: String(s.rete.ricevuti) }); } catch { riprova(s, fino); return; }
      s.ws = ws; collega(s, ws);
      ws.onclose = () => { if (sess === s && s.ws === ws && s.rete && !s.rete.fineV && !s.voluta) riprova(s, fino); };
    }, 1200);
  }
  function onMsg(s: Sessione, m: ArServerMsg): void {
    if (sess !== s) return;
    if (m.t === 'T') { if (s.rete && m.n === s.rete.ricevuti) { s.rete.turni.push(m); s.rete.ricevuti++; } return; }
    if (m.t === 'attendi') { s.codice = m.codice; s.m = m.m; s.f = m.f; s.dentro = m.dentro; s.serve = m.serve; s.host = !!m.host; s.membri = m.membri ?? []; s.soli = m.soli ?? []; s.mappa = m.mappa ?? ''; disegna(); return; }
    if (m.t === 'errore') { c.hud.toast(m.msg, 3000); err.textContent = m.msg; inAttesa = false; disegnaGioca(); return; }
    if (m.t === 'attesa') { if (s.rete) s.rete.attesaV = m.chi < 0 ? null : { chi: m.chi, fino: Date.now() + m.ms }; return; }
    if (m.t === 'ripresa') { c.hud.toast('Di nuovo in linea', 1200); return; }
    if (m.t === 'fine') { if (s.rete) s.rete.fineV = { esito: m.esito, premio: m.premio, tetto: m.tetto }; ultimo = { esito: m.esito, premio: m.premio }; return; }
    if (m.t === 'parte') {
      const io = m.io, eroi = m.eroi.map((e): ArenaDuellante => ({ nome: e.nome, look: e.look, eroe: e.eroe }));
      const ws = () => s.ws;
      const rete = {
        turni: [] as ArTurno[], ricevuti: 0, attesaV: null as { chi: number; fino: number } | null, fineV: null as ArenaRete['fine'], chiusaV: false,
        manda: (x: ArClientMsg) => { const w = ws(); if (w.readyState === WebSocket.OPEN) w.send(JSON.stringify(x)); if (x.t === 'esco') s.voluta = true; },
        get chiusa() { return this.chiusaV; }, get attesa() { return this.attesaV; }, get fine() { return this.fineV; },
      };
      s.rete = rete; s.run = m.run; s.idx = io;
      chiudiPannello();
      gioca2(m.seed, eroi, io, rete, { modo: m.m, per: m.f, mappa: m.mappa, ...(m.soli ? { soli: m.soli } : {}) });
    }
  }
  function esci(): void {
    const s = sess;
    if (!s) return;
    s.voluta = true; sess = null; inAttesa = false; conferma = false; ciclo++;
    try { if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ t: 'esco' } satisfies ArClientMsg)); s.ws.close(1000, 'ciao'); } catch { /* chiusa */ }
    disegna();
  }

  async function avvia(): Promise<void> {
    if (!sess) { await allena(); return; }
    const s = sess;
    if (!s.host || inAttesa || s.rete) return;
    inAttesa = true; disegnaGioca();
    const why = await salva();
    if (sess !== s) return;
    if (why) { inAttesa = false; err.textContent = why; disegnaGioca(); return; }
    invia({ t: 'via', riempi: 'bot' });
  }

  /** Allenamento: tu (più i compagni) contro i gladiatori automatici, ognuno con la sua build (a scelta, o a caso a ogni partita). */
  async function allena(): Promise<void> {
    if (sess || run || inAttesa) return;
    const tentativo = ciclo;
    inAttesa = true; disegnaGioca();
    const why = await salva();
    if (tentativo !== ciclo) return;
    inAttesa = false;
    if (why) { err.textContent = why; disegnaGioca(); return; }
    const mio = buildArenaEroe(builds.build[builds.scelta]!), seed = (Date.now() >>> 0) % 1_000_000;
    const fo = { ...formatoDi(modo, per, seed, mappaScelta || undefined), ...(senzaCompagno ? { soli: [0] } : {}) };
    const n = eroiDi(arenaModo(fo.modo), fo.per) - Number(senzaCompagno);
    chiudiPannello();
    // io primo della mia squadra; poi i compagni e gli avversari, a rotazione dai gladiatori
    const glad = (k: number): ArenaDuellante => ({ nome: nomeBot(k), look: ARENA.gladiatori[k % ARENA.gladiatori.length]!.look, eroe: buildArenaEroe(bots[k] ?? botBuildCasuale(createRng(seed).fork('bot' + k), fo.per > 1)) });
    gioca2(seed, [{ nome: c.nome() || 'Tu', look: c.look(), eroe: mio }, ...Array.from({ length: n - 1 }, (_, k) => glad(k))], 0, null, fo);
  }

  function gioca2(seed: number, eroi: ArenaDuellante[], io: number, rete: ArenaRete | null, fo: { modo: ArenaModo; per: number; mappa: string; soli?: readonly number[] }): void {
    run = startArenaRun(c, { seed, eroi, io, ...fo, ...(rete ? { rete } : {}) });
    const r = run;
    void r.done.then(async (fine) => {
      run = null;
      const s = sess;
      if (s?.rete) { s.voluta = true; sess = null; try { s.ws.close(1000, 'fine'); } catch { /* chiusa */ } }
      c.tornaAllIngresso();
      if (rete && c.api) { try { const l = await c.api.lot(); c.setLot(l); } catch { /* il premio si vede alla prossima lettura */ } }
      else if (!rete && fine.esito && c.api && c.getLot()?.storia) {
        try { const l = await c.api.storia('arena'); c.setLot(l); } catch { /* la rete: pazienza */ }
      }
      if (fine.rivincita) { void allena(); return; }
      apri();
    });
  }
  function chiudiPannello(): void { aperto = false; scelta = null; bot = null; inAttesa = false; ciclo++; ruota.attiva(false); box.classList.remove('on'); }
  function apri(): void {
    if (run) return;
    builds = buildsDi(eroe()); salvato = JSON.stringify(builds); err.textContent = ''; bot = null;
    aperto = true; box.classList.add('on'); vai('lobby'); ruota.attiva(true);
    targhetta.textContent = c.nome() || 'Tu';
    figura.removeAttribute('src');
    const visita = ciclo;
    void ritrattoAvatar(c.look(), c.loader, c.renderer.gl, true).then((url) => { if (url && visita === ciclo) figura.src = url; });
  }
  chiudiBtn.addEventListener('click', () => { esci(); chiudiPannello(); });
  addEventListener('keydown', (e) => { if (aperto && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); esci(); chiudiPannello(); } }, true);

  registerStateProvider('colosseo', () => ({ aperto, attivo: !!run, modo, per, bot, bots, builds, build: corr(), salvato: JSON.parse(salvato) as unknown, coda: sess ? { modo: sess.modo, codice: sess.codice, partita: !!sess.rete, run: sess.run, io: sess.idx, turni: sess.rete?.ricevuti ?? 0, m: sess.m, f: sess.f, dentro: sess.dentro, serve: sess.serve, host: sess.host } : null, ultimo, errore: err.textContent }));
  registerTestHook('arenaSet', (b) => { const x = b as ArenaBuild; builds = { build: builds.build.map((y, n) => (n === builds.scelta ? x : y)), scelta: builds.scelta }; disegna(); return erroreBuild(x); });
  // test: gioca `come` (coda, sala, allenamento) la modalità m con f per squadra (senza: quelle di adesso)
  registerTestHook('arenaGioca', (come, codice, m, f) => {
    if (typeof m === 'string' && ARENA.modi.lista.some((x) => x.id === m)) { senzaCompagno = false; modo = m as ArenaModo; per = arenaModo(modo).per.includes(Number(f)) ? Number(f) : arenaModo(modo).per[0]!; }
    if (come === 'allenamento') void allena(); else void entra(come === 'sala' ? 'sala' : 'coda', typeof codice === 'string' ? codice : '');
    return true;
  });
  registerTestHook('arenaBot', (k, b) => { const n = Number(k); bots[n] = (b as ArenaBuild | null) ?? null; disegna(); return true; });
  registerTestHook('arenaVia', () => { const s = sess; if (!s || s.rete || s.ws.readyState !== WebSocket.OPEN) return false; s.ws.send(JSON.stringify({ t: 'via' } satisfies ArClientMsg)); return true; });
  registerTestHook('arenaEsci', () => { esci(); chiudiPannello(); return true; });
  registerTestHook('arenaAuto', (on) => { arenaLink.auto = !!on; return arenaLink.auto; });
  registerTestHook('arenaLinea', () => { const s = sess; if (!s?.rete) return false; try { s.ws.close(4000, 'prova'); } catch { /* */ } return true; });

  return {
    apri,
    get aperto() { return aperto; },
    get active() { return !!run && run.active; },
    step(f) { run?.step(f); },
    update(alpha, dt, t) { run?.update(alpha, dt, t); },
    allenamento() { void allena(); },
  };
}
