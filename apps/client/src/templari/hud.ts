// HUD delle ondate (docs/TEMPLARI.md §4-5), alla Call of Duty Zombies ma coi colori di MAREA: in alto a sinistra il numero dell'ondata
// grande e rosso, sotto i punti gialli con i «+10 / +60» che salgono, l'arma in mano e quanti zombie restano; il bordo dello schermo si
// tinge di rosso a gradini quando ti colpiscono (niente barra della vita grande: come in COD); scritte grandi al centro (ONDATA 3, SEI CADUTO).
import type { TView } from '@marea/sim/templari/types.ts';
import { PAL, el, injectUiStyle } from '../ui/style.ts';

const TOP = 'max(10px, env(safe-area-inset-top))', LEFT = 'max(12px, env(safe-area-inset-left, 0px))';
const CSS = `
#mzTpl { position: absolute; inset: 0; pointer-events: none; z-index: 12; font-family: ui-monospace, Menlo, monospace; }
#mzTpl .ond { position: absolute; left: ${LEFT}; top: ${TOP}; display: flex; align-items: flex-end; gap: 8px; }
#mzTpl .ond b { font: bold 46px/1 'Press Start 2P', ui-monospace, monospace; color: ${PAL.rosso}; text-shadow: 3px 3px 0 ${PAL.neroCaldo}, -1px -1px 0 ${PAL.neroCaldo}; letter-spacing: -2px; }
#mzTpl .ond small { font-size: 12px; font-weight: bold; color: ${PAL.sabbia}; text-shadow: 1px 1px 0 ${PAL.neroCaldo}; margin-bottom: 4px; }
#mzTpl .pti { position: absolute; left: ${LEFT}; top: calc(${TOP} + 56px); font: bold 24px/1 ui-monospace, Menlo, monospace; color: ${PAL.giallo}; text-shadow: 2px 2px 0 ${PAL.neroCaldo}; }
#mzTpl .pti i { position: absolute; left: 100%; top: 0; margin-left: 8px; font-style: normal; font-size: 16px; white-space: nowrap; animation: mzTplSu .9s steps(6) forwards; }
#mzTpl .pti i.neg { color: ${PAL.rosso}; }
@keyframes mzTplSu { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-28px); opacity: 0; } }
#mzTpl .arma { position: absolute; left: ${LEFT}; top: calc(${TOP} + 86px); font-size: 13px; font-weight: bold; color: ${PAL.sabbiaChiara}; text-shadow: 1px 1px 0 ${PAL.neroCaldo}; }
#mzTpl .arma em { font-style: normal; color: ${PAL.sabbia}; }
#mzTpl .arma b { color: ${PAL.giallo}; }
#mzTpl .vita { position: absolute; left: ${LEFT}; top: calc(${TOP} + 106px); width: 96px; height: 7px; background: ${PAL.ombraCalda}; border: 2px solid ${PAL.neroCaldo}; }
#mzTpl .vita i { display: block; height: 100%; background: ${PAL.rosso}; }
#mzTpl .pot { position: absolute; left: ${LEFT}; top: calc(${TOP} + 122px); display: flex; gap: 6px; }
#mzTpl .pot span { padding: 2px 6px; background: rgba(35,32,31,.85); border: 2px solid currentColor; font-size: 12px; font-weight: bold; }
#mzTpl .pot span.lamp { animation: mzTplLamp .5s steps(2) infinite; }
@keyframes mzTplLamp { 50% { opacity: .2; } }
#mzTpl .vign { position: absolute; inset: 0; opacity: 0; box-shadow: inset 0 0 0 10px rgba(232,67,63,.55), inset 0 0 0 22px rgba(232,67,63,.3), inset 0 0 0 40px rgba(232,67,63,.14); }
#mzTpl .boss { position: absolute; left: 50%; top: calc(${TOP} + 34px); transform: translateX(-50%); width: min(360px, calc(100% - 140px)); display: none; text-align: center; }
#mzTpl .boss.on { display: block; }
#mzTpl .boss b { display: block; font-size: 13px; color: ${PAL.sabbiaChiara}; text-shadow: 2px 2px 0 ${PAL.neroCaldo}; letter-spacing: .08em; }
#mzTpl .boss .bar { position: relative; height: 10px; margin-top: 3px; background: ${PAL.ombraCalda}; border: 2px solid ${PAL.neroCaldo}; }
#mzTpl .boss .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: ${PAL.rosso}; }
#mzTpl .boss .bar em { position: absolute; top: -3px; bottom: -3px; width: 2px; background: ${PAL.giallo}; }
#mzTpl .big { position: absolute; left: 50%; top: 32%; transform: translate(-50%, -50%); text-align: center; display: none; width: min(92%, 520px); }
#mzTpl .big.on { display: block; }
#mzTpl .big b { display: block; font: bold 34px/1.15 'Press Start 2P', ui-monospace, monospace; text-shadow: 3px 3px 0 ${PAL.neroCaldo}; }
#mzTpl .big.num b { font-size: 92px; letter-spacing: -4px; }
#mzTpl .big span { display: block; margin-top: 10px; font-size: 15px; font-weight: bold; color: ${PAL.sabbiaChiara}; text-shadow: 2px 2px 0 ${PAL.neroCaldo}; }
#mzTpl .msg { position: absolute; left: 50%; top: calc(${TOP} + 8px); transform: translateX(-50%); max-width: calc(100% - 200px); text-align: center; font-size: 14px; font-weight: bold; color: ${PAL.sabbiaChiara}; text-shadow: 2px 2px 0 ${PAL.neroCaldo}; }
@media (max-width: 699px) { #mzTpl .big.num b { font-size: 72px; } #mzTpl .ond b { font-size: 36px; } #mzTpl .msg { top: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 190px); max-width: calc(100% - 24px); } #mzTpl .big b { font-size: 24px; } }
/* come nel dungeon (rpg/dungeon_hud.ts): l'interfaccia di superficie sparisce (main.ts mette body.mz-sotto anche qui) */
body.mz-sotto #compass, body.mz-sotto #mzTop, body.mz-sotto #mzGuida, body.mz-sotto #mzGuidaPtr, body.mz-sotto .mz-bar, body.mz-sotto .mz-work,
body.mz-sotto .mz-labels, body.mz-sotto #mzPlay, body.mz-sotto #mzEmoteRow, body.mz-sotto #mzEmotes, body.mz-sotto #mzSheet { display: none !important; }
`;

export type TplHud = {
  set(v: TView): void;
  /** Punti guadagnati (o spesi, negativi): il numerino che sale accanto ai punti. */
  punti(n: number): void;
  /** Scritta grande al centro per `ms` (0 = finché non la si toglie). */
  grande(testo: string, colore: string, sub?: string, ms?: number): void;
  togliGrande(): void;
  dispose(): void;
};

const NOMI_FASE = { altare: 'Porta la reliquia all’altare', inizio: 'La terra trema…', pausa: 'Respira: arriva la prossima ondata', combatti: '' } as const;

export function createTplHud(root: HTMLElement, nomeArma: (id: string) => string, munizioni: (id: string) => boolean): TplHud {
  injectUiStyle();
  if (!document.getElementById('mz-tpl-style')) { const st = document.createElement('style'); st.id = 'mz-tpl-style'; st.textContent = CSS; document.head.appendChild(st); }
  const box = el('div', 'mz'); box.id = 'mzTpl';
  const ond = el('div', 'ond'), ondN = el('b', '', ''), ondL = el('small', '', '');
  ond.append(ondN, ondL);
  const pti = el('div', 'pti', '500'), arma = el('div', 'arma', ''), vita = el('div', 'vita'), vitaI = el('i'), vign = el('div', 'vign');
  vita.append(vitaI);
  const big = el('div', 'big'), bigB = el('b'), bigS = el('span'), msg = el('div', 'msg');
  const boss = el('div', 'boss'), bossN = el('b'), bossBar = el('div', 'bar'), bossI = el('i'), bossF = el('em');
  bossBar.append(bossI, bossF); boss.append(bossN, bossBar);
  big.append(bigB, bigS);
  const pot = el('div', 'pot');
  box.append(vign, ond, pti, arma, vita, pot, msg, boss, big);
  root.append(box);
  let bigT: ReturnType<typeof setTimeout> | null = null, shown = { ond: -1, pti: -1, arma: '', msg: '', vita: -1, rest: -1, pot: '' };

  return {
    set(v) {
      const n = v.ondata;
      if (n !== shown.ond || v.restano !== shown.rest) {
        shown.ond = n; shown.rest = v.restano;
        ondN.textContent = n > 0 ? String(n) : '✠';
        ondL.textContent = n > 0 ? (v.fase === 'combatti' ? `ONDATA · ne restano ${v.restano}` : 'ONDATA') : '';
      }
      if (v.eroe.punti !== shown.pti) { shown.pti = v.eroe.punti; pti.firstChild!.textContent = String(v.eroe.punti); }
      const inMano = v.eroe.scudo?.inMano, a = v.eroe.armi[v.eroe.cur], altra = v.eroe.armi.find((x, i) => i !== v.eroe.cur && x);
      const colpi = !inMano && a && (a.colpi > 0 || a.riserva > 0 || munizioni(a.id)) ? ` ${a.colpi} | ${a.riserva}` : '';
      const nome = inMano ? 'Scudo templare' : a ? nomeArma(a.id) : '';
      const sc = v.eroe.scudo ? ` · scudo ${Math.ceil((v.eroe.scudo.vita / v.eroe.scudo.max) * 100)}%` : '';
      const ric = v.eroe.ricarica > 0 ? ' · ricarica…' : '';
      const aTxt = `${nome}|${colpi}|${altra?.id ?? ''}|${sc}|${ric}`;
      if (aTxt !== shown.arma) { shown.arma = aTxt; arma.replaceChildren(el('span', '', nome), el('b', '', colpi), el('em', '', `${ric}${altra && !inMano ? ` · ${nomeArma(altra.id)}` : ''}${sc}`)); }
      const fr = Math.max(0, Math.min(1, v.eroe.vita / v.eroe.max));
      if (Math.abs(fr - shown.vita) > 0.01) { shown.vita = fr; vitaI.style.width = `${Math.round(fr * 100)}%`; }
      // bordo rosso: a gradini, più forte quando la vita è bassa e appena colpito
      const k = Math.max(v.eroe.ferita, 1 - fr);
      vign.style.opacity = String(Math.round(k * 4) / 4);
      // barra del boss: il nome, la vita, e per de Molay il segno di dove scapperà
      boss.classList.toggle('on', !!v.boss);
      if (v.boss) {
        const nome = v.boss.nome.toUpperCase();
        if (bossN.textContent !== nome) bossN.textContent = nome;
        bossI.style.width = `${Math.round((v.boss.vita / Math.max(1, v.boss.max)) * 100)}%`;
        bossF.style.display = v.boss.fugge > 0 ? 'block' : 'none'; bossF.style.left = `${Math.round(v.boss.fugge * 100)}%`;
      }
      // power-up a tempo: Ira di Dio e Decima coi secondi che restano (lampeggiano negli ultimi 5)
      const pk = `${Math.ceil(v.poteri.ira)}|${Math.ceil(v.poteri.decima)}`;
      if (pk !== shown.pot) {
        shown.pot = pk;
        const b = (testo: string, s: number, c: string) => { const x = el('span', s <= 5 ? 'lamp' : '', `${testo} ${Math.ceil(s)}`); x.style.color = c; return x; };
        pot.replaceChildren(...(v.poteri.ira > 0 ? [b('✠ IRA', v.poteri.ira, PAL.rosso)] : []), ...(v.poteri.decima > 0 ? [b('×2 DECIMA', v.poteri.decima, PAL.arancio)] : []));
      }
      const m = v.fase === 'pausa' || v.fase === 'inizio' ? `${NOMI_FASE[v.fase]} · ${Math.ceil(v.faseS)} s` : NOMI_FASE[v.fase];
      if (m !== shown.msg) { shown.msg = m; msg.textContent = m; }
    },
    punti(n) {
      if (!n) return;
      const i = el('i', n < 0 ? 'neg' : '', n > 0 ? `+${n}` : String(n));
      pti.appendChild(i);
      setTimeout(() => i.remove(), 950);
    },
    grande(testo, colore, sub = '', ms = 2200) {
      bigB.textContent = testo; bigB.style.color = colore; bigS.textContent = sub; big.classList.add('on'); big.classList.toggle('num', testo.length <= 3);
      if (bigT) clearTimeout(bigT);
      bigT = ms > 0 ? setTimeout(() => big.classList.remove('on'), ms) : null;
    },
    togliGrande() { big.classList.remove('on'); },
    dispose() { if (bigT) clearTimeout(bigT); box.remove(); },
  };
}
