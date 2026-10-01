// Scacco in 3 (minigioco del Tavolo del Porto): il Nero è fermo, il Bianco fa N mosse di fila e alla fine il Re nero dev'essere in matto.
// Motore minimo: mosse legali senza arrocco né en passant (i problemi non ne hanno bisogno), promozione sempre a Donna.
// Il matto si giudica con le regole vere: Re nero sotto scacco e nessuna mossa legale del Nero (che può catturare o parare).
// Scacchiera = 64 caratteri in ordine FEN (casella 0 = a8, 63 = h1), '.' = vuota, maiuscole = Bianco.

export type Board = string[];
export type ChessMove = { from: number; to: number };

const N_DIRS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;
const K_DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
const R_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const B_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

const isWhite = (p: string) => p !== '.' && p === p.toUpperCase();
const isBlack = (p: string) => p !== '.' && p === p.toLowerCase();
const own = (p: string, white: boolean) => (white ? isWhite(p) : isBlack(p));
const at = (r: number, f: number) => (r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1);

export function parseFen(fen: string): Board {
  const b: Board = [];
  for (const ch of fen.split(' ')[0]!) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') for (let i = 0; i < Number(ch); i++) b.push('.');
    else b.push(ch);
  }
  if (b.length !== 64) throw new Error(`FEN non valida: ${fen}`);
  return b;
}

export function toFen(b: Board): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = '', e = 0;
    for (let f = 0; f < 8; f++) { const p = b[r * 8 + f]!; if (p === '.') e++; else { if (e) s += e; e = 0; s += p; } }
    rows.push(s + (e ? e : ''));
  }
  return rows.join('/');
}

/** Nome della casella: 0 → 'a8'. */
export const sqName = (sq: number) => 'abcdefgh'[sq % 8]! + String(8 - Math.floor(sq / 8));

/** La casella `sq` è attaccata da un pezzo del colore `byWhite`? */
export function attacked(b: Board, sq: number, byWhite: boolean): boolean {
  const r = Math.floor(sq / 8), f = sq % 8;
  const is = (s: number, kinds: string) => s >= 0 && own(b[s]!, byWhite) && kinds.includes(b[s]!.toLowerCase());
  // pedoni: il Bianco cattura verso l'alto (r-1), quindi attacca sq da r+1
  const pr = byWhite ? r + 1 : r - 1;
  if (is(at(pr, f - 1), 'p') || is(at(pr, f + 1), 'p')) return true;
  for (const [dr, df] of N_DIRS) if (is(at(r + dr, f + df), 'n')) return true;
  for (const [dr, df] of K_DIRS) if (is(at(r + dr, f + df), 'k')) return true;
  const ray = (dirs: readonly (readonly [number, number])[], kinds: string) => {
    for (const [dr, df] of dirs) {
      for (let i = 1; ; i++) {
        const s = at(r + dr * i, f + df * i);
        if (s < 0) break;
        if (b[s] !== '.') { if (is(s, kinds)) return true; break; }
      }
    }
    return false;
  };
  return ray(R_DIRS, 'rq') || ray(B_DIRS, 'bq');
}

export function inCheck(b: Board, white: boolean): boolean {
  const k = b.indexOf(white ? 'K' : 'k');
  return k >= 0 && attacked(b, k, !white);
}

function pseudo(b: Board, white: boolean): ChessMove[] {
  const out: ChessMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]!;
    if (!own(p, white)) continue;
    const r = Math.floor(sq / 8), f = sq % 8, k = p.toLowerCase();
    const push = (to: number) => { if (to >= 0 && !own(b[to]!, white)) out.push({ from: sq, to }); };
    if (k === 'p') {
      const dir = white ? -1 : 1, start = white ? 6 : 1;
      const one = at(r + dir, f);
      if (one >= 0 && b[one] === '.') {
        out.push({ from: sq, to: one });
        const two = at(r + 2 * dir, f);
        if (r === start && two >= 0 && b[two] === '.') out.push({ from: sq, to: two });
      }
      for (const df of [-1, 1]) { const c = at(r + dir, f + df); if (c >= 0 && own(b[c]!, !white)) out.push({ from: sq, to: c }); }
    } else if (k === 'n' || k === 'k') {
      for (const [dr, df] of k === 'n' ? N_DIRS : K_DIRS) push(at(r + dr, f + df));
    } else {
      const dirs = k === 'r' ? R_DIRS : k === 'b' ? B_DIRS : [...R_DIRS, ...B_DIRS];
      for (const [dr, df] of dirs) {
        for (let i = 1; ; i++) {
          const s = at(r + dr * i, f + df * i);
          if (s < 0) break;
          if (b[s] === '.') { out.push({ from: sq, to: s }); continue; }
          if (!own(b[s]!, white)) out.push({ from: sq, to: s });
          break;
        }
      }
    }
  }
  return out;
}

export function applyMove(b: Board, m: ChessMove): Board {
  const n = b.slice();
  let p = n[m.from]!;
  const r = Math.floor(m.to / 8);
  if (p === 'P' && r === 0) p = 'Q';
  if (p === 'p' && r === 7) p = 'q';
  n[m.to] = p; n[m.from] = '.';
  return n;
}

/** Mosse legali (non lasciano il proprio Re sotto scacco). */
export function legalMoves(b: Board, white: boolean): ChessMove[] {
  return pseudo(b, white).filter((m) => !inCheck(applyMove(b, m), white));
}

/** Matto al Re nero: sotto scacco e il Nero non ha mosse legali. */
export function isMate(b: Board): boolean {
  return inCheck(b, false) && legalMoves(b, false).length === 0;
}

/** Il Bianco, muovendo `left` volte di fila (Nero fermo), può dare matto? */
export function canMate(b: Board, left: number): boolean {
  if (isMate(b)) return true;
  if (left <= 0) return false;
  for (const m of legalMoves(b, true)) if (canMate(applyMove(b, m), left - 1)) return true;
  return false;
}

/** Meno mosse di fila per il matto (≤ max), o null. Con quante prime mosse diverse si arriva al matto in quel numero. */
export function solveMate(b: Board, max: number): { moves: number; keys: number } | null {
  for (let n = 1; n <= max; n++) {
    const keys = legalMoves(b, true).filter((m) => canMate(applyMove(b, m), n - 1)).length;
    if (keys > 0) return { moves: n, keys };
  }
  return null;
}
