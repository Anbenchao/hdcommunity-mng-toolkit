// Environment labeling: envInfo() must make test/prod/mixed/custom explicit so write
// previews can carry `env` and nobody mixes the two environments by accident.
// develop defaults to TEST; main defaults to PROD.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_URL = pathToFileURL(join(__dirname, '..', 'src', 'config.mjs')).href;

function readEnvInfo(env) {
  const childEnv = { ...process.env };
  delete childEnv.HDCOMMUNITY_BASE;
  delete childEnv.HDGROW_BASE;
  Object.assign(childEnv, env);
  const code = `const m = await import(${JSON.stringify(CONFIG_URL)}); console.log(JSON.stringify(m.envInfo()));`;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: childEnv, timeout: 30_000 });
  assert.equal(res.status, 0, `child failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim());
}

test('defaults are test on develop', () => {
  const info = readEnvInfo();
  assert.equal(info.env, 'test');
  assert.equal(info.blog_base, 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice');
  assert.equal(info.grow_base, 'https://opctest-dataset.developer.huaweicloud.com/api/v1/hdgrowservice');
});

test('explicit production bases are labeled prod', () => {
  const info = readEnvInfo({
    HDCOMMUNITY_BASE: 'https://open-dataset.huaweicloud.com/api/v1/blogservice',
    HDGROW_BASE: 'https://grow-dataset.developer.huaweicloud.com/api/v1/hdgrowservice',
  });
  assert.equal(info.env, 'prod');
});

test('mixing test and prod is labeled mixed', () => {
  const info = readEnvInfo({
    HDGROW_BASE: 'https://grow-dataset.developer.huaweicloud.com/api/v1/hdgrowservice',
  });
  assert.equal(info.env, 'mixed');
});

test('unrecognized base is labeled custom', () => {
  const info = readEnvInfo({
    HDCOMMUNITY_BASE: 'http://127.0.0.1:8080/api/v1/blogservice',
    HDGROW_BASE: 'http://127.0.0.1:8080/api/v1/hdgrowservice',
  });
  assert.equal(info.env, 'custom');
});