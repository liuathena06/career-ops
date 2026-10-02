/** Elapsed time only. Callers must never attach input, prompt, tokens or job text. */
export const stageClock = () => process.hrtime.bigint();
export const elapsedMs = (started) => Math.round(Number(process.hrtime.bigint() - started) / 1e6);
