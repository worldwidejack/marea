// Modalità foto (#109), chunk scaricato alla prima apertura (ui/foto.ts). In modalità foto tutta l'interfaccia sparisce (body.mz-foto),
// restano solo SCATTA e ×; trascinando (dito o mouse) la camera gira attorno all'avatar (±90° dalla vista di serie, inclinazione ±15-20°),
// pizzico o rotella per lo zoom entro i limiti di render/camera.ts. SCATTA: render apposito e lettura del canvas nello stesso frame,
// lampo, cornice di legno a pixel con cartellino di sabbia («MAREA · 8 OTTOBRE 2026» e il posto) composta alla risoluzione a pixel del
// gioco e ingrandita nearest (×2…×6), anteprima con SALVA (PNG marea-AAAA-MM-GG-hhmm.png) e CONDIVIDI (Web Share API, solo se il
// browser condivide file). PC: Esc / O esce, Spazio scatta, frecce girano, + e − zoomano. Solo colori della palette (ART_BIBLE §2).
import { PAL, el, injectUiStyle } from './style.ts';
import { RGBA, hash } from './pixel_kit.ts';
import type { Col } from './pixel_kit.ts';
import { CAM } from '../render/camera.ts';
import { suona } from '../audio/ponte.ts';
import { cameraIcon } from './foto.ts';
import type { FotoCtx } from './foto.ts';

const P = PAL;
const YAW_MAX = Math.PI / 2; // quanto si gira attorno all'avatar dalla vista di serie (oltre si vedono le facciate da dietro)
const PITCH_GIU = (15 * Math.PI) / 180, PITCH_SU = (20 * Math.PI) / 180, PITCH_MIN = (12 * Math.PI) / 180, PITCH_MAX = (72 * Math.PI) / 180;
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const CSS = `
body.mz-foto #ui > :not(#mzFoto) { display: none !important; }
#mzFoto { position: absolute; inset: 0; z-index: 40; display: none; touch-action: none; cursor: grab; }
#mzFoto.on { display: block; }
#mzFoto.drag { cursor: grabbing; }
#mzFoto .mz-x { position: absolute; top: max(8px, env(safe-area-inset-top)); right: 8px; z-index: 3; box-shadow: 0 3px 0 ${P.neroCaldo}; }
#mzFoto .mz-fo-hint { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 6px); left: 50%; transform: translateX(-50%); max-width: calc(100% - 132px); box-sizing: border-box; padding: 6px 10px; background: rgba(46,30,20,.92); border: 2px solid ${P.legnoChiaro}; box-shadow: 0 3px 0 ${P.neroCaldo}; font-size: 13px; font-weight: bold; text-align: center; pointer-events: none; transition: opacity .3s steps(3); }
#mzFoto .mz-fo-hint.off { opacity: 0; }
#mzFoto .mz-fo-scatta { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 28px); transform: translateX(-50%); display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 0 22px; background: ${P.giallo}; color: ${P.neroCaldo}; border: 2px solid ${P.neroCaldo}; box-shadow: 0 4px 0 ${P.neroCaldo}; font: bold 20px ui-monospace, Menlo, monospace; letter-spacing: .06em; cursor: pointer; }
#mzFoto .mz-fo-scatta:active { transform: translate(-50%, 3px); box-shadow: 0 1px 0 ${P.neroCaldo}; }
#mzFoto .mz-fo-scatta:disabled { background: ${P.pietra}; cursor: default; }
#mzFoto .mz-fo-lampo { position: absolute; inset: 0; z-index: 4; background: ${P.sabbiaChiara}; opacity: 0; pointer-events: none; }
#mzFoto .mz-fo-lampo.on { animation: mzFoLampo .3s steps(3) forwards; }
@keyframes mzFoLampo { from { opacity: 1; } to { opacity: 0; } }
#mzFoto .mz-fo-ant { position: absolute; inset: 0; z-index: 2; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: calc(max(8px, env(safe-area-inset-top)) + 52px) 12px calc(env(safe-area-inset-bottom, 0px) + 16px); box-sizing: border-box; background: rgba(46,30,20,.94); cursor: default; }
#mzFoto.ant .mz-fo-ant { display: flex; }
#mzFoto.ant .mz-fo-scatta, #mzFoto.ant .mz-fo-hint { display: none; }
#mzFoto .mz-fo-img { flex: none; image-rendering: pixelated; box-shadow: 0 4px 0 ${P.neroCaldo}; }
#mzFoto .mz-fo-act { width: 100%; max-width: 380px; }
#mzFoto .mz-fo-act .mz-btn { justify-content: center; margin-top: 0; min-height: 52px; font-size: 17px; }
#mzFoto .mz-fo-note { min-height: 18px; color: ${P.sabbia}; font-size: 13px; font-weight: bold; text-align: center; }
`;

// ---- carattere a pixel 5×7 (maiuscole, cifre, pochi segni): il cartellino è disegnato a pixel come il resto del gioco ----
const G: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.', '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.', '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...', '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '...|...|...|...|...|...|...', '·': '..|..|##|##|..|..|..', '-': '...|...|...|###|...|...|...', '.': '.|.|.|.|.|.|#', ',': '..|..|..|..|..|.#|#.',
  "'": '#|#|.|.|.|.|.', '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
};
const GLIFI = new Map(Object.entries(G).map(([k, v]) => [k, v.split('|')]));
/** Testo per il cartellino: maiuscole senza accenti, i caratteri che il carattere a pixel non ha diventano «?». */
const pulisci = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[«»"]/g, "'").split('').map((c) => (GLIFI.has(c) ? c : '?')).join('');
const glifo = (c: string) => GLIFI.get(c) ?? GLIFI.get('?')!;
/** Larghezza di una riga di testo a scala k (1 colonna di spazio tra le lettere). */
const larghezza = (s: string, k: number) => Math.max(0, [...s].reduce((a, c) => a + (glifo(c)[0]!.length + 1) * k, 0) - k);

export function dataItaliana(d: Date): string { return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`; }
export function nomeFile(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `marea-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.png`;
}

/** La foto (pixel del gioco) dentro la cornice di legno col cartellino; tutto in pixel del gioco, ingrandito dopo. */
export function componi(foto: ImageData, quando: Date, posto: string | null): { tela: HTMLCanvasElement; x: number; y: number } {
  const w = foto.width, h = foto.height;
  const s = Math.max(1, Math.round(Math.min(w, h) / 320)); // spessore dei dettagli della cornice (1 sul telefono, 2 su un PC grande)
  const B = Math.max(7 * s, Math.round(Math.min(w, h) * 0.032)), PAD = 4 * s; // legno: ~3 % del lato corto
  const riga1 = pulisci(`MAREA · ${dataItaliana(quando)}`), riga2 = posto ? pulisci(posto) : '';
  let k = Math.max(1, Math.round(h / 220)); // scala del testo: le lettere alte ~3 % della foto, se la riga ci sta
  while (k > 1 && larghezza(riga1, k) > w - 2 * PAD) k--;
  let r2 = riga2;
  while (r2.length > 3 && larghezza(r2, k) > w - 2 * PAD) r2 = r2.slice(0, -3).trimEnd() + '..';
  const righe = r2 ? 2 : 1, plateH = 2 * PAD + 7 * k * righe + (righe - 1) * 4 * k;
  const W = w + 2 * B, H = B + h + PAD + plateH + B;
  const tela = document.createElement('canvas'); tela.width = W; tela.height = H;
  const g = tela.getContext('2d')!;
  const img = g.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
  const set = (x: number, y: number, c: Col) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = RGBA[c]; };
  const rect = (x0: number, y0: number, rw: number, rh: number, c: Col) => { for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) set(x, y, c); };
  // legno: venature a trattini lungo la fibra (orizzontale sopra e sotto, verticale ai lati), giunti a 45° negli angoli
  const venatura = (u: number, v: number, lato: number): Col => {
    const fila = Math.floor(v / s), n = hash(Math.floor((u + (hash(fila, lato) % 97)) / (4 * s)), fila + lato * 1000) % 23;
    return n === 0 || n === 7 ? 'legnoScuro' : n === 3 ? 'legnoChiaro' : 'legno';
  };
  const yb = B + h; // dove comincia la fascia di sotto
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x >= B && x < B + w && y >= B && y < yb) continue; // la foto
    const sx = x < B, dx = x >= W - B, sopra = y < B, sotto = sx || dx ? y >= H - B : y >= yb; // ai lati la fascia di sotto è un quadrato B×B
    let oriz = sopra || sotto, giunto = false;
    if ((sopra || sotto) && (sx || dx)) { // angolo: giunto a 45°
      const a = sx ? x : W - 1 - x, b = sopra ? y : H - 1 - y;
      oriz = b <= a; giunto = Math.abs(a - b) < 0.75 * s;
    }
    set(x, y, giunto ? 'legnoScuro' : oriz ? venatura(x, y, sopra ? 1 : 2) : venatura(y, x, sx ? 3 : 4));
  }
  // bordo: fuori nero caldo, poi luce in alto e a sinistra, ombra in basso e a destra
  rect(0, 0, W, s, 'neroCaldo'); rect(0, H - s, W, s, 'neroCaldo'); rect(0, 0, s, H, 'neroCaldo'); rect(W - s, 0, s, H, 'neroCaldo');
  rect(s, s, W - 2 * s, s, 'legnoChiaro'); rect(s, s, s, H - 2 * s, 'legnoChiaro');
  rect(s, H - 2 * s, W - 2 * s, s, 'legnoScuro'); rect(W - 2 * s, s, s, H - 2 * s, 'legnoScuro');
  // la foto, pixel per pixel, con un filo scuro attorno
  const src = new Uint32Array(foto.data.buffer, foto.data.byteOffset, w * h);
  for (let y = 0; y < h; y++) buf.set(src.subarray(y * w, y * w + w), (B + y) * W + B);
  rect(B - s, B - s, w + 2 * s, s, 'ombraCalda'); rect(B - s, yb, w + 2 * s, s, 'legnoChiaro');
  rect(B - s, B, s, h, 'ombraCalda'); rect(B + w, B, s, h, 'legnoChiaro');
  // chiodi negli angoli
  const n = Math.max(2 * s, Math.round(B / 4)), n0 = Math.floor(n / 2);
  const chiodo = (cx: number, cy: number) => { rect(cx - n0, cy - n0, n, n, 'pietraScura'); rect(cx - n0, cy - n0, n - s, n - s, 'pietra'); rect(cx - n0, cy - n0, s, s, 'pietraChiara'); };
  const m = Math.round(B / 2);
  chiodo(m, m); chiodo(W - m, m); chiodo(m, H - m); chiodo(W - m, H - m);
  // cartellino di sabbia inchiodato sotto la foto, con un'ombra dura
  const px0 = B, py0 = yb + PAD, pw = w, ph = plateH;
  rect(px0 + s, py0 + s, pw, ph, 'ombraCalda');
  rect(px0, py0, pw, ph, 'legnoScuro'); rect(px0 + s, py0 + s, pw - 2 * s, ph - 2 * s, 'sabbiaChiara'); rect(px0 + s, py0 + ph - 2 * s, pw - 2 * s, s, 'sabbia');
  const scrivi = (t: string, cy: number, colore: (i: number) => Col) => {
    let x = px0 + Math.round((pw - larghezza(t, k)) / 2);
    [...t].forEach((c, i) => {
      const gl = glifo(c);
      for (let r = 0; r < 7; r++) for (let q = 0; q < gl[r]!.length; q++) if (gl[r]![q] === '#') {
        rect(x + q * k + Math.max(1, k >> 1), cy + r * k + Math.max(1, k >> 1), k, k, 'sabbia'); // ombra incisa
      }
      for (let r = 0; r < 7; r++) for (let q = 0; q < gl[r]!.length; q++) if (gl[r]![q] === '#') rect(x + q * k, cy + r * k, k, k, colore(i));
      x += (gl[0]!.length + 1) * k;
    });
  };
  scrivi(riga1, py0 + PAD, (i) => (i < 5 ? 'rosso' : 'legnoScuro'));
  if (r2) scrivi(r2, py0 + PAD + 11 * k, () => 'legno');
  g.putImageData(img, 0, 0);
  return { tela, x: B, y: B };
}

export function createFotoUi(ctx: FotoCtx) {
  injectUiStyle();
  if (!document.getElementById('mz-foto-style')) { const st = document.createElement('style'); st.id = 'mz-foto-style'; st.textContent = CSS; document.head.appendChild(st); }
  const touch = matchMedia('(pointer: coarse)').matches;
  const ov = el('div', 'mz'); ov.id = 'mzFoto'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Modalità foto');
  const x = el('button', 'mz-x', '×'); x.type = 'button'; x.title = 'Esci (Esc)'; x.setAttribute('aria-label', 'Esci dalla modalità foto');
  const hint = el('div', 'mz-fo-hint', touch ? 'Trascina per girare · pizzica per lo zoom' : 'Trascina per girare · rotella per lo zoom · Esc per uscire');
  const scatta = el('button', 'mz-fo-scatta'); scatta.type = 'button'; scatta.id = 'mzFotoScatta'; scatta.append(cameraIcon(30), el('span', '', 'SCATTA'));
  const lampo = el('div', 'mz-fo-lampo');
  const ant = el('div', 'mz-fo-ant'); ant.id = 'mzFotoAnt';
  const vista = el('canvas', 'mz-fo-img');
  const salva = el('button', 'mz-btn green', 'SALVA'); salva.type = 'button'; salva.id = 'mzFotoSalva';
  const condividi = el('button', 'mz-btn', 'CONDIVIDI'); condividi.type = 'button'; condividi.id = 'mzFotoCondividi';
  const act = el('div', 'mz-row mz-fo-act'); act.append(salva, condividi);
  const nota = el('div', 'mz-fo-note');
  ant.append(vista, act, nota);
  ov.append(scatta, hint, ant, lampo, x);
  ctx.root.appendChild(ov);

  let aperta = false, inAnt = false, occupato = false, hintT = 0;
  let base = { yaw: CAM.YAW, pitch: CAM.PITCH, zoom: 1 }, yaw: number = CAM.YAW, pitch: number = CAM.PITCH;
  let ultima: { piccola: HTMLCanvasElement; grande: HTMLCanvasElement; blob: Blob | null; file: File | null; nome: string; posto: string | null; fx: number; fy: number; fw: number; fh: number } | null = null;

  /** Gira la camera: dyaw e dpitch in radianti, zoom moltiplicativo (limiti della camera). */
  const gira = (dyaw: number, dpitch: number, zoomK = 1) => {
    yaw = Math.min(base.yaw + YAW_MAX, Math.max(base.yaw - YAW_MAX, yaw + dyaw));
    pitch = Math.min(Math.min(PITCH_MAX, base.pitch + PITCH_SU), Math.max(Math.max(PITCH_MIN, base.pitch - PITCH_GIU), pitch + dpitch));
    ctx.diorama.orbit?.(yaw, pitch);
    if (zoomK !== 1) ctx.diorama.setZoom(ctx.diorama.zoom * zoomK);
  };

  // ---- trascinare per girare, pizzico e rotella per lo zoom (solo sullo sfondo: i bottoni restano bottoni) ----
  const dita = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  ov.addEventListener('pointerdown', (e) => {
    if (inAnt || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); dita.set(e.pointerId, { x: e.clientX, y: e.clientY }); ov.classList.add('drag');
    try { ov.setPointerCapture(e.pointerId); } catch { /* pointer sintetico */ }
    if (dita.size === 2) { const [a, b] = [...dita.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
    hint.classList.add('off');
  });
  ov.addEventListener('pointermove', (e) => {
    const p = dita.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (dita.size === 1) gira((-dx / Math.max(320, innerWidth)) * Math.PI, (dy / Math.max(320, innerHeight)) * (Math.PI / 3));
    else if (dita.size === 2) {
      const [a, b] = [...dita.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch > 0 && d > 0) gira(0, 0, pinch / d);
      pinch = d;
    }
  });
  const su = (e: PointerEvent) => { dita.delete(e.pointerId); pinch = 0; if (!dita.size) ov.classList.remove('drag'); };
  ov.addEventListener('pointerup', su); ov.addEventListener('pointercancel', su);
  ov.addEventListener('wheel', (e) => {
    e.preventDefault(); if (inAnt) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    gira(0, 0, Math.exp(Math.max(-60, Math.min(60, dy)) * (e.ctrlKey ? 0.01 : 0.0022)));
  }, { passive: false });

  // ---- tastiera (in cattura: col modo foto aperto i tasti non arrivano al gioco) ----
  const PASSO = Math.PI / 18;
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const c = e.code;
    if (c === 'Escape') { e.preventDefault(); if (inAnt) indietro(); else close(); return; }
    if (c === 'KeyO' && !e.repeat) { e.preventDefault(); close(); return; }
    if (inAnt) return;
    if ((c === 'Space' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { e.preventDefault(); void doScatta(); return; }
    const mosse: Record<string, [number, number, number]> = {
      ArrowLeft: [PASSO, 0, 1], KeyA: [PASSO, 0, 1], ArrowRight: [-PASSO, 0, 1], KeyD: [-PASSO, 0, 1],
      ArrowUp: [0, PASSO / 2, 1], KeyW: [0, PASSO / 2, 1], ArrowDown: [0, -PASSO / 2, 1], KeyS: [0, -PASSO / 2, 1],
      Equal: [0, 0, 1 / 1.15], NumpadAdd: [0, 0, 1 / 1.15], Minus: [0, 0, 1.15], NumpadSubtract: [0, 0, 1.15],
    };
    const mv = mosse[c]; if (mv) { e.preventDefault(); gira(mv[0], mv[1], mv[2]); hint.classList.add('off'); }
  };

  // ---- anteprima: la foto incorniciata grande quanto ci sta, nearest ----
  const adatta = () => {
    if (!ultima) return;
    const r = ant.getBoundingClientRect(), cs = getComputedStyle(ant);
    const aw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - act.offsetHeight - nota.offsetHeight - 28;
    const t = ultima.piccola, k = Math.max(0.1, Math.min(aw / t.width, ah / t.height));
    vista.style.width = `${Math.floor(t.width * k)}px`; vista.style.height = `${Math.floor(t.height * k)}px`;
  };
  addEventListener('resize', () => { if (inAnt) adatta(); });
  const mostraAnt = () => {
    if (!ultima) return;
    const t = ultima.piccola; vista.width = t.width; vista.height = t.height; vista.getContext('2d')!.drawImage(t, 0, 0);
    inAnt = true; ov.classList.add('ant'); nota.textContent = ''; adatta();
    let puo = false;
    try { puo = !!ultima.file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [ultima.file] }); } catch { puo = false; }
    condividi.style.display = puo ? '' : 'none';
    salva.disabled = !ultima.blob;
  };
  function indietro(): void { inAnt = false; ov.classList.remove('ant'); }

  const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => { try { c.toBlob((b) => res(b), 'image/png'); } catch { res(null); } });
  async function doScatta(): Promise<{ w: number; h: number } | null> {
    if (!aperta || inAnt || occupato) return null;
    occupato = true; scatta.disabled = true;
    try {
      // render apposito e lettura nello stesso frame: il buffer WebGL è ancora quello appena disegnato
      ctx.rendi();
      const w = ctx.canvas.width, h = ctx.canvas.height;
      const copia = document.createElement('canvas'); copia.width = w; copia.height = h;
      const cg = copia.getContext('2d', { willReadFrequently: true })!; cg.drawImage(ctx.canvas, 0, 0);
      const foto = cg.getImageData(0, 0, w, h);
      lampo.classList.remove('on'); void lampo.offsetWidth; lampo.classList.add('on'); suona('click');
      const quando = new Date(), posto = ctx.posto();
      const { tela, x: fx, y: fy } = componi(foto, quando, posto);
      const f = Math.min(6, Math.max(2, Math.ceil(1600 / Math.max(tela.width, tela.height))));
      const grande = document.createElement('canvas'); grande.width = tela.width * f; grande.height = tela.height * f;
      const gg = grande.getContext('2d')!; gg.imageSmoothingEnabled = false; gg.drawImage(tela, 0, 0, grande.width, grande.height);
      const blob = await toBlob(grande), nome = nomeFile(quando);
      const file = blob && typeof File === 'function' ? new File([blob], nome, { type: 'image/png' }) : null;
      ultima = { piccola: tela, grande, blob, file, nome, posto, fx, fy, fw: w, fh: h };
      await new Promise((r) => setTimeout(r, 220)); // il lampo si vede prima dell'anteprima
      if (aperta) mostraAnt();
      return { w: grande.width, h: grande.height };
    } finally { occupato = false; scatta.disabled = false; }
  }
  scatta.addEventListener('click', () => { void doScatta(); });
  salva.addEventListener('click', () => {
    if (!ultima?.blob) return;
    const a = document.createElement('a'), url = URL.createObjectURL(ultima.blob);
    a.href = url; a.download = ultima.nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    nota.textContent = `Salvata: ${ultima.nome}`; suona('moneta');
  });
  condividi.addEventListener('click', () => {
    const u = ultima; if (!u?.file) return;
    navigator.share({ files: [u.file], title: 'MAREA', text: u.posto ? `MAREA · ${u.posto}` : 'MAREA' })
      .then(() => { nota.textContent = 'Condivisa'; })
      .catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') nota.textContent = 'Non si è potuta condividere: prova SALVA'; });
  });
  x.addEventListener('click', () => { if (inAnt) indietro(); else close(); });

  function open(): void {
    if (aperta) return;
    aperta = true; inAnt = false;
    base = { yaw: ctx.diorama.yaw, pitch: ctx.diorama.pitch ?? CAM.PITCH, zoom: ctx.diorama.zoom }; yaw = base.yaw; pitch = base.pitch;
    document.body.classList.add('mz-foto'); ov.classList.add('on'); ov.classList.remove('ant');
    hint.classList.remove('off'); clearTimeout(hintT); hintT = window.setTimeout(() => hint.classList.add('off'), 4000);
    addEventListener('keydown', onKey, true); suona('apri');
  }
  function close(): void {
    if (!aperta) return;
    aperta = false; inAnt = false; dita.clear(); ov.classList.remove('drag');
    ctx.diorama.orbit?.(base.yaw, base.pitch); ctx.diorama.setZoom(base.zoom); // la camera torna com'era
    document.body.classList.remove('mz-foto'); ov.classList.remove('on', 'ant');
    removeEventListener('keydown', onKey, true); suona('chiudi'); ctx.onClose();
  }

  /** Test: numeri dell'ultimo scatto (dimensioni, colori diversi nella foto e nella cornice, PNG come dataURL). */
  const dati = () => {
    const u = ultima; if (!u) return null;
    const g = u.piccola.getContext('2d')!, d = g.getImageData(0, 0, u.piccola.width, u.piccola.height).data, W = u.piccola.width;
    const colori = (x0: number, y0: number, w: number, h: number) => {
      const set = new Set<number>(), passo = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
      for (let y = y0; y < y0 + h; y += passo) for (let x = x0; x < x0 + w; x += passo) { const i = (y * W + x) * 4; set.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!); }
      return set.size;
    };
    return {
      nome: u.nome, posto: u.posto, w: u.grande.width, h: u.grande.height, piccola: [u.piccola.width, u.piccola.height], foto: [u.fw, u.fh],
      coloriFoto: colori(u.fx, u.fy, u.fw, u.fh), coloriCornice: colori(0, u.fy + u.fh, W, u.piccola.height - u.fy - u.fh),
      blob: u.blob?.size ?? 0, condividi: condividi.style.display !== 'none', dataUrl: u.grande.toDataURL('image/png'),
    };
  };
  const stato = () => ({
    aperta, anteprima: inAnt, occupato, yaw: ctx.diorama.yaw, pitch: ctx.diorama.pitch ?? null, zoom: ctx.diorama.zoom,
    visibili: [...ctx.root.children].filter((c) => c !== ov && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden').map((c) => c.id || c.className),
    ultima: ultima ? { nome: ultima.nome, posto: ultima.posto } : null,
  });
  return { open, close, isOpen: () => aperta, scatta: doScatta, indietro, gira, dati, stato };
}
