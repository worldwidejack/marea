// Fulvio, il negoziante dei mobili del Borgo: la scheda in basso del negozio (game/negozio.ts la apre davanti al banco o a un pezzo esposto).
// Al banco parla e dà le scelte: cosa vende, registrare nel Diario un pesce o un insetto dello zaino (uno alla volta: sparisce dallo zaino e
// si sblocca la sua scheda), ingrandire la casa (uno al giorno, fino al massimo). Davanti a un mobile, una carta, un pavimento o uno strumento
// dice il prezzo e chiede se lo compri. Le battute stanno in packages/content/src/fulvio.json; prezzi e regole li controlla anche il server.
import { MOBILI } from '@marea/content';
import FV from '@marea/content/fulvio.json' with { type: 'json' };
import type { MobileDef } from '@marea/content';
import { ampliatoOggi, casaDi, livelloCasa, possiedeFinitura, prossimoAmpliamento } from '@marea/sim';
import type { LotState } from '@marea/sim';
import { possiedePala } from '@marea/sim/economy/pala.ts';
import { INSETTI } from '@marea/content/insetti.ts';
import { insettiOf, possiedeRetino } from '@marea/sim/economy/insetti.ts';
import { PESCI } from '@marea/content/pesci.ts';
import { pesciOf, possiedeCanna } from '@marea/sim/economy/pesci.ts';
import type { Hud } from '../ui/hud.ts';
import { ApiError } from '../net/api.ts';
import type { Api } from '../net/api.ts';
import { PAL, el } from '../ui/style.ts';
import { insettoCanvas } from '../ui/insetti_sprite.ts';
import { pesceCanvas } from '../ui/pesci_sprite.ts';

export type Pezzo = { kind: 'mobile' | 'pavimento' | 'carta' | 'banco' | 'pala' | 'retino' | 'canna'; id: string; nome: string; monete: number; x: number; z: number; fx: number; fz: number };
export type Fulvio = {
  apri(p: Pezzo): void; chiudi(): void; readonly aperto: Pezzo | null;
  stato(): { aperto: string | null; ampliati: number; conferma: boolean; comprati: number; consegnati: number; dice: string | null; scelte: string[] };
};

const CSS = `
#mzNegozio .fv-dice { margin: 8px 0 4px; color: ${PAL.sabbiaChiara}; font-size: 16px; line-height: 1.4; }
#mzNegozio .prezzo { margin: 8px 0; color: ${PAL.sabbia}; font-size: 14px; line-height: 1.35; }
#mzNegozio .prezzo.manca { color: ${PAL.rosso}; font-weight: bold; }
#mzNegozio h3 { margin: 12px 0 2px; color: ${PAL.giallo}; font: bold 14px ui-monospace, Menlo, monospace; }
`;
/** «la prima volta che ci parli» resta su questo telefono/computer. */
const CHIAVE = 'marea.fulvio.conosciuto';
const conosciuto = (): boolean => { try { return localStorage.getItem(CHIAVE) === '1'; } catch { return false; } };
const conosci = (): void => { try { localStorage.setItem(CHIAVE, '1'); } catch { /* niente memoria: pazienza */ } };
const riempi = (t: string, v: Record<string, string>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');
const monete = (n: number): string => `${n} monete`;

/** Il genere del mobile dalla prima parola del nome, per «un divano… lo vuoi?» / «una poltrona… la vuoi?». */
const MASCHILI_IN_A = ['diploma'], FEMMINILI_IN_E = ['cornice'];
function articolo(nome: string): { un: string; lo: string; nome: string } {
  const n = nome.charAt(0).toLowerCase() + nome.slice(1), w = n.split(/\s/)[0] ?? '';
  const f = (w.endsWith('a') && !MASCHILI_IN_A.includes(w)) || FEMMINILI_IN_E.includes(w), voc = /^[aeiouàèéìòù]/.test(w);
  if (f) return voc ? { un: 'un’', lo: 'la', nome: n } : { un: 'una', lo: 'la', nome: n };
  return { un: /^(s[^aeiou]|z|gn|ps|x|y)/.test(w) ? 'uno' : 'un', lo: 'lo', nome: n };
}

type Scelta = { label: string; act: string; fai: () => void; verde?: boolean; off?: boolean; dato?: [string, string]; icona?: HTMLElement };
type Pagina = { dice: string; note?: Node[]; scelte: Scelta[] };

export function createFulvio(o: { root: HTMLElement; hud: Hud; api: Api | null; getLot(): LotState | null; setLot(l: LotState): void; adesso(): number; prendi(kind: 'retino' | 'canna'): void }): Fulvio {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const sheet = el('div', 'mz mz-sheet'); sheet.id = 'mzNegozio';
  o.root.appendChild(sheet);
  for (const ev of ['pointerdown', 'touchstart']) sheet.addEventListener(ev, (x) => x.stopPropagation());
  let aperto: Pezzo | null = null, pag: Pagina | null = null, busy = false, err = '', comprati = 0, consegnati = 0, ampliati = 0, conferma = false;
  /** Le descrizioni dei mobili e delle finiture: si scaricano alla prima scheda, non pesano sull'avvio. */
  let testi: Record<string, string> | null = null;
  const caricaTesti = () => {
    if (testi) return;
    testi = {};
    void Promise.all([
      import('@marea/content/mobili_testi.json', { with: { type: 'json' } }).then((m) => (m.default as { testi: Record<string, string> }).testi).catch(() => ({})),
      import('@marea/content/finiture_testi.json', { with: { type: 'json' } }).then((m) => (m.default as { testi: Record<string, string> }).testi).catch(() => ({})),
    ]).then(([m1, m2]) => { testi = { ...m1, ...m2 }; if (aperto && aperto.kind !== 'banco') pezzo(aperto); }).catch(() => {});
  };

  const chiudi = () => { aperto = null; pag = null; err = ''; conferma = false; sheet.classList.remove('on'); sheet.replaceChildren(); };
  const fine = (): Scelta => ({ label: FV.scelte.fine, act: 'fine', fai: chiudi });
  const dice = (testo: string, ...scelte: Scelta[]) => mostra({ dice: testo, scelte: scelte.length ? scelte : [fine()] });
  function mostra(p: Pagina): void { pag = p; err = ''; disegna(); }
  function disegna(): void {
    if (!aperto || !pag) return;
    const testa = el('div', 'mz-row'); testa.style.alignItems = 'center';
    const x = el('button', 'mz-x', '×'); x.type = 'button'; x.addEventListener('click', chiudi);
    const t = el('b', '', FV.nome); t.style.flex = '1'; t.style.color = PAL.giallo; testa.append(t, x);
    const corpo: Node[] = [testa, el('p', 'fv-dice', pag.dice), ...(pag.note ?? [])];
    if (!o.api) corpo.push(el('div', 'prezzo manca', 'Serve il collegamento'));
    for (const s of pag.scelte) {
      const b = el('button', 'mz-btn' + (s.verde ? ' green' : ''), ''); b.type = 'button'; b.dataset['act'] = s.act;
      if (s.dato) b.dataset[s.dato[0]] = s.dato[1];
      if (s.icona) { s.icona.style.flex = 'none'; b.append(s.icona); }
      b.append(el('span', '', s.label));
      b.disabled = busy || !!s.off;
      b.addEventListener('click', () => { if (!busy) s.fai(); });
      corpo.push(b);
    }
    if (err) corpo.push(el('div', 'prezzo manca', err));
    sheet.replaceChildren(...corpo); sheet.classList.add('on');
  }
  /** Una chiamata al server: bottoni spenti finché risponde; l'errore resta sotto la battuta. */
  async function chiama(fn: (api: Api) => Promise<void>): Promise<void> {
    if (busy || !o.api) return;
    busy = true; disegna();
    try { await fn(o.api); } catch (e) { err = e instanceof ApiError ? e.message : 'Qualcosa non va, riprova'; } finally { busy = false; disegna(); }
  }

  // ——— al banco ———
  function menu(): void {
    const prima = !conosciuto(); conosci();
    mostra({ dice: prima ? FV.benvenuto.primaVolta : FV.benvenuto.ancora, scelte: [
      { label: FV.scelte.vendi, act: 'vendi', fai: () => dice(FV.vendi) },
      { label: FV.scelte.registra, act: 'registra', fai: registra },
      { label: FV.scelte.ingrandisci, act: 'ingrandisci', fai: ingrandisci },
      { label: FV.scelte.ciao, act: 'ciao', fai: chiudi },
    ] });
  }
  /** Registrare nel Diario: uno alla volta, tra i pesci e gli insetti dello zaino non ancora registrati. */
  function registra(): void {
    const l = o.getLot(), inv = l?.hero?.inv ?? {}, ora = o.adesso();
    const ins = insettiOf(l, ora).posseduti, pes = pesciOf(l, ora).posseduti;
    const hai = [...PESCI, ...INSETTI].some((d) => (inv[d.id] ?? 0) > 0);
    const scelte: Scelta[] = [
      ...PESCI.filter((d) => (inv[d.id] ?? 0) > 0 && !pes.includes(d.id)).map((d): Scelta => ({ label: d.nome, act: 'consegna-pesce', dato: ['pesce', d.id], icona: pesceCanvas(d, 2), fai: () => void consegna(d.id, 'pesci') })),
      ...INSETTI.filter((d) => (inv[d.id] ?? 0) > 0 && !ins.includes(d.id)).map((d): Scelta => ({ label: d.nome, act: 'consegna', dato: ['insetto', d.id], icona: insettoCanvas(d, 2), fai: () => void consegna(d.id, 'insetti') })),
    ];
    if (!scelte.length) { dice(!hai && !possiedeCanna(l) && !possiedeRetino(l) ? FV.registra.niente : FV.registra.tascheVuote); return; }
    for (const s of scelte) s.off = !o.api;
    mostra({ dice: FV.scelte.scegli, scelte: [...scelte, { label: FV.scelte.indietro, act: 'indietro', fai: menu }] });
  }
  async function consegna(id: string, cosa: 'insetti' | 'pesci'): Promise<void> {
    await chiama(async (api) => {
      const r = cosa === 'pesci' ? await api.pesci('consegna', { id }) : await api.insetti('consegna', { id });
      o.setLot(r.lot); consegnati++;
      const d = cosa === 'pesci' ? PESCI.find((x) => x.id === id) : INSETTI.find((x) => x.id === id);
      const righe = [riempi(FV.registra.consegna, { nome: d?.nome ?? id }), d?.descr ?? '', FV.registra.fatto].filter(Boolean);
      const passo = (i: number): void => dice(righe[i]!, i < righe.length - 1 ? { label: FV.scelte.avanti, act: 'avanti', fai: () => passo(i + 1) } : fine());
      passo(0);
    });
  }
  /** Ingrandire la casa: al massimo uno al giorno, fino all'ultimo ampliamento. */
  function ingrandisci(): void {
    const l = o.getLot(), liv = livelloCasa(casaDi(l)), prossimo = prossimoAmpliamento(liv);
    if (!prossimo || !l) { dice(FV.casa.massimo); return; }
    if (ampliatoOggi(l, o.adesso())) { dice(FV.casa.giaOggi); return; }
    const prezzo = monete(prossimo.monete);
    conferma = true;
    mostra({ dice: riempi(FV.casa.proposta, { prezzo }), note: [el('div', 'prezzo', `${prossimo.nome}: ${prossimo.desc} · ne hai ${l.monete}`)], scelte: [
      { label: FV.scelte.amplia, act: 'amplia', verde: true, off: !o.api, fai: () => void amplia(liv) },
      { label: FV.scelte.noAmplia, act: 'no', fai: () => { conferma = false; dice(FV.casa.annulla); } },
    ] });
  }
  async function amplia(da: number): Promise<void> {
    const l = o.getLot(), prossimo = prossimoAmpliamento(da);
    if (!l || !prossimo) return;
    conferma = false;
    if (l.monete < prossimo.monete) { dice(riempi(FV.casa.soldi, { prezzo: monete(prossimo.monete) })); return; }
    await chiama(async (api) => {
      o.setLot(await api.casa('amplia', { da })); ampliati++;
      dice(FV.casa.fatto);
      o.hud.toast(`${prossimo.nome}: fatto! Torna a casa a vederla`, 3200);
    });
  }

  // ——— davanti a un pezzo esposto ———
  const gia = (p: Pezzo): boolean => p.kind === 'pala' ? possiedePala(o.getLot()) : p.kind === 'retino' ? possiedeRetino(o.getLot()) : p.kind === 'canna' ? possiedeCanna(o.getLot()) : (p.kind === 'pavimento' || p.kind === 'carta') && possiedeFinitura(o.getLot(), p.kind, p.id);
  const celleDi = (m: MobileDef): number => m.posto === 'parete' ? 1 : (m.celle?.[0] ?? 1) * (m.celle?.[1] ?? 1);
  const dove = (m: MobileDef): string => m.posto === 'parete' ? 'Si appende al muro' : celleDi(m) > 1 ? `Per terra: occupa ${celleDi(m)} celle` : 'Per terra: occupa una cella';
  function pezzo(p: Pezzo): void {
    const l = o.getLot(), prezzo = monete(p.monete), m = p.kind === 'mobile' ? MOBILI.find((x) => x.id === p.id) ?? null : null;
    let testo: string, compra = FV.scelte.compraLo;
    if (p.kind === 'canna') { testo = riempi(FV.canna, { prezzo }); compra = FV.scelte.compraLa; }
    else if (p.kind === 'retino') testo = riempi(FV.retino, { prezzo });
    else if (p.kind === 'pala') { testo = riempi(FV.pala, { prezzo }); compra = FV.scelte.compraLa; }
    else {
      const a = p.kind === 'carta' ? { un: 'una', lo: 'la', nome: `carta da parati «${p.nome}»` } : p.kind === 'pavimento' ? { un: 'un', lo: 'lo', nome: `pavimento «${p.nome}»` } : articolo(p.nome);
      testo = riempi(FV.mobile.chiede, { ...a, prezzo });
    }
    const note: Node[] = [];
    if (testi?.[p.id]) note.push(el('div', 'prezzo', testi[p.id]!));
    if (m) note.push(el('div', 'prezzo', dove(m)));
    const mag = m ? casaDi(l).magazzino?.[m.id] : 0;
    if (mag) note.push(el('div', 'prezzo', `Ne hai già ${mag} nel magazzino.`));
    note.push(el('div', 'prezzo', `Ne hai ${l?.monete ?? 0} monete.`));
    const g = gia(p);
    mostra({ dice: testo, note, scelte: [
      { label: g ? 'Ce l’hai già ✓' : compra, act: 'compra', verde: !g, off: g || !o.api, fai: () => void compraPezzo(p) },
      { label: FV.scelte.lascia, act: 'lascia', fai: chiudi },
    ] });
  }
  async function compraPezzo(p: Pezzo): Promise<void> {
    const l = o.getLot();
    if (!l || p.kind === 'banco' || gia(p)) return;
    if (l.monete < p.monete) { dice(riempi(FV.mobile.soldi, { prezzo: monete(p.monete) }), { label: FV.scelte.lascia, act: 'lascia', fai: chiudi }); return; }
    await chiama(async (api) => {
      const next = await (p.kind === 'canna' ? api.casa('canna', {}) : p.kind === 'retino' ? api.casa('retino', {}) : p.kind === 'pala' ? api.casa('pala', {}) : p.kind === 'mobile' ? api.casa('compra', { id: p.id }) : (p.kind === 'pavimento' || p.kind === 'carta') ? api.casa('finitura', { tipo: p.kind, id: p.id }) : null);
      if (!next) return;
      o.setLot(next); comprati++;
      if (p.kind === 'retino' || p.kind === 'canna') o.prendi(p.kind);
      if (p.kind === 'mobile' || p.kind === 'carta' || p.kind === 'pavimento') dice(FV.mobile.comprato); else chiudi();
      o.hud.toast(p.kind === 'canna' ? 'Canna comprata! Ce l’hai in mano: vai sulla riva o fermati con la barca al largo' : p.kind === 'retino' ? 'Retino comprato! Ce l’hai in mano: cambi attrezzo col bottone accanto o col tasto Q' : p.kind === 'pala' ? 'Pala comprata! La trovi nello zaino (Strumenti) e puoi usarla a Borgo Marea' : p.kind === 'mobile' ? `${p.nome}: è nel magazzino, arreda da casa tua` : `${p.nome}: messo in casa tua`, 2800);
    });
  }

  return {
    get aperto() { return aperto; },
    apri(p) { aperto = p; err = ''; conferma = false; caricaTesti(); if (p.kind === 'banco') menu(); else pezzo(p); sheet.scrollTop = 0; },
    chiudi,
    stato: () => ({ aperto: aperto?.id ?? null, ampliati, conferma, comprati, consegnati, dice: pag?.dice ?? null, scelte: pag?.scelte.map((s) => s.act) ?? [] }),
  };
}
