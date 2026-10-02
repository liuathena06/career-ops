import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiepinCli } from '../lib/founder-liepin-cli-path.mjs';
import { join } from 'node:path';

test('dedicated spike venv takes priority over optional and PATH executables', () => {
  const home = join('/', 'Users', 'test');
  const preferred = join(home, 'dev', 'liepin-cli-spike', '.venv', 'bin', 'liepin-cli');
  assert.equal(resolveLiepinCli({ home, environment: { LIEPIN_CLI_PATH: '/custom/liepin-cli', PATH: '/bin' }, exists: (path) => path === preferred }), preferred);
});
