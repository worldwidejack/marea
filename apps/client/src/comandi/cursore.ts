import { LIBRO as L } from '../ui/libro_colori.ts';

let doc: Document | null = null, punto: HTMLElement | null = null, bersaglio: Element | null = null;
let x = 0, y = 0, ultimo = 0, trascinato = false;
const ID = 49;

function invia(e: Element, tipo: string, premuto: boolean): boolean {
  return e.dispatchEvent(new PointerEvent(tipo, {
    pointerId: ID, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true,
    button: tipo === 'pointermove' ? -1 : 0, buttons: premuto ? 1 : 0, clientX: x, clientY: y,
  }));
}

export function clicCursore(premuto: boolean): void {
  if (premuto && doc) {
    bersaglio = doc.elementFromPoint(x, y);
    trascinato = false;
    if (bersaglio) invia(bersaglio, 'pointerdown', true);
  } else if (bersaglio) {
    invia(bersaglio, 'pointerup', false);
    if (!trascinato && doc?.elementFromPoint(x, y) === bersaglio) {
      bersaglio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: x, clientY: y }));
    }
    bersaglio = null;
  }
}

export function rotellaCursore(passo: number): void {
  doc?.elementFromPoint(x, y)?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: passo * 100 }));
}

export function annullaCursore(): void {
  if (bersaglio) invia(bersaglio, 'pointercancel', false);
  bersaglio = null; punto?.remove(); punto = null; doc = null;
}

export function muoviCursore(d: Document, vx: number, vy: number, ora: number, mostra = false): void {
  const w = d.defaultView;
  if (!w) return;
  if (d !== doc) {
    annullaCursore(); doc = d; x = w.innerWidth / 2; y = w.innerHeight / 2; ultimo = ora;
  }
  if (!punto && (vx || vy || mostra)) {
    punto = d.createElement('div'); punto.setAttribute('aria-hidden', 'true'); punto.dataset['padCursore'] = '';
    punto.style.cssText = `position:fixed;z-index:10000;pointer-events:none;width:13px;height:13px;border:2px solid ${L.cartaChiara};background:${L.acqua};border-radius:50%;box-shadow:0 0 0 2px ${L.inchiostro};transform:translate(-50%,-50%);`;
    d.body.append(punto);
  }
  const passo = Math.min(0.05, (ora - ultimo) / 1000) * 650; ultimo = ora;
  x = Math.max(1, Math.min(w.innerWidth - 2, x + vx * passo));
  y = Math.max(1, Math.min(w.innerHeight - 2, y + vy * passo));
  if (punto) { punto.style.left = x + 'px'; punto.style.top = y + 'px'; }
  if (vx || vy) {
    const e = bersaglio ?? d.elementFromPoint(x, y);
    if (e) invia(e, 'pointermove', !!bersaglio);
    if (bersaglio) trascinato = true;
  }
}
