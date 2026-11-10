// Il pannello della build nel colosseo (docs/ARENA.md §2): le schede delle build salvate (BUILD 1-3, + NUOVA), la dote (tre celle col colore
// del bagliore), i due slot (un tocco apre la lista: armi coi loro numeri, magie col costo) e l'ulti (lista con cosa fa). Lo stesso editor
// veste i gladiatori dell'allenamento. Disegna e basta: le scelte tornano ad arena_menu.ts con `metti` e `apri`.
import { ARENA } from '@marea/content/arena.ts';
import { spellDef } from '@marea/content/rpg.ts';
import { ARMI_ARENA, MAGIE_ARENA, passoDi, slotArma, slotMagia, soloSquadre } from '@marea/sim/rpg/arena.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { ArenaBuild, ArenaBuilds, ArenaSlot } from '@marea/sim/rpg/types.ts';
import { PAL, el } from '../ui/style.ts';
import { iconaMagia, iconOf, itemIcon } from './items_ui.ts';

/** La cella aperta: uno slot o l'ulti (la dote si sceglie con un tocco, senza lista). */
export type SceltaBuild = { tipo: 'slot'; n: number } | { tipo: 'ulti' };
type Voce = { id: string; nome: string; ico: () => Node; nota: string };

const virgola = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
const nomeOgg = (id: string) => (hasItem(id) ? itemDef(id).nome.replace(/ di ferro$/i, '') : id);
const nomeMagia = (id: string) => { try { return spellDef(id).nome; } catch { return id; } };
const icoSlot = (s: ArenaSlot, px = 26): Node => (slotMagia(s) ? iconaMagia(s.magia, px) : hasItem(s.arma) ? iconOf(itemDef(s.arma), px) : itemIcon('arma', PAL.pietra, px));
const nomeSlot = (s: ArenaSlot) => (slotMagia(s) ? nomeMagia(s.magia) : nomeOgg(s.arma));
/** I numeri di un'arma o di una magia, in breve. */
function notaSlot(s: ArenaSlot): string {
  if (slotArma(s)) {
    const n = ARENA.build.armi[s.arma], p = Math.round((passoDi(itemDef(s.arma).peso) - 1) * 100), passo = p ? ` · passo ${p > 0 ? '+' : ''}${p}%` : '';
    if (!n) return '';
    return itemDef(s.arma).kind === 'arco' ? `danno ${virgola(n.danno)} · ${ARENA.frecce} frecce${passo}` : `danno ${virgola(n.danno)} · ${virgola(n.colpi ?? 1)} colpi/s${passo}`;
  }
  const sp = spellDef(s.magia), m = ARENA.build.magie[s.magia] ?? {}, costo = m.costo ?? sp.costo, raggio = sp.forma === 'raggio' ? '/s' : '';
  if (sp.cura) return `cura ${virgola(m.cura ?? sp.cura)}${raggio} · ${costo}${raggio} Magicka · solo a squadre`;
  if (sp.furia) return `danni e velocità + · ${costo}${raggio} Magicka · solo a squadre`;
  return `danno ${virgola(m.danno ?? sp.danno ?? 0)}${raggio} · ${costo}${raggio} Magicka`;
}

type Opz = {
  build: ArenaBuild; scelta: SceltaBuild | null; squadre: boolean;
  /** Apre (o chiude, se è già aperta) la lista di una cella. */
  apri(sc: SceltaBuild | null): void;
  /** La build cambiata. */
  metti(b: ArenaBuild): void;
};

function cella(cls: string, kids: (Node | string)[], aperta: boolean, fn: () => void, dato: Record<string, string> = {}): HTMLButtonElement {
  const b = el('button', `cella ${cls}${aperta ? ' sel' : ''}`) as HTMLButtonElement; b.type = 'button';
  for (const [k, v] of Object.entries(dato)) b.dataset[k] = v;
  b.append(...kids);
  b.addEventListener('click', fn);
  return b;
}
function lista(voci: Voce[], cur: string | null, scegli: (id: string | null) => void, niente: boolean): HTMLElement {
  const l = el('div', 'lista on');
  for (const v of voci) {
    const b = el('button', v.id === cur ? 'cur' : ''); b.type = 'button'; b.dataset['id'] = v.id;
    b.append(v.ico(), el('span', '', v.nome), el('small', '', v.nota));
    b.addEventListener('click', () => scegli(v.id));
    l.append(b);
  }
  if (niente) { const b = el('button', cur ? '' : 'cur', '— Niente —'); b.type = 'button'; b.dataset['id'] = ''; b.addEventListener('click', () => scegli(null)); l.append(b); }
  return l;
}

/** Dote, slot e ulti di una build. */
export function editorBuild(o: Opz): Node[] {
  const b = o.build, out: Node[] = [];
  const cambia = (x: Partial<ArenaBuild>) => o.metti({ dote: b.dote, slot: [...b.slot], ulti: b.ulti, ...x });
  // la dote: il colore è quello del bagliore attorno all'eroe
  out.push(el('h4', '', 'DOTE'));
  const doti = el('div', 'riga');
  for (const d of ARENA.build.doti) {
    const col = (PAL as Record<string, string>)[d.colore] ?? PAL.pietra, c = cella('dote', [el('span', '', d.nome.toUpperCase()), el('small', '', d.descr.split(':')[0]!)], b.dote === d.id, () => cambia({ dote: d.id }), { dote: d.id });
    c.style.borderTopColor = col; c.style.borderTopWidth = '6px'; c.title = d.descr;
    doti.append(c);
  }
  out.push(doti);
  // gli slot
  out.push(el('h4', '', `${ARENA.slot} ARMI O MAGIE (TASTI 1-${ARENA.slot})`));
  const sl = el('div', 'riga d');
  b.slot.forEach((s, n) => {
    const aperta = o.scelta?.tipo === 'slot' && o.scelta.n === n, off = !!s && soloSquadre(s) && !o.squadre;
    sl.append(cella(s ? (off ? 'spenta' : '') : 'vuota', s ? [el('i', '', String(n + 1)), icoSlot(s), el('span', '', nomeSlot(s)), el('small', '', off ? 'solo a squadre' : notaSlot(s))] : [el('i', '', String(n + 1)), el('span', '', 'Vuoto')], aperta, () => o.apri(aperta ? null : { tipo: 'slot', n }), { slot: String(n) }));
  });
  out.push(sl);
  const sc = o.scelta;
  if (sc?.tipo === 'slot') {
    const altri = new Set(b.slot.filter((s, i) => s && i !== sc.n).map((s) => JSON.stringify(s))), cur = b.slot[sc.n] ?? null;
    const voci: Voce[] = [...ARMI_ARENA.map((arma) => ({ arma })), ...MAGIE_ARENA.map((magia) => ({ magia }))].filter((s) => !altri.has(JSON.stringify(s)))
      .map((s) => ({ id: slotArma(s) ? s.arma : 'magia:' + s.magia, nome: nomeSlot(s), ico: () => icoSlot(s), nota: notaSlot(s) }));
    out.push(lista(voci, cur ? (slotArma(cur) ? cur.arma : 'magia:' + cur.magia) : null, (id) => {
      const slot = [...b.slot]; slot[sc.n] = !id ? null : id.startsWith('magia:') ? { magia: id.slice(6) } : { arma: id };
      cambia({ slot });
    }, true));
  }
  if (!o.squadre && b.slot.some((s) => s && soloSquadre(s))) out.push(el('div', 'stat', 'Cura e Furia valgono solo a squadre: nel 1 contro 1 quello slot resta vuoto.'));
  // l'ulti
  out.push(el('h4', '', 'ULTI (TASTO F)'));
  const u = ARENA.ulti.lista.find((x) => x.id === b.ulti) ?? ARENA.ulti.lista[0]!, aperta = sc?.tipo === 'ulti';
  const ur = el('div', 'riga u');
  ur.append(cella('ulti', [el('span', '', u.nome), el('small', '', u.descr)], aperta, () => o.apri(aperta ? null : { tipo: 'ulti' }), { ulti: u.id }));
  out.push(ur);
  if (aperta) out.push(lista(ARENA.ulti.lista.map((x) => ({ id: x.id, nome: x.nome, ico: () => el('b', 'uico', '✦'), nota: x.descr })), b.ulti, (id) => { if (id) cambia({ ulti: id }); }, false));
  return out;
}

/** Le schede delle build salvate: un tocco sceglie quella con cui si gioca; + NUOVA ne aggiunge una (copia di quella scelta) finché c'è posto. */
export function schedeBuild(x: ArenaBuilds, scegli: (n: number) => void, nuova: () => void): HTMLElement {
  const r = el('div', 'formati schede');
  x.build.forEach((_, n) => { const b = el('button', n === x.scelta ? 'sel' : '', `BUILD ${n + 1}`) as HTMLButtonElement; b.type = 'button'; b.dataset['build'] = String(n); b.addEventListener('click', () => scegli(n)); r.append(b); });
  if (x.build.length < ARENA.build.salvate) { const b = el('button', 'piu', '+ NUOVA') as HTMLButtonElement; b.type = 'button'; b.dataset['build'] = 'nuova'; b.addEventListener('click', nuova); r.append(b); }
  return r;
}
