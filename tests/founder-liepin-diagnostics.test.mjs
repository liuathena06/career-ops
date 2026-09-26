import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiepinSearchDiagnostics, sanitizeLiepinSearchError } from '../lib/founder-liepin-diagnostics.mjs';

test('diagnostics report only safe status fields', () => {
  const diagnostic = createLiepinSearchDiagnostics({ tokenAvailable: true });
  assert.deepEqual(diagnostic, {
    profileSearchCriteriaGenerated: false, liepinCliFound: null, tokenAvailable: true, credentialSource: "liepin-cli config",
    liepinCliExitStatus: null, responseParse: 'not_attempted', sanitizedErrorMessage: null,
  });
});

test('CLI failures are sanitized without stderr, command arguments, or token values', () => {
  assert.equal(sanitizeLiepinSearchError({ code: 'ENOENT', stderr: 'Bearer secret' }), '未找到 liepin-cli。');
  assert.equal(sanitizeLiepinSearchError({ code: 2, stderr: 'x-user-token-secret' }), 'liepin-cli 以状态 2 退出。');
});
