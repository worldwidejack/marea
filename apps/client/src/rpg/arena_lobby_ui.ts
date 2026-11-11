import { ARENA, arenaModo, eroiDi } from '@marea/content/arena.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import type { ArClientMsg, ArMembroSala } from '@marea/protocol/arena.ts';
import { el } from '../ui/style.ts';

export function arenaButton(act: string, testo: string, fn: () => void, dis = false): HTMLButtonElement {
  const b = el('button', 'arena-btn', testo);
  b.type = 'button'; b.dataset['act'] = act; b.disabled = dis; b.addEventListener('click', fn);
  return b;
}

const nomePer = (m: ArenaModo, per: number): string => m === 'sopravvivenza' ? (per === 1 ? 'Da soli' : 'A coppie') : `${per} contro ${per}`;

export function opzioniArena(o: { modo: ArenaModo; per: number; mappa: string; n: number; ospita: boolean; scegli(m: ArenaModo, f: number, mappa: string): void }): Node[] {
  const attuale = arenaModo(o.modo), griglia = el('div', 'modi');
  for (const m of ARENA.modi.lista) {
    const f = m.per.includes(o.per) && eroiDi(m, o.per) >= o.n ? o.per : m.per.find((p) => eroiDi(m, p) >= o.n);
    const b = arenaButton('modo', m.nome, () => o.scegli(m.id, f!, m.id === o.modo ? o.mappa : ''), !o.ospita || f === undefined);
    b.dataset['modo'] = m.id; b.classList.toggle('sel', m.id === o.modo);
    b.setAttribute('aria-pressed', String(m.id === o.modo));
    b.append(el('small', '', f === undefined ? `Fino a ${Math.max(...m.per.map((p) => eroiDi(m, p)))} giocatori` : m.per.map((p) => nomePer(m.id, p)).join(' / ')));
    griglia.append(b);
  }
  const kids: Node[] = [el('h3', '', 'Modalità'), griglia, el('p', 'descr', attuale.descr)];
  if (attuale.per.length > 1) {
    const fm = el('div', 'formati p');
    for (const f of attuale.per) {
      const b = arenaButton('formato', nomePer(o.modo, f), () => o.scegli(o.modo, f, o.mappa), !o.ospita || eroiDi(attuale, f) < o.n);
      b.dataset['f'] = String(f); b.classList.toggle('sel', f === o.per); b.setAttribute('aria-pressed', String(f === o.per)); fm.append(b);
    }
    kids.push(fm);
  }
  const mappe = ARENA.mappe.filter((m) => m.modi.includes(o.modo));
  if (mappe.length === 1) kids.push(el('p', 'mappe', mappe[0]!.nome.toUpperCase()));
  else {
    const label = el('label', 'arena-campo', 'Mappa'), select = el('select');
    select.disabled = !o.ospita;
    for (const m of [{ id: '', nome: 'A caso' }, ...mappe]) select.add(new Option(m.nome, m.id, false, m.id === o.mappa));
    select.addEventListener('change', () => o.scegli(o.modo, o.per, select.value));
    label.append(select); kids.push(label);
  }
  return kids;
}

export function squadreArena(o: { membri: ArMembroSala[]; modo: ArenaModo; per: number; soli: number[]; ospita: boolean; invia(m: ArClientMsg): void }): Node[] {
  if (o.per === 1) return [];
  const n = eroiDi(arenaModo(o.modo), o.per), squadre = Array.from({ length: n / o.per }, (_, i) => i);
  const roster = el('div', 'arena-squadre');
  for (const m of o.membri) {
    const riga = el('div', 'arena-squadra'), nome = el('b', '', m.nome), select = el('select');
    select.setAttribute('aria-label', `Squadra di ${m.nome}`); select.disabled = !o.ospita;
    if (m.q < 0) select.add(new Option('Senza posto', '-1', false, true));
    for (const q of squadre) select.add(new Option(o.soli.includes(q) ? `Squadra ${q + 1} · solo` : `Squadra ${q + 1}`, String(q), false, q === m.q));
    select.addEventListener('change', () => { if (Number(select.value) >= 0) o.invia({ t: 'squadra', id: m.id, q: Number(select.value) }); });
    riga.append(nome, select);
    if (o.modo === 'sopravvivenza' && m.q >= 0 && o.membri.filter((x) => x.q === m.q).length === 1) {
      const solo = o.soli.includes(m.q);
      const b = arenaButton('solo', solo ? 'Aggiungi compagno' : 'Lascia da solo', () => o.invia({ t: 'solo', q: m.q, on: !solo }), !o.ospita || (!solo && o.membri.length >= n - o.soli.length));
      b.setAttribute('aria-pressed', String(solo)); riga.append(b);
    }
    roster.append(riga);
  }
  const kids = [el('h3', '', 'Squadre')];
  if (o.ospita) kids.push(el('p', '', 'Scegli la squadra di ciascuno. Se è piena, scambi il posto con l’ultimo membro.'));
  return [...kids, roster];
}
