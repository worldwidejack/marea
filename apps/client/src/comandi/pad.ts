type Vettore = { x: number; y: number };
export const padStato = {
  mov: { x: 0, y: 0 } as Vettore, mira: { x: 0, y: 0 } as Vettore,
  nome: '', attivo: false, aspetta: null as ((b: number) => void) | null,
};
export const delPad = new WeakSet<Event>();
const ascoltatori = new Set<() => void>();

export const padMovimento = (): Vettore => padStato.mov;
export const padMira = (): Vettore => padStato.mira;
export const padInUso = (): boolean => padStato.attivo;
export const padCollegato = (): string | null => padStato.nome || null;
export const eDelPad = (e: Event): boolean => delPad.has(e);
export const aspettaPulsante = (cb: ((b: number) => void) | null): void => { padStato.aspetta = cb; };
export const cambiaPad = (f: () => void): (() => void) => { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; };
export const notificaPad = (): void => { ascoltatori.forEach((f) => f()); };

export function controller(): Gamepad | undefined {
  try { return Array.from(navigator.getGamepads?.() ?? []).find((g): g is Gamepad => !!g?.connected); } catch { return undefined; }
}

export function avviaPad(): void {
  const carica = () => { void import('./pad_lettura.ts').then((m) => m.avviaLettura()); };
  if (controller()) carica();
  else addEventListener('gamepadconnected', carica, { once: true });
}
