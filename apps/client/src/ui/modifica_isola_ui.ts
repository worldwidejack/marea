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
body.mz-edit-mode #ui > :not(#mzModificaOverlay):not(#toast) {
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
  font: bold 13px ui-monospace, Menlo, monospace;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  user-select: none;
  white-space: nowrap;
  touch-action: manipulation;
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
.mz-mod-btn.gira {
  background: ${PAL.giallo};
  color: ${PAL.neroCaldo};
}
.mz-mod-btn.riponi {
  background: ${PAL.arancio};
  color: ${PAL.neroCaldo};
}
#mzModificaSelBar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 112px;
  display: none;
  align-items: center;
  gap: 8px;
  background: rgba(31, 22, 16, 0.96);
  border: 2px solid ${PAL.giallo};
  padding: 6px 12px;
  box-shadow: 0 4px 0 ${PAL.neroCaldo};
  pointer-events: auto;
  z-index: 26;
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
}
#mzModificaSelBar.on { display: flex; }
#mzModificaSelNome {
  color: ${PAL.sabbiaChiara};
  font: bold 13px ui-monospace, Menlo, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 54vw;
}
#mzModificaTray {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 104px;
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
  font: bold 11px ui-monospace, Menlo, monospace;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#mzModificaTrayHint {
  color: ${PAL.sabbia};
  font-weight: normal;
  font-size: 11px;
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
  min-width: 82px;
  height: 62px;
  background: ${PAL.legnoScuro};
  border: 2px solid ${PAL.legnoChiaro};
  color: ${PAL.sabbiaChiara};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  touch-action: none;
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
  box-shadow: 0 0 0 2px ${SAGOMA_OK};
}
.mz-tray-card .level {
  font-size: 11px;
  color: ${PAL.giallo};
}
.mz-tray-vuoto {
  color: ${PAL.sabbia};
  font: italic 12px ui-monospace, Menlo, monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
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
    min-height: 44px;
    padding: 0 10px;
    font-size: 12px;
  }
  #mzModificaSelBar {
    bottom: 106px;
    padding: 6px 10px;
    gap: 6px;
  }
  #mzModificaTray {
    height: 100px;
  }
}
@media (max-height: 500px) {
  #mzModificaTopBar {
    top: max(4px, env(safe-area-inset-top));
  }
  #mzModificaTitle {
    padding: 4px 10px;
    font-size: 12px;
  }
  .mz-mod-btn {
    min-height: 44px;
    padding: 0 10px;
    font-size: 12px;
  }
  #mzModificaTray {
    height: 82px;
    padding: 4px 10px max(4px, env(safe-area-inset-bottom));
    gap: 2px;
  }
  .mz-tray-card {
    height: 50px;
    min-width: 78px;
    font-size: 11px;
  }
  #mzModificaSelBar {
    bottom: 86px;
    padding: 4px 10px;
  }
}
`;

export type ModificaUiCallbacks = {
  onOpen: () => void;
  onRiponiTutto: () => void;
  onAnnulla: () => void;
  onSalva: () => void;
  onGira: () => void;
  onRiponi: () => void;
  onSelectTrayItem: (id: string, e: PointerEvent) => void;
};

export type ModificaUi = {
  setButtonVisible(show: boolean): void;
  setOverlayVisible(show: boolean): void;
  updateSelection(b: PlacedBuilding | null, stored?: StoredBuilding | null): void;
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
  const trayHint = el('span', '', 'Tocca un edificio per spostarlo');
  trayHint.id = 'mzModificaTrayHint';
  trayHeader.append(el('span', '', 'MAGAZZINO COSTRUZIONI'), trayHint);
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
    updateSelection(b: PlacedBuilding | null, stored: StoredBuilding | null = null) {
      if (b && b.building !== 'molo') {
        const def = buildingDef(b.building);
        selNome.textContent = `${def.nome} (Liv. ${b.level})${b.rot ? ` · ${b.rot * 90}°` : ''}`;
        btnGira.style.display = '';
        btnRiponi.style.display = '';
        selBar.classList.add('on');
        trayHint.textContent = 'Trascina o tocca una cella libera';
      } else if (stored) {
        const def = buildingDef(stored.building);
        selNome.textContent = `Piazza ${def.nome} (Liv. ${stored.level}) · tocca l'isola`;
        btnGira.style.display = 'none';
        btnRiponi.style.display = 'none';
        selBar.classList.add('on');
        trayHint.textContent = 'Tocca una cella sull’isola per piazzare';
      } else {
        selBar.classList.remove('on');
        trayHint.textContent = 'Tocca un edificio per spostarlo';
      }
    },
    updateTray(mag: readonly StoredBuilding[], selectedId: string | null) {
      trayCards.replaceChildren();
      if (!mag.length) {
        trayCards.appendChild(el('div', 'mz-tray-vuoto', 'Magazzino vuoto — trascina qui un edificio per riporlo'));
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
          cb.onSelectTrayItem(b.id, e);
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
