// I pannelli delle Corse (#173, #185), in comune tra il gioco (`corse/index.ts`) e il banco di prova dell'hub (`hub/prova.ts`).
// Menù a rulli alla Mario Kart (#271, scelte di Jack del 13 ott 2026):
// - alla porta della zona, due passi: la giostra delle piste (dietro, la pista vera sorvolata piano: `palco.ts`), poi quella dei veicoli
//   della famiglia della pista (il veicolo con l'avatar al volante che gira su una pedana) con la scheda a destra: 4 statistiche a
//   segmenti (velocità, scatto, sterzo, peso), la frase del veicolo, oggetti, gas e camera. VIA parte da tutti e due i passi;
//   Invio = avanti, Esc = indietro (dal primo passo: chiude);
// - il garage: la stessa giostra dei veicoli, con tutti i veicoli.
// Si scorre con ◀ ▶, A D / frecce, il dito (trascinando di lato) o toccando le carte.
// La scelta (pista, veicolo, gas, camera) sta in localStorage `mz-corse-scelta`: la usano l'hub (con che veicolo guidi) e la gara.
// Un pannello alla volta, nello stesso riquadro `#mzGpIntro` (i test lo cercano lì).
import { CORSE, CORSE_PISTE, CORSE_PISTE_SPIAGGIA } from '@marea/content/corse.ts';
import { famiglieDi, opzioniGara } from '@marea/sim/corse/gara.ts';
import { PAL, el } from '../../ui/style.ts';
import { suona } from '../../audio/ponte.ts';
import type { Modo } from '../prova/camera.ts';
import { pistaCorse } from '@marea/sim/corse/pista.ts';
import type { CVeicoloDef } from '@marea/content/corse_types.ts';
import type { Palco } from './palco.ts';

export const SCELTA_KEY = 'mz-corse-scelta';
export const PISTE = Object.entries(CORSE_PISTE).filter(([id]) => CORSE_PISTE_SPIAGGIA.includes(id)).map(([id, d]) => ({ id, def: d }));
export const CAMERE: { id: Modo; nome: string }[] = [{ id: 'dietro', nome: 'dietro' }, { id: 'alta', nome: 'alta' }, { id: 'cofano', nome: 'cofano' }];
export type Scelta = { pista: string; veicolo: string; gasAuto: boolean; cam: Modo; oggetti: boolean };

export function leggiScelta(): Scelta {
  let scelta: Scelta = { pista: 'spiaggia_lungomare', veicolo: 'kart', gasAuto: false, cam: 'dietro', oggetti: false };
  try {
    const m = JSON.parse(localStorage.getItem(SCELTA_KEY) ?? 'null') as Partial<Scelta> | null;
    if (m) scelta = { pista: PISTE.some((p) => p.id === m.pista) ? m.pista! : scelta.pista, veicolo: CORSE.veicoli.some((v) => v.id === m.veicolo) ? m.veicolo! : scelta.veicolo, gasAuto: !!m.gasAuto, cam: CAMERE.some((c) => c.id === m.cam) ? m.cam! : 'dietro', oggetti: !!m.oggetti };
  } catch { /* niente memoria: di serie */ }
  return scelta;
}
export function salvaScelta(s: Scelta): void { try { localStorage.setItem(SCELTA_KEY, JSON.stringify(s)); } catch { /* pazienza */ } }
export const veicoliDi = (pista: string) => CORSE.veicoli.filter((v) => famiglieDi(CORSE_PISTE[pista]!).includes(v.famiglia));
/** Il veicolo della scelta va bene per la pista? Se no il primo della famiglia della pista (il garage può averne scelto uno d'acqua). */
export function veicoloPer(s: Scelta): string { return veicoliDi(s.pista).some((v) => v.id === s.veicolo) ? s.veicolo : veicoliDi(s.pista)[0]!.id; }

// ---------- look alla Mario Kart (#271, Jack 13 ott: «fai qualcosa di più simile a mario kart e i giochi di racing», non lo stile
// marrone e giallo del resto di MAREA, mai approvato): carte inclinate, scritte grandi in corsivo spesso col bordo, barre a segmenti
// inclinati, frecce tonde, VIA rosso. Due pelli per la prova A/B: A = blu, bianco e giallo (Mario Kart), B = viola, nero e lime
// (arcade). Si sceglie con ?menu=b, o col tasto M nel menù; resta in localStorage `mz-corse-menu`. ----------
const PELLI = {
  a: { carta: '#2478A8', scuro: '#163F73', acc: '#F5D547', via: '#E8433F', testo: '#FFFFFF', velo: 'rgba(22,63,115,.82)', riga: '#3FB9C9' },
  b: { carta: '#A64DFF', scuro: '#23201F', acc: '#D9E872', via: '#F2A33A', testo: '#FFFFFF', velo: 'rgba(35,32,31,.84)', riga: '#FF3DA6' },
} as const;
type Pelle = keyof typeof PELLI;
/** I rulli (prova di Jack, «rulli che scorrono sopra e sotto»): colonna = rullo verticale a sinistra (pista, poi veicolo); tamburo = lo
 *  stesso su un cilindro, come una slot machine; colonne = pista e veicolo affiancati in una schermata sola (alla Mario Kart 8);
 *  giostra = la prima prova, orizzontale. ?rullo=… o il tasto V; resta in localStorage `mz-corse-rullo`. */
type Layout = 'colonna' | 'tamburo' | 'colonne' | 'giostra';
const LAYOUTS: Layout[] = ['colonna', 'tamburo', 'colonne', 'giostra'];
const LAYOUT_KEY = 'mz-corse-rullo';
function layoutIniziale(): Layout {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('rullo') : null;
  if (LAYOUTS.includes(q as Layout)) return q as Layout;
  try { const m = localStorage.getItem(LAYOUT_KEY); if (LAYOUTS.includes(m as Layout)) return m as Layout; } catch { /* niente */ }
  return 'colonna';
}
type Rullo = { el: HTMLElement; vai(j: number): void; readonly i: number; fuoco(on: boolean): void };
const PELLE_KEY = 'mz-corse-menu';
function pelleIniziale(): Pelle {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('menu') : null;
  if (q === 'a' || q === 'b') return q;
  try { const m = localStorage.getItem(PELLE_KEY); if (m === 'a' || m === 'b') return m; } catch { /* niente */ }
  return 'a';
}

const CSS = `
.mz-gp-sc { --c: ${PELLI.a.carta}; --s: ${PELLI.a.scuro}; --a: ${PELLI.a.acc}; --v: ${PELLI.a.via}; --t: ${PELLI.a.testo}; --velo: ${PELLI.a.velo}; --r: ${PELLI.a.riga};
  --f: 'Arial Rounded MT Bold', ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, 'Arial Black', sans-serif;
  position: absolute; inset: 0; z-index: 30; display: none; pointer-events: none; font-family: var(--f); color: var(--t); -webkit-user-select: none; user-select: none; }
.mz-gp-sc.b { --c: ${PELLI.b.carta}; --s: ${PELLI.b.scuro}; --a: ${PELLI.b.acc}; --v: ${PELLI.b.via}; --t: ${PELLI.b.testo}; --velo: ${PELLI.b.velo}; --r: ${PELLI.b.riga}; }
.mz-gp-sc.on { display: block; }
.mz-gp-sc.velo { background: rgba(22,63,115,.55); }
.mz-gp-sc button, .mz-gp-sc .tasto { pointer-events: auto; font-family: var(--f); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mz-gp-sc .ombra { text-shadow: 2px 2px 0 var(--s), -2px 2px 0 var(--s), 2px -2px 0 var(--s), -2px -2px 0 var(--s), 0 3px 0 var(--s), 3px 0 0 var(--s), 0 -2px 0 var(--s), -2px 0 0 var(--s), 4px 5px 0 rgba(0,0,0,.35); }
/* in alto: i passi (1 PISTA · 2 VEICOLO) e il nome della zona; a destra la X */
.mz-gp-sc .testa { position: absolute; left: max(14px, env(safe-area-inset-left, 0px)); top: max(12px, env(safe-area-inset-top, 0px)); pointer-events: none; }
.mz-gp-sc .passi { display: flex; gap: 6px; }
.mz-gp-sc .passi button { display: block; color: var(--t); padding: 6px 18px; transform: skewX(-14deg); background: var(--velo); border: 3px solid var(--t); font-style: italic; font-weight: 900; font-size: 15px; letter-spacing: .04em; box-shadow: 4px 4px 0 rgba(0,0,0,.3); }
.mz-gp-sc .passi button > i { display: block; transform: skewX(14deg); font-style: italic; }
.mz-gp-sc .passi button.on { background: var(--a); color: var(--s); }
.mz-gp-sc .zona { margin: 10px 0 0 4px; font-style: italic; font-weight: 900; font-size: 30px; line-height: 1; text-transform: uppercase; letter-spacing: .01em; }
.mz-gp-sc .zona small { display: block; margin-top: 4px; font-size: 13px; font-weight: 800; letter-spacing: .03em; text-transform: none; }
.mz-gp-sc .chiudi { position: absolute; right: max(14px, env(safe-area-inset-right, 0px)); top: max(12px, env(safe-area-inset-top, 0px)); width: 46px; height: 46px; border-radius: 50%; background: var(--t); color: var(--s); border: 4px solid var(--s); font-size: 22px; font-weight: 900; box-shadow: 3px 4px 0 rgba(0,0,0,.35); }
/* in basso: la giostra delle carte (con le frecce tonde) e i bottoni grandi */
.mz-gp-sc .giu { position: absolute; left: max(14px, env(safe-area-inset-left, 0px)); right: max(14px, env(safe-area-inset-right, 0px)); bottom: max(12px, env(safe-area-inset-bottom, 0px)); display: flex; align-items: flex-end; gap: 14px; pointer-events: none; }
.mz-gp-sc .giostra { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 10px; touch-action: pan-y; pointer-events: auto; padding: 14px 0 4px; }
.mz-gp-sc .freccia { flex: none; width: 52px; height: 52px; border-radius: 50%; background: var(--t); color: var(--s); border: 4px solid var(--s); font-size: 24px; font-weight: 900; line-height: 1; box-shadow: 3px 4px 0 rgba(0,0,0,.35); padding: 0; }
.mz-gp-sc .freccia:active, .mz-gp-sc .grande:active, .mz-gp-sc .carta:active { transform: translateY(2px) skewX(-10deg); }
.mz-gp-sc .freccia:active { transform: translateY(2px); }
.mz-gp-sc .carte { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mz-gp-sc .carta { position: relative; flex: none; width: 168px; height: 104px; padding: 0; transform: skewX(-10deg); background: var(--c); border: 4px solid var(--t); border-radius: 6px; box-shadow: 5px 6px 0 rgba(0,0,0,.35); overflow: hidden; opacity: .78; color: var(--t); }
.mz-gp-sc .carta::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(-60deg, transparent 0 22px, rgba(255,255,255,.08) 22px 34px); }
.mz-gp-sc .carta > .dentro { position: absolute; inset: 0; transform: skewX(10deg); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 6px 10px; }
.mz-gp-sc .carta.on { width: 214px; height: 130px; opacity: 1; border-color: var(--a); border-width: 5px; box-shadow: 0 0 0 4px var(--s), 7px 9px 0 rgba(0,0,0,.4); animation: mzPop .22s ease-out; }
@keyframes mzPop { 0% { transform: skewX(-10deg) scale(.86); } 70% { transform: skewX(-10deg) scale(1.05); } 100% { transform: skewX(-10deg) scale(1); } }
.mz-gp-sc .carta .nome { font-style: italic; font-weight: 900; font-size: 17px; line-height: 1.05; text-transform: uppercase; text-align: center; }
.mz-gp-sc .carta.on .nome { font-size: 21px; }
.mz-gp-sc .carta canvas { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); width: 92px; height: 60px; }
.mz-gp-sc .carta.on canvas { width: 120px; height: 78px; }
.mz-gp-sc .carta .giri { position: absolute; left: 8px; top: 6px; padding: 1px 7px; background: var(--a); color: var(--s); font-style: italic; font-weight: 900; font-size: 11px; border-radius: 3px; }
.mz-gp-sc .carta .icona { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); font-size: 40px; line-height: 1; }
.mz-gp-sc .carta.on .icona { font-size: 54px; }
.mz-gp-sc .bottoni { flex: none; display: flex; flex-direction: column; gap: 10px; align-items: stretch; pointer-events: auto; }
.mz-gp-sc .grande { min-width: 230px; min-height: 64px; padding: 0 22px; transform: skewX(-10deg); background: var(--v); color: var(--t); border: 4px solid var(--t); border-radius: 6px; box-shadow: 0 0 0 4px var(--s), 6px 8px 0 rgba(0,0,0,.4); font-style: italic; font-weight: 900; font-size: 28px; letter-spacing: .03em; }
.mz-gp-sc .grande > i { display: block; transform: skewX(10deg); font-style: italic; }
.mz-gp-sc .grande.blu { background: var(--c); font-size: 17px; min-height: 46px; }
.mz-gp-sc .grande.indietro { background: var(--velo); font-size: 16px; min-height: 42px; }
/* veicolo: la scheda a destra (nome, famiglia, statistiche a segmenti, frase) e le opzioni piccole */
.mz-gp-sc .scheda { position: absolute; right: max(14px, env(safe-area-inset-right, 0px)); top: 74px; width: 340px; padding: 14px 18px 16px; background: var(--velo); border: 4px solid var(--t); border-radius: 8px; box-shadow: 0 0 0 4px var(--s), 7px 9px 0 rgba(0,0,0,.35); pointer-events: auto; }
.mz-gp-sc .scheda .nome { font-style: italic; font-weight: 900; font-size: 30px; line-height: 1; text-transform: uppercase; }
.mz-gp-sc .scheda .fam { display: inline-block; margin: 8px 0 10px; padding: 2px 12px; transform: skewX(-12deg); background: var(--a); color: var(--s); font-style: italic; font-weight: 900; font-size: 13px; }
.mz-gp-sc .stat { display: grid; grid-template-columns: 112px 1fr; gap: 7px 10px; align-items: center; }
.mz-gp-sc .stat > span { font-style: italic; font-weight: 900; font-size: 14px; letter-spacing: .03em; }
.mz-gp-sc .tacche { display: flex; gap: 4px; }
.mz-gp-sc .tacche i { flex: 1; height: 16px; transform: skewX(-20deg); background: rgba(0,0,0,.35); border: 2px solid rgba(255,255,255,.35); }
.mz-gp-sc .tacche i.si { background: var(--a); border-color: var(--t); }
.mz-gp-sc .frase { margin-top: 12px; padding: 8px 12px; background: var(--t); color: var(--s); border-radius: 6px; font-style: italic; font-weight: 800; font-size: 14px; line-height: 1.25; }
.mz-gp-sc .opz { margin-top: 12px; display: grid; grid-template-columns: auto 1fr; gap: 5px 8px; align-items: center; font-style: italic; font-weight: 900; font-size: 11px; letter-spacing: .04em; }
.mz-gp-sc .opz > div { display: flex; gap: 4px; flex-wrap: wrap; }
.mz-gp-sc .opz button { min-height: 30px; padding: 0 10px; border-radius: 15px; background: rgba(0,0,0,.3); color: var(--t); border: 2px solid rgba(255,255,255,.5); font-weight: 900; font-size: 12px; }
.mz-gp-sc .opz button.on { background: var(--a); color: var(--s); border-color: var(--t); }
.mz-gp-sc .tasti { position: absolute; left: 50%; transform: translateX(-50%); top: max(14px, env(safe-area-inset-top, 0px)); padding: 4px 12px; background: rgba(0,0,0,.35); border-radius: 14px; font-weight: 800; font-size: 12px; white-space: nowrap; pointer-events: none; }
.mz-gp-sc .tasti b { display: inline-block; min-width: 18px; padding: 0 5px; margin: 0 2px; background: var(--t); color: var(--s); border-radius: 4px; text-align: center; }
/* il rullo verticale: la carta scelta in mezzo, le altre sopra e sotto; --k = posto rispetto a quella scelta */
.mz-gp-sc .rv { --h: 76px; --p: 88px; --r: 212px; position: absolute; left: max(14px, env(safe-area-inset-left, 0px)); top: 104px; bottom: 14px; width: 310px; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: auto; }
.mz-gp-sc .rv.due { left: calc(max(14px, env(safe-area-inset-left, 0px)) + 322px); width: 270px; }
.mz-gp-sc .rv-tit { align-self: stretch; text-align: center; padding: 4px 0; transform: skewX(-12deg); background: var(--velo); border: 3px solid var(--t); font-style: italic; font-weight: 900; font-size: 15px; letter-spacing: .06em; }
.mz-gp-sc .rv.fuoco .rv-tit { background: var(--a); color: var(--s); }
.mz-gp-sc .rv .freccia { width: 44px; height: 34px; border-radius: 17px; font-size: 16px; flex: none; }
.mz-gp-sc .rv .finestra { position: relative; flex: 1; align-self: stretch; overflow: hidden; touch-action: none; }
.mz-gp-sc .rv .nastro { position: absolute; inset: 0; }
.mz-gp-sc .rv .vc { --k: 0; --ak: 0; position: absolute; left: 7%; right: 7%; top: 50%; height: var(--h); margin: 0; padding: 0; color: var(--t); background: var(--c); border: 3px solid var(--t); border-radius: 6px; box-shadow: 4px 5px 0 rgba(0,0,0,.35); overflow: hidden;
  transform: translateY(calc(-50% + var(--k) * var(--p))) skewX(-8deg) scale(calc(1 - .13 * var(--ak))); opacity: calc(1 - .28 * var(--ak)); z-index: calc(10 - var(--ak));
  transition: transform .28s cubic-bezier(.2, .9, .3, 1.25), opacity .22s; }
.mz-gp-sc .rv .vc::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(-60deg, transparent 0 22px, rgba(255,255,255,.08) 22px 34px); }
.mz-gp-sc .rv .vc.on { left: 0; right: 0; border-color: var(--a); border-width: 4px; box-shadow: 0 0 0 4px var(--s), 6px 8px 0 rgba(0,0,0,.4); }
.mz-gp-sc .rv .vc.salta { transition: none; }
.mz-gp-sc .rv .vc.via { visibility: hidden; }
.mz-gp-sc .rv.tamburo .finestra { perspective: 380px; }
.mz-gp-sc .rv.tamburo .nastro { transform-style: preserve-3d; transform: translateZ(calc(var(--r) * -1)); }
.mz-gp-sc .rv.tamburo .vc { transform: translateY(-50%) rotateX(calc(var(--k) * -34deg)) translateZ(var(--r)) skewX(-8deg); opacity: calc(1 - .2 * var(--ak)); filter: brightness(calc(1 - .18 * var(--ak))); backface-visibility: hidden; }
.mz-gp-sc .rv .dentro { position: absolute; inset: 0; transform: skewX(8deg); display: flex; align-items: center; padding: 0 12px; }
.mz-gp-sc .rv .riga { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; text-align: left; }
.mz-gp-sc .rv .riga canvas { flex: none; width: 84px; height: 55px; }
.mz-gp-sc .rv .riga .icona { flex: none; width: 60px; text-align: center; font-size: 40px; line-height: 1; }
.mz-gp-sc .rv .riga .testo { min-width: 0; }
.mz-gp-sc .rv .riga .nome { font-style: italic; font-weight: 900; font-size: 21px; line-height: 1.02; text-transform: uppercase; }
.mz-gp-sc .rv .riga .info { margin-top: 3px; font-style: italic; font-weight: 800; font-size: 11px; letter-spacing: .05em; opacity: .9; }
.mz-gp-sc .giu .spazio { flex: 1; }
.mz-gp-sc .rv ~ .scheda { top: 74px; }
.mz-gp-sc .scheda.corta { top: auto !important; bottom: 100px; width: 300px; } .mz-gp-sc .scheda.corta .frase, .mz-gp-sc .scheda.corta .opz { display: none; }
body.mz-rulli #joystick, body.mz-rulli .btn, body.mz-rulli #btnA, body.mz-rulli #btnB, body.mz-rulli #mzGpGas, body.mz-rulli .mz-hub-esci, body.mz-rulli .mz-hub-barca,
body.mz-rulli .mz-hub-v, body.mz-rulli .mz-hub-tag, body.mz-rulli .mz-hub-mappa, body.mz-rulli #mzHubMsg { display: none !important; }
@media (pointer: coarse), (max-width: 1150px) { .mz-gp-sc .tasti { display: none; } }
@media (max-height: 520px) {
  .mz-gp-sc .passi button { padding: 3px 12px; font-size: 11px; border-width: 2px; } .mz-gp-sc .zona { font-size: 19px; margin-top: 6px; } .mz-gp-sc .zona small { font-size: 10px; margin-top: 2px; }
  .mz-gp-sc .chiudi { width: 38px; height: 38px; font-size: 18px; border-width: 3px; }
  .mz-gp-sc .giostra { gap: 6px; padding-top: 8px; } .mz-gp-sc .freccia { width: 42px; height: 42px; font-size: 19px; border-width: 3px; }
  .mz-gp-sc .carte { gap: 8px; } .mz-gp-sc .carta { width: 112px; height: 72px; border-width: 3px; } .mz-gp-sc .carta.on { width: 150px; height: 92px; border-width: 4px; }
  .mz-gp-sc .carta .nome { font-size: 12px; } .mz-gp-sc .carta.on .nome { font-size: 15px; }
  .mz-gp-sc .carta canvas { width: 60px; height: 40px; top: 5px; } .mz-gp-sc .carta.on canvas { width: 80px; height: 52px; }
  .mz-gp-sc .carta .icona { font-size: 24px; } .mz-gp-sc .carta.on .icona { font-size: 30px; } .mz-gp-sc .carta .giri { font-size: 9px; padding: 0 5px; }
  .mz-gp-sc .grande { min-width: 160px; min-height: 48px; font-size: 21px; border-width: 3px; box-shadow: 0 0 0 3px var(--s), 4px 5px 0 rgba(0,0,0,.4); }
  .mz-gp-sc .grande.blu { font-size: 13px; min-height: 36px; } .mz-gp-sc .grande.indietro { font-size: 12px; min-height: 32px; }
  .mz-gp-sc .bottoni { gap: 7px; }
  .mz-gp-sc .scheda { top: 46px; width: 290px; padding: 8px 12px 10px; border-width: 3px; box-shadow: 0 0 0 3px var(--s), 5px 6px 0 rgba(0,0,0,.35); }
  .mz-gp-sc .scheda .nome { font-size: 20px; } .mz-gp-sc .scheda .fam { margin: 4px 0 6px; font-size: 10px; }
  .mz-gp-sc .stat { grid-template-columns: 82px 1fr; gap: 3px 8px; } .mz-gp-sc .stat > span { font-size: 11px; } .mz-gp-sc .tacche i { height: 11px; }
  .mz-gp-sc .rv { --h: 50px; --p: 57px; --r: 140px; top: 80px; bottom: 8px; width: 236px; gap: 3px; } .mz-gp-sc .rv.due { left: calc(max(10px, env(safe-area-inset-left, 0px)) + 244px); width: 200px; }
  .mz-gp-sc .rv .freccia { width: 36px; height: 24px; font-size: 12px; border-width: 2px; } .mz-gp-sc .rv-tit { font-size: 11px; padding: 1px 0; border-width: 2px; }
  .mz-gp-sc .rv .riga canvas { width: 56px; height: 37px; } .mz-gp-sc .rv .riga .icona { width: 40px; font-size: 26px; } .mz-gp-sc .rv .riga .nome { font-size: 15px; } .mz-gp-sc .rv .riga .info { font-size: 9px; margin-top: 1px; }
  .mz-gp-sc .rv .dentro { padding: 0 8px; } .mz-gp-sc .rv .vc { border-width: 2px; } .mz-gp-sc .rv .vc.on { border-width: 3px; box-shadow: 0 0 0 3px var(--s), 4px 5px 0 rgba(0,0,0,.4); }
  .mz-gp-sc .rv ~ .scheda { top: 46px; } .mz-gp-sc .scheda.corta { bottom: 66px; width: 250px; }
  .mz-gp-sc .frase { margin-top: 6px; padding: 4px 8px; font-size: 11px; } .mz-gp-sc .opz { margin-top: 6px; gap: 3px 6px; font-size: 9px; } .mz-gp-sc .opz button { min-height: 24px; padding: 0 7px; font-size: 10px; }
}
`;

export type Pannelli = {
  /** La scelta della pista e poi del veicolo: risolve con le opzioni della gara (VIA) o null (`esci`). Salva da sé la scelta. */
  piste(s: Scelta, o?: { titolo?: string; sottotitolo?: string; esci?: string; amici?: boolean }): Promise<Record<string, string> | null>;
  /** Il garage: risolve col veicolo scelto o null. */
  garage(attuale: string): Promise<string | null>;
  /** Chiude il pannello aperto (come «esci»). */
  chiudi(): void;
  /** VIA, da qualunque passo (i test e la tastiera). */
  via(): void;
  /** Invio: dal rullo delle piste si passa ai veicoli, dai veicoli si parte; nel garage si prende il veicolo. */
  invio(): void;
  /** Esc: dal rullo dei veicoli si torna alle piste (true); altrimenti false (chi chiama chiude). */
  indietro(): boolean;
  aperto(): 'piste' | 'garage' | null;
  readonly el: HTMLElement;
};

/** Le 4 statistiche del rullo: 1..5 tacche, rispetto agli altri veicoli della stessa specie (i carrelli dei binari tra loro, il resto
 *  tra sé: lo sterzo dei carrelli è quanto in fretta si piegano, non si confronta col volante). */
const STAT: { k: 'velocita' | 'accelerazione' | 'sterzo' | 'peso'; nome: string }[] = [
  { k: 'velocita', nome: 'VELOCITÀ' }, { k: 'accelerazione', nome: 'SCATTO' }, { k: 'sterzo', nome: 'STERZO' }, { k: 'peso', nome: 'PESO' },
];
export function tacche(v: CVeicoloDef, k: (typeof STAT)[number]['k']): number {
  const simili = CORSE.veicoli.filter((x) => (x.famiglia === 'binari') === (v.famiglia === 'binari'));
  const mn = Math.min(...simili.map((x) => x[k])), mx = Math.max(...simili.map((x) => x[k]));
  return mx > mn ? 1 + Math.round((4 * (v[k] - mn)) / (mx - mn)) : 3;
}
/** L'icona della carta di un veicolo (finché non ci sono le foto dei modelli). */
const ICONA: Record<string, string> = {
  kart: '🏎️', auto: '🚗', carrello: '🛒', moto_acqua: '🚤', gommone: '🛟', vasca: '🛁', carrello_miniera: '⛏️', carrello_corsa: '🏁', carrello_corazzato: '🛡️',
};
const giriDi = (id: string) => { const d = CORSE_PISTE[id]!; return d.tipo === 'fuga' ? 'FUGA' : `${d.giri} GIRI`; };
const famDi = (id: string) => famiglieDi(CORSE_PISTE[id]!).map((f) => CORSE.famiglie[f].nome).join(' + ');
/** Il tracciato visto dall'alto, bianco col bordo scuro (come le carte dei circuiti dei giochi di kart). */
function tracciato(id: string, scuro: string): HTMLCanvasElement {
  const W = 120, H = 78, c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const g = c.getContext('2d'); if (!g) return c;
  g.scale(2, 2); g.lineJoin = 'round'; g.lineCap = 'round';
  const p = pistaCorse(id), linee = [p.n, ...p.rami.map((r) => r.n)];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of linee) for (let i = 0; i < n.n; i++) { x0 = Math.min(x0, n.x[i]!); x1 = Math.max(x1, n.x[i]!); z0 = Math.min(z0, n.z[i]!); z1 = Math.max(z1, n.z[i]!); }
  const k = Math.min((W - 14) / Math.max(1, x1 - x0), (H - 14) / Math.max(1, z1 - z0)), ox = (W - (x1 - x0) * k) / 2, oz = (H - (z1 - z0) * k) / 2;
  const traccia = () => linee.forEach((n) => {
    g.beginPath();
    for (let i = 0; i < n.n; i += 2) { const x = ox + (n.x[i]! - x0) * k, z = oz + (n.z[i]! - z0) * k; if (i) g.lineTo(x, z); else g.moveTo(x, z); }
    if (n.chiuso) g.closePath();
    g.stroke();
  });
  g.strokeStyle = scuro; g.lineWidth = 7; traccia();
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 3.5; traccia();
  const iv = Math.round(p.def.via / p.n.passo) % p.n.n;
  g.fillStyle = scuro; g.fillRect(ox + (p.n.x[iv]! - x0) * k - 4, oz + (p.n.z[iv]! - z0) * k - 4, 8, 8);
  g.fillStyle = PAL.giallo; g.fillRect(ox + (p.n.x[iv]! - x0) * k - 2.5, oz + (p.n.z[iv]! - z0) * k - 2.5, 5, 5);
  return c;
}

export function creaPannelli(root: HTMLElement, palco: Palco | null = null): Pannelli {
  if (!document.getElementById('mz-gp-sc-style')) { const st = document.createElement('style'); st.id = 'mz-gp-sc-style'; st.textContent = CSS; document.head.appendChild(st); }
  const sc = el('div', 'mz-gp-sc'); sc.id = 'mzGpIntro';
  for (const ev of ['pointerdown', 'touchstart']) sc.addEventListener(ev, (e) => e.stopPropagation());
  root.appendChild(sc);
  let pelle = pelleIniziale(), layout = layoutIniziale();
  sc.classList.toggle('b', pelle === 'b');
  const tocco = matchMedia('(pointer: coarse)').matches;
  let chiudi: ((v: unknown) => void) | null = null, tipo: 'piste' | 'garage' | null = null;
  /** I tasti del pannello aperto: Invio, Esc (true = gestito), ← →, ridisegno (cambio di pelle). */
  let tasti: { invio(): void; indietro(): boolean; scorri(d: number): void; lato(d: number): void; via(): void; ridisegna(): void } | null = null;
  const apri = <T,>(t: 'piste' | 'garage', disegna: (fine: (v: T | null) => void) => void) => new Promise<T | null>((resolve) => {
    chiudi?.(null);
    tipo = t;
    const fine = (v: T | null) => { if (chiudi !== fine) return; chiudi = null; tipo = null; tasti = null; sc.classList.remove('on'); palco?.spegni(); document.body.classList.remove('mz-rulli'); resolve(v); };
    chiudi = fine as (v: unknown) => void;
    disegna(fine); sc.classList.add('on');
    if (palco) document.body.classList.add('mz-rulli'); // davanti al palco i comandi dell'hub (joystick, bottoni, minimappa, cartelli) non servono
  });
  const bottone = (cls: string, testo: string, fai: () => void, id?: string) => { const b = el('button', cls, testo) as HTMLButtonElement; b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fai); return b; };
  /** Bottone grande inclinato (il testo sta dritto dentro). */
  const grande = (cls: string, testo: string, fai: () => void, id?: string) => { const b = bottone('grande ombra ' + cls, '', fai, id); b.appendChild(el('i', '', testo)); return b; };
  if (!palco) sc.classList.add('velo'); // senza palco (niente 3D dietro) si vela lo schermo
  const scuro = () => PELLI[pelle].scuro;

  /** La testa: i due passi (si toccano per andare avanti e indietro), il nome grande e la riga sotto. */
  function testa(passo: 1 | 2 | 0, nome: string, sotto: string, vai?: (n: 1 | 2) => void) {
    const t = el('div', 'testa');
    if (passo) {
      const ps = el('div', 'passi');
      for (const [n, x, id] of [[1, '1 PISTA', 'mzGpIndietro'], [2, '2 VEICOLO', 'mzGpPasso2']] as const) {
        const s = bottone(n === passo ? 'on' : '', '', () => { if (n !== passo) { suona('click'); vai?.(n); } }, id); s.appendChild(el('i', '', x)); ps.appendChild(s);
      }
      t.appendChild(ps);
    }
    const z = el('div', 'zona ombra', nome); z.appendChild(el('small', '', sotto)); t.appendChild(z);
    return t;
  }
  const aiuto = (testo: string) => { const a = el('div', 'tasti'); a.innerHTML = testo; return a; };
  /** La giostra orizzontale (la prima prova): frecce tonde ai lati, le carte in fila (quella scelta più grande). Si trascina col dito. */
  function giostra<X extends { id: string }>(voci: X[], i: number, carta: (x: X, on: boolean) => HTMLElement, vai: (j: number) => void, chiave = 'id') {
    const n = voci.length, g = el('div', 'giostra'), carte = el('div', 'carte');
    voci.forEach((v, j) => { const c = carta(v, j === i); c.dataset[chiave] = v.id; c.addEventListener('click', () => { if (j !== i) { suona('click'); vai(j); } }); carte.appendChild(c); });
    g.append(bottone('freccia', '◀', () => { suona('click'); vai((i + n - 1) % n); }, 'mzRulloPrima'), carte, bottone('freccia', '▶', () => { suona('click'); vai((i + 1) % n); }, 'mzRulloDopo'));
    let x0: number | null = null;
    g.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    g.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { suona('click'); vai((i + (dx < 0 ? 1 : n - 1)) % n); } });
    return g;
  }
  /** Il rullo verticale (#271, Jack: «rulli che scorrono sopra e sotto»): la carta scelta in mezzo, le altre sopra e sotto; scorre con
   *  ▲ ▼, la rotella, il dito trascinato in su o in giù, i tasti. `tamburo` = le carte girano su un cilindro, come una slot machine.
   *  Il DOM resta: cambiando voce le carte scivolano (transizione CSS), non si ridisegna niente. */
  function rulloV<X extends { id: string }>(voci: X[], i0: number, carta: (x: X) => HTMLElement, cambia: (j: number) => void,
    o: { id: string; tamburo: boolean; titolo?: string; chiave?: string; due?: boolean }): Rullo {
    const n = voci.length, r = el('div', 'rv' + (o.tamburo ? ' tamburo' : '') + (o.due ? ' due' : '')); r.id = o.id;
    const tit = o.titolo ? el('div', 'rv-tit', o.titolo) : null;
    const fin = el('div', 'finestra'), nastro = el('div', 'nastro'); fin.appendChild(nastro);
    let i = i0;
    const kDi = (j: number) => { let k = j - i; if (k > n / 2) k -= n; if (k < -n / 2) k += n; if (n % 2 === 0 && k === n / 2) k = -k; return k; };
    const carte = voci.map((v, j) => {
      const c = bottone('vc', '', () => { if (j !== i) { suona('click'); vai(j); } }); c.dataset[o.chiave ?? 'id'] = v.id;
      const d = el('div', 'dentro'); d.appendChild(carta(v)); c.appendChild(d); nastro.appendChild(c);
      return c;
    });
    let kPrima = carte.map((_, j) => kDi(j));
    const posa = () => {
      carte.forEach((c, j) => {
        const k = kDi(j), ak = Math.abs(k);
        c.classList.toggle('salta', Math.abs(k - kPrima[j]!) > 1); // dal fondo alla cima: senza attraversare il rullo
        c.style.setProperty('--k', String(k)); c.style.setProperty('--ak', String(Math.min(ak, 3)));
        c.classList.toggle('on', k === 0); c.classList.toggle('via', ak > 2);
        kPrima[j] = k;
      });
    };
    function vai(j: number) { i = ((j % n) + n) % n; posa(); cambia(i); }
    posa();
    const su = bottone('freccia', '▲', () => { suona('click'); vai(i - 1); }), giu = bottone('freccia', '▼', () => { suona('click'); vai(i + 1); });
    let fermo = 0;
    fin.addEventListener('wheel', (e) => { e.preventDefault(); const t = performance.now(); if (t < fermo || Math.abs(e.deltaY) < 4) return; fermo = t + 170; suona('click'); vai(i + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
    let y0: number | null = null;
    fin.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
    fin.addEventListener('pointermove', (e) => { if (y0 === null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 36) { y0 = e.clientY; suona('click'); vai(i + (dy < 0 ? 1 : -1)); } });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fin.addEventListener(ev, () => { y0 = null; });
    r.append(...(tit ? [tit] : []), su, fin, giu);
    return { el: r, vai: (j) => vai(j), get i() { return i; }, fuoco: (on) => r.classList.toggle('fuoco', on) };
  }
  /** Le carte del rullo verticale: in riga (tracciato o icona a sinistra, nome e info a destra). */
  const vPista = (p: (typeof PISTE)[number]) => { const d = el('div', 'riga'), t = el('div', 'testo'); t.append(el('div', 'nome ombra', p.def.nome), el('div', 'info', `${giriDi(p.id)} · ${famDi(p.id).toUpperCase()}`)); d.append(tracciato(p.id, scuro()), t); return d; };
  const vVeicolo = (v: CVeicoloDef) => { const d = el('div', 'riga'), t = el('div', 'testo'); t.append(el('div', 'nome ombra', v.nome), el('div', 'info', CORSE.famiglie[v.famiglia].nome.toUpperCase())); d.append(el('div', 'icona', ICONA[v.id] ?? '🏁'), t); return d; };
  const cartaPista = (p: (typeof PISTE)[number], on: boolean) => {
    const c = bottone('carta' + (on ? ' on' : ''), '', () => {}), d = el('div', 'dentro');
    d.append(tracciato(p.id, scuro()), el('div', 'giri', giriDi(p.id)), el('div', 'nome ombra', p.def.nome));
    c.appendChild(d); return c;
  };
  const cartaVeicolo = (v: CVeicoloDef, on: boolean) => {
    const c = bottone('carta' + (on ? ' on' : ''), '', () => {}), d = el('div', 'dentro');
    d.append(el('div', 'icona', ICONA[v.id] ?? '🏁'), el('div', 'nome ombra', v.nome));
    c.appendChild(d); return c;
  };
  /** La scheda del veicolo: nome, famiglia, 4 statistiche a segmenti, frase; sotto le opzioni (se ci sono). */
  function scheda(v: CVeicoloDef, opz: HTMLElement | null) {
    const s = el('div', 'scheda');
    s.append(el('div', 'nome ombra', v.nome), el('div', 'fam', CORSE.famiglie[v.famiglia].nome.toUpperCase()));
    const st = el('div', 'stat');
    for (const x of STAT) {
      const tc = el('div', 'tacche'), q = tacche(v, x.k);
      for (let j = 1; j <= 5; j++) tc.appendChild(el('i', j <= q ? 'si' : ''));
      tc.dataset['tacche'] = String(q); st.append(el('span', 'ombra', x.nome), tc);
    }
    s.appendChild(st);
    if (v.buffo) s.appendChild(el('div', 'frase', `«${v.buffo}»`));
    if (opz) s.appendChild(opz);
    return s;
  }
  /** Dove sta il veicolo sullo schermo (frazione della larghezza, + = a destra): in mezzo allo spazio libero tra rulli e scheda. */
  const versoVeicolo = (): number => layout === 'giostra' ? -0.17 : layout === 'colonne' ? 0.27 : -0.06;

  /** `amici`: c'è anche «CON GLI AMICI» (risolve con `amici: '1'` e senza bot: la sala la apre chi usa il pannello). */
  function piste(s: Scelta, o: { titolo?: string; sottotitolo?: string; esci?: string; amici?: boolean } = {}) {
    return apri<Record<string, string>>('piste', (fine) => {
      let passo: 'pista' | 'veicolo' = 'pista', fuoco: 'pista' | 'veicolo' = 'pista';
      let rP: Rullo | null = null, rV: Rullo | null = null, testaEl: HTMLElement | null = null, schedaEl: HTMLElement | null = null;
      const parti = () => { s.veicolo = veicoloPer(s); salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: s.veicolo, bot: '1', oggetti: s.oggetti ? '1' : '0' }) }); };
      const amici = () => { s.veicolo = veicoloPer(s); salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: s.veicolo, bot: '0' }), amici: '1' }); };
      const x = bottone('chiudi', '✕', () => fine(null), 'mzGpEsciMenu'); x.title = o.esci ?? 'Torna all’isola';
      const ip = () => Math.max(0, PISTE.findIndex((p) => p.id === s.pista));
      const iv = () => Math.max(0, veicoliDi(s.pista).findIndex((v) => v.id === s.veicolo));
      const opzioni = () => {
        const opz = el('div', 'opz');
        const gruppo = (nome: string, voci: { id: string; nome: string; on: boolean; fai: () => void }[]) => {
          const r = el('div');
          for (const v of voci) { const b = bottone(v.on ? 'on' : '', v.nome, () => { suona('click'); v.fai(); salvaScelta(s); aggiorna(); }); b.dataset['id'] = v.id; r.appendChild(b); }
          opz.append(el('span', 'ombra', nome), r);
        };
        gruppo('OGGETTI', [{ id: 'ogg_si', nome: '🎁 sì', on: s.oggetti, fai: () => { s.oggetti = true; } }, { id: 'ogg_no', nome: 'guida pura', on: !s.oggetti, fai: () => { s.oggetti = false; } }]);
        gruppo('GAS', [{ id: 'gas_man', nome: 'in mano', on: !s.gasAuto, fai: () => { s.gasAuto = false; } }, { id: 'gas_auto', nome: 'automatico', on: s.gasAuto, fai: () => { s.gasAuto = true; } }]);
        gruppo('CAMERA', CAMERE.map((c) => ({ id: c.id, nome: c.nome, on: c.id === s.cam, fai: () => { s.cam = c.id; } })));
        return opz;
      };
      /** Cosa si vede dietro e nella scheda: dipende dal passo (o, a due colonne, dalla colonna col fuoco). */
      const suVeicolo = () => (layout === 'colonne' ? fuoco === 'veicolo' : passo === 'veicolo');
      /** Dopo una scelta: testa, scheda e palco, senza toccare i rulli (che scivolano da soli). */
      function aggiorna() {
        s.veicolo = veicoloPer(s);
        const sotto = `${giriDi(s.pista).toLowerCase()} · ${famDi(s.pista)}${suVeicolo() ? '' : ` · ${o.sottotitolo ?? 'Isola delle Corse'}`}`;
        const nt = layout === 'colonne' ? testa(0, CORSE_PISTE[s.pista]!.nome, sotto) : testa(passo === 'pista' ? 1 : 2, CORSE_PISTE[s.pista]!.nome, sotto, () => { passo = passo === 'pista' ? 'veicolo' : 'pista'; costruisci(); });
        testaEl?.replaceWith(nt); testaEl = nt;
        const ns = suVeicolo() ? scheda(veicoliDi(s.pista)[iv()]!, layout === 'colonne' ? null : opzioni()) : el('div');
        if (layout === 'colonne') ns.classList.add('corta'); // a due colonne non c'è posto: solo i numeri (oggetti, gas e camera restano come l'ultima volta)
        if (schedaEl) schedaEl.replaceWith(ns); else sc.appendChild(ns);
        schedaEl = ns;
        if (suVeicolo()) palco?.veicolo(s.veicolo, s.pista, versoVeicolo()); else palco?.pista(s.pista);
      }
      const rulloVeicoli = (due = false) => rulloV(veicoliDi(s.pista), iv(), vVeicolo, (j) => { s.veicolo = veicoliDi(s.pista)[j]!.id; salvaScelta(s); fuoco = 'veicolo'; segnaFuoco(); aggiorna(); },
        { id: 'mzRulloVeicoli', tamburo: layout === 'tamburo', titolo: layout === 'colonne' ? 'VEICOLO' : undefined, due });
      const segnaFuoco = () => { rP?.fuoco(fuoco === 'pista'); rV?.fuoco(fuoco === 'veicolo'); };
      function costruisci() {
        testaEl = null; schedaEl = null; rP = null; rV = null;
        if (layout === 'giostra') { giostraVecchia(); return; }
        const giu = el('div', 'giu box'), bot = el('div', 'bottoni'); giu.append(el('div', 'spazio'), bot);
        if (layout === 'colonne') {
          rP = rulloV(PISTE, ip(), vPista, (j) => {
            const fam = veicoliDi(s.pista).map((v) => v.id).join();
            s.pista = PISTE[j]!.id; salvaScelta(s); fuoco = 'pista';
            if (veicoliDi(s.pista).map((v) => v.id).join() !== fam) { s.veicolo = veicoloPer(s); const nv = rulloVeicoli(true); rV?.el.replaceWith(nv.el); rV = nv; } // un'altra famiglia: un altro rullo
            segnaFuoco(); aggiorna();
          }, { id: 'mzRulloPiste', tamburo: false, titolo: 'PISTA' });
          rV = rulloVeicoli(true);
          rP.el.addEventListener('pointerdown', () => { if (fuoco !== 'pista') { fuoco = 'pista'; segnaFuoco(); aggiorna(); } });
          rV.el.addEventListener('pointerdown', () => { if (fuoco !== 'veicolo') { fuoco = 'veicolo'; segnaFuoco(); aggiorna(); } });
          bot.append(grande('', 'VIA!', parti, 'mzGpVia'), ...(o.amici ? [grande('blu', '👥 CON GLI AMICI', amici, 'mzGpAmici')] : []));
          sc.replaceChildren(x, rP.el, rV.el, giu, ...(tocco ? [] : [aiuto('<b>▲</b><b>▼</b> scegli · <b>◀</b><b>▶</b> colonna · <b>Invio</b> VIA · <b>Esc</b> esci · <b>M</b> colori · <b>V</b> rulli')]));
          segnaFuoco();
        } else if (passo === 'pista') {
          rP = rulloV(PISTE, ip(), vPista, (j) => { s.pista = PISTE[j]!.id; salvaScelta(s); aggiorna(); }, { id: 'mzRulloPiste', tamburo: layout === 'tamburo' });
          bot.append(grande('', 'AVANTI ▶', () => { suona('click'); passo = 'veicolo'; costruisci(); }, 'mzGpAvanti'), ...(o.amici ? [grande('blu', '👥 CON GLI AMICI', amici, 'mzGpAmici')] : []));
          sc.replaceChildren(x, rP.el, giu, ...(tocco ? [] : [aiuto('<b>▲</b><b>▼</b> scegli · <b>Invio</b> avanti · <b>Esc</b> esci · <b>M</b> colori · <b>V</b> rulli')]));
        } else {
          rV = rulloVeicoli();
          bot.append(grande('', 'VIA!', parti, 'mzGpVia'));
          sc.replaceChildren(x, rV.el, giu, ...(tocco ? [] : [aiuto('<b>▲</b><b>▼</b> veicolo · <b>Invio</b> VIA · <b>Esc</b> indietro · <b>M</b> colori · <b>V</b> rulli')]));
        }
        sc.appendChild((testaEl = el('div'))); aggiorna();
      }
      /** La prima prova (giostra orizzontale), tenuta per il confronto: ridisegna tutto a ogni scelta. */
      function giostraVecchia() {
        const giu = el('div', 'giu box'), bot = el('div', 'bottoni');
        if (passo === 'pista') {
          giu.append(giostra(PISTE, ip(), cartaPista, (j) => { s.pista = PISTE[j]!.id; salvaScelta(s); costruisci(); }), bot);
          bot.append(grande('', 'AVANTI ▶', () => { suona('click'); passo = 'veicolo'; costruisci(); }, 'mzGpAvanti'), ...(o.amici ? [grande('blu', '👥 CON GLI AMICI', amici, 'mzGpAmici')] : []));
          sc.replaceChildren(x, giu);
        } else {
          const vv = veicoliDi(s.pista);
          giu.append(giostra(vv, iv(), cartaVeicolo, (j) => { s.veicolo = vv[j]!.id; salvaScelta(s); costruisci(); }), bot);
          bot.append(grande('', 'VIA!', parti, 'mzGpVia'));
          sc.replaceChildren(x, giu);
        }
        sc.appendChild((testaEl = el('div'))); aggiorna();
      }
      const scorriV = (d: number) => {
        if (layout === 'giostra') { (document.getElementById(d < 0 ? 'mzRulloPrima' : 'mzRulloDopo') as HTMLButtonElement | null)?.click(); return; }
        const r = layout === 'colonne' ? (fuoco === 'pista' ? rP : rV) : passo === 'pista' ? rP : rV;
        r?.vai(r.i + d);
      };
      tasti = {
        invio: () => { if (layout !== 'colonne' && passo === 'pista') { passo = 'veicolo'; costruisci(); } else parti(); },
        indietro: () => { if (layout === 'colonne' || passo !== 'veicolo') return false; passo = 'pista'; costruisci(); return true; },
        scorri: scorriV,
        lato: (d) => { if (layout === 'colonne') { fuoco = d < 0 ? 'pista' : 'veicolo'; segnaFuoco(); aggiorna(); } else scorriV(d); },
        via: parti, ridisegna: () => costruisci(),
      };
      costruisci();
    });
  }

  function garage(attuale: string) {
    return apri<string>('garage', (fine) => {
      const V = CORSE.veicoli;
      let i = Math.max(0, V.findIndex((v) => v.id === attuale)), schedaEl: HTMLElement | null = null, r: Rullo | null = null, ok: HTMLElement | null = null;
      const aggiorna = () => {
        const ns = scheda(V[i]!, null); if (schedaEl) schedaEl.replaceWith(ns); else sc.appendChild(ns); schedaEl = ns;
        const nok = grande('', 'PRENDI ▶', () => { suona('click'); fine(V[i]!.id); }, 'mzGarageOk'); ok?.replaceWith(nok); ok = nok;
        palco?.veicolo(V[i]!.id, PISTE[0]!.id, versoVeicolo());
      };
      const costruisci = () => {
        schedaEl = null;
        const giu = el('div', 'giu box'), bot = el('div', 'bottoni'); ok = el('div'); bot.appendChild(ok);
        if (layout === 'giostra') {
          giu.append(giostra(V, i, cartaVeicolo, (j) => { i = j; costruisci(); }, 'veicolo'), bot); giu.id = 'mzGarage'; r = null;
          sc.replaceChildren(testa(0, 'GARAGE', 'con cosa giri l’isola'), bottone('chiudi', '✕', () => fine(null), 'mzGarageEsci'), giu);
        } else {
          r = rulloV(V, i, vVeicolo, (j) => { i = j; aggiorna(); }, { id: 'mzGarage', tamburo: layout === 'tamburo', chiave: 'veicolo' });
          giu.append(el('div', 'spazio'), bot);
          sc.replaceChildren(testa(0, 'GARAGE', 'con cosa giri l’isola (se la pista vuole barche o ruote, la gara lo cambia da sola)'), bottone('chiudi', '✕', () => fine(null), 'mzGarageEsci'), r.el, giu);
        }
        aggiorna();
      };
      tasti = {
        invio: () => fine(V[i]!.id), indietro: () => false, via: () => fine(V[i]!.id), ridisegna: () => costruisci(),
        scorri: (d) => { if (r) r.vai(r.i + d); else { i = (i + V.length + d) % V.length; costruisci(); } },
        lato: (d) => { if (r) r.vai(r.i + d); else { i = (i + V.length + d) % V.length; costruisci(); } },
      };
      costruisci();
    });
  }

  // ▲ ▼ (e W S) scorrono il rullo, ◀ ▶ (e A D) cambiano colonna o scorrono; M cambia i colori, V i rulli (prove A/B di Jack)
  addEventListener('keydown', (e) => {
    if (!tasti || e.metaKey || e.ctrlKey) return;
    if (e.code === 'KeyM' && !e.repeat) {
      pelle = pelle === 'a' ? 'b' : 'a'; sc.classList.toggle('b', pelle === 'b');
      try { localStorage.setItem(PELLE_KEY, pelle); } catch { /* niente */ }
      tasti.ridisegna(); return;
    }
    if (e.code === 'KeyV' && !e.repeat) {
      layout = LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length]!;
      try { localStorage.setItem(LAYOUT_KEY, layout); } catch { /* niente */ }
      tasti.ridisegna(); return;
    }
    const v = e.code === 'ArrowUp' || e.code === 'KeyW' ? -1 : e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : 0;
    const h = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
    if (v) { e.preventDefault(); suona('click'); tasti.scorri(v); }
    else if (h) { e.preventDefault(); suona('click'); tasti.lato(h); }
  });

  return {
    el: sc, piste, garage,
    chiudi: () => chiudi?.(null),
    via: () => tasti?.via(),
    invio: () => tasti?.invio(),
    indietro: () => tasti?.indietro() ?? false,
    aperto: () => tipo,
  };
}
