// Schermata iniziale (#615): il disegno di Riccardo coi bottoni GIOCA · IMPOSTAZIONI · CREDITI. Markup e CSS stanno in index.html, così si vede
// prima del gioco, che intanto carica dietro e sta fermo (voce 'ferma' del registro in main.ts). GIOCA a mondo pronto chiude col velo dei
// passaggi; prima mostra «Carico… N%» ed entra da solo appena il mondo è pronto. Con l'invito (?invito=, senza token) GIOCA apre il modulo
// del nome (ui/entra.ts). Si vede a ogni avvio, anche ai veterani; coi test solo con ?home=1 (FLAGS.home).
// Finché è aperta i tasti non arrivano al gioco: Invio e Spazio sono GIOCA, Esc chiude i crediti.
import { FLAGS } from '../flags.ts';
import { sbloccaAudio } from '../audio/ponte.ts';
import { registerStateProvider } from '../test/testapi.ts';
import type { Loader } from '../render/loader.ts';
import type { Velo } from '../ui/velo.ts';

export type Home = {
  /** La home è a schermo: il mondo dietro sta fermo. */
  aperta(): boolean;
  /** Si risolve al tocco su GIOCA (subito se la home non c'è). */
  readonly gioca: Promise<void>;
  /** Si risolve quando la home se ne va: la cartolina del rientro e le novità aspettano questo. */
  readonly chiusa: Promise<void>;
  /** Un passo di boot() fatto (sono PASSI): la barra ne tiene conto insieme ai modelli del loader. */
  passo(): void;
  segui(loader: Loader): void;
  /** Il pannello delle Impostazioni esiste: il bottone si accende. */
  impostazioni(p: { open(): void; close(): void; isOpen(): boolean }): void;
  /** Il mondo è pronto: se GIOCA è già stato toccato si entra subito. */
  pronto(velo: Velo): void;
};

const PASSI = 4; // in boot(): il loader, chi sei, il mondo, isole e modalità
const NIENTE: Home = { aperta: () => false, gioca: Promise.resolve(), chiusa: Promise.resolve(), passo() {}, segui() {}, impostazioni() {}, pronto() {} };

export function apriHome(): Home {
  const box = document.getElementById('mzHome');
  if (!box || !FLAGS.home) { box?.remove(); return NIENTE; }
  let aperta = true, aspetta = false, passi = 0, pct = 0, timer = 0;
  let velo: Velo | null = null, loader: Loader | null = null, pannello: { close(): void; isOpen(): boolean } | null = null;
  let fineGioca = () => {}, fineChiusa = () => {};
  const gioca = new Promise<void>((r) => { fineGioca = r; }), chiusa = new Promise<void>((r) => { fineChiusa = r; });
  const btn = (k: string) => box.querySelector<HTMLButtonElement>(`[data-home="${k}"]`);
  const scritta = box.querySelector('.carico span'), barra = box.querySelector<HTMLElement>('.barra i');
  const crediti = () => document.getElementById('mzCrediti');

  const conta = (fine = false) => {
    const c = loader?.conta() ?? { chiesti: 0, fatti: 0 };
    const k = 0.3 * passi / PASSI + 0.7 * (c.chiesti ? c.fatti / c.chiesti : 0);
    pct = fine ? 100 : Math.max(pct, Math.min(99, Math.floor(k * 100))); // mai indietro, 100 solo a mondo pronto
    if (scritta) scritta.textContent = `Carico… ${pct}%`;
    if (barra) barra.style.width = `${pct}%`;
  };
  const chiudi = () => {
    if (!aperta) return;
    aperta = false; clearInterval(timer);
    removeEventListener('keydown', tasti, true); removeEventListener('keyup', tasti, true);
    pannello?.close(); box.remove(); fineChiusa();
  };
  const entra = (v: Velo) => { void v.passa(chiudi).then((ok) => { if (!ok) chiudi(); }); };
  const premi = () => {
    if (!aperta || aspetta) return;
    sbloccaAudio(); fineGioca();
    if (FLAGS.invito && !FLAGS.token) { chiudi(); return; } // main.ts apre il modulo del nome; il mondo non si carica
    if (velo) { entra(velo); return; }
    aspetta = true; box.classList.add('carica');
    const b = btn('gioca'); if (b) b.disabled = true;
    conta(); timer = window.setInterval(conta, 150);
  };
  function tasti(e: KeyboardEvent): void {
    if (pannello?.isOpen() && e.key === 'Escape') return; // le Impostazioni aperte sopra si chiudono da sé
    e.stopImmediatePropagation();
    if (e.type !== 'keydown' || pannello?.isOpen()) return;
    const cr = crediti();
    if (cr?.classList.contains('on')) { if (e.key === 'Escape') cr.classList.remove('on'); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); premi(); }
  }
  addEventListener('keydown', tasti, true); addEventListener('keyup', tasti, true);
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, (e) => e.stopPropagation());
  btn('gioca')?.addEventListener('click', premi);
  btn('crediti')?.addEventListener('click', () => { void import('../ui/crediti.ts').then((m) => m.apriCrediti(box)).catch((e: unknown) => { console.warn('[marea] crediti non caricati', e); }); });
  registerStateProvider('home', () => ({ aperta, carica: aspetta, pct, pronto: !!velo }));
  return {
    aperta: () => aperta, gioca, chiusa,
    passo() { passi = Math.min(PASSI, passi + 1); },
    segui(l) { loader = l; },
    impostazioni(p) {
      pannello = p;
      const b = btn('impostazioni'); if (!b) return;
      b.disabled = false; b.addEventListener('click', () => { if (aperta) p.open(); });
    },
    pronto(v) {
      velo = v;
      if (aspetta) { conta(true); entra(v); }
    },
  };
}
