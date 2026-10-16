// L'interfaccia della Difesa (#358), in HTML sopra il canvas: in alto la barra (contatore della valuta, carte dei difensori col costo e la
// ricarica che scende, pala), in alto a destra pausa / veloce / ⚙ prove, in basso a destra la barra delle ondate con le bandiere, al
// centro gli avvisi grandi («ARRIVANO!», «ONDATA ENORME!») e i consigli corti del tutorial (massimo 8 parole, non fermano il gioco),
// il menù dei livelli, le schermate di vittoria e sconfitta, «GIRA IL TELEFONO». I colori vengono dal tema della pelle.
import type { DTipoUnita } from '@marea/content/difesa.ts';
import type { Pelle } from './skin.ts';

export type StatoCarta = { tipo: DTipoUnita; costo: number; carica: number; puoi: boolean };
export type VoceProva = { id: string; etichetta: () => string; premi: () => void };
export type LivelloMenu = { nome: string; numero: string; aperto: boolean; medaglia: '' | 'oro' | 'argento' | 'bronzo'; nuova: DTipoUnita | null };
export type Fine = { vinta: boolean; titolo: string; righe: string[]; medaglia?: '' | 'oro' | 'argento' | 'bronzo'; premio?: DTipoUnita | null; avanti: boolean };

const CSS = `
.df { --pan: rgba(40,30,22,.9); --bordo: #c99a5b; --testo: #fff6e0; --ombra: #1b120c; --acc: #ffd23f; --carta: #f3e3c0; --cartab: #8a5a2b; --barra: #3b2a1c; --barrap: #7fd35a; }
.df-barra { position: absolute; left: max(8px, env(safe-area-inset-left)); top: max(6px, env(safe-area-inset-top)); display: flex; gap: 6px; align-items: stretch; padding: 6px; background: var(--pan); border: 3px solid var(--bordo); border-radius: 14px; box-shadow: 0 4px 0 var(--ombra); }
.df-valuta { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 64px; padding: 0 6px; background: rgba(0,0,0,.25); border-radius: 10px; color: var(--testo); }
.df-valuta canvas { width: 30px; height: 30px; }
.df-valuta b { font-size: 22px; line-height: 1; text-shadow: 0 2px 0 var(--ombra); }
.df-carta { position: relative; width: 58px; padding: 4px 2px 2px; background: var(--carta); border: 3px solid var(--cartab); border-radius: 10px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform .08s; overflow: hidden; }
.df-carta canvas { width: 46px; height: 46px; }
.df-carta b { font-size: 16px; color: #2a1a0c; line-height: 1.1; }
.df-carta .df-tasto { position: absolute; left: 4px; top: 2px; font-size: 11px; color: rgba(42,26,12,.55); }
.df-carta .df-ric { position: absolute; left: 0; right: 0; top: 0; background: rgba(20,14,10,.62); pointer-events: none; }
.df-carta.no { filter: grayscale(.85) brightness(.75); }
.df-carta.sel { transform: translateY(-5px); box-shadow: 0 0 0 4px var(--acc), 0 6px 0 var(--ombra); }
.df-carta.nuova { animation: df-pulsa 1s infinite; }
@keyframes df-pulsa { 50% { box-shadow: 0 0 0 5px #fff, 0 0 18px 6px var(--acc); } }
.df-pala { width: 52px; display: flex; align-items: center; justify-content: center; font-size: 30px; background: rgba(0,0,0,.25); border-radius: 10px; cursor: pointer; }
.df-pala.sel { box-shadow: 0 0 0 4px var(--acc); }
.df-tasti { position: absolute; right: max(8px, env(safe-area-inset-right)); top: max(6px, env(safe-area-inset-top)); display: flex; gap: 6px; }
.df-b { min-width: 44px; height: 44px; padding: 0 10px; border: 3px solid var(--bordo); border-radius: 12px; background: var(--pan); color: var(--testo); font: inherit; font-size: 20px; box-shadow: 0 3px 0 var(--ombra); cursor: pointer; }
.df-b.on { background: var(--acc); color: #2a1a0c; }
.df-onda { position: absolute; right: max(10px, env(safe-area-inset-right)); bottom: max(6px, env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: var(--pan); border: 3px solid var(--bordo); border-radius: 12px; color: var(--testo); font-size: 14px; box-shadow: 0 3px 0 var(--ombra); pointer-events: none; }
.df-onda .df-pista { position: relative; width: 170px; height: 14px; background: var(--barra); border-radius: 8px; overflow: visible; }
.df-onda .df-piena { position: absolute; right: 0; top: 0; bottom: 0; background: var(--barrap); border-radius: 8px; }
.df-onda .df-band { position: absolute; top: -12px; width: 14px; height: 22px; margin-left: -2px; }
.df-onda .df-band::before { content: ''; position: absolute; left: 1px; top: 0; width: 3px; height: 22px; background: #5a3a1e; }
.df-onda .df-band::after { content: ''; position: absolute; left: 4px; top: 1px; width: 12px; height: 9px; background: #e23b3b; }
.df-onda .df-band.su::after { background: #8a8a8a; }
.df-avviso { position: absolute; left: 0; right: 0; top: 38%; text-align: center; font-size: clamp(30px, 7vw, 64px); color: #ff4b3a; text-shadow: 0 4px 0 #2a0c08, 0 0 18px rgba(0,0,0,.5); pointer-events: none; opacity: 0; transform: scale(.6); transition: opacity .2s, transform .25s; }
.df-avviso.su { opacity: 1; transform: scale(1); }
.df-consiglio { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); padding: 8px 16px; background: rgba(255,250,235,.95); color: #2a1a0c; border: 3px solid #2a1a0c; border-radius: 14px; font-size: clamp(15px, 2.6vw, 22px); pointer-events: none; opacity: 0; transition: opacity .25s; white-space: nowrap; }
.df-consiglio.su { opacity: 1; }
.df-mano { position: absolute; font-size: 40px; pointer-events: none; transition: left .6s, top .6s; filter: drop-shadow(0 3px 0 #000); }
.df-velo { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(15,10,8,.6); }
.df-velo.su { display: flex; }
.df-pan { max-width: min(92vw, 720px); max-height: 90vh; overflow: auto; padding: 18px 22px; background: var(--pan); border: 4px solid var(--bordo); border-radius: 20px; color: var(--testo); text-align: center; box-shadow: 0 6px 0 var(--ombra); }
.df-pan h1 { margin: 0 0 6px; font-size: clamp(30px, 6vw, 52px); color: var(--acc); text-shadow: 0 4px 0 var(--ombra); font-weight: normal; }
.df-pan p { margin: 4px 0; font-size: 17px; }
.df-livelli { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; margin: 14px 0; }
.df-liv { position: relative; padding: 10px 6px 8px; border: 3px solid var(--cartab); border-radius: 14px; background: var(--carta); color: #2a1a0c; font: inherit; cursor: pointer; box-shadow: 0 4px 0 var(--ombra); }
.df-liv b { display: block; font-size: 28px; font-weight: normal; }
.df-liv span { font-size: 12px; }
.df-liv canvas { width: 40px; height: 40px; display: block; margin: 2px auto 0; }
.df-liv.chiuso { filter: grayscale(1) brightness(.6); cursor: default; }
.df-liv .df-med { position: absolute; right: 6px; top: 6px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #2a1a0c; }
.df-med.oro { background: #ffd23f; } .df-med.argento { background: #d8dde3; } .df-med.bronzo { background: #d08a4a; }
.df-grosso { margin: 6px 6px 0; padding: 12px 26px; border: 4px solid #2a1a0c; border-radius: 16px; background: var(--acc); color: #2a1a0c; font: inherit; font-size: 24px; box-shadow: 0 5px 0 var(--ombra); cursor: pointer; }
.df-grosso.b2 { background: var(--carta); }
.df-premio { display: inline-flex; flex-direction: column; align-items: center; margin: 8px; padding: 10px 18px; background: var(--carta); color: #2a1a0c; border: 4px solid var(--cartab); border-radius: 16px; animation: df-pulsa 1.2s infinite; }
.df-premio canvas { width: 84px; height: 84px; }
.df-prove { position: absolute; right: max(8px, env(safe-area-inset-right)); top: 58px; display: none; flex-direction: column; gap: 6px; padding: 8px; background: var(--pan); border: 3px solid var(--bordo); border-radius: 12px; max-height: 70vh; overflow: auto; }
.df-prove.su { display: flex; }
.df-prove button { padding: 8px 12px; border: 2px solid var(--bordo); border-radius: 10px; background: rgba(0,0,0,.25); color: var(--testo); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.df-gira { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #1d1a22; color: #fff6e0; font-size: 26px; text-align: center; padding: 20px; }
.df-gira.su { display: flex; }
.df-gira i { font-style: normal; font-size: 64px; animation: df-gira 1.6s infinite; }
@keyframes df-gira { 50% { transform: rotate(-90deg); } }
@media (max-height: 460px) {
  .df-carta { width: 50px; } .df-carta canvas { width: 36px; height: 36px; } .df-carta b { font-size: 14px; }
  .df-valuta { min-width: 52px; } .df-valuta b { font-size: 18px; } .df-valuta canvas { width: 24px; height: 24px; }
  .df-pala { width: 44px; font-size: 24px; } .df-b { min-width: 40px; height: 40px; font-size: 18px; }
  .df-onda .df-pista { width: 120px; } .df-onda { font-size: 12px; }
}`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export function creaUi(root: HTMLElement) {
  const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
  root.classList.add('df');
  const barra = el('div', 'df-barra'), valuta = el('div', 'df-valuta'), vIco = el('canvas'), vNum = el('b', '', '0');
  vIco.width = vIco.height = 64; valuta.append(vIco, vNum); barra.append(valuta);
  const carteBox = el('div'); carteBox.style.display = 'flex'; carteBox.style.gap = '6px'; barra.append(carteBox);
  const pala = el('div', 'df-pala', '⛏️'); barra.append(pala);
  const tasti = el('div', 'df-tasti'), bPausa = el('button', 'df-b', '❚❚'), bVeloce = el('button', 'df-b', '▶▶'), bProve = el('button', 'df-b', '⚙');
  bPausa.title = 'pausa (Spazio)'; bVeloce.title = 'veloce (F)'; bProve.title = 'prove';
  tasti.append(bPausa, bVeloce, bProve);
  const onda = el('div', 'df-onda'), ondaNome = el('span'), pista = el('div', 'df-pista'), piena = el('div', 'df-piena');
  pista.append(piena); onda.append(ondaNome, pista);
  const avviso = el('div', 'df-avviso'), consiglio = el('div', 'df-consiglio'), mano = el('div', 'df-mano', '👆');
  mano.style.display = 'none';
  const velo = el('div', 'df-velo'), pan = el('div', 'df-pan'); velo.append(pan);
  const prove = el('div', 'df-prove');
  const veloP = el('div', 'df-velo'), panP = el('div', 'df-pan'); veloP.append(panP);
  panP.append(el('h1', '', 'PAUSA'));
  const filaP = el('div'), bCont = el('button', 'df-grosso', 'CONTINUA'), bRif = el('button', 'df-grosso b2', 'RICOMINCIA'), bLiv = el('button', 'df-grosso b2', 'LIVELLI');
  filaP.append(bCont, bRif, bLiv); panP.append(filaP);
  const gira = el('div', 'df-gira', '<i>📱</i><div>GIRA IL TELEFONO</div><div style="font-size:16px;opacity:.8">la Difesa si gioca in orizzontale</div>');
  root.append(barra, tasti, onda, avviso, consiglio, mano, prove, veloP, velo, gira);

  let pelle: Pelle | null = null, carte: { tipo: DTipoUnita; box: HTMLDivElement; ric: HTMLDivElement; costo: HTMLElement }[] = [];
  let suCarta: (t: DTipoUnita) => void = () => {}, suPala: () => void = () => {};
  let tAvviso = 0, tConsiglio = 0;
  pala.addEventListener('pointerdown', (e) => { e.stopPropagation(); suPala(); });

  /** Disegna lo sprite `chiave` della pelle in un canvas (icone delle carte, menù, premio). */
  function icona(c: HTMLCanvasElement, chiave: string, lato = 96): void {
    c.width = c.height = lato;
    const g = c.getContext('2d')!, sp = pelle?.sprite[chiave as keyof Pelle['sprite']];
    g.clearRect(0, 0, lato, lato);
    if (!sp) return;
    const k = Math.min(lato / sp.w, lato / sp.h) * 0.96;
    g.imageSmoothingEnabled = !pelle!.pixel;
    g.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h, (lato - sp.w * k) / 2, (lato - sp.h * k) / 2, sp.w * k, sp.h * k);
  }

  return {
    barra, pala, bPausa, bVeloce, bProve, valutaEl: valuta,
    tema(p: Pelle) {
      pelle = p;
      const T = p.tema, s = root.style;
      s.setProperty('--pan', T.pannello); s.setProperty('--bordo', T.bordo); s.setProperty('--testo', T.testo); s.setProperty('--ombra', T.ombra);
      s.setProperty('--acc', T.accento); s.setProperty('--carta', T.carta); s.setProperty('--cartab', T.cartaBordo); s.setProperty('--barra', T.barra); s.setProperty('--barrap', T.barraPiena);
      icona(vIco, 'moneta', 64);
      for (const c of carte) icona(c.box.querySelector('canvas')!, c.tipo);
    },
    carte(tipi: DTipoUnita[], costi: Record<string, number>, nuova: DTipoUnita | null, scegli: (t: DTipoUnita) => void, pala: () => void) {
      suCarta = scegli; suPala = pala;
      carteBox.innerHTML = '';
      carte = tipi.map((tipo, i) => {
        const box = el('div', 'df-carta' + (tipo === nuova ? ' nuova' : '')) as HTMLDivElement, cv = el('canvas'), costo = el('b', '', String(costi[tipo])), ric = el('div', 'df-ric') as HTMLDivElement;
        box.append(el('span', 'df-tasto', String(i + 1)), cv, costo, ric);
        icona(cv, tipo);
        box.addEventListener('pointerdown', (e) => { e.stopPropagation(); box.classList.remove('nuova'); suCarta(tipo); });
        carteBox.append(box);
        return { tipo, box, ric, costo };
      });
    },
    aggiorna(o: { valuta: number; carte: StatoCarta[]; scelta: DTipoUnita | 'pala' | null; onda: number; bandiere: { dove: number; passata: boolean }[]; nome: string }) {
      vNum.textContent = String(o.valuta);
      for (const c of carte) {
        const sc = o.carte.find((x) => x.tipo === c.tipo)!;
        c.ric.style.height = `${Math.round((1 - sc.carica) * 100)}%`;
        c.box.classList.toggle('no', !sc.puoi);
        c.box.classList.toggle('sel', o.scelta === c.tipo);
      }
      pala.classList.toggle('sel', o.scelta === 'pala');
      ondaNome.textContent = o.nome;
      piena.style.width = `${Math.round(o.onda * 100)}%`;
      const bs = pista.querySelectorAll('.df-band');
      if (bs.length !== o.bandiere.length) { bs.forEach((b) => b.remove()); for (const _ of o.bandiere) pista.append(el('div', 'df-band')); }
      pista.querySelectorAll<HTMLElement>('.df-band').forEach((b, i) => { const f = o.bandiere[i]!; b.style.left = `${(1 - f.dove) * 100}%`; b.classList.toggle('su', f.passata); });
    },
    avviso(testo: string, secondi = 2.2, colore = '#ff4b3a') {
      avviso.textContent = testo; avviso.style.color = colore; avviso.classList.add('su');
      const mio = ++tAvviso;
      setTimeout(() => { if (mio === tAvviso) avviso.classList.remove('su'); }, secondi * 1000);
    },
    consiglio(testo: string | null, secondi = 6) {
      const mio = ++tConsiglio;
      if (!testo) { consiglio.classList.remove('su'); return; }
      consiglio.textContent = testo; consiglio.classList.add('su');
      if (secondi > 0) setTimeout(() => { if (mio === tConsiglio) consiglio.classList.remove('su'); }, secondi * 1000);
    },
    mano(x: number | null, y = 0) { if (x === null) { mano.style.display = 'none'; return; } mano.style.display = 'block'; mano.style.left = `${x - 12}px`; mano.style.top = `${y - 4}px`; },
    menu(titolo: string, sotto: string, livelli: LivelloMenu[], sopravvivenza: string, scegli: (i: number) => void) {
      pan.innerHTML = '';
      pan.append(el('h1', '', titolo), el('p', '', sotto));
      const g = el('div', 'df-livelli');
      livelli.forEach((l, i) => {
        const b = el('button', 'df-liv' + (l.aperto ? '' : ' chiuso')), cv = el('canvas');
        b.append(el('b', '', l.numero), el('span', '', l.nome));
        if (l.nuova) { icona(cv, l.nuova, 80); b.append(cv); }
        if (l.medaglia) b.append(el('div', 'df-med ' + l.medaglia));
        if (l.aperto) b.addEventListener('click', () => scegli(i));
        g.append(b);
      });
      pan.append(g);
      const sop = el('button', 'df-grosso', sopravvivenza); sop.addEventListener('click', () => scegli(-1)); pan.append(sop);
      velo.classList.add('su');
    },
    fine(f: Fine, rigioca: () => void, avanti: () => void, menu: () => void) {
      pan.innerHTML = '';
      const h = el('h1', '', f.titolo); if (!f.vinta) h.style.color = '#ff6b5a';
      pan.append(h);
      for (const r of f.righe) pan.append(el('p', '', r));
      if (f.premio) { const pr = el('div', 'df-premio'), cv = el('canvas'); icona(cv, f.premio, 120); pr.append(el('span', '', 'NUOVO DIFENSORE'), cv, el('b', '', pelle?.nomi[f.premio] ?? f.premio)); pan.append(pr); }
      const fila = el('div');
      if (f.avanti) { const b = el('button', 'df-grosso', 'AVANTI'); b.addEventListener('click', avanti); fila.append(b); }
      const r = el('button', 'df-grosso' + (f.avanti ? ' b2' : ''), f.vinta ? 'RIGIOCA' : 'RIPROVA'); r.addEventListener('click', rigioca); fila.append(r);
      const m = el('button', 'df-grosso b2', 'LIVELLI'); m.addEventListener('click', menu); fila.append(m);
      pan.append(fila);
      velo.classList.add('su');
    },
    chiudiVelo() { velo.classList.remove('su'); },
    veloAperto: () => velo.classList.contains('su'),
    prove(voci: VoceProva[]) {
      prove.innerHTML = '';
      for (const v of voci) { const b = el('button'); b.textContent = v.etichetta(); b.addEventListener('click', () => { v.premi(); b.textContent = v.etichetta(); }); prove.append(b); }
    },
    apriProve(on?: boolean) { prove.classList.toggle('su', on ?? !prove.classList.contains('su')); },
    gira(on: boolean) { gira.classList.toggle('su', on); },
    /** Il pannello della pausa (si apre anche da solo quando la pagina va in secondo piano). */
    pausa(on: boolean) { veloP.classList.toggle('su', on); },
    suPausa(continua: () => void, ricomincia: () => void, livelli: () => void) { bCont.onclick = continua; bRif.onclick = ricomincia; bLiv.onclick = livelli; },
    icona,
  };
}
export type Ui = ReturnType<typeof creaUi>;
