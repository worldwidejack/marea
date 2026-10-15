// Il look «kart» delle schermate di gara (#276): HUD in gara e schermata dei risultati, rifatti fedeli alle due immagini scelte da Jack
// fra quelle fatte con ChatGPT (`assets/concept/corse/hud_5_sonic_bis.jpg` e `risultati_4_sonic.jpg`), stessa famiglia del menù di scelta
// (#271: Titan One, pannelli blu e vetro, giallo, scacchi). Le misure sono in pixel delle immagini (1672×941): `--u` = un pixel lì.
// Vale finché il body ha `mz-kh` (la vista della gara lo mette in `mostra`), così il banco provapiste resta com'è. I comandi col dito
// (stick, GAS, DRIFT, FRENO) valgono anche nell'hub, col body `mz-gp mz-dito`. Colori: quelli della reference, come il menù.

/** Le icone bianche disegnate a mano (SVG, niente file): bandiera, cronometro, freno, drift, frecce del gas, alloro, rigioca, avanti. */
export const ICONA = {
  bandiera: '<svg viewBox="0 0 24 24"><path d="M5 3v18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4h14v10H6z" fill="#fff"/><path d="M6 4h3.5v2.5H6zM13 4h3.5v2.5H13zM9.5 6.5H13V9H9.5zM16.5 6.5H20V9h-3.5zM6 9h3.5v2.5H6zM13 9h3.5v2.5H13zM9.5 11.5H13V14H9.5zM16.5 11.5H20V14h-3.5z" fill="#12306e"/></svg>',
  cronometro: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.5 6.5l1.6-1.6"/></svg>',
  freno: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 5.2v1.8M18.8 12H17M12 18.8V17M5.2 12H7M16.8 7.2l-1.3 1.3M7.2 7.2l1.3 1.3M16.8 16.8l-1.3-1.3M7.2 16.8l1.3-1.3"/><path d="M4 7.5A9.5 9.5 0 0 1 9 3" stroke-width="2.6" stroke-linecap="round"/></svg>',
  drift: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h5.5l2.5 4h1.5a1.5 1.5 0 0 1 1.5 1.5V13h-3"/><path d="M9 5 7.5 9H6"/><circle cx="16" cy="13.5" r="1.6" fill="#fff"/><path d="M4 14c2 0 3 1.5 1.5 3S4 20 7 20M9 13.5c2 0 3 1.5 1.5 3S9 19.5 12 19.5"/></svg>',
  gas: '<svg viewBox="0 0 24 24" fill="none" stroke="#12306e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 12 6l7 6.5M5 19 12 12.5 19 19"/></svg>',
  alloro: '<svg viewBox="0 0 40 90"><defs><linearGradient id="kAl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe86b"/><stop offset="1" stop-color="#f0a400"/></linearGradient></defs><path d="M30 88C10 70 6 45 14 6" fill="none" stroke="url(#kAl)" stroke-width="4" stroke-linecap="round"/><g fill="url(#kAl)" stroke="#a86a00" stroke-width="1"><ellipse cx="22" cy="14" rx="5" ry="10" transform="rotate(25 22 14)"/><ellipse cx="6" cy="22" rx="5" ry="10" transform="rotate(-35 6 22)"/><ellipse cx="22" cy="34" rx="5" ry="10" transform="rotate(35 22 34)"/><ellipse cx="5" cy="42" rx="5" ry="10" transform="rotate(-40 5 42)"/><ellipse cx="24" cy="54" rx="5" ry="10" transform="rotate(45 24 54)"/><ellipse cx="9" cy="62" rx="5" ry="10" transform="rotate(-45 9 62)"/><ellipse cx="29" cy="72" rx="5" ry="10" transform="rotate(55 29 72)"/></g></svg>',
  rigioca: '<svg viewBox="0 0 24 24" fill="none" stroke="#9fe3ff" stroke-width="3.2" stroke-linecap="round"><path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M17.5 2.5v4.8h-4.8" stroke-linejoin="round"/></svg>',
  avanti: '<svg viewBox="0 0 24 24" fill="none" stroke="#12306e" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
} as const;

const CSS = `
@font-face { font-family: 'MzTitan'; src: url('/assets/fonts/titan-one-latin.woff2') format('woff2'); font-display: swap; }
body.mz-kh, body.mz-gp, .mz-esito.kart { --u: calc(min(100vh, 56.25vw) / 941); --navy: #12306e; --blu: #1d63d6; --ciano: #5fc8ff; --giallo: #ffe34d; }
@supports (height: 100dvh) { body.mz-kh, body.mz-gp, .mz-esito.kart { --u: calc(min(100dvh, 56.25vw) / 941); } }
body.mz-kh .pp-hud, body.mz-kh .pp-big, body.mz-kh .pp-toast, body.mz-kh .pp-amici, body.mz-kh .pp-tag, body.mz-kh .pp-ogg, body.mz-kh .mz-gp-quit,
body.mz-gp.mz-dito .mz-gp-gas, body.mz-gp #btnA, body.mz-gp #btnB, .mz-esito.kart { font-family: 'MzTitan', 'Arial Rounded MT Bold', ui-rounded, system-ui, sans-serif; font-weight: 400; }

/* ---- HUD: contenitore a tutto schermo, i pezzi messi dove stanno nell'immagine ---- */
body.mz-kh .pp-hud { inset: 0; left: 0; top: 0; transform: none; display: block; gap: 0; color: #fff; font-size: calc(34 * var(--u)); }
body.mz-kh .pp-hud div { padding: 0; background: none; border: none; }
body.mz-kh .pp-hud svg { display: block; width: 100%; height: 100%; }
/* la posizione: «2°» giallo enorme col contorno blu notte, su una targa blu inclinata con la coda a scacchi */
body.mz-kh .pp-hud .kh-pos { position: absolute; left: calc(max(0px, env(safe-area-inset-left)) + 62 * var(--u)); top: calc(40 * var(--u)); width: calc(218 * var(--u)); height: calc(170 * var(--u)); }
body.mz-kh .pp-hud .kh-pos::before { content: ''; position: absolute; inset: 0; transform: skewX(-12deg); border-radius: calc(22 * var(--u));
  background: linear-gradient(#2a7ff0, #1d55c4 55%, #163f9c); border: calc(5 * var(--u)) solid #8fd8ff; box-shadow: 0 0 calc(18 * var(--u)) rgba(95,200,255,.75), inset 0 calc(6 * var(--u)) 0 rgba(255,255,255,.25); }
body.mz-kh .pp-hud .kh-pos::after { content: ''; position: absolute; left: 92%; top: calc(8 * var(--u)); width: calc(140 * var(--u)); height: calc(130 * var(--u)); transform: skewX(-12deg);
  background: conic-gradient(#6fd0ff 25%, #1d63d6 0 50%, #6fd0ff 0 75%, #1d63d6 0) 0 0 / calc(44 * var(--u)) calc(44 * var(--u)); -webkit-mask: linear-gradient(90deg, #000 20%, transparent); mask: linear-gradient(90deg, #000 20%, transparent); z-index: -1; }
body.mz-kh .pp-hud .kh-pos b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 400; font-style: italic; font-size: calc(158 * var(--u)); line-height: 1; padding-right: calc(16 * var(--u));
  color: #ffd21f; background: linear-gradient(#fff590 10%, #ffd21f 50%, #f59a00 90%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  -webkit-text-stroke: calc(11 * var(--u)) var(--navy); paint-order: stroke fill; filter: drop-shadow(0 calc(5 * var(--u)) 0 rgba(10,25,70,.55)); }
body.mz-kh .pp-hud .kh-pos b sup { font-size: .56em; line-height: 1; vertical-align: top; margin-top: -.02em; margin-left: .01em; -webkit-text-stroke-width: calc(7 * var(--u)); }
/* giro e tempo: due pastiglie blu inclinate al centro in alto */
body.mz-kh .pp-hud .kh-su { position: absolute; left: 50%; top: calc(30 * var(--u)); transform: translateX(-50%); display: flex; gap: calc(28 * var(--u)); }
body.mz-kh .pp-hud .kh-pill { height: calc(65 * var(--u)); display: flex; align-items: center; gap: calc(14 * var(--u)); padding: 0 calc(30 * var(--u)); transform: skewX(-14deg); border-radius: calc(14 * var(--u));
  background: linear-gradient(#1f4fb8, var(--navy)); border: calc(3 * var(--u)) solid var(--ciano); box-shadow: 0 0 calc(14 * var(--u)) rgba(95,200,255,.7); white-space: nowrap; }
body.mz-kh .pp-hud .kh-pill > * { transform: skewX(14deg); }
body.mz-kh .pp-hud .kh-pill i { width: calc(40 * var(--u)); height: calc(40 * var(--u)); flex: none; }
body.mz-kh .pp-hud .kh-pill span { font-style: italic; font-size: calc(34 * var(--u)); }
body.mz-kh .pp-hud .kh-pill em { font-style: italic; font-size: calc(40 * var(--u)); color: var(--giallo); }
body.mz-kh .pp-hud .kh-pill.tempo span { font-size: calc(42 * var(--u)); min-width: 4.6em; }
body.mz-kh .pp-hud .kh-pill.onda { background: linear-gradient(#e8433f, #9c1f1f); border-color: #ffb3a8; }
/* la velocità: pannello inclinato in basso a destra coi km/h e la barra a tacche (sul telefono accanto al GAS) */
body.mz-kh .pp-hud .kh-vel { position: absolute; right: calc(max(0px, env(safe-area-inset-right)) + 36 * var(--u)); bottom: calc(env(safe-area-inset-bottom, 0px) + 56 * var(--u)); width: calc(450 * var(--u)); height: calc(135 * var(--u)); }
body.mz-gp.mz-dito.mz-kh .pp-hud .kh-vel { right: calc(max(0px, env(safe-area-inset-right)) + 236 * var(--u)); }
body.mz-kh .pp-hud .kh-vel::before { content: ''; position: absolute; inset: 0; transform: skewX(-28deg); border-radius: calc(10 * var(--u));
  background: linear-gradient(100deg, #2a7ff0, #1d55c4 60%, rgba(29,85,196,.85)); border: calc(4 * var(--u)) solid var(--ciano); box-shadow: 0 0 calc(16 * var(--u)) rgba(95,200,255,.75); }
body.mz-kh .pp-hud .kh-vel::after { content: ''; position: absolute; right: calc(-24 * var(--u)); top: calc(18 * var(--u)); width: calc(120 * var(--u)); height: calc(100 * var(--u)); transform: skewX(-28deg);
  background: conic-gradient(#6fd0ff 25%, #12306e 0 50%, #6fd0ff 0 75%, #12306e 0) 0 0 / calc(34 * var(--u)) calc(34 * var(--u)); -webkit-mask: linear-gradient(90deg, transparent, #000 70%); mask: linear-gradient(90deg, transparent, #000 70%); opacity: .8; }
body.mz-kh .pp-hud .kh-vel b { position: absolute; left: calc(118 * var(--u)); top: calc(14 * var(--u)); font-weight: 400; font-style: italic; font-size: calc(78 * var(--u)); line-height: 1; z-index: 1; }
body.mz-kh .pp-hud .kh-vel small { position: absolute; left: calc(268 * var(--u)); top: calc(46 * var(--u)); font-style: italic; font-size: calc(28 * var(--u)); z-index: 1; }
body.mz-kh .pp-hud .kh-vel .seg { position: absolute; left: calc(72 * var(--u)); bottom: calc(18 * var(--u)); display: flex; gap: calc(8 * var(--u)); transform: skewX(-28deg); z-index: 1; }
body.mz-kh .pp-hud .kh-vel .seg u { width: calc(38 * var(--u)); height: calc(22 * var(--u)); border-radius: calc(4 * var(--u)); background: rgba(10,30,80,.6); }
body.mz-kh .pp-hud .kh-vel .seg u.on { background: linear-gradient(#ffe86b, #f5b400); }
body.mz-kh .pp-hud .kh-vel .seg u.on.c { background: linear-gradient(#a8f0ff, #45c4f2); }
body.mz-kh .pp-hud .kh-vel.turbo b { color: #ffd21f; }
/* il semaforo e le scritte grandi: numeri enormi col contorno blu notte, la riga sotto in una pastiglia */
body.mz-kh .pp-big { top: 34%; padding: 0; background: none; border: none; font-style: italic; font-size: calc(230 * var(--u)); line-height: 1; -webkit-text-stroke: calc(14 * var(--u)) var(--navy); paint-order: stroke fill;
  filter: drop-shadow(0 calc(8 * var(--u)) 0 rgba(10,25,70,.5)) drop-shadow(0 0 calc(20 * var(--u)) rgba(95,200,255,.6)); }
body.mz-kh .pp-big.lungo { font-size: calc(130 * var(--u)); }
body.mz-kh .pp-big small { display: table; margin: calc(18 * var(--u)) auto 0; padding: calc(10 * var(--u)) calc(30 * var(--u)); border-radius: calc(14 * var(--u)); font-size: max(11px, calc(30 * var(--u))); color: #fff;
  -webkit-text-stroke: 0; background: linear-gradient(#1f4fb8, var(--navy)); border: calc(3 * var(--u)) solid var(--ciano); max-width: 80vw; }
body.mz-kh .pp-toast { top: 22%; font-style: italic; font-size: calc(64 * var(--u)); text-shadow: none; -webkit-text-stroke: calc(10 * var(--u)) var(--navy); paint-order: stroke fill; filter: drop-shadow(0 calc(5 * var(--u)) 0 rgba(10,25,70,.5)); }
/* gara tra amici: la classifica viva sotto la posizione */
body.mz-kh .pp-amici { left: calc(max(0px, env(safe-area-inset-left)) + 50 * var(--u)); top: calc(230 * var(--u)); font-size: max(10px, calc(26 * var(--u))); color: #fff; }
body.mz-kh .pp-amici div { padding: calc(6 * var(--u)) calc(18 * var(--u)); margin-bottom: calc(8 * var(--u)); transform: skewX(-12deg); border-radius: calc(10 * var(--u)); background: linear-gradient(#1f4fb8, var(--navy)); border: calc(3 * var(--u)) solid rgba(95,200,255,.8); border-left-width: calc(3 * var(--u)); }
body.mz-kh .pp-amici div.tu { color: var(--navy); background: linear-gradient(#fff07a, #ffc400); border-color: #fff; }
body.mz-kh .pp-tag { padding: calc(4 * var(--u)) calc(14 * var(--u)); border-radius: calc(10 * var(--u)); background: linear-gradient(#1f4fb8, var(--navy)); border: calc(3 * var(--u)) solid var(--ciano); color: #fff; font-size: max(10px, calc(24 * var(--u))); }
/* la minimappa: pannello a vetro con la pista bianca */
body.mz-kh .pp-mappa { right: calc(max(0px, env(safe-area-inset-right)) + 36 * var(--u)); top: calc(40 * var(--u)); width: calc(222 * var(--u)); height: calc(155 * var(--u)); image-rendering: auto; border-radius: calc(18 * var(--u));
  background: rgba(110,180,235,.38); border: calc(3 * var(--u)) solid rgba(200,235,255,.7); box-shadow: 0 0 calc(10 * var(--u)) rgba(95,200,255,.4); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); box-sizing: border-box; }
/* ritirati: pastiglia piccola sotto la mappa */
body.mz-kh .mz-gp-quit { left: auto; right: calc(max(0px, env(safe-area-inset-right)) + 36 * var(--u)); top: calc(212 * var(--u)); min-height: 30px; min-width: 30px; padding: 0 calc(22 * var(--u)); border-radius: calc(14 * var(--u));
  background: rgba(18,48,110,.75); border: calc(3 * var(--u)) solid rgba(200,235,255,.7); color: #fff; font-size: max(10px, calc(22 * var(--u))); font-style: italic; }
/* l'oggetto: casella col bordo giallo che brilla, l'icona grande, sotto la targhetta USA */
body.mz-kh .pp-ogg { left: auto; transform: none; right: calc(max(0px, env(safe-area-inset-right)) + 286 * var(--u)); top: calc(28 * var(--u)); width: calc(160 * var(--u)); height: calc(160 * var(--u)); padding: 0; box-sizing: border-box;
  border-radius: calc(26 * var(--u)); border: max(3px, calc(7 * var(--u))) solid var(--giallo) !important; background: radial-gradient(circle at 50% 40%, #3f8cf2, #1d55c4 60%, var(--navy)); box-shadow: 0 0 max(8px, calc(26 * var(--u))) rgba(255,224,70,.9), 0 0 0 1px #fff8c0, inset 0 calc(6 * var(--u)) 0 rgba(255,255,255,.2); color: #fff; }
body.mz-kh .pp-ogg .ic { position: absolute; inset: calc(14 * var(--u)) calc(14 * var(--u)) calc(26 * var(--u)); display: flex; align-items: center; justify-content: center; }
body.mz-kh .pp-ogg .ic img { height: 100% !important; width: auto; margin: 0; }
body.mz-kh .pp-ogg .nm { display: none; }
body.mz-kh .pp-ogg .n { display: block; position: absolute; right: calc(8 * var(--u)); top: calc(4 * var(--u)); font-style: italic; font-size: calc(34 * var(--u)); -webkit-text-stroke: calc(6 * var(--u)) var(--navy); paint-order: stroke fill; }
body.mz-kh .pp-ogg .tag { display: block; position: absolute; left: 50%; bottom: calc(-22 * var(--u)); transform: translateX(-50%); padding: calc(4 * var(--u)) calc(22 * var(--u)); border-radius: calc(12 * var(--u)); white-space: nowrap;
  background: linear-gradient(#ffef6b, #ffc400); border: calc(3 * var(--u)) solid #fff; color: var(--navy); font-style: italic; font-size: calc(28 * var(--u)); line-height: 1.15; box-shadow: 0 calc(3 * var(--u)) 0 rgba(10,25,70,.45); }
body.mz-kh .pp-ogg small { position: absolute; left: 50%; top: calc(100% + 26 * var(--u)); transform: translateX(-50%); margin: 0; white-space: nowrap; font-family: system-ui, -apple-system, sans-serif; font-weight: 800; font-size: max(9px, calc(18 * var(--u))); color: #fff; text-shadow: 0 1px 0 var(--navy), 0 0 4px var(--navy); }
body.mz-kh .pp-ogg.vuota .ic { opacity: 0; }
body.mz-kh .pp-ogg.gira .ic { animation: khGira .12s steps(2) infinite; }
@keyframes khGira { 50% { transform: translateY(calc(-6 * var(--u))); } }
/* col dito si tocca la casella: il bottone USA diventa trasparente e ci sta sopra */
body.mz-kh .pp-usa { right: calc(max(0px, env(safe-area-inset-right)) + 286 * var(--u)); bottom: auto; top: calc(28 * var(--u)); width: calc(160 * var(--u)); height: calc(182 * var(--u)); min-width: 64px; min-height: 64px; border-radius: calc(26 * var(--u));
  background: transparent !important; border: none; color: transparent; font-size: 0; }
body.mz-kh .pp-usa > * { display: none !important; }
body.mz-kh .pp-usa.giu { background: rgba(255,255,255,.18) !important; }

/* ---- comandi col dito (gara e hub): stick blu notte col bordo che brilla, FRENO blu, DRIFT rosso, GAS giallo enorme ---- */
body.mz-gp #joystick { background: radial-gradient(circle, rgba(18,48,110,.55) 0 38%, rgba(18,48,110,.85) 40%, rgba(10,30,80,.92) 70%) !important; border: 3px solid #8fd8ff !important;
  box-shadow: 0 0 14px rgba(95,200,255,.8), inset 0 0 0 10px rgba(255,255,255,.05) !important; }
body.mz-gp #joystick::before { content: ''; position: absolute; inset: 8px; pointer-events: none;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%23a9c8f0"><path d="M50 5l7 9H43zM50 95l7-9H43zM5 50l9-7v14zM95 50l-9-7v14z"/></svg>') center / 100% 100% no-repeat; }
body.mz-gp #stick { background: radial-gradient(circle at 40% 35%, #f4f8ff, #b7cdf0 70%, #8aa8dc) !important; border: 3px solid rgba(255,255,255,.85) !important; box-shadow: 0 3px 6px rgba(0,0,0,.4); }
body.mz-gp.mz-dito .mz-gp-gas { right: calc(max(0px, env(safe-area-inset-right)) + 36 * var(--u)); bottom: calc(env(safe-area-inset-bottom, 0px) + 11 * var(--u)); width: max(84px, calc(220 * var(--u))); height: max(84px, calc(220 * var(--u)));
  flex-direction: column; gap: 0; background: radial-gradient(circle at 45% 35%, #fff59a, #ffd21f 45%, #f5a800 85%); border: max(3px, calc(6 * var(--u))) solid #fff; color: var(--navy); font-style: italic; font-size: max(18px, calc(46 * var(--u)));
  box-shadow: 0 0 calc(24 * var(--u)) rgba(95,200,255,.9), 0 0 0 max(2px, calc(5 * var(--u))) var(--ciano), inset 0 calc(-8 * var(--u)) 0 rgba(200,110,0,.35); }
body.mz-gp.mz-dito .mz-gp-gas i { width: 46%; height: 34%; margin-bottom: -4%; }
body.mz-gp .mz-gp-gas i svg, body.mz-gp #btnA i svg, body.mz-gp #btnB i svg { width: 100%; height: 100%; display: block; }
body.mz-gp #btnA, body.mz-gp #btnB { flex-direction: column; gap: 0; font-style: italic; color: #fff !important; }
body.mz-gp #btnA { right: calc(max(0px, env(safe-area-inset-right)) + 49 * var(--u)) !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 224 * var(--u)) !important; width: max(58px, calc(144 * var(--u))) !important; height: max(58px, calc(144 * var(--u))) !important;
  font-size: max(12px, calc(30 * var(--u))) !important; background: radial-gradient(circle at 45% 35%, #ff7a6b, #e8433f 50%, #a51d1d) !important; border: max(3px, calc(5 * var(--u))) solid #ffd3cc !important; box-shadow: 0 0 calc(16 * var(--u)) rgba(95,200,255,.75), 0 0 0 max(2px, calc(4 * var(--u))) var(--ciano); }
body.mz-gp #btnB { right: calc(max(0px, env(safe-area-inset-right)) + 220 * var(--u)) !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 218 * var(--u)) !important; width: max(54px, calc(136 * var(--u))) !important; height: max(54px, calc(136 * var(--u))) !important;
  font-size: max(11px, calc(26 * var(--u))) !important; background: radial-gradient(circle at 45% 35%, #3f7fe0, #1d4fb0 50%, var(--navy)) !important; border: max(3px, calc(5 * var(--u))) solid #8fd8ff !important; box-shadow: 0 0 calc(16 * var(--u)) rgba(95,200,255,.75); }
body.mz-gp #btnA i, body.mz-gp #btnB i { width: 42%; height: 42%; }
body.mz-kh.mz-kh-fine #joystick, body.mz-kh.mz-kh-fine #btnA, body.mz-kh.mz-kh-fine #btnB, body.mz-kh.mz-kh-fine .mz-gp-gas, body.mz-kh.mz-kh-fine .pp-usa, body.mz-kh.mz-kh-fine .mz-gp-quit { display: none !important; }
/* i toast del mondo (es. «Hai trovato la mappa…») scendono in basso al centro, sopra la gara ferma: in alto coprirebbero il «1°» */
body.mz-kh.mz-kh-fine #toast { top: auto !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 300 * var(--u)) !important; max-width: 30vw !important; }

/* ---- risultati: titolo in alto a sinistra, «1°» enorme con l'alloro, classifica a barre inclinate a destra, premi e bottoni sotto ---- */
.mz-esito.kart { position: absolute; inset: 0; left: 0; top: 0; transform: none; width: auto; padding: 0; background: none; border: none !important; box-shadow: none; text-align: left; color: #fff; z-index: 22; }
.mz-esito.kart .kr-titolo { position: absolute; left: calc(max(0px, env(safe-area-inset-left)) + 30 * var(--u)); top: calc(25 * var(--u)); width: calc(685 * var(--u)); height: calc(110 * var(--u)); display: flex; align-items: center; padding-left: calc(60 * var(--u)); box-sizing: border-box;
  background: linear-gradient(90deg, #2a7ff0, #1d63d6 60%, #1d55c4); border: calc(4 * var(--u)) solid #8fd8ff; border-radius: calc(22 * var(--u)); transform: skewX(-14deg); box-shadow: 0 0 calc(18 * var(--u)) rgba(95,200,255,.7), inset 0 calc(-7 * var(--u)) 0 rgba(0,0,0,.18); }
.mz-esito.kart .kr-titolo::after { content: ''; position: absolute; right: calc(-20 * var(--u)); top: calc(-10 * var(--u)); width: calc(170 * var(--u)); height: calc(120 * var(--u));
  background: conic-gradient(#8fe0ff 25%, transparent 0 50%, #8fe0ff 0 75%, transparent 0) 0 0 / calc(48 * var(--u)) calc(48 * var(--u)); -webkit-mask: linear-gradient(90deg, transparent, #000 60%); mask: linear-gradient(90deg, transparent, #000 60%); }
.mz-esito.kart .kr-titolo h2 { margin: 0; transform: skewX(14deg); font-weight: 400; font-style: italic; font-size: calc(76 * var(--u)); letter-spacing: .01em; color: #fff; white-space: nowrap; filter: drop-shadow(0 calc(4 * var(--u)) 0 rgba(10,25,70,.45)); }
.mz-esito.kart .kr-pos { position: absolute; right: calc(max(0px, env(safe-area-inset-right)) + 712 * var(--u)); top: calc(110 * var(--u)); height: calc(280 * var(--u)); display: flex; align-items: center; gap: calc(6 * var(--u)); }
.mz-esito.kart .kr-pos i { width: calc(72 * var(--u)); height: calc(162 * var(--u)); align-self: flex-end; margin-bottom: calc(16 * var(--u)); }
.mz-esito.kart .kr-pos i:last-child { transform: scaleX(-1); }
.mz-esito.kart .kr-pos i svg { width: 100%; height: 100%; display: block; }
.mz-esito.kart .kr-pos b { font-weight: 400; font-style: italic; font-size: calc(270 * var(--u)); line-height: 1; padding-right: calc(10 * var(--u));
  background: linear-gradient(#fff590 10%, #ffd21f 50%, #f59a00 90%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  -webkit-text-stroke: calc(16 * var(--u)) var(--navy); paint-order: stroke fill; filter: drop-shadow(0 calc(8 * var(--u)) 0 rgba(10,25,70,.5)) drop-shadow(0 0 calc(26 * var(--u)) rgba(255,224,70,.7)); }
.mz-esito.kart .kr-pos b sup { font-size: .56em; line-height: 1; vertical-align: top; margin-top: -.02em; -webkit-text-stroke-width: calc(10 * var(--u)); }
.mz-esito.kart .kr-lista { position: absolute; right: calc(max(0px, env(safe-area-inset-right)) + 47 * var(--u)); top: calc(110 * var(--u)); width: calc(660 * var(--u)); display: flex; flex-direction: column; gap: calc(12 * var(--u)); }
.mz-esito.kart .kr-riga { position: relative; height: calc(73 * var(--u)); display: flex; align-items: center; }
.mz-esito.kart .kr-riga::before { content: ''; position: absolute; inset: 0; transform: skewX(-14deg); border-radius: calc(12 * var(--u)); background: linear-gradient(90deg, #2563d8, #1a49ad 70%, #153b94); border: calc(3 * var(--u)) solid #6fc6ff; box-shadow: 0 0 calc(10 * var(--u)) rgba(95,200,255,.5); }
.mz-esito.kart .kr-riga::after { content: ''; position: absolute; right: calc(-12 * var(--u)); top: calc(6 * var(--u)); bottom: calc(6 * var(--u)); width: calc(64 * var(--u)); transform: skewX(-14deg);
  background: conic-gradient(#6fd0ff 25%, transparent 0 50%, #6fd0ff 0 75%, transparent 0) 0 0 / calc(22 * var(--u)) calc(22 * var(--u)); -webkit-mask: linear-gradient(90deg, transparent, #000); mask: linear-gradient(90deg, transparent, #000); opacity: .9; }
.mz-esito.kart .kr-riga > * { position: relative; z-index: 1; }
.mz-esito.kart .kr-riga .n { width: calc(78 * var(--u)); text-align: center; font-style: italic; font-size: calc(58 * var(--u)); -webkit-text-stroke: calc(7 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-esito.kart .kr-riga .ft { width: calc(78 * var(--u)); height: calc(66 * var(--u)); border-radius: calc(12 * var(--u)); overflow: hidden; background: linear-gradient(#bfe8ff, #7cc7f2); border: calc(3 * var(--u)) solid #fff; flex: none; }
.mz-esito.kart .kr-riga .ft img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; display: block; }
.mz-esito.kart .kr-riga .nm { flex: 1; min-width: 0; padding-left: calc(20 * var(--u)); font-style: italic; font-size: calc(31 * var(--u)); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-text-stroke: calc(5 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-esito.kart .kr-riga .t { width: calc(205 * var(--u)); margin-right: calc(50 * var(--u)); flex: none; height: calc(54 * var(--u)); display: flex; align-items: center; justify-content: center; transform: skewX(-14deg); border-radius: calc(8 * var(--u)); background: rgba(10,30,80,.55); font-style: italic; font-size: calc(34 * var(--u)); }
.mz-esito.kart .kr-riga .t > span { transform: skewX(14deg); }
.mz-esito.kart .kr-riga.tu { height: calc(92 * var(--u)); }
.mz-esito.kart .kr-riga.tu::before { background: linear-gradient(90deg, #ffef6b, #ffd21f 55%, #f5b400); border: calc(4 * var(--u)) solid #fff7b0; box-shadow: 0 0 calc(22 * var(--u)) rgba(255,224,70,.9); }
.mz-esito.kart .kr-riga.tu::after { background: conic-gradient(#fff6a8 25%, transparent 0 50%, #fff6a8 0 75%, transparent 0) 0 0 / calc(22 * var(--u)) calc(22 * var(--u)); }
.mz-esito.kart .kr-riga.tu .n { color: #ffe866; -webkit-text-stroke-color: #7a4a00; background: linear-gradient(#c98a12, #8a5a06); border-radius: calc(10 * var(--u)); transform: skewX(-14deg); height: calc(70 * var(--u)); line-height: calc(72 * var(--u)); margin-left: calc(10 * var(--u)); }
.mz-esito.kart .kr-riga.tu .t { background: rgba(160,100,0,.35); color: var(--navy); }
.mz-esito.kart .kr-riga.via .t { color: #b7cdf0; }
.mz-esito.kart .kr-giro { position: relative; height: calc(64 * var(--u)); margin-top: calc(8 * var(--u)); display: flex; align-items: center; padding-left: calc(30 * var(--u)); gap: calc(20 * var(--u)); }
.mz-esito.kart .kr-giro::before { content: ''; position: absolute; inset: 0; transform: skewX(-14deg); border-radius: calc(12 * var(--u)); background: linear-gradient(90deg, #3d3fd0, #2a2fa8 70%, #22288f); border: calc(3 * var(--u)) solid #8fd8ff; box-shadow: 0 0 calc(10 * var(--u)) rgba(95,200,255,.5); }
.mz-esito.kart .kr-giro > * { position: relative; }
.mz-esito.kart .kr-giro i { width: calc(44 * var(--u)); height: calc(44 * var(--u)); }
.mz-esito.kart .kr-giro i svg { width: 100%; height: 100%; display: block; }
.mz-esito.kart .kr-giro span { flex: 1; min-width: 0; font-style: italic; font-size: calc(32 * var(--u)); text-transform: uppercase; white-space: nowrap; }
.mz-esito.kart .kr-giro b { flex: none; width: calc(205 * var(--u)); margin-right: calc(50 * var(--u)); text-align: center; font-weight: 400; font-style: italic; font-size: calc(38 * var(--u)); color: var(--giallo); }
.mz-esito.kart .kr-premi { position: absolute; left: calc(max(0px, env(safe-area-inset-left)) + 27 * var(--u)); bottom: calc(env(safe-area-inset-bottom, 0px) + 28 * var(--u)); width: calc(853 * var(--u)); height: calc(160 * var(--u)); box-sizing: border-box; padding: calc(10 * var(--u)) calc(14 * var(--u));
  background: rgba(30,80,170,.8); border: calc(3 * var(--u)) solid rgba(150,210,255,.7); border-radius: calc(16 * var(--u)); -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px); }
.mz-esito.kart .kr-premi h3 { margin: 0 0 calc(6 * var(--u)) calc(14 * var(--u)); display: flex; align-items: center; gap: calc(8 * var(--u)); font-weight: 400; font-style: italic; font-size: calc(30 * var(--u)); color: #fff; text-transform: uppercase; }
.mz-esito.kart .kr-premi h3::after { content: ''; width: calc(42 * var(--u)); height: calc(30 * var(--u)); background: conic-gradient(#6fd0ff 25%, transparent 0 50%, #6fd0ff 0 75%, transparent 0) 0 0 / calc(15 * var(--u)) calc(15 * var(--u)); }
.mz-esito.kart .kr-premi .celle { display: flex; gap: calc(12 * var(--u)); }
.mz-esito.kart .kr-premi .cella { flex: 1; height: calc(92 * var(--u)); display: flex; align-items: center; gap: calc(14 * var(--u)); padding: 0 calc(14 * var(--u)); border-radius: calc(12 * var(--u)); background: rgba(18,48,110,.6); border: calc(2 * var(--u)) solid rgba(150,210,255,.6); }
.mz-esito.kart .kr-premi .cella > span:first-child { flex: none; }
.mz-esito.kart .kr-premi .cella b { display: block; font-weight: 400; font-style: italic; font-size: calc(40 * var(--u)); color: var(--giallo); line-height: 1; -webkit-text-stroke: calc(5 * var(--u)) var(--navy); paint-order: stroke fill; }
.mz-esito.kart .kr-premi .cella small { display: block; font-size: calc(18 * var(--u)); color: #fff; text-transform: uppercase; }
.mz-esito.kart .kr-premi .nota { font-family: system-ui, -apple-system, sans-serif; font-weight: 800; font-size: max(10px, calc(24 * var(--u))); line-height: 1.3; margin: calc(8 * var(--u)) calc(14 * var(--u)); text-shadow: 0 1px 0 var(--navy); }
.mz-esito.kart .kr-bott { position: absolute; right: calc(max(0px, env(safe-area-inset-right)) + 42 * var(--u)); bottom: calc(env(safe-area-inset-bottom, 0px) + 48 * var(--u)); display: flex; gap: calc(30 * var(--u)); margin: 0; }
.mz-esito.kart .kr-bott .mz-btn { width: calc(340 * var(--u)); height: calc(113 * var(--u)); min-height: 40px; display: flex; align-items: center; justify-content: center; gap: calc(16 * var(--u)); margin: 0; padding: 0; border-radius: calc(26 * var(--u)); transform: skewX(-10deg);
  font-family: inherit; font-weight: 400; font-style: italic; font-size: max(14px, calc(46 * var(--u))); color: #fff; background: linear-gradient(#2f86f2, #1b55c6); border: calc(5 * var(--u)) solid #8fd8ff; box-shadow: 0 0 calc(22 * var(--u)) rgba(95,200,255,.85), inset 0 calc(-7 * var(--u)) 0 rgba(0,0,0,.2); }
.mz-esito.kart .kr-bott .mz-btn > * { transform: skewX(10deg); }
.mz-esito.kart .kr-bott .mz-btn i { width: calc(48 * var(--u)); height: calc(48 * var(--u)); }
.mz-esito.kart .kr-bott .mz-btn i svg { width: 100%; height: 100%; display: block; }
.mz-esito.kart .kr-bott .mz-btn[data-act="ok"] { color: var(--navy); background: linear-gradient(#fff07a, #ffd21f 50%, #f5a800); border-color: #fff4a0; box-shadow: 0 0 calc(22 * var(--u)) rgba(255,224,70,.9), inset 0 calc(-7 * var(--u)) 0 rgba(160,90,0,.3); }
`;

/** Mette il foglio di stile, una volta sola. */
export function stileKart(): void {
  if (document.getElementById('mz-kart-style')) return;
  const st = document.createElement('style'); st.id = 'mz-kart-style'; st.textContent = CSS; document.head.appendChild(st);
}
