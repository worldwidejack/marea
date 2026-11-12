import { FONT_LIBRO, LIBRO as L } from '../ui/libro_colori.ts';

const TESTO = 'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="password"], input[type="tel"], input[type="email"], input[type="url"]';

export function apriTastiera(e: HTMLElement): boolean {
  if (!e.matches(TESTO) || e.matches('[readonly]')) return false;
  const campo = e as HTMLInputElement | HTMLTextAreaElement, doc = campo.ownerDocument;
  const box = doc.createElement('div'); box.dataset['padMenu'] = '';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Tastiera su schermo');
  box.style.cssText = 'position:fixed;z-index:10001;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);box-sizing:border-box;width:min(500px,calc(100% - 20px));padding:8px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;border:3px solid ' + L.oro + ';background:' + L.carta;
  const valore = doc.createElement('div'); valore.setAttribute('role', 'status');
  valore.style.cssText = 'grid-column:1/-1;min-height:32px;overflow-wrap:anywhere;color:' + L.inchiostro + ';font:700 16px ' + FONT_LIBRO;
  const segreto = campo.matches('[type="password"]');
  let testo = campo.value, maiuscolo = false;
  const mostra = () => { valore.textContent = (segreto ? '•'.repeat(testo.length) : testo) + '▏'; };
  const bottone = (nome: string, fn: () => void) => {
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = nome;
    b.style.cssText = 'min-height:44px;padding:0;cursor:pointer;border:1px solid ' + L.oro + ';background:' + L.cartaChiara + ';color:' + L.inchiostro + ';font:700 16px ' + FONT_LIBRO;
    b.addEventListener('click', fn); return b;
  };
  const aggiungi = (c: string) => {
    if (campo.maxLength >= 0 && testo.length + c.length > campo.maxLength) return;
    testo += c; mostra();
  };
  box.append(valore);
  const lettere = [...'abcdefghijklmnopqrstuvwxyzàèéìòù0123456789-_.@'].map((c) => bottone(c, () => aggiungi(maiuscolo ? c.toUpperCase() : c)));
  box.append(...lettere, bottone('Spazio', () => aggiungi(' ')), bottone('⌫', () => { testo = testo.slice(0, -1); mostra(); }),
    bottone('↑', () => {
      maiuscolo = !maiuscolo;
      for (const b of lettere) b.textContent = maiuscolo ? b.textContent.toUpperCase() : b.textContent.toLowerCase();
    }));
  const annulla = bottone('Annulla', () => box.remove()); annulla.dataset['padBack'] = '';
  const fatto = bottone('Fatto', () => {
    box.remove(); campo.value = testo;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  });
  box.append(annulla, fatto); mostra(); doc.body.append(box);
  return true;
}
