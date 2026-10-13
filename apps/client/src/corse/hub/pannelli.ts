// I pannelli delle Corse (#173, #185), in comune tra il gioco (`corse/index.ts`) e il banco di prova dell'hub (`hub/prova.ts`).
// Menù a rulli alla Mario Kart (#271, scelte di Jack del 13 ott 2026):
// - alla porta della zona, due passi: il rullo delle piste (dietro, la pista vera sorvolata piano: `palco.ts`), poi il rullo dei veicoli
//   della famiglia della pista (il veicolo con l'avatar al volante che gira su una pedana), con 4 barre a 5 tacche (velocità,
//   accelerazione, sterzo, peso) e la sua frase; lì anche oggetti, gas e camera, piccoli. VIA parte da tutti e due i passi;
//   Invio = avanti, Esc = indietro (dal primo passo: chiude);
// - il garage: lo stesso rullo dei veicoli, con tutti i veicoli.
// Si scorre con ◀ ▶, A D / frecce, il dito (trascinando di lato) o toccando i nomi in fila sotto.
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

const CSS = `
.mz-gp-sc { position: absolute; inset: 0; z-index: 30; display: none; flex-direction: column; justify-content: space-between; align-items: center; padding: 10px; box-sizing: border-box; pointer-events: none; }
.mz-gp-sc.on { display: flex; }
.mz-gp-sc.velo { background: rgba(22,63,115,.55); justify-content: center; }
.mz-gp-sc > * { pointer-events: auto; }
.mz-gp-sc .tit { align-self: flex-start; padding: 6px 12px; background: rgba(46,30,20,.92); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 4px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara}; font: bold 15px ui-monospace, Menlo, monospace; letter-spacing: .05em; }
.mz-gp-sc .tit small { display: block; font-size: 11px; font-weight: normal; color: ${PAL.sabbia}; letter-spacing: 0; }
.mz-gp-sc .box { width: min(760px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 10px 12px; background: rgba(46,30,20,.94); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 6px 0 ${PAL.neroCaldo};
  color: ${PAL.sabbiaChiara}; font-family: ui-monospace, Menlo, monospace; text-align: center; }
.mz-gp-sc h2 { margin: 0; font-size: 24px; letter-spacing: .06em; }
.mz-gp-sc .sub { color: ${PAL.sabbia}; font-size: 13px; margin: 3px 0 10px; }
.mz-gp-sc .rullo { display: flex; align-items: stretch; gap: 6px; touch-action: pan-y; user-select: none; }
.mz-gp-sc .freccia { flex: none; width: 44px; min-height: 44px; background: ${PAL.legnoScuro}; color: ${PAL.giallo}; border: 2px solid ${PAL.legnoChiaro}; font: bold 22px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .lato { flex: 0 1 120px; display: flex; align-items: center; justify-content: center; padding: 4px; background: rgba(40,26,18,.9); border: 2px solid ${PAL.legno}; color: ${PAL.sabbia}; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; opacity: .75; border-radius: 4px; }
.mz-gp-sc .lato.vuoto { visibility: hidden; }
.mz-gp-sc .carta { flex: 1 1 0; min-width: 0; display: flex; gap: 10px; align-items: center; padding: 8px 10px; background: ${PAL.legnoScuro}; border: 3px solid ${PAL.giallo}; border-radius: 4px; text-align: left; }
.mz-gp-sc .carta .nome { font-size: 22px; font-weight: bold; color: ${PAL.giallo}; letter-spacing: .03em; line-height: 1.1; }
.mz-gp-sc .carta .info { font-size: 12px; color: ${PAL.sabbia}; margin-top: 3px; }
.mz-gp-sc .carta .frase { font-size: 12px; color: ${PAL.sabbiaChiara}; font-style: italic; margin-top: 6px; }
.mz-gp-sc .carta .testo { flex: 1; min-width: 0; }
.mz-gp-sc .carta canvas { flex: none; width: 112px; height: 84px; image-rendering: pixelated; }
.mz-gp-sc .stat { flex: none; display: grid; grid-template-columns: auto auto; gap: 3px 8px; align-items: center; font-size: 11px; color: ${PAL.sabbia}; }
.mz-gp-sc .tacche { display: flex; gap: 3px; }
.mz-gp-sc .tacche i { width: 14px; height: 10px; background: ${PAL.neroCaldo}; border: 1px solid ${PAL.legno}; }
.mz-gp-sc .tacche i.si { background: ${PAL.erbaChiara}; border-color: ${PAL.erbaChiara}; }
.mz-gp-sc .fila { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin: 8px 0 4px; }
.mz-gp-sc .fila button { min-height: 32px; padding: 2px 10px; background: rgba(40,26,18,.9); color: ${PAL.sabbia}; border: 2px solid ${PAL.legno}; font: bold 12px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .fila button.on { background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border-color: ${PAL.neroCaldo}; }
.mz-gp-sc .azioni { display: flex; gap: 8px; align-items: stretch; margin-top: 6px; }
.mz-gp-sc .via { flex: 1; min-height: 52px; background: ${PAL.erbaChiara}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 22px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .via.amici { flex: 0 1 220px; background: ${PAL.giallo}; font-size: 16px; }
.mz-gp-sc .via.piccolo { flex: 0 1 140px; background: ${PAL.sabbia}; font-size: 15px; }
.mz-gp-sc .opz { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: center; align-items: center; margin-top: 8px; font-size: 11px; color: ${PAL.sabbia}; }
.mz-gp-sc .opz span { display: flex; gap: 3px; align-items: center; }
.mz-gp-sc .opz button { min-height: 30px; padding: 2px 8px; background: rgba(40,26,18,.9); color: ${PAL.sabbia}; border: 2px solid ${PAL.legno}; font: bold 11px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .opz button.on { background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border-color: ${PAL.neroCaldo}; }
.mz-gp-sc .cmd { font-size: 11px; color: ${PAL.sabbia}; line-height: 1.5; margin: 8px 0 0; text-align: left; }
.mz-gp-sc .cmd b { color: ${PAL.sabbiaChiara}; }
.mz-gp-sc .esci { margin-top: 6px; background: none; border: none; color: ${PAL.sabbia}; font: 12px ui-monospace, Menlo, monospace; text-decoration: underline; cursor: pointer; min-height: 28px; }
body.mz-rulli #joystick, body.mz-rulli .btn, body.mz-rulli #btnA, body.mz-rulli #btnB, body.mz-rulli #mzGpGas, body.mz-rulli .mz-hub-esci, body.mz-rulli .mz-hub-barca,
body.mz-rulli .mz-hub-v, body.mz-rulli .mz-hub-tag, body.mz-rulli .mz-hub-mappa, body.mz-rulli #mzHubMsg { display: none !important; }
@media (max-height: 520px) {
  .mz-gp-sc { padding: 6px max(10px, env(safe-area-inset-right, 0px)) 4px max(10px, env(safe-area-inset-left, 0px)); }
  .mz-gp-sc .tit { font-size: 12px; padding: 3px 8px; box-shadow: 0 2px 0 ${PAL.neroCaldo}; } .mz-gp-sc .tit small { font-size: 10px; }
  .mz-gp-sc .box { padding: 5px 8px 3px; width: min(720px, 100%); }
  .mz-gp-sc .lato { display: none; }
  .mz-gp-sc .carta { padding: 4px 8px; gap: 8px; } .mz-gp-sc .carta .nome { font-size: 17px; } .mz-gp-sc .carta .info { font-size: 11px; margin-top: 1px; }
  .mz-gp-sc .carta .frase { font-size: 11px; margin-top: 2px; } .mz-gp-sc .carta canvas { width: 80px; height: 60px; }
  .mz-gp-sc .tacche i { width: 11px; height: 8px; } .mz-gp-sc .stat { gap: 1px 6px; font-size: 10px; }
  .mz-gp-sc .fila { margin: 4px 0 2px; } .mz-gp-sc .fila button { min-height: 28px; padding: 1px 8px; font-size: 11px; }
  .mz-gp-sc .via { min-height: 40px; font-size: 17px; box-shadow: 0 3px 0 ${PAL.neroCaldo}; } .mz-gp-sc .via.amici { font-size: 13px; } .mz-gp-sc .via.piccolo { font-size: 12px; }
  .mz-gp-sc .opz { margin-top: 4px; } .mz-gp-sc .opz button { min-height: 26px; } .mz-gp-sc .cmd { display: none; } .mz-gp-sc .esci { margin-top: 0; min-height: 22px; }
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
/** «3 giri · Ruote» (o «Ruote + Acqua» nelle piste miste, «fuga» nelle fughe). */
const infoPista = (id: string) => {
  const d = CORSE_PISTE[id]!, fam = famiglieDi(d).map((f) => CORSE.famiglie[f].nome).join(' + ');
  return `${d.tipo === 'fuga' ? 'fuga · corri o l’onda ti prende' : `${d.giri} giri`} · ${fam}`;
};
/** Il tracciato visto dall'alto, piccolo (come la minimappa della gara). */
function tracciato(id: string): HTMLCanvasElement {
  const W = 112, H = 84, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); if (!g) return c;
  const p = pistaCorse(id), linee = [p.n, ...p.rami.map((r) => r.n)];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of linee) for (let i = 0; i < n.n; i++) { x0 = Math.min(x0, n.x[i]!); x1 = Math.max(x1, n.x[i]!); z0 = Math.min(z0, n.z[i]!); z1 = Math.max(z1, n.z[i]!); }
  const k = Math.min((W - 12) / Math.max(1, x1 - x0), (H - 12) / Math.max(1, z1 - z0)), ox = (W - (x1 - x0) * k) / 2, oz = (H - (z1 - z0) * k) / 2;
  linee.forEach((n, j) => {
    g.strokeStyle = j ? PAL.sabbia : PAL.sabbiaChiara; g.lineWidth = j ? 2 : 3; g.beginPath();
    for (let i = 0; i < n.n; i += 2) { const x = ox + (n.x[i]! - x0) * k, z = oz + (n.z[i]! - z0) * k; if (i) g.lineTo(x, z); else g.moveTo(x, z); }
    if (n.chiuso) g.closePath();
    g.stroke();
  });
  const iv = Math.round(p.def.via / p.n.passo) % p.n.n;
  g.fillStyle = PAL.giallo; g.fillRect(Math.round(ox + (p.n.x[iv]! - x0) * k) - 3, Math.round(oz + (p.n.z[iv]! - z0) * k) - 3, 6, 6);
  return c;
}

export function creaPannelli(root: HTMLElement, palco: Palco | null = null): Pannelli {
  if (!document.getElementById('mz-gp-sc-style')) { const st = document.createElement('style'); st.id = 'mz-gp-sc-style'; st.textContent = CSS; document.head.appendChild(st); }
  const sc = el('div', 'mz mz-gp-sc'); sc.id = 'mzGpIntro';
  for (const ev of ['pointerdown', 'touchstart']) sc.addEventListener(ev, (e) => e.stopPropagation());
  root.appendChild(sc);
  const tocco = matchMedia('(pointer: coarse)').matches;
  let chiudi: ((v: unknown) => void) | null = null, tipo: 'piste' | 'garage' | null = null;
  /** I tasti del pannello aperto: Invio, Esc (true = gestito), ← →. */
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
  // senza palco (niente 3D dietro) il pannello vela lo schermo come prima
  if (!palco) sc.classList.add('velo');

  /** Un rullo: ◀ [prima] [CARTA] [dopo] ▶ e sotto la fila dei nomi (ognuno col suo `data-<chiave>`). Si trascina col dito. */
  function rullo<X extends { id: string; nome: string }>(voci: X[], i: number, carta: (x: X) => HTMLElement, vai: (j: number) => void, chiave = 'id') {
    const n = voci.length, r = el('div', 'rullo');
    const lato = (j: number) => { const b = bottone('lato' + (n < 3 && j !== (i + 1) % n && j !== (i + n - 1) % n ? ' vuoto' : ''), voci[j]!.nome, () => { suona('click'); vai(j); }); return b; };
    r.append(bottone('freccia', '◀', () => { suona('click'); vai((i + n - 1) % n); }, 'mzRulloPrima'), ...(n > 1 ? [lato((i + n - 1) % n)] : []), carta(voci[i]!), ...(n > 1 ? [lato((i + 1) % n)] : []),
      bottone('freccia', '▶', () => { suona('click'); vai((i + 1) % n); }, 'mzRulloDopo'));
    let x0: number | null = null;
    r.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    r.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { suona('click'); vai((i + (dx < 0 ? 1 : n - 1)) % n); } });
    const fila = el('div', 'fila');
    voci.forEach((v, j) => { const b = bottone(j === i ? 'on' : '', v.nome, () => { suona('click'); vai(j); }); b.dataset[chiave] = v.id; fila.appendChild(b); });
    return [r, fila];
  }
  /** La carta di un veicolo: nome, famiglia, frase, 4 statistiche a tacche. */
  function cartaVeicolo(v: CVeicoloDef): HTMLElement {
    const c = el('div', 'carta'), t = el('div', 'testo'), st = el('div', 'stat');
    t.append(el('div', 'nome', v.nome), el('div', 'info', CORSE.famiglie[v.famiglia].nome), ...(v.buffo ? [el('div', 'frase', `«${v.buffo}»`)] : []));
    for (const x of STAT) {
      const tc = el('div', 'tacche'), q = tacche(v, x.k);
      for (let j = 1; j <= 5; j++) tc.appendChild(el('i', j <= q ? 'si' : ''));
      tc.dataset['tacche'] = String(q); st.append(el('span', '', x.nome), tc);
    }
    c.append(t, st);
    return c;
  }
  const titolo = (riga: string, sotto: string) => { const t = el('div', 'tit', riga); t.appendChild(el('small', '', sotto)); return t; };

  /** `amici`: c'è anche «CON GLI AMICI» (risolve con `amici: '1'` e senza bot: la sala la apre chi usa il pannello). */
  function piste(s: Scelta, o: { titolo?: string; sottotitolo?: string; esci?: string; amici?: boolean } = {}) {
    return apri<Record<string, string>>('piste', (fine) => {
      let passo: 'pista' | 'veicolo' = 'pista';
      const parti = () => { s.veicolo = veicoloPer(s); salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: s.veicolo, bot: '1', oggetti: s.oggetti ? '1' : '0' }) }); };
      const amici = () => { s.veicolo = veicoloPer(s); salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: s.veicolo, bot: '0' }), amici: '1' }); };
      const disegna = () => {
        s.veicolo = veicoloPer(s);
        const box = el('div', 'box');
        if (passo === 'pista') {
          const i = Math.max(0, PISTE.findIndex((p) => p.id === s.pista));
          const carta = (p: (typeof PISTE)[number]) => { const c = el('div', 'carta'), t = el('div', 'testo'); t.append(el('div', 'nome', p.def.nome), el('div', 'info', infoPista(p.id))); c.append(t, tracciato(p.id)); return c; };
          box.append(...rullo(PISTE.map((p) => ({ ...p, nome: p.def.nome })), i, carta, (j) => { s.pista = PISTE[j]!.id; salvaScelta(s); disegna(); }),
            el('div', 'azioni'));
          const az = box.lastElementChild as HTMLElement;
          az.append(bottone('via', 'SCEGLI IL VEICOLO ▶', () => { suona('click'); passo = 'veicolo'; disegna(); }, 'mzGpAvanti'),
            ...(o.amici ? [bottone('via amici', '👥 CON GLI AMICI', amici, 'mzGpAmici')] : []));
          box.append(bottone('esci', o.esci ?? 'Torna all’isola', () => fine(null)));
          sc.replaceChildren(titolo(o.titolo ?? '🏁 SCEGLI LA PISTA', `1/2 · ${o.sottotitolo ?? 'Isola delle Corse'}`), box);
          palco?.pista(s.pista);
        } else {
          const vv = veicoliDi(s.pista), i = Math.max(0, vv.findIndex((v) => v.id === s.veicolo));
          box.append(...rullo(vv, i, cartaVeicolo, (j) => { s.veicolo = vv[j]!.id; salvaScelta(s); disegna(); }));
          const opz = el('div', 'opz');
          const gruppo = (nome: string, voci: { id: string; nome: string; on: boolean; fai: () => void }[]) => {
            const g = el('span', '', nome);
            for (const v of voci) { const b = bottone(v.on ? 'on' : '', v.nome, () => { suona('click'); v.fai(); salvaScelta(s); disegna(); }); b.dataset['id'] = v.id; g.appendChild(b); }
            return g;
          };
          opz.append(
            gruppo('OGGETTI', [{ id: 'ogg_si', nome: '🎁 sì', on: s.oggetti, fai: () => { s.oggetti = true; } }, { id: 'ogg_no', nome: 'guida pura', on: !s.oggetti, fai: () => { s.oggetti = false; } }]),
            gruppo('GAS', [{ id: 'gas_man', nome: 'in mano', on: !s.gasAuto, fai: () => { s.gasAuto = false; } }, { id: 'gas_auto', nome: 'auto', on: s.gasAuto, fai: () => { s.gasAuto = true; } }]),
            gruppo('CAMERA', CAMERE.map((c) => ({ id: c.id, nome: c.nome, on: c.id === s.cam, fai: () => { s.cam = c.id; } }))),
          );
          const az = el('div', 'azioni');
          az.append(bottone('via piccolo', '◀ PISTA', () => { suona('click'); passo = 'pista'; disegna(); }, 'mzGpIndietro'), bottone('via', 'VIA!', parti, 'mzGpVia'));
          const cmd = el('div', 'cmd');
          cmd.innerHTML = tocco
            ? '<b>Joystick</b>: sterza · <b>GAS</b> tienilo premuto · <b>FRENO</b> (tenuto da fermo = retromarcia) · <b>DRIFT</b> tenuto in curva, poi lascia e parti · <b>USA</b> = l\'oggetto · tieni il GAS quando compare l\'<b>1</b>: partenza razzo'
            : '<b>A D</b> o <b>← →</b> sterza · <b>W ↑</b> gas · <b>S ↓</b> freno · <b>Spazio</b> = DRIFT in curva, poi lascia · <b>Q</b> oggetto (<b>R</b> indietro) · gas sull\'<b>1</b> del semaforo: partenza razzo · <b>Esc</b> ti ritira';
          box.append(opz, az, cmd);
          sc.replaceChildren(titolo(`${CORSE_PISTE[s.pista]!.nome.toUpperCase()} · SCEGLI IL VEICOLO`, `2/2 · ${infoPista(s.pista)}`), box);
          palco?.veicolo(s.veicolo, s.pista);
        }
      };
      tasti = {
        invio: () => { if (passo === 'pista') { passo = 'veicolo'; disegna(); } else parti(); },
        indietro: () => { if (passo !== 'veicolo') return false; passo = 'pista'; disegna(); return true; },
        scorri: (d) => { (document.getElementById(d < 0 ? 'mzRulloPrima' : 'mzRulloDopo') as HTMLButtonElement | null)?.click(); },
        via: parti,
      };
      disegna();
    });
  }

  function garage(attuale: string) {
    return apri<string>('garage', (fine) => {
      const V = CORSE.veicoli;
      let i = Math.max(0, V.findIndex((v) => v.id === attuale));
      const disegna = () => {
        const box = el('div', 'box'); box.id = 'mzGarage';
        box.append(...rullo(V, i, cartaVeicolo, (j) => { i = j; disegna(); }, 'veicolo'));
        const az = el('div', 'azioni');
        az.append(bottone('via', `PRENDI ${V[i]!.nome.toUpperCase()}`, () => { suona('click'); fine(V[i]!.id); }, 'mzGarageOk'));
        box.append(az, bottone('esci', 'Esci dal garage', () => fine(null), 'mzGarageEsci'));
        sc.replaceChildren(titolo('🔧 GARAGE', 'con cosa giri l’isola (se la pista vuole barche o ruote, la gara lo cambia da sola)'), box);
        palco?.veicolo(V[i]!.id, PISTE[0]!.id);
      };
      tasti = {
        invio: () => fine(V[i]!.id), indietro: () => false, via: () => fine(V[i]!.id),
        scorri: (d) => { i = (i + V.length + d) % V.length; disegna(); },
      };
      disegna();
    });
  }

  // ← → e A D scorrono il rullo aperto (fuori dalla gara: il pannello c'è solo nell'hub)
  addEventListener('keydown', (e) => {
    if (!tasti || e.metaKey || e.ctrlKey) return;
    const d = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
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
