import { stageClock, elapsedMs } from './founder-stage-timing.mjs';

/** Two read-only CLI processes at most; results retain Search Strategy order. */
export async function runControlledLiepinSearches(intents, run, { concurrency = 2 } = {}) {
  if (!Array.isArray(intents) || typeof run !== 'function' || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) {
    throw new Error('Invalid Liepin search batch');
  }
  const results = new Array(intents.length);
  const searchDurationsMs = new Array(intents.length);
  let next = 0;
  let failure = null;
  const started = stageClock();
  async function worker() {
    while (!failure && next < intents.length) {
      const index = next++;
      const searchStarted = stageClock();
      try { results[index] = await run(intents[index], index); }
      catch (error) { failure ??= error; }
      finally { searchDurationsMs[index] = elapsedMs(searchStarted); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, intents.length) }, worker));
  if (failure) throw failure;
  return { results, searchDurationsMs, totalMs: elapsedMs(started), concurrency };
}
