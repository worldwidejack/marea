// I tasti «liberi» del mondo: O foto, C look, F novità, M mappa, + e − zoom della mappa, J diario, I eroe, G ruota delle emote, 1-8 emote.
// Un solo listener in bubble: i pannelli aperti fermano il keydown in capture, quindi qui arrivano solo i tasti che nessuno ha preso.
import { AVATAR } from '@marea/content';
import type { EmoteId } from '@marea/protocol';
import type { Registro } from './registro.ts';

type Pannello = { isOpen(): boolean; open(): void; close(): void };

export function collegaTasti(o: {
  reg: Registro;
  foto: { open(): void };
  editor: Pannello | null; feed: Pannello | null; eroe: Pannello | null; diario: Pannello;
  mappa: () => { toggle(): void; zoom(d: number): void } | null;
  emotes: { wheelOpen: boolean; closeWheel(): void; toggleWheel(): void; play(id: EmoteId): void };
  apriEditor(): boolean; apriFeed(): boolean;
}): void {
  const { reg, editor, feed, eroe, diario, emotes } = o;
  const EMOTES = AVATAR.emote as EmoteId[];
  const scrive = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  addEventListener('keydown', (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyO' && !scrive(e)) { o.foto.open(); return; } // modalità foto: dentro, O ed Esc escono (ui/foto_ui.ts)
    if (e.code === 'KeyC') { if (editor?.isOpen()) editor.close(); else o.apriEditor(); return; }
    if (e.code === 'KeyF') { if (feed?.isOpen()) feed.close(); else o.apriFeed(); return; }
    if (e.code === 'KeyM') { if (!reg.occupato()) o.mappa()?.toggle(); return; }
    const zoom = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' ? 1 : e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' ? -1 : 0; // `key`: vale anche la tastiera italiana
    if (zoom && !scrive(e)) { if (!reg.occupato()) o.mappa()?.zoom(zoom); return; }
    if (e.code === 'KeyJ') { if (diario.isOpen()) diario.close(); else if (!reg.occupato()) { editor?.close(); feed?.close(); eroe?.close(); diario.open(); } return; }
    if (e.code === 'KeyI') { if (eroe?.isOpen()) eroe.close(); else if (eroe && !reg.occupato()) { editor?.close(); feed?.close(); eroe.open(); } return; }
    if (e.code === 'KeyG') { if (emotes.wheelOpen) emotes.closeWheel(); else if (!reg.occupato() && !editor?.isOpen() && !feed?.isOpen()) emotes.toggleWheel(); return; }
    const m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
    if (m && !reg.occupato() && !editor?.isOpen() && !feed?.isOpen()) { const id = EMOTES[Number(m[1]) - 1]; if (id) emotes.play(id); }
  });
}
