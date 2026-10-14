// Stanza di prova dei Templari (?net=0&templari=banco): appena si apre il gioco si è nella chiesa e a destra c'è il banco per provare le
// cose senza giocare le ondate: scegliere l'ondata, far uscire uno zombie davanti, prendere un'arma, punti, immortale, ondate ferme,
// rallentatore e camera vicina. Solo resa: chi lo usa cambia lo stato della partita a mano, quindi la partita non va mai al server.
import { PAL, el, injectUiStyle } from '../ui/style.ts';

/** Quello che il banco può fare sulla partita (lo implementa index.ts, che ha lo stato). */
export type BancoAzioni = {
  ondata(n: number): number;
  zombie(tipo: string): void;
  arma(id: string): void;
  punti(n: number): void;
  pulisci(): void;
  /** Interruttori: ritornano lo stato nuovo. */
  immortale(on: boolean): void;
  ferme(on: boolean): void;
  fermi(on: boolean): void;
  lento(on: boolean): void;
  vicino(on: boolean): void;
  /** Bottoni in più (luoghi, potenziamenti), messi da chi li ha. */
  extra: { titolo: string; voci: [string, () => void][] }[];
};
export type Banco = { dispose(): void };

const CSS = `
#mzBanco { position: absolute; right: max(10px, env(safe-area-inset-right, 0px)); top: calc(max(10px, env(safe-area-inset-top)) + 46px); z-index: 30; width: 236px;
  max-height: calc(100% - 120px); overflow: auto; background: rgba(35,32,31,.92); border: 2px solid ${PAL.neroCaldo}; color: ${PAL.sabbiaChiara};
  font: bold 12px/1.2 ui-monospace, Menlo, monospace; pointer-events: auto; }
#mzBanco h4 { margin: 0; padding: 6px 8px; background: ${PAL.rosso}; color: ${PAL.sabbiaChiara}; cursor: pointer; font-size: 12px; letter-spacing: .06em; }
#mzBanco.chiuso .corpo { display: none; }
#mzBanco .corpo { padding: 4px 8px 8px; }
#mzBanco p { margin: 8px 0 4px; color: ${PAL.sabbia}; font-size: 11px; }
#mzBanco .riga { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
#mzBanco button { font: bold 11px/1 ui-monospace, Menlo, monospace; padding: 5px 6px; background: ${PAL.ombraCalda}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.neroCaldo}; cursor: pointer; }
#mzBanco button:hover { background: ${PAL.pietraScura}; }
#mzBanco button.on { background: ${PAL.giallo}; color: ${PAL.neroCaldo}; }
#mzBanco .num { min-width: 32px; text-align: center; font-size: 16px; color: ${PAL.rosso}; }
@media (max-width: 699px) { #mzBanco { width: 200px; top: calc(max(10px, env(safe-area-inset-top)) + 40px); max-height: 46%; } }
`;

const NEMICI: [string, string][] = [['fante', 'Fante'], ['pirata', 'Pirata'], ['scudato', 'Scudato'], ['cannoniere', 'Cannoniere'], ['cavaliere', 'Cavaliere'], ['molay', 'de Molay']];

export function createBanco(root: HTMLElement, armi: [string, string][], a: BancoAzioni): Banco {
  injectUiStyle();
  if (!document.getElementById('mzBancoCss')) { const st = el('style'); st.id = 'mzBancoCss'; st.textContent = CSS; document.head.append(st); }
  const box = el('div'); box.id = 'mzBanco';
  // i tocchi sul banco non arrivano al gioco (niente attacchi, niente joystick)
  for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'click', 'wheel']) box.addEventListener(ev, (e) => e.stopPropagation());
  const h = el('h4', '', 'BANCO DI PROVA ▾');
  h.addEventListener('click', () => { box.classList.toggle('chiuso'); h.textContent = box.classList.contains('chiuso') ? 'BANCO DI PROVA ▸' : 'BANCO DI PROVA ▾'; });
  const corpo = el('div', 'corpo');
  const titolo = (t: string) => corpo.append(el('p', '', t));
  const riga = () => { const r = el('div', 'riga'); corpo.append(r); return r; };
  const bottone = (r: HTMLElement, t: string, f: () => void) => { const b = el('button', '', t); b.type = 'button'; b.addEventListener('click', f); r.append(b); return b; };
  const interruttore = (r: HTMLElement, t: string, on: boolean, f: (on: boolean) => void) => {
    const b = bottone(r, t, () => { on = !on; b.classList.toggle('on', on); f(on); });
    b.classList.toggle('on', on); f(on);
  };

  titolo('Ondata');
  const ro = riga();
  let n = 1;
  const num = el('span', 'num', '1');
  const vai = (k: number) => { n = a.ondata(Math.max(1, Math.min(60, k))); num.textContent = String(n); };
  bottone(ro, '−5', () => vai(n - 5)); bottone(ro, '−', () => vai(n - 1)); ro.append(num); bottone(ro, '+', () => vai(n + 1)); bottone(ro, '+5', () => vai(n + 5));

  titolo('Fai uscire davanti a te');
  const rz = riga();
  for (const [id, nome] of NEMICI) bottone(rz, nome, () => a.zombie(id));

  titolo('Arma in mano');
  const ra = riga();
  for (const [id, nome] of armi) bottone(ra, nome, () => a.arma(id));

  titolo('Partita');
  const rp = riga();
  bottone(rp, '+5000 punti', () => a.punti(5000));
  bottone(rp, 'Via gli zombie', () => a.pulisci());
  const rt = riga();
  interruttore(rt, 'Immortale', true, a.immortale);
  interruttore(rt, 'Ondate ferme', true, a.ferme);
  interruttore(rt, 'Zombie fermi', false, a.fermi);
  titolo('Per guardare');
  const rv = riga();
  interruttore(rv, 'Rallenta ×¼', false, a.lento);
  interruttore(rv, 'Camera vicina', false, a.vicino);

  for (const x of a.extra) {
    titolo(x.titolo);
    const r = riga();
    for (const [t, f] of x.voci) bottone(r, t, f);
  }

  box.append(h, corpo);
  root.append(box);
  return { dispose() { box.remove(); } };
}
