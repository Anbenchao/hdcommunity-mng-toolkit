// Toolkit configuration: backend base URL, admin paths, region, timeouts.
//
// v1.2: 用户面与管理面已合并为单一服务（hdblogservice，context-path /api/v1/blogservice）。
// 用户面/管理面/展示面的 Agent 接口同属该 base，管理面真实登录接口在 /manage/auth/*。
//
// 分支默认口径（强制）：
//   main    -> 现网：HDCOMMUNITY_BASE=open-dataset / HDGROW_BASE=grow-dataset
//   develop -> 测试：HDCOMMUNITY_BASE=opentest-dataset / HDGROW_BASE=opctest-dataset
// 不要把测试配置带进 main。

export const BACKEND_BASE = process.env.HDCOMMUNITY_BASE || 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

// 管理面真实登录接口（可直接对接现有后端）
export const ADMIN_LOGIN_PATH = process.env.HDCOMMUNITY_ADMIN_LOGIN_PATH || '/manage/auth/login';
export const ADMIN_LOGOUT_PATH = process.env.HDCOMMUNITY_ADMIN_LOGOUT_PATH || '/manage/auth/logout';

// 管理面博客详情接口（后端 A3 契约；{id} 为占位符）
export const ADMIN_BLOG_DETAIL_PATH = process.env.HDCOMMUNITY_ADMIN_BLOG_DETAIL_PATH || '/manage/blog/{id}/detail';

export const REGION = process.env.HW_REGION || 'cn-north-4';

export const DEFAULT_TIMEOUT_MS = Number(process.env.HDCOMMUNITY_TIMEOUT_MS || 30000);

// ---------------------------------------------------------------------------
// Growth center (HDGrowService) — parallel capability to the community/blog side.
//
//   /agent/show/grow/**  public read-only (no auth)     -> callGrowShow
//   /agent/grow/**       business (AK/SK, per request)   -> callGrow
//   /agent/admin/grow/** management (Bearer)             -> callGrowAdmin
//
// main 默认现网；可用 HDGROW_BASE 显式覆盖（形如 https://<gateway>/api/v1/hdgrowservice）。
// ---------------------------------------------------------------------------

export function growBase() {
  return process.env.HDGROW_BASE || 'https://grow-dataset.developer.huaweicloud.com/api/v1/hdgrowservice';
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Report which environment the current configuration points at, so write tools can
 * show `env` in every preview (prevents mixing test/prod by accident).
 * @returns {{env: 'test'|'prod'|'mixed'|'custom', blog_base: string, grow_base: string}}
 */
export function envInfo() {
  const blogBase = BACKEND_BASE;
  const growBaseUrl = growBase();
  const blogHost = hostOf(blogBase);
  const growHost = hostOf(growBaseUrl);
  const blogTest = blogHost.startsWith('opentest-');
  const growTest = growHost.startsWith('opctest-');
  const blogProd = blogHost === 'open-dataset.huaweicloud.com';
  const growProd = growHost === 'grow-dataset.developer.huaweicloud.com';
  const testHits = Number(blogTest) + Number(growTest);
  const prodHits = Number(blogProd) + Number(growProd);
  const customHits = 2 - testHits - prodHits;
  let env = 'mixed';
  if (testHits === 2) env = 'test';
  else if (prodHits === 2) env = 'prod';
  else if (customHits === 2) env = 'custom';
  return { env, blog_base: blogBase, grow_base: growBaseUrl };
}