// Schede «Personaggio» e «Abilità» della scheda del personaggio (R-pannelli). Numeri da heroDerived; perk da PERKS (bozza di Riccardo).
import { ATTRS, PERKS, RPG, SKILLS } from '@marea/content/rpg.ts';
import type { PerkDef, SkillId } from '@marea/content/rpg.ts';
import { heroDerived } from '@marea/sim/rpg/hero.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { el, PAL } from '../ui/style.ts';
import { ATTR_COL, ATTR_NOME, SKILL_NOME, bar, button, fmtKg, fmtN, sec, stat } from './items_ui.ts';
import type { View } from './items_ui.ts';

export function renderPg(v: View, out: HTMLElement): void {
  const h = v.hero, d = heroDerived(h);
  const big = el('div', 'mz-rp-big', `Livello ${h.livello}`);
  big.appendChild(el('small', '', `${fmtN(h.xp, 0)} / ${d.xpProssimo} xp`));
  out.append(big, bar(h.xp / Math.max(1, d.xpProssimo)));
  if (h.scelte > 0) {
    out.appendChild(sec('Nuovo livello', h.scelte > 1 ? `${h.scelte} da assegnare` : '1 da assegnare'));
    out.appendChild(el('div', 'mz-rp-cmp', `Scegli una barra: +${RPG.attributi.perLivello}.`));
    for (const a of ATTRS) {
      out.appendChild(button(`attr:${a}`, `+${RPG.attributi.perLivello} ${ATTR_NOME[a]}`, `${d.max[a]} → ${d.max[a] + RPG.attributi.perLivello}`, a, v.busy,
        () => v.act({ t: 'attributo', attr: a }, () => `+${RPG.attributi.perLivello} ${ATTR_NOME[a]}`)));
    }
  }
  if (h.perkPunti > 0) {
    out.appendChild(button('vai:abilita', `Punti perk: ${h.perkPunti}`, 'scegli nelle Abilità →', 'green', false, () => { v.ui.tab = 'abilita'; v.rerender(); }));
  }
  out.appendChild(sec('Barre'));
  for (const a of ATTRS) out.appendChild(stat(ATTR_NOME[a], String(d.max[a]), ATTR_COL[a]));
  out.appendChild(sec('Peso', `${fmtKg(d.carico)} / ${fmtKg(d.caricoMax)}`));
  out.appendChild(bar(d.carico / Math.max(1, d.caricoMax), d.carico > d.caricoMax * 0.9 ? PAL.rosso : PAL.legnoChiaro));
  out.appendChild(sec('Combattimento'));
  const armaId = h.equip.arma;
  const arma = armaId && hasItem(armaId) && (h.inv[armaId] ?? 0) > 0 ? itemDef(armaId).nome : 'Pugni';
  out.appendChild(stat('In mano', arma));
  out.appendChild(stat('Danno', fmtN(d.danno)));
  out.appendChild(stat('Colpi al secondo', fmtN(d.velocita, 2)));
  out.appendChild(stat('Difesa', fmtN(d.difesa)));
  if (d.malus > 0) out.appendChild(stat('Lentezza armatura', `−${Math.round(d.malus * 100)} %`));
  out.appendChild(sec('Borsa'));
  out.appendChild(stat('Monete', String(h.monete), PAL.giallo));
  if (h.discese) out.appendChild(stat('Spedizioni', h.morti ? `${h.discese} (${h.morti} finite male)` : String(h.discese)));
}

/** Perk di un'abilità in ordine d'albero (ogni perk subito dopo quello che richiede), con la profondità. */
function tree(skill: SkillId): { p: PerkDef; depth: number }[] {
  const list = PERKS.filter((p) => p.skill === skill);
  const out: { p: PerkDef; depth: number }[] = [];
  const visit = (parent: string | undefined, depth: number): void => {
    for (const p of list.filter((x) => x.richiede === parent).sort((a, b) => a.livello - b.livello)) {
      out.push({ p, depth }); visit(p.id, depth + 1);
    }
  };
  visit(undefined, 0);
  for (const p of list) if (!out.some((o) => o.p.id === p.id)) out.push({ p, depth: 0 }); // richiede un perk di un altro albero
  return out;
}

export function renderSkills(v: View, out: HTMLElement): void {
  const h = v.hero, d = heroDerived(h);
  out.appendChild(sec('Abilità', h.perkPunti > 0 ? `Punti perk: ${h.perkPunti}` : 'Punti perk: 0'));
  if (h.perkPunti < 1) out.appendChild(el('div', 'mz-rp-cmp', 'Sali di livello per avere punti perk. Tocca un\'abilità per vedere i suoi perk.'));
  for (const s of SKILLS) {
    const st = h.skill[s] ?? { lv: RPG.livelli.skillIniziale, xp: 0 };
    const need = d.skillProssimo[s];
    const open = v.ui.skill === s;
    const r = el('button', 'mz-rp-row mz-rp-skill' + (open ? ' on' : ''));
    r.type = 'button'; r.dataset['k'] = `skill:${s}`; r.dataset['skill'] = s; r.setAttribute('aria-expanded', open ? 'true' : 'false');
    const top = el('span', 'top');
    const ready = PERKS.filter((p) => p.skill === s && !h.perk.includes(p.id) && st.lv >= p.livello && (!p.richiede || h.perk.includes(p.richiede))).length;
    top.append(el('span', 'n', SKILL_NOME[s]), el('span', 'q', ready && h.perkPunti > 0 ? `${ready} perk pronti` : need ? `${fmtN(st.xp, 0)}/${need}` : 'max'), el('span', 'lv', String(st.lv)));
    r.append(top, bar(need ? st.xp / need : 1, PAL.acquaBassa));
    r.addEventListener('click', () => { v.ui.skill = open ? null : s; v.rerender(); });
    out.appendChild(r);
    if (open) out.appendChild(perksOf(v, s, st.lv));
  }
}

function perksOf(v: View, s: SkillId, lv: number): HTMLElement {
  const h = v.hero;
  const box = el('div', 'mz-rp-det'); box.dataset['perks'] = s;
  const list = tree(s);
  if (!list.length) { box.appendChild(el('p', '', 'Nessun perk per ora.')); return box; }
  for (const { p, depth } of list) {
    const preso = h.perk.includes(p.id);
    const req = p.richiede ? PERKS.find((x) => x.id === p.richiede) : undefined;
    const why = preso ? '' : lv < p.livello ? `Serve ${SKILL_NOME[s]} ${p.livello}` : req && !h.perk.includes(req.id) ? `Serve prima: ${req.nome}` : '';
    const pronto = !preso && !why;
    const c = el('div', 'mz-rp-perk ' + (preso ? 'preso' : pronto ? 'pronto' : 'chiuso'));
    c.dataset['perk'] = p.id;
    c.style.marginLeft = `${Math.min(3, depth) * 12}px`;
    const t = el('div', 't');
    t.append(el('span', '', (depth ? '└ ' : '') + p.nome), el('span', 'st ' + (preso ? 'mz-rp-ok' : pronto ? 'mz-rp-warn' : 'mz-rp-lock'), preso ? 'preso' : pronto ? 'disponibile' : `liv. ${p.livello}`));
    c.append(t, el('div', '', p.descr));
    if (why) c.appendChild(el('div', 'why', why));
    if (pronto) {
      const b = button(`perk:${p.id}`, h.perkPunti > 0 ? 'Prendi' : 'Serve un punto perk', h.perkPunti > 0 ? `punti: ${h.perkPunti}` : 'sali di livello', 'green', v.busy || h.perkPunti < 1,
        () => v.act({ t: 'perk', perk: p.id }, () => `Perk preso: ${p.nome}`));
      b.dataset['act'] = 'perk';
      c.appendChild(b);
    }
    box.appendChild(c);
  }
  return box;
}
