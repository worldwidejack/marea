// Il relitto dei Templari sotto il faro della Tempesta (docs/TEMPLARI.md §1-2) in un chunk a parte, così non pesa sul JS iniziale (TECH §5):
// il calice d'oro col fascio di luce (game/templari.ts lo scarica all'avvio, dopo il resto) e il biglietto di fra' Guillaume.
import * as THREE from 'three';
import { M, merged, painted } from '../render/island_parts.ts';
import { PAL, el } from '../ui/style.ts';

/** Il biglietto di fra' Guillaume (docs/TEMPLARI.md §1-2): la fuga da La Rochelle, la rotta verso l'isola, l'avvertimento. */
export const BIGLIETTO = [
  'Anno del Signore 1307, d’ottobre.',
  'La notte di venerdì tredici il re di Francia ci ha fatti prendere tutti. Noi di La Rochelle siamo salpati prima dell’alba: diciotto navi, e nelle stive il tesoro del Tempio.',
  'La tempesta ci ha spaccati su questi scogli, sotto il faro. Io solo sono vivo, e non per molto.',
  'Le altre navi tenevano la rotta di libeccio, verso l’isola tra la montagna di fuoco e il giardino: là i fratelli alzeranno Santa Maria del Tempio e aspetteranno il Gran Maestro.',
  'Porta loro il calice. Posalo sull’altare.',
  'Ma se senti gridare «Deus vult» sotto la terra, scappa.',
  '— fra’ Guillaume, sergente del Tempio',
];
const CSS_BIGLIETTO = `
#mzBiglietto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(440px, calc(100% - 32px)); max-height: calc(100% - 120px); overflow-y: auto; box-sizing: border-box; padding: 16px 16px 12px; z-index: 31; display: none;
  background: ${PAL.sabbiaChiara}; color: ${PAL.ombraCalda}; border: 3px solid ${PAL.legnoChiaro}; box-shadow: 0 4px 0 ${PAL.neroCaldo}, inset 0 0 0 2px ${PAL.sabbia}; font-size: 14px; line-height: 1.45; }
#mzBiglietto.on { display: block; }
#mzBiglietto b { display: block; margin-bottom: 8px; font-size: 13px; letter-spacing: .1em; color: ${PAL.rosso}; text-align: center; }
#mzBiglietto p { margin: 0 0 8px; }
#mzBiglietto p.firma { text-align: right; font-style: italic; }
#mzBiglietto button { display: block; margin: 10px auto 0; min-width: 120px; min-height: 44px; background: ${PAL.legnoScuro}; color: ${PAL.sabbiaChiara}; border: 2px solid ${PAL.legnoChiaro}; font: bold 15px ui-monospace, Menlo, monospace; cursor: pointer; }
`;

/** Il foglio del biglietto, nascosto, dentro `root` (si apre con la classe `on`); `chiuso` gira quando si preme Chiudi. */
export function creaBiglietto(root: HTMLElement, chiuso: () => void): HTMLElement {
  if (!document.getElementById('mz-biglietto-style')) { const st = document.createElement('style'); st.id = 'mz-biglietto-style'; st.textContent = CSS_BIGLIETTO; document.head.appendChild(st); }
  const biglietto = el('div', 'mz'); biglietto.id = 'mzBiglietto';
  const chiudi = el('button', '', 'Chiudi') as HTMLButtonElement; chiudi.type = 'button'; chiudi.dataset['act'] = 'chiudi';
  biglietto.append(el('b', '', '✠ IL BIGLIETTO DELLO SCHELETRO'), ...BIGLIETTO.map((r, i) => el('p', i === BIGLIETTO.length - 1 ? 'firma' : '', r)), chiudi);
  for (const ev of ['pointerdown', 'touchstart']) biglietto.addEventListener(ev, (x) => x.stopPropagation());
  chiudi.addEventListener('click', () => { biglietto.classList.remove('on'); chiuso(); });
  root.append(biglietto);
  return biglietto;
}

/** Il calice d'oro coi rubini e il fascio di luce che lo segnala da lontano, dentro il gruppo `calice` (game/templari.ts lo muove). */
export function riempiCalice(calice: THREE.Group): void {
    const oro = merged([
      painted(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 8), PAL.arancio, M(0, 0.025, 0)),
      painted(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), PAL.giallo, M(0, 0.15, 0)),
      painted(new THREE.OctahedronGeometry(0.06, 0), PAL.arancio, M(0, 0.16, 0)),
      painted(new THREE.CylinderGeometry(0.12, 0.05, 0.16, 8), PAL.giallo, M(0, 0.33, 0)),
      painted(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 8), PAL.arancio, M(0, 0.41, 0)),
      ...[0, 2.1, 4.2].map((a) => painted(new THREE.BoxGeometry(0.035, 0.035, 0.035), PAL.rosso, M(Math.cos(a) * 0.1, 0.32, Math.sin(a) * 0.1))),
    ]);
    const corpo = new THREE.Mesh(oro, new THREE.MeshBasicMaterial({ vertexColors: true })); corpo.scale.setScalar(1.4);
    const fascio = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35).translate(0, 4.5, 0), new THREE.MeshBasicMaterial({ color: PAL.giallo, transparent: true, opacity: 0.22, depthWrite: false }));
    fascio.renderOrder = 2;
    calice.add(corpo, fascio);
}
