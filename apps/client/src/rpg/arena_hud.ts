// HUD e controlli del duello dell'Arena (docs/ARENA.md §2): in alto il tabellone (le due vite coi nomi, i round vinti a pallini, il tempo
// del round), sotto la mia Magicka e Stamina; in basso la barra dei 4 slot rapidi con le 2 pozioni ai lati (tocco su telefono, tasti 1-4 e
// 5-6 o Q-R su PC); joystick di movimento, A e B di game/input.ts alzati sopra la barra; con l'arco o una magia in mano il joystick di mira
// (mira_stick.ts) al posto di A, col mouse il clic sinistro tenuto e la mira verso il cursore come nei dungeon. Menu (Esc): RIPRENDI e
// ARRENDITI (con conferma). Scritte grandi: conto alla rovescia, VIA!, round vinto o perso, e la scheda finale con l'esito e il premio.
// Solo colori di palette, bordi netti; numeri del danno, barre delle evocazioni e nome sopra l'avversario li fa dungeon_hud.ts.
import type { RunHero, RunPotion } from '@marea/sim/rpg/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { DuelloEsito, DuelloView } from '@marea/sim/arena/duello.ts';
import { spellDef } from '@marea/content/rpg.ts';
import { PAL, el } from '../ui/style.ts';
import { coloreMagia, iconOf, itemIcon } from './items_ui.ts';
import { createMiraStick } from './mira_stick.ts';

export type ArenaControlli = {
  /** Un campione per tick: A in più (clic, joystick di mira), mira, tocco veloce, Scarica (E), slot e pozione scelti adesso (null = no). */
  sample(): { a: boolean; m: number; tap: boolean; e: boolean; slot: number | null; pozione: number | null };
  miraDir(): { x: number; z: number } | null;
  setMira(on: boolean): void;
  readonly paused: boolean;
  /** Tabellone, barre, slot e pozioni dalla vista del duello. `slot` = le RunHero dei miei slot (icone), `pozioni` le mie pozioni rapide. */
  set(v: DuelloView, nomi: [string, string]): void;
  /** Scritta grande per un attimo (VIA!, ROUND VINTO…) o, con ms 0, finché non la si toglie (null). */
  grande(text: string | null, color?: string, sub?: string, ms?: number): void;
  /** La scheda finale: esito, round, premio (null = ancora non si sa); risolve quando si preme ESCI (o RIVINCITA nella stanza di prova). */
  finale(esito: DuelloEsito | null, io: number, premio: { monete: number; tetto: boolean } | null, rivincita: boolean): Promise<'esci' | 'rivincita'>;
  /** Il premio arriva dopo (dal server): si aggiorna la scheda finale già aperta. */
  premio(p: { monete: number; tetto: boolean }): void;
  /** Linea persa dell'avversario: «aspetto…» coi secondi; null = tolto. */
  attesa(text: string | null): void;
  hide(): void;
  dispose(): void;
};

const SAFE = 'env(safe-area-inset-bottom, 0px)', TOP = 'max(8px, env(safe-area-inset-top))';
const P = PAL;
const CSS = `
body.mz-arena #mzDngHud { display: none !important; }
body.mz-arena #joystick { bottom: calc(${SAFE} + 92px) !important; }
body.mz-arena #btnA, body.mz-arena #btnB { bottom: calc(${SAFE} + 96px) !important; }
body.mz-arena .mz-mira { bottom: calc(${SAFE} + 88px) !important; }
body.mz-arena.mz-dng-aimon #btnA { display: none !important; }
body.mz-arena.mz-dng-aimon #btnB { right: calc(max(16px, env(safe-area-inset-right, 0px)) + 116px) !important; }
.mz-ar-top { position: absolute; left: 50%; top: ${TOP}; transform: translateX(-50%); width: min(560px, calc(100% - 16px)); display: flex; align-items: flex-start; gap: 6px; z-index: 13; pointer-events: none !important; font-size: 12px; }
.mz-ar-lato { flex: 1; min-width: 0; padding: 4px 6px 5px; background: rgba(35,32,31,.86); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; }
.mz-ar-lato.lui { text-align: right; border-color: ${P.rosso}; }
.mz-ar-lato .nome { font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mz-ar-bar { position: relative; height: 12px; margin-top: 3px; background: ${P.ombraCalda}; border: 2px solid ${P.neroCaldo}; }
.mz-ar-bar.sottile { height: 6px; margin-top: 2px; border-width: 1px; }
.mz-ar-bar i { position: absolute; top: 0; bottom: 0; left: 0; }
.mz-ar-lato.lui .mz-ar-bar i { left: auto; right: 0; }
.mz-ar-mid { flex: none; width: 70px; padding: 3px 0 4px; background: rgba(46,30,20,.94); border: 2px solid ${P.giallo}; box-shadow: 0 3px 0 ${P.neroCaldo}; text-align: center; }
.mz-ar-mid b { display: block; font-size: 19px; }
.mz-ar-mid b.poco { color: ${P.rosso}; }
.mz-ar-dots { display: flex; justify-content: center; gap: 3px; margin-top: 2px; }
.mz-ar-dots i { width: 8px; height: 8px; background: ${P.ombraCalda}; border: 1px solid ${P.neroCaldo}; }
.mz-ar-dots i.mio { background: ${P.erbaChiara}; } .mz-ar-dots i.suo { background: ${P.rosso}; } .mz-ar-dots i.pari { background: ${P.pietra}; }
.mz-ar-barra { position: absolute; left: 50%; bottom: calc(${SAFE} + 8px); transform: translateX(-50%); display: flex; gap: 6px; z-index: 14; touch-action: none; -webkit-user-select: none; user-select: none; }
.mz-ar-barra button { position: relative; width: 52px; height: 52px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(46,30,20,.9); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.sabbiaChiara}; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mz-ar-barra button.cur { border-color: ${P.giallo}; background: rgba(110,74,32,.97); transform: translateY(-4px); }
.mz-ar-barra button.vuoto, .mz-ar-barra button.no { opacity: .45; }
.mz-ar-barra button.pz { background: rgba(44,107,63,.86); border-radius: 50%; }
.mz-ar-barra button.pz.usata { background: rgba(35,32,31,.7); opacity: .4; }
.mz-ar-barra button i { position: absolute; left: 3px; top: 1px; font: bold 11px ui-monospace, Menlo, monospace; font-style: normal; color: ${P.sabbia}; text-shadow: 1px 1px 0 ${P.neroCaldo}; }
.mz-ar-barra button b { position: absolute; right: 3px; bottom: 1px; font: bold 11px ui-monospace, Menlo, monospace; color: ${P.acquaBassa}; text-shadow: 1px 1px 0 ${P.neroCaldo}; }
.mz-ar-barra button:active { transform: translateY(2px); }
.mz-ar-menu-btn { position: absolute; right: max(8px, env(safe-area-inset-right, 0px)); top: calc(${TOP} + 66px); min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 4px; background: ${P.legnoScuro}; border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; color: ${P.sabbiaChiara}; font: bold 13px ui-monospace, Menlo, monospace; z-index: 14; cursor: pointer; }
.mz-ar-menu-btn i { display: block; width: 5px; height: 16px; background: ${P.sabbiaChiara}; box-shadow: 1px 1px 0 ${P.neroCaldo}; }
.mz-ar-box { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(330px, calc(100% - 32px)); padding: 14px 16px 16px; background: rgba(46,30,20,.97); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; z-index: 24; text-align: center; display: none; font-size: 16px; }
.mz-ar-box.on { display: block; }
.mz-ar-box > b { display: block; font-size: 24px; margin-bottom: 4px; }
.mz-ar-box .sub { color: ${P.sabbia}; font-size: 14px; margin: 2px 0 8px; }
.mz-ar-box .mz-btn { justify-content: center; }
.mz-ar-box.vinta { border-color: ${P.giallo}; } .mz-ar-box.vinta > b { color: ${P.giallo}; }
.mz-ar-box.persa { border-color: ${P.rosso}; } .mz-ar-box.persa > b { color: ${P.rosso}; }
.mz-ar-rounds { display: flex; justify-content: center; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
.mz-ar-rounds span { padding: 2px 6px; border: 2px solid ${P.neroCaldo}; font-size: 12px; font-weight: bold; }
.mz-ar-rounds .mio { background: ${P.erbaScura}; } .mz-ar-rounds .suo { background: ${P.rosso}; color: ${P.neroCaldo}; } .mz-ar-rounds .pari { background: ${P.pietraScura}; }
.mz-ar-premio { font-weight: bold; color: ${P.giallo}; min-height: 20px; margin: 6px 0 2px; }
.mz-ar-big { position: absolute; left: 50%; top: 36%; transform: translate(-50%, -50%); display: none; padding: 10px 22px; background: rgba(46,30,20,.95); border: 3px solid ${P.legnoChiaro}; box-shadow: 0 5px 0 ${P.neroCaldo}; text-align: center; z-index: 18; pointer-events: none !important; font: bold 40px ui-monospace, Menlo, monospace; white-space: nowrap; }
.mz-ar-big.on { display: block; }
.mz-ar-big small { display: block; margin-top: 4px; font-size: 14px; color: ${P.sabbia}; }
.mz-ar-attesa { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 8px 14px; background: rgba(46,30,20,.95); border: 2px solid ${P.arancio}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-weight: bold; font-size: 15px; z-index: 17; display: none; pointer-events: none !important; text-align: center; max-width: calc(100% - 32px); }
.mz-ar-attesa.on { display: block; }
`;
const ROUND = { ko: 'KO', tempo: 'TEMPO', pari: 'PARI' } as const;

/** Icona di uno slot: l'arma (o l'arco) o la magia in mano in quella RunHero; null = slot vuoto. */
function iconaSlot(rh: RunHero | null, px: number): Node | null {
  if (!rh) return null;
  if (rh.manoMagia && rh.magia !== null) { const sp = rh.magie[rh.magia]!; return itemIcon('libro', coloreMagia(sp.id, sp.scuola), px); }
  return rh.arma.id && hasItem(rh.arma.id) ? iconOf(itemDef(rh.arma.id), px) : itemIcon('arma', P.pietra, px);
}
const nomeSlot = (rh: RunHero | null): string => {
  if (!rh) return 'Slot vuoto';
  if (rh.manoMagia && rh.magia !== null) { const id = rh.magie[rh.magia]!.id; try { return spellDef(id).nome; } catch { return id; } }
  return rh.arma.id && hasItem(rh.arma.id) ? itemDef(rh.arma.id).nome : 'Pugni';
};

export function createArenaHud(o: { root: HTMLElement; canvas: HTMLCanvasElement; yaw(): number; slot: readonly (RunHero | null)[]; pozioni: readonly RunPotion[]; insieme: boolean; onResa(): void }): ArenaControlli {
  if (!document.getElementById('mz-arena-style')) { const st = document.createElement('style'); st.id = 'mz-arena-style'; st.textContent = CSS; document.head.appendChild(st); }
  document.body.classList.add('mz-arena');
  let slotL: number | null = null, pozL: number | null = null, aLatch = false, mouseA = false, eLatch = false, pausa = false, chiedi = false;
  const keys = new Set<string>();
  const btn = (cls: string, act: string, ...kids: (Node | string)[]) => { const b = el('button', cls); b.type = 'button'; b.dataset['act'] = act; b.append(...kids); return b; };
  const stop = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };

  // ---- tabellone ----
  const top = el('div', 'mz mz-ar-top'); top.id = 'mzArenaTop';
  const lato = (cls: string) => {
    const box = el('div', `mz-ar-lato ${cls}`), nome = el('div', 'nome'), vita = el('div', 'mz-ar-bar'), vi = el('i');
    vi.style.background = P.rosso; vita.append(vi); box.append(nome, vita);
    return { box, nome, vi };
  };
  const io = lato('io'), lui = lato('lui');
  const mag = el('div', 'mz-ar-bar sottile'), magI = el('i'); magI.style.background = P.acqua; mag.append(magI);
  const sta = el('div', 'mz-ar-bar sottile'), staI = el('i'); staI.style.background = P.erba; sta.append(staI);
  io.box.append(mag, sta);
  const mid = el('div', 'mz-ar-mid'), tempo = el('b', '', '0:00'), dots = el('div', 'mz-ar-dots');
  mid.append(el('span', '', 'ROUND'), tempo, dots);
  top.append(io.box, mid, lui.box);

  // ---- barra degli slot e delle pozioni ----
  const barra = el('div', 'mz mz-ar-barra'); barra.id = 'mzArenaBarra';
  const pz = o.pozioni.map((p, n) => {
    const b = btn('pz', 'pozione', ...(hasItem(p.id) ? [iconOf(itemDef(p.id), 26)] : []), el('i', '', String(5 + n)));
    b.dataset['n'] = String(n); b.title = `${hasItem(p.id) ? itemDef(p.id).nome : p.id} (tasto ${5 + n})`;
    return b;
  });
  const slots = o.slot.map((rh, n) => {
    const ico = iconaSlot(rh, 30);
    const b = btn(rh ? '' : 'vuoto', 'slot', ...(ico ? [ico] : []), el('i', '', String(n + 1)), el('b'));
    b.dataset['n'] = String(n); b.title = `${nomeSlot(rh)} (tasto ${n + 1})`; b.setAttribute('aria-label', nomeSlot(rh));
    return b;
  });
  barra.append(...(pz[0] ? [pz[0]] : []), ...slots, ...pz.slice(1));
  barra.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || pausa || chiedi) return;
    const n = Number(b.dataset['n']);
    if (b.dataset['act'] === 'slot') slotL = n; else pozL = n;
  });
  stop(barra);

  // ---- menu, resa, scritte, attesa ----
  const menuBtn = btn('mz mz-ar-menu-btn', 'menu', el('i'), el('i')); menuBtn.id = 'mzArenaMenuBtn'; menuBtn.title = 'Menu (Esc)'; menuBtn.setAttribute('aria-label', 'Menu');
  const menu = el('div', 'mz mz-ar-box'); menu.id = 'mzArenaMenu';
  const riprendi = btn('mz-btn green', 'riprendi', 'RIPRENDI'), arrenditi = btn('mz-btn ghost', 'resa', 'ARRENDITI');
  menu.append(el('b', '', o.insieme ? 'Menu' : 'Pausa'), el('div', 'sub', o.insieme ? 'Il duello non si ferma' : 'Il duello ti aspetta'), riprendi, arrenditi);
  const ask = el('div', 'mz mz-ar-box persa'); ask.id = 'mzArenaResa';
  const si = btn('mz-btn', 'si', 'MI ARRENDO'), no = btn('mz-btn ghost', 'no', 'NO, COMBATTO');
  ask.append(el('b', '', 'Arrendersi?'), el('div', 'sub', 'Il duello finisce e vince l’avversario'), no, si);
  const big = el('div', 'mz mz-ar-big'); big.id = 'mzArenaBig';
  const att = el('div', 'mz mz-ar-attesa'); att.id = 'mzArenaAttesa';
  const fine = el('div', 'mz mz-ar-box'); fine.id = 'mzArenaFine';
  for (const e of [menuBtn, menu, ask, fine]) stop(e);
  o.root.append(top, barra, menuBtn, menu, ask, big, att, fine);
  const stick = createMiraStick({ id: 'mzArenaMira', yaw: o.yaw, blocked: () => pausa || chiedi });
  const setPausa = (on: boolean) => { pausa = on; menu.classList.toggle('on', on); if (on) stick.cancel(); };
  const setChiedi = (on: boolean) => { chiedi = on; ask.classList.toggle('on', on); if (on) { setPausa(false); stick.cancel(); } };
  menuBtn.addEventListener('click', () => { if (!chiedi) setPausa(!pausa); });
  riprendi.addEventListener('click', () => setPausa(false));
  arrenditi.addEventListener('click', () => setChiedi(true));
  no.addEventListener('click', () => setChiedi(false));
  si.addEventListener('click', () => { setChiedi(false); o.onResa(); });

  const kd = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || fine.classList.contains('on')) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) { if (chiedi) setChiedi(false); else setPausa(!pausa); } return; }
    const n = /^(?:Digit|Numpad)([1-6])$/.exec(e.code)?.[1];
    const k = n ? Number(n) : e.code === 'KeyQ' ? 5 : e.code === 'KeyR' ? 6 : 0;
    if (k || e.code === 'KeyE') {
      e.preventDefault(); e.stopImmediatePropagation(); // i numeri qui non fanno le emote
      if (e.repeat || pausa || chiedi) return;
      if (e.code === 'KeyE') { eLatch = true; keys.add('KeyE'); } else if (k <= 4) slotL = k - 1; else pozL = k - 5;
    }
  };
  const ku = (e: KeyboardEvent) => { keys.delete(e.code); };
  const md = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0 && !pausa && !chiedi) { mouseA = true; aLatch = true; } };
  const mu = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) mouseA = false; };
  const blur = () => { keys.clear(); mouseA = false; stick.cancel(); };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
  o.canvas.addEventListener('pointerdown', md); addEventListener('pointerup', mu); addEventListener('blur', blur);

  let sigTop = '', sigBar = '', bigT = 0, premioEl: HTMLElement | null = null;
  const pct = (v: number, max: number) => `${Math.round(Math.max(0, Math.min(1, v / Math.max(1, max))) * 50) * 2}%`;
  return {
    get paused() { return pausa || chiedi; },
    sample() {
      const st = stick.sample();
      const out = { a: aLatch || mouseA || st.held, m: st.m, tap: st.tap, e: eLatch || keys.has('KeyE'), slot: slotL, pozione: pozL };
      aLatch = eLatch = false; slotL = pozL = null;
      return out;
    },
    miraDir: () => stick.dir(),
    setMira(on) { document.body.classList.toggle('mz-dng-aimon', stick.setOn(on)); },
    set(v, nomi) {
      const h = v.dungeon.hero, sec = v.secondi;
      const sig = `${nomi.join('|')}|${Math.ceil(h.vita)}|${Math.ceil(v.lui.vita)}|${Math.round(h.magicka)}|${Math.round(h.stamina)}|${v.fase}|${sec}|${v.rounds.length}`;
      if (sig !== sigTop) {
        sigTop = sig;
        if (io.nome.textContent !== nomi[0]) io.nome.textContent = nomi[0];
        if (lui.nome.textContent !== nomi[1]) lui.nome.textContent = nomi[1];
        io.vi.style.width = pct(h.vita, h.max.vita); lui.vi.style.width = pct(v.lui.vita, v.lui.max);
        magI.style.width = pct(h.magicka, h.max.magicka); staI.style.width = pct(h.stamina, h.max.stamina);
        tempo.textContent = v.fase === 'gioca' ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : v.fase === 'conta' ? String(sec) : '—';
        tempo.classList.toggle('poco', v.fase === 'gioca' && sec <= 10);
        const io0 = v.dungeon.io;
        dots.replaceChildren(...v.rounds.map((r) => el('i', r.vincitore === null ? 'pari' : r.vincitore === io0 ? 'mio' : 'suo')));
      }
      const sb = `${v.slot}|${v.frecce.join(',')}|${v.bevute.join(',')}|${Math.floor(h.magicka)}|${v.fase}`;
      if (sb === sigBar) return;
      sigBar = sb;
      slots.forEach((b, n) => {
        const rh = o.slot[n] ?? null;
        b.classList.toggle('cur', n === v.slot);
        let cnt = '';
        if (rh?.manoMagia && rh.magia !== null) { const sp = rh.magie[rh.magia]!; cnt = `${sp.costo}${sp.forma === 'raggio' ? '/s' : ''}`; b.classList.toggle('no', h.magicka < sp.costo); }
        else if (rh?.arma.kind === 'arco') { cnt = String(v.frecce[n] ?? 0); b.classList.toggle('no', (v.frecce[n] ?? 0) <= 0); }
        (b.lastChild as HTMLElement).textContent = cnt;
      });
      pz.forEach((b, n) => b.classList.toggle('usata', !!v.bevute[n] || v.fase !== 'gioca'));
    },
    grande(text, color = P.sabbiaChiara, sub = '', ms = 1200) {
      clearTimeout(bigT);
      if (!text) { big.classList.remove('on'); return; }
      big.replaceChildren(text, ...(sub ? [el('small', '', sub)] : []));
      big.style.color = color; big.classList.add('on');
      if (ms > 0) bigT = window.setTimeout(() => big.classList.remove('on'), ms);
    },
    finale(esito, ioN, premio, rivincita) {
      setPausa(false); setChiedi(false); stick.cancel(); big.classList.remove('on');
      const vinta = !!esito && esito.vincitore === ioN, persa = !!esito && esito.vincitore !== null && esito.vincitore !== ioN;
      fine.className = `mz mz-ar-box on ${vinta ? 'vinta' : persa ? 'persa' : ''}`;
      const titolo = !esito ? 'DUELLO ANNULLATO' : vinta ? 'VITTORIA!' : persa ? 'SCONFITTA' : 'PAREGGIO';
      const perche = !esito ? 'Il duello si è interrotto' : esito.perche === 'resa' ? (vinta ? 'L’avversario si è arreso' : 'Ti sei arreso') : `${esito.vinti[ioN] ?? 0} a ${esito.vinti[1 - ioN] ?? 0}`;
      premioEl = el('div', 'mz-ar-premio', premio ? testoPremio(premio) : o.insieme ? '…' : 'Allenamento: niente premio');
      const esci = btn('mz-btn green', 'esci', 'ESCI'), riv = btn('mz-btn ghost', 'rivincita', 'RIVINCITA');
      fine.replaceChildren(el('b', '', titolo), el('div', 'sub', perche), premioEl, ...(rivincita ? [riv] : []), esci);
      return new Promise((res) => {
        const chiudi = (v: 'esci' | 'rivincita') => { fine.classList.remove('on'); removeEventListener('keydown', kf, true); res(v); };
        const kf = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); chiudi('esci'); } };
        esci.addEventListener('click', () => chiudi('esci')); riv.addEventListener('click', () => chiudi('rivincita'));
        addEventListener('keydown', kf, true);
      });
    },
    premio(p) { if (premioEl) premioEl.textContent = testoPremio(p); },
    attesa(text) { att.textContent = text ?? ''; att.classList.toggle('on', !!text); },
    hide() { setPausa(false); setChiedi(false); stick.setOn(false); document.body.classList.remove('mz-dng-aimon'); for (const e of [barra, menuBtn, att]) e.style.display = 'none'; },
    dispose() {
      clearTimeout(bigT);
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      o.canvas.removeEventListener('pointerdown', md); removeEventListener('pointerup', mu); removeEventListener('blur', blur);
      stick.dispose(); document.body.classList.remove('mz-arena', 'mz-dng-aimon');
      for (const e of [top, barra, menuBtn, menu, ask, big, att, fine]) e.remove();
    },
  };
}
const testoPremio = (p: { monete: number; tetto: boolean }) => (p.monete > 0 ? `+${p.monete} monete${p.tetto ? ' (tetto di oggi)' : ''}` : p.tetto ? 'Tetto di oggi raggiunto: niente monete' : 'Niente monete stavolta');
export { ROUND };
