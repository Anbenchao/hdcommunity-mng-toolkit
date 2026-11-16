// Two-step confirmation gate for write tools.
//
// Every create/update/delete tool defaults to a DRY-RUN preview: it returns what
// would change plus a one-time preview_confirm_token. The actual backend call only happens
// when the caller passes dry_run:false with that token and identical parameters.
// This forces an explicit human "确认" turn before any write, preventing accidents.
//
// Token scope: per MCP session + tool, TTL (default 5 min), one-time, bound to the
// arguments fingerprint (excluding dry_run / preview_confirm_token / token).

import { createHash, randomUUID } from 'node:crypto';

const TTL_MS = Number(process.env.HDCOMMUNITY_CONFIRM_TTL_MS || 5 * 60 * 1000);
const pending = new Map(); // key `${sessionId}|${tool}` -> { token, fp, expiresAt }

export const CONFIRM_PROPS = {
  dry_run: { type: 'boolean', description: '默认 true=只预览不执行；false=真正执行（需 preview_confirm_token）' },
  preview_confirm_token: { type: 'string', description: '预览返回的一次性令牌（执行时必传）' },
};

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
}

export function argsFingerprint(args) {
  const { dry_run, confirm_token, preview_confirm_token, token, confirm, ...rest } = args || {};
  return createHash('sha256').update(stable(rest)).digest('hex');
}

export function issueConfirm(sessionId, tool, args, preview, meta) {
  const key = `${sessionId || '-'}|${tool}`;
  const token = randomUUID();
  pending.set(key, { token, fp: argsFingerprint(args), expiresAt: Date.now() + TTL_MS, meta });
  return {
    dry_run: true,
    tool,
    preview,
    preview_confirm_token: token,
    expires_in_seconds: Math.floor(TTL_MS / 1000),
    next: '把 preview 展示给用户，等用户回复[确认]后，再用相同参数 + dry_run:false + preview_confirm_token 调用本工具',
  };
}

export function consumeConfirmMeta(sessionId, tool, args, token) {
  const key = `${sessionId || '-'}|${tool}`;
  const entry = pending.get(key);
  if (!entry) return { error: '没有待确认的预览：请先以 dry_run=true（默认）调用本工具，并把预览展示给用户' };
  if (Date.now() > entry.expiresAt) {
    pending.delete(key);
    return { error: '确认已过期，请重新预览并再次征得用户确认' };
  }
  if (!token || token !== entry.token) return { error: 'preview_confirm_token 不正确：请先预览并等用户回复[确认]' };
  if (argsFingerprint(args) !== entry.fp) return { error: '执行参数与预览不一致：请重新预览后再确认' };
  pending.delete(key);
  return { error: null, meta: entry.meta };
}

export function consumeConfirm(sessionId, tool, args, token) {
  return consumeConfirmMeta(sessionId, tool, args, token).error;
}

export function clearConfirm(sessionId, tool) {
  pending.delete(`${sessionId || '-'}|${tool}`);
}