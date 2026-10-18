// «Dall'ultima volta» (#279): all'ingresso, se su main sono arrivati lavori nuovi dall'ultima visita, una schermata con due righe per
// persona (Riccardo ha fatto…, Albi…, Jack…). I lavori li scrive la build in /novita.json dal git log (vite.config.ts: un commit = una
// PR col suo titolo; nomi in apps/client/autori.json). L'ultima visita sta nel browser (`marea:novita:<id>`): alla prima volta si
// guardano gli ultimi 3 giorni. Chunk caricato con import() da main.ts, dopo la cartolina «Mentre eri via».
// Tastiera in capture su window solo a pannello aperto, con stopPropagation (mai keyup), come feed ed editor: Esc / Invio / Spazio chiudono.
import { PAL, el } from './style.ts';

export type Lavoro = { t: number; chi: string; titolo: string };
export type NovitaOpts = {
  root: HTMLElement;
  /** Chiave dell'ultima visita nel browser (una per persona). */
  chiave: string;
  /** Un altro pannello, una gara o un minigioco aperti: si aspetta che finiscano. */
  busy(): boolean;
  /** Solo test: lavori e ora (s) al posto di /novita.json e dell'orologio. */
  prova?: { lavori: Lavoro[]; ora: number };
};

const P = PAL;
const PRIMA_VOLTA_S = 3 * 86400;
const COLORI = [P.acquaBassa, P.rosaNeon, P.giallo, P.erbaChiara, P.arancio];
const CSS = `
.mz-nv-bg { position: absolute; inset: 0; z-index: 29; background: rgba(35,32,31,.6); }
.mz-nv { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 30; box-sizing: border-box; width: min(420px, calc(100% - 24px)); max-height: calc(100% - 48px); overflow-y: auto;
  padding: 18px 18px 16px; background: ${P.abisso}; color: ${P.sabbiaChiara}; border: 3px solid ${P.acquaBassa}; border-radius: 16px; box-shadow: 0 6px 0 ${P.neroCaldo};
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-user-select: none; user-select: none; }
.mz-nv h2 { margin: 0; font-size: 24px; line-height: 1.1; font-weight: 900; color: ${P.giallo}; }
.mz-nv .sub { margin: 4px 0 14px; font-size: 13px; font-weight: 600; color: ${P.acquaBassa}; }
.mz-nv .chi { margin: 0 0 12px; padding: 10px 12px; background: rgba(35,32,31,.35); border-radius: 12px; }
.mz-nv .nome { font-size: 17px; font-weight: 900; }
.mz-nv .nome small { margin-left: 6px; font-size: 12px; font-weight: 600; color: ${P.pietra}; }
.mz-nv .cosa { margin: 4px 0 0; font-size: 15px; line-height: 1.35; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.mz-nv .tutto { display: none; margin: 6px 0 0; padding: 0; min-height: 32px; background: none; border: 0; color: ${P.acquaBassa}; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.mz-nv .chi.lunga .tutto { display: block; }
.mz-nv ul { display: none; margin: 6px 0 0; padding-left: 18px; font-size: 14px; line-height: 1.35; }
.mz-nv .chi.aperta .cosa, .mz-nv .chi.aperta .tutto { display: none; }
.mz-nv .chi.aperta ul { display: block; }
.mz-nv li { margin: 3px 0; }
.mz-nv .ok { display: block; width: 100%; min-height: 48px; margin-top: 4px; background: ${P.giallo}; color: ${P.neroCaldo}; border: 0; border-radius: 12px; box-shadow: 0 4px 0 ${P.neroCaldo};
  font: inherit; font-size: 18px; font-weight: 900; cursor: pointer; }
.mz-nv .ok:active { transform: translateY(2px); box-shadow: 0 2px 0 ${P.neroCaldo}; }
`;

/** Una frase corta per titolo: via le parentesi, «Corse: menù…» → argomento «Corse» + prima parte; «…, passo 4» via dall'argomento. */
function pezzo(titolo: string): { tema: string | null; cosa: string } {
  const s = titolo.replace(/\s*\([^()]*\)/g, '').trim();
  const prima = (x: string) => (x.split(/,\s|;\s|\s—\s/)[0] ?? x).trim();
  const m = /^([^:]{1,40}):\s+(.+)$/.exec(s);
  if (!m) return { tema: null, cosa: prima(s) };
  const tema = (m[1] ?? '').replace(/,?\s*passo\s+\S+$/i, '').trim();
  // argomento lungo («Teletrasporto sulle isole per tutti i giocatori: …») = è già lui la notizia
  return tema.length <= 28 ? { tema, cosa: prima(m[2] ?? '') } : { tema: null, cosa: tema };
}

/** I titoli (dal più nuovo) in poche frasi, l'argomento più lavorato prima: «Corse (5): HUD in gara; menù di scelta… · Borgo Marea a vicoli».
 *  Un titolo senza «:» che comincia con un argomento già visto («Corse in HD…») va sotto quell'argomento. */
export function riassunto(titoli: string[]): string {
  // le PR solo di test non cambiano il gioco: nel conto sì, nelle due righe no
  const pezzi = titoli.filter((t) => !/^Test\b/.test(t)).map(pezzo).filter((p) => p.cosa);
  const noti = new Set(pezzi.flatMap((p) => p.tema ? [p.tema.toLowerCase()] : []));
  const gruppi = new Map<string, { tema: string | null; n: number; cose: string[]; ord: number }>();
  for (const p of pezzi) {
    let { tema, cosa } = p;
    if (!tema) { const w = cosa.split(' ')[0] ?? ''; if (noti.has(w.toLowerCase()) && cosa.length > w.length) { tema = w; cosa = cosa.slice(w.length).trim(); } }
    const k = tema ? tema.toLowerCase() : `·${cosa}`;
    const g = gruppi.get(k) ?? { tema, n: 0, cose: [], ord: gruppi.size };
    g.n++; if (!g.cose.includes(cosa)) g.cose.push(cosa);
    gruppi.set(k, g);
  }
  // con più argomenti, al massimo due cose per argomento: nelle due righe deve starci anche il resto
  const tutti = [...gruppi.values()].sort((a, b) => b.n - a.n || a.ord - b.ord), max = tutti.length > 1 ? 2 : 99;
  return tutti.map((g) => g.tema ? `${g.tema}${g.n > 1 ? ` (${g.n})` : ''}: ${g.cose.slice(0, max).join('; ')}${g.cose.length > max ? '…' : ''}` : g.cose[0] ?? '').join(' · ');
}

/** Lavori nuovi per persona, chi ne ha fatti di più prima. */
export function perPersona(lavori: Lavoro[], da: number): { chi: string; titoli: string[] }[] {
  const m = new Map<string, string[]>();
  for (const l of [...lavori].sort((a, b) => b.t - a.t)) if (l.t > da) { const a = m.get(l.chi) ?? []; a.push(l.titolo); m.set(l.chi, a); }
  return [...m].map(([chi, titoli]) => ({ chi, titoli })).sort((a, b) => b.titoli.length - a.titoli.length);
}

function quando(da: number, ora: number): string {
  const h = (ora - da) / 3600;
  if (h < 1) return 'da poco fa';
  if (h < 24) return `da ${Math.round(h)} ${Math.round(h) === 1 ? 'ora' : 'ore'} fa`;
  const g = Math.round(h / 24);
  return g === 1 ? 'da ieri' : `da ${g} giorni fa`;
}

const leggi = (k: string): number | null => { try { const v = localStorage.getItem(k); return v ? Number(v) || null : null; } catch { return null; } };
const scrivi = (k: string, t: number) => { try { localStorage.setItem(k, String(t)); } catch { /* storage bloccato: la rivedrai */ } };

/** Mostra la schermata se ci sono lavori nuovi. Risponde quando si chiude (true) o subito se non c'era niente (false). */
export async function apriNovita(o: NovitaOpts): Promise<boolean> {
  let lavori: Lavoro[] = o.prova?.lavori ?? [];
  if (!o.prova) {
    try {
      const r = await fetch(`/novita.json?b=${encodeURIComponent(__BUILD__)}`);
      if (!r.ok) return false;
      lavori = ((await r.json()) as { lavori?: Lavoro[] }).lavori ?? [];
    } catch { return false; }
  }
  const ora = o.prova?.ora ?? Date.now() / 1000;
  const visto = leggi(o.chiave), da = visto ?? ora - PRIMA_VOLTA_S;
  const gente = perPersona(lavori, da);
  if (!gente.length) return false;
  const ultimo = Math.max(...lavori.map((l) => l.t));
  while (o.busy()) await new Promise((r) => setTimeout(r, 400));

  if (!document.getElementById('mz-nv-style')) { const s = document.createElement('style'); s.id = 'mz-nv-style'; s.textContent = CSS; document.head.appendChild(s); }
  const bg = el('div', 'mz-nv-bg'), card = el('div', 'mz-nv');
  card.id = 'mzNovita';
  card.setAttribute('role', 'dialog');
  card.append(el('h2', '', 'Dall\'ultima volta'), el('div', 'sub', visto === null ? 'Cosa è cambiato nel gioco negli ultimi 3 giorni' : `Cosa è cambiato nel gioco ${quando(da, ora)}`));
  gente.forEach((g, i) => {
    const box = el('div', 'chi'), nome = el('div', 'nome', `${g.chi} ha fatto`);
    nome.style.color = COLORI[i % COLORI.length] ?? P.acquaBassa;
    nome.append(el('small', '', g.titoli.length === 1 ? '1 lavoro' : `${g.titoli.length} lavori`));
    const cosa = el('p', 'cosa', riassunto(g.titoli)), tutto = el('button', 'tutto', 'tutto ▾'), ul = el('ul');
    for (const t of g.titoli) ul.append(el('li', '', t));
    tutto.onclick = () => box.classList.add('aperta');
    box.append(nome, cosa, tutto, ul);
    card.append(box);
  });
  const ok = el('button', 'ok', 'Si gioca');
  card.append(ok);
  o.root.append(bg, card);
  // le righe tagliate (oltre due) hanno «tutto ▾»
  for (const b of card.querySelectorAll<HTMLElement>('.chi')) { const c = b.querySelector<HTMLElement>('.cosa'); if (c && c.scrollHeight > c.clientHeight + 2) b.classList.add('lunga'); }

  return new Promise((res) => {
    const chiudi = () => {
      removeEventListener('keydown', tasti, true);
      bg.remove(); card.remove();
      scrivi(o.chiave, ultimo);
      res(true);
    };
    const tasti = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chiudi(); }
    };
    addEventListener('keydown', tasti, true);
    ok.onclick = chiudi; bg.onclick = chiudi;
  });
}
