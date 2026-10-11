// Banco di prova della discesa in bici in prima persona (provadiscesa.html, pagina a parte: il gioco non cambia).
// Il fondo è un video (spezzoni AI di Kling in stile dipinto, uniti in public/assets/discesa/discesa_v1.mp4); sopra, in finta prospettiva,
// sassi, tronchi, pigne d'oro, trampolini e il fantasma del tuo record. Tutto passa da un canvas piccolo ingrandito a pixel grossi,
// così il video prende il look di MAREA. La velocità è quella del video (pedalare = più veloce), la pista è la sua linea del tempo.
// Comandi — telefono: trascina a sinistra = cambi linea, PEDALA tenuto, SALTA; PC: ← → o A D, ↑ o W pedala, Spazio salta.
// Indirizzo: ?px=480 (larghezza del canvas), ?auto=1 (pilota automatico), ?seme=7 (ostacoli). Test: window.__provadiscesa.
import { autopilota, creaStato, moltiplicatore, passo } from './logica.ts';
import type { Comandi, Evento, Ostacolo, Stato, Tipo } from './logica.ts';

const q = new URLSearchParams(location.search);
const W = Math.max(240, Math.min(960, Number(q.get('px')) || 480)), H = Math.round((W * 9) / 16);
const AUTO = q.get('auto') === '1';
const SEME = Number(q.get('seme')) || 7;
const VIDEO = '/assets/discesa/discesa_v1.mp4';
const GIUNTURE = [10.04]; // dove finisce lo spezzone A (cresta) e comincia il B (pineta)
// dove va a finire il sentiero, secondo per secondo (frazioni dello schermo, segnate a mano sui fotogrammi)
const ORIZZONTE: [number, number, number][] = [
  [0, 0.38, 0.3], [1, 0.4, 0.3], [2, 0.52, 0.4], [3, 0.6, 0.45], [4, 0.55, 0.45], [5, 0.5, 0.38], [6, 0.55, 0.4], [7, 0.62, 0.45],
  [8, 0.5, 0.38], [9, 0.46, 0.4], [10, 0.42, 0.32], [11, 0.45, 0.36], [12, 0.53, 0.45], [13, 0.5, 0.42], [14, 0.55, 0.45],
  [15, 0.5, 0.42], [16, 0.45, 0.45], [17, 0.4, 0.38], [18, 0.5, 0.45], [19, 0.62, 0.38], [21, 0.62, 0.38],
];
const VISTA = 1.5; // secondi di video davanti: oltre non si vede niente
const CHIAVE_RECORD = 'marea.discesa.record.v1';

// --- DOM ---
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;
canvas.width = W; canvas.height = H;
const g = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
g.imageSmoothingEnabled = false;
const video = document.createElement('video');
video.src = VIDEO; video.muted = true; video.playsInline = true; video.preload = 'auto';
video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
document.body.appendChild(video);

const SPRITE: Partial<Record<Tipo | 'fantasma', HTMLImageElement>> = {};
for (const [k, f] of [['sasso', 'sasso'], ['tronco', 'tronco'], ['pigna', 'pigna'], ['dosso', 'rampa'], ['fantasma', 'fantasma']] as const) {
  const im = new Image(); im.src = `/assets/discesa/${f}.png`; im.onload = () => { SPRITE[k] = im; };
}

const css = document.createElement('style');
css.textContent = `
  .hud { position: fixed; top: max(10px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left)); right: max(14px, env(safe-area-inset-right)); display: flex; gap: 10px; align-items: flex-start; pointer-events: none; font-weight: 800; text-shadow: 0 2px 0 #0008; }
  .hud .pill { background: #10161fcc; border-radius: 12px; padding: 6px 12px; font-size: 18px; letter-spacing: .5px; }
  .hud .adr { flex: 0 0 160px; height: 14px; border-radius: 8px; background: #10161fcc; overflow: hidden; margin-top: 10px; border: 2px solid #ffffff55; }
  .hud .adr i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ffd23f, #ff7a1a, #ff2e63); transition: width .1s; }
  .hud .x { color: #ffd23f; font-size: 22px; }
  .hud .gap { margin-left: auto; }
  .tasto { position: fixed; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 15px; color: #fff; background: #10161f99; border: 3px solid #ffffffaa; touch-action: none; -webkit-tap-highlight-color: transparent; }
  .tasto.on { background: #ff7a1acc; }
  .pedala { width: 112px; height: 112px; right: max(18px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom)); }
  .salta { width: 84px; height: 84px; right: calc(max(18px, env(safe-area-inset-right)) + 124px); bottom: max(26px, env(safe-area-inset-bottom)); }
  .scritta { position: fixed; left: 50%; top: 34%; transform: translate(-50%, -50%); font-size: 34px; font-weight: 900; text-shadow: 0 3px 0 #000a; pointer-events: none; transition: opacity .3s; white-space: nowrap; }
  .carta { position: fixed; inset: 0; display: grid; place-items: center; background: #10161fb0; }
  .carta > div { background: #1b2a3a; border: 3px solid #ffffff44; border-radius: 18px; padding: 18px 22px; max-width: min(560px, 86vw); max-height: 86vh; overflow: auto; line-height: 1.35; }
  .carta h1 { margin: 0 0 8px; font-size: 26px; } .carta p { margin: 6px 0; font-size: 15px; }
  .carta button { margin-top: 12px; font: inherit; font-weight: 900; font-size: 20px; padding: 10px 26px; border-radius: 14px; border: 0; background: #ff7a1a; color: #fff; }
  .gira { position: fixed; inset: 0; display: none; place-items: center; background: #10161f; font-size: 22px; font-weight: 800; text-align: center; padding: 20px; }
  @media (orientation: portrait) and (pointer: coarse) { .gira { display: grid; } }
  .touch-only { display: none; } @media (pointer: coarse) { .touch-only { display: grid; } }
`;
document.head.appendChild(css);
ui.innerHTML = `
  <div class="hud"><div class="pill" id="tempo">0:00.0</div><div class="pill" id="punti">0</div><div class="adr"><i id="adr"></i></div><div class="x" id="molt"></div><div class="pill gap" id="gap"></div></div>
  <div class="tasto salta touch-only" id="salta">SALTA</div>
  <div class="tasto pedala touch-only" id="pedala">PEDALA</div>
  <div class="scritta" id="scritta" style="opacity:0"></div>
  <div class="carta" id="carta"><div>
    <h1>🚵 Discesa — prova</h1>
    <p>Dalla cresta sul mare giù fino alla pineta. Batti il tuo record (il fantasma azzurro).</p>
    <p><b>Cambi linea</b>: trascina il dito a sinistra dello schermo · ← → sul PC.</p>
    <p><b>PEDALA</b> (tieni premuto · ↑): vai più forte. <b>SALTA</b> (Spazio): i tronchi si saltano; sul trampolino fai il trick.</p>
    <p>Pigne d'oro = punti. Passare rasente ai sassi riempie l'<b>adrenalina</b>: punti ×2, ×3. Se sbatti non muori: perdi tempo.</p>
    <button id="via">VIA</button>
  </div></div>
  <div class="gira">Gira il telefono in orizzontale 🔄</div>`;
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const hud = { tempo: $('tempo'), punti: $('punti'), adr: $('adr'), molt: $('molt'), gap: $('gap') };

// --- comandi ---
const tasti = new Set<string>();
addEventListener('keydown', (e) => { tasti.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', (e) => tasti.delete(e.code));
let sterzoDito = 0, pedalaDito = false, saltaDito = false, ditoId = -1, ditoX0 = 0;
canvas.addEventListener('pointerdown', (e) => { if (e.clientX < innerWidth * 0.6) { ditoId = e.pointerId; ditoX0 = e.clientX; } });
addEventListener('pointermove', (e) => { if (e.pointerId === ditoId) sterzoDito = Math.max(-1, Math.min(1, (e.clientX - ditoX0) / 55)); });
const lascia = (e: PointerEvent) => { if (e.pointerId === ditoId) { ditoId = -1; sterzoDito = 0; } };
addEventListener('pointerup', lascia); addEventListener('pointercancel', lascia);
const tieni = (el: HTMLElement, su: (v: boolean) => void) => {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); su(true); el.classList.add('on'); });
  const via = () => { su(false); el.classList.remove('on'); };
  el.addEventListener('pointerup', via); el.addEventListener('pointercancel', via); el.addEventListener('lostpointercapture', via);
};
tieni($('pedala'), (v) => { pedalaDito = v; });
tieni($('salta'), (v) => { if (v) saltaDito = true; });
function comandi(s: Stato): Comandi {
  if (AUTO) return autopilota(s);
  const k = (...c: string[]) => c.some((x) => tasti.has(x));
  const sterzo = (k('ArrowRight', 'KeyD') ? 1 : 0) - (k('ArrowLeft', 'KeyA') ? 1 : 0) || sterzoDito;
  const salta = k('Space') || saltaDito;
  saltaDito = false;
  return { sterzo, pedala: k('ArrowUp', 'KeyW') || pedalaDito, salta };
}

// --- suoni (WebAudio, niente file) ---
const suoni = (() => {
  let ctx: AudioContext | null = null, vento: GainNode | null = null, filtro: BiquadFilterNode | null = null, rum: AudioBuffer | null = null;
  const avvia = () => {
    if (ctx) { void ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    rum = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = rum.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = rum; src.loop = true;
    filtro = ctx.createBiquadFilter(); filtro.type = 'bandpass'; filtro.frequency.value = 500; filtro.Q.value = 0.7;
    vento = ctx.createGain(); vento.gain.value = 0;
    src.connect(filtro); filtro.connect(vento); vento.connect(ctx.destination); src.start();
  };
  const colpo = (f: number, dur: number, vol: number, tipo: OscillatorType = 'sine', fine = f * 0.5) => {
    if (!ctx) return;
    const o = ctx.createOscillator(), gg = ctx.createGain(), t = ctx.currentTime;
    o.type = tipo; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, fine), t + dur);
    gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gg); gg.connect(ctx.destination); o.start(t); o.stop(t + dur);
  };
  const soffio = (dur: number, vol: number, f0: number, f1: number) => {
    if (!ctx || !rum) return;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gg = ctx.createGain(), t = ctx.currentTime;
    s.buffer = rum; bp.type = 'bandpass'; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(gg); gg.connect(ctx.destination); s.start(t); s.stop(t + dur);
  };
  return {
    avvia,
    vento(v: number, aria: boolean, attivo: boolean) {
      if (!ctx || !vento || !filtro) return;
      const t = ctx.currentTime;
      vento.gain.setTargetAtTime(attivo ? 0.05 + 0.22 * Math.max(0, v - 0.5) : 0, t, 0.1);
      filtro.frequency.setTargetAtTime(aria ? 1400 : 350 + 600 * v, t, 0.1);
    },
    evento(e: Evento) {
      if (e === 'botta') { colpo(120, 0.35, 0.6, 'square', 40); soffio(0.4, 0.5, 900, 200); }
      else if (e === 'salto') soffio(0.35, 0.25, 600, 1800);
      else if (e === 'trick') { soffio(0.5, 0.3, 500, 2400); colpo(660, 0.25, 0.15, 'triangle', 1320); }
      else if (e === 'pigna') colpo(1320, 0.18, 0.18, 'triangle', 1760);
      else if (e === 'rasente') soffio(0.2, 0.25, 2500, 900);
      else if (e === 'atterra') colpo(90, 0.18, 0.4, 'sine', 50);
      else if (e === 'giuntura') soffio(0.45, 0.35, 300, 3000);
      else if (e === 'fine') { colpo(880, 0.3, 0.2, 'triangle', 880); setTimeout(() => colpo(1320, 0.5, 0.2, 'triangle', 1320), 160); }
    },
  };
})();

// --- record e fantasma ---
type Campione = [tempo: number, t: number, x: number];
type Primato = { tempo: number; punti: number; corsa: Campione[] };
const leggiRecord = (): Primato | null => { try { const r = JSON.parse(localStorage.getItem(CHIAVE_RECORD) ?? 'null') as Primato | null; return r && Array.isArray(r.corsa) ? r : null; } catch { return null; } };
let record = leggiRecord();
let corsa: Campione[] = [];
/** Dov'era il fantasma (t sul video, x) a questo tempo di gara. */
function fantasmaA(tempo: number): [number, number] | null {
  const c = record?.corsa; if (!c || c.length < 2) return null;
  let i = 0; while (i < c.length - 2 && (c[i + 1] as Campione)[0] < tempo) i++;
  const a = c[i] as Campione, b = c[i + 1] as Campione, k = Math.max(0, Math.min(1, (tempo - a[0]) / (b[0] - a[0] || 1)));
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
/** Quando il fantasma è passato da qui (t sul video): per il distacco. */
function fantasmaQuando(t: number): number | null {
  const c = record?.corsa; if (!c || c.length < 2) return null;
  let i = 0; while (i < c.length - 2 && (c[i + 1] as Campione)[1] < t) i++;
  const a = c[i] as Campione, b = c[i + 1] as Campione, k = Math.max(0, Math.min(1, (t - a[1]) / (b[1] - a[1] || 1)));
  return a[0] + (b[0] - a[0]) * k;
}

// --- partita ---
let s: Stato = creaStato(20.08, GIUNTURE, SEME);
let fase: 'carta' | 'gara' | 'fine' = 'carta';
let scossa = 0, lampo = 0, rosso = 0, ultimoCampione = 0, scrittaFino = 0;
function scritta(t: string, dur = 0.9) { const el = $('scritta'); el.textContent = t; el.style.opacity = '1'; scrittaFino = performance.now() + dur * 1000; }
function via() {
  suoni.avvia();
  s = creaStato(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 20.08, GIUNTURE, SEME);
  corsa = []; ultimoCampione = -1;
  video.currentTime = 0; video.playbackRate = 1;
  void video.play().catch(() => { /* senza gesto il telefono può rifiutare: riprova al prossimo tocco */ });
  $('carta').style.display = 'none';
  fase = 'gara';
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (matchMedia('(pointer: coarse)').matches) { try { void el.requestFullscreen?.().catch(() => undefined); } catch { /* iPhone: niente schermo intero */ } }
}
$('via').addEventListener('click', via);
addEventListener('keydown', (e) => { if ((e.code === 'Enter' || e.code === 'Space') && fase !== 'gara') { e.preventDefault(); via(); } });

function fine() {
  fase = 'fine';
  const mio: Primato = { tempo: s.tempo, punti: s.punti, corsa };
  const nuovo = !record || s.tempo < record.tempo;
  if (nuovo) { record = mio; try { localStorage.setItem(CHIAVE_RECORD, JSON.stringify(mio)); } catch { /* niente memoria: pazienza */ } }
  const c = $('carta');
  c.innerHTML = `<div><h1>${nuovo ? '🏆 Nuovo record!' : '🏁 Arrivato'}</h1>
    <p>Tempo <b>${orologio(s.tempo)}</b> · Punti <b>${s.punti}</b></p>
    <p>Record: <b>${orologio(record?.tempo ?? s.tempo)}</b>. Al prossimo giro il fantasma azzurro corre come il record.</p>
    <button id="ancora">RIFAI</button></div>`;
  c.style.display = 'grid';
  $('ancora').addEventListener('click', via);
}
const orologio = (x: number) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;

// --- disegno ---
const orizzonte = (t: number): [number, number] => {
  let i = 0; while (i < ORIZZONTE.length - 2 && (ORIZZONTE[i + 1] as [number, number, number])[0] < t) i++;
  const a = ORIZZONTE[i] as [number, number, number], b = ORIZZONTE[i + 1] as [number, number, number];
  const k = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
  const liscio = k * k * (3 - 2 * k);
  return [a[1] + (b[1] - a[1]) * liscio, a[2] + (b[2] - a[2]) * liscio];
};
const LARGO: Record<Tipo | 'fantasma', number> = { sasso: 0.36, tronco: 0.95, pigna: 0.1, dosso: 0.3, fantasma: 0.17 };
function sprite(tipo: Tipo | 'fantasma', ox: number, dt: number, alfa = 1) {
  const im = SPRITE[tipo];
  if (!im || dt > VISTA || dt < -0.06) return;
  const sc = 1 / (1 + Math.max(0, dt) * 5.5);
  const [hx, hy] = orizzonte(s.t);
  const bx = hx + (0.5 - hx) * sc, by = hy + (0.97 - hy) * sc;
  const w = LARGO[tipo] * W * sc, h = (w * im.height) / im.width;
  const x = bx * W + (ox - s.x) * W * 0.62 * sc - w / 2, y = by * H - h * (tipo === 'pigna' ? 1.6 : 0.95);
  // il trampolino sparisce prima (è alto e finirebbe sopra le mani), gli altri appena arrivano al manubrio
  const via0 = tipo === 'dosso' ? 0.3 : 0.1;
  const dentro = Math.min(1, (VISTA - dt) / 0.35), fuori = dt < via0 ? Math.max(0, (dt - via0 + 0.16) / 0.16) : 1;
  g.globalAlpha = alfa * dentro * fuori;
  g.drawImage(im, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
}
function disegna(dtVero: number) {
  const aria = s.aria > 0 ? Math.sin((1 - s.aria / Math.max(0.01, s.ariaMax)) * Math.PI) : 0;
  const trema = (s.v > 1.2 ? (s.v - 1.2) * 1.4 : 0) + scossa;
  const jx = (Math.random() - 0.5) * trema * W * 0.012, jy = (Math.random() - 0.5) * trema * H * 0.02;
  g.save();
  g.translate(W / 2 + jx, H / 2 + jy - aria * H * 0.05);
  g.rotate(s.x * 0.035 + (s.botta > 0 ? Math.sin(performance.now() / 40) * 0.03 : 0));
  const zoom = 1.1 + aria * 0.04 + (s.v - 1) * 0.03;
  g.scale(zoom, zoom);
  g.translate(-W / 2 - s.x * W * 0.035, -H / 2);
  if (video.readyState >= 2) g.drawImage(video, 0, 0, W, H);
  else { g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, W, H); }
  // ostacoli dal più lontano al più vicino, il fantasma tra loro
  const fant = fase === 'gara' ? fantasmaA(s.tempo) : null;
  const lista: [number, () => void][] = s.ostacoli.filter((o) => !(o.preso && o.tipo === 'pigna')).map((o: Ostacolo) => [o.t - s.t, () => sprite(o.tipo, o.x, o.t - s.t)]);
  if (fant && fant[0] - s.t > 0.08) lista.push([fant[0] - s.t, () => sprite('fantasma', fant[1], fant[0] - s.t, 0.6)]);
  for (const [, f] of lista.sort((a, b) => b[0] - a[0])) f();
  g.restore();
  // linee di velocità ai bordi
  if (s.v > 1.25) {
    g.strokeStyle = `rgba(255,255,255,${Math.min(0.5, (s.v - 1.25) * 1.2)})`; g.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r0 = W * (0.36 + Math.random() * 0.1), r1 = r0 + W * 0.12;
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0 * 0.6); g.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1 * 0.6); g.stroke();
    }
  }
  if (lampo > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(1, lampo * 5)})`; g.fillRect(0, 0, W, H); }
  if (rosso > 0) { g.fillStyle = `rgba(255,40,40,${rosso * 0.6})`; g.fillRect(0, 0, W, H); }
  scossa = Math.max(0, scossa - dtVero * 3); lampo = Math.max(0, lampo - dtVero); rosso = Math.max(0, rosso - dtVero * 2);
}
function aggiornaHud() {
  hud.tempo.textContent = orologio(s.tempo);
  hud.punti.textContent = `${s.punti} pt`;
  hud.adr.style.width = `${Math.round(s.adr * 100)}%`;
  const m = moltiplicatore(s); hud.molt.textContent = m > 1 ? `×${m}` : '';
  const gq = fase === 'gara' ? fantasmaQuando(s.t) : null;
  if (gq === null) hud.gap.style.display = 'none';
  else { const d = s.tempo - gq; hud.gap.style.display = ''; hud.gap.textContent = `👻 ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} s`; hud.gap.style.color = d > 0 ? '#ff8a8a' : '#8affb0'; }
  if (performance.now() > scrittaFino) $('scritta').style.opacity = '0';
}

// --- ciclo ---
let prima = performance.now();
function ciclo(ora: number) {
  // il cronometro conta il tempo vero anche se il telefono perde fotogrammi (fino a 1/4 di secondo per volta): così il record è giusto
  const dt = Math.min(0.25, Math.max(0, (ora - prima) / 1000)); prima = ora;
  if (fase === 'gara' && !document.hidden) {
    if (video.paused && !video.ended) void video.play().catch(() => undefined);
    const p0 = s.punti;
    const ev = passo(s, dt, comandi(s), video.readyState >= 2 ? video.currentTime : undefined);
    const vr = Math.max(0.25, Math.min(2, s.v));
    if (Math.abs(video.playbackRate - vr) > 0.03) video.playbackRate = vr;
    if (s.tempo - ultimoCampione >= 0.1) { corsa.push([+s.tempo.toFixed(2), +s.t.toFixed(3), +s.x.toFixed(2)]); ultimoCampione = s.tempo; }
    for (const e of ev) {
      suoni.evento(e);
      if (e === 'botta') { scossa = 1.6; rosso = 1; scritta(['Che botta!', 'Ahia!', 'Dritto nel sasso!'][Math.floor(Math.random() * 3)] ?? 'Ahia!'); navigator.vibrate?.(120); }
      else if (e === 'trick') scritta(`TRICK! +${s.punti - p0}`);
      else if (e === 'atterra') scossa = Math.max(scossa, 0.8);
      else if (e === 'rasente') scritta('Rasente! 🔥', 0.6);
      else if (e === 'giuntura') lampo = 0.2;
      else if (e === 'fine') { video.pause(); fine(); }
    }
    suoni.vento(s.v, s.aria > 0, true);
  } else suoni.vento(0, false, false);
  disegna(dt);
  aggiornaHud();
  ultimoDisegno = ora;
  requestAnimationFrame(ciclo);
}
addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
// se la pagina smette di disegnare (scheda in secondo piano, telefono che si inceppa) il video si ferma: la pista non scappa avanti da sola
let ultimoDisegno = performance.now();
setInterval(() => { if (fase === 'gara' && performance.now() - ultimoDisegno > 300 && !video.paused) video.pause(); }, 100);
video.addEventListener('loadeddata', () => { video.currentTime = 0.05; });
requestAnimationFrame(ciclo);

const testApi = {
  ready: false,
  state: () => ({ fase, t: s.t, v: s.v, x: s.x, punti: s.punti, adr: s.adr, tempo: s.tempo, finito: s.finito, video: { pronto: video.readyState, rate: video.playbackRate, t: video.currentTime, durata: video.duration } }),
  via,
};
(window as unknown as { __provadiscesa: typeof testApi }).__provadiscesa = testApi;
video.addEventListener('canplay', () => { testApi.ready = true; }, { once: true });
if (AUTO) addEventListener('load', () => setTimeout(via, 300));
