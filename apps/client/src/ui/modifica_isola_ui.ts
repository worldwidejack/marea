// UI per la modalità modifica rapida dell'isola (#403): bottone, overlay, top bar, toolbar edificio selezionato, cassetto magazzino.
import { building as buildingDef } from '@marea/content';
import type { PlacedBuilding, StoredBuilding } from '@marea/sim';
import { PAL, el } from './style.ts';
import { pixIcon } from './icons.ts';

const SAGOMA_OK = '#B6FF3D';

const CSS = `
#mzModificaIsolaBtn {
  position: absolute;
  left: 50%;
  top: calc(max(8px, env(safe-area-inset-top)) + 60px);
  transform: translateX(-50%);
  display: none;
  min-height: 44px;
  padding: 0 16px;
  background: ${PAL.arancio};
  color: ${PAL.neroCaldo};
  border: 3px solid ${PAL.neroCaldo};
  box-shadow: 0 4px 0 ${PAL.neroCaldo};
  font: bold 15px ui-monospace, Menlo, monospace;
  z-index: 15;
  cursor: pointer;
  align-items: center;
  gap: 8px;
  user-select: none;
}
#mzModificaIsolaBtn.on { display: flex; }
body.mz-edit-mode #compass, body.mz-edit-mode #mzCompass, body.mz-edit-mode #mzTouch, body.mz-edit-mode #mzBtnA, body.mz-edit-mode #mzBtnB, body.mz-edit-mode #mzMini, body.mz-edit-mode #mzTop, body.mz-edit-mode #mzBar, body.mz-edit-mode #mzWork, body.mz-edit-mode #mzGuida, body.mz-edit-mode #toast, body.mz-edit-mode .mz-label, body.mz-edit-mode .mz-cartello {
  display: none !important;
}
#mzModificaOverlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: none;
  pointer-events: none;
  z-index: 25;
}
#mzModificaOverlay.on { display: block; }
#mzModificaTopBar {
  position: absolute;
  top: max(8px, env(safe-area-inset-top));
  left: 8px; right: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: auto;
  gap: 8px;
}
#mzModificaTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(31, 22, 16, 0.95);
  border: 2px solid ${PAL.legnoChiaro};
  padding: 6px 12px;
  color: ${PAL.giallo};
  font: bold 14px ui-monospace, Menlo, monospace;
  box-shadow: 0 3px 0 ${PAL.neroCaldo};
}
.mz-mod-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mz-mod-btn {
  min-height: 44px;
  padding: 0 12px;
  border: 2px solid ${PAL.neroCaldo};
  box-shadow: 0 3px 0 ${PAL.neroCaldo};
  font: bold 14px ui-monospace, Menlo, monospace;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.mz-mod-btn.riponi-tutto {
  background: ${PAL.legnoScuro};
  color: ${PAL.sabbiaChiara};
  border-color: ${PAL.legnoChiaro};
}
.mz-mod-btn.annulla {
  background: ${PAL.rosso};
  color: #FFFFFF;
}
.mz-mod-btn.salva {
  background: ${SAGOMA_OK};
  color: ${PAL.neroCaldo};
}
@media (max-width: 600px) {
  #mzModificaTitle {
    display: none;
  }
  .mz-mod-actions {
    width: 100%;
    justify-content: space-between;
  }
  .mz-mod-btn {
    padding: 0 8px;
    font-size: 13px;
  }
}
#mzModificaSelBar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 125px;
  display: none;
  align-items: center;
  gap: 10px;
  background: rgba(31, 22, 16, 0.95);
  border: 2px solid ${PAL.giallo};
  padding: 8px 14px;
  box-shadow: 0 4px 0 ${PAL.neroCaldo};
  pointer-events: auto;
  z-index: 26;
}
#mzModificaSelBar.on { display: flex; }
#mzModificaSelNome {
  color: ${PAL.sabbiaChiara};
  font: bold 14px ui-monospace, Menlo, monospace;
  white-space: nowrap;
}
#mzModificaTray {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 115px;
  background: rgba(25, 17, 12, 0.96);
  border-top: 3px solid ${PAL.legnoScuro};
  padding: 6px 10px max(6px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: auto;
  box-sizing: border-box;
  z-index: 26;
}
#mzModificaTrayHeader {
  color: ${PAL.giallo};
  font: bold 12px ui-monospace, Menlo, monospace;
  display: flex;
  justify-content: space-between;
}
#mzModificaTrayCards {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
  align-items: center;
  padding-bottom: 2px;
}
.mz-tray-card {
  min-width: 90px;
  height: 70px;
  background: ${PAL.legnoScuro};
  border: 2px solid ${PAL.legnoChiaro};
  color: ${PAL.sabbiaChiara};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  box-sizing: border-box;
  text-align: center;
  font: bold 12px ui-monospace, Menlo, monospace;
  gap: 2px;
  flex-shrink: 0;
}
.mz-tray-card.selected {
  border-color: ${SAGOMA_OK};
  background: #473020;
}
.mz-tray-card .level {
  font-size: 11px;
  color: ${PAL.giallo};
}
.mz-tray-vuoto {
  color: ${PAL.sabbia};
  font: italic 13px ui-monospace, Menlo, monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
`;

export type ModificaUiCallbacks = {
  onOpen: () => void;
  onRiponiTutto: () => void;
  onAnnulla: () => void;
  onSalva: () => void;
  onGira: () => void;
  onRiponi: () => void;
  onSelectTrayItem: (id: string) => void;
};

export type ModificaUi = {
  setButtonVisible(show: boolean): void;
  setOverlayVisible(show: boolean): void;
  updateSelection(b: PlacedBuilding | null): void;
  updateTray(mag: readonly StoredBuilding[], selectedId: string | null): void;
  dispose(): void;
};

export function createModificaIsolaUi(root: HTMLElement, cb: ModificaUiCallbacks): ModificaUi {
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  const btn = el('button', 'mz', '');
  btn.id = 'mzModificaIsolaBtn';
  btn.type = 'button';
  btn.append(pixIcon('martello', 18), el('span', '', 'MODIFICA DISPOSIZIONE'));
  btn.addEventListener('click', cb.onOpen);
  root.appendChild(btn);

  const overlay = el('div', 'mz');
  overlay.id = 'mzModificaOverlay';
  root.appendChild(overlay);

  const topBar = el('div', 'mz');
  topBar.id = 'mzModificaTopBar';
  const titleBox = el('div', '', '');
  titleBox.id = 'mzModificaTitle';
  titleBox.append(pixIcon('martello', 16), el('span', '', 'MODIFICA DISPOSIZIONE'));

  const actionsBox = el('div', 'mz-mod-actions');
  const btnRiponiTutto = el('button', 'mz-mod-btn riponi-tutto', 'RIPONI TUTTO');
  btnRiponiTutto.type = 'button';
  btnRiponiTutto.addEventListener('click', cb.onRiponiTutto);

  const btnAnnulla = el('button', 'mz-mod-btn annulla', 'ANNULLA');
  btnAnnulla.type = 'button';
  btnAnnulla.addEventListener('click', cb.onAnnulla);

  const btnSalva = el('button', 'mz-mod-btn salva', 'SALVA');
  btnSalva.type = 'button';
  btnSalva.addEventListener('click', cb.onSalva);

  actionsBox.append(btnRiponiTutto, btnAnnulla, btnSalva);
  topBar.append(titleBox, actionsBox);
  overlay.appendChild(topBar);

  const selBar = el('div', 'mz');
  selBar.id = 'mzModificaSelBar';
  const selNome = el('span', '', '');
  selNome.id = 'mzModificaSelNome';

  const btnGira = el('button', 'mz-mod-btn gira', 'GIRA ↻');
  btnGira.type = 'button';
  btnGira.addEventListener('click', cb.onGira);

  const btnRiponi = el('button', 'mz-mod-btn riponi', 'RIPONI ⬆');
  btnRiponi.type = 'button';
  btnRiponi.addEventListener('click', cb.onRiponi);

  selBar.append(selNome, btnGira, btnRiponi);
  overlay.appendChild(selBar);

  const tray = el('div', 'mz');
  tray.id = 'mzModificaTray';
  const trayHeader = el('div', '', '');
  trayHeader.id = 'mzModificaTrayHeader';
  trayHeader.append(el('span', '', 'MAGAZZINO COSTRUZIONI'));
  const trayCards = el('div', '');
  trayCards.id = 'mzModificaTrayCards';
  tray.append(trayHeader, trayCards);
  overlay.appendChild(tray);

  return {
    setButtonVisible(show: boolean) {
      btn.classList.toggle('on', show);
    },
    setOverlayVisible(show: boolean) {
      overlay.classList.toggle('on', show);
      document.body.classList.toggle('mz-edit-mode', show);
    },
    updateSelection(b: PlacedBuilding | null) {
      if (b && b.building !== 'molo') {
        const def = buildingDef(b.building);
        selNome.textContent = `${def.nome} (Liv. ${b.level})${b.rot ? ` · rot ${b.rot * 90}°` : ''}`;
        selBar.classList.add('on');
      } else {
        selBar.classList.remove('on');
      }
    },
    updateTray(mag: readonly StoredBuilding[], selectedId: string | null) {
      trayCards.replaceChildren();
      if (!mag.length) {
        trayCards.appendChild(el('div', 'mz-tray-vuoto', 'Nessuna costruzione in magazzino.'));
        return;
      }
      for (const b of mag) {
        const def = buildingDef(b.building);
        const card = el('div', 'mz-tray-card' + (selectedId === b.id ? ' selected' : ''));
        card.dataset['id'] = b.id;
        card.append(
          el('span', '', def.nome),
          el('span', 'level', `Liv. ${b.level}`),
        );
        card.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          cb.onSelectTrayItem(b.id);
        });
        trayCards.appendChild(card);
      }
    },
    dispose() {
      btn.remove();
      overlay.remove();
      styleEl.remove();
      document.body.classList.remove('mz-edit-mode');
    },
  };
}
