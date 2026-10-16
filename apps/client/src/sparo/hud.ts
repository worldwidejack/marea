// L'HUD del banco dello sparatutto (#355): mirino che si allarga con la dispersione (in mira sparisce: si mira coi mirini dell'arma),
// la X del colpo a segno (rossa all'uccisione), munizioni e arma in basso a destra con la barra della ricarica, l'obiettivo in alto a
// sinistra, il bordo rosso a gradini quando la vita scende, i messaggi al centro, il pannello delle prove (A/B) e i tasti.
// Stile pulito alla COD (bianco con l'ombra); quello vero si sceglie da reference, come per le Corse.
import { P } from '../render/island_parts.ts';

export type HudDati = {
  /** Dispersione adesso (rad) e campo visivo verticale (gradi): il mirino sta dove arrivano i colpi. */
  cono: number; fovV: number; mira: boolean; terza: boolean;
  colpi: number; riserva: number; nome: string;
  /** 0..1 durante la ricarica, −1 altrimenti. */
  ricarica: number;
  vita: number; obiettivo: string; info: string;
};
export type Opzione = { id: string; etichetta: () => string; premi: () => void };
export type Hud = {
  aggiorna(d: HudDati): void;
  segno(testa: boolean, ucciso: boolean): void;
  messaggio(t: string, sec?: number): void;
  invito(on: boolean): void;
  opzioni(o: Opzione[]): void;
};

const CSS = `
.sp-hud { position: absolute; inset: 0; pointer-events: none; font: 800 15px system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,.55), 0 0 6px rgba(0,0,0,.35); letter-spacing: .04em; text-transform: uppercase; }
.sp-mir { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.sp-mir i { position: absolute; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.55); }
.sp-mir i.o { width: 9px; height: 2px; top: -1px; } .sp-mir i.v { width: 2px; height: 9px; left: -1px; }
.sp-mir b { position: absolute; left: -1px; top: -1px; width: 2px; height: 2px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.55); }
.sp-x { position: absolute; left: 50%; top: 50%; width: 0; height: 0; opacity: 0; }
.sp-x i { position: absolute; width: 11px; height: 3px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.5); }
.sp-x.rosso i { background: ${P.rosso}; }
.sp-mun { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom)); text-align: right; }
.sp-mun .n { font-size: 44px; line-height: 1; } .sp-mun .r { font-size: 20px; opacity: .8; } .sp-mun .a { font-size: 13px; opacity: .9; letter-spacing: .14em; }
.sp-mun .bar { width: 120px; height: 5px; margin: 6px 0 0 auto; background: rgba(0,0,0,.45); }
.sp-hud.tocco .sp-mun { right: auto; left: 50%; transform: translateX(-50%); bottom: max(8px, env(safe-area-inset-bottom)); text-align: center; }
.sp-hud.tocco .sp-mun .n { font-size: 30px; } .sp-hud.tocco .sp-mun .bar { margin: 4px auto 0; }
.sp-hud.tocco .sp-obi .d { font-size: 14px; } .sp-hud.tocco .sp-obi .i { display: none; }
.sp-mun .bar i { display: block; height: 100%; background: #fff; }
.sp-obi { position: absolute; left: max(18px, env(safe-area-inset-left)); top: max(14px, env(safe-area-inset-top)); max-width: 46vw; }
.sp-obi .t { font-size: 12px; letter-spacing: .2em; color: ${P.giallo}; } .sp-obi .d { font-size: 17px; margin-top: 2px; } .sp-obi .i { font-size: 12px; opacity: .85; margin-top: 4px; text-transform: none; letter-spacing: .02em; }
.sp-msg { position: absolute; left: 50%; top: 31%; transform: translateX(-50%); font-size: 26px; letter-spacing: .12em; white-space: nowrap; opacity: 0; transition: opacity .2s; }
.sp-bordo { position: absolute; inset: 0; pointer-events: none; }
.sp-inv { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 10px; background: rgba(35,32,31,.55); pointer-events: none; }
.sp-inv.on { display: flex; }
.sp-inv .g { font-size: 30px; letter-spacing: .14em; } .sp-inv .k { font-size: 13px; opacity: .9; text-transform: none; letter-spacing: .02em; text-align: center; line-height: 1.7; }
.sp-opz { position: absolute; right: max(12px, env(safe-area-inset-right)); top: max(12px, env(safe-area-inset-top)); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: auto; z-index: 5; }
.sp-opz button { font: 800 12px system-ui, -apple-system, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #fff; background: rgba(35,32,31,.72); border: 2px solid rgba(255,255,255,.35); padding: 6px 9px; cursor: pointer; touch-action: manipulation; }
.sp-opz button:hover { border-color: #fff; }
.sp-opz .lista { display: none; flex-direction: column; align-items: flex-end; gap: 4px; } .sp-opz.on .lista { display: flex; }
`;

/** `tocco` = telefono: munizioni in basso al centro (a destra ci sono i bottoni), obiettivo più piccolo. */
export function creaHud(root: HTMLElement, tocco = false): Hud {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const hud = document.createElement('div'); hud.className = 'sp-hud' + (tocco ? ' tocco' : ''); root.appendChild(hud);
  const bordo = document.createElement('div'); bordo.className = 'sp-bordo'; hud.appendChild(bordo);
  const mir = document.createElement('div'); mir.className = 'sp-mir';
  mir.innerHTML = '<i class="o"></i><i class="o"></i><i class="v"></i><i class="v"></i><b></b>'; hud.appendChild(mir);
  const [mL, mR, mU, mD] = Array.from(mir.querySelectorAll('i')) as HTMLElement[];
  const punto = mir.querySelector('b') as HTMLElement;
  const x = document.createElement('div'); x.className = 'sp-x'; hud.appendChild(x);
  for (const [r, dx, dy] of [[45, -9, -9], [-45, 1, -9], [-45, -9, 3], [45, 1, 3]] as const) {
    const i = document.createElement('i'); i.style.transform = `translate(${dx - 1}px, ${dy}px) rotate(${r}deg)`; x.appendChild(i);
  }
  const mun = document.createElement('div'); mun.className = 'sp-mun';
  mun.innerHTML = '<div class="a"></div><div><span class="n"></span> <span class="r"></span></div><div class="bar"><i></i></div>'; hud.appendChild(mun);
  const [mA, mN, mRis, mBar] = [mun.querySelector('.a'), mun.querySelector('.n'), mun.querySelector('.r'), mun.querySelector('.bar')] as HTMLElement[];
  const mBarI = mBar!.querySelector('i') as HTMLElement;
  const obi = document.createElement('div'); obi.className = 'sp-obi'; obi.innerHTML = '<div class="t">obiettivo</div><div class="d"></div><div class="i"></div>'; hud.appendChild(obi);
  const [oD, oI] = [obi.querySelector('.d'), obi.querySelector('.i')] as HTMLElement[];
  const msg = document.createElement('div'); msg.className = 'sp-msg'; hud.appendChild(msg);
  const inv = document.createElement('div'); inv.className = 'sp-inv';
  inv.innerHTML = `<div class="g">CLICCA PER GIOCARE</div><div class="k">WASD muovi · mouse mira · clic spara · tasto destro mira<br>R ricarica · Spazio salta · C accucciato · Shift corri · 1 2 3 armi<br>V prima/terza persona · H pixel/HD · T pilota automatico · M muto · Esc pausa</div>`;
  root.appendChild(inv);
  const opz = document.createElement('div'); opz.className = 'sp-opz'; root.appendChild(opz);
  let xT = 0, msgT = 0, lastXk = 0;
  const tick = () => {
    const now = performance.now();
    if (xT > now) { const k = (xT - now) / 260; x.style.opacity = String(Math.min(1, k * 1.6)); x.style.transform = `scale(${1 + (1 - k) * 0.25 + lastXk})`; } else x.style.opacity = '0';
    if (msgT < now) msg.style.opacity = '0';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  let ultimaVita = -1, ultimoNome = '', ultimiColpi = -1, ultimaRis = -1, ultimoObi = '', ultimaInfo = '';
  return {
    aggiorna(d) {
      const h = root.clientHeight || innerHeight;
      // il mirino: le stanghette dove arriva il bordo del cono (in pixel dello schermo)
      const gap = Math.max(5, Math.min(140, (Math.tan(d.cono) / Math.tan((d.fovV * Math.PI) / 360)) * (h / 2)));
      const mostra = !d.mira || d.terza;
      mL!.style.left = `${-gap - 9}px`; mR!.style.left = `${gap}px`; mU!.style.top = `${-gap - 9}px`; mD!.style.top = `${gap}px`;
      for (const e of [mL, mR, mU, mD]) e!.style.display = mostra && !d.mira ? 'block' : 'none';
      punto.style.display = d.mira && d.terza ? 'block' : d.mira ? 'none' : 'block';
      if (d.nome !== ultimoNome) { mA!.textContent = d.nome; ultimoNome = d.nome; }
      if (d.colpi !== ultimiColpi) { mN!.textContent = String(d.colpi); mN!.style.color = d.colpi === 0 ? P.rosso : '#fff'; ultimiColpi = d.colpi; }
      if (d.riserva !== ultimaRis) { mRis!.textContent = `/ ${d.riserva}`; ultimaRis = d.riserva; }
      mBar!.style.visibility = d.ricarica >= 0 ? 'visible' : 'hidden';
      if (d.ricarica >= 0) mBarI.style.width = `${Math.round(d.ricarica * 100)}%`;
      if (d.obiettivo !== ultimoObi) { oD!.textContent = d.obiettivo; ultimoObi = d.obiettivo; }
      if (d.info !== ultimaInfo) { oI!.textContent = d.info; ultimaInfo = d.info; }
      // bordo rosso a gradini (niente sfumature lisce): più bande e più forti quando la vita scende
      const v = Math.round(d.vita);
      if (v !== ultimaVita) {
        ultimaVita = v;
        const a = Math.max(0, Math.min(1, (70 - v) / 60));
        bordo.style.boxShadow = a > 0 ? `inset 0 0 0 ${Math.round(10 + 18 * a)}px rgba(232,67,63,${(0.5 * a).toFixed(2)}), inset 0 0 0 ${Math.round(24 + 40 * a)}px rgba(232,67,63,${(0.25 * a).toFixed(2)}), inset 0 0 0 ${Math.round(40 + 70 * a)}px rgba(232,67,63,${(0.12 * a).toFixed(2)})` : 'none';
      }
    },
    segno(testa, ucciso) {
      x.classList.toggle('rosso', ucciso);
      lastXk = testa ? 0.25 : 0;
      xT = performance.now() + (ucciso ? 420 : 260);
    },
    messaggio(t, sec = 1.4) { msg.textContent = t; msg.style.opacity = '1'; msgT = performance.now() + sec * 1000; },
    invito(on) { inv.classList.toggle('on', on); },
    opzioni(lista) {
      opz.innerHTML = '';
      const btn = document.createElement('button'); btn.textContent = '⚙ prove'; opz.appendChild(btn);
      const box = document.createElement('div'); box.className = 'lista'; opz.appendChild(box);
      btn.addEventListener('click', (e) => { e.stopPropagation(); opz.classList.toggle('on'); });
      for (const o of lista) {
        const b = document.createElement('button'); b.dataset.id = o.id; b.textContent = o.etichetta();
        b.addEventListener('click', (e) => { e.stopPropagation(); o.premi(); for (const k of Array.from(box.children) as HTMLButtonElement[]) { const q = lista.find((z) => z.id === k.dataset.id); if (q) k.textContent = q.etichetta(); } });
        box.appendChild(b);
      }
    },
  };
}
