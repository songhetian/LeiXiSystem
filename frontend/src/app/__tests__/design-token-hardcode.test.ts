/**
 * 设计 token 闸门：前端页面不得硬编码十六进制颜色（ADR-0014 / REFACTOR_PLAN §11）。
 *
 * 背景：硬编码 hex 不随明暗主题切换，暗色下会与背景撞色；`okr.tsx` / `cycles.tsx`
 * 都曾把卡片色/状态色写成字面量。本闸门把它变成可复跑的门槛。
 *
 * 例外（附理由，非"图省事"）：
 *  - app/layout.tsx、app/manifest.ts：Next.js metadata 与 PWA manifest 规范
 *    要求真值色，无法用 CSS 变量。
 *  - 班次 / 员工标签调色板：颜色是**用户可选并持久化到数据库**的调色板
 *    （shifts.color / tag.color），本质是数据而非样式。
 *
 * 注意扫描前会剔除注释与 `var(--x, #hex)` 回退值（回退值是有意为之的兼容写法）。
 */
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.join(__dirname, '..', '..');

const ALLOWLIST = new Set([
  'app/layout.tsx',
  'app/manifest.ts',
  'features/attendance/pages/ShiftForm.tsx',
  'features/attendance/pages/shifts.tsx',
  'features/employee/pages/tags.tsx',
  'features/employee/pages/list.tsx',
]);

const SCAN_DIRS = ['features', 'app'];
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...collectFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/** 去掉注释与 var(..., #hex) 回退值后，返回剩余内容里出现的硬编码色 */
function hardcodedColors(raw: string): string[] {
  const withoutBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLineComments = withoutBlockComments.replace(/\/\/[^\n]*/g, '');
  const withoutVarFallback = withoutLineComments.replace(/var\(\s*--[^,)]+,\s*#[0-9a-fA-F]{3,8}\s*\)/g, 'var(--x)');
  return withoutVarFallback.match(HEX_RE) ?? [];
}

describe('设计 token 闸门（禁止硬编码 hex）', () => {
  it('features / app 下的生产页面不得出现硬编码十六进制颜色', () => {
    const violations: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of collectFiles(path.join(SRC_ROOT, dir))) {
        const rel = path.relative(SRC_ROOT, file).split(path.sep).join('/');
        if (ALLOWLIST.has(rel)) continue;
        const found = hardcodedColors(fs.readFileSync(file, 'utf-8'));
        if (found.length > 0) {
          violations.push(`${rel}: ${[...new Set(found)].join(', ')}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
