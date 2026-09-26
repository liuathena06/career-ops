import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLiepinSearchError } from '../lib/founder-liepin-diagnostics.mjs';
import { sanitizeLiepinCliStderr } from '../lib/founder-liepin-stderr.mjs';

test('401 failures never display an HTML error page', () => {
  assert.equal(sanitizeLiepinCliStderr('<html><body>401 Unauthorized</body></html>'), 'Liepin credential expired or invalid');
  assert.equal(sanitizeLiepinSearchError({ message: 'request failed with status 401' }), 'Liepin credential expired or invalid');
});
