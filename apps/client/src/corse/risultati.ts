// La schermata dei risultati delle Corse (#276), rifatta fedele a `assets/concept/corse/risultati_4_sonic.jpg` (scelta da Jack):
// titolo RISULTATI in alto a sinistra, la tua posizione enorme con l'alloro, la classifica a barre inclinate con le facce e i tempi,
// il giro migliore, sotto le ricompense e RIGIOCA / AVANTI. Si disegna dentro la scheda dell'esito dei minigiochi (#mzEsito, coi
// suoi bottoni: R, Invio ed Esc restano quelli), sopra la gara ferma all'arrivo. Lo stile è in `stile_kart.ts`.
import { resIcon } from '../ui/icons.ts';
import { ICONA, stileKart } from './stile_kart.ts';
import { ritratto } from './ritratti.ts';
import type { RigaArrivo } from './vista_gara.ts';

export type DatiRisultati = {
  righe: RigaArrivo[];
  /** Il tuo giro migliore (ms), null nelle fughe (niente giri). */
  giroMigliore: number | null;
  /** Monete vinte (#414); null = nessun premio. */
  premio: number | null; nota: string | null;
  /** I bottoni della scheda (data-act rigioca / ok): qui si rivestono e si mettono al loro posto. */
  again: HTMLButtonElement; ok: HTMLButtonElement;
};

/** m:ss,mmm come nella reference. */
const tempo = (ms: number): string => { const t = Math.max(0, Math.round(ms)), m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000), c = t % 1000; return `${m}:${String(s).padStart(2, '0')},${String(c).padStart(3, '0')}`; };
const pulito = (t: string) => t.replace(/[<>&"]/g, '');

export function vestiRisultati(el: HTMLElement, d: DatiRisultati): void {
  stileKart();
  el.classList.add('kart');
  const io = Math.max(0, d.righe.findIndex((r) => r.tu));
  const righe = d.righe.slice(0, 6);
  if (io >= 6) righe[5] = d.righe[io]!; // tu ci sei sempre, anche oltre il sesto
  const lista = righe.map((r) => {
    const n = d.righe.indexOf(r) + 1;
    return `<div class="kr-riga${r.tu ? ' tu' : ''}${r.ms === null ? ' via' : ''}"><span class="n">${n}</span><span class="ft"><img alt=""></span><span class="nm">${pulito(r.nome)}</span><span class="t"><span>${r.ms === null ? '—' : tempo(r.ms)}</span></span></div>`;
  }).join('');
  const giro = d.giroMigliore === null ? '' : `<div class="kr-giro"><i>${ICONA.cronometro}</i><span>giro migliore</span><b>${tempo(d.giroMigliore)}</b></div>`;
  el.innerHTML = `<div class="kr-titolo"><h2>RISULTATI</h2></div>`
    + `<div class="kr-pos"><i>${ICONA.alloro}</i><b>${io + 1}<sup>°</sup></b><i>${ICONA.alloro}</i></div>`
    + `<div class="kr-lista">${lista}${giro}</div>`
    + `<div class="kr-premi"><h3>ricompense</h3><div class="celle"></div></div>`
    + `<div class="kr-bott mz-row"></div>`;
  // le facce arrivano appena il renderer piccolo le ha fatte
  el.querySelectorAll<HTMLImageElement>('.kr-riga .ft img').forEach((img, i) => {
    const r = righe[i]!;
    void ritratto({ veicolo: r.veicolo, pilota: r.pilota, look: r.look }).then((u) => { if (u) img.src = u; else img.remove(); });
  });
  // le ricompense: icona, +N e il nome (le icone a pixel vogliono un lato multiplo di 8)
  const celle = el.querySelector('.celle')!, u = Math.min(innerHeight, innerWidth * 0.5625) / 941, lato = Math.max(16, Math.round((64 * u) / 8) * 8);
  const voci = d.premio && d.premio > 0 ? [d.premio] : [];
  for (const n of voci) {
    const c = document.createElement('div'); c.className = 'cella';
    const t = document.createElement('span'); t.innerHTML = `<b>+${n}</b><small>monete</small>`;
    c.append(resIcon('monete', lato), t); celle.appendChild(c);
  }
  if (!voci.length) { const n = document.createElement('div'); n.className = 'nota'; n.textContent = d.nota ?? 'Nessuna ricompensa questa volta'; celle.replaceWith(n); }
  else if (d.nota) { const n = document.createElement('div'); n.className = 'nota'; n.textContent = d.nota; el.querySelector('.kr-premi')!.appendChild(n); }
  d.again.innerHTML = `<i>${ICONA.rigioca}</i><span>RIGIOCA</span>`; d.again.className = 'mz-btn';
  d.ok.innerHTML = `<span>AVANTI</span><i>${ICONA.avanti}</i>`; d.ok.className = 'mz-btn';
  el.querySelector('.kr-bott')!.append(d.again, d.ok);
}
