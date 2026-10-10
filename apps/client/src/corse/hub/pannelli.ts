// I pannelli delle Corse (#173, #185), in comune tra il gioco (`corse/index.ts`) e il banco di prova dell'hub (`hub/prova.ts`):
// - la scelta della pista della Spiaggia (quattro piste, veicolo già scelto, gas, camera, VIA): si apre alla porta della Spiaggia;
// - il garage: tutti i veicoli di `CORSE.veicoli` con nome e tre barre (velocità, accelerazione, sterzo).
// La scelta (pista, veicolo, gas, camera) sta in localStorage `mz-corse-scelta`: la usano l'hub (con che veicolo guidi) e la gara.
// Un pannello alla volta, nello stesso riquadro `#mzGpIntro` (i test lo cercano lì).
import { CORSE, CORSE_PISTE } from '@marea/content/corse.ts';
import { famiglieDi, opzioniGara } from '@marea/sim/corse/gara.ts';
import { PAL, el } from '../../ui/style.ts';
import { suona } from '../../audio/ponte.ts';
import type { Modo } from '../prova/camera.ts';

export const SCELTA_KEY = 'mz-corse-scelta';
export const PISTE = Object.entries(CORSE_PISTE).filter(([id]) => id.startsWith('spiaggia_')).map(([id, d]) => ({ id, def: d }));
export const CAMERE: { id: Modo; nome: string }[] = [{ id: 'dietro', nome: 'dietro' }, { id: 'alta', nome: 'alta' }, { id: 'cofano', nome: 'cofano' }];
export type Scelta = { pista: string; veicolo: string; gasAuto: boolean; cam: Modo };

export function leggiScelta(): Scelta {
  let scelta: Scelta = { pista: 'spiaggia_lungomare', veicolo: 'kart', gasAuto: false, cam: 'dietro' };
  try {
    const m = JSON.parse(localStorage.getItem(SCELTA_KEY) ?? 'null') as Partial<Scelta> | null;
    if (m) scelta = { pista: PISTE.some((p) => p.id === m.pista) ? m.pista! : scelta.pista, veicolo: CORSE.veicoli.some((v) => v.id === m.veicolo) ? m.veicolo! : scelta.veicolo, gasAuto: !!m.gasAuto, cam: CAMERE.some((c) => c.id === m.cam) ? m.cam! : 'dietro' };
  } catch { /* niente memoria: di serie */ }
  return scelta;
}
export function salvaScelta(s: Scelta): void { try { localStorage.setItem(SCELTA_KEY, JSON.stringify(s)); } catch { /* pazienza */ } }
export const veicoliDi = (pista: string) => CORSE.veicoli.filter((v) => famiglieDi(CORSE_PISTE[pista]!).includes(v.famiglia));
/** Il veicolo della scelta va bene per la pista? Se no il primo della famiglia della pista (il garage può averne scelto uno d'acqua). */
export function veicoloPer(s: Scelta): string { return veicoliDi(s.pista).some((v) => v.id === s.veicolo) ? s.veicolo : veicoliDi(s.pista)[0]!.id; }

const CSS = `
.mz-gp-sc { position: absolute; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; background: rgba(22,63,115,.55); }
.mz-gp-sc.on { display: flex; }
.mz-gp-sc .box { width: min(560px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 14px 16px; background: rgba(46,30,20,.96); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 6px 0 ${PAL.neroCaldo};
  color: ${PAL.sabbiaChiara}; font-family: ui-monospace, Menlo, monospace; text-align: center; }
.mz-gp-sc h2 { margin: 0; font-size: 24px; letter-spacing: .06em; }
.mz-gp-sc .sub { color: ${PAL.sabbia}; font-size: 13px; margin: 3px 0 10px; }
.mz-gp-sc .lbl { font-size: 12px; color: ${PAL.sabbia}; margin: 8px 0 5px; letter-spacing: .08em; text-align: left; }
.mz-gp-sc .riga { display: flex; flex-wrap: wrap; gap: 6px; }
.mz-gp-sc .riga button { flex: 1 1 120px; min-height: 44px; padding: 4px 8px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; font: bold 13px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .riga button small { display: block; font-weight: normal; font-size: 10px; color: ${PAL.sabbia}; }
.mz-gp-sc .riga button.on { background: ${PAL.giallo}; color: ${PAL.neroCaldo}; border-color: ${PAL.neroCaldo}; }
.mz-gp-sc .riga button.on small { color: ${PAL.legnoScuro}; }
.mz-gp-sc .sez { display: block; }
.mz-gp-sc .cmd { font-size: 11px; color: ${PAL.sabbia}; line-height: 1.5; margin: 10px 0; text-align: left; }
.mz-gp-sc .cmd b { color: ${PAL.sabbiaChiara}; }
.mz-gp-sc .via { width: 100%; min-height: 52px; background: ${PAL.erbaChiara}; color: ${PAL.neroCaldo}; border: 3px solid ${PAL.neroCaldo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; font: bold 22px ui-monospace, Menlo, monospace; cursor: pointer; border-radius: 4px; }
.mz-gp-sc .via.amici { margin-top: 8px; background: ${PAL.giallo}; font-size: 18px; }
.mz-gp-sc .esci { margin-top: 8px; background: none; border: none; color: ${PAL.sabbia}; font: 12px ui-monospace, Menlo, monospace; text-decoration: underline; cursor: pointer; min-height: 30px; }
.mz-gp-sc .gar button { flex: 1 1 30%; text-align: left; padding: 6px 8px; }
.mz-gp-sc .gar .fam { float: right; font-weight: normal; font-size: 10px; color: ${PAL.sabbia}; }
.mz-gp-sc .gar button.on .fam { color: ${PAL.legnoScuro}; }
.mz-gp-sc .bar { display: flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 9px; font-weight: normal; }
.mz-gp-sc .bar span { width: 26px; flex: none; }
.mz-gp-sc .bar b { flex: 1; height: 5px; background: ${PAL.neroCaldo}; display: block; }
.mz-gp-sc .bar b i { display: block; height: 100%; background: ${PAL.erbaChiara}; }
.mz-gp-sc .gar button.on .bar b i { background: ${PAL.legnoScuro}; }
@media (max-height: 520px) { .mz-gp-sc .box { padding: 6px 12px 4px; } .mz-gp-sc h2 { font-size: 17px; } .mz-gp-sc .sub { margin: 1px 0 4px; font-size: 11px; } .mz-gp-sc .cmd { display: none; }
  .mz-gp-sc .sez { display: flex; align-items: center; gap: 8px; margin-top: 4px; } .mz-gp-sc .sez .lbl { margin: 0; width: 62px; flex: none; font-size: 11px; } .mz-gp-sc .sez .riga { flex: 1; flex-wrap: nowrap; }
  .mz-gp-sc .riga button { min-height: 34px; flex-basis: 0; padding: 2px 4px; font-size: 12px; } .mz-gp-sc .riga button small { font-size: 9px; } .mz-gp-sc .via { min-height: 40px; font-size: 17px; margin-top: 6px; box-shadow: 0 3px 0 ${PAL.neroCaldo}; } .mz-gp-sc .via.amici { margin-top: 6px; font-size: 15px; }
.mz-gp-sc .esci { margin-top: 2px; min-height: 24px; }
  .mz-gp-sc .gar { flex-wrap: wrap !important; } .mz-gp-sc .gar button { flex: 1 1 30%; min-height: 0; padding: 3px 6px; } .mz-gp-sc .bar { margin-top: 1px; } }
`;

export type Pannelli = {
  /** La scelta della pista: risolve con le opzioni della gara (VIA) o null (`esci`). Salva da sé pista, veicolo, gas e camera. */
  piste(s: Scelta, o?: { titolo?: string; sottotitolo?: string; esci?: string; amici?: boolean }): Promise<Record<string, string> | null>;
  /** Il garage: risolve col veicolo scelto o null. */
  garage(attuale: string): Promise<string | null>;
  /** Chiude il pannello aperto (come «esci»). */
  chiudi(): void;
  /** VIA (dalla tastiera: Invio). */
  via(): void;
  aperto(): 'piste' | 'garage' | null;
  readonly el: HTMLElement;
};

export function creaPannelli(root: HTMLElement): Pannelli {
  if (!document.getElementById('mz-gp-sc-style')) { const st = document.createElement('style'); st.id = 'mz-gp-sc-style'; st.textContent = CSS; document.head.appendChild(st); }
  const sc = el('div', 'mz mz-gp-sc'); sc.id = 'mzGpIntro';
  for (const ev of ['pointerdown', 'touchstart']) sc.addEventListener(ev, (e) => e.stopPropagation());
  root.appendChild(sc);
  const tocco = matchMedia('(pointer: coarse)').matches;
  let chiudi: ((v: unknown) => void) | null = null, tipo: 'piste' | 'garage' | null = null;
  const apri = <T,>(t: 'piste' | 'garage', disegna: (fine: (v: T | null) => void) => void) => new Promise<T | null>((resolve) => {
    chiudi?.(null);
    tipo = t;
    const fine = (v: T | null) => { if (chiudi !== fine) return; chiudi = null; tipo = null; sc.classList.remove('on'); resolve(v); };
    chiudi = fine as (v: unknown) => void;
    disegna(fine); sc.classList.add('on');
  });
  const bottone = (cls: string, testo: string, fai: () => void, id?: string) => { const b = el('button', cls, testo) as HTMLButtonElement; b.type = 'button'; if (id) b.id = id; b.addEventListener('click', fai); return b; };

  /** `amici`: c'è anche «CON GLI AMICI» (risolve con `amici: '1'` e senza bot: la sala la apre chi usa il pannello). */
  function piste(s: Scelta, o: { titolo?: string; sottotitolo?: string; esci?: string; amici?: boolean } = {}) {
    return apri<Record<string, string>>('piste', (fine) => {
      const disegna = () => {
        s.veicolo = veicoloPer(s);
        const riga = (titolo: string, voci: { id: string; nome: string; sub?: string; on: boolean; fai: () => void }[]) => {
          const r = el('div', 'riga');
          for (const v of voci) { const b = el('button', v.on ? 'on' : '', v.nome) as HTMLButtonElement; b.type = 'button'; b.dataset['id'] = v.id; if (v.sub) b.appendChild(el('small', '', v.sub)); b.addEventListener('click', () => { v.fai(); suona('click'); }); r.appendChild(b); }
          const sez = el('div', 'sez'); sez.append(el('div', 'lbl', titolo), r);
          return sez;
        };
        const salva = () => { salvaScelta(s); disegna(); };
        const cmd = el('div', 'cmd');
        cmd.innerHTML = tocco
          ? '<b>Joystick</b>: sterza · <b>GAS</b> tienilo premuto · <b>FRENO</b> · <b>DRIFT</b> tenuto in curva (dà anche gas; 3 livelli di scintille), poi lascia e parti<br>Tieni il GAS quando compare l\'<b>1</b> al semaforo: partenza razzo'
          : '<b>A D</b> o <b>← →</b> sterza · <b>W ↑</b> gas · <b>S ↓</b> freno · <b>Spazio</b> = DRIFT tenuto in curva, poi lascia e parti<br>Tieni il gas quando compare l\'<b>1</b> al semaforo: partenza razzo · <b>Esc</b> ti ritira';
        const box = el('div', 'box');
        box.append(
          el('h2', '', o.titolo ?? '🏁 GRAN PREMIO'), el('div', 'sub', o.sottotitolo ?? 'Isola delle Corse · Spiaggia e porto · tu e 4 avversari'),
          riga('PISTA', PISTE.map(({ id, def }) => ({ id, nome: def.nome, sub: def.tipo === 'fuga' ? 'fuga · corri o l\'onda ti prende' : `${def.giri} giri`, on: id === s.pista, fai: () => { s.pista = id; salva(); } }))),
          riga('VEICOLO', veicoliDi(s.pista).map((v) => ({ id: v.id, nome: v.nome, on: v.id === s.veicolo, fai: () => { s.veicolo = v.id; salva(); } }))),
          riga('GAS', [{ id: 'gas_man', nome: 'in mano', on: !s.gasAuto, fai: () => { s.gasAuto = false; salva(); } }, { id: 'gas_auto', nome: 'automatico', on: s.gasAuto, fai: () => { s.gasAuto = true; salva(); } }]),
          riga('CAMERA', CAMERE.map((c) => ({ id: c.id, nome: c.nome, on: c.id === s.cam, fai: () => { s.cam = c.id; salva(); } }))),
          cmd,
          bottone('via', 'VIA!', () => { salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: veicoloPer(s), bot: '1' }) }); }, 'mzGpVia'),
          ...(o.amici ? [bottone('via amici', '👥 CON GLI AMICI', () => { salvaScelta(s); fine({ ...opzioniGara({ pista: s.pista, veicolo: veicoloPer(s), bot: '0' }), amici: '1' }); }, 'mzGpAmici')] : []),
          bottone('esci', o.esci ?? 'Torna all’isola', () => fine(null)),
        );
        sc.replaceChildren(box);
      };
      disegna();
    });
  }

  function garage(attuale: string) {
    return apri<string>('garage', (fine) => {
      const V = CORSE.veicoli, mx = (k: 'velocita' | 'accelerazione' | 'sterzo') => Math.max(...V.map((v) => v[k])), mn = (k: 'velocita' | 'accelerazione' | 'sterzo') => Math.min(...V.map((v) => v[k]));
      const barra = (nome: string, k: 'velocita' | 'accelerazione' | 'sterzo', x: number) => {
        const r = el('div', 'bar'), b = el('b'), i = el('i');
        i.style.width = `${Math.round(100 * Math.max(0.15, Math.min(1, (x - mn(k) * 0.8) / (mx(k) - mn(k) * 0.8))))}%`;
        b.appendChild(i); r.append(el('span', '', nome), b);
        return r;
      };
      const r = el('div', 'riga gar');
      for (const v of V) {
        const b = bottone(v.id === attuale ? 'on' : '', '', () => { suona('click'); fine(v.id); });
        b.dataset['veicolo'] = v.id;
        b.append(el('span', 'fam', CORSE.famiglie[v.famiglia].nome), document.createTextNode(v.nome), barra('vel', 'velocita', v.velocita), barra('acc', 'accelerazione', v.accelerazione), barra('ste', 'sterzo', v.sterzo));
        r.appendChild(b);
      }
      const box = el('div', 'box');
      box.append(el('h2', '', '🔧 GARAGE'), el('div', 'sub', 'Scegli con cosa giri l’isola e corri (se la pista vuole barche o ruote, la gara lo cambia da sola)'), r, bottone('esci', 'Esci dal garage', () => fine(null), 'mzGarageEsci'));
      box.id = 'mzGarage';
      sc.replaceChildren(box);
    });
  }

  return {
    el: sc, piste, garage,
    chiudi: () => chiudi?.(null),
    via: () => (document.getElementById('mzGpVia') as HTMLButtonElement | null)?.click(),
    aperto: () => tipo,
  };
}
