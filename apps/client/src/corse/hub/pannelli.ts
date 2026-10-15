// I pannelli delle Corse (#173, #185), in comune tra il gioco (`corse/index.ts`) e il banco di prova dell'hub (`hub/prova.ts`).
// Menù di scelta (#271, 13 ott 2026). Il look l'ha scelto Jack tra quattro schermate fatte con ChatGPT: la 1, alla Mario Kart 8
// (`assets/concept/corse/menu_scelta_veicolo_mariokart.jpg`), rifatta fedele («sono diversissime dalle reference» sulla prima prova):
// fascia blu inclinata col titolo bianco e la bandiera a scacchi, colonna azzurra con le carte (solo la foto del veicolo; la scelta ha la
// cornice gialla che brilla e la freccia, le altre sono più trasparenti), pannello a vetro blu con la fascia del nome e le barre grosse
// colorate con l'icona, VIA giallo enorme, pedana di pietra con l'anello a scacchi bianco e blu. Carattere Titan One
// (`public/assets/fonts`, OFL). Le misure sono quelle dell'immagine (1672×941) in `--u` (1 pixel dell'immagine): telefono e PC hanno la
// stessa composizione. Non lo stile marrone e giallo del resto di MAREA (mai approvato).
// - Alla porta due passi: la pista (dietro, la pista vera sorvolata piano: `palco.ts`), poi il veicolo della famiglia della pista (sulla
//   pedana, con l'avatar al volante). Invio = avanti / VIA, Esc = indietro (dal primo: esce). Il garage: tutti i veicoli.
// - La lista scorre su e giù (rotella, dito, frecce o W S); le foto dei veicoli le fa il palco dai modelli veri (`palco.foto`).
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

/** Statistiche: colore e icona come nella schermata scelta. */
const STAT: { k: 'velocita' | 'accelerazione' | 'sterzo' | 'peso'; nome: string; colore: string; icona: string }[] = [
  { k: 'velocita', nome: 'VELOCITÀ', colore: '#FF4D6D', icona: '<svg viewBox="0 0 24 24"><path d="M3.5 17.5a8.5 8.5 0 1 1 17 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 17l5.2-6.2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="17" r="2" fill="currentColor"/></svg>' },
  { k: 'accelerazione', nome: 'SCATTO', colore: '#55E05A', icona: '<svg viewBox="0 0 24 24"><path d="M3 4.5l7.5 7.5L3 19.5M11.5 4.5L19 12l-7.5 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/></svg>' },
  { k: 'sterzo', nome: 'STERZO', colore: '#2FC7F5', icona: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M3.6 11h16.8M12 14v6.5" stroke="currentColor" stroke-width="3"/></svg>' },
  { k: 'peso', nome: 'PESO', colore: '#C05BFF', icona: '<svg viewBox="0 0 24 24"><path d="M5.5 9h13l2.3 11.5H3.2z" fill="currentColor"/><circle cx="12" cy="5.6" r="2.7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>' },
];
/** 1..5 tacche, rispetto agli altri veicoli della stessa specie (i carrelli dei binari tra loro, il resto tra sé: lo sterzo dei carrelli è
 *  quanto in fretta si piegano, non si confronta col volante). */
export function tacche(v: CVeicoloDef, k: (typeof STAT)[number]['k']): number {
  const simili = CORSE.veicoli.filter((x) => (x.famiglia === 'binari') === (v.famiglia === 'binari'));
  const mn = Math.min(...simili.map((x) => x[k])), mx = Math.max(...simili.map((x) => x[k]));
  return mx > mn ? 1 + Math.round((4 * (v[k] - mn)) / (mx - mn)) : 3;
}
/** Due righe per pista, nel pannello (come la descrizione del veicolo). */
const DESCR: Record<string, string> = {
  spiaggia_lungomare: 'Rettilineo sul mare, tornante intorno al faro e un salto sul canale. Dal 3° giro l’onda copre mezza strada.',
  spiaggia_baia: 'Tutta in acqua: onde, corrente e uno stretto tra gli scogli. Dal 2° giro sale la marea e la secca si taglia.',
  spiaggia_porto: 'Molo e canale affiancati: ruote da una parte, barche dall’altra. Dal 2° giro le gru calano i container.',
};
const ICONA: Record<string, string> = { kart: '🏎️', auto: '🚗', carrello: '🛒', moto_acqua: '🚤', gommone: '🛟', vasca: '🛁', fuoristrada: '🚙', moto: '🏍️', bob: '🛷', divano: '🛋️', ape: '🛺', struzzo: '🦤', pizza: '🍕', papera: '🦆', carrello_miniera: '⛏️', carrello_corsa: '🏁', carrello_corazzato: '🛡️' };
const giriDi = (id: string) => { const d = CORSE_PISTE[id]!; return d.tipo === 'fuga' ? 'FUGA' : `${d.giri} GIRI`; };
const famDi = (id: string) => famiglieDi(CORSE_PISTE[id]!).map((f) => CORSE.famiglie[f].nome).join(' + ');
/** Il tracciato visto dall'alto, bianco col bordo scuro. */
function tracciato(id: string, W = 120, H = 78): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
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
  g.strokeStyle = PAL.abisso; g.lineWidth = 7; traccia();
  g.strokeStyle = '#FFFFFF'; g.lineWidth = 3.5; traccia();
  const iv = Math.round(p.def.via / p.n.passo) % p.n.n, vx = ox + (p.n.x[iv]! - x0) * k, vz = oz + (p.n.z[iv]! - z0) * k;
  g.fillStyle = PAL.abisso; g.fillRect(vx - 4, vz - 4, 8, 8); g.fillStyle = PAL.giallo; g.fillRect(vx - 2.5, vz - 2.5, 5, 5);
  return c;
}

const CSS = `
@font-face { font-family: 'MzTitan'; src: url('/assets/fonts/titan-one-latin.woff2') format('woff2'); font-display: swap; }
.mz-gp-sc { --u: calc(min(100vh, 56.25vw) / 941); position: absolute; inset: 0; z-index: 30; display: none; pointer-events: none; color: #fff; -webkit-user-select: none; user-select: none; }
@supports (height: 100dvh) { .mz-gp-sc { --u: calc(min(100dvh, 56.25vw) / 941); } }
.mz-gp-sc.on { display: block; }
.mz-gp-sc.velo { background: rgba(22,63,115,.55); }
.mz-gp-sc button { pointer-events: auto; cursor: pointer; -webkit-tap-highlight-color: transparent; color: inherit; font: inherit; margin: 0; padding: 0; border: none; background: none; }
.mz-gp-sc .rv { position: absolute; display: flex; flex-direction: column; align-items: stretch; pointer-events: auto; }
.mz-gp-sc .rv .finestra { position: relative; flex: 1; overflow: hidden; touch-action: none; }
.mz-gp-sc .rv .vc { --k: 0; --ak: 0; position: absolute; left: 0; right: 0; top: 50%; height: var(--h); text-align: left;
  transform: translateY(calc(-50% + var(--k) * var(--p))); z-index: calc(10 - var(--ak)); transition: transform .26s cubic-bezier(.2, .9, .3, 1.15); }
.mz-gp-sc .rv .vc.salta { transition: none; }
.mz-gp-sc .rv .vc.via { visibility: hidden; }
.mz-gp-sc .rv .su, .mz-gp-sc .rv .giu { flex: none; height: calc(34 * var(--u)); min-height: 18px; font-size: max(13px, calc(26 * var(--u))); line-height: 1; }
.mz-gp-sc .foto img, .mz-gp-sc .foto canvas { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
.mz-gp-sc .foto span { font-size: calc(70 * var(--u)); }
.mz-gp-sc .tacche { display: flex; }
.mz-gp-sc .opzbox { position: absolute; display: grid; grid-template-columns: auto 1fr; align-items: center; pointer-events: auto; }
.mz-gp-sc .opzbox > div { display: flex; flex-wrap: wrap; }
.mz-gp-sc .passi { position: absolute; display: flex; pointer-events: auto; }
.mz-gp-sc .destra { position: absolute; right: calc(30 * var(--u)); top: calc(175 * var(--u)); width: calc(420 * var(--u)); display: flex; flex-direction: column; gap: calc(14 * var(--u)); pointer-events: none; }
.mz-gp-sc .destra > * { pointer-events: auto; }

.mz-gp-sc.kart { font-family: 'MzTitan', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif; --navy: #12306e; }
.mz-gp-sc.kart .contorno { -webkit-text-stroke: calc(7 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-gp-sc.kart .titolo { position: absolute; left: calc(45 * var(--u)); top: calc(42 * var(--u)); height: calc(82 * var(--u)); width: calc(760 * var(--u)); display: flex; align-items: center; padding-left: calc(55 * var(--u));
  background: linear-gradient(90deg, #2a7ff0 0%, #1d63d6 55%, rgba(29,99,214,.0) 100%); transform: skewX(-14deg); box-shadow: inset 0 calc(-6 * var(--u)) 0 rgba(0,0,0,.18); }
.mz-gp-sc.kart .titolo::after { content: ''; position: absolute; right: calc(40 * var(--u)); top: 0; bottom: 0; width: calc(130 * var(--u));
  background: conic-gradient(#6fd0ff 25%, #1d63d6 0 50%, #6fd0ff 0 75%, #1d63d6 0) 0 0 / calc(40 * var(--u)) calc(40 * var(--u)); -webkit-mask: linear-gradient(90deg, #000, transparent); mask: linear-gradient(90deg, #000, transparent); }
.mz-gp-sc.kart .titolo h2 { margin: 0; transform: skewX(14deg); font-style: italic; font-weight: 400; font-size: calc(62 * var(--u)); letter-spacing: .01em; text-transform: uppercase; white-space: nowrap; }
.mz-gp-sc.kart .passi { left: calc(830 * var(--u)); top: calc(62 * var(--u)); gap: calc(10 * var(--u)); }
.mz-gp-sc.kart .passi button { padding: calc(6 * var(--u)) calc(22 * var(--u)); transform: skewX(-14deg); border-radius: calc(8 * var(--u)); background: rgba(18,48,110,.8); border: calc(3 * var(--u)) solid rgba(255,255,255,.75); font-size: max(10px, calc(22 * var(--u))); }
.mz-gp-sc.kart .passi button > i { display: block; transform: skewX(14deg); font-style: italic; }
.mz-gp-sc.kart .passi button.on { background: #ffd93a; color: var(--navy); border-color: #fff; }
.mz-gp-sc.kart .chiudi { position: absolute; right: calc(36 * var(--u)); top: calc(42 * var(--u)); width: max(36px, calc(70 * var(--u))); height: max(36px, calc(70 * var(--u))); border-radius: 50%; background: #fff; color: var(--navy); border: calc(6 * var(--u)) solid var(--navy); font-size: max(16px, calc(34 * var(--u))); box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,.3); }
.mz-gp-sc.kart .rv { --h: calc(140 * var(--u)); --p: calc(163 * var(--u)); left: 0; top: calc(135 * var(--u)); width: calc(385 * var(--u)); height: calc(695 * var(--u)); padding: calc(6 * var(--u)) calc(22 * var(--u)) calc(6 * var(--u)) calc(66 * var(--u)); box-sizing: border-box;
  background: rgba(110,180,235,.35); border: calc(3 * var(--u)) solid rgba(200,235,255,.55); border-left: none; border-radius: 0 calc(18 * var(--u)) calc(18 * var(--u)) 0; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.mz-gp-sc.kart .rv .su, .mz-gp-sc.kart .rv .giu { color: #fff; text-shadow: 0 2px 0 var(--navy); opacity: .85; }
.mz-gp-sc.kart .rv .vc { opacity: calc(1 - .42 * var(--ak)); transition: transform .26s cubic-bezier(.2, .9, .3, 1.15), opacity .2s; border-radius: calc(16 * var(--u)); background: rgba(170,215,245,.62); border: calc(3 * var(--u)) solid rgba(255,255,255,.7); box-shadow: inset 0 calc(4 * var(--u)) 0 rgba(255,255,255,.35); }
.mz-gp-sc.kart .rv .vc.on { opacity: 1; background: #5cc9f6; border: calc(6 * var(--u)) solid #ffe34d; box-shadow: 0 0 calc(24 * var(--u)) calc(6 * var(--u)) rgba(255,224,70,.85), inset 0 calc(5 * var(--u)) 0 rgba(255,255,255,.4); }
.mz-gp-sc.kart .rv .vc.on::before { content: ''; position: absolute; left: calc(-40 * var(--u)); top: 50%; margin-top: calc(-18 * var(--u)); border: calc(18 * var(--u)) solid transparent; border-left: calc(26 * var(--u)) solid #ffe34d; filter: drop-shadow(0 0 calc(6 * var(--u)) rgba(255,224,70,.9)); }
.mz-gp-sc.kart .riga { position: absolute; inset: calc(6 * var(--u)); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mz-gp-sc.kart .riga .foto { flex: 1; width: 100%; min-height: 0; display: flex; align-items: center; justify-content: center; }
.mz-gp-sc.kart .riga .testo { display: none; }
.mz-gp-sc.kart .riga.pista .testo { display: block; text-align: center; font-style: italic; font-size: calc(24 * var(--u)); line-height: 1.05; text-transform: uppercase; }
.mz-gp-sc.kart .riga.pista .testo .info { display: none; }
.mz-gp-sc.kart .scheda { position: relative; padding: calc(14 * var(--u)) calc(18 * var(--u)) calc(24 * var(--u)); box-sizing: border-box; pointer-events: auto;
  background: rgba(30,80,160,.5); border: calc(3 * var(--u)) solid rgba(150,210,255,.6); border-radius: calc(20 * var(--u)); -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px); }
.mz-gp-sc.kart .scheda .testa { margin: 0 0 calc(18 * var(--u)); height: calc(72 * var(--u)); display: flex; align-items: center; padding: 0 calc(26 * var(--u)); background: linear-gradient(#1f4fae, #12306e); border: calc(3 * var(--u)) solid rgba(255,255,255,.85); border-radius: calc(12 * var(--u)); transform: skewX(-10deg); box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,.3); }
.mz-gp-sc.kart .scheda .testa > div { transform: skewX(10deg); font-style: italic; font-size: calc(46 * var(--u)); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-text-stroke: calc(6 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-gp-sc.kart .scheda .fam { display: none; }
.mz-gp-sc.kart .scheda .descr { font-family: system-ui, -apple-system, sans-serif; font-weight: 800; font-size: max(10px, calc(20 * var(--u))); line-height: 1.3; margin: 0 calc(6 * var(--u)) calc(14 * var(--u)); text-shadow: 0 1px 0 var(--navy); }
.mz-gp-sc.kart .stat { display: grid; grid-template-columns: calc(72 * var(--u)) 1fr; grid-auto-rows: calc(80 * var(--u)); align-items: center; }
.mz-gp-sc.kart .scheda .testa.lungo > div { font-size: calc(34 * var(--u)); } .mz-gp-sc.kart .scheda .testa.lunghissimo > div { font-size: calc(26 * var(--u)); }
.mz-gp-sc.kart .stat .ic { grid-row: span 1; width: calc(58 * var(--u)); height: calc(58 * var(--u)); }
.mz-gp-sc.kart .stat .ic svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 calc(3 * var(--u)) 0 rgba(0,0,0,.35)); }
.mz-gp-sc.kart .stat .col { display: flex; flex-direction: column; gap: calc(8 * var(--u)); }
.mz-gp-sc.kart .stat .col > b { font-weight: 400; font-style: italic; font-size: calc(24 * var(--u)); letter-spacing: .02em; -webkit-text-stroke: calc(5 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-gp-sc.kart .tacche { gap: calc(8 * var(--u)); }
.mz-gp-sc.kart .tacche i { width: calc(56 * var(--u)); height: calc(22 * var(--u)); transform: skewX(-18deg); border-radius: calc(5 * var(--u)); background: rgba(10,30,75,.75); }
.mz-gp-sc.kart .tacche i.si { background: linear-gradient(color-mix(in srgb, var(--c) 70%, #fff), var(--c) 55%); box-shadow: 0 0 calc(8 * var(--u)) color-mix(in srgb, var(--c) 60%, transparent); }
.mz-gp-sc.kart .grande-mappa { display: block; margin: 0 auto calc(12 * var(--u)); width: calc(300 * var(--u)); height: calc(195 * var(--u)); }
.mz-gp-sc.kart .opzbox { position: fixed; left: calc(30 * var(--u)); bottom: calc(26 * var(--u)); gap: calc(6 * var(--u)) calc(12 * var(--u)); font-style: italic; font-size: max(9px, calc(18 * var(--u))); }
.mz-gp-sc.kart .opzbox { grid-template-columns: repeat(6, auto); }
.mz-gp-sc.kart .opzbox > span { -webkit-text-stroke: calc(4 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-gp-sc.kart .opzbox > div { gap: calc(6 * var(--u)); }
.mz-gp-sc.kart .opzbox button { min-height: max(24px, calc(44 * var(--u))); padding: 0 calc(16 * var(--u)); border-radius: calc(22 * var(--u)); background: rgba(18,48,110,.75); border: calc(3 * var(--u)) solid rgba(255,255,255,.6); font-size: max(10px, calc(18 * var(--u))); }
.mz-gp-sc.kart .opzbox button.on { background: #ffd93a; color: var(--navy); border-color: #fff; }
.mz-gp-sc.kart .vai { position: absolute; right: calc(48 * var(--u)); bottom: calc(76 * var(--u)); width: calc(360 * var(--u)); height: calc(148 * var(--u)); display: flex; align-items: center; justify-content: center; gap: calc(26 * var(--u));
  border-radius: calc(44 * var(--u)); transform: skewX(-8deg); background: linear-gradient(#fff07a 0%, #ffd21c 45%, #ffaa00 100%); border: calc(6 * var(--u)) solid #fff3b0;
  box-shadow: 0 0 calc(34 * var(--u)) calc(10 * var(--u)) rgba(255,205,40,.7), inset 0 calc(-12 * var(--u)) 0 rgba(210,120,0,.35), 0 calc(8 * var(--u)) 0 rgba(0,0,0,.25);
  color: var(--navy); font-style: italic; font-size: calc(92 * var(--u)); line-height: 1; -webkit-text-stroke: calc(4 * var(--u)) #fff8d0; paint-order: stroke fill; }
.mz-gp-sc.kart .vai.lungo { font-size: calc(58 * var(--u)); }
.mz-gp-sc.kart .vai > i { transform: skewX(8deg); font-style: italic; }
.mz-gp-sc.kart .vai > b { font-weight: 400; font-size: .8em; transform: skewX(8deg); }
.mz-gp-sc.kart .vai:active { transform: skewX(-8deg) translateY(calc(5 * var(--u))); }
.mz-gp-sc.kart .amici { position: absolute; right: calc(60 * var(--u)); bottom: calc(244 * var(--u)); min-height: max(30px, calc(58 * var(--u))); padding: 0 calc(26 * var(--u)); border-radius: calc(30 * var(--u)); background: linear-gradient(#5fd0ff, #1d8fe0); border: calc(4 * var(--u)) solid #fff; box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,.3);
  font-style: italic; font-size: max(12px, calc(26 * var(--u))); -webkit-text-stroke: calc(4 * var(--u)) var(--navy); paint-order: stroke fill; }

body.mz-rulli #joystick, body.mz-rulli .btn, body.mz-rulli #btnA, body.mz-rulli #btnB, body.mz-rulli #mzGpGas, body.mz-rulli .mz-hub-esci, body.mz-rulli .mz-hub-barca,
body.mz-rulli .mz-hub-v, body.mz-rulli .mz-hub-tag, body.mz-rulli .mz-hub-mappa, body.mz-rulli #mzHubMsg { display: none !important; }
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
  /** Invio: dalla pista si passa ai veicoli, dai veicoli si parte; nel garage si prende il veicolo. */
  invio(): void;
  /** Esc: dai veicoli si torna alla pista (true); altrimenti false (chi chiama chiude). */
  indietro(): boolean;
  aperto(): 'piste' | 'garage' | null;
  readonly el: HTMLElement;
};
type Rullo = { el: HTMLElement; vai(j: number): void; readonly i: number };

export function creaPannelli(root: HTMLElement, palco: Palco | null = null): Pannelli {
  if (!document.getElementById('mz-gp-sc-style')) { const st = document.createElement('style'); st.id = 'mz-gp-sc-style'; st.textContent = CSS; document.head.appendChild(st); }
  const sc = el('div', 'mz-gp-sc'); sc.id = 'mzGpIntro';
  for (const ev of ['pointerdown', 'touchstart']) sc.addEventListener(ev, (e) => e.stopPropagation());
  root.appendChild(sc);
  if (!palco) sc.classList.add('velo'); // senza palco (niente 3D dietro) si vela lo schermo
  sc.classList.add('kart');
  let chiudi: ((v: unknown) => void) | null = null, tipo: 'piste' | 'garage' | null = null;
  /** I tasti del pannello aperto: Invio, Esc (true = gestito), su e giù. */
  let tasti: { invio(): void; indietro(): boolean; scorri(d: number): void; via(): void } | null = null;
  const apri = <T,>(t: 'piste' | 'garage', disegna: (fine: (v: T | null) => void) => void) => new Promise<T | null>((resolve) => {
    chiudi?.(null);
    tipo = t;
    const fine = (v: T | null) => { if (chiudi !== fine) return; chiudi = null; tipo = null; tasti = null; sc.classList.remove('on'); palco?.spegni(); document.body.classList.remove('mz-rulli'); resolve(v); };
    chiudi = fine as (v: unknown) => void;
    disegna(fine); sc.classList.add('on');
    if (palco) document.body.classList.add('mz-rulli'); // davanti al palco i comandi dell'hub (joystick, bottoni, minimappa, cartelli) non servono
  });
  const bottone = (cls: string, testo: string, fai: () => void, id?: string) => { const b = el('button', cls, testo) as HTMLButtonElement; b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fai); return b; };
  const titolo = (testo: string) => { const t = el('div', 'titolo'); t.appendChild(el('h2', 'contorno', testo)); return t; };
  /** I due passi (si toccano per andare avanti e indietro). */
  const passi = (passo: 1 | 2, vai: () => void) => {
    const ps = el('div', 'passi');
    for (const [n, x, id] of [[1, '1 · PISTA', 'mzGpIndietro'], [2, '2 · VEICOLO', 'mzGpPasso2']] as const) {
      const b = bottone(n === passo ? 'on' : '', '', () => { if (n !== passo) { suona('click'); vai(); } }, id); b.appendChild(el('i', '', x)); ps.appendChild(b);
    }
    return ps;
  };
  /** Il VIA giallo (anche AVANTI e PRENDI). La classe `box` serve ai test (deve stare nello schermo del telefono). */
  const vai = (testo: string, fai: () => void, id: string) => { const b = bottone('vai box' + (testo.length > 4 ? ' lungo' : ''), '', fai, id); b.append(el('i', '', testo), el('b', '', '›')); return b; };
  /** La lista: un rullo che scorre su e giù, la carta scelta nel mezzo; rotella, dito, ▲ ▼, tasti. Il DOM resta: le carte scivolano. */
  function rullo<X extends { id: string }>(voci: X[], i0: number, carta: (x: X) => HTMLElement, cambia: (j: number) => void, o: { id: string; chiave?: string }): Rullo {
    const n = voci.length, r = el('div', 'rv'); r.id = o.id;
    const fin = el('div', 'finestra');
    let i = i0;
    const kDi = (j: number) => { let k = j - i; if (k > n / 2) k -= n; if (k < -n / 2) k += n; if (n % 2 === 0 && k === n / 2) k = -k; return k; };
    const carte = voci.map((v, j) => {
      const c = bottone('vc', '', () => { if (j !== i) { suona('click'); vai(j); } }); c.dataset[o.chiave ?? 'id'] = v.id;
      c.appendChild(carta(v)); fin.appendChild(c);
      return c;
    });
    const kPrima = carte.map((_, j) => kDi(j));
    const posa = () => carte.forEach((c, j) => {
      const k = kDi(j), ak = Math.abs(k);
      c.classList.toggle('salta', Math.abs(k - kPrima[j]!) > 1); // dal fondo alla cima: senza attraversare la lista
      c.style.setProperty('--k', String(k)); c.style.setProperty('--ak', String(Math.min(ak, 3)));
      c.classList.toggle('on', k === 0); c.classList.toggle('via', ak > 3);
      kPrima[j] = k;
    });
    function vai(j: number) { i = ((j % n) + n) % n; posa(); cambia(i); }
    posa();
    let fermo = 0, y0: number | null = null;
    fin.addEventListener('wheel', (e) => { e.preventDefault(); const t = performance.now(); if (t < fermo || Math.abs(e.deltaY) < 4) return; fermo = t + 170; suona('click'); vai(i + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
    fin.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
    fin.addEventListener('pointermove', (e) => { if (y0 === null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 36) { y0 = e.clientY; suona('click'); vai(i + (dy < 0 ? 1 : -1)); } });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fin.addEventListener(ev, () => { y0 = null; });
    r.append(bottone('su', '▲', () => { suona('click'); vai(i - 1); }, o.id + 'Su'), fin, bottone('giu', '▼', () => { suona('click'); vai(i + 1); }, o.id + 'Giu'));
    return { el: r, vai, get i() { return i; } };
  }
  /** Le carte: la foto (il tracciato, o il veicolo vero fotografato dal palco) e il nome. */
  const cartaPista = (p: (typeof PISTE)[number]) => {
    const d = el('div', 'riga pista'), f = el('div', 'foto'), t = el('div', 'testo');
    f.appendChild(tracciato(p.id, 200, 110)); t.append(el('div', 'nome contorno', p.def.nome), el('div', 'info', giriDi(p.id)));
    d.append(f, t); return d;
  };
  const cartaVeicolo = (v: CVeicoloDef) => {
    const d = el('div', 'riga'), f = el('div', 'foto'), t = el('div', 'testo');
    f.appendChild(el('span', '', ICONA[v.id] ?? '🏁'));
    void palco?.foto(v.id).then((url) => { if (!url) return; const im = el('img') as HTMLImageElement; im.src = url; im.alt = v.nome; f.replaceChildren(im); });
    t.append(el('div', 'nome', v.nome), el('div', 'info', CORSE.famiglie[v.famiglia].nome.toUpperCase()));
    d.append(f, t); return d;
  };
  /** Il pannello del veicolo: nome, frase, 4 statistiche a 5 barre. */
  function schedaVeicolo(v: CVeicoloDef) {
    const s = el('div', 'scheda'), te = el('div', 'testa' + (v.nome.length > 15 ? ' lunghissimo' : v.nome.length > 9 ? ' lungo' : '')); te.appendChild(el('div', '', v.nome));
    s.append(te, el('div', 'fam', CORSE.famiglie[v.famiglia].nome.toUpperCase()), ...(v.buffo ? [el('div', 'descr', v.buffo)] : []));
    const st = el('div', 'stat');
    for (const x of STAT) {
      const ic = el('span', 'ic'); ic.innerHTML = x.icona; ic.style.color = x.colore;
      const col = el('div', 'col'), tc = el('div', 'tacche'), q = tacche(v, x.k);
      tc.style.setProperty('--c', x.colore);
      for (let j = 1; j <= 5; j++) tc.appendChild(el('i', j <= q ? 'si' : ''));
      tc.dataset['tacche'] = String(q); col.append(el('b', '', x.nome), tc); st.append(ic, col);
    }
    s.appendChild(st);
    return s;
  }
  /** Il pannello della pista: nome, il tracciato grande, giri e famiglia, descrizione. */
  function schedaPista(id: string) {
    const nome = CORSE_PISTE[id]!.nome, s = el('div', 'scheda'), te = el('div', 'testa' + (nome.length > 15 ? ' lunghissimo' : nome.length > 9 ? ' lungo' : '')); te.appendChild(el('div', '', nome));
    const m = tracciato(id, 200, 130); m.className = 'grande-mappa';
    s.append(te, m, el('div', 'descr', `${giriDi(id)} · ${famDi(id).toUpperCase()}${DESCR[id] ? ' — ' + DESCR[id] : ''}`));
    return s;
  }
  /** La colonna di destra (pannello, e nella 3 le opzioni sotto): si rimette a ogni costruzione. */
  let destra = el('div', 'destra');
  const nuovaDestra = () => { destra = el('div', 'destra'); return destra; };
  const nuovo = (vecchio: HTMLElement | null, n: HTMLElement) => { if (vecchio) vecchio.replaceWith(n); else destra.appendChild(n); return n; };

  /** `amici`: c'è anche «CON GLI AMICI» (risolve con `amici: '1'` e senza bot: la sala la apre chi usa il pannello). */
  function piste(s: Scelta, o: { titolo?: string; sottotitolo?: string; esci?: string; amici?: boolean } = {}) {
    return apri<Record<string, string>>('piste', (fine) => {
      let passo: 'pista' | 'veicolo' = 'pista', rullo0: Rullo | null = null, scheda: HTMLElement | null = null, opz: HTMLElement | null = null;
      const parti = () => { s.veicolo = veicoloPer(s); salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: s.veicolo, bot: '1', oggetti: s.oggetti ? '1' : '0' }) }); };
      const amici = () => { s.veicolo = veicoloPer(s); salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: s.veicolo, bot: '0' }), amici: '1' }); };
      const opzioni = () => {
        const box = el('div', 'opzbox');
        const gruppo = (nome: string, voci: { id: string; nome: string; on: boolean; fai: () => void }[]) => {
          const r = el('div');
          for (const v of voci) { const b = bottone(v.on ? 'on' : '', v.nome, () => { suona('click'); v.fai(); salvaScelta(s); aggiorna(); }); b.dataset['id'] = v.id; r.appendChild(b); }
          box.append(el('span', '', nome), r);
        };
        gruppo('OGGETTI', [{ id: 'ogg_si', nome: '🎁 sì', on: s.oggetti, fai: () => { s.oggetti = true; } }, { id: 'ogg_no', nome: 'guida pura', on: !s.oggetti, fai: () => { s.oggetti = false; } }]);
        gruppo('GAS', [{ id: 'gas_man', nome: 'in mano', on: !s.gasAuto, fai: () => { s.gasAuto = false; } }, { id: 'gas_auto', nome: 'auto', on: s.gasAuto, fai: () => { s.gasAuto = true; } }]);
        gruppo('CAMERA', CAMERE.map((c) => ({ id: c.id, nome: c.nome, on: c.id === s.cam, fai: () => { s.cam = c.id; } })));
        return box;
      };
      /** Dopo una scelta: pannello, opzioni e palco, senza toccare la lista (che scivola da sé). */
      function aggiorna() {
        s.veicolo = veicoloPer(s);
        if (passo === 'pista') { scheda = nuovo(scheda, schedaPista(s.pista)); palco?.pista(s.pista); }
        else { scheda = nuovo(scheda, schedaVeicolo(veicoliDi(s.pista).find((v) => v.id === s.veicolo)!)); opz = nuovo(opz, opzioni()); palco?.veicolo(s.veicolo, s.pista, -0.02); }
      }
      function costruisci() {
        scheda = null; opz = null;
        const x = bottone('chiudi esci', '✕', () => fine(null), 'mzGpEsciMenu'); x.title = o.esci ?? 'Torna all’isola';
        const cambia = () => { passo = passo === 'pista' ? 'veicolo' : 'pista'; costruisci(); };
        if (passo === 'pista') {
          rullo0 = rullo(PISTE, Math.max(0, PISTE.findIndex((p) => p.id === s.pista)), cartaPista, (j) => { s.pista = PISTE[j]!.id; salvaScelta(s); aggiorna(); }, { id: 'mzRulloPiste' });
          const avanti = () => { suona('click'); cambia(); };
          sc.replaceChildren(titolo('Scegli la pista'), passi(1, cambia), x, rullo0.el, nuovaDestra(), vai('AVANTI', avanti, 'mzGpAvanti'),
            ...(o.amici ? [bottone('amici', '👥 CON GLI AMICI', amici, 'mzGpAmici')] : []));
        } else {
          const vv = veicoliDi(s.pista);
          rullo0 = rullo(vv, Math.max(0, vv.findIndex((v) => v.id === s.veicolo)), cartaVeicolo, (j) => { s.veicolo = vv[j]!.id; salvaScelta(s); aggiorna(); }, { id: 'mzRulloVeicoli' });
          sc.replaceChildren(titolo('Scegli il veicolo'), passi(2, cambia), x, rullo0.el, nuovaDestra(), vai('VIA', parti, 'mzGpVia'));
        }
        aggiorna();
      }
      tasti = {
        invio: () => { if (passo === 'pista') { passo = 'veicolo'; costruisci(); } else parti(); },
        indietro: () => { if (passo !== 'veicolo') return false; passo = 'pista'; costruisci(); return true; },
        scorri: (d) => rullo0?.vai(rullo0.i + d),
        via: parti,
      };
      costruisci();
    });
  }

  function garage(attuale: string) {
    return apri<string>('garage', (fine) => {
      const V = CORSE.veicoli;
      let i = Math.max(0, V.findIndex((v) => v.id === attuale)), scheda: HTMLElement | null = null, r: Rullo | null = null;
      const prendi = () => { suona('click'); fine(V[i]!.id); };
      const aggiorna = () => { scheda = nuovo(scheda, schedaVeicolo(V[i]!)); palco?.veicolo(V[i]!.id, PISTE[0]!.id, -0.02); };
      const costruisci = () => {
        scheda = null;
        r = rullo(V, i, cartaVeicolo, (j) => { i = j; aggiorna(); }, { id: 'mzGarage', chiave: 'veicolo' });
        sc.replaceChildren(titolo('Garage'), bottone('chiudi esci', '✕', () => fine(null), 'mzGarageEsci'), r.el, nuovaDestra(), vai('PRENDI', prendi, 'mzGarageOk'));
        aggiorna();
      };
      tasti = { invio: prendi, indietro: () => false, via: prendi, scorri: (d) => r?.vai(r.i + d) };
      costruisci();
    });
  }

  // ▲ ▼ (e W S, ← → A D) scorrono la lista aperta
  addEventListener('keydown', (e) => {
    if (!tasti || e.metaKey || e.ctrlKey) return;
    const d = ['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(e.code) ? -1 : ['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(e.code) ? 1 : 0;
    if (d) { e.preventDefault(); suona('click'); tasti.scorri(d); }
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
