// La scelta delle carte della Difesa: prima di un livello (o della Sopravvivenza) con più carte sbloccate di `carte.max` si toccano le
// carte da portare (al massimo `max`; quelle in più restano a casa). Parte già con la scelta dell'ultima volta e la carta nuova del
// livello dentro (carte.ts nella sim). VIA! avvia la partita con quelle, nell'ordine del livello.
import type { DTipoUnita } from '@marea/content/difesa.ts';
import type { Ui } from './ui.ts';

export type ArgScelta = {
  titolo: string; carte: DTipoUnita[]; nuova: DTipoUnita | null; costi: Record<string, number>; nomi: (t: DTipoUnita) => string;
  max: number; iniziale: DTipoUnita[];
};

export function sceltaCarte(ui: Ui, o: ArgScelta, via: (scelte: DTipoUnita[]) => void, indietro: () => void): void {
  const su = new Set<DTipoUnita>(o.iniziale);
  ui.pannello((pan) => {
    const h1 = document.createElement('h1'), sotto = document.createElement('p'), griglia = document.createElement('div'), conta = document.createElement('p');
    h1.textContent = 'SCEGLI LE CARTE';
    sotto.textContent = `${o.titolo} · porta fino a ${o.max} carte`;
    griglia.className = 'df-scelta'; conta.className = 'df-conta';
    const tessere = new Map<DTipoUnita, HTMLButtonElement>();
    const vai = document.createElement('button'), torna = document.createElement('button');
    vai.className = 'df-grosso'; vai.textContent = 'VIA!';
    torna.className = 'df-grosso b2'; torna.textContent = 'LIVELLI';
    vai.dataset['padInizio'] = ''; torna.dataset['padBack'] = '';
    const aggiorna = () => {
      for (const [t, b] of tessere) { b.classList.toggle('on', su.has(t)); b.setAttribute('aria-pressed', String(su.has(t))); }
      conta.textContent = `${su.size} / ${o.max}`;
      conta.classList.toggle('pieno', su.size >= o.max);
      vai.disabled = su.size === 0;
    };
    for (const t of o.carte) {
      const b = document.createElement('button'), cv = document.createElement('canvas'), nome = document.createElement('span');
      b.className = 'df-sc'; nome.textContent = o.nomi(t);
      ui.icona(cv, t);
      b.append(cv, nome, ui.costo(o.costi[t] ?? 0));
      if (t === o.nuova) { const n = document.createElement('i'); n.className = 'df-nuova'; n.textContent = 'NUOVA'; b.append(n); }
      b.addEventListener('click', () => {
        if (su.has(t)) su.delete(t);
        else if (su.size < o.max) su.add(t);
        else { conta.textContent = `Al massimo ${o.max}: togline una`; setTimeout(aggiorna, 1600); return; }
        aggiorna();
      });
      tessere.set(t, b); griglia.append(b);
    }
    vai.addEventListener('click', () => via(o.carte.filter((t) => su.has(t))));
    torna.addEventListener('click', indietro);
    const fila = document.createElement('div');
    fila.append(vai, torna);
    pan.append(h1, sotto, griglia, conta, fila);
    aggiorna();
  });
}
