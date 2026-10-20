// Il pannello delle botteghe del Borgo: Fabbro, Alchimista, Cantiere navale. Passa dal kit dell'interfaccia (ui/kit.ts, stile «libro
// illustrato»): carta crema col bordo d'oro, ritratto del bottegaio con la sua battuta, schede, righe con l'icona nel riquadro del colore
// della rarità, prezzo con la moneta e il bottone verde acqua, in fondo quando cambia la merce.
// Schede: Oggi (vetrina del giorno + la roba di sempre) per tutte; Forgia e Livello dal Fabbro; Pozioni dall'Alchimista; Barca al Cantiere.
// Merce: POST /api/rpg (`vetrina`, `compra`, `forgia`, `alchimia`), vernici POST /api/barca/colore, livelli POST /api/lot/bottega/migliora.
// Chunk scaricato alla prima apertura (game/botteghe.ts).
import { AVATAR } from '@marea/content';
import { BOTTEGHE } from '@marea/content/botteghe.ts';
import type { BottegaId } from '@marea/content/botteghe.ts';
import { MATERIALS, RECIPES } from '@marea/content/rpg.ts';
import type { LotState } from '@marea/sim';
import { prezzoInMonete } from '@marea/sim';
import { finoAMezzanotte } from '@marea/sim/economy/giorno.ts';
import { livelloBottega, prossimoLivello, vetrinaBottega } from '@marea/sim/economy/botteghe.ts';
import { possiedeColore } from '@marea/sim/economy/barca.ts';
import { prezzoVetrina, sempreInVendita, vetrinaOggetti } from '@marea/sim/rpg/botteghe.ts';
import { available } from '@marea/sim/rpg/bag.ts';
import { modsOf } from '@marea/sim/rpg/derived.ts';
import { heroOf } from '@marea/sim/rpg/hero.ts';
import { ITEMS, hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ItemDef, RpgAction } from '@marea/sim/rpg/types.ts';
import { iconOf } from './items_ui.ts';
import { ApiError } from '../net/api.ts';
import type { Api, Me } from '../net/api.ts';
import type { Hud } from '../ui/hud.ts';
import { el } from '../ui/style.ts';
import { FONT_LIBRO, LIBRO, bottoneKit, cartaKit, fermaTocchi, injectKit, rigaKit, schedeKit } from '../ui/kit.ts';
import { canvasInsegna } from '../render/botteghe_forme.ts';
import { registerStateProvider } from '../test/testapi.ts';

export type BottegaUi = { apri(id: BottegaId): void; isOpen(): boolean; close(): void; readonly kind: BottegaId | null; state(): unknown };
export type BottegaUiOpts = { api: Api | null; me: Me | null; hud: Hud; root: HTMLElement; getLot(): LotState | null; setLot(l: LotState): void; onClose(): void };

type Tab = 'oggi' | 'forgia' | 'livello' | 'pozioni' | 'barca';
const TABS: Record<BottegaId, { id: Tab; nome: string }[]> = {
  fabbro: [{ id: 'oggi', nome: 'Oggi' }, { id: 'forgia', nome: 'Forgia' }, { id: 'livello', nome: 'Livello' }],
  alchimista: [{ id: 'oggi', nome: 'Oggi' }, { id: 'pozioni', nome: 'Pozioni' }],
  cantiere: [{ id: 'oggi', nome: 'Oggi' }, { id: 'barca', nome: 'Barca' }],
};
/** Bordo del riquadro dell'icona per rarità (il materiale, o il tipo per pozioni e ingredienti). */
const RARITA = { comune: '#C9CED8', raro: '#3DF5FF', epico: '#A64DFF', leggendario: '#F6C21C' } as const;
function rarita(it: ItemDef): string {
  const m = it.materiale;
  if (m === 'argento' || m === 'vetro') return RARITA.raro;
  if (m === 'oro') return RARITA.leggendario;
  if (m === 'ossa' || m === 'meteorite' || it.unico) return RARITA.epico;
  if (it.kind === 'ingrediente') return ['essenza_vuoto', 'polvere_ossa', 'fungo_luminoso'].includes(it.id) ? RARITA.raro : RARITA.comune;
  if (it.kind === 'pozione') return /grande|forza/.test(it.id) ? RARITA.epico : /minore/.test(it.id) ? RARITA.comune : RARITA.raro;
  return RARITA.comune;
}

/** Il ritratto e la battuta del bottegaio: in cima alla carta, sotto il titolo. */
const CSS = `
#mzBottega .mk-carta { max-height: 66%; }
@media (min-width: 700px) { #mzBottega .mk-carta { max-height: 80%; } }
#mzBottega .bt-chi { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
#mzBottega .bt-ritratto { flex: 0 0 auto; width: 64px; height: 64px; border-radius: 10px; border: 2px solid ${LIBRO.oro}; box-shadow: 0 0 0 1.5px ${LIBRO.inchiostro}; background: ${LIBRO.cartaScura} center / cover no-repeat; image-rendering: pixelated; }
#mzBottega .bt-bolla { position: relative; flex: 1; min-height: 44px; display: flex; align-items: center; padding: 6px 10px; border-radius: 12px; border: 1.5px solid ${LIBRO.oro}; background: ${LIBRO.cartaChiara}; font: italic 400 14px ${FONT_LIBRO}; line-height: 1.2; }
#mzBottega .bt-bolla::before { content: ''; position: absolute; left: -7px; top: 50%; width: 10px; height: 10px; margin-top: -5px; background: ${LIBRO.cartaChiara}; border-left: 1.5px solid ${LIBRO.oro}; border-bottom: 1.5px solid ${LIBRO.oro}; transform: rotate(45deg); }
#mzBottega .mk-ico .n { font: 700 22px ${FONT_LIBRO}; color: ${LIBRO.inchiostro}; }
`;

function fraTempo(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000)), h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

export function createBottegaUi(o: BottegaUiOpts): BottegaUi {
  injectKit();
  if (!document.getElementById('mz-bottega-ui-style')) { const st = document.createElement('style'); st.id = 'mz-bottega-ui-style'; st.textContent = CSS; document.head.appendChild(st); }
  const box = fermaTocchi(el('div', 'mk-velo')); box.id = 'mzBottega'; box.setAttribute('role', 'dialog');
  box.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  box.addEventListener('click', (e) => { if (e.target === box) close(); }); // tocco fuori dalla carta = chiudi
  o.root.appendChild(box);
  let kind: BottegaId | null = null, tab: Tab = 'oggi', busy = false, battuta = '', mat = 'bronzo', cat = 'leggere', scroll = 0;
  const adesso = (): number => o.api?.serverNow() ?? Date.now();
  const lot = (): LotState | null => o.getLot();

  function onKey(e: KeyboardEvent): void {
    if (!kind) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
  }
  window.addEventListener('keydown', onKey, true);

  function errore(e: unknown): string { return e instanceof ApiError || e instanceof Error ? e.message || 'Non riuscito: riprova' : 'Non riuscito: riprova'; }
  function fai(p: () => Promise<LotState>, ok: (l: LotState) => string): void {
    if (busy) return;
    if (!o.api) { o.hud.toast('Le botteghe vendono solo a chi ha un\'isola: apri MAREA col tuo link personale', 3000); return; }
    busy = true; render();
    p().then((l) => { o.setLot(l); busy = false; render(); o.hud.toast(ok(l), 2400); }, (e: unknown) => { busy = false; render(); o.hud.toast(errore(e), 3000); });
  }
  const rpg = (a: RpgAction, ok: (l: LotState) => string) => fai(() => o.api!.rpg(a), ok);
  const dove = (prima: LotState, dopo: LotState, id: string) => ((dopo.hero?.inv[id] ?? 0) > (prima.hero?.inv[id] ?? 0) ? 'nello zaino' : 'nel Forziere');

  // ---- pezzi ----
  function riga(ico: HTMLElement, nome: string, sotto: (string | HTMLElement)[], btn: HTMLElement | null, key: string): HTMLElement {
    const r = rigaKit({ icona: ico, nome, sotto, ...(btn ? { azione: btn } : {}) }); r.dataset['k'] = key;
    return r;
  }
  function icona(it: ItemDef): HTMLElement { const b = el('div', 'mk-ico'); b.style.borderColor = rarita(it); b.appendChild(iconOf(it, 40)); return b; }
  function prezzo(n: number): HTMLElement { const p = el('div', 'mk-prezzo'); p.append(el('span', 'mk-moneta'), String(n)); return p; }
  function bottone(testo: string, sotto: string, off: boolean, fn: () => void, key: string): HTMLButtonElement {
    const b = bottoneKit(testo, fn); b.disabled = off || busy; b.dataset['act'] = key;
    if (sotto) b.appendChild(el('small', '', sotto));
    return b;
  }
  const manca = (l: LotState, n: number): string => (l.monete < n ? `ti mancano ${n - l.monete}` : '');

  // ---- schede ----
  function oggi(out: HTMLElement, l: LotState): void {
    const b = kind!;
    if (b === 'cantiere') {
      for (const id of vetrinaBottega('cantiere', adesso())) {
        const k = AVATAR.barca.colori.find((x) => x.id === id);
        if (!k) continue;
        const ico = el('div', 'mk-ico'), sw = el('i'); sw.style.background = k.hex; ico.appendChild(sw); ico.style.borderColor = RARITA.raro;
        const tua = possiedeColore(l, id);
        const btn = tua ? bottone('Già tua', '', true, () => {}, 'vernice-tua') : bottone('Compra', manca(l, k.monete), l.monete < k.monete,
          () => fai(() => o.api!.buyColore(id), () => `Vernice comprata: ${k.nome}. Mettila sulla barca da AVATAR → BARCA`), 'vernice');
        out.appendChild(riga(ico, k.nome, [prezzo(k.monete), 'vernice per scafo e vela'], btn, 'vernice:' + id));
      }
      out.appendChild(el('div', 'mk-nota', 'Le vernici comprate sono tue per sempre: le metti sulla barca da AVATAR → BARCA.'));
      return;
    }
    const h = heroOf(l);
    for (const id of vetrinaOggetti(b, adesso())) {
      const it = itemDef(id), n = prezzoVetrina(b, id);
      const btn = bottone('Compra', manca(l, n), l.monete < n, () => rpg({ t: 'vetrina', bottega: b, item: id, n: 1 }, (x) => `Comprato: ${it.nome} (${dove(l, x, id)})`), 'vetrina');
      out.appendChild(riga(icona(it), it.nome, [prezzo(n)], btn, 'vetrina:' + id));
    }
    out.appendChild(el('div', 'mk-sez', b === 'fabbro' ? 'Sempre in bottega: i lingotti per forgiare' : 'Sempre in bottega: le erbe di base'));
    for (const { id, monete } of sempreInVendita(b)) {
      const it = itemDef(id), hai = available(l, h, id);
      const btn = bottone('Compra', manca(l, monete), l.monete < monete, () => rpg({ t: 'compra', item: id, n: 1 }, (x) => `Comprato: ${it.nome} (${dove(l, x, id)})`), 'compra');
      out.appendChild(riga(icona(it), it.nome, [prezzo(monete), `ne hai ${hai}`], btn, 'compra:' + id));
    }
  }

  const CATS: readonly { id: string; nome: string; ok(it: ItemDef): boolean }[] = [
    { id: 'leggere', nome: 'Leggere', ok: (it) => it.kind === 'arma' && it.classe === 'leggera' },
    { id: 'pesanti', nome: 'Pesanti', ok: (it) => it.kind === 'arma' && it.classe === 'pesante' },
    { id: 'archi', nome: 'Archi', ok: (it) => it.kind === 'arco' || it.kind === 'frecce' },
    { id: 'armature', nome: 'Armature', ok: (it) => it.kind === 'armatura' },
  ];
  function chip(testo: string, on: boolean, off: boolean, fn: () => void, key: string): HTMLButtonElement {
    const c = el('button', 'mk-chip' + (on ? ' on' : ''), testo); c.type = 'button'; c.disabled = off; c.dataset['k'] = key; c.addEventListener('click', fn); return c;
  }
  function forgia(out: HTMLElement, l: LotState): void {
    const h = heroOf(l), liv = livelloBottega(l, 'fabbro');
    const cm = el('div', 'mk-chips');
    for (const m of MATERIALS) cm.appendChild(chip(m.banco > liv ? `${m.nome} · L${m.banco}` : m.nome, mat === m.id, false, () => { mat = m.id; render(); }, 'mat:' + m.id));
    const cc = el('div', 'mk-chips');
    for (const c of CATS) cc.appendChild(chip(c.nome, cat === c.id, false, () => { cat = c.id; render(); }, 'cat:' + c.id));
    out.append(cm, cc);
    const m = MATERIALS.find((x) => x.id === mat) ?? MATERIALS[0]!, chiuso = m.banco > liv;
    if (chiuso) out.appendChild(el('div', 'mk-nota', `${m.nome}: serve il Fabbro al livello ${m.banco}. Lo migliori nella scheda Livello.`));
    const sconto = Math.max(-0.9, modsOf(h).materialiForgia ?? 0), c = CATS.find((x) => x.id === cat) ?? CATS[0]!;
    for (const it of ITEMS.filter((x) => x.forgia && x.materiale === m.id && c.ok(x))) {
      const costo = Object.entries(it.forgia!.costo).map(([id, qn]) => {
        const need = Math.max(1, Math.ceil(qn * (1 + sconto)));
        return id === 'risorsa:legno' ? { nome: 'monete', need: prezzoInMonete({ legno: need }), have: l.monete } : { nome: hasItem(id) ? itemDef(id).nome : id, need, have: available(l, h, id) };
      });
      const ok = costo.every((x) => x.have >= x.need), n = it.forgia!.n ?? 1;
      const btn = bottone('Forgia', chiuso ? `Fabbro L${m.banco}` : ok ? (n > 1 ? `×${n}` : '') : 'ti manca roba', chiuso || !ok,
        () => rpg({ t: 'forgia', item: it.id }, (x) => `Forgiato: ${it.nome}${n > 1 ? ` ×${n}` : ''} (${dove(l, x, it.id)})`), 'forgia');
      out.appendChild(riga(icona(it), it.nome, costo.map((x) => `${x.need} ${x.nome} · hai ${x.have}`), btn, 'forgia:' + it.id));
    }
  }
  function pozioni(out: HTMLElement, l: LotState): void {
    const h = heroOf(l), lv = h.skill.alchimia?.lv ?? 0;
    out.appendChild(el('div', 'mk-nota', `La tua Alchimia: ${lv}. Più sale, più ricette e pozioni più forti.`));
    for (const r of [...RECIPES].sort((a, b) => a.livello - b.livello)) {
      if (!hasItem(r.risultato)) continue;
      const it = itemDef(r.risultato), chiusa = lv < r.livello;
      const ing = Object.entries(r.ingredienti).map(([id, qn]) => ({ nome: hasItem(id) ? itemDef(id).nome : id, need: qn, have: available(l, h, id) }));
      const ok = ing.every((x) => x.have >= x.need);
      const btn = bottone('Prepara', chiusa ? `Alchimia ${r.livello}` : ok ? '' : 'ti mancano erbe', chiusa || !ok,
        () => rpg({ t: 'alchimia', ricetta: r.id }, (x) => `Pronta: ${it.nome} (${dove(l, x, it.id)})`), 'alchimia');
      out.appendChild(riga(icona(it), r.nome, ing.map((x) => `${x.need} ${x.nome} · hai ${x.have}`), btn, 'ricetta:' + r.id));
    }
  }
  function livelli(out: HTMLElement, l: LotState, b: 'fabbro' | 'cantiere'): void {
    const liv = livelloBottega(l, b), next = prossimoLivello(l, b), def = BOTTEGHE[b].livelli ?? [];
    if (b === 'cantiere') out.appendChild(el('div', 'mk-nota', liv >= 2 ? 'La tua barca regge la Tempesta.' : 'Al livello 2 la barca regge la Tempesta: si apre l\'isola.'));
    def.forEach((d, i) => {
      const n = i + 1, ico = el('div', 'mk-ico'); ico.appendChild(el('div', 'n', String(n)));
      ico.style.borderColor = n <= liv ? LIBRO.oro : RARITA.comune;
      let btn: HTMLElement | null = null;
      if (n <= liv) btn = bottone(n === liv ? 'Ce l\'hai' : 'Fatto', '', true, () => {}, 'livello-fatto');
      else if (next && n === next.livello) btn = bottone('Migliora', manca(l, next.monete), l.monete < next.monete, () => fai(() => o.api!.bottega('migliora', { bottega: b, da: liv }), () => `${BOTTEGHE[b].nome}: livello ${n}!`), 'migliora');
      out.appendChild(riga(ico, `Livello ${n}`, [d.desc, ...(n > liv ? [prezzo(d.monete)] : [])], btn, `livello:${n}`));
    });
  }

  function render(): void {
    if (!kind) return;
    const l = lot(), b = BOTTEGHE[kind], corpoVecchio = box.querySelector('.mk-corpo');
    if (corpoVecchio) scroll = corpoVecchio.scrollTop;
    const ic = canvasInsegna(kind), { carta, corpo } = cartaKit(b.nome, () => close(), ic);
    const nomebox = carta.querySelector<HTMLElement>('.mk-nomebox')!, titolo = carta.querySelector<HTMLElement>('.mk-titolo')!;
    const chi = el('div', 'bt-chi'), rit = el('div', 'bt-ritratto');
    rit.style.backgroundImage = `url('/assets/botteghe/${kind}.webp')`;
    chi.append(rit, el('div', 'bt-bolla', battuta));
    const tabs = schedeKit(TABS[kind], tab, (t) => { tab = t; scroll = 0; render(); });
    carta.insertBefore(chi, corpo); carta.insertBefore(tabs, corpo);
    if (!l) corpo.appendChild(el('div', 'mk-nota', 'Le botteghe vendono solo a chi ha un\'isola: apri MAREA col tuo link personale.'));
    else if (tab === 'oggi') oggi(corpo, l);
    else if (tab === 'forgia') forgia(corpo, l);
    else if (tab === 'pozioni') pozioni(corpo, l);
    else if (tab === 'livello') livelli(corpo, l, 'fabbro');
    else if (tab === 'barca') livelli(corpo, l, 'cantiere');
    if (tab === 'oggi') carta.appendChild(el('div', 'mk-piede', `Nuova merce tra ${fraTempo(finoAMezzanotte(adesso()))}`));
    box.replaceChildren(carta);
    corpo.scrollTop = scroll;
    // il titolo sta su una riga, prima della X: se è lungo si rimpicciolisce (anche a carattere arrivato)
    const adatta = () => { let sz = 24; titolo.style.fontSize = sz + 'px'; while (sz > 16 && titolo.scrollWidth > nomebox.clientWidth - ic.offsetWidth - 8) titolo.style.fontSize = --sz + 'px'; };
    adatta(); void document.fonts?.ready.then(adatta);
  }

  function close(): void {
    if (!kind) return;
    kind = null; box.classList.remove('on'); box.replaceChildren(); o.onClose();
  }
  registerStateProvider('bottegaUi', () => ({
    aperta: kind, tab, busy,
    righe: [...box.querySelectorAll<HTMLElement>('.mk-riga')].map((r) => ({ k: r.dataset['k'], off: !!r.querySelector<HTMLButtonElement>('.mk-btn')?.disabled })),
  }));
  return {
    get kind() { return kind; },
    apri(id) {
      kind = id; tab = 'oggi'; scroll = 0;
      const fr = BOTTEGHE[id].battute ?? [];
      battuta = fr[Math.floor(Math.random() * fr.length)] ?? '';
      box.classList.add('on'); render();
    },
    isOpen: () => kind !== null,
    close,
    state: () => ({ aperta: kind, tab }),
  };
}
