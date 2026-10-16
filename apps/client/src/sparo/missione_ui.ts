// L'interfaccia della Missione 0 (#355): il briefing prima di partire, il segnalino dell'obiettivo (rombo con i metri, sul bordo
// dello schermo se è fuori vista), la barra del sabotaggio, i segni rossi da dove arrivano i colpi, la schermata finale con la medaglia.
// Stesso stile dell'HUD (hud.ts): bianco con l'ombra, maiuscolo.
import { P } from '../render/island_parts.ts';
import type { SMedaglia } from '@marea/sim/sparo/stato.ts';

export type Fine = { esito: 'vinta' | 'persa'; medaglia: SMedaglia; secondi: number; precisione: number; teste: number; danno: number; uccisi: number };
export type MissioneUi = {
  /** Segnalino (pixel dello schermo); null = niente. */
  marcatore(o: { x: number; y: number; dist: number; etichetta: string } | null): void;
  /** Barra del sabotaggio (0..1, < 0 = nascosta) e invito («tieni E») o null. */
  sabotaggio(k: number, invito: string | null): void;
  /** Un colpo da `angolo` (rad, 0 = davanti, + a sinistra). */
  danno(angolo: number): void;
  briefing(on: boolean, telefono: boolean): void;
  fine(f: Fine | null): void;
  suRigioca(cb: () => void): void;
};

const CSS = `
.sm-mark { position: absolute; left: 0; top: 0; pointer-events: none; display: none; transform: translate(-50%, -50%); text-align: center; font: 800 12px system-ui, -apple-system, sans-serif; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,.6); letter-spacing: .06em; }
.sm-mark i { display: block; width: 14px; height: 14px; margin: 0 auto 3px; background: ${P.giallo}; transform: rotate(45deg); box-shadow: 0 0 0 2px rgba(35,32,31,.75); }
.sm-sab { position: absolute; left: 50%; bottom: 23%; transform: translateX(-50%); display: none; text-align: center; font: 800 14px system-ui, -apple-system, sans-serif; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,.6); letter-spacing: .1em; text-transform: uppercase; pointer-events: none; }
.sm-sab .bar { width: 220px; height: 8px; margin: 6px auto 0; background: rgba(0,0,0,.5); box-shadow: 0 0 0 2px rgba(255,255,255,.35); }
.sm-sab .bar i { display: block; height: 100%; width: 0; background: ${P.giallo}; }
.sm-dan { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
.sm-dan i { position: absolute; left: -36px; top: -132px; width: 72px; height: 9px; background: ${P.rosso}; box-shadow: 0 0 0 2px rgba(35,32,31,.55); transform-origin: 36px 132px; opacity: 0; }
.sm-pan { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 8px; background: rgba(35,32,31,.62); color: #fff; font: 800 15px system-ui, -apple-system, sans-serif; text-shadow: 0 2px 0 rgba(0,0,0,.55); text-align: center; pointer-events: none; z-index: 6; }
.sm-pan.on { display: flex; }
.sm-pan .t { font-size: 13px; letter-spacing: .3em; color: ${P.giallo}; }
.sm-pan .g { font-size: clamp(26px, 5vw, 44px); letter-spacing: .1em; }
.sm-pan .o { font-size: 16px; line-height: 1.75; letter-spacing: .03em; }
.sm-pan .o b { color: ${P.giallo}; }
.sm-pan .k { font-size: 12px; opacity: .85; line-height: 1.7; letter-spacing: .02em; max-width: 92vw; }
.sm-pan .via { margin-top: 10px; font-size: 20px; letter-spacing: .14em; }
.sm-pan .med { width: 64px; height: 64px; margin: 6px auto; box-shadow: 0 0 0 4px rgba(35,32,31,.7); transform: rotate(45deg); }
.sm-pan button { pointer-events: auto; margin-top: 12px; font: 800 18px system-ui, -apple-system, sans-serif; letter-spacing: .14em; color: #23201F; background: ${P.giallo}; border: 0; padding: 12px 28px; cursor: pointer; box-shadow: 0 4px 0 rgba(35,32,31,.6); touch-action: manipulation; }
`;
const MED: Record<string, [string, string]> = { oro: ['ORO', P.giallo], argento: ['ARGENTO', P.pietraChiara], bronzo: ['BRONZO', P.arancio] };

export function creaMissioneUi(root: HTMLElement): MissioneUi {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const mark = document.createElement('div'); mark.className = 'sm-mark'; mark.innerHTML = '<i></i><span></span>'; root.appendChild(mark);
  const markT = mark.querySelector('span')!;
  const sab = document.createElement('div'); sab.className = 'sm-sab'; sab.innerHTML = '<div class="t"></div><div class="bar"><i></i></div>'; root.appendChild(sab);
  const sabT = sab.querySelector('.t') as HTMLElement, sabB = sab.querySelector('.bar') as HTMLElement, sabI = sab.querySelector('.bar i') as HTMLElement;
  const dan = document.createElement('div'); dan.className = 'sm-dan'; root.appendChild(dan);
  const segni = Array.from({ length: 4 }, () => { const i = document.createElement('i'); dan.appendChild(i); return { el: i, t: 0 }; });
  let prossimo = 0;
  const pan = document.createElement('div'); pan.className = 'sm-pan'; root.appendChild(pan);
  let rigioca: (() => void) | null = null;
  const anima = () => {
    const now = performance.now();
    for (const s of segni) s.el.style.opacity = s.t > now ? String(Math.min(1, (s.t - now) / 500)) : '0';
    requestAnimationFrame(anima);
  };
  requestAnimationFrame(anima);
  return {
    marcatore(o) {
      if (!o) { mark.style.display = 'none'; return; }
      mark.style.display = 'block';
      mark.style.left = `${o.x}px`; mark.style.top = `${o.y}px`;
      markT.textContent = `${o.etichetta} ${Math.round(o.dist)} m`;
    },
    sabotaggio(k, invito) {
      sab.style.display = k >= 0 || invito ? 'block' : 'none';
      sabT.textContent = k >= 0 ? 'SABOTAGGIO' : invito ?? '';
      sabB.style.display = k >= 0 ? 'block' : 'none';
      if (k >= 0) sabI.style.width = `${Math.round(Math.min(1, k) * 100)}%`;
    },
    danno(angolo) {
      const s = segni[prossimo]!; prossimo = (prossimo + 1) % segni.length;
      s.el.style.transform = `rotate(${-angolo}rad)`; s.t = performance.now() + 1100;
    },
    briefing(on, telefono) {
      if (!on) { if (pan.dataset.cosa === 'briefing') pan.classList.remove('on'); return; }
      pan.dataset.cosa = 'briefing';
      pan.innerHTML = `<div class="t">MISSIONE 0</div><div class="g">IL PIAZZALE</div>
        <div class="o"><b>1</b> · Elimina le 6 sentinelle<br><b>2</b> · Sabota la gru: ${telefono ? 'tieni AZIONE' : 'tieni E'} per 3 secondi<br><b>3</b> · Raggiungi la barca</div>
        <div class="via">${telefono ? 'TOCCA PER INIZIARE' : 'CLICCA PER INIZIARE'}</div>
        <div class="k">${telefono ? 'joystick a sinistra · trascina a destra per mirare · SPARA (o spara da solo quando miri un nemico)' : 'WASD muovi · mouse mira · clic spara · destro mira · R ricarica · Spazio salta · C accucciato · Shift corri · 1 2 3 armi<br>V prima/terza persona · H pixel/HD · Esc pausa'}</div>`;
      pan.classList.add('on');
    },
    fine(f) {
      if (!f) { if (pan.dataset.cosa === 'fine') pan.classList.remove('on'); return; }
      pan.dataset.cosa = 'fine';
      const m = MED[f.medaglia], mm = Math.floor(f.secondi / 60), ss = Math.floor(f.secondi % 60);
      pan.innerHTML = f.esito === 'vinta'
        ? `<div class="t">MISSIONE 0 · IL PIAZZALE</div><div class="g">MISSIONE COMPIUTA</div>${m ? `<div class="med" style="background:${m[1]}"></div><div class="g" style="font-size:22px;color:${m[1]}">${m[0]}</div>` : ''}`
        : `<div class="t">MISSIONE 0 · IL PIAZZALE</div><div class="g" style="color:${P.rosso}">SEI CADUTO</div>`;
      pan.innerHTML += `<div class="o">tempo <b>${mm}:${String(ss).padStart(2, '0')}</b> · colpi a segno <b>${f.precisione}%</b> · alla testa <b>${f.teste}</b><br>abbattuti <b>${f.uccisi}</b> · danno preso <b>${f.danno}</b></div>`;
      const b = document.createElement('button'); b.textContent = f.esito === 'vinta' ? 'RIGIOCA' : 'RIPROVA';
      b.addEventListener('click', (e) => { e.stopPropagation(); rigioca?.(); });
      pan.appendChild(b);
      pan.classList.add('on');
    },
    suRigioca(cb) { rigioca = cb; },
  };
}
