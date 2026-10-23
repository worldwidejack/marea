// L'interfaccia della Difesa (#358, #379), in HTML sopra il canvas: in alto la barra (contatore della valuta, carte dei difensori col
// costo e la ricarica che scende, pala), in alto a destra pausa / veloce / ⚙ prove, in basso a destra la barra delle ondate con le
// bandiere, al centro gli avvisi grandi («ARRIVANO!», «ONDATA ENORME!») e i consigli corti del tutorial (massimo 8 parole, non fermano il
// gioco), il menù dei livelli, le schermate di vittoria e sconfitta, «GIRA IL TELEFONO», il caricamento. Colori e legno vengono dalla
// pelle: con la pelle dell'orto è la barra del concept scelto da Jack (assets/concept/difesa/esplorazione_01.jpg), copiata: tavola di
// legno, contatore scuro col seme, carte color crema col contorno spesso e il costo col seme, pala nel suo riquadro.
import type { DTipoUnita } from '@marea/content/difesa.ts';
import type { ChiaveSprite, Pelle } from './skin.ts';
import { primo } from './skin.ts';

export type StatoCarta = { tipo: DTipoUnita; costo: number; carica: number; puoi: boolean };
export type VoceProva = { id: string; etichetta: () => string; premi: () => void };
export type LivelloMenu = { nome: string; numero: string; aperto: boolean; medaglia: '' | 'oro' | 'argento' | 'bronzo'; nuova: DTipoUnita | null };
export type Fine = { vinta: boolean; titolo: string; righe: string[]; medaglia?: '' | 'oro' | 'argento' | 'bronzo'; premio?: DTipoUnita | null; avanti: boolean };

const CSS = `
.df { --pan: #6e4024; --bordo: #2e180a; --testo: #fff6e0; --ombra: #2a160a; --acc: #ffd23f; --carta: #f7ecd0; --cartab: #4a2a12; --barra: #26303a; --barrap: #7ad027; --seme: none; }
#ui > .df-avviso, #ui > .df-consiglio, #ui > .df-mano, #ui > .df-onda { pointer-events: none; }
.df-barra { position: absolute; left: max(6px, env(safe-area-inset-left)); top: max(4px, env(safe-area-inset-top)); display: flex; gap: 5px; align-items: stretch; padding: 5px; background: var(--pan); border: 4px solid var(--bordo); border-radius: 14px; box-shadow: 0 4px 0 var(--ombra); }
.df.legno .df-barra { padding: 1px 3px; background: none; border: 13px solid transparent; border-radius: 0; border-image: var(--legno) 50 fill / 13px stretch; box-shadow: none; filter: drop-shadow(0 4px 0 rgba(30,14,4,.45)); }
.df-valuta { display: flex; align-items: center; gap: 4px; min-width: 84px; padding: 0 10px 0 6px; background: #3a2010; border: 3px solid #1c0d04; border-radius: 12px; box-shadow: inset 0 2px 0 rgba(255,255,255,.12); color: #fff; }
.df-valuta canvas { width: 30px; height: 30px; }
.df-valuta b { font-size: 26px; line-height: 1; font-weight: normal; text-shadow: 0 2px 0 #1c0d04, 2px 0 0 #1c0d04, -2px 0 0 #1c0d04, 0 -2px 0 #1c0d04, 0 4px 0 #1c0d04; }
.df-carte { display: flex; gap: 5px; padding: 3px; background: rgba(46,22,8,.45); border-radius: 10px; box-shadow: inset 0 2px 3px rgba(0,0,0,.35); }
.df-carta { position: relative; width: 60px; padding: 3px 2px 2px; background: var(--carta); border: 3px solid var(--cartab); border-radius: 9px; box-shadow: inset 0 0 0 2px #fffaf0, 0 3px 0 rgba(0,0,0,.3); display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform .08s; overflow: hidden; }
.df-carta canvas { width: 54px; height: 40px; }
.df-costo { display: flex; align-items: center; gap: 2px; font-size: 16px; line-height: 1.15; color: #3b2410; }
.df-costo i, .df-premio i { display: inline-block; width: 11px; height: 14px; background: var(--seme) center / contain no-repeat; }
.df-carta .df-tasto { position: absolute; left: 4px; top: 1px; font-size: 10px; color: rgba(59,36,16,.5); }
.df-carta .df-ric { position: absolute; left: 0; right: 0; top: 0; background: rgba(36,42,46,.72); pointer-events: none; }
.df-carta.no { filter: saturate(.25) brightness(.8); }
.df-carta.sel { transform: translateY(-5px); box-shadow: 0 0 0 4px var(--acc), 0 6px 0 rgba(0,0,0,.35); }
.df-carta.nuova { animation: df-pulsa 1s infinite; }
@keyframes df-pulsa { 50% { box-shadow: 0 0 0 5px #fff, 0 0 18px 6px var(--acc); } }
.df-pala { width: 54px; display: flex; align-items: center; justify-content: center; font-size: 30px; background: #3a2010; border: 3px solid #1c0d04; border-radius: 10px; box-shadow: inset 0 2px 0 rgba(255,255,255,.12); cursor: pointer; }
.df-pala canvas { width: 42px; height: 42px; }
.df-pala.sel { box-shadow: 0 0 0 4px var(--acc); }
.df-tasti { position: absolute; right: max(8px, env(safe-area-inset-right)); top: max(6px, env(safe-area-inset-top)); display: flex; gap: 6px; }
.df-b { min-width: 46px; height: 46px; padding: 0 10px; border: 3px solid var(--bordo); border-radius: 12px; background: var(--pan); color: var(--testo); font: inherit; font-size: 20px; box-shadow: 0 3px 0 var(--ombra); cursor: pointer; text-shadow: 0 2px 0 var(--ombra); }
.df.legno .df-b { border: 9px solid transparent; border-image: var(--legno) 50 fill / 9px stretch; background: none; box-shadow: none; padding: 0 4px; filter: drop-shadow(0 3px 0 rgba(30,14,4,.45)); }
.df-b.on { color: var(--acc); }
.df-onda { position: absolute; right: max(10px, env(safe-area-inset-right)); bottom: max(6px, env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 8px; padding: 5px 12px; background: #1d242b; border: 3px solid #0d1114; border-radius: 12px; box-shadow: inset 0 0 0 2px #56636e, 0 3px 0 rgba(0,0,0,.35); color: var(--testo); font-size: 14px; pointer-events: none; }
.df-onda .df-pista { position: relative; width: 180px; height: 14px; background: #2e3842; border-radius: 8px; box-shadow: inset 0 2px 2px rgba(0,0,0,.4); overflow: visible; }
.df-onda .df-piena { position: absolute; left: 0; top: 0; bottom: 0; background: var(--barrap); border-radius: 8px; box-shadow: inset 0 3px 0 rgba(255,255,255,.35); }
.df-onda .df-band { position: absolute; top: -13px; width: 16px; height: 24px; margin-left: -3px; }
.df-onda .df-band::before { content: ''; position: absolute; left: 1px; top: 0; width: 3px; height: 24px; background: #2a1a10; border-radius: 2px; }
.df-onda .df-band::after { content: ''; position: absolute; left: 4px; top: 1px; width: 13px; height: 10px; background: #e8322a; border: 2px solid #2a0c08; border-left: 0; clip-path: polygon(0 0, 100% 50%, 0 100%); }
.df-onda .df-band.su::after { background: #8a8a8a; }
.df-avviso { position: absolute; left: 0; right: 0; top: 36%; text-align: center; font-size: clamp(34px, 7.5vw, 70px); color: #ff5a3c; -webkit-text-stroke: 3px #2a0c08; text-shadow: 0 5px 0 #2a0c08, 0 0 18px rgba(0,0,0,.45); pointer-events: none; opacity: 0; transform: scale(.6); transition: opacity .2s, transform .25s; }
.df-avviso.su { opacity: 1; transform: scale(1); }
.df-consiglio { position: absolute; left: 50%; bottom: max(8px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 6px 16px; background: #fffaeb; color: #3b2410; border: 4px solid #3b2410; border-radius: 16px; box-shadow: 0 4px 0 rgba(0,0,0,.3); font-size: clamp(14px, 1.8vw, 20px); pointer-events: none; opacity: 0; transition: opacity .25s; white-space: nowrap; }
.df-consiglio.su { opacity: 1; }
.df-mano { position: absolute; font-size: 40px; pointer-events: none; transition: left .6s, top .6s; filter: drop-shadow(0 3px 0 #000); }
.df-velo { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(15,10,8,.55); }
.df-velo.su { display: flex; }
.df-pan { min-width: min(88vw, 720px); max-width: min(92vw, 780px); max-height: 90vh; overflow: auto; padding: 18px 22px; background: var(--pan); border: 4px solid var(--bordo); border-radius: 20px; color: var(--testo); text-align: center; box-shadow: 0 6px 0 var(--ombra); }
.df.legno .df-pan { padding: 4px 16px 8px; background: none; border: 36px solid transparent; border-radius: 0; border-image: var(--cartello) 66 fill / 36px stretch; box-shadow: none; color: #3b2410; filter: drop-shadow(0 6px 0 rgba(20,10,4,.45)); }
.df-pan h1 { margin: 0 0 6px; font-size: clamp(30px, 6vw, 54px); color: var(--acc); text-shadow: 0 4px 0 var(--ombra); font-weight: normal; }
.df.legno .df-pan h1 { color: #ff8a2a; -webkit-text-stroke: 2px #3b1a08; text-shadow: 0 4px 0 #3b1a08; }
.df-pan p { margin: 4px 0; font-size: 17px; }
.df-livelli { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 10px; margin: 14px 0; }
.df-liv { position: relative; padding: 8px 6px 7px; border: 3px solid var(--cartab); border-radius: 12px; background: var(--carta); box-shadow: inset 0 0 0 2px #fffaf0, 0 4px 0 rgba(0,0,0,.3); color: #3b2410; font: inherit; cursor: pointer; }
.df-liv b { display: block; font-size: 28px; font-weight: normal; }
.df-liv span { font-size: 12px; }
.df-liv canvas { width: 54px; height: 40px; display: block; margin: 2px auto 0; }
.df-liv.chiuso { filter: grayscale(1) brightness(.6); cursor: default; }
.df-liv .df-med { position: absolute; right: 6px; top: 6px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #2a1a0c; }
.df-med.oro { background: #ffd23f; } .df-med.argento { background: #d8dde3; } .df-med.bronzo { background: #d08a4a; }
.df-grosso { margin: 6px 6px 0; padding: 10px 26px; border: 4px solid #2f5e12; border-radius: 16px; background: #7ad027; color: #fff; font: inherit; font-size: 24px; text-shadow: 0 2px 0 #2f5e12, 2px 0 0 #2f5e12, -2px 0 0 #2f5e12, 0 -2px 0 #2f5e12; box-shadow: inset 0 3px 0 rgba(255,255,255,.4), 0 5px 0 #2f5e12; cursor: pointer; }
.df-grosso.b2 { background: var(--carta); border-color: var(--cartab); color: #3b2410; text-shadow: none; box-shadow: inset 0 0 0 2px #fffaf0, 0 5px 0 var(--cartab); }
.df-premio { display: inline-flex; flex-direction: column; align-items: center; margin: 8px; padding: 8px 18px; background: var(--carta); color: #3b2410; border: 4px solid var(--cartab); border-radius: 16px; animation: df-pulsa 1.2s infinite; }
.df-premio canvas { width: 110px; height: 84px; }
.df-prove { position: absolute; right: max(8px, env(safe-area-inset-right)); top: 62px; display: none; flex-direction: column; gap: 6px; padding: 8px; background: rgba(40,24,12,.94); border: 3px solid var(--bordo); border-radius: 12px; max-height: 70vh; overflow: auto; }
.df-prove.su { display: flex; }
.df-prove button { padding: 8px 12px; border: 2px solid #8a5a2b; border-radius: 10px; background: rgba(0,0,0,.25); color: #fff6e0; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.df-gira { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #1d1a22; color: #fff6e0; font-size: 26px; text-align: center; padding: 20px; }
.df-gira.su { display: flex; }
.df-gira i { font-style: normal; font-size: 64px; animation: df-gira 1.6s infinite; }
@keyframes df-gira { 50% { transform: rotate(-90deg); } }
.df-carica { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #24331d; color: #fff6e0; font-size: 26px; text-shadow: 0 3px 0 #10180c; }
.df-carica.su { display: flex; }
.df-carica .df-pista { position: relative; width: min(60vw, 320px); height: 18px; background: #1d242b; border: 3px solid #0d1114; border-radius: 10px; overflow: hidden; }
.df-carica .df-piena { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #7ad027; box-shadow: inset 0 3px 0 rgba(255,255,255,.35); transition: width .2s; }
@media (max-height: 460px) {
  .df-barra { gap: 4px; }
  .df.legno .df-barra { border-width: 10px; border-image-width: 10px; }
  .df-carte { gap: 4px; padding: 2px; }
  .df-carta { width: 50px; padding: 2px 1px 1px; border-width: 2px; } .df-carta canvas { width: 46px; height: 32px; } .df-costo { font-size: 13px; }
  .df-valuta { min-width: 66px; padding: 0 7px 0 4px; } .df-valuta b { font-size: 20px; } .df-valuta canvas { width: 24px; height: 24px; }
  .df-pala { width: 44px; font-size: 24px; } .df-pala canvas { width: 34px; height: 34px; }
  .df-b { min-width: 40px; height: 40px; font-size: 18px; }
  .df-onda .df-pista { width: 120px; } .df-onda { font-size: 12px; padding: 3px 9px; }
  .df-consiglio { bottom: 4px; padding: 3px 12px; border-width: 3px; font-size: 13px; }
  .df-pan { padding: 10px 14px; max-height: 94vh; } .df.legno .df-pan { border-width: 26px; border-image-width: 26px; padding: 0 10px 4px; }
  .df-pan h1 { font-size: 30px; margin: 0; } .df-pan p { font-size: 14px; margin: 2px 0; }
  .df-livelli { grid-template-columns: repeat(6, minmax(64px, 1fr)); gap: 6px; margin: 8px 0; }
  .df-liv { padding: 5px 3px 4px; } .df-liv b { font-size: 22px; } .df-liv span { font-size: 11px; } .df-liv canvas { width: 40px; height: 30px; }
  .df-grosso { padding: 7px 18px; font-size: 18px; margin-top: 2px; } .df-premio canvas { width: 76px; height: 56px; } .df-premio { padding: 5px 12px; margin: 4px; }
}`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export function creaUi(root: HTMLElement) {
  const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
  root.classList.add('df');
  const barra = el('div', 'df-barra'), valuta = el('div', 'df-valuta'), vIco = el('canvas'), vNum = el('b', '', '0');
  vIco.width = vIco.height = 64; valuta.append(vIco, vNum); barra.append(valuta);
  const carteBox = el('div', 'df-carte'); barra.append(carteBox);
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
  const carica = el('div', 'df-carica'), caricaTesto = el('div', '', 'Carico…'), caricaPista = el('div', 'df-pista'), caricaPiena = el('div', 'df-piena');
  caricaPista.append(caricaPiena); carica.append(caricaTesto, caricaPista);
  root.append(barra, tasti, onda, avviso, consiglio, mano, prove, veloP, velo, gira, carica);

  let pelle: Pelle | null = null, carte: { tipo: DTipoUnita; box: HTMLDivElement; ric: HTMLDivElement }[] = [];
  let suCarta: (t: DTipoUnita) => void = () => {}, suPala: () => void = () => {};
  let tAvviso = 0, tConsiglio = 0;
  pala.addEventListener('pointerdown', (e) => { e.stopPropagation(); suPala(); });

  /** Disegna il primo fotogramma dello sprite `chiave` in un canvas (icone delle carte, menù, premio), dentro `w × h` px. */
  function icona(c: HTMLCanvasElement, chiave: string, w = 108, h = 80): void {
    c.width = w; c.height = h;
    const g = c.getContext('2d')!, f = pelle ? primo(pelle, chiave as ChiaveSprite) : null;
    g.clearRect(0, 0, w, h);
    if (!f) return;
    const k = Math.min(w / f.w, h / f.h) * 0.96;
    g.imageSmoothingEnabled = !pelle!.pixel;
    g.drawImage(f.img, f.x, f.y, f.w, f.h, (w - f.w * k) / 2, (h - f.h * k) / 2, f.w * k, f.h * k);
  }
  const costo = (n: number) => { const b = el('b', 'df-costo'); b.append(el('i'), document.createTextNode(String(n))); return b; };

  return {
    barra, pala, bPausa, bVeloce, bProve, valutaEl: valuta,
    tema(p: Pelle) {
      pelle = p;
      const T = p.tema, s = root.style;
      s.setProperty('--pan', T.pannello); s.setProperty('--bordo', T.bordo); s.setProperty('--testo', T.testo); s.setProperty('--ombra', T.ombra);
      s.setProperty('--acc', T.accento); s.setProperty('--carta', T.carta); s.setProperty('--cartab', T.cartaBordo); s.setProperty('--barra', T.barra); s.setProperty('--barrap', T.barraPiena);
      const legno = p.ui.barra && p.ui.cartello;
      root.classList.toggle('legno', !!legno);
      if (legno) { s.setProperty('--legno', `url("${p.dir}${p.ui.barra}")`); s.setProperty('--cartello', `url("${p.dir}${p.ui.cartello}")`); }
      icona(vIco, 'moneta', 64, 64);
      const seme = el('canvas'); icona(seme, 'moneta', 28, 36);
      s.setProperty('--seme', `url("${seme.toDataURL()}")`);
      if (p.sprite.pala) { pala.textContent = ''; const c = el('canvas'); icona(c, 'pala', 84, 84); pala.append(c); } else pala.textContent = '⛏️';
      for (const c of carte) icona(c.box.querySelector('canvas')!, c.tipo);
    },
    carte(tipi: DTipoUnita[], costi: Record<string, number>, nuova: DTipoUnita | null, scegli: (t: DTipoUnita) => void, pala: () => void) {
      suCarta = scegli; suPala = pala;
      carteBox.innerHTML = '';
      carte = tipi.map((tipo, i) => {
        const box = el('div', 'df-carta' + (tipo === nuova ? ' nuova' : '')) as HTMLDivElement, cv = el('canvas'), ric = el('div', 'df-ric') as HTMLDivElement;
        box.append(el('span', 'df-tasto', String(i + 1)), cv, costo(costi[tipo] ?? 0), ric);
        icona(cv, tipo);
        box.addEventListener('pointerdown', (e) => { e.stopPropagation(); box.classList.remove('nuova'); suCarta(tipo); });
        carteBox.append(box);
        return { tipo, box, ric };
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
      pista.querySelectorAll<HTMLElement>('.df-band').forEach((b, i) => { const f = o.bandiere[i]!; b.style.left = `${f.dove * 100}%`; b.classList.toggle('su', f.passata); });
    },
    avviso(testo: string, secondi = 2.2, colore = '#ff5a3c') {
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
        if (l.nuova) { icona(cv, l.nuova); b.append(cv); }
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
      const h = el('h1', '', f.titolo); if (!f.vinta) h.style.color = '#ff5a3c';
      pan.append(h);
      for (const r of f.righe) pan.append(el('p', '', r));
      if (f.premio) { const pr = el('div', 'df-premio'), cv = el('canvas'); icona(cv, f.premio, 220, 168); pr.append(el('span', '', 'NUOVO DIFENSORE'), cv, el('b', '', pelle?.nomi[f.premio] ?? f.premio)); pan.append(pr); }
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
    /** La schermata di caricamento della pelle: `null` la chiude. */
    carica(testo: string | null, frazione = 0) {
      carica.classList.toggle('su', testo !== null);
      if (testo !== null) { caricaTesto.textContent = testo; caricaPiena.style.width = `${Math.round(frazione * 100)}%`; }
    },
    icona,
  };
}
export type Ui = ReturnType<typeof creaUi>;
