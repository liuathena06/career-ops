import test from 'node:test';
import assert from 'node:assert/strict';
import { runControlledLiepinSearches } from '../lib/founder-liepin-batch-search.mjs';

test('Liepin searches run with a two-process ceiling and retain intent order', async () => {
  let active = 0;
  let peak = 0;
  const intents = [0, 1, 2, 3];
  const batch = await runControlledLiepinSearches(intents, async (intent) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, intent === 0 ? 20 : 5));
    active -= 1;
    return intent * 10;
  });
  assert.equal(peak, 2);
  assert.equal(batch.concurrency, 2);
  assert.deepEqual(batch.results, [0, 10, 20, 30]);
  assert.equal(batch.searchDurationsMs.length, 4);
  assert.ok(batch.searchDurationsMs.every((ms) => Number.isInteger(ms) && ms >= 0));
  assert.ok(batch.totalMs < batch.searchDurationsMs.reduce((sum, ms) => sum + ms, 0));
});

test('search failure prevents pending searches from starting', async () => {
  const started = [];
  await assert.rejects(runControlledLiepinSearches([0, 1, 2, 3], async (intent) => {
    started.push(intent);
    if (intent === 0) throw new Error('search failed');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }), /search failed/u);
  assert.deepEqual(started, [0, 1]);
});
