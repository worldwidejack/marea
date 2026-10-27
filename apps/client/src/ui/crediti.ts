// CREDITI della schermata iniziale (avvio/home.ts), chunk a parte: chi fa MAREA (apps/client/autori.json), i caratteri con la loro licenza OFL
// (public/assets/fonts/LEGGIMI.txt) e gli asset esterni o generati (assets/licenses.md). La build li copia così come sono in /crediti.json
// (vite.config.ts): un font o un asset nuovo scritto nel suo file compare qui senza toccare questo codice.
import autori from '../../autori.json';
import { cartaKit, rigaKit, veloKit } from './kit.ts';
import { el } from './style.ts';

/** I nomi da mostrare, una volta sola (la chiave «_» è la spiegazione del file). */
function persone(a: Record<string, string>): string[] {
  return [...new Set(Object.entries(a).filter(([k]) => k !== '_').map(([, v]) => v))];
}
/** Dalle righe «- file: «Nome» di Autore (…), Licenza.» di LEGGIMI.txt: nome, autore, licenza. */
function caratteri(testo: string): { nome: string; autore: string; licenza: string }[] {
  const out: { nome: string; autore: string; licenza: string }[] = [];
  for (const riga of testo.split(/\r?\n/)) for (const m of riga.matchAll(/«([^»]+)» di ([^(,]+?)\s*(?:\([^)]*\))?,\s*([^,.]*License[^,.]*\d(?:\.\d)?)/g)) {
    if (!out.some((c) => c.nome === m[1])) out.push({ nome: m[1]!, autore: m[2]!.trim(), licenza: m[3]!.trim() });
  }
  return out;
}
/** Le righe della tabella di licenses.md: cosa (la parentesi della prima colonna, senza il numero della PR), fonte, licenza, credito. */
function asset(testo: string): { cosa: string; fonte: string; licenza: string; credito: string }[] {
  return testo.split(/\r?\n/).filter((r) => /^\|\s*`/.test(r)).map((r) => {
    const [a = '', fonte = '', licenza = '', credito = ''] = r.split('|').slice(1, 5).map((c) => c.trim());
    const cosa = (/\(([^)]*)\)/.exec(a)?.[1] ?? a.replace(/`/g, '')).replace(/,?\s*#\d+/g, '').trim();
    return { cosa, fonte, licenza, credito };
  });
}

export async function apriCrediti(dove: HTMLElement): Promise<void> {
  let velo = document.getElementById('mzCrediti');
  if (!velo) {
    const f = await fetch('/crediti.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as { caratteri?: string; asset?: string };
    if (document.getElementById('mzCrediti')) return; // due tocchi di fila
    const v = veloKit(dove, 'mzCrediti');
    const { carta, corpo } = cartaKit('Crediti', () => v.classList.remove('on'));
    corpo.append(el('div', 'mk-sez', 'Lo fanno'), rigaKit({ nome: persone(autori as Record<string, string>).join(' · '), sotto: ['con Claude, Codex e Antigravity'] }));
    corpo.append(el('div', 'mk-sez', 'Caratteri'));
    for (const c of caratteri(f.caratteri ?? '')) corpo.append(rigaKit({ nome: c.nome, sotto: [`di ${c.autore} · ${c.licenza}`] }));
    corpo.append(el('div', 'mk-sez', 'Disegni e modelli'));
    for (const a of asset(f.asset ?? '').filter((x) => !/Font License/.test(x.licenza))) corpo.append(rigaKit({ nome: a.cosa, sotto: [[a.licenza, a.credito !== '—' ? a.credito : ''].filter(Boolean).join(' · ')] }));
    v.appendChild(carta); v.addEventListener('click', (e) => { if (e.target === v) v.classList.remove('on'); });
    velo = v;
  }
  velo.classList.add('on');
}
