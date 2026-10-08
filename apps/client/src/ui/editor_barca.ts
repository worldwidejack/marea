// Sezione «La tua barca» dell'editor (#107): colore dello scafo e della vela (frecce come il cappello, con il pallino del colore), nome
// dipinto sul fianco. Anteprima dal vivo sulla tua barca nel mondo e in una barchetta a pixel qui; Salva → POST /api/barca (il server
// ripulisce il nome e controlla i colori esclusivi). I colori del Mercante si provano ma si salvano solo se sono tuoi (si comprano al Porto).
// Il DOM si costruisce una volta: mentre scrivi il nome l'editor non si ridisegna (il cursore resta dov'è).
import { AVATAR } from '@marea/content';
import { barcaDi, nomeBarca, possiedeColore } from '@marea/sim';
import type { LotState } from '@marea/sim';
import type { BarcaLook } from '@marea/protocol';
import type { Api, Me } from '../net/api.ts';
import { BARCA_COLORI, disegnaBarca } from '../game/barca_look.ts';
import { PAL, el } from './style.ts';
import { resIcon } from './icons.ts';

export type RigaBarca = 'scafo' | 'vela';
export type SezioneBarca = {
  /** Le righe della sezione (sempre lo stesso nodo: l'editor lo rimette nel pannello a ogni disegno). */
  readonly node: HTMLElement;
  step(row: RigaBarca, d: number): void;
  /** Torna alla barca salvata (anche nel mondo). */
  reset(): void;
  changed(): boolean;
  /** I colori scelti si possono salvare (tuoi, o già salvati). */
  ok(): boolean;
  save(): Promise<BarcaLook>;
  state(): { draft: BarcaLook; saved: BarcaLook; ok: boolean };
};

const P = PAL;
const STYLE = `
.mz-eb-head { display: flex; align-items: center; gap: 10px; }
.mz-eb-prev { width: 160px; height: 88px; flex: none; image-rendering: pixelated; border: 2px solid ${P.neroCaldo}; background: ${P.acquaBassa}; }
.mz-eb-head p { margin: 0; color: ${P.sabbia}; font-size: 13px; line-height: 1.35; }
.mz-eb-chip { display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px; border: 2px solid ${P.neroCaldo}; }
.mz-eb-chip.no { background: ${P.pietra}; box-shadow: inset 0 0 0 3px ${P.pietraChiara}; }
.mz-eb-nome { width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 8px; background: ${P.sabbiaChiara}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; font: bold 16px ui-monospace, Menlo, monospace; text-transform: uppercase; }
.mz-eb-nome::placeholder { color: ${P.pietraScura}; text-transform: none; }
`;
const injectStyle = (): void => {
  if (document.getElementById('mz-eb-style')) return;
  const st = document.createElement('style'); st.id = 'mz-eb-style'; st.textContent = STYLE; document.head.appendChild(st);
};
const VELE = ['nessuna', ...BARCA_COLORI.map((k) => k.id)], SCAFI = BARCA_COLORI.map((k) => k.id);
const listaDi = (r: RigaBarca): string[] => (r === 'scafo' ? SCAFI : VELE);

export function createSezioneBarca(o: { api: Api; me: Me; world: { setBarca(b: BarcaLook): void }; getLot(): LotState | null; onChange(): void }): SezioneBarca {
  injectStyle();
  const savedOf = (): BarcaLook => barcaDi(o.me.look);
  let draft: BarcaLook = savedOf(), nomeGrezzo = draft.nome;
  const tuo = (id: string): boolean => id === 'nessuna' || possiedeColore(o.getLot(), id) || id === savedOf().scafo || id === savedOf().vela;
  const ok = (): boolean => tuo(draft.scafo) && tuo(draft.vela);

  const node = el('div'); node.dataset['panel'] = 'barca';
  const head = el('div', 'mz-ed-row mz-eb-head');
  const prev = document.createElement('canvas'); prev.className = 'mz-eb-prev'; prev.dataset['barca'] = 'anteprima';
  head.append(prev, el('p', '', 'La tua barca: la vedono anche gli amici, al tuo molo e quando navighi.'));
  const righe: Record<RigaBarca, { row: HTMLElement; n: HTMLElement; v: HTMLElement; miss: HTMLElement }> = {} as never;
  for (const r of ['scafo', 'vela'] as const) {
    const row = el('div', 'mz-ed-row'); row.tabIndex = 0; row.dataset['row'] = r; row.dataset['nav'] = 'riga:' + r;
    row.setAttribute('role', 'spinbutton'); row.setAttribute('aria-label', r === 'scafo' ? 'Scafo' : 'Vela');
    const lbl = el('div', 'mz-ed-lbl'), v = el('span', 'v');
    lbl.append(el('span', '', r === 'scafo' ? 'Scafo' : 'Vela'), v);
    const st = el('div', 'mz-ed-st'), n = el('span', 'n');
    const mk = (d: number, t: string): HTMLButtonElement => {
      const b = el('button', '', t); b.type = 'button'; b.tabIndex = -1; b.dataset['act'] = r; b.dataset['nav'] = `${r}:${d > 0 ? 'piu' : 'meno'}`;
      b.setAttribute('aria-label', `${r} ${d > 0 ? 'successivo' : 'precedente'}`);
      b.addEventListener('click', () => step(r, d));
      return b;
    };
    st.append(mk(-1, '‹'), n, mk(1, '›'));
    const miss = el('div', 'mz-note mz-ed-miss', 'Esclusiva del Mercante delle Perle: si compra da lui, in piazza al Porto');
    row.append(lbl, st, miss);
    righe[r] = { row, n, v, miss };
  }
  const nomeRow = el('div', 'mz-ed-row'), nomeLbl = el('div', 'mz-ed-lbl');
  nomeLbl.append(el('span', '', 'Nome'), el('span', 'v', `max ${AVATAR.barca.nomeMax}`));
  const input = document.createElement('input');
  input.className = 'mz-eb-nome'; input.type = 'text'; input.maxLength = AVATAR.barca.nomeMax; input.placeholder = 'Senza nome (si dipinge sul fianco)';
  input.autocomplete = 'off'; input.spellcheck = false; input.dataset['nav'] = 'barca-nome'; input.setAttribute('aria-label', 'Nome della barca');
  input.addEventListener('input', () => { nomeGrezzo = input.value; draft = { ...draft, nome: nomeBarca(input.value) }; aggiorna(); });
  nomeRow.append(nomeLbl, input);
  node.append(head, righe.scafo.row, righe.vela.row, nomeRow);

  /** Ridisegna in place (niente render dell'editor): nomi dei colori, prezzi, anteprima nel pannello e nel mondo. */
  function aggiorna(): void {
    for (const r of ['scafo', 'vela'] as const) {
      const id = draft[r], k = BARCA_COLORI.find((x) => x.id === id), { n, v, miss, row } = righe[r];
      const chip = el('span', 'mz-eb-chip' + (k ? '' : ' no')); if (k) chip.style.background = k.hex;
      n.replaceChildren(chip, k ? k.nome : 'Senza vela');
      row.setAttribute('aria-valuetext', k ? k.nome : 'Senza vela');
      v.className = 'v' + (tuo(id) ? '' : ' lock');
      if (k && k.perle > 0 && !tuo(id)) { v.replaceChildren(); const c = el('span', 'mz-cost'); c.append(resIcon('perle', 16), `${k.perle} Perle`); v.append(c, el('span', 'mz-ed-merc', 'dal Mercante')); }
      else v.textContent = k && k.perle > 0 ? 'tuo' : `${listaDi(r).indexOf(id) + 1}/${listaDi(r).length}`;
      miss.style.display = tuo(id) ? 'none' : '';
    }
    if (document.activeElement !== input) input.value = nomeGrezzo;
    disegnaBarca(prev, draft);
    o.world.setBarca(draft);
  }
  function step(r: RigaBarca, d: number): void {
    const l = listaDi(r), i = l.indexOf(draft[r]);
    draft = { ...draft, [r]: l[(((i < 0 ? 0 : i) + d) % l.length + l.length) % l.length]! };
    aggiorna(); o.onChange();
  }
  aggiorna();
  o.world.setBarca(savedOf());
  return {
    node, step,
    reset() { draft = savedOf(); nomeGrezzo = draft.nome; input.value = nomeGrezzo; aggiorna(); o.world.setBarca(savedOf()); },
    changed: () => JSON.stringify(draft) !== JSON.stringify(savedOf()),
    ok,
    async save() {
      const b = await o.api.barca(draft);
      o.me.look = { ...o.me.look, barca: b };
      draft = { ...b }; nomeGrezzo = b.nome; input.value = b.nome;
      aggiorna();
      return b;
    },
    state: () => ({ draft: { ...draft }, saved: savedOf(), ok: ok() }),
  };
}
