// HUD e controlli delle partite dell'Arena (docs/ARENA.md §2): in alto il tabellone (a sinistra la mia barra di vita col
// nome; a destra, solo nella Sopravvivenza, quante squadre sono ancora in piedi; in mezzo il tempo e i punti della modalità: stelle,
// % di conquista, % della cassaforte, il mio numero di monete rosse), sotto la mia Magicka e Stamina; un cartello dice se sono nell'erba alta o
// nel Velo (nessun avversario mi vede), nella nube tossica, a terra (fra quanto rinasco) o fuori (a che posto); in basso la barra degli slot col
// bottone tondo dell'ulti che si riempie (tocco su telefono, tasti 1-2 e F su PC); joystick di movimento, A e B di game/input.ts alzati sopra la
// barra; con l'arco o una magia in mano il joystick di mira (mira_stick.ts) al posto di A, col mouse il clic sinistro tenuto e la mira verso il
// cursore come nei dungeon. Menu (Esc): RIPRENDI e ARRENDITI (con conferma). Scritte grandi: conto alla rovescia, VIA!, stelle prese, zone,
// e la scheda finale con l'esito e il premio.
// Solo colori di palette, bordi netti; numeri del danno, barre delle evocazioni e nome sopra l'avversario li fa dungeon_hud.ts.
import type { RunHero } from '@marea/sim/rpg/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { PartitaEsito, PartitaView } from '@marea/sim/arena/partita.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import { spellDef } from '@marea/content/rpg.ts';
import { arenaUlti } from '@marea/content/arena.ts';
import { PAL, el } from '../ui/style.ts';
import { iconaMagia, iconOf, itemIcon } from './items_ui.ts';
import { createMiraStick } from './mira_stick.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';

export type ArenaControlli = {
  /** Un campione per tick: A in più (clic, joystick di mira), mira, tocco veloce, Scarica (E), slot scelto adesso (null = no), ulti premuta. */
  sample(): { a: boolean; m: number; tap: boolean; e: boolean; slot: number | null; ulti: boolean };
  miraDir(): { x: number; z: number } | null;
  setMira(on: boolean): void;
  readonly paused: boolean;
  /** Tabellone, barre, slot e ulti dalla vista della partita. `slot` = le RunHero dei miei slot (icone), `ulti` = l'id della mia. */
  set(v: PartitaView, nomi: readonly string[]): void;
  /** Scritta grande per un attimo (VIA!, ZONA CONQUISTATA…) o, con ms 0, finché non la si toglie (null). */
  grande(text: string | null, color?: string, sub?: string, ms?: number): void;
  /** La scheda finale: esito, punti, premio (null = ancora non si sa); risolve quando si preme ESCI (o RIVINCITA nell'allenamento). */
  finale(esito: PartitaEsito | null, mia: number, premio: { monete: number; tetto: boolean } | null, rivincita: boolean): Promise<'esci' | 'rivincita'>;
  /** Il premio arriva dopo (dal server): si aggiorna la scheda finale già aperta. */
  premio(p: { monete: number; tetto: boolean }): void;
  /** Linea persa di un giocatore: «aspetto…» coi secondi; null = tolto. */
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
body.mz-arena #btnSchiva { bottom: calc(${SAFE} + 190px) !important; }
body.mz-arena.mz-dng-aimon #btnSchiva { right: calc(max(16px, env(safe-area-inset-right, 0px)) + 30px) !important; bottom: calc(${SAFE} + 236px) !important; }
body.mz-arena .mz-mira { bottom: calc(${SAFE} + 88px) !important; }
body.mz-arena.mz-dng-aimon #btnA { display: none !important; }
body.mz-arena.mz-dng-aimon #btnB { right: calc(max(16px, env(safe-area-inset-right, 0px)) + 116px) !important; }
.mz-ar-top { position: absolute; left: 50%; top: ${TOP}; transform: translateX(-50%); width: max-content; max-width: calc(100% - 16px); display: flex; align-items: flex-start; gap: 6px; z-index: 13; pointer-events: none !important; font-size: 12px; }
.mz-ar-lato { flex: 1; min-width: 0; padding: 4px 6px 5px; background: ${L.carta}; border: 2px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; }
.mz-ar-lato.io { flex: none; width: 170px; }
.mz-ar-lato.lui { flex: none; width: 96px; text-align: right; border-color: ${L.rosso}; }
.mz-ar-lato .nome { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mz-ar-lato .eroe.giu { opacity: .45; }
.mz-ar-badge { position: absolute; left: 50%; top: calc(${TOP} + 74px); transform: translateX(-50%); padding: 4px 12px; background: ${L.carta}; border: 2px solid ${L.acqua}; box-shadow: 0 3px 0 ${L.inchiostro}; font-weight: 700; font-size: 13px; z-index: 13; pointer-events: none !important; display: none; white-space: nowrap; }
.mz-ar-badge.on { display: block; }
.mz-ar-badge.giu { border-color: ${L.rosso}; }
.mz-ar-bar { position: relative; height: 12px; margin-top: 3px; background: ${L.cartaScura}; border: 2px solid ${L.inchiostro}; }
.mz-ar-bar.sottile { height: 6px; margin-top: 2px; border-width: 1px; }
.mz-ar-bar i { position: absolute; top: 0; bottom: 0; left: 0; }
.mz-ar-lato.lui .mz-ar-bar i { left: auto; right: 0; }
.mz-ar-mid { flex: none; width: 96px; padding: 3px 0 4px; background: ${L.carta}; border: 2px solid ${L.acqua}; box-shadow: 0 3px 0 ${L.inchiostro}; text-align: center; }
.mz-ar-mid b { display: block; font-size: 19px; }
.mz-ar-mid b.poco { color: ${L.rosso}; }
.mz-ar-mid span { font-size: 10px; letter-spacing: .5px; }
.mz-ar-punti { display: flex; justify-content: center; align-items: center; gap: 4px; margin-top: 1px; font-weight: 700; font-size: 13px; }
.mz-ar-punti .mio { color: ${L.acquaScura}; } .mz-ar-punti .suo { color: ${L.rosso}; }
.mz-ar-lato.vive { flex: none; width: auto; min-width: 74px; text-align: center; }
.mz-ar-lato.vive b { display: block; font-size: 19px; }
.mz-ar-barra { position: absolute; left: 50%; bottom: calc(${SAFE} + 8px); transform: translateX(-50%); display: flex; gap: 6px; z-index: 14; touch-action: none; -webkit-user-select: none; user-select: none; }
.mz-ar-barra button { position: relative; width: 52px; height: 52px; padding: 0; display: flex; align-items: center; justify-content: center; background: ${L.carta}; border: 3px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; color: ${L.inchiostro}; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mz-ar-barra button.cur { border-color: ${L.acqua}; background: rgba(110,74,32,.97); transform: translateY(-4px); }
.mz-ar-barra button.vuoto, .mz-ar-barra button.no { opacity: .45; }
.mz-ar-barra button.ul { width: 60px; height: 60px; margin-top: -8px; border-radius: 50%; overflow: hidden; background: ${L.cartaScura}; border-color: ${L.oroScuro}; font: 700 10px ${FONT_LIBRO}; }
.mz-ar-barra button.ul > u { position: absolute; left: 0; right: 0; bottom: 0; background: ${L.oroChiaro}; text-decoration: none; }
.mz-ar-barra button.ul > span { position: relative; text-align: center; line-height: 1; padding: 0 3px; text-shadow: 1px 1px 0 ${L.cartaChiara}; }
.mz-ar-barra button.ul.pronta { border-color: ${L.acqua}; box-shadow: 0 0 0 3px ${L.oroChiaro}, 0 3px 0 ${L.inchiostro}; }
.mz-ar-barra button.ul.attiva { border-color: ${L.rosso}; }
.mz-ar-barra button i { position: absolute; left: 3px; top: 1px; font: 700 11px ${FONT_LIBRO}; font-style: normal; color: ${L.inchiostro2}; text-shadow: 1px 1px 0 ${L.inchiostro}; }
.mz-ar-barra button b { position: absolute; right: 3px; bottom: 1px; font: 700 11px ${FONT_LIBRO}; color: ${P.acquaBassa}; text-shadow: 1px 1px 0 ${L.inchiostro}; }
.mz-ar-barra button:active { transform: translateY(2px); }
.mz-ar-menu-btn { position: absolute; right: max(8px, env(safe-area-inset-right, 0px)); top: calc(${TOP} + 66px); min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 4px; background: ${L.cartaChiara}; border: 2px solid ${L.oro}; box-shadow: 0 3px 0 ${L.inchiostro}; color: ${L.inchiostro}; font: 700 13px ${FONT_LIBRO}; z-index: 14; cursor: pointer; }
.mz-ar-menu-btn i { display: block; width: 5px; height: 16px; background: ${L.cartaChiara}; box-shadow: 1px 1px 0 ${L.inchiostro}; }
.mz-ar-box { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(330px, calc(100% - 32px)); padding: 14px 16px 16px; background: ${L.carta}; border: 3px solid ${L.oro}; box-shadow: 0 5px 0 ${L.inchiostro}; z-index: 24; text-align: center; display: none; font-size: 16px; }
.mz-ar-box.on { display: block; }
.mz-ar-box > b { display: block; font-size: 24px; margin-bottom: 4px; }
.mz-ar-box .sub { color: ${L.inchiostro2}; font-size: 14px; margin: 2px 0 8px; }
.mz-ar-box .mz-btn { justify-content: center; }
.mz-ar-box.vinta { border-color: ${L.acqua}; } .mz-ar-box.vinta > b { color: ${L.acquaScura}; }
.mz-ar-box.persa { border-color: ${L.rosso}; } .mz-ar-box.persa > b { color: ${L.rosso}; }
.mz-ar-premio { font-weight: 700; color: ${L.acquaScura}; min-height: 20px; margin: 6px 0 2px; }
.mz-ar-big { position: absolute; left: 50%; top: 36%; transform: translate(-50%, -50%); display: none; padding: 10px 22px; background: ${L.carta}; border: 3px solid ${L.oro}; box-shadow: 0 5px 0 ${L.inchiostro}; text-align: center; z-index: 18; pointer-events: none !important; font: 700 40px ${FONT_LIBRO}; white-space: nowrap; }
.mz-ar-big.on { display: block; }
.mz-ar-big small { display: block; margin-top: 4px; font-size: 14px; color: ${L.inchiostro2}; }
.mz-ar-attesa { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 8px 14px; background: ${L.carta}; border: 2px solid ${L.oroScuro}; box-shadow: 0 3px 0 ${L.inchiostro}; font-weight: 700; font-size: 15px; z-index: 17; display: none; pointer-events: none !important; text-align: center; max-width: calc(100% - 32px); }
.mz-ar-attesa.on { display: block; }
`;

/** Icona di uno slot: l'arma (o l'arco) o la magia in mano in quella RunHero; null = slot vuoto. */
function iconaSlot(rh: RunHero | null, px: number): Node | null {
  if (!rh) return null;
  if (rh.manoMagia && rh.magia !== null) { const sp = rh.magie[rh.magia]!; return iconaMagia(sp.id, px); }
  return rh.arma.id && hasItem(rh.arma.id) ? iconOf(itemDef(rh.arma.id), px) : itemIcon('arma', P.pietra, px);
}
const nomeSlot = (rh: RunHero | null): string => {
  if (!rh) return 'Slot vuoto';
  if (rh.manoMagia && rh.magia !== null) { const id = rh.magie[rh.magia]!.id; try { return spellDef(id).nome; } catch { return id; } }
  return rh.arma.id && hasItem(rh.arma.id) ? itemDef(rh.arma.id).nome : 'Pugni';
};

export function createArenaHud(o: { root: HTMLElement; canvas: HTMLCanvasElement; yaw(): number; slot: readonly (RunHero | null)[]; ulti: string; insieme: boolean; squadre: readonly number[]; io: number; modo: ArenaModo; onResa(): void }): ArenaControlli {
  if (!document.getElementById('mz-arena-style')) { const st = document.createElement('style'); st.id = 'mz-arena-style'; st.textContent = CSS; document.head.appendChild(st); }
  document.body.classList.add('mz-arena');
  let slotL: number | null = null, ultiL = false, aLatch = false, mouseA = false, eLatch = false, pausa = false, chiedi = false;
  const keys = new Set<string>();
  const btn = (cls: string, act: string, ...kids: (Node | string)[]) => { const b = el('button', cls); b.type = 'button'; b.dataset['act'] = act; b.append(...kids); return b; };
  const stop = (e: HTMLElement) => { for (const ev of ['pointerdown', 'touchstart']) e.addEventListener(ev, (x) => x.stopPropagation()); };

  // ---- tabellone ----
  const top = el('div', 'mz mz-ar-top'); top.id = 'mzArenaTop';
  const mia = o.squadre[o.io]!, grandi = o.squadre.filter((q) => q === mia).length;
  /** Il tabellone mostra solo la mia vita (nome e barra): quelle degli altri tolgono troppo spazio, soprattutto col telefono in orizzontale. */
  const riga = el('div', 'eroe'), nome = el('div', 'nome'), vita = el('div', 'mz-ar-bar'), vi = el('i');
  vi.style.background = P.rosso; vita.append(vi); riga.append(nome, vita);
  const io = { box: el('div', 'mz-ar-lato io'), righe: [{ j: o.io, riga, nome, vi }] };
  io.box.append(riga);
  const nSquadre = new Set(o.squadre).size, lui = { box: el('div', 'mz-ar-lato lui vive') };
  const vive = el('b', '', String(nSquadre));
  if (nSquadre > 2) lui.box.append(el('span', '', 'IN PIEDI'), vive);
  const mag = el('div', 'mz-ar-bar sottile'), magI = el('i'); magI.style.background = P.acqua; mag.append(magI);
  const sta = el('div', 'mz-ar-bar sottile'), staI = el('i'); staI.style.background = P.erba; sta.append(staI);
  io.box.append(mag, sta);
  const mid = el('div', 'mz-ar-mid'), tempo = el('b', '', '0:00'), punti = el('div', 'mz-ar-punti');
  mid.append(el('span', '', ETICHETTA[o.modo]), tempo, punti);
  top.append(io.box, mid);
  if (nSquadre > 2) top.append(lui.box); // solo «IN PIEDI» (Sopravvivenza): a due squadre l'altro lato non c'è
  const badge = el('div', 'mz mz-ar-badge'); badge.id = 'mzArenaBadge';

  // ---- barra degli slot e dell'ulti ----
  const barra = el('div', 'mz mz-ar-barra'); barra.id = 'mzArenaBarra';
  const U = arenaUlti(o.ulti), ultiFill = el('u');
  const ultiB = btn('ul', 'ulti', ultiFill, el('span', '', U.nome.split(' ')[0]!.toUpperCase()), el('i', '', 'F'));
  ultiB.title = `${U.nome}: ${U.descr} (tasto F)`; ultiB.setAttribute('aria-label', U.nome);
  const slots = o.slot.map((rh, n) => {
    const ico = iconaSlot(rh, 30);
    const b = btn(rh ? '' : 'vuoto', 'slot', ...(ico ? [ico] : []), el('i', '', String(n + 1)), el('b'));
    b.dataset['n'] = String(n); b.title = `${nomeSlot(rh)} (tasto ${n + 1})`; b.setAttribute('aria-label', nomeSlot(rh));
    return b;
  });
  barra.append(...slots, ultiB);
  barra.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || pausa || chiedi) return;
    if (b.dataset['act'] === 'slot') slotL = Number(b.dataset['n']); else ultiL = true;
  });
  stop(barra);

  // ---- menu, resa, scritte, attesa ----
  const menuBtn = btn('mz mz-ar-menu-btn', 'menu', el('i'), el('i')); menuBtn.id = 'mzArenaMenuBtn'; menuBtn.title = 'Menu (Esc)'; menuBtn.setAttribute('aria-label', 'Menu');
  const menu = el('div', 'mz mz-ar-box'); menu.id = 'mzArenaMenu';
  const riprendi = btn('mz-btn green', 'riprendi', 'RIPRENDI'), arrenditi = btn('mz-btn ghost', 'resa', 'ARRENDITI');
  menu.append(el('b', '', o.insieme ? 'Menu' : 'Pausa'), el('div', 'sub', o.insieme ? 'La partita non si ferma' : 'La partita ti aspetta'), riprendi, arrenditi);
  const ask = el('div', 'mz mz-ar-box persa'); ask.id = 'mzArenaResa';
  const si = btn('mz-btn', 'si', 'MI ARRENDO'), no = btn('mz-btn ghost', 'no', 'NO, COMBATTO');
  ask.append(el('b', '', 'Arrendersi?'), el('div', 'sub', grandi > 1 ? 'Esci dalla partita: i tuoi compagni continuano senza di te' : 'Esci dalla partita: gli altri continuano'), no, si);
  const big = el('div', 'mz mz-ar-big'); big.id = 'mzArenaBig';
  const att = el('div', 'mz mz-ar-attesa'); att.id = 'mzArenaAttesa';
  const fine = el('div', 'mz mz-ar-box'); fine.id = 'mzArenaFine';
  for (const e of [menuBtn, menu, ask, fine]) stop(e);
  o.root.append(top, badge, barra, menuBtn, menu, ask, big, att, fine);
  if (nSquadre === 2) menuBtn.style.top = TOP; // senza il lato destro il menu sta in alto a destra
  const stick = createMiraStick({ id: 'mzArenaMira', yaw: o.yaw, blocked: () => pausa || chiedi });
  stop(stick.el); o.root.append(stick.el);
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
    const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
    const k = n ? Number(n) : 0;
    if (k || e.code === 'KeyE' || e.code === 'KeyF') {
      e.preventDefault(); e.stopImmediatePropagation(); // i numeri qui non fanno le emote
      if (e.repeat || pausa || chiedi) return;
      if (e.code === 'KeyE') { eLatch = true; keys.add('KeyE'); } else if (e.code === 'KeyF') ultiL = true; else if (k <= o.slot.length) slotL = k - 1;
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
      const out = { a: aLatch || mouseA || st.held, m: st.m, tap: st.tap, e: eLatch || keys.has('KeyE'), slot: slotL, ulti: ultiL };
      aLatch = eLatch = ultiL = false; slotL = null;
      return out;
    },
    miraDir: () => stick.dir(),
    setMira(on) { document.body.classList.toggle('mz-dng-aimon', stick.setOn(on)); },
    set(v, nomi) {
      const h = v.dungeon.hero, sec = v.secondi, giu = h.vita <= 0;
      const vita = (j: number) => (j === o.io ? { vita: h.vita, max: h.max.vita, giu } : v.altri.find((a) => a.i === j) ?? { vita: 0, max: 1, giu: true });
      const fuoriNube = !!v.nube && !giu && (h.x - v.nube.x) ** 2 + (h.z - v.nube.z) ** 2 > v.nube.r * v.nube.r;
      const sig = `${nomi.join('|')}|${Math.ceil(h.vita)}|${Math.ceil(h.max.vita)}|${Math.round(h.magicka)}|${Math.round(h.stamina)}|${v.fase}|${sec}|${v.punti.map(Math.floor).join(',')}|${v.nascosto}|${v.torna}|${v.fuori}|${v.vive}|${v.segno}|${fuoriNube}`;
      if (sig !== sigTop) {
        sigTop = sig;
        for (const r of io.righe) {
          if (r.nome.textContent !== nomi[r.j]) r.nome.textContent = nomi[r.j] ?? '';
          const x = vita(r.j);
          r.vi.style.width = pct(x.vita, x.max); r.riga.classList.toggle('giu', x.giu);
        }
        magI.style.width = pct(h.magicka, h.max.magicka); staI.style.width = pct(h.stamina, h.max.stamina);
        tempo.textContent = v.fase === 'gioca' ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : v.fase === 'conta' ? String(sec) : '—';
        tempo.classList.toggle('poco', v.fase === 'gioca' && sec <= 10);
        punti.replaceChildren(...puntiDi(v, mia));
        vive.textContent = String(v.vive);
        // cartello: a terra (fra quanto rinasci, o a che posto sei uscito), nella nube, nell'erba alta (nessun avversario ti vede)
        const velo = v.ulti[o.io]?.id === 'velo' && v.ulti[o.io]?.fase === 'su', posto = v.modo === 'sopravvivenza' ? v.punti[mia] ?? 0 : 0;
        const testo = giu && v.fase === 'gioca' ? (v.torna ? `RINASCI TRA ${v.torna}` : posto ? `SEI FUORI: ${posto}° POSTO` : 'SEI A TERRA') : fuoriNube ? 'NELLA NUBE: TORNA DENTRO!' : v.nascosto ? (velo ? 'NEL VELO: NON TI VEDONO' : 'NELL’ERBA: NON TI VEDONO') : '';
        badge.textContent = testo; badge.classList.toggle('on', !!testo); badge.classList.toggle('giu', giu || fuoriNube);
        if (testo) badge.style.top = `${Math.round(top.getBoundingClientRect().bottom) + 8}px`; // sotto il tabellone, alto quanto serve
      }
      const ul = v.ulti[o.io], sb = `${v.slot}|${v.frecce.join(',')}|${Math.floor(h.magicka)}|${v.fase}|${ul ? `${Math.round(ul.carica * 20)}${ul.fase}` : ''}`;
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
      // l'ulti: si riempie dal basso a scatti di 5%, pronta = bordo acceso, attiva = bordo rosso
      ultiFill.style.height = `${Math.round((ul?.carica ?? 0) * 20) * 5}%`;
      ultiB.classList.toggle('pronta', !!ul && ul.carica >= 1 && ul.fase === 'no');
      ultiB.classList.toggle('attiva', !!ul && ul.fase !== 'no');
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
      const titolo = !esito ? 'PARTITA ANNULLATA' : vinta ? 'VITTORIA!' : persa ? 'SCONFITTA' : 'PAREGGIO';
      const perche = !esito ? 'La partita si è interrotta' : percheDi(o.modo, esito, ioN, vinta, grandi > 1);
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
    hide() { setPausa(false); setChiedi(false); stick.setOn(false); document.body.classList.remove('mz-dng-aimon'); for (const e of [barra, menuBtn, att, badge]) e.style.display = 'none'; },
    dispose() {
      clearTimeout(bigT);
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      o.canvas.removeEventListener('pointerdown', md); removeEventListener('pointerup', mu); removeEventListener('blur', blur);
      stick.dispose(); document.body.classList.remove('mz-arena', 'mz-dng-aimon');
      for (const e of [top, badge, barra, menuBtn, menu, ask, big, att, fine]) e.remove();
    },
  };
}
const testoPremio = (p: { monete: number; tetto: boolean }) => (p.monete > 0 ? `+${p.monete} monete${p.tetto ? ' (tetto di oggi)' : ''}` : p.tetto ? 'Tetto di oggi raggiunto: niente monete' : 'Niente monete stavolta');

/** L'etichetta della modalità in mezzo al tabellone. */
const ETICHETTA: Record<ArenaModo, string> = { sopravvivenza: 'SOPRAVVIVENZA', stelle: 'STELLE', controllo: 'CONTROLLO', rapina: 'CASSAFORTE' };
/** I punti sotto il tempo: le stelle o le % mie e dell'altra squadra; nella Sopravvivenza niente (sono a destra). */
function puntiDi(v: PartitaView, mia: number): Node[] {
  if (v.modo === 'sopravvivenza' || v.nSquadre !== 2) return [];
  const f = (n: number) => (v.modo === 'stelle' ? `★${Math.round(n)}` : `${Math.floor(n)}%`);
  return [el('i', 'mio', f(v.punti[mia] ?? 0)), el('i', '', '·'), el('i', 'suo', f(v.punti[1 - mia] ?? 0))];
}
/** Il perché sotto VITTORIA o SCONFITTA. */
function percheDi(modo: ArenaModo, e: PartitaEsito, mia: number, vinta: boolean, squadra: boolean): string {
  const io = e.punti[mia] ?? 0, lui = e.punti[1 - mia] ?? 0;
  if (e.perche === 'resa') return vinta ? (squadra ? 'Gli avversari si sono arresi' : 'Gli altri si sono arresi') : squadra ? 'La tua squadra si è arresa' : 'Ti sei arreso';
  if (modo === 'sopravvivenza') return vinta ? (e.perche === 'tempo' ? 'Tempo scaduto: avevi più vita di tutti' : 'Ultimo in piedi!') : io ? `${io}° posto su ${e.punti.length}` : 'Pari: siete caduti insieme';
  if (e.perche === 'cassaforte') return vinta ? 'Avete rotto la cassaforte avversaria' : 'Hanno rotto la vostra cassaforte';
  if (e.perche === 'zone') return vinta ? 'Avete conquistato tutte le zone' : 'Hanno conquistato tutte le zone';
  if (modo === 'stelle') return `${Math.round(io)} stelle a ${Math.round(lui)}`;
  if (modo === 'controllo') return `Conquista ${Math.floor(io)}% a ${Math.floor(lui)}%`;
  return `Cassaforte al ${Math.floor(io)}% contro il ${Math.floor(lui)}%`;
}
