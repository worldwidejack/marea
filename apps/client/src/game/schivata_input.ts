import { tieniPremuto } from '../ui/comandi_touch.ts';
import { FONT_LIBRO, LIBRO as L } from '../ui/kit.ts';

export function creaComandoSchivata(root: HTMLElement) {
  const b = document.createElement('button'); b.type = 'button'; b.id = 'btnSchiva';
  b.textContent = '↻'; b.title = 'Schiva (V)'; b.setAttribute('aria-label', 'Schiva (V)');
  b.style.cssText = `position:absolute;right:calc(max(18px,env(safe-area-inset-right,0px)) + 170px);bottom:calc(env(safe-area-inset-bottom,0px) + 84px);width:60px;height:60px;border-radius:50%;border:3px solid ${L.oro};background:${L.acqua};color:${L.cartaChiara};box-shadow:0 4px 0 ${L.inchiostro};font:700 32px ${FONT_LIBRO};touch-action:none;user-select:none;z-index:14;display:none;`;
  const label = document.createElement('small'); label.textContent = 'Schiva';
  label.style.cssText = `display:block;font:700 11px ${FONT_LIBRO};margin-top:-8px;`; b.append(label); root.append(b);
  let on = false, held = false, latch = false;
  const touch = tieniPremuto(b, { premi: () => { if (on) latch = true; }, finestra: true, ferma: true });
  const clear = () => { held = latch = false; touch.lascia(); };
  const kd = (e: KeyboardEvent) => {
    if (!on || e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))) return;
    e.preventDefault(); held = latch = true;
  };
  const ku = (e: KeyboardEvent) => { if (e.code === 'KeyV') held = false; };
  const visibility = () => { if (document.hidden) clear(); };
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
  return {
    set(onNow: boolean) { if (on === onNow) return; on = onNow; b.style.display = on ? 'block' : 'none'; if (!on) clear(); },
    sample() { const v = on && (held || latch || touch.giu); latch = false; return v; },
    clear,
    dispose() { clear(); touch.dispose(); b.remove(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); },
  };
}
