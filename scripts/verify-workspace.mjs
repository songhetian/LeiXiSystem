#!/usr/bin/env node
/**
 * 工作区结构校验器 (TDD 红绿重构用)
 *
 * 断言目标顶层结构：
 *   backend/   原 apps/server   (@lei/backend)
 *   frontend/  原 apps/web       (@lei/frontend)
 *   shared/    原 packages/shared (@lei/shared)
 * 并且 pnpm-workspace.yaml 正确指向三者。
 *
 * 退出码 0 = 结构合规(GREEN)，1 = 不合规(RED)。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
const checks = [];

function expect(cond, msg) {
  checks.push({ ok: !!cond, msg });
}

function isDirEmpty(p) {
  if (!existsSync(p)) return true; // 不存在视为"已移除"，合规
  const entries = readdirSync(p).filter(
    (n) => !['.git', 'node_modules'].includes(n),
  );
  return entries.length === 0;
}

// --- 目标目录应存在 ---
expect(existsSync(resolve(root, 'backend')) && statSync(resolve(root, 'backend')).isDirectory(),
  'backend/ 应存在（原 apps/server）');
expect(existsSync(resolve(root, 'frontend')) && statSync(resolve(root, 'frontend')).isDirectory(),
  'frontend/ 应存在（原 apps/web）');
expect(existsSync(resolve(root, 'shared')) && statSync(resolve(root, 'shared')).isDirectory(),
  'shared/ 应存在（原 packages/shared）');

// --- 旧目录应已移除或清空 ---
expect(isDirEmpty(resolve(root, 'apps')), 'apps/ 应已移除或为空');
expect(isDirEmpty(resolve(root, 'packages')), 'packages/ 应已移除或为空');

// --- pnpm-workspace.yaml 应指向新目录 ---
let yaml = '';
try {
  yaml = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
} catch {
  /* 下面断言会 FAIL */
}
expect(/^\s*-\s*["']?backend["']?\s*$/m.test(yaml), 'pnpm-workspace.yaml 应包含 backend');
expect(/^\s*-\s*["']?frontend["']?\s*$/m.test(yaml), 'pnpm-workspace.yaml 应包含 frontend');
expect(/^\s*-\s*["']?shared["']?\s*$/m.test(yaml), 'pnpm-workspace.yaml 应包含 shared');

// --- 包名应与目录对齐 ---
function pkgName(p) {
  try {
    return JSON.parse(readFileSync(resolve(root, p, 'package.json'), 'utf8')).name;
  } catch {
    return null;
  }
}
expect(pkgName('backend') === '@lei/backend', 'backend/package.json name 应为 @lei/backend');
expect(pkgName('frontend') === '@lei/frontend', 'frontend/package.json name 应为 @lei/frontend');
expect(pkgName('shared') === '@lei/shared', 'shared/package.json name 应为 @lei/shared');

let failed = 0;
console.log('\n=== 工作区结构校验 ===');
for (const c of checks) {
  console.log(`${c.ok ? '✅ PASS' : '❌ FAIL'}  ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(`\n结果: ${failed === 0 ? 'GREEN ✅ 结构合规' : `RED ❌ ${failed} 项不合规`}\n`);
process.exit(failed ? 1 : 0);
