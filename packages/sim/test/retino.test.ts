// Il retino di Borgo Marea: macchina a stati del colpo (A tenuto carica, al rilascio parte, il personaggio sta fermo fino alla risalita),
// pose chiave (la rete arriva a terra), presa (si prende solo ciò che entra nella rete) e passo ridotto da carico. Il codice del retino
// sta nel client ma non usa three: gira anche qui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '@marea/content';
import { INSETTI, RETINO } from '@marea/content/insetti.ts';
import { parseIsland } from '../src/world/grid.ts';
import { newAvatar, stepAvatar } from '../src/world/avatar.ts';
import { nuovoAttore, vive } from '../../../apps/client/src/game/insetti_vita.ts';
import { creaAzioneRetino } from '../../../apps/client/src/game/retino_azione.ts';
import type { AzioneRetino, EventoRetino } from '../../../apps/client/src/game/retino_azione.ts';
import { IMPATTO, posaRetino } from '../../../apps/client/src/game/retino_chiavi.ts';
import type { PosaRetino } from '../../../apps/client/src/game/retino_chiavi.ts';
import { capsulaRete, centroRete, daAvatar, dalModello, posaDaMano, presaLungo } from '../../../apps/client/src/game/retino_presa.ts';
import type { Punto } from '../../../apps/client/src/game/retino_presa.ts';

const { uso, rete } = RETINO;
const DT = 1 / 60;
/** Avanza l'azione di `s` secondi a passi da un frame; ritorna gli eventi con l'istante in cui sono successi. */
function corri(a: AzioneRetino, s: number): { e: EventoRetino; t: number }[] {
  const out: { e: EventoRetino; t: number }[] = [];
  for (let t = 0; t < s - 1e-9; t += DT) for (const e of a.passo(DT)) out.push({ e, t: t + DT });
  return out;
}

test('retino: A tenuto carica e il personaggio cammina; al rilascio parte il colpo e sta fermo fino alla risalita', () => {
  const a = creaAzioneRetino(uso);
  assert.equal(a.fase, 'guardia'); assert.equal(a.occupato(), false); assert.equal(a.fermo(), false);
  a.premi(true);
  assert.equal(a.fase, 'carica'); assert.equal(a.occupato(), true); assert.equal(a.fermo(), false, 'caricando si cammina');
  corri(a, uso.caricaS * 0.5);
  assert.ok(a.carica > 0.4 && a.carica < 0.6, 'la carica sale col tempo: ' + a.carica);
  corri(a, 2);
  assert.equal(a.carica, 1, 'tenuto a lungo resta carico al massimo');
  assert.equal(a.fase, 'carica');
  a.premi(false);
  assert.equal(a.fase, 'colpo'); assert.equal(a.fermo(), true);
  const ev = corri(a, uso.fendenteS + uso.impattoS + uso.lagS + uso.risalitaS + 0.1);
  assert.deepEqual(ev.map((x) => x.e), ['fendente', 'impatto', 'fine'], 'carico del tutto: il fendente parte subito');
  assert.ok(Math.abs(ev[0]!.t - DT) < 1e-6, 'il fendente parte al primo frame dopo il rilascio');
  assert.ok(ev[1]!.t >= uso.fendenteS - 1e-6 && ev[1]!.t < uso.fendenteS + 2 * DT, 'a terra dopo il fendente: ' + ev[1]!.t);
  assert.ok(ev[2]!.t >= uso.fendenteS + uso.impattoS + uso.lagS + uso.risalitaS - 1e-6, 'il personaggio si libera solo a risalita finita');
  assert.equal(a.fase, 'guardia'); assert.equal(a.fermo(), false); assert.equal(a.carica, 0);
});

test('retino: un tocco veloce completa la carica prima del fendente; tenere A dopo il colpo non ne fa partire un altro', () => {
  const a = creaAzioneRetino(uso);
  a.premi(true); a.premi(false);
  assert.equal(a.colpo?.fase, 'avvio');
  assert.ok(a.colpo!.durata >= uso.avvioS - 1e-9);
  const ev = corri(a, 3);
  assert.deepEqual(ev.map((x) => x.e), ['fendente', 'impatto', 'fine']);
  assert.ok(ev[0]!.t >= uso.avvioS - 1e-6, 'il tocco non salta il caricamento');
  // premuto di nuovo mentre il colpo gira, e ancora giù alla fine: serve rilasciare e premere
  a.premi(true); a.premi(false); a.premi(true);
  corri(a, 3);
  assert.equal(a.colpo, null);
  a.premi(true); a.premi(true);
  a.premi(false); a.premi(true);
  assert.notEqual(a.fase, 'guardia', 'rilasciato e ripremuto: carica di nuovo');
});

test('retino: annulla riporta in guardia; durante il colpo A non fa niente', () => {
  const a = creaAzioneRetino(uso);
  a.premi(true); corri(a, 0.1); a.annulla();
  assert.equal(a.fase, 'guardia'); assert.equal(a.colpo, null); assert.equal(a.carica, 0);
  // dopo annulla, premere A di nuovo carica subito senza bisogno di un rilascio fittizio
  a.premi(true);
  assert.equal(a.fase, 'carica');
  a.premi(false);
  assert.equal(a.fermo(), true);
  a.premi(true); a.premi(false);
  assert.deepEqual(corri(a, 3).map((x) => x.e), ['fendente', 'impatto', 'fine'], 'un solo colpo');
});

/** La posa del retino nel mondo per un avatar fermo in (0, 0) con la prua −z. */
function retinoIn(p: PosaRetino) {
  const m = daAvatar(0, 0, 0, p.hx, p.hz);
  return posaDaMano({ x: m.x, y: p.hy, z: m.z }, -p.giro, p.pitch, p.roll);
}
const anello = (p: PosaRetino): Punto[] => {
  const r = retinoIn(p);
  return Array.from({ length: 24 }, (_, i) => { const t = (i / 24) * Math.PI * 2; return dalModello(r, Math.cos(t) * rete.raggio, centroRete(rete) + Math.sin(t) * rete.raggio, 0); });
};

test('retino: all’impatto la rete è a terra davanti a te con la bocca in giù; in carica sta dietro; sopra la testa passa alta', () => {
  const imp = anello(IMPATTO), minY = Math.min(...imp.map((q) => q.y));
  assert.ok(minY > -0.08 && minY < 0.1, 'il bordo della rete tocca il prato: ' + minY.toFixed(3));
  const c = dalModello(retinoIn(IMPATTO), 0, centroRete(rete), 0);
  assert.ok(c.z < -1.0 && c.z > -2.0, 'la rete cade a 1-2 m davanti: ' + c.z.toFixed(2));
  assert.ok(Math.abs(c.x) < 0.1, 'nella direzione in cui guardi: ' + c.x.toFixed(2));
  const carico = dalModello(retinoIn(posaRetino({ fase: 'carica', carica: 1, colpo: null })), 0, centroRete(rete), 0);
  assert.ok(carico.z > 0.5, 'da carico la rete sta dietro la schiena: ' + carico.z.toFixed(2));
  // il fendente passa sopra la testa e poi scende a terra davanti
  let alto = 0;
  for (let i = 0; i <= 40; i++) {
    const q = dalModello(retinoIn(posaRetino({ fase: 'colpo', carica: 1, colpo: { fase: 'fendente', t: (i / 40) * uso.fendenteS, durata: uso.fendenteS, da: 1 } })), 0, centroRete(rete), 0);
    alto = Math.max(alto, q.y);
  }
  assert.ok(alto > 1.9, 'la rete passa sopra la testa: ' + alto.toFixed(2));
});

test('retino: si prende solo ciò che entra nella rete', () => {
  const imp = capsulaRete(retinoIn(IMPATTO), rete);
  const dove = dalModello(retinoIn(IMPATTO), 0, centroRete(rete), 0);
  const insetto = (dx: number, dz: number, y = 0.1): Punto => ({ x: dove.x + dx, y, z: dove.z + dz });
  assert.ok(presaLungo(null, imp, insetto(0, 0), rete.corpo), 'sotto il centro della rete');
  assert.ok(presaLungo(null, imp, insetto(rete.raggio * 0.8, 0), rete.corpo), 'dentro il cerchio');
  assert.ok(!presaLungo(null, imp, insetto(1.2, 0), rete.corpo), 'lontano di lato');
  assert.ok(!presaLungo(null, imp, insetto(0, 1.3), rete.corpo), 'più vicino a te della rete');
  assert.ok(!presaLungo(null, imp, { x: 0, y: 0.1, z: 0.3 }, rete.corpo), 'alle tue spalle');
  assert.ok(!presaLungo(null, imp, { x: 0, y: 0.1, z: -0.5 }, rete.corpo), 'ai tuoi piedi');
  assert.ok(!presaLungo(null, imp, insetto(0, 0, 1.2), rete.corpo), 'in aria sopra la rete a terra');
  // la rete che scende prende anche chi sta in aria sul suo percorso, anche se un frame la sposta di mezzo metro
  let prima = null, preso = false;
  const volo: Punto = { x: 0.2, y: 1.2, z: -1.55 };
  for (let i = 0; i <= 12 && !preso; i++) {
    const cap = capsulaRete(retinoIn(posaRetino({ fase: 'colpo', carica: 1, colpo: { fase: 'fendente', t: (i / 12) * uso.fendenteS, durata: uso.fendenteS, da: 1 } })), rete);
    preso = presaLungo(prima, cap, volo, rete.corpo); prima = cap;
  }
  assert.ok(preso, 'un volante sul percorso della rete');
  // un frame solo molto lungo (poco fps) non fa saltare la rete oltre l'insetto
  const a = capsulaRete(retinoIn(posaRetino({ fase: 'colpo', carica: 1, colpo: { fase: 'fendente', t: 0.4 * uso.fendenteS, durata: uso.fendenteS, da: 1 } })), rete);
  assert.ok(presaLungo(a, imp, volo, rete.corpo) || presaLungo(a, imp, { x: 0.2, y: 0.6, z: -1.5 }, rete.corpo), 'tra due frame lontani la rete tocca ciò che attraversa');
});

test('avatar: da carico il passo è una frazione, la direzione resta', () => {
  const map = parseIsland({ id: 't', nome: 't', tile: 2, rows: ['~~~~~~~~~~~~', '~gggggggggg~', '~gggggggggg~', '~gggggggggg~', '~gPggggggdd~', '~~~~~~~~~B~~'] });
  const f = { mx: 0.5, my: 0, a: false, b: false };
  let n = newAvatar(3, 5), p = newAvatar(3, 5);
  for (let i = 0; i < 20; i++) { n = stepAvatar(n, f, map); p = stepAvatar(p, f, map, undefined, uso.passoCarico); }
  assert.ok(Math.abs((p.x - 3) / (n.x - 3) - uso.passoCarico) < 0.02, `${p.x} vs ${n.x}`);
  assert.equal(p.anim, 'walk');
  assert.ok(Math.abs(n.vx - BALANCE.avatar.camminata) < 1e-3 && Math.abs(p.vx - BALANCE.avatar.camminata * uso.passoCarico) < 1e-3);
});

test('retino: da carico gli insetti si accorgono di te da molto più vicino, ma non da zero', () => {
  const mondo = { terra: () => true, y: () => 0 };
  const stato = (id: string, distanza: number, furtivo?: number) => {
    const def = INSETTI.find((i) => i.id === id)!, a = nuovoAttore('t', def, 0, 0, 0.3);
    vive(a, { x: 0, z: distanza, v: 1, corre: false, fermoDa: 0, retino: true, furtivo }, DT, mondo);
    return a.stato;
  };
  // il carabo (allerta 3 m) scappa da chi cammina a 2 m; da carico no, ma a 0,9 m sì
  assert.equal(stato('carabo', 2), 'scappa');
  assert.equal(stato('carabo', 2, uso.furtivoCarico), 'giro');
  assert.equal(stato('carabo', 0.9, uso.furtivoCarico), 'scappa');
  // la cavolaia (volante) si spaventa di chi cammina a mezzo metro; da carico solo molto più vicino
  assert.equal(stato('cavolaia', 0.5), 'scappa');
  assert.equal(stato('cavolaia', 0.5, uso.furtivoCarico), 'giro');
  assert.equal(stato('cavolaia', 0.15, uso.furtivoCarico), 'scappa');
});
