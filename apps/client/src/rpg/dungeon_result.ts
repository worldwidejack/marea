// Esito della spedizione (R-scena): scheda grande al centro come #mzEsito dei minigiochi, con l'esito DEL SERVER (DungeonFinish):
// USCITO / SEI CADUTO / TEMPO SCADUTO, bottino tenuto con nomi e colori, cosa è andato perso (peso o morte), monete, xp per abilità con
// barre del livello, «LIVELLO SU!» se ci sono livelli da assegnare. OK (o Invio/Spazio/Esc/E) chiude e risolve.
import { RPG } from '@marea/content/rpg.ts';
import type { SkillId } from '@marea/content/rpg.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import { skillXpNeeded } from '@marea/sim/rpg/hero.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';
import { iconOf, itemIcon, palColor, SKILL_NOME } from './items_ui.ts';
import { registerStateProvider, registerTestHook } from '../test/testapi.ts';
import type { DungeonFinish } from './types.ts';

const CSS = `
.mz-dng-esito { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(360px, calc(100% - 24px)); max-height: calc(100% - 40px); overflow-y: auto; padding: 14px 14px 12px; background: rgba(46,30,20,.97); border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 5px 0 ${PAL.neroCaldo}; z-index: 22; text-align: center; touch-action: pan-y; }
.mz-dng-esito h2 { margin: 0 0 2px; font-size: 30px; letter-spacing: .05em; }
.mz-dng-esito .sub { color: ${PAL.sabbia}; font-size: 13px; margin-bottom: 8px; }
.mz-dng-esito .sec { margin: 10px 0 4px; font-size: 12px; color: ${PAL.sabbia}; text-align: left; border-bottom: 2px solid ${PAL.legno}; padding-bottom: 2px; }
.mz-dng-esito .it { display: flex; align-items: center; gap: 8px; min-height: 26px; font-size: 15px; font-weight: bold; text-align: left; }
.mz-dng-esito .it .q { margin-left: auto; color: ${PAL.sabbiaChiara}; }
.mz-dng-esito .it.lost { opacity: .6; text-decoration: line-through; }
.mz-dng-esito .xp { display: grid; grid-template-columns: 1fr 70px 52px; gap: 6px; align-items: center; font-size: 13px; text-align: left; min-height: 22px; }
.mz-dng-esito .xp .b { height: 10px; background: ${PAL.ombraCalda}; border: 2px solid ${PAL.neroCaldo}; }
.mz-dng-esito .xp .b i { display: block; height: 100%; background: ${PAL.giallo}; }
.mz-dng-esito .lvl { margin: 10px 0 2px; padding: 8px; border: 2px solid ${PAL.giallo}; color: ${PAL.giallo}; font-weight: bold; font-size: 15px; background: ${PAL.legnoScuro}; }
`;
const TITLE: Record<string, [string, string]> = { uscito: ['USCITO', PAL.erbaChiara], morto: ['SEI CADUTO', PAL.rosso], tempo: ['TEMPO SCADUTO', PAL.arancio], risalito: ['SEI RISALITO', PAL.giallo] };
let lastShown: Record<string, unknown> | null = null, closeFn: (() => void) | null = null, registered = false;

export function showDungeonResult(root: HTMLElement, r: DungeonFinish): Promise<void> {
  injectUiStyle();
  if (!document.getElementById('mz-dng-esito-style')) { const st = document.createElement('style'); st.id = 'mz-dng-esito-style'; st.textContent = CSS; document.head.appendChild(st); }
  if (!registered) {
    registered = true;
    registerStateProvider('dungeonEsito', () => lastShown);
    registerTestHook('closeDungeonEsito', () => { closeFn?.(); return true; });
  }
  const res = r.result, out = res.outcome ?? 'risalito', [title, color] = TITLE[out] ?? TITLE['tempo']!;
  const box = el('div', 'mz mz-dng-esito'); box.id = 'mzDngEsito'; box.style.borderColor = color;
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (x) => x.stopPropagation());
  const h = el('h2', '', title); h.style.color = color;
  const secs = Math.round(res.ticks / 60);
  const cadute = res.cadute ?? 0;
  box.append(h, el('div', 'sub', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} sotto terra · ${Object.values(res.uccisi ?? {}).reduce((a, b) => a + b, 0)} nemici battuti${cadute ? ` · ${cadute} ${cadute === 1 ? 'risveglio' : 'risvegli'} all’altare` : ''}`));

  const item = (id: string, n: number, lost = false) => {
    const d = hasItem(id) ? itemDef(id) : null;
    const row = el('div', `it${lost ? ' lost' : ''}`);
    row.append(d ? iconOf(d, 24) : itemIcon('materiale', PAL.pietra, 24));
    const name = el('span', '', d?.nome ?? id); name.style.color = d ? palColor(d.colore) : PAL.sabbiaChiara;
    row.append(name, el('span', 'q', `×${n}`));
    return row;
  };
  const kept = Object.entries(r.tenuto ?? {}).filter(([, n]) => n > 0);
  box.append(el('div', 'sec', 'BOTTINO TENUTO'));
  if (kept.length) for (const [id, n] of kept) box.append(item(id, n)); else box.append(el('div', 'it', out === 'morto' ? 'Niente: cadendo hai perso il bottino' : 'Niente stavolta'));
  const lost = Object.entries(res.bottino ?? {}).map(([id, n]) => [id, Math.floor(n) - (r.tenuto?.[id] ?? 0)] as const).filter(([, n]) => n > 0);
  const lostLabel = out === 'uscito' ? 'PERSO (TROPPO PESO)' : res.salvato ? 'PERSO DOPO L’ULTIMO ALTARE' : out === 'morto' ? 'PERSO CADENDO' : 'PERSO';
  if (lost.length) { box.append(el('div', 'sec', lostLabel)); for (const [id, n] of lost) box.append(item(id, n, true)); }
  const coins = el('div', 'it'); coins.append(itemIcon('anello', PAL.giallo, 24), el('span', '', 'Monete'), el('span', 'q', `+${r.monete}`));
  box.append(coins);

  // xp per abilità: quanto è salito e a che punto è il livello adesso (dal lotto del server)
  const skills = r.lot.hero?.skill;
  const kx = out === 'uscito' ? 1 : RPG.dungeon.morte.xp;
  const xp = Object.entries(res.xp ?? {}).filter(([, n]) => (n ?? 0) * kx >= 0.5) as [SkillId, number][];
  if (xp.length) {
    box.append(el('div', 'sec', 'ESPERIENZA'));
    for (const [sk, n] of xp) {
      const st = skills?.[sk], need = st ? skillXpNeeded(st.lv) : 1;
      const row = el('div', 'xp'), bar = el('div', 'b'), fill = el('i');
      fill.style.width = `${Math.round(Math.min(1, (st?.xp ?? 0) / need) * 10) * 10}%`; bar.append(fill);
      row.append(el('span', '', `${SKILL_NOME[sk] ?? sk}${st ? ` · lv ${st.lv}` : ''}`), bar, el('span', '', `+${Math.round(n * kx)}`));
      box.append(row);
    }
  }
  if (r.livelliSu > 0) box.append(el('div', 'lvl', `LIVELLO SU! Scegli nella scheda del personaggio (I)`));
  const ok = el('button', 'mz-btn', 'OK'); ok.dataset['act'] = 'ok'; ok.style.justifyContent = 'center';
  box.append(ok);
  root.append(box);
  lastShown = { open: true, outcome: out, tenuto: r.tenuto, perso: Object.fromEntries(lost), monete: r.monete, livelliSu: r.livelliSu, text: box.innerText };

  return new Promise((resolve) => {
    const close = () => { removeEventListener('keydown', onKey, true); box.remove(); closeFn = null; if (lastShown) lastShown = { ...lastShown, open: false }; resolve(); };
    const onKey = (e: KeyboardEvent) => { if (['Enter', 'Space', 'Escape', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    addEventListener('keydown', onKey, true);
    ok.addEventListener('click', close);
    closeFn = close;
  });
}
