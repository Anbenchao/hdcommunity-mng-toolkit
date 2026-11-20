// Two-step write gate: preview -> user 确认 -> execute with preview_confirm_token.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueConfirm, consumeConfirm, consumeConfirmMeta, argsFingerprint } from '../src/tools/confirm-gate.mjs';

test('gate: token issued at preview unlocks execution with the same arguments', () => {
  const args = { id: '42', reason: 'test' };
  const issued = issueConfirm('s-gate-1', 'demo_tool', args, { action: 'do it' });
  assert.equal(issued.dry_run, true);
  assert.ok(issued.preview_confirm_token);
  const err = consumeConfirm('s-gate-1', 'demo_tool', { ...args, dry_run: false, preview_confirm_token: issued.preview_confirm_token }, issued.preview_confirm_token);
  assert.equal(err, null);
});

test('gate: token is one-time', () => {
  const issued = issueConfirm('s-gate-2', 'demo_tool', { id: '1' }, {});
  const execArgs = { id: '1', dry_run: false, preview_confirm_token: issued.preview_confirm_token };
  assert.equal(consumeConfirm('s-gate-2', 'demo_tool', execArgs, issued.preview_confirm_token), null);
  assert.match(consumeConfirm('s-gate-2', 'demo_tool', execArgs, issued.preview_confirm_token), /没有待确认/);
});

test('gate: wrong token and changed arguments are rejected', () => {
  const issued = issueConfirm('s-gate-3', 'demo_tool', { id: '1' }, {});
  assert.match(consumeConfirm('s-gate-3', 'demo_tool', { id: '1', dry_run: false, preview_confirm_token: 'bad' }, 'bad'), /不正确/);
  assert.match(
    consumeConfirm('s-gate-3', 'demo_tool', { id: '2', dry_run: false, preview_confirm_token: issued.preview_confirm_token }, issued.preview_confirm_token),
    /参数与预览不一致/,
  );
});

test('gate: execution-only flags (confirm / dry_run / token) do not change the fingerprint', () => {
  const preview = { id: '1', token: 'admin-token', dry_run: true };
  const exec = { id: '1', token: 'admin-token', dry_run: false, confirm: true, preview_confirm_token: 'x' };
  assert.equal(argsFingerprint(preview), argsFingerprint(exec));
});

test('gate: preview metadata (frozen ids) is returned on execution', () => {
  const args = { action: 'approve', filter: { status: 1 } };
  const issued = issueConfirm('s-gate-4', 'batch_tool', args, {}, { ids: [1, 2, 3] });
  const { error, meta } = consumeConfirmMeta(
    's-gate-4',
    'batch_tool',
    { ...args, dry_run: false, preview_confirm_token: issued.preview_confirm_token },
    issued.preview_confirm_token,
  );
  assert.equal(error, null);
  assert.deepEqual(meta.ids, [1, 2, 3]);
});