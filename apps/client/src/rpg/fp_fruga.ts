// Prima persona: frugare cadaveri e forzieri come in Skyrim (docs/PRIMA_PERSONA.md). Il bottino a portata di mano sotto il mirino mostra il
// suo cartellino («E · Fruga · Bandito»; dal telefono si tocca il cartellino); si apre la finestra con quello che c'è dentro e si prende un
// oggetto alla volta (tocco o clic) o tutto (R, «Prendi tutto»). I libri si prendono subito. Le prese sono azioni della sim (`prendi`,
// sim/dungeon/fruga.ts): si registrano col tick e il server le rigioca. Da soli la finestra ferma la partita (panels.ts, registraFinestra).
import { ENEMIES } from '@marea/content/rpg.ts';
import { aPortata, contenuto } from '@marea/sim/dungeon/fruga.ts';
import type { DungeonState } from '@marea/sim/dungeon/state.ts';
import type { DungeonAzione, DungeonView, TipoBottino } from '@marea/sim/dungeon/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { suona } from '../audio/ponte.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import { CORNICE_LIBRO, FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';
import { el } from '../ui/style.ts';
import { fmtKg, iconOf } from './items_ui.ts';
import { registraFinestra } from './panels.ts';

/** Il bottino conta «sotto il mirino» entro questo mezzo angolo (coseno) o se ci stai sopra (m). */
const COS_MIRA = Math.cos((26 * Math.PI) / 180), SOPRA = 0.9;
const NOMI = new Map(ENEMIES.map((d) => [d.id, d.nome]));
const nomeOggetto = (id: string): string => (hasItem(id) ? itemDef(id).nome : id);
const CSS = `
.mz-fp-cart { position: absolute; left: 50%; top: calc(50% + 34px); transform: translateX(-50%); z-index: 13; display: none; padding: 4px 12px 5px; background: ${L.cartaChiara};
  color: ${L.inchiostro}; font: 700 15px ${FONT_LIBRO}; white-space: nowrap; ${CORNICE_LIBRO(2)} pointer-events: none; }
.mz-fp-cart.on { display: block; } .mz-fp-cart.tocco { pointer-events: auto; cursor: pointer; padding: 8px 16px; font-size: 17px; }
.mz-fp-cart b { color: ${L.rossoScuro}; } .mz-fp-cart.vuoto { color: ${L.inchiostro2}; background: ${L.cartaScura}; }
.mz-fp-fruga { position: absolute; right: max(16px, env(safe-area-inset-right)); top: 50%; transform: translateY(-50%); width: min(340px, calc(100% - 32px)); max-height: min(78%, 520px);
  display: none; flex-direction: column; background: ${L.carta}; color: ${L.inchiostro}; font: 600 15px ${FONT_LIBRO}; ${CORNICE_LIBRO(3)} z-index: 30; }
.mz-fp-fruga.on { display: flex; }
.mz-fp-fruga .testa { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 10px 14px 6px; border-bottom: 2px solid ${L.filo}; }
.mz-fp-fruga .testa b { font-size: 19px; color: ${L.rossoScuro}; } .mz-fp-fruga .testa small { color: ${L.inchiostro2}; font-size: 13px; }
.mz-fp-fruga .lista { overflow-y: auto; padding: 4px 6px; display: flex; flex-direction: column; gap: 2px; }
.mz-fp-fruga .riga { display: grid; grid-template-columns: 26px 1fr auto auto; align-items: center; gap: 8px; min-height: 40px; padding: 4px 8px; border: 0; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: pointer; }
.mz-fp-fruga .riga:hover, .mz-fp-fruga .riga:focus-visible { background: ${L.cartaScura}; outline: 2px solid ${L.oro}; }
.mz-fp-fruga .riga .q { color: ${L.acquaScura}; } .mz-fp-fruga .riga .kg { color: ${L.inchiostro2}; font-size: 13px; min-width: 44px; text-align: right; }
.mz-fp-fruga .riga.pesa .kg { color: ${L.rosso}; } .mz-fp-fruga .niente { padding: 14px; color: ${L.inchiostro2}; }
.mz-fp-fruga .moneta { width: 18px; height: 18px; margin: 0 4px; background: ${L.oroChiaro}; box-shadow: inset -3px -3px 0 ${L.oroScuro}, 0 0 0 2px ${L.inchiostro}; }
.mz-fp-fruga .piede { display: flex; gap: 8px; padding: 8px 10px 10px; border-top: 2px solid ${L.filo}; }
.mz-fp-fruga .piede button { flex: 1; min-height: 44px; border: 0; font: 700 16px ${FONT_LIBRO}; cursor: pointer; ${CORNICE_LIBRO(2)} }
.mz-fp-fruga .piede .tutto { background: ${L.oroChiaro}; color: ${L.inchiostro}; } .mz-fp-fruga .piede .chiudi { background: ${L.cartaChiara}; color: ${L.inchiostro}; }
`;

export type Fruga = {
  /** Ogni frame: il bottino sotto il mirino (yaw dello sguardo) e il suo cartellino; con la finestra aperta la ridisegna se cambia. */
  update(v: DungeonView, yaw: number): void;
  /** Un tasto: E fruga quello sotto il mirino (true = preso, la Scarica non parte). */
  tasto(e: KeyboardEvent): boolean;
  readonly aperta: boolean;
  dispose(): void;
};

type Bersaglio = { id: number; tipo: TipoBottino; nome: string; vuoto: boolean };
/** Libri e oggetti a terra: una cosa sola, si prende e basta. */
const SOLO = (t: TipoBottino): boolean => t === 'libro' || t === 'oggetto';

export function creaFruga(o: { root: HTMLElement; tocco: boolean; stato(): DungeonState; act(a: DungeonAzione): string | null; avviso(t: string): void }): Fruga {
  if (!document.getElementById('mz-fp-fruga')) { const st = document.createElement('style'); st.id = 'mz-fp-fruga'; st.textContent = CSS; document.head.appendChild(st); }
  const cart = el('div', 'mz-fp-cart' + (o.tocco ? ' tocco' : '')); o.root.appendChild(cart);
  const win = el('div', 'mz-fp-fruga'); win.setAttribute('role', 'dialog'); o.root.appendChild(win);
  let mira: Bersaglio | null = null, aperto: Bersaglio | null = null, firma = '', ultima: DungeonView | null = null;
  const togli = registraFinestra(() => aperto !== null);

  const chiudi = () => {
    if (!aperto) return;
    aperto = null; firma = ''; win.classList.remove('on'); win.replaceChildren();
    removeEventListener('keydown', tasti, true);
    suona('chiudi');
  };
  /** Una presa (un oggetto, le monete o tutto): azione della sim. Svuotato il bottino, la finestra si chiude. */
  const prendi = (item?: string) => {
    if (!aperto) return;
    const errore = o.act({ t: 'prendi', id: aperto.id, ...(item ? { item } : {}) });
    if (errore) { o.avviso(errore); suona('vuoto'); return; }
    suona(item === 'monete' ? 'moneta' : 'raccolto');
    const c = contenuto(o.stato(), aperto.id);
    if (!c || c.vuoto) chiudi(); else disegna();
  };
  const disegna = () => {
    if (!aperto) return;
    const c = contenuto(o.stato(), aperto.id), z = ultima?.zaino;
    if (!c) { chiudi(); return; }
    const sig = JSON.stringify([c.items, c.monete, z?.peso]);
    if (sig === firma) return;
    firma = sig;
    const testa = el('div', 'testa'); testa.append(el('b', '', aperto.nome), el('small', '', z ? `Zaino ${fmtKg(z.peso)} / ${fmtKg(z.max)}` : ''));
    const lista = el('div', 'lista'), libero = z ? z.max - z.peso : Infinity;
    if (c.monete > 0) {
      const r = el('button', 'riga'); r.type = 'button'; r.dataset['item'] = 'monete';
      r.append(el('i', 'moneta'), el('span', 'n', 'Monete'), el('span', 'q', `×${c.monete}`), el('span', 'kg', ''));
      r.addEventListener('click', () => prendi('monete')); lista.appendChild(r);
    }
    for (const id of Object.keys(c.items).sort((a, b) => nomeOggetto(a).localeCompare(nomeOggetto(b), 'it'))) {
      const n = c.items[id]!, def = hasItem(id) ? itemDef(id) : null, r = el('button', 'riga' + (def && def.peso > libero ? ' pesa' : '')); r.type = 'button'; r.dataset['item'] = id;
      r.append(def ? iconOf(def, 24) : el('i'), el('span', 'n', nomeOggetto(id)), el('span', 'q', `×${n}`), el('span', 'kg', def ? fmtKg(def.peso * n) : ''));
      r.addEventListener('click', () => prendi(id)); lista.appendChild(r);
    }
    if (!lista.children.length) lista.appendChild(el('div', 'niente', 'Non c\'è niente.'));
    const piede = el('div', 'piede'), tutto = el('button', 'tutto', o.tocco ? 'Prendi tutto' : 'Prendi tutto · R'), via = el('button', 'chiudi', o.tocco ? 'Chiudi' : 'Chiudi · E');
    tutto.type = via.type = 'button'; tutto.dataset['k'] = 'tutto'; via.dataset['k'] = 'chiudi';
    tutto.dataset['padAction'] = 'prendiTutto'; via.dataset['padBack'] = '';
    tutto.addEventListener('click', () => prendi()); via.addEventListener('click', chiudi);
    piede.append(tutto, via);
    win.replaceChildren(testa, lista, piede);
  };
  const apri = (b: Bersaglio) => {
    if (b.vuoto) return;
    if (SOLO(b.tipo)) { aperto = b; prendi(); aperto = null; return; } // un libro o un oggetto solo: si prende e basta
    aperto = b; firma = '';
    win.classList.add('on'); disegna();
    addEventListener('keydown', tasti, true);
    suona(b.tipo === 'forziere' ? 'apri' : 'raccolto');
    (win.querySelector('.riga') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  /** Con la finestra aperta: R prende tutto, E, Esc e Tab chiudono, le frecce scorrono le righe. */
  const tasti = (e: KeyboardEvent) => {
    if (!aperto) return;
    if (e.code === 'KeyR') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) prendi(); return; }
    if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) chiudi(); return; }
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') {
      e.preventDefault(); e.stopImmediatePropagation();
      const righe = [...win.querySelectorAll<HTMLElement>('button')], i = righe.indexOf(document.activeElement as HTMLElement);
      righe[Math.max(0, Math.min(righe.length - 1, i + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1)))]?.focus({ preventScroll: true });
    }
  };
  cart.addEventListener('click', () => { if (mira && o.tocco) apri(mira); });
  const togliStato = registerStateProvider('fruga', () => ({ mira, aperto: aperto?.id ?? null, righe: [...win.querySelectorAll<HTMLElement>('.riga')].map((r) => r.dataset['item']) }));
  registerTestHook('dungeonFruga', (cosa) => { if (cosa === 'apri' && mira) apri(mira); else if (cosa === 'tutto') prendi(); else if (cosa === 'chiudi') chiudi(); else if (typeof cosa === 'string' && cosa) prendi(cosa); return !!aperto; });

  return {
    get aperta() { return aperto !== null; },
    update(v, yaw) {
      ultima = v;
      if (aperto) { disegna(); cart.classList.remove('on'); return; }
      const s = o.stato(), h = v.hero, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      if (h.anim === 'tende' || h.anim === 'carica' || h.anim === 'lancia' || h.anim === 'attacca') { mira = null; cart.classList.remove('on'); return; } // mentre miri o colpisci, niente cartellino
      let best: Bersaglio | null = null, bv = -Infinity;
      for (const b of v.bottini) {
        const l = s.loot.find((x) => x.id === b.id);
        if (!l || !aPortata(s, l)) continue;
        const dx = b.x - h.x, dz = b.z - h.z, d = Math.sqrt(dx * dx + dz * dz), c = d < SOPRA ? 1 : (dx * fx + dz * fz) / d;
        if (c < COS_MIRA || c - d * 0.1 <= bv) continue;
        bv = c - d * 0.1;
        const morto = b.tipo === 'cadavere' ? v.nemici.find((n) => n.anim === 'morto' && !n.alleato && Math.abs(n.x - b.x) < 0.05 && Math.abs(n.z - b.z) < 0.05) : undefined;
        const libro = SOLO(b.tipo) ? Object.keys(contenuto(s, b.id)?.items ?? {})[0] : undefined;
        best = { id: b.id, tipo: b.tipo, vuoto: b.vuoto, nome: b.tipo === 'forziere' ? 'Forziere' : b.tipo === 'resti' ? 'Resti di un avventuriero' : libro ? nomeOggetto(libro) : morto ? NOMI.get(morto.tipo) ?? 'Cadavere' : 'Bottino' };
      }
      mira = best;
      cart.classList.toggle('on', !!best); cart.classList.toggle('vuoto', !!best?.vuoto);
      if (!best) return;
      const azione = best.tipo === 'forziere' ? 'Apri' : SOLO(best.tipo) ? 'Prendi' : 'Fruga', tasto = o.tocco ? '' : 'E · ';
      const testo = best.vuoto ? `${best.nome} · vuoto` : `${tasto}<b>${azione}</b> · ${best.nome}`;
      if (cart.dataset['t'] !== testo) { cart.dataset['t'] = testo; cart.innerHTML = testo; }
    },
    tasto(e) {
      if (e.code !== 'KeyE' || aperto || !mira || mira.vuoto) return false;
      if (!e.repeat) apri(mira);
      return true;
    },
    dispose() { chiudi(); togli(); togliStato(); cart.remove(); win.remove(); },
  };
}
