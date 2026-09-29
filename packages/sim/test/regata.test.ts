import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regata } from '../src/minigames/regata/regata.ts';
import { createRng } from '../src/rng.ts';
import { packInputs, replay, quantize } from '../src/replay.ts';
import type { InputFrame } from '../src/types.ts';

test('regata: l’autopilot finisce e il replay dà lo stesso punteggio', () => {
  const s = regata.create({ seed: 123, difficulty: 1 });
  const rng = createRng(1);
  const log: InputFrame[] = [];
  while (!s.done && s.tick < regata.maxTicks) {
    const f = quantize(regata.autopilot(s, rng));
    log.push(f);
    regata.step(s, f);
  }
  const r = regata.result(s);
  assert.ok(r.done);
  assert.ok(r.detail['boe'] === r.detail['tot'], `boe ${r.detail['boe']}/${r.detail['tot']}`);
  const again = replay('regata', 123, 1, packInputs(log));
  assert.equal(again.score, r.score);
  assert.ok(log.length > 60);
});
