import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLiepinCliStderr } from '../lib/founder-liepin-stderr.mjs';

test('CLI stderr retains the failure reason while redacting token and authorization text', () => {
  const token = 'real-token-value';
  const output = sanitizeLiepinCliStderr('Validation failed: jobName is required; Authorization: Bearer real-token-value; token=real-token-value', { token });
  assert.match(output, /Validation failed: jobName is required/);
  assert.doesNotMatch(output, /real-token-value/);
  assert.match(output, /\[REDACTED\]/);
});
