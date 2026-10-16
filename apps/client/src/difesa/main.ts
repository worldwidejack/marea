// Banco di prova della Difesa a corsie alla Plants vs Zombies (#358): provadifesa.html, pagina a parte, il gioco non cambia (docs/DIFESA.md).
// Sim pura in @marea/sim/difesa (60 Hz fissi); qui la resa su canvas 2D (disegna.ts) con la grafica della pelle scelta (skin.ts), gli
// effetti, i suoni e l'interfaccia in HTML (ui.ts). Si tocca la carta e poi la casella (o si trascina la carta sulla casella); si toccano le
// monete per raccoglierle. PC: 1-6 carte, E pala, Spazio pausa, F veloce, T pilota automatico, M muto, R ricomincia, Esc annulla.
// Indirizzo: ?livello=1..6|s&stile=<pelle>&profilo=pvz|marea&auto=bravo|medio|distratto&veloce=2&seme=N&raccolta=1&prova=1
// (prova = parte subito senza menù né tutorial a schermo: per i test). Telefono in orizzontale; in verticale «GIRA IL TELEFONO».
// Test: window.__difesa = { ready, state(), set({...}), avanti(n), premi(cmd), perf(), partita(), rendi(), casella(col, corsia), moneta(id) }.
import type { DProfiloId, DTipoUnita } from '@marea/content/difesa.ts';
import { DIFESA, profiloDifesa } from '@marea/content/difesa.ts';
import { TICK_HZ } from '@marea/sim/constants.ts';
import { nuovaPartita, passo } from '@marea/sim/difesa/difesa.ts';
import type { DComando, DEvento, DState } from '@marea/sim/difesa/stato.ts';
import { livelloDef, totOndate } from '@marea/sim/difesa/stato.ts';
import { eBandiera } from '@marea/sim/difesa/ondate.ts';
import type { DBot, DBravura } from '@marea/sim/difesa/bot.ts';
import { autopilota, creaBot } from '@marea/sim/difesa/bot.ts';
import type { ChiaveSprite, Pelle } from './skin.ts';
import { PELLI, caricaPelle } from './skin.ts';
import type { Inquadratura } from './tavolo.ts';
import { aSchermo, casella, daFondale, daSchermo, inquadra, suFondale } from './tavolo.ts';
import type { Fantasma } from './disegna.ts';
import { creaResa } from './disegna.ts';
import { creaEffetti } from './effetti.ts';
import { creaUi } from './ui.ts';
import { creaSuoni } from './suoni.ts';

type Salvato = { sbloccati?: number; medaglie?: Record<string, 'oro' | 'argento' | 'bronzo'>; record?: number; stile?: string; profilo?: DProfiloId; raccolta?: boolean; muto?: boolean; tutto?: boolean };
const q = new URLSearchParams(location.search);
const leggi = (): Salvato => { try { return JSON.parse(localStorage.getItem('marea.difesa') ?? '{}') as Salvato; } catch { return {}; } };
const mem: Salvato = leggi();
const salva = () => { try { localStorage.setItem('marea.difesa', JSON.stringify(mem)); } catch { /* niente memoria: pazienza */ } };

const prova = q.get('prova') === '1';
let profilo: DProfiloId = (q.get('profilo') as DProfiloId) || mem.profilo || 'marea';
if (profilo !== 'pvz' && profilo !== 'marea') profilo = 'marea';
let stile = q.get('stile') || mem.stile || PELLI[PELLI.length - 1]!.id;
let raccoltaAuto = q.has('raccolta') ? q.get('raccolta') === '1' : !!mem.raccolta;
let auto: DBravura | null = (['bravo', 'medio', 'distratto'] as DBravura[]).find((b) => b === q.get('auto')) ?? (q.get('auto') === '1' ? 'bravo' : null);
let veloce = Number(q.get('veloce')) || 1, pausa = false, muto = !!mem.muto;

const tela = document.getElementById('tela') as HTMLCanvasElement, root = document.getElementById('ui') as HTMLElement;
const resa = creaResa(tela), fx = creaEffetti(), ui = creaUi(root), suoni = creaSuoni();
suoni.muto(muto);
let pelle: Pelle | null = null, Q: Inquadratura = { scala: 1, ox: 0, oy: 0, W: 1, H: 1 };
let s: DState = nuovaPartita(1, 0, { profilo });
let inGioco = false, finita = false, bot: DBot | null = null, coda: DComando[] = [], scelta: DTipoUnita | 'pala' | null = null, fantasma: Fantasma = null;
let tutorialPasso = 0, scossa = 0, ready = false;

// ---------- misure ----------
const telefono = () => matchMedia('(pointer: coarse)').matches;
function misura(): void {
  const W = innerWidth, H = innerHeight;
  if (pelle) {
    resa.dimensiona(W, H, pelle.pixel);
    const sopra = (ui.barra.getBoundingClientRect().bottom || 70) + 4, sotto = H < 460 ? 30 : 40;
    Q = inquadra(pelle, W, H, sopra, sotto);
  }
  ui.gira(telefono() && H > W);
}
addEventListener('resize', misura); window.visualViewport?.addEventListener('resize', misura);

// ---------- partita ----------
const nomeDi = (t: string) => pelle?.nomi[t as DTipoUnita] ?? t;
const CONSIGLI: Partial<Record<DTipoUnita, string>> = {
  produttore: 'fa monete: piantane tanti, subito!',
  bomba: 'scoppia e spazza tutto attorno!',
  muro: 'regge a lungo: mettilo davanti',
  mina: 'si arma piano: mettila lontano',
  gelo: 'rallenta i nemici che colpisce',
};
function avvia(livello: number): void {
  const seme = Number(q.get('seme')) || 1 + Math.floor(Math.random() * 99999);
  s = nuovaPartita(seme, livello, { profilo, raccoltaAuto });
  if (prova) s.attesa = false;
  inGioco = true; finita = false; scelta = null; fantasma = null; coda = []; tutorialPasso = 0;
  bot = auto ? creaBot(auto, seme) : null;
  const def = livelloDef(s), P = profiloDifesa(profilo);
  ui.chiudiVelo();
  ui.carte(s.carte.map((c) => c.tipo), Object.fromEntries(s.carte.map((c) => [c.tipo, P.unita[c.tipo].costo])), def && livello > 0 ? def.nuova : null, sceglie, () => sceglie('pala'));
  misura();
  ui.consiglio(null); ui.mano(null);
  if (!prova) {
    if (def?.tutorial) ui.consiglio('Tocca la carta, poi tocca il prato', 0);
    else if (def && CONSIGLI[def.nuova]) ui.consiglio(`${nomeDi(def.nuova)}: ${CONSIGLI[def.nuova]}`, 7);
    else if (!def) ui.consiglio('Resisti più ondate che puoi!', 5);
  }
}
function sceglie(t: DTipoUnita | 'pala'): void {
  if (!inGioco || finita) return;
  if (scelta === t) { scelta = null; return; }
  if (t !== 'pala') {
    const c = s.carte.find((k) => k.tipo === t)!, costo = profiloDifesa(profilo).unita[t].costo;
    if (c.pronta > s.tick || s.valuta < costo) { suoni.no(); return; }
  }
  scelta = t;
}
function menuLivelli(): void {
  inGioco = false;
  const sbl = mem.tutto ? 99 : mem.sbloccati ?? 0;
  ui.menu('DIFESA', 'Banco di prova · scegli il livello', DIFESA.livelli.map((l, i) => ({ nome: l.nome, numero: String(l.id), aperto: i <= sbl, medaglia: mem.medaglie?.[l.id] ?? '', nuova: l.nuova })),
    `SOPRAVVIVENZA${mem.record ? ` · record ${mem.record}` : ''}`, (i) => avvia(i));
}
function medaglia(): 'oro' | 'argento' | 'bronzo' {
  const persi = s.corsie.filter((r) => s.tosa[r]!.stato !== 0).length;
  return persi === 0 ? 'oro' : persi <= 1 && s.corsie.length > 1 ? 'argento' : 'bronzo';
}
function fine(vinta: boolean): void {
  finita = true; scelta = null;
  const def = livelloDef(s), lv = s.livello, minuti = Math.floor(s.tick / TICK_HZ / 60), sec = Math.floor((s.tick / TICK_HZ) % 60);
  const tempo = `${minuti}:${String(sec).padStart(2, '0')}`;
  setTimeout(() => {
    if (lv < 0) {
      const record = Math.max(mem.record ?? 0, s.ondata);
      const nuovo = s.ondata > (mem.record ?? 0);
      mem.record = record; salva();
      ui.fine({ vinta: false, titolo: 'HANNO SFONDATO!', righe: [`Sei arrivato all'ondata ${s.ondata} in ${tempo}.`, nuovo ? 'NUOVO RECORD!' : `Record: ${record} ondate.`], avanti: false }, () => avvia(-1), () => {}, menuLivelli);
      return;
    }
    if (vinta) {
      const m = medaglia(), prima = mem.medaglie?.[def!.id];
      mem.medaglie = { ...mem.medaglie, [def!.id]: prima === 'oro' || (prima === 'argento' && m === 'bronzo') ? prima : m };
      mem.sbloccati = Math.max(mem.sbloccati ?? 0, lv + 1); salva();
      const prossimo = DIFESA.livelli[lv + 1];
      ui.fine({ vinta: true, titolo: 'DIFESA RIUSCITA!', righe: [`${def!.nome} · ${tempo}`, `Medaglia: ${m.toUpperCase()} (tosaerba usati: ${s.stats.tosaerba})`], premio: prossimo?.nuova ?? null, avanti: !!prossimo }, () => avvia(lv), () => avvia(prossimo ? lv + 1 : lv), menuLivelli);
    } else {
      ui.fine({ vinta: false, titolo: 'HANNO SFONDATO!', righe: [`${def!.nome} · ondata ${s.ondata} di ${totOndate(s)}`, 'Riprova: metti prima i produttori, poi i tiratori.'], avanti: false }, () => avvia(lv), () => {}, menuLivelli);
    }
  }, vinta ? 1300 : 1100);
}

// ---------- eventi della sim → suoni, effetti, avvisi ----------
const sullo = (x: number, y: number) => aSchermo(Q, suFondale(pelle!, x, y));
const altezza = (corsia: number) => casella(pelle!, corsia + 0.5)[1] * Q.scala;
let ultimoSparo = 0;
function eventi(evs: DEvento[], t: number): void {
  for (const ev of evs) {
    switch (ev.e) {
      case 'pianta': { const [x, y] = sullo(ev.col + 0.5, ev.corsia + 0.8); fx.sbuffo(x, y, altezza(ev.corsia) * 0.35, 'rgba(120,90,50,0.7)', 7); resa.anim(ev.id, t).nato = t; suoni.pianta(); break; }
      case 'pala': { const [x, y] = sullo(ev.col + 0.5, ev.corsia + 0.8); fx.sbuffo(x, y, altezza(ev.corsia) * 0.35, 'rgba(120,90,50,0.7)', 7); break; }
      case 'spara': resa.anim(ev.id, t).rinculo = t; if (t - ultimoSparo > 0.05) { suoni.spara(ev.gelo); ultimoSparo = t; } break;
      case 'colpito': { const [x, y] = sullo(ev.x - 0.15, ev.corsia + 0.45); fx.schegge(x, y, ev.armatura ? '#c9c9c9' : ev.gelo ? '#9fe8ff' : '#8ee05a', 4, 140); suoni.colpito(ev.armatura); break; }
      case 'armatura': { const e = s.nemici.find((n) => n.id === ev.id); if (e) { const [x, y] = sullo(e.x, e.corsia + 0.2); fx.schegge(x, y, ev.tipo === 'cono' ? '#ff8a2a' : '#a8b0b8', 9, 220); } break; }
      case 'testa': { const e = s.nemici.find((n) => n.id === ev.id); if (e) { const [x, y] = sullo(e.x, e.corsia + 0.25); fx.sbuffo(x, y, altezza(e.corsia) * 0.2, 'rgba(255,255,255,0.8)', 4); } break; }
      case 'morto': {
        const [x, y] = sullo(ev.x, ev.corsia + 0.8), tz = s.tosa[ev.corsia]!, tosato = tz.stato === 1 && Math.abs(tz.x - ev.x) < 0.6;
        const chiave: ChiaveSprite = ev.tipo === 'cono' || ev.tipo === 'secchio' ? 'base' : ev.tipo;
        fx.corpo(chiave, x, y, altezza(ev.corsia) * (pelle!.sprite[chiave]?.alto ?? 1.15), tosato ? 1 : 0);
        break;
      }
      case 'morso': resa.anim(ev.unita, t).morso = t; suoni.morso(); break;
      case 'mangiato': { const [x, y] = sullo(ev.col + 0.5, ev.corsia + 0.7); fx.sbuffo(x, y, altezza(ev.corsia) * 0.3, 'rgba(90,70,50,0.7)', 6); suoni.mangiato(); break; }
      case 'moneta': if (ev.cielo) suoni.moneta(); break;
      case 'raccolta': { if (raccoltaAuto || auto) volaMoneta(ev.id, ev.valore, true); break; }
      case 'esplode': {
        const bomba = ev.tipo === 'bomba', [x, y] = sullo(ev.col + 0.5, ev.corsia + 0.6), H = altezza(ev.corsia);
        fx.anello(x, y, H * (bomba ? 2.4 : 1.2), '#fff2a8'); fx.sbuffo(x, y, H * (bomba ? 1.1 : 0.6), 'rgba(255,170,60,0.9)', bomba ? 14 : 8); fx.sbuffo(x, y, H * 0.8, 'rgba(80,60,50,0.8)', 8); fx.schegge(x, y, '#5a3a1e', bomba ? 18 : 10, 320);
        scossa = bomba ? 1 : 0.5; suoni.botto(bomba); break;
      }
      case 'armata': { resa.anim(ev.id, t).armata = t; const u = s.unita.find((k) => k.id === ev.id); if (u) { const [x, y] = sullo(u.col + 0.5, u.corsia + 0.8); fx.sbuffo(x, y, altezza(u.corsia) * 0.25, 'rgba(120,90,50,0.7)', 5); } break; }
      case 'salta': { const e = s.nemici.find((n) => n.id === ev.id); if (e) { const [x, y] = sullo(e.x, e.corsia + 0.8); fx.sbuffo(x, y, altezza(e.corsia) * 0.3, 'rgba(230,220,200,0.8)', 5); } break; }
      case 'tosaerba': suoni.tosaerba(); break;
      case 'arriva': if (!prova) { ui.avviso('ARRIVANO!'); suoni.ondata(); } break;
      case 'enorme': if (!prova) { ui.avviso('ONDATA ENORME!', 3); suoni.enorme(); } break;
      case 'ondata': if (ev.finale && !prova) setTimeout(() => ui.avviso('ULTIMA ONDATA!', 2.5), 400); break;
      case 'vinta': suoni.vinta(); fine(true); break;
      case 'persa': suoni.persa(); fine(false); break;
      case 'rifiuto': suoni.no(); break;
    }
  }
}
/** La moneta raccolta vola al contatore. */
function volaMoneta(id: number, valore: number, giaRaccolta = false): void {
  if (!pelle) return;
  const dove = giaRaccolta ? ultimaPos.get(id) : resa.dovMoneta(s, pelle, Q, id);
  if (!dove) return;
  const r = ui.valutaEl.getBoundingClientRect();
  fx.volo(dove[0], dove[1] + dove[2] * 0.5, r.left + r.width / 2, r.top + r.height * 0.6, dove[2]);
  fx.testo(dove[0], dove[1] - dove[2] * 0.4, `+${valore}`, '#fff6b0');
  suoni.raccolta();
}
const ultimaPos = new Map<number, [number, number, number]>();

// ---------- tocchi e mouse ----------
function casellaDa(sx: number, sy: number): { col: number; corsia: number } | null {
  if (!pelle) return null;
  const [fx_, fy] = daSchermo(Q, sx, sy), [x, y] = daFondale(pelle, fx_, fy);
  if (x < 0 || x >= 9 || y < 0 || y >= 5) return null;
  return { col: Math.floor(x), corsia: Math.floor(y) };
}
function monetaSotto(sx: number, sy: number): number | null {
  if (!pelle) return null;
  let best: number | null = null, bd = Infinity;
  for (const m of s.monete) {
    const d = resa.dovMoneta(s, pelle, Q, m.id); if (!d) continue;
    const dist = Math.hypot(d[0] - sx, d[1] - sy);
    if (dist < Math.max(30, d[2] * 0.75) && dist < bd) { bd = dist; best = m.id; }
  }
  return best;
}
function aggiornaFantasma(sx: number, sy: number): void {
  if (!scelta) { fantasma = null; return; }
  const c = casellaDa(sx, sy);
  if (!c) { fantasma = null; return; }
  const occupata = s.unita.some((u) => u.corsia === c.corsia && u.col === c.col);
  fantasma = { tipo: scelta, corsia: c.corsia, col: c.col, ok: s.corsie.includes(c.corsia) && (scelta === 'pala' ? occupata : !occupata) };
}
function tocca(sx: number, sy: number): void {
  if (!inGioco || finita || pausa) return;
  const m = monetaSotto(sx, sy);
  if (m !== null) { volaMoneta(m, s.monete.find((k) => k.id === m)?.valore ?? 25); coda.push({ t: 'raccogli', id: m }); return; }
  if (!scelta) return;
  const c = casellaDa(sx, sy);
  if (!c) { scelta = null; fantasma = null; return; }
  coda.push(scelta === 'pala' ? { t: 'pala', corsia: c.corsia, col: c.col } : { t: 'pianta', tipo: scelta, corsia: c.corsia, col: c.col });
  scelta = null; fantasma = null;
}
let trascina: { x: number; y: number; mosso: boolean } | null = null;
tela.addEventListener('pointerdown', (e) => { tocca(e.clientX, e.clientY); });
ui.barra.addEventListener('pointerdown', (e) => { trascina = { x: e.clientX, y: e.clientY, mosso: false }; }, { capture: true });
addEventListener('pointermove', (e) => {
  if (trascina && Math.hypot(e.clientX - trascina.x, e.clientY - trascina.y) > 14) trascina.mosso = true;
  aggiornaFantasma(e.clientX, e.clientY);
});
addEventListener('pointerup', (e) => {
  if (trascina?.mosso && scelta && casellaDa(e.clientX, e.clientY)) tocca(e.clientX, e.clientY);
  trascina = null;
  if (telefono()) fantasma = null;
});
tela.addEventListener('contextmenu', (e) => { e.preventDefault(); scelta = null; fantasma = null; });
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 9 && s.carte[n - 1]) sceglie(s.carte[n - 1]!.tipo);
  else if (e.code === 'KeyE') sceglie('pala');
  else if (e.code === 'Space') { e.preventDefault(); pausa = !pausa; }
  else if (e.code === 'KeyF') cambiaVeloce();
  else if (e.code === 'KeyT') pilota();
  else if (e.code === 'KeyM') { muto = !muto; suoni.muto(muto); mem.muto = muto; salva(); }
  else if (e.code === 'KeyR' && inGioco) avvia(s.livello);
  else if (e.code === 'Escape') { scelta = null; fantasma = null; }
  opzioni();
});
ui.bPausa.addEventListener('click', () => { pausa = !pausa; });
ui.suPausa(() => { pausa = false; }, () => { pausa = false; avvia(s.livello); }, () => { pausa = false; menuLivelli(); });
ui.bVeloce.addEventListener('click', () => cambiaVeloce());
ui.bProve.addEventListener('click', () => ui.apriProve());
function cambiaVeloce(): void { veloce = veloce >= 2 ? 1 : 2; }
function pilota(): void { auto = auto ? null : 'bravo'; bot = auto ? creaBot(auto, s.tick + 1) : null; }
document.addEventListener('visibilitychange', () => { if (document.hidden && inGioco && !finita && !auto && !prova) pausa = true; });

// ---------- pannello «⚙ prove» ----------
function opzioni(): void {
  ui.prove([
    { id: 'stile', etichetta: () => `STILE: ${PELLI.find((p) => p.id === stile)?.nome ?? stile}`, premi: () => { const i = PELLI.findIndex((p) => p.id === stile); stile = PELLI[(i + 1) % PELLI.length]!.id; mem.stile = stile; salva(); void cambiaPelle(); } },
    { id: 'profilo', etichetta: () => `numeri: ${profilo === 'pvz' ? 'PvZ originale' : 'MAREA'}`, premi: () => { profilo = profilo === 'pvz' ? 'marea' : 'pvz'; mem.profilo = profilo; salva(); if (inGioco) avvia(s.livello); } },
    { id: 'raccolta', etichetta: () => `raccolta automatica: ${raccoltaAuto ? 'SÌ' : 'NO'}`, premi: () => { raccoltaAuto = !raccoltaAuto; s.raccoltaAuto = raccoltaAuto; mem.raccolta = raccoltaAuto; salva(); } },
    { id: 'auto', etichetta: () => `pilota automatico: ${auto ?? 'NO'} (T)`, premi: () => { const L: (DBravura | null)[] = [null, 'bravo', 'medio', 'distratto']; auto = L[(L.indexOf(auto) + 1) % L.length]!; bot = auto ? creaBot(auto, s.tick + 1) : null; } },
    { id: 'veloce', etichetta: () => `velocità: ×${veloce} (F)`, premi: () => cambiaVeloce() },
    { id: 'muto', etichetta: () => `suoni: ${muto ? 'NO' : 'SÌ'} (M)`, premi: () => { muto = !muto; suoni.muto(muto); mem.muto = muto; salva(); } },
    { id: 'tutto', etichetta: () => `livelli: ${mem.tutto ? 'TUTTI APERTI' : 'uno alla volta'}`, premi: () => { mem.tutto = !mem.tutto; salva(); } },
    { id: 'rifai', etichetta: () => 'ricomincia il livello (R)', premi: () => { if (inGioco) avvia(s.livello); ui.apriProve(false); } },
    { id: 'menu', etichetta: () => 'scegli il livello', premi: () => { ui.apriProve(false); menuLivelli(); } },
  ]);
}
async function cambiaPelle(): Promise<void> {
  try { pelle = await caricaPelle(stile); } catch (e) { console.warn('[difesa] pelle non caricata, uso il segnaposto', e); stile = 'segnaposto'; pelle = await caricaPelle('segnaposto'); }
  ui.tema(pelle); misura();
}

// ---------- tutorial del livello 1 (consigli corti, non fermano il gioco) ----------
function tutorial(): void {
  const def = livelloDef(s);
  if (!def?.tutorial || prova || !pelle) return;
  if (tutorialPasso === 0) {
    const carta = ui.barra.querySelector('.df-carta')?.getBoundingClientRect();
    if (!scelta && carta) ui.mano(carta.left + carta.width / 2, carta.bottom - 8);
    else { const [x, y] = sullo(2.5, 2.6); ui.mano(x, y); }
    if (s.unita.length) { tutorialPasso = 1; ui.mano(null); ui.consiglio(null); }
  } else if (tutorialPasso === 1 && s.monete.some((m) => m.cielo)) { tutorialPasso = 2; ui.consiglio('Tocca le monete che cadono!', 5); }
  else if (tutorialPasso === 2 && s.valuta >= 100 && s.unita.length < 3) { tutorialPasso = 3; ui.consiglio('Pianta un altro difensore!', 5); }
}

// ---------- ciclo: sim a 60 Hz fissi, resa a ogni frame ----------
const DT = 1 / TICK_HZ;
let acc = 0, ultimo = performance.now(), frames = 0, msResa = 0;
function unPasso(effetti = true): void {
  const comandi = coda; coda = [];
  if (bot) comandi.push(...autopilota(s, bot));
  for (const m of s.monete) ultimaPos.set(m.id, resa.dovMoneta(s, pelle!, Q, m.id)!);
  passo(s, comandi);
  if (effetti) eventi(s.ev, performance.now() / 1000);
  else for (const ev of s.ev) if (ev.e === 'vinta' || ev.e === 'persa') fine(ev.e === 'vinta');
  for (const id of [...ultimaPos.keys()]) if (!s.monete.some((m) => m.id === id)) ultimaPos.delete(id);
}
function frame(ora: number): void {
  const dt = Math.min(0.1, (ora - ultimo) / 1000); ultimo = ora;
  const fermo = !inGioco || pausa || ui.veloAperto() || (telefono() && innerHeight > innerWidth);
  if (!fermo && pelle) { acc += dt * veloce; let n = 0; while (acc >= DT && n < 12) { unPasso(); acc -= DT; n++; } } else acc = 0;
  ui.bPausa.classList.toggle('on', pausa); ui.bVeloce.classList.toggle('on', veloce > 1);
  ui.pausa(pausa && inGioco && !finita && !prova);
  if (pelle) {
    const t0 = performance.now(), t = ora / 1000;
    scossa = Math.max(0, scossa - dt * 3);
    const Qs = scossa > 0 ? { ...Q, ox: Q.ox + Math.sin(t * 70) * 6 * scossa, oy: Q.oy + Math.cos(t * 60) * 4 * scossa } : Q;
    resa.disegna(s, pelle, Qs, fx, t, pausa ? 0 : dt, fantasma);
    msResa = msResa * 0.9 + (performance.now() - t0) * 0.1;
    const P = profiloDifesa(profilo), tot = totOndate(s);
    ui.aggiorna({
      valuta: s.valuta, scelta,
      carte: s.carte.map((c) => { const d = P.unita[c.tipo], durata = d.ricarica * TICK_HZ; return { tipo: c.tipo, costo: d.costo, carica: c.pronta <= s.tick ? 1 : 1 - (c.pronta - s.tick) / durata, puoi: c.pronta <= s.tick && s.valuta >= d.costo }; }),
      onda: tot > 0 ? s.ondata / tot : Math.min(1, (s.ondata % 10) / 10),
      bandiere: tot > 0 ? [...Array(tot).keys()].filter((n) => eBandiera(s, n)).map((n) => ({ dove: (n + 1) / tot, passata: s.ondata > n })) : [{ dove: 1, passata: false }],
      nome: livelloDef(s)?.nome ?? `Sopravvivenza · ondata ${s.ondata}`,
    });
    tutorial();
  }
  frames++;
  if (!ready && pelle && frames > 4) ready = true;
  requestAnimationFrame(frame);
}

// ---------- avvio ----------
void (async () => {
  await cambiaPelle();
  opzioni();
  const lq = q.get('livello');
  if (lq === 's') avvia(-1);
  else if (lq && DIFESA.livelli.some((l) => String(l.id) === lq)) avvia(DIFESA.livelli.findIndex((l) => String(l.id) === lq));
  else if (prova || auto) avvia(0);
  else menuLivelli();
  requestAnimationFrame(frame);
})();

const stato = () => ({
  tick: s.tick, livello: s.livello, valuta: s.valuta, ondata: s.ondata, ondate: totOndate(s), esito: s.esito, unita: s.unita.length, nemici: s.nemici.length,
  monete: s.monete.length, tosaerba: s.stats.tosaerba, uccisi: s.stats.uccisi, inGioco, finita, pausa, veloce, auto, stile, profilo, scelta, menu: ui.veloAperto(),
  tocco: telefono(), carte: s.carte.map((c) => c.tipo),
});
(window as unknown as { __difesa: unknown }).__difesa = {
  get ready() { return ready; },
  state: stato,
  set(o: { livello?: number; auto?: DBravura | null; pausa?: boolean; veloce?: number; valuta?: number; stile?: string; profilo?: DProfiloId; raccolta?: boolean }) {
    if (o.profilo) profilo = o.profilo;
    if (o.raccolta !== undefined) { raccoltaAuto = o.raccolta; s.raccoltaAuto = o.raccolta; }
    if (o.livello !== undefined) avvia(o.livello);
    if (o.auto !== undefined) { auto = o.auto; bot = auto ? creaBot(auto, 7) : null; }
    if (o.pausa !== undefined) pausa = o.pausa;
    if (o.veloce !== undefined) veloce = o.veloce;
    if (o.valuta !== undefined) s.valuta = o.valuta;
    if (o.stile) { stile = o.stile; return cambiaPelle(); }
    opzioni();
    return null;
  },
  /** Avanza di `n` tick subito (col pilota automatico se acceso). */
  avanti(n: number) { for (let i = 0; i < n && !s.esito; i++) unPasso(false); return stato(); },
  premi(c: DComando) { coda.push(c); unPasso(); return stato(); },
  perf: () => ({ sprite: resa.quantiSprite(), effetti: fx.quanti(), ms: Math.round(msResa * 100) / 100 }),
  partita: () => s,
  rendi() { if (pelle) resa.disegna(s, pelle, Q, fx, performance.now() / 1000, 0, fantasma); },
  /** Il centro della casella sullo schermo (per i tocchi dei test). */
  casella: (col: number, corsia: number) => (pelle ? sullo(col + 0.5, corsia + 0.55) : null),
  moneta: (id: number) => (pelle ? resa.dovMoneta(s, pelle, Q, id) : null),
};
