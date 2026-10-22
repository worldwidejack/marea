// I preferiti del dungeon, a schermo (logica in dungeon_preferiti.ts): tre bottoni accanto ad A e B, sulla tastiera i tasti 1-2-3. Un tocco
// (o il tasto) mette in mano quello che c'è; tenuto premuto (o Maiusc + tasto) si sceglie tra le armi dello zaino e le magie che conosci;
// vuoto, il primo tocco apre subito la scelta. Quello in mano è cerchiato di giallo; se è una magia, il bottone si riempie mentre ricarica.
import { spellDef } from '@marea/content/rpg.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { HeroState } from '@marea/sim/rpg/types.ts';
import { PAL, el } from '../ui/style.ts';
import { tieniPremuto } from '../ui/comandi_touch.ts';
import { coloreMagia, iconOf, itemIcon } from './items_ui.ts';
import { N_PREFERITI, ha, inMano, leggiPreferiti, nomeDi, predefiniti, salvaPreferiti, stessi, vociDi } from './dungeon_preferiti.ts';
import type { InMano, Preferiti, Preferito } from './dungeon_preferiti.ts';

const RIGHT = 'max(16px, env(safe-area-inset-right, 0px))', SAFE = 'env(safe-area-inset-bottom, 0px)';
const LATO = 48, GAP = 4, DA_DESTRA = 78, LUNGO_MS = 450; // px: bottoni, tra l'uno e l'altro, dal bordo destro al 3; ms da tenere premuto per cambiare cosa c'è
// in fila a sinistra della pozione (D): a 390 px stanno tra il joystick e D. Fermi anche quando compare il joystick di mira (sono i bottoni
// con cui si passa dall'arma alla magia: non devono spostarsi sotto il dito), sopra l'anello; sopra resta posto per la lanterna
const CSS = `
.mz-dng-btn.f { box-sizing: border-box; width: ${LATO}px; height: ${LATO}px; bottom: calc(${SAFE} + 150px); background: rgba(46,30,20,.88); gap: 0; }
${Array.from({ length: N_PREFERITI }, (_, n) => `.mz-dng-btn.f${n} { right: calc(${RIGHT} + ${DA_DESTRA + (N_PREFERITI - 1 - n) * (LATO + GAP)}px); }`).join('\n')}
.mz-dng-btn.f.vuoto { border-style: dashed; opacity: .7; }
.mz-dng-btn.f .piu { font: bold 22px ui-monospace, Menlo, monospace; line-height: 24px; color: ${PAL.sabbia}; }
.mz-dng-btn.f small { font-size: 11px; opacity: 1; }
.mz-dng-pick { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); width: min(320px, calc(100% - 32px)); max-height: min(76%, 560px); box-sizing: border-box; padding: 10px; display: none; flex-direction: column; background: rgba(46,30,20,.97); border: 3px solid ${PAL.giallo}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 24; }
.mz-dng-pick.on { display: flex; }
.mz-dng-pick b { font-size: 17px; color: ${PAL.giallo}; letter-spacing: .06em; text-align: center; }
.mz-dng-pick .sub { margin: 3px 0 8px; font-size: 12px; color: ${PAL.sabbia}; text-align: center; }
.mz-dng-pick .lista { flex: 1; min-height: 0; overflow-y: auto; touch-action: pan-y; }
.mz-dng-pick button { display: flex; width: 100%; align-items: center; gap: 8px; min-height: 44px; margin: 0 0 4px; padding: 4px 8px; background: ${PAL.legnoScuro}; border: 2px solid ${PAL.legnoChiaro}; box-shadow: 0 3px 0 ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; text-align: left; cursor: pointer; }
.mz-dng-pick button.cur { border-color: ${PAL.giallo}; }
.mz-dng-pick button small { margin-left: auto; color: ${PAL.sabbia}; font-size: 11px; }
.mz-dng-pick .vuoto { margin: 4px 0; text-align: center; color: ${PAL.sabbia}; font-size: 13px; }
.mz-dng-pick .piede { display: flex; gap: 6px; margin-top: 6px; }
.mz-dng-pick .piede button { margin: 0; justify-content: center; }
`;

export type PreferitiUi = {
  /** Quello che va nella pagina: i tre bottoni e il selettore. */
  els: HTMLElement[];
  /** A ogni frame: com'è l'eroe adesso. `ricarica` = la magia in mano, 0..1 (1 = pronta). */
  aggiorna(s: { hero: HeroState | null; mano: InMano; ricarica: number }): void;
  /** Tasto 1-3 (con Maiusc: cambia cosa c'è). true se l'ha preso. */
  tasto(e: KeyboardEvent): boolean;
  /** Il selettore è aperto (da solo la partita si ferma). */
  readonly aperto: boolean;
  chiudi(): void;
  dispose(): void;
};

/** `attivo` = ora si può (niente pausa, domanda o scheda aperta). `onUsa` mette in mano quello che hai scelto. */
export function createPreferiti(o: { attivo(): boolean; hero(): HeroState | null; onUsa(p: Preferito): void }): PreferitiUi {
  if (!document.getElementById('mz-dng-pref-style')) { const st = document.createElement('style'); st.id = 'mz-dng-pref-style'; st.textContent = CSS; document.head.appendChild(st); }
  let salvati: Preferiti | null = leggiPreferiti(), partenza: Preferiti | null = null, mano: InMano = { arma: null, magia: null }, aperto = -1, sig = '', cdPrima = '';
  /** Quelli di adesso: i tuoi, o finché non ne scegli uno quelli di partenza (fatti una volta sola, dall'equipaggiamento dell'entrata). */
  const quali = (h: HeroState | null): Preferiti => salvati ?? (partenza ??= h ? predefiniti(h) : null) ?? Array.from({ length: N_PREFERITI }, () => null);
  const icona = (p: Preferito, px: number): Node => {
    if ('magia' in p) { let scuola = 'distruzione'; try { scuola = spellDef(p.magia).scuola; } catch { /* sconosciuta */ } return itemIcon('libro', coloreMagia(p.magia, scuola), px); }
    return hasItem(p.arma) ? iconOf(itemDef(p.arma), px) : itemIcon('arma', PAL.pietra, px);
  };

  const slot = Array.from({ length: N_PREFERITI }, (_, n) => {
    const b = el('div', `mz mz-dng-btn f f${n} vuoto`); b.id = `btnF${n + 1}`;
    const cd = el('div', 'cd'), ico = el('span', 'ico'), sm = el('small', '', String(n + 1));
    b.append(cd, ico, sm);
    return { b, cd, ico, n };
  });
  const box = el('div', 'mz mz-dng-pick'); box.id = 'mzDngPreferiti';
  const titolo = el('b'), sub = el('div', 'sub', 'Tieni premuto un preferito per cambiarlo'), lista = el('div', 'lista');
  const vuota = el('button', '', 'Vuoto'), chiudiB = el('button', '', 'Chiudi');
  vuota.type = chiudiB.type = 'button'; vuota.dataset['act'] = 'vuoto'; chiudiB.dataset['act'] = 'chiudi';
  const piede = el('div', 'piede'); piede.append(vuota, chiudiB);
  box.append(titolo, sub, lista, piede);
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());

  const chiudi = () => { aperto = -1; box.classList.remove('on'); };
  const metti = (n: number, p: Preferito | null) => {
    const q = [...quali(o.hero())]; q[n] = p; salvati = q; salvaPreferiti(q); sig = ''; chiudi();
  };
  const apri = (n: number) => {
    const h = o.hero(); if (!h) return;
    aperto = n; titolo.textContent = `PREFERITO ${n + 1}`;
    const cur = quali(h)[n] ?? null, voci = vociDi(h);
    lista.replaceChildren(...(voci.length ? voci.map((v) => {
      const b = el('button', stessi(v.p, cur) ? 'cur' : ''); b.type = 'button';
      b.append(icona(v.p, 26), el('span', '', v.nome), el('small', '', v.nota));
      b.addEventListener('click', () => metti(n, v.p));
      return b;
    }) : [el('div', 'vuoto', 'Non hai armi né magie')]));
    vuota.onclick = () => metti(n, null); chiudiB.onclick = chiudi;
    box.classList.add('on');
  };
  const usa = (n: number) => {
    chiudi();
    const h = o.hero(), p = quali(h)[n] ?? null;
    if (!p) apri(n);
    else if (!inMano(p, mano)) o.onUsa(p);
  };

  // un tocco = usa; tenuto premuto = cambia cosa c'è (se ha già scattato il tempo, al rilascio non si usa)
  const tieni = slot.map(({ b, n }) => {
    let t = 0, lungo = false;
    return tieniPremuto(b, {
      ferma: true, classe: 'on',
      premi: () => { lungo = false; clearTimeout(t); t = window.setTimeout(() => { if (o.attivo()) { lungo = true; apri(n); } }, LUNGO_MS); },
      cambia: (giu) => { if (giu) return; clearTimeout(t); if (!lungo && o.attivo()) usa(n); },
    });
  });

  return {
    els: [...slot.map((s) => s.b), box],
    aggiorna(s) {
      mano = s.mano;
      const h = s.hero, q = quali(h);
      const nuovo = JSON.stringify([q, q.map((p) => (p && h ? ha(h, p) : true)), mano.arma, mano.magia]);
      if (nuovo !== sig) {
        sig = nuovo;
        for (const { b, ico, n } of slot) {
          const p = q[n] ?? null;
          b.classList.toggle('vuoto', !p); b.classList.toggle('mano', !!p && inMano(p, mano)); b.classList.toggle('off', !!p && !!h && !ha(h, p));
          ico.replaceChildren(p ? icona(p, 24) : el('span', 'piu', '+'));
          b.title = p ? `${nomeDi(p)} (tasto ${n + 1}) · tieni premuto per cambiarlo` : `Vuoto (tasto ${n + 1}): tocca per sceglierci un’arma o una magia`;
        }
      }
      // la magia in mano si riempie mentre ricarica, a gradini del 10 %
      const pct = Math.round((1 - Math.max(0, Math.min(1, s.ricarica))) * 10) * 10;
      const alti = slot.map(({ b }) => (mano.magia && b.classList.contains('mano') ? pct : 0)), k = alti.join();
      if (k !== cdPrima) { cdPrima = k; slot.forEach(({ cd }, i) => { cd.style.height = `${alti[i]}%`; }); }
    },
    tasto(e) {
      const n = Number(/^(?:Digit|Numpad)([1-3])$/.exec(e.code)?.[1] ?? 0) - 1;
      if (n < 0) return false;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || !o.attivo() || aperto >= 0) return true;
      if (e.shiftKey) apri(n); else usa(n);
      return true;
    },
    get aperto() { return aperto >= 0; },
    chiudi,
    dispose() { for (const t of tieni) t.dispose(); },
  };
}
